# import cv2
# import base64
# import time
# import numpy as np
# import re 
# import pytesseract
# from flask_socketio import SocketIO, emit
# from ultralytics import YOLO
# from datetime import datetime
# from threading import Thread
# from queue import Queue


# pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'

# def log_detection(label, confidence, ocr_text):
#     """Enhanced logging with more details"""
#     timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
#     if ocr_text:
#         print(f"[{timestamp}] DETECTED:")
#         print(f"  - Type: {label}")
#         print(f"  - Confidence: {confidence:.2f}")
#         print(f"  - Plate Number: {ocr_text}")
#         print(f"  - Validation: {'Valid' if validate_plate_number(ocr_text) else 'Invalid'}")
#     else:
#         print(f"[{timestamp}] DETECTED - Type: {label} | Confidence: {confidence:.2f} | No text found")

# def preprocess_for_ocr(image):
#     """Enhanced preprocessing pipeline specifically for Philippine license plates"""
#     try:
#         # Convert to grayscale if not already
#         if len(image.shape) == 3:
#             gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
#         else:
#             gray = image.copy()

#         # Resize if too small (minimum height of 50 pixels)
#         min_height = 50
#         if gray.shape[0] < min_height:
#             scale = min_height / gray.shape[0]
#             gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

#         # Apply adaptive histogram equalization
#         clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
#         gray = clahe.apply(gray)

#         # Bilateral filter to reduce noise while preserving edges
#         gray = cv2.bilateralFilter(gray, 11, 17, 17)

#         # Adaptive thresholding to handle different lighting conditions
#         binary = cv2.adaptiveThreshold(
#             gray, 
#             255,
#             cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
#             cv2.THRESH_BINARY_INV,
#             11,
#             2
#         )

#         # Morphological operations to clean up the image
#         kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3,3))
#         binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
#         binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

#         # Invert back to black text on white background for OCR
#         binary = cv2.bitwise_not(binary)

#         # Add padding
#         padding = 10
#         binary = cv2.copyMakeBorder(
#             binary,
#             padding, padding, padding, padding,
#             cv2.BORDER_CONSTANT,
#             value=255
#         )

#         return binary

#     except Exception as e:
#         print(f"Preprocessing error: {e}")
#         return image

# def validate_plate_number(text):
#     """Validate and format Philippine license plate number"""
#     # Remove all non-alphanumeric characters
#     text = ''.join(c for c in text if c.isalnum()).upper()
    
#     # Philippine plate pattern: 3 letters followed by 4 numbers
#     pattern = r'^[A-Z]{3}\d{4}$'
    
#     if re.match(pattern, text):
#         return text
    
#     # Try to correct common OCR mistakes
#     text = text.replace('0', 'O').replace('1', 'I').replace('8', 'B')
    
#     # If still not matching, try to extract any sequence of 3 letters and 4 numbers
#     letter_pattern = r'[A-Z]{3}'
#     number_pattern = r'\d{4}'
    
#     letters = re.search(letter_pattern, text)
#     numbers = re.search(number_pattern, text)
    
#     if letters and numbers:
#         return letters.group() + numbers.group()
    
#     return ""

# def extract_text_from_roi(image, box):
#     """Improved ROI text extraction for license plates"""
#     try:
#         if not box or len(box[0]) != 4:
#             return ""

#         # Extract coordinates with padding
#         x1, y1, x2, y2 = map(int, box[0])
#         padding = 10
#         y1 = max(0, y1 - padding)
#         y2 = min(image.shape[0], y2 + padding)
#         x1 = max(0, x1 - padding)
#         x2 = min(image.shape[1], x2 + padding)

#         # Extract ROI
#         roi = image[y1:y2, x1:x2]
#         if roi.size == 0 or roi.shape[0] < 15 or roi.shape[1] < 15:
#             return ""

#         # Process the ROI
#         processed_roi = preprocess_for_ocr(roi)

#         # Try multiple OCR configurations
#         results = []
        
#         # Configuration 1: Standard with whitelist
#         config1 = '--oem 3 --psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
#         text1 = pytesseract.image_to_string(processed_roi, config=config1).strip()
#         if text1:
#             results.append(text1)

#         # Configuration 2: License plate specific
#         config2 = '--oem 3 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
#         text2 = pytesseract.image_to_string(processed_roi, config=config2).strip()
#         if text2:
#             results.append(text2)

#         # Configuration 3: Single line with character spacing
#         config3 = '--oem 3 --psm 7 --user-patterns eng.patterns -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
#         text3 = pytesseract.image_to_string(processed_roi, config=config3).strip()
#         if text3:
#             results.append(text3)

#         # Try to validate each result
#         for text in results:
#             validated_text = validate_plate_number(text)
#             if validated_text:
#                 # Log successful detection
#                 print(f"[{datetime.now()}] Successfully extracted plate: {validated_text}")
#                 return validated_text

#         return ""

#     except Exception as e:
#         print(f"OCR Error: {e}")
#         return ""

# # def start_video(socketio):

# #     model = YOLO("/Users/manuel/Documents/C2_Project/flask_api/sample/best.pt")

    

# #     @socketio.on("start_video")
# #     def handle_start_video(data):

# #         # For testing, use a video file instead of camera
# #         video_path = "/Users/manuel/Documents/C2_Project/flask_api/sample/sample2.mp4"  # Replace with your video file path
# #         cap = cv2.VideoCapture(video_path)

# #         # camera_index = int(data.get("camera_index", 0))
        
# #         # cap = cv2.VideoCapture(camera_index)

# #         if not cap.isOpened():
# #             emit("video_error", {"error": f"Video File not available"})
# #             return

# #         try:
# #             while True:
# #                 success, frame = cap.read()
# #                 if not success:
# #                     break

# #                 frame_height, frame_width = frame.shape[:2]
# #                 results = model(frame)

# #                 annotated_frame = results[0].plot()

# #                 detections = []
# #                 for box in results[0].boxes:

# #                     coords = box.xyxy.cpu().numpy().tolist()[0]

# #                     x1 = int(max(0, (coords[0] - coords[2]/2)))
# #                     y1 = int(max(0, (coords[1] - coords[3]/2)))
# #                     x2 = int(min(frame_width, (coords[0] + coords[2]/2)))
# #                     y2 = int(min(frame_height, (coords[1] + coords[3]/2)))

# #                     label = model.names[int(box.cls)]
# #                     confidence = float(box.conf)

                    
# #                     ocr_text = extract_text_from_roi(frame, [[x1, y1, x2, y2]])
                    
                    
# #                     detections.append({
# #                         "label": label,
# #                         "confidence": confidence,
# #                         "coordinates": coords,
# #                         "ocr_text": ocr_text if len(ocr_text) >= 6 else ""
# #                     })
                
# #                 _, buffer = cv2.imencode(".jpg", annotated_frame)
# #                 frame_data = base64.b64encode(buffer).decode("utf-8")
               
# #                 socketio.emit("video_frame", {"frame": frame_data, "detections": detections})

                
# #                 # time.sleep(0.03)
# #         except Exception as e:
# #             print(f"Error: {e}")
# #             socketio.emit("video_error", {"error": str(e)})
# #         finally:
# #             cap.release()
# #             print("Camera stream stopped.")


# # def start_video(socketio):
# #     model = YOLO("/Users/manuel/Documents/C2_Project/flask_api/sample/best.pt")

# #     def process_detections(results, frame):
# #         detections = []
# #         for box in results[0].boxes:
# #             coords = box.xyxy.cpu().numpy().tolist()[0]
# #             label = model.names[int(box.cls)]
# #             confidence = float(box.conf)
            
# #             # Extract coordinates with padding
# #             x1, y1, x2, y2 = map(int, coords)
            
# #             # Perform OCR on the detected region
# #             ocr_text = extract_text_from_roi(frame, [[x1, y1, x2, y2]])

# #             detections.append({
# #                 "label": label,
# #                 "confidence": confidence,
# #                 "coordinates": coords,
# #                 "ocr_text": ocr_text if len(ocr_text) >= 6 else ""
# #             })
# #         return detections

# #     @socketio.on("start_video")
# #     def handle_start_video(data=None):
# #         # Define separate video paths for entrance and exit
# #         entrance_video_path = "/Users/manuel/Documents/C2_Project/flask_api/sample/sample1.MOV"

# #         # Open both video streams
# #         entrance_cap = cv2.VideoCapture(entrance_video_path)

# #         if not entrance_cap.isOpened():
# #             emit("video_error", {"error": "Video files not available"})
# #             return

# #         try:
# #             while True:
# #                 # Read frames from both cameras
# #                 entrance_success, entrance_frame = entrance_cap.read()

# #                 if not entrance_success:
# #                     break

# #                 # Process entrance frame
# #                 entrance_results = model(entrance_frame)
# #                 entrance_annotated_frame = entrance_results[0].plot()
# #                 entrance_detections = process_detections(entrance_results, entrance_frame)

# #                 # Encode entrance and exit frames separately
# #                 _, entrance_buffer = cv2.imencode(".jpg", entrance_annotated_frame)
# #                 entrance_frame_data = base64.b64encode(entrance_buffer).decode("utf-8")

# #                 socketio.emit("video_frame", {
# #                     "entrance_frame": entrance_frame_data,
# #                     "entrance_detections": entrance_detections,

# #                 })

# #         except Exception as e:
# #             print(f"Error: {e}")
# #             socketio.emit("video_error", {"error": str(e)})
# #         finally:
# #             entrance_cap.release()
# #             print("Video streams stopped.")

# def start_video(socketio):
#     model = YOLO("/Users/manuel/Documents/C2_Project/flask_api/sample/best.pt")
#     frame_queue = Queue(maxsize=10)  # Buffer for frames
#     result_queue = Queue(maxsize=10)  # Buffer for processed results
    
#     def process_frame(frame, size=(640, 480)):
#         # Resize frame for faster processing
#         frame = cv2.resize(frame, size)
        
#         # Run detection with optimized parameters
#         results = model(frame, conf=0.5, iou=0.5)  # Adjust confidence and IOU thresholds
#         detections = []
        
#         for box in results[0].boxes:
#             coords = box.xyxy.cpu().numpy().tolist()[0]
#             label = model.names[int(box.cls)]
#             confidence = float(box.conf)
            
#             x1, y1, x2, y2 = map(int, coords)
#             # Only perform OCR on high-confidence detections
#             ocr_text = ""
#             if confidence > 0.7:
#                 ocr_text = extract_text_from_roi(frame, [[x1, y1, x2, y2]])
            
#             detections.append({
#                 "label": label,
#                 "confidence": confidence,
#                 "coordinates": coords,
#                 "ocr_text": ocr_text if len(ocr_text) >= 6 else ""
#             })
            
#         return results[0].plot(), detections

#     def frame_producer(cap, queue):
#         while True:
#             ret, frame = cap.read()
#             if not ret:
#                 break
            
#             # If queue is full, skip frames
#             if queue.full():
#                 continue
                
#             queue.put(frame)
#             time.sleep(0.01)  # Small delay to prevent CPU overload

#     def frame_processor(frame_queue, result_queue):
#         while True:
#             if frame_queue.empty():
#                 time.sleep(0.01)
#                 continue
                
#             frame = frame_queue.get()
#             annotated_frame, detections = process_frame(frame)
            
#             # Compress frame with lower quality for faster transmission
#             encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 60]
#             _, buffer = cv2.imencode('.jpg', annotated_frame, encode_param)
#             frame_data = base64.b64encode(buffer).decode('utf-8')
            
#             result_queue.put({
#                 "frame_data": frame_data,
#                 "detections": detections
#             })

#     @socketio.on("start_video")
#     def handle_start_video(data=None):
#         entrance_video_path = "/Users/manuel/Documents/C2_Project/flask_api/sample/sample1.MOV"
#         entrance_cap = cv2.VideoCapture(entrance_video_path)
        
#         if not entrance_cap.isOpened():
#             emit("video_error", {"error": "Video files not available"})
#             return
        
#         # Set OpenCV buffer size
#         entrance_cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        
#         # Start producer and processor threads
#         producer_thread = Thread(target=frame_producer, args=(entrance_cap, frame_queue))
#         processor_thread = Thread(target=frame_processor, args=(frame_queue, result_queue))
#         producer_thread.daemon = True
#         processor_thread.daemon = True
#         producer_thread.start()
#         processor_thread.start()
        
#         start_time = time.time()
#         frame_count = 0
        
#         try:
#             while True:
#                 if result_queue.empty():
#                     time.sleep(0.01)
#                     continue
                
#                 result = result_queue.get()
#                 frame_count += 1
                
#                 # Calculate FPS
#                 elapsed_time = time.time() - start_time
#                 if elapsed_time > 0:
#                     fps = frame_count / elapsed_time
#                 else:
#                     fps = 0
                
#                 # Emit frame and detections
#                 socketio.emit("video_frame", {
#                     "entrance_frame": result["frame_data"],
#                     "entrance_detections": result["detections"],
#                     "fps": fps
#                 })
                
#                 # Log FPS every 30 frames
#                 if frame_count % 30 == 0:
#                     print(f"Processing FPS: {fps:.2f}")
#                     # Reset FPS counter periodically
#                     if frame_count > 100:
#                         start_time = time.time()
#                         frame_count = 0
                
#         except Exception as e:
#             print(f"Error: {e}")
#             socketio.emit("video_error", {"error": str(e)})
#         finally:
#             entrance_cap.release()
#             print("Video streams stopped.")