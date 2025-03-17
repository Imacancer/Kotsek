# import cv2
# import base64
# import time
# import numpy as np
# import re
# from flask_socketio import SocketIO, emit
# from ultralytics import YOLO
# from datetime import datetime
# from threading import Thread
# from queue import Queue
# import easyocr 

# class VideoProcessor:
#     def __init__(self, socketio, video_path, model_path="./sample/best.pt"):
#         self.socketio = socketio
#         self.video_path = video_path
#         self.model = YOLO(model_path)
#         self.frame_queue = Queue(maxsize=10)
#         self.result_queue = Queue(maxsize=10)
#         self.running = False
#         self.video_capture = None
#         self.producer_thread = None
#         self.processor_thread = None
#         self.emit_thread = None

#         # Initialize EasyOCR reader (using English; enable GPU if available)
#         self.ocr_reader = easyocr.Reader(['en'], gpu=True)

#     # --- Utility Methods (Logging, OCR preprocessing, etc.) ---

#     def log_detection(self, label, confidence, ocr_text):
#         timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
#         if ocr_text:
#             print(f"[{timestamp}] DETECTED: {label} | Conf: {confidence:.2f} | Plate: {ocr_text}")
#         else:
#             print(f"[{timestamp}] DETECTED: {label} | Conf: {confidence:.2f} | No text found")

#     def preprocess_for_ocr(self, image):
#         try:
#             gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image.copy()
#             min_height = 50
#             if gray.shape[0] < min_height:
#                 scale = min_height / gray.shape[0]
#                 gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
#             clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
#             gray = clahe.apply(gray)
#             gray = cv2.bilateralFilter(gray, 11, 17, 17)
#             binary = cv2.adaptiveThreshold(
#                 gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#                 cv2.THRESH_BINARY_INV, 11, 2
#             )
#             kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
#             binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
#             binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
#             binary = cv2.bitwise_not(binary)
#             padding = 10
#             binary = cv2.copyMakeBorder(
#                 binary, padding, padding, padding, padding,
#                 cv2.BORDER_CONSTANT, value=255
#             )
#             return binary
#         except Exception as e:
#             print(f"Preprocessing error: {e}")
#             return image

#     def validate_plate_number(self, text):
#         text = ''.join(c for c in text if c.isalnum()).upper()
#         pattern = r'^[A-Z]{3}\d{4}$'
#         if re.match(pattern, text):
#             return text
#         text = text.replace('0', 'O').replace('1', 'I').replace('8', 'B')
#         letter_pattern = r'[A-Z]{3}'
#         number_pattern = r'\d{4}'
#         letters = re.search(letter_pattern, text)
#         numbers = re.search(number_pattern, text)
#         return letters.group() + numbers.group() if letters and numbers else ""

#     def extract_text_from_roi(self, image, box):
#         try:
#             if not box or len(box[0]) != 4:
#                 return ""
#             x1, y1, x2, y2 = map(int, box[0])
#             padding = 10
#             y1 = max(0, y1 - padding)
#             y2 = min(image.shape[0], y2 + padding)
#             x1 = max(0, x1 - padding)
#             x2 = min(image.shape[1], x2 + padding)
#             roi = image[y1:y2, x1:x2]
#             if roi.size == 0 or roi.shape[0] < 15 or roi.shape[1] < 15:
#                 return ""
#             processed_roi = self.preprocess_for_ocr(roi)
#             # Use EasyOCR to extract text; detail=0 returns just the text strings,
#             # and paragraph=True groups related words together.
#             results = self.ocr_reader.readtext(processed_roi, detail=0, paragraph=True)
#             for text in results:
#                 validated = self.validate_plate_number(text)
#                 if validated:
#                     print(f"[{datetime.now()}] Plate: {validated}")
#                     return validated
#             return ""
#         except Exception as e:
#             print(f"EasyOCR Error: {e}")
#             return ""

#     # --- Core Frame Processing ---

#     def process_frame(self, frame, size=(640, 480)):
#         frame = cv2.resize(frame, size)
#         results = self.model(frame, conf=0.65, iou=0.5)
#         detections = []
#         for box in results[0].boxes:
#             coords = box.xyxy.cpu().numpy().tolist()[0]
#             label = self.model.names[int(box.cls)]
#             confidence = float(box.conf)
#             x1, y1, x2, y2 = map(int, coords)
#             roi = frame[y1:y2, x1:x2]
#             hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
#             mean_hsv = cv2.mean(hsv_roi)[:3]
#             mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
#             mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
#             hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))
#             lower_red1 = np.array([0, 120, 70])
#             upper_red1 = np.array([10, 255, 255])
#             lower_red2 = np.array([170, 120, 70])
#             upper_red2 = np.array([180, 255, 255])
#             mask1 = cv2.inRange(hsv_roi, lower_red1, upper_red1)
#             mask2 = cv2.inRange(hsv_roi, lower_red2, upper_red2)
#             red_mask = cv2.bitwise_or(mask1, mask2)
#             red_ratio = cv2.countNonZero(red_mask) / (roi.shape[0] * roi.shape[1])
#             detected_color = "Red" if red_ratio > 0.5 else "Not Red"
#             ocr_text = ""
#             if confidence > 0.7:
#                 ocr_text = self.extract_text_from_roi(frame, [[x1, y1, x2, y2]])
#             detections.append({
#                 "label": label,
#                 "color_annotation": hex_color,
#                 "coordinates": coords,
#                 "ocr_text": ocr_text if len(ocr_text) >= 6 else "",
#             })
#         annotated_frame = results[0].plot()
#         return annotated_frame, detections

#     def frame_producer(self, cap):
#         fps = cap.get(cv2.CAP_PROP_FPS)
#         frame_delay = 1.0 / fps if fps > 0 else 0.033  # fallback delay if fps is unavailable
#         while self.running:
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             while self.frame_queue.full() and self.running:
#                 time.sleep(0.01)
#             self.frame_queue.put(frame)
#             time.sleep(frame_delay)

#     def frame_processor(self):
#         while self.running:
#             if self.frame_queue.empty():
#                 time.sleep(0.01)
#                 continue
#             frame = self.frame_queue.get()
#             annotated_frame, detections = self.process_frame(frame)
#             encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 60]
#             _, buffer = cv2.imencode('.jpg', annotated_frame, encode_param)
#             frame_data = base64.b64encode(buffer).decode('utf-8')
#             self.result_queue.put({
#                 "frame_data": frame_data,
#                 "detections": detections
#             })

#     def emit_frames(self):
#         start_time = time.time()
#         frame_count = 0
#         while self.running:
#             if self.result_queue.empty():
#                 time.sleep(0.01)
#                 continue
#             result = self.result_queue.get()
#             frame_count += 1
#             elapsed_time = time.time() - start_time
#             fps = frame_count / elapsed_time if elapsed_time > 0 else 0
#             self.socketio.emit("video_frame", {
#                 "entrance_frame": result["frame_data"],
#                 "entrance_detections": result["detections"],
#                 "fps": fps
#             })
#             if frame_count % 30 == 0:
#                 print(f"Processing FPS: {fps:.2f}")
#                 if frame_count > 100:
#                     start_time = time.time()
#                     frame_count = 0
#         if self.video_capture:
#             self.video_capture.release()
#             print("Video stream stopped.")

#     # --- Start/Stop Methods ---

#     def start(self):
#         if self.running:
#             return  # Already running
#         self.running = True
#         self.video_capture = cv2.VideoCapture(self.video_path)
#         if not self.video_capture.isOpened():
#             self.socketio.emit("video_error", {"error": "Video file not available"})
#             self.running = False
#             return
#         self.video_capture.set(cv2.CAP_PROP_BUFFERSIZE, 2)
#         self.producer_thread = Thread(target=self.frame_producer, args=(self.video_capture,))
#         self.processor_thread = Thread(target=self.frame_processor)
#         self.emit_thread = Thread(target=self.emit_frames)
#         self.producer_thread.daemon = True
#         self.processor_thread.daemon = True
#         self.emit_thread.daemon = True
#         self.producer_thread.start()
#         self.processor_thread.start()
#         self.emit_thread.start()
#         print("Video processing started.")

#     def stop(self):
#         if not self.running:
#             return
#         self.running = False
#         print("Stopping video processing.")
