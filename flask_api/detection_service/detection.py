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
    def __init__(self, socketio, video_path, model_path="./sample/best.pt", plate_model_path="./plates/best.pt"):
        self.socketio = socketio
        self.video_path = video_path
        self.model = YOLO(model_path)  # Vehicle detection model
        self.plate_model = YOLO(plate_model_path)  # Plate detection model
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
        """
        try:
            if not box or len(box[0]) != 4:
                return ""
            x1, y1, x2, y2 = map(int, box[0])
            
            # Extract ROI directly from image
            roi = image[y1:y2, x1:x2]
            
            # Basic image preprocessing
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
            
            # Run OCR on the processed image
            ocr_result = self.ocr.ocr(thresh, cls=True)
            
            # Process OCR results similar to detect.py
            if ocr_result and len(ocr_result) > 0:
                text = " ".join([line[1][0] for line in ocr_result[0] if line and len(line) > 1])
                return text.strip()
            return ""
            
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""

    def process_frame(self, frame, size=(640, 480)):
        # Resize the frame to 640x480
        frame = cv2.resize(frame, size)
        results = self.model(frame, conf=0.5, iou=0.5)  # Vehicle detection
        detections = []
        for box in results[0].boxes:
            coords = box.xyxy.cpu().numpy().tolist()[0]
            label = self.model.names[int(box.cls)]
            confidence = float(box.conf)
            x1, y1, x2, y2 = map(int, coords)
            roi = frame[y1:y2, x1:x2]

            # Plate detection within the vehicle ROI
            plate_results = self.plate_model(roi, conf=0.5, iou=0.5)
            plate_detections = []
            for plate_box in plate_results[0].boxes:
                plate_coords = plate_box.xyxy.cpu().numpy().tolist()[0]
                plate_confidence = float(plate_box.conf)
                px1, py1, px2, py2 = map(int, plate_coords)
                plate_roi = roi[py1:py2, px1:px2]

                # Temporarily comment out OCR
                plate_text = self.extract_text_from_roi(roi, [[px1, py1, px2, py2]])
                # plate_text = ""  # Placeholder for OCR text
                self.log_detection("Plate", plate_confidence, plate_text)

                plate_detections.append({
                    "label": "Plate",
                    "confidence": plate_confidence,
                    "coordinates": [px1, py1, px2, py2],
                    "ocr_text": plate_text,
                })

            # Calculate the mean BGR color for the vehicle ROI
            hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
            mean_hsv = cv2.mean(hsv_roi)[:3]
            mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
            mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
            hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))

            # Log vehicle detection
            self.log_detection(label, confidence, "")

            detections.append({
                "label": label,
                "color_annotation": hex_color,  # Include color annotation
                "confidence": confidence,
                "coordinates": coords,
                "plates": plate_detections,  # Include plate detections
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
