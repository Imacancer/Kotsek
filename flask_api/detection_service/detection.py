import uuid
import cv2
import base64
import time
import numpy as np
from paddleocr import PaddleOCR
from flask_socketio import SocketIO, emit
import supabase
from ultralytics import YOLO
from datetime import datetime
from threading import Thread
from queue import Queue
from collections import defaultdict
import re
import os
import base64
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from db.db import db
from supabase import create_client, Client

# Import models
from models.vehicle_entry import VehicleEntry
from models.vehicle_exit import VehicleExit
from models.customer import ParkingCustomer
from models.guards import Guard

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# For direct supabase storage uploads (keeping this for file storage)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

class VideoProcessor:
    def __init__(self, socketio, video_path, model_path="yolov8n.pt", plate_model_path="./plates/best.pt"):
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
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=True)
        
        # Tracking variables
        self.line_x = 250  # Line position for counting
        self.crossed_ids = set()  # Track IDs that have crossed the line
        self.class_counts = defaultdict(int)  # Count of objects by class
        self.detection_history = {}  # Store detection history for each track ID
        self.plate_read_ids = set()
        self.plates_detected_ids = set()
        self.plate_buffer = {}  

        self.plate_buffer = {}
        self.crossed_ids = set()
        self.detection_history = {}
        self.logged_lost_ids = set()
        
        # Create SQLAlchemy engine for when we need a session outside Flask context
        self.engine = create_engine(DATABASE_URL)
        self.active_guard_id = None

    def set_active_guard(self, guard_id):
        """Set the active guard for this detection session"""
        if guard_id is None:
            self.active_guard_id = None
            print("✅ Guard deactivated. New detections will be unassigned.")
            return True
            
        try:
            # Verify the guard exists
            with Session(self.engine) as session:
                guard = session.query(Guard).filter_by(guard_id=guard_id).first()
                if not guard:
                    print(f"❌ Guard with ID {guard_id} not found.")
                    return False
                    
                self.active_guard_id = guard_id
                print(f"✅ Active guard set to: {guard.name} (ID: {guard_id})")
                return True
        except Exception as e:
            print(f"❌ Error setting active guard: {e}")
            return False

    def log_detection(self, label, confidence, ocr_text, track_id=None):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        if ocr_text:
            print(f"[{timestamp}] ID:{track_id} | DETECTED: {label} | Conf: {confidence:.2f} | Plate: {ocr_text}")
        else:
            print(f"[{timestamp}] ID:{track_id} | DETECTED: {label} | Conf: {confidence:.2f}")

    def extract_text_from_roi(self, image, box):
        try:
            if not box or len(box[0]) != 4:
                return ""
            x1, y1, x2, y2 = map(int, box[0])
            
            roi = image[y1:y2, x1:x2]
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
            
            ocr_result = self.ocr.ocr(thresh, cls=True)
            
            if ocr_result and len(ocr_result) > 0:
                text = " ".join([line[1][0] for line in ocr_result[0] if line and len(line) > 1])
                return text.strip()
            return ""
            
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""
    
    @staticmethod
    def is_valid_plate_format(plate_text):
        return re.fullmatch(r"[A-Z]{3} \d{4}", plate_text.strip()) is not None
    
    def upload_vehicle_entry(self, plate_text, plate_confidence, entry_time, screenshot_frame, timestamp_str, vehicle_type, hex_color):
        try:
            # Save screenshot to temp PNG file
            _, buffer = cv2.imencode(".png", screenshot_frame)
            image_bytes = buffer.tobytes()
            filename = f"{uuid.uuid4()}.png"

            # Upload to Supabase Storage
            response = supabase.storage.from_("entry").upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": "image/png"}
            )

            if hasattr(response, "error") and response.error:
                print(f"❌ Supabase upload error: {response.error.message}")
                return

            public_url = f"{SUPABASE_URL}/storage/v1/object/public/entry/{filename}"
            print(f"✅ Screenshot uploaded: {public_url}")

            # Create a SQLAlchemy session and add vehicle entry record
            with Session(self.engine) as session:
                # First, check if this plate exists in the customer table
                customer = session.query(ParkingCustomer).filter_by(plate_number=plate_text).first()
                
                if not customer:
                    # Create a temporary customer record with minimal information
                    new_customer = ParkingCustomer(
                        first_name="Guest",
                        last_name="Guest",
                        plate_number=plate_text,
                        is_registered=False,  # Mark as unregistered
                        color=hex_color,
                        vehicle_type=vehicle_type
                    )
                    session.add(new_customer)
                    session.commit()
                    try:
                        session.flush()  # Ensure the customer is in the DB before referencing it
                        customer_id = new_customer.customer_id
                    except Exception as e:
                        print(f"❌ Failed to create temporary customer: {e}")
                        session.rollback()
                        return
                else:
                    customer_id = customer.customer_id
                    
                # Create new vehicle entry
                entry = VehicleEntry(
                    entry_id=str(uuid.uuid4()),
                    plate_number=plate_text,
                    entry_time=datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S"),
                    image_url=public_url,
                    customer_id=customer_id,
                    vehicle_type=vehicle_type,  # Default or based on detection
                    hex_color=hex_color,  # Default or detected color
                    guard_id=self.active_guard_id,
                    status='unassigned'
                )
                
                try:
                    session.add(entry)
                    session.commit()
                    print("✅ Entry inserted into database")

                    entry_status = "assigned" if self.active_guard_id else "unassigned"
                    self.socketio.emit("new_vehicle_entry", {
                        "entry_id": str(entry.entry_id),
                        "plate_number": plate_text,
                        "entry_time": entry_time,
                        "image_url": public_url,
                        "guard_id": str(self.active_guard_id) if self.active_guard_id else None,
                        "status": entry_status
                    })
                except Exception as e:
                    session.rollback()
                    print(f"❌ Failed to insert entry: {e}")

        except Exception as e:
            print(f"❌ Exception in upload_vehicle_entry: {e}")

    def upload_vehicle_exit(self, plate_text, plate_confidence, exit_time, screenshot_frame, timestamp_str, vehicle_type, hex_color):
        try:
            # Save screenshot to temp PNG file
            _, buffer = cv2.imencode(".png", screenshot_frame)
            image_bytes = buffer.tobytes()
            filename = f"{uuid.uuid4()}.png"

            # Upload to Supabase Storage
            response = supabase.storage.from_("exit").upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": "image/png"}
            )

            if hasattr(response, "error") and response.error:
                print(f"❌ Supabase upload error: {response.error.message}")
                return

            public_url = f"{SUPABASE_URL}/storage/v1/object/public/exit/{filename}"
            print(f"✅ Screenshot uploaded: {public_url}")

            # Create a SQLAlchemy session
            with Session(self.engine) as session:
                # Find the latest matching vehicle entry
                entry = session.query(VehicleEntry)\
                    .filter(VehicleEntry.plate_number == plate_text)\
                    .filter(VehicleEntry.entry_time <= datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S"))\
                    .order_by(VehicleEntry.entry_time.desc())\
                    .first()

                if not entry:
                    print(f"❌ No matching entry found for plate {plate_text} before {exit_time}")
                    return

                # Find the corresponding customer
                customer = session.query(ParkingCustomer)\
                    .filter_by(plate_number=plate_text)\
                    .first()

                customer_id = customer.customer_id if customer else None

                # Create a new VehicleExit record
                exit_record = VehicleExit(
                    exit_id=str(uuid.uuid4()),
                    plate_number=plate_text,
                    exit_time=datetime.strptime(exit_time, "%Y-%m-%d %H:%M:%S"),
                    image_url=public_url,
                    guard_id=self.active_guard_id,  # Assuming self.active_guard_id exists
                    customer_id=customer_id,
                    vehicle_type=vehicle_type,
                    hex_color=hex_color,
                    created_at=datetime.utcnow()
                )

                try:
                    session.add(exit_record)
                    session.commit()
                    print("✅ Exit inserted into database")

                    self.socketio.emit("new_vehicle_exit", {
                        "exit_id": str(exit_record.exit_id),
                        "plate_number": plate_text,
                        "exit_time": exit_time,
                        "image_url": public_url,
                        "guard_id": str(self.active_guard_id) if self.active_guard_id else None,
                        "customer_id": str(customer_id) if customer_id else None,
                        "vehicle_type": vehicle_type,
                        "hex_color": hex_color
                    })

                except Exception as e:
                    session.rollback()
                    print(f"❌ Failed to insert exit record: {e}")

        except Exception as e:
            print(f"❌ Exception in upload_vehicle_exit: {e}")



    def process_frame(self, frame, size=(640, 480)):
        frame = cv2.resize(frame, size)
        original_frame = frame.copy()  # Clean version for screenshot
        best_plate_frame = None

        results = self.model.track(frame, persist=True, conf=0.5, iou=0.5)
        detections = []

        target_classes = {'car', 'motorcycle', 'bike', 'bicycle'}
        plate_line_x = 140  # Detection boundary

        # Draw plate detection boundary
        cv2.line(frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)
        cv2.putText(frame, "Plate Detection Boundary", (plate_line_x + 10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        current_ids = set()

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            confidences = results[0].boxes.conf.cpu().numpy()
            class_indices = results[0].boxes.cls.int().cpu().tolist()

            filtered_boxes = []
            filtered_track_ids = []
            filtered_confidences = []
            filtered_class_indices = []

            for box, track_id, confidence, class_idx in zip(boxes, track_ids, confidences, class_indices):
                label = self.model.names[int(class_idx)].lower()
                if label in target_classes:
                    filtered_boxes.append(box)
                    filtered_track_ids.append(track_id)
                    filtered_confidences.append(confidence)
                    filtered_class_indices.append(class_idx)
                    current_ids.add(track_id)

            for box, track_id, confidence, class_idx in zip(filtered_boxes, filtered_track_ids, filtered_confidences, filtered_class_indices):
                label = self.model.names[int(class_idx)]
                x1, y1, x2, y2 = map(int, box)
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                # Draw object center and ID
                cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
                cv2.putText(frame, f"ID:{track_id}", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

                # Plate detection
                if x1 < plate_line_x:
                    roi = frame[y1:y2, x1:x2]
                    plate_results = self.plate_model(roi, conf=0.5)

                    if hasattr(plate_results[0], 'boxes') and plate_results[0].boxes is not None:
                        for plate_box in plate_results[0].boxes:
                            plate_conf = float(plate_box.conf)
                            if plate_conf < 0.5:
                                continue

                            plate_coords = plate_box.xyxy.cpu().numpy().tolist()[0]
                            px1, py1, px2, py2 = map(int, plate_coords)
                            plate_roi = roi[py1:py2, px1:px2]
                            plate_text = self.extract_text_from_roi(plate_roi, [[0, 0, px2-px1, py2-py1]])

                            if plate_text.strip() == "":
                                continue

                            new_plate = {
                                "label": "Plate",
                                "confidence": plate_conf,
                                "coordinates": [px1+x1, py1+y1, px2+x1, py2+y1],
                                "ocr_text": plate_text.strip()
                            }

                            old_plate = self.plate_buffer.get(track_id)
                            if (old_plate is None or plate_conf > old_plate["confidence"]) and self.is_valid_plate_format(plate_text):
                                self.plate_buffer[track_id] = new_plate
                                best_plate_frame = frame.copy()
                            self.log_detection("Plate", plate_conf, plate_text, track_id)

                # Color detection
                roi = frame[y1:y2, x1:x2]
                hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
                mean_hsv = cv2.mean(hsv_roi)[:3]
                mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
                mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
                hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))

                # Check if crossed
                if x1 < plate_line_x and track_id not in self.crossed_ids:
                    self.crossed_ids.add(track_id)
                    self.class_counts[label] += 1

                    best_plate = self.plate_buffer.get(track_id)
                    timestamp = datetime.now()
                    timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")

                    if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]):
                        print(f"Vehicle {track_id} ({label}) crossed boundary at {timestamp_str}")
                        print(f"  ↳ Best Plate: {best_plate['ocr_text']} (Conf: {best_plate['confidence']:.2f})")
                    else:
                        print(f"Vehicle {track_id} ({label}) crossed boundary at {timestamp_str}")
                        print(f"  ↳ No valid plate found for ID {track_id}")

                    self.detection_history[track_id] = {
                        "label": label,
                        "confidence": float(confidence),
                        "plate_text": best_plate["ocr_text"] if best_plate else "",
                        "plate_confidence": best_plate["confidence"] if best_plate else 0,
                        "timestamp": timestamp,
                        "color": hex_color,
                        "screenshot": best_plate_frame.copy() if best_plate_frame is not None else original_frame.copy()  # Save clean screenshot here
                    }

                detections.append({
                    "label": label,
                    "color_annotation": hex_color,
                    "confidence": float(confidence),
                    "coordinates": [x1, y1, x2, y2],
                    "plates": [self.plate_buffer[track_id]] if track_id in self.plate_buffer else None,
                    "best_plate": self.plate_buffer[track_id] if track_id in self.plate_buffer else None
                })

        # Process lost vehicle info
        lost_ids = self.crossed_ids - current_ids
        for lost_id in lost_ids:
            if lost_id not in self.logged_lost_ids:
                info = self.detection_history.get(lost_id)
                if info:
                    time_since_crossed = (datetime.now() - info["timestamp"]).total_seconds()
                    if time_since_crossed >= 2:
                        print(f"Vehicle ID {lost_id} left view.")
                        print(f"  ↳ Plate: {info['plate_text']} (Conf: {info['plate_confidence']:.2f})")
                        print(f"  ↳ Type: {info['label']}")
                        print(f"  ↳ Color: {info['color']}")
                        print(f"  ↳ Timestamp: {info['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")

                        best_plate = self.plate_buffer.get(lost_id)
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]):
                            timestamp_str = info['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
                            try:
                                self.upload_vehicle_exit(
                                    plate_text=best_plate["ocr_text"],
                                    plate_confidence=best_plate["confidence"],
                                    entry_time=info['timestamp'].strftime("%Y-%m-%d %H:%M:%S"),
                                    timestamp_str=timestamp_str,
                                    screenshot_frame=info['screenshot'],
                                    vehicle_type=info['label'],
                                    hex_color=info['color'],
                                )
                                # ✅ Clean up after successful upload
                                self.detection_history.pop(lost_id, None)
                                self.plate_buffer.pop(lost_id, None)
                                self.crossed_ids.discard(lost_id)
                                self.logged_lost_ids.add(lost_id)

                            except Exception as e:
                                print(f"❌ Exception in upload_vehicle_entry: {e}")

                self.logged_lost_ids.add(lost_id)

        # Annotate frame
        annotated_frame = frame.copy()
        for box, track_id, confidence, class_idx in zip(filtered_boxes, filtered_track_ids, filtered_confidences, filtered_class_indices):
            x1, y1, x2, y2 = map(int, box)
            label = self.model.names[int(class_idx)]
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"{label} {confidence:.2f}", (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
            cv2.circle(annotated_frame, (cx, cy), 4, (0, 255, 0), -1)
            cv2.putText(annotated_frame, f"ID:{track_id}", (x1, y1-30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

        # Redraw line
        cv2.line(annotated_frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)
        cv2.putText(annotated_frame, "Plate Detection Boundary", (plate_line_x + 10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        return annotated_frame, detections

    def frame_producer(self, cap):
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_delay = 1.0 / fps if fps > 0 else 0.033
        while self.running:
            ret, frame = cap.read()
            if not ret:
                break
            while self.frame_queue.full() and self.running:
                time.sleep(0.01)
            if not self.frame_queue.full():
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
                "detections": detections,
                "counts": dict(self.class_counts)
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
                "counts": result["counts"],
                "fps": fps
            })
            
            if frame_count % 30 == 0:
                print(f"Processing FPS: {fps:.2f}")
                if frame_count > 100:
                    start_time = time.time()
                    frame_count = 0

    def start(self):
        if self.running:
            return
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
        if self.video_capture:
            self.video_capture.release()
        print("Video processing stopped.")
        print("Final counts:", dict(self.class_counts))



class EntryVideoProcessor:
    def __init__(self, socketio, video_path, model_path="yolov8n.pt", plate_model_path="./plates/best.pt"):
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
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=True)
        
        # Tracking variables
        self.line_x = 250  # Line position for counting
        self.crossed_ids = set()  # Track IDs that have crossed the line
        self.class_counts = defaultdict(int)  # Count of objects by class
        self.detection_history = {}  # Store detection history for each track ID
        self.plate_read_ids = set()
        self.plates_detected_ids = set()
        self.plate_buffer = {}  

        self.plate_buffer = {}
        self.crossed_ids = set()
        self.detection_history = {}
        self.logged_lost_ids = set()
        
        # Create SQLAlchemy engine for when we need a session outside Flask context
        self.engine = create_engine(DATABASE_URL)
        self.active_guard_id = None


    def start(self):
            if self.running:
                return

            self.running = True

            # Force TCP for RTSP if applicable
            if self.video_path.startswith("rtsp://"):
                video_url = self.video_path + "?rtsp_transport=tcp"
            else:
                video_url = self.video_path

            self.video_capture = cv2.VideoCapture(video_url)

            # Wait briefly for the camera to initialize
            retries = 10
            for attempt in range(retries):
                if self.video_capture.isOpened():
                    break
                print(f"⏳ Attempt {attempt + 1}/{retries} to connect to stream...")
                time.sleep(1)

            if not self.video_capture.isOpened():
                print("❌ Unable to open video stream")
                self.socketio.emit("video_error", {"error": "Failed to open stream"})
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
            print("📡 Video stream started.")

    def set_active_guard(self, guard_id):
        """Set the active guard for this detection session"""
        if guard_id is None:
            self.active_guard_id = None
            print("✅ Guard deactivated. New detections will be unassigned.")
            return True
            
        try:
            # Verify the guard exists
            with Session(self.engine) as session:
                guard = session.query(Guard).filter_by(guard_id=guard_id).first()
                if not guard:
                    print(f"❌ Guard with ID {guard_id} not found.")
                    return False
                    
                self.active_guard_id = guard_id
                print(f"✅ Active guard set to: {guard.name} (ID: {guard_id})")
                return True
        except Exception as e:
            print(f"❌ Error setting active guard: {e}")
            return False

    def log_detection(self, label, confidence, ocr_text, track_id=None):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        if ocr_text:
            print(f"[{timestamp}] ID:{track_id} | DETECTED: {label} | Conf: {confidence:.2f} | Plate: {ocr_text}")
        else:
            print(f"[{timestamp}] ID:{track_id} | DETECTED: {label} | Conf: {confidence:.2f}")

    def extract_text_from_roi(self, image, box):
        try:
            if not box or len(box[0]) != 4:
                return ""
            x1, y1, x2, y2 = map(int, box[0])
            
            roi = image[y1:y2, x1:x2]
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
            
            ocr_result = self.ocr.ocr(thresh, cls=True)
            
            if ocr_result and len(ocr_result) > 0:
                text = " ".join([line[1][0] for line in ocr_result[0] if line and len(line) > 1])
                return text.strip()
            return ""
            
        except Exception as e:
            print(f"OCR Error: {e}")
            return ""
    
    @staticmethod
    def is_valid_plate_format(plate_text):
        return re.fullmatch(r"[A-Z]{3} \d{4}", plate_text.strip()) is not None
    
    def upload_vehicle_entry(self, plate_text, plate_confidence, entry_time, screenshot_frame, timestamp_str, vehicle_type, hex_color):
        try:
            # Save screenshot to temp PNG file
            _, buffer = cv2.imencode(".png", screenshot_frame)
            image_bytes = buffer.tobytes()
            filename = f"{uuid.uuid4()}.png"

            # Upload to Supabase Storage
            response = supabase.storage.from_("entry").upload(
                path=filename,
                file=image_bytes,
                file_options={"content-type": "image/png"}
            )

            if hasattr(response, "error") and response.error:
                print(f"❌ Supabase upload error: {response.error.message}")
                return

            public_url = f"{SUPABASE_URL}/storage/v1/object/public/entry/{filename}"
            print(f"✅ Screenshot uploaded: {public_url}")

            # Create a SQLAlchemy session and add vehicle entry record
            with Session(self.engine) as session:
                # First, check if this plate exists in the customer table
                customer = session.query(ParkingCustomer).filter_by(plate_number=plate_text).first()
                
                if not customer:
                    # Create a temporary customer record with minimal information
                    new_customer = ParkingCustomer(
                        first_name="Guest",
                        last_name="Guest",
                        plate_number=plate_text,
                        is_registered=False,  # Mark as unregistered
                        color=hex_color,
                        vehicle_type=vehicle_type
                    )
                    session.add(new_customer)
                    session.commit()
                    try:
                        session.flush()  # Ensure the customer is in the DB before referencing it
                        customer_id = new_customer.customer_id
                    except Exception as e:
                        print(f"❌ Failed to create temporary customer: {e}")
                        session.rollback()
                        return
                else:
                    customer_id = customer.customer_id
                    
                # Create new vehicle entry
                entry = VehicleEntry(
                    entry_id=str(uuid.uuid4()),
                    plate_number=plate_text,
                    entry_time=datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S"),
                    image_url=public_url,
                    customer_id=customer_id,
                    vehicle_type=vehicle_type,  # Default or based on detection
                    hex_color=hex_color,  # Default or detected color
                    guard_id=self.active_guard_id,
                    status='unassigned'
                )
                
                try:
                    session.add(entry)
                    session.commit()
                    print("✅ Entry inserted into database")

                    entry_status = "assigned" if self.active_guard_id else "unassigned"
                    self.socketio.emit("new_vehicle_entry", {
                        "entry_id": str(entry.entry_id),
                        "plate_number": plate_text,
                        "entry_time": entry_time,
                        "image_url": public_url,
                        "guard_id": str(self.active_guard_id) if self.active_guard_id else None,
                        "status": entry_status
                    })
                except Exception as e:
                    session.rollback()
                    print(f"❌ Failed to insert entry: {e}")

        except Exception as e:
            print(f"❌ Exception in upload_vehicle_entry: {e}")

    def process_frame(self, frame, size=(640, 480)):
        frame = cv2.resize(frame, size)
        original_frame = frame.copy()  # Clean version for screenshot
        best_plate_frame = None

        results = self.model.track(frame, persist=True, conf=0.5, iou=0.5)
        detections = []

        target_classes = {'car', 'motorcycle', 'bike', 'bicycle'}
        plate_line_x = 250  # Detection boundary

        # Draw plate detection boundary
        cv2.line(frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)
        cv2.putText(frame, "Plate Detection Boundary", (plate_line_x + 10, 60), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        current_ids = set()

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            confidences = results[0].boxes.conf.cpu().numpy()
            class_indices = results[0].boxes.cls.int().cpu().tolist()

            filtered_boxes = []
            filtered_track_ids = []
            filtered_confidences = []
            filtered_class_indices = []

            for box, track_id, confidence, class_idx in zip(boxes, track_ids, confidences, class_indices):
                label = self.model.names[int(class_idx)].lower()
                if label in target_classes:
                    filtered_boxes.append(box)
                    filtered_track_ids.append(track_id)
                    filtered_confidences.append(confidence)
                    filtered_class_indices.append(class_idx)
                    current_ids.add(track_id)

            for box, track_id, confidence, class_idx in zip(filtered_boxes, filtered_track_ids, filtered_confidences, filtered_class_indices):
                label = self.model.names[int(class_idx)]
                x1, y1, x2, y2 = map(int, box)
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                # Draw object center and ID
                cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
                cv2.putText(frame, f"ID:{track_id}", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

                # Plate detection
                if x2 > plate_line_x:
                    roi = frame[y1:y2, x1:x2]
                    plate_results = self.plate_model(roi, conf=0.5)

                    if hasattr(plate_results[0], 'boxes') and plate_results[0].boxes is not None:
                        for plate_box in plate_results[0].boxes:
                            plate_conf = float(plate_box.conf)
                            if plate_conf < 0.5:
                                continue

                            plate_coords = plate_box.xyxy.cpu().numpy().tolist()[0]
                            px1, py1, px2, py2 = map(int, plate_coords)
                            plate_roi = roi[py1:py2, px1:px2]
                            plate_text = self.extract_text_from_roi(plate_roi, [[0, 0, px2-px1, py2-py1]])

                            if plate_text.strip() == "":
                                continue

                            new_plate = {
                                "label": "Plate",
                                "confidence": plate_conf,
                                "coordinates": [px1+x1, py1+y1, px2+x1, py2+y1],
                                "ocr_text": plate_text.strip()
                            }

                            old_plate = self.plate_buffer.get(track_id)
                            if (old_plate is None or plate_conf > old_plate["confidence"]) and self.is_valid_plate_format(plate_text):
                                self.plate_buffer[track_id] = new_plate
                                best_plate_frame = frame.copy() 

                            self.log_detection("Plate", plate_conf, plate_text, track_id)

                # Color detection
                roi = frame[y1:y2, x1:x2]
                hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
                mean_hsv = cv2.mean(hsv_roi)[:3]
                mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
                mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
                hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))

                # Check if crossed
                if x2 > plate_line_x and track_id not in self.crossed_ids:
                    self.crossed_ids.add(track_id)
                    self.class_counts[label] += 1

                    best_plate = self.plate_buffer.get(track_id)
                    timestamp = datetime.now()
                    timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")

                    if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]):
                        print(f"Vehicle {track_id} ({label}) crossed boundary at {timestamp_str}")
                        print(f"  ↳ Best Plate: {best_plate['ocr_text']} (Conf: {best_plate['confidence']:.2f})")
                    else:
                        print(f"Vehicle {track_id} ({label}) crossed boundary at {timestamp_str}")
                        print(f"  ↳ No valid plate found for ID {track_id}")

                    self.detection_history[track_id] = {
                        "label": label,
                        "confidence": float(confidence),
                        "plate_text": best_plate["ocr_text"] if best_plate else "",
                        "plate_confidence": best_plate["confidence"] if best_plate else 0,
                        "timestamp": timestamp,
                        "color": hex_color,
                        "screenshot": best_plate_frame.copy() if best_plate_frame is not None else original_frame.copy()  # Save clean screenshot here
                    }

                detections.append({
                    "label": label,
                    "color_annotation": hex_color,
                    "confidence": float(confidence),
                    "coordinates": [x1, y1, x2, y2],
                    "plates": [self.plate_buffer[track_id]] if track_id in self.plate_buffer else None,
                    "best_plate": self.plate_buffer[track_id] if track_id in self.plate_buffer else None
                })

        # Process lost vehicle info
        lost_ids = self.crossed_ids - current_ids
        for lost_id in lost_ids:
            if lost_id not in self.logged_lost_ids:
                info = self.detection_history.get(lost_id)
                if info:
                    time_since_crossed = (datetime.now() - info["timestamp"]).total_seconds()
                    if time_since_crossed >= 2:
                        print(f"Vehicle ID {lost_id} left view.")
                        print(f"  ↳ Plate: {info['plate_text']} (Conf: {info['plate_confidence']:.2f})")
                        print(f"  ↳ Type: {info['label']}")
                        print(f"  ↳ Color: {info['color']}")
                        print(f"  ↳ Timestamp: {info['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}")

                        best_plate = self.plate_buffer.get(lost_id)
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]):
                            timestamp_str = info['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
                            try:
                                self.upload_vehicle_entry(
                                    plate_text=best_plate["ocr_text"],
                                    plate_confidence=best_plate["confidence"],
                                    entry_time=info['timestamp'].strftime("%Y-%m-%d %H:%M:%S"),
                                    timestamp_str=timestamp_str,
                                    screenshot_frame=info['screenshot'],
                                    vehicle_type=info['label'],
                                    hex_color=info['color']
                                )
                                # ✅ Clean up after successful upload
                                self.detection_history.pop(lost_id, None)
                                self.plate_buffer.pop(lost_id, None)
                                self.crossed_ids.discard(lost_id)
                                self.logged_lost_ids.add(lost_id)

                            except Exception as e:
                                print(f"❌ Exception in upload_vehicle_entry: {e}")

                self.logged_lost_ids.add(lost_id)

        # Annotate frame
        annotated_frame = frame.copy()
        for box, track_id, confidence, class_idx in zip(filtered_boxes, filtered_track_ids, filtered_confidences, filtered_class_indices):
            x1, y1, x2, y2 = map(int, box)
            label = self.model.names[int(class_idx)]
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_frame, f"{label} {confidence:.2f}", (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)
            cv2.circle(annotated_frame, (cx, cy), 4, (0, 255, 0), -1)
            cv2.putText(annotated_frame, f"ID:{track_id}", (x1, y1-30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

        # Redraw line
        cv2.line(annotated_frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)
        cv2.putText(annotated_frame, "Plate Detection Boundary", (plate_line_x + 10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

        return annotated_frame, detections

    def frame_producer(self, cap):
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_delay = 1.0 / fps if fps > 0 else 0.033
        while self.running:
            ret, frame = cap.read()
            if not ret:
                break
            while self.frame_queue.full() and self.running:
                time.sleep(0.01)
            if not self.frame_queue.full():
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
                "detections": detections,
                "counts": dict(self.class_counts)
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
                "counts": result["counts"],
                "fps": fps
            })
            
            if frame_count % 30 == 0:
                print(f"Processing FPS: {fps:.2f}")
                if frame_count > 100:
                    start_time = time.time()
                    frame_count = 0

    def start(self):
        if self.running:
            return
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
        if self.video_capture:
            self.video_capture.release()
        print("Video processing stopped.")
        print("Final counts:", dict(self.class_counts))