import cv2
import base64
import time
import numpy as np
from paddleocr import PaddleOCR
from flask_socketio import SocketIO, emit
from ultralytics import YOLO
from datetime import datetime
from threading import Thread
from queue import Queue

class VideoProcessor:
    def __init__(self, socketio, video_path, model_path="./sample/best.pt"):
        self.socketio = socketio
        self.video_path = video_path
        self.model = YOLO(model_path)
        self.frame_queue = Queue(maxsize=10)
        self.result_queue = Queue(maxsize=10)
        self.running = False
        self.video_capture = None
        self.producer_thread = None
        self.processor_thread = None
        self.emit_thread = None
        # Simplified PaddleOCR initialization for ANPR
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

    def log_detection(self, label, confidence, ocr_text):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        if ocr_text:
            print(f"[{timestamp}] DETECTED: {label} | Conf: {confidence:.2f} | Plate: {ocr_text}")
        else:
            print(f"[{timestamp}] DETECTED: {label} | Conf: {confidence:.2f} | No text found")

    def extract_text_from_roi(self, image, box):
        """
        Extract text from the ROI defined by the bounding box.
        A padding is added, and the ROI is upscaled if it is too small to improve OCR performance.
        """
        try:
            if not box or len(box[0]) != 4:
                return ""
            x1, y1, x2, y2 = map(int, box[0])
            padding = 10
            y1 = max(0, y1 - padding)
            y2 = min(image.shape[0], y2 + padding)
            x1 = max(0, x1 - padding)
            x2 = min(image.shape[1], x2 + padding)
            roi = image[y1:y2, x1:x2]

            # Upscale ROI if too small for better OCR accuracy
            h, w = roi.shape[:2]
            if w < 100 or h < 30:
                scale_factor = 2
                roi = cv2.resize(roi, (w * scale_factor, h * scale_factor), interpolation=cv2.INTER_CUBIC)

            # Ensure ROI is 3-channel
            if len(roi.shape) == 2:
                roi = cv2.cvtColor(roi, cv2.COLOR_GRAY2BGR)

            # Run OCR on the ROI
            ocr_result = self.ocr.ocr(roi, cls=True)
            # Combine multiple OCR results if present
            text = " ".join([line[1][0] for line in ocr_result])
            return text.strip()
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""

    def process_frame(self, frame, size=(640, 480)):
        # Resize the frame to 640x480
        frame = cv2.resize(frame, size)
        results = self.model(frame, conf=0.5, iou=0.5)
        detections = []
        for box in results[0].boxes:
            coords = box.xyxy.cpu().numpy().tolist()[0]
            label = self.model.names[int(box.cls)]
            confidence = float(box.conf)
            x1, y1, x2, y2 = map(int, coords)
            roi = frame[y1:y2, x1:x2]

            # Example: Calculate the mean BGR color (for a color annotation)
            hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            mean_hsv = cv2.mean(hsv_roi)[:3]
            mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
            mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
            hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))

            # Apply ANPR (OCR) on the detected bounding box (with padding)
            ocr_text = self.extract_text_from_roi(frame, [[x1, y1, x2, y2]])
            self.log_detection(label, confidence, ocr_text)

            detections.append({
                "label": label,
                "color_annotation": hex_color,
                "confidence": confidence,
                "coordinates": coords,
                "ocr_text": ocr_text,
            })
        annotated_frame = results[0].plot()
        return annotated_frame, detections

    def frame_producer(self, cap):
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_delay = 1.0 / fps if fps > 0 else 0.033  # fallback delay if FPS is unavailable
        while self.running:
            ret, frame = cap.read()
            if not ret:
                break
            while self.frame_queue.full() and self.running:
                time.sleep(0.01)
            self.frame_queue.put(frame)
            time.sleep(frame_delay)

    def frame_processor(self):
        while self.running:
            if self.frame_queue.empty():
                time.sleep(0.01)
                continue
            frame = self.frame_queue.get()
            annotated_frame, detections = self.process_frame(frame)
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 60]
            _, buffer = cv2.imencode('.jpg', annotated_frame, encode_param)
            frame_data = base64.b64encode(buffer).decode('utf-8')
            self.result_queue.put({
                "frame_data": frame_data,
                "detections": detections
            })

    def emit_frames(self):
        start_time = time.time()
        frame_count = 0
        while self.running:
            if self.result_queue.empty():
                time.sleep(0.01)
                continue
            result = self.result_queue.get()
            frame_count += 1
            elapsed_time = time.time() - start_time
            fps = frame_count / elapsed_time if elapsed_time > 0 else 0
            self.socketio.emit("video_frame", {
                "entrance_frame": result["frame_data"],
                "entrance_detections": result["detections"],
                "fps": fps
            })
            if frame_count % 30 == 0:
                print(f"Processing FPS: {fps:.2f}")
                if frame_count > 100:
                    start_time = time.time()
                    frame_count = 0
        if self.video_capture:
            self.video_capture.release()
            print("Video stream stopped.")

    def start(self):
        if self.running:
            return  # Already running
        self.running = True
        self.video_capture = cv2.VideoCapture(self.video_path)
        if not self.video_capture.isOpened():
            self.socketio.emit("video_error", {"error": "Video file not available"})
            self.running = False
            return
        self.video_capture.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        self.producer_thread = Thread(target=self.frame_producer, args=(self.video_capture,))
        self.processor_thread = Thread(target=self.frame_processor)
        self.emit_thread = Thread(target=self.emit_frames)
        self.producer_thread.daemon = True
        self.processor_thread.daemon = True
        self.emit_thread.daemon = True
        self.producer_thread.start()
        self.processor_thread.start()
        self.emit_thread.start()
        print("Video processing started.")

    def stop(self):
        if not self.running:
            return
        self.running = False
        print("Stopping video processing.")
