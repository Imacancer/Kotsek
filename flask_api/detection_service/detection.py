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
import subprocess
# Import models
from models.vehicle_entry import VehicleEntry
from models.vehicle_exit import VehicleExit
from models.customer import ParkingCustomer
from models.guards import Guard
from models.parking_session import ParkingSession

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
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
        self.model_path = model_path
        self._frame_index = 0
        self.is_exit_camera=False

        
        # Tracking variables
        self.line_x = 250  # Line position for counting
        self.crossed_ids = set()  # Track IDs that have crossed the line
        self.class_counts = defaultdict(int)  # Count of objects by class
        self.detection_history = {}  # Store detection history for each track ID
        self.plate_read_ids = set()
        self.plates_detected_ids = set()
        self.plate_buffer = {}
        self.previous_centers = {}  # Store previous centers for each track ID
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
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 255), 2)
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
        # Remove all non-alphanumeric characters (e.g., -, ., spaces)
        cleaned = re.sub(r'[^A-Za-z0-9]', '', plate_text).upper()

        # Check if it matches the pattern ABC1234
        if re.fullmatch(r'[A-Z]{3}\d{4}', cleaned):
            # Format it as ABC 1234
            formatted = f"{cleaned[:3]} {cleaned[3:]}"
            return formatted
        elif re.fullmatch(r'\d{3}[A-Z]{3}', cleaned):  # Motorcycle plate
            formatted = f"{cleaned[:3]} {cleaned[3:]}"
            return formatted

        return None
    
    def assign_bicycle(self, entry_id, customer_id, plate_number, entry_time):
        from models.parking_slot import ParkingSlot
        from models.parking_session import ParkingSession

        with Session(self.engine) as session:
            # Search for available slot in 'bike area left'
            slot = session.query(ParkingSlot)\
                .filter_by(section="bike area left", vehicle_type="bicycle", status="available", is_active=True)\
                .order_by(ParkingSlot.slot_number.asc())\
                .first()

            # If none, try 'bike area right'
            if not slot:
                slot = session.query(ParkingSlot)\
                    .filter_by(section="bike area right", vehicle_type="bicycle", status="available", is_active=True)\
                    .order_by(ParkingSlot.slot_number.asc())\
                    .first()

            if not slot:
                print("❌ No available bicycle slots in either section.")
                return

            try:
                # Assign slot
                slot.status = "occupied"
                slot.current_vehicle_id = entry_id

                # Create parking session
                session_entry = ParkingSession(
                    entry_id=entry_id,
                    slot_id=slot.slot_id,
                    lot_id=slot.lot_id,
                    customer_id=customer_id,
                    plate_number=plate_number,
                    start_time=entry_time,
                    status="active"
                )

                session.add(session_entry)
                session.commit()
                print(f"✅ Bicycle assigned to slot {slot.slot_number} in {slot.section}.")
            except Exception as e:
                session.rollback()
                print(f"❌ Failed to assign bicycle: {e}")
    def assign_motorcycle(self, entry_id, customer_id, plate_number, entry_time):
        from models.parking_slot import ParkingSlot
        from models.parking_session import ParkingSession

        with Session(self.engine) as session:
            # Find available motorcycle slot in elevated parking
            slot = session.query(ParkingSlot)\
                .filter_by(section="elevated parking", vehicle_type="motorcycle", status="available", is_active=True)\
                .order_by(ParkingSlot.slot_number.asc())\
                .first()

            if not slot:
                print("❌ No available motorcycle slots in elevated parking.")
                return

            try:
                # Assign slot
                slot.status = "occupied"
                slot.current_vehicle_id = entry_id

                # Create parking session
                session_entry = ParkingSession(
                    entry_id=entry_id,
                    slot_id=slot.slot_id,
                    lot_id=slot.lot_id,
                    customer_id=customer_id,
                    plate_number=plate_number,
                    start_time=entry_time,
                    status="active"
                )

                session.add(session_entry)
                session.commit()
                print(f"✅ Motorcycle assigned to slot {slot.slot_number} in elevated parking.")
            except Exception as e:
                session.rollback()
                print(f"❌ Failed to assign motorcycle: {e}")

    def upload_vehicle_entry(self, plate_text, plate_confidence, entry_time, screenshot_frame, timestamp_str, vehicle_type, hex_color):
        print(f"🔍 Attempting upload for plate: {plate_text}")
        try:
            # Save screenshot to temp PNG file

            if not isinstance(screenshot_frame, np.ndarray):
                print(f"❌ screenshot_frame is invalid (type: {type(screenshot_frame)}), skipping entry upload.")
                return
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
            try:    
                with Session(self.engine) as session:
                    print("✅ Database connection successful")
                    
                    # First, check if this plate exists in the customer table
                    customer = session.query(ParkingCustomer).filter_by(plate_number=plate_text).first()
                    
                    if not customer:
                        # Create a temporary customer record with minimal information
                        new_customer = ParkingCustomer(
                            first_name="Haerin",
                            last_name="Kang",
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
                print(f"❌ Database connection failed: {str(e)}")
        
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
                status =  "assigned" if vehicle_type.lower() in ["bicycle", "motorcycle"] else "unassigned"
                entry = VehicleEntry(
                    entry_id=str(uuid.uuid4()),
                    plate_number=plate_text,
                    entry_time=datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S"),
                    image_url=public_url,
                    customer_id=customer_id,
                    vehicle_type=vehicle_type,  # Default or based on detection
                    hex_color=hex_color,  # Default or detected color
                    guard_id=self.active_guard_id,
                    status=status
                )
                
                try:
                    session.add(entry)
                    session.commit()
                    print("✅ Entry inserted into database")
                    if vehicle_type.lower() == "bicycle":
                        self.assign_bicycle(entry.entry_id, customer_id, plate_text, entry.entry_time)
                    elif vehicle_type.lower() == "motorcycle":
                        self.assign_motorcycle(entry.entry_id, customer_id, plate_text, entry.entry_time)
                    
                    entry_status = "assigned" if vehicle_type.lower() in ["bicycle", "motorcycle"] else "unassigned"
                    self.socketio.emit("new_vehicle_entry", {
                        "entry_id": str(entry.entry_id),
                        "plate_number": plate_text,
                        "entry_time": entry_time,
                        "image_url": public_url,
                        "guard_id": str(self.active_guard_id) if self.active_guard_id else None,
                        "status": entry_status
                    })
                    try:
                        import requests
                        requests.get("http://localhost:5000/api/unassigned-vehicles")
                        print("📣 Triggered /api/unassigned-vehicles")
                    except Exception as e:
                        print(f"❌ Failed to notify unassigned vehicles: {e}")

                except Exception as e:
                    session.rollback()
                    print(f"❌ Failed to insert entry: {e}")

        except Exception as e:
            print(f"❌ Exception in upload_vehicle_entry: {e}")
    
    def auto_release_slot(self, plate_number, exit_time_str):
        from models.parking_session import ParkingSession
        from models.parking_slot import ParkingSlot
        from models.vehicle_exit import VehicleExit

        try:
            with Session(self.engine) as session:
                # Get the latest active session for this plate
                session_record = session.query(ParkingSession)\
                    .filter_by(plate_number=plate_number, status='active', exit_id=None)\
                    .order_by(ParkingSession.start_time.desc())\
                    .first()

                if not session_record:
                    print(f"⚠️ No active session found for auto-exit of {plate_number}")
                    return

                # Mark slot as available
                slot = session_record.slot
                if slot:
                    slot.status = 'available'
                    slot.current_vehicle_id = None

                # Calculate session end and duration
                exit_time = datetime.strptime(exit_time_str, "%Y-%m-%d %H:%M:%S")
                session_record.end_time = exit_time
                session_record.status = 'completed'
                if session_record.start_time:
                    duration = exit_time - session_record.start_time
                    session_record.duration_minutes = int(duration.total_seconds() // 60)

                session.commit()
                print(f"✅ Auto-unassigned slot {slot.slot_number} for {plate_number} (Duration: {session_record.duration_minutes} mins)")

        except Exception as e:
            print(f"❌ Failed to auto-release slot: {e}")

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
                    # ✅ Update parking session and slot status
                    try:
                        # Find active parking session matching the entry
                        session_record = session.query(ParkingSession)\
                            .filter_by(entry_id=entry.entry_id, status='active', exit_id=None)\
                            .order_by(ParkingSession.start_time.desc())\
                            .first()

                        if session_record:
                            session_record.exit_id = exit_record.exit_id
                            session_record.end_time = exit_record.exit_time
                            session_record.status = 'completed'
                            

                            # ✅ Calculate duration in minutes
                            if session_record.end_time and session_record.start_time:
                                duration = session_record.end_time - session_record.start_time
                                session_record.duration_minutes = int(duration.total_seconds() // 60)

                            # ✅ Mark the assigned slot as available & unlink current_vehicle_id
                            slot = session_record.slot
                            if slot:
                                slot.status = 'available'
                                slot.current_vehicle_id = None
                            session.commit()
                            print(f"✅ Parking session completed for plate {plate_text}")
                        else:
                            print(f"⚠️ No active session found for plate {plate_text}")

                    except Exception as e:
                        session.rollback()
                        print(f"❌ Failed to update parking session: {e}")

                    # ✅ Trigger parking status update
                    try:
                        import requests
                        requests.get("http://localhost:5000/parking/get-parking-status")
                        print("📣 Triggered /parking/get-parking-status")
                    except Exception as e:
                        print(f"❌ Failed to notify parking status: {e}")


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



    def process_frame(self, frame, size=None):
        self.is_exit_camera = True
        filtered_boxes = []
        filtered_track_ids = []
        filtered_confidences = []
        filtered_class_indices = []
        print(self.active_guard_id)
        
        if size:
            frame = cv2.resize(frame, size)
        original_frame = frame.copy()  # Clean version for screenshot
        best_plate_frame = None

        results = self.model.track(frame, persist=True, conf=0.5, iou=0.5)
        detections = []

        target_classes = {'car', 'motorcycle', 'bike', 'bicycle'}
        plate_line_x = 320  # Detection boundary

        # Draw plate detection boundary
        cv2.line(frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)

        moto_line_x = 640 if isinstance(self, EntryVideoProcessor) else 220
        cv2.line(frame, (moto_line_x, 0), (moto_line_x, frame.shape[0]), (0, 0, 255), 2)
        cv2.putText(frame, "Motorcycle Line", (moto_line_x + 10, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
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

                direction = self.detection_history.get(track_id, {}).get("direction", None)
                if track_id in self.previous_centers:
                    prev_cx = self.previous_centers[track_id]
                    if cx < prev_cx:
                        direction = "left"
                    elif cx > prev_cx:
                        direction = "right"
                if direction in ["left", "right"]:
                    if track_id in self.detection_history:
                        self.detection_history[track_id]["direction"] = direction

                self.previous_centers[track_id] = cx
                # Draw object center and ID
                cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
                cv2.putText(frame, f"ID:{track_id}", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

                # Plate detection
                if label == "motorcycle" or x1 < plate_line_x:
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
                            raw_text = self.extract_text_from_roi(plate_roi, [[0, 0, px2-px1, py2-py1]])

                            if raw_text.strip() == "":
                                continue
                            # ✅ Normalize plate format: ABC1234 → ABC 1234
                            cleaned = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()
                            if re.fullmatch(r'[A-Z]{3}\d{4}', cleaned):
                                plate_text = f"{cleaned[:3]} {cleaned[3:]}"
                            elif re.fullmatch(r'\d{3}[A-Z]{3}', cleaned):  # Motorcycle plate
                                plate_text = f"{cleaned[:3]} {cleaned[3:]}"
                            else:
                                plate_text = raw_text  # fallback if it doesn't match

                            new_plate = {
                                "label": "Plate",
                                "confidence": plate_conf,
                                "coordinates": [px1+x1, py1+y1, px2+x1, py2+y1],
                                "ocr_text": plate_text.strip()
                            }

                            old_plate = self.plate_buffer.get(track_id)
                            if (old_plate is None or plate_conf > old_plate["confidence"]) and self.is_valid_plate_format(plate_text):
                                self.plate_buffer[track_id] = new_plate

                                if isinstance(frame, np.ndarray) and frame.size > 0:
                                    best_plate_frame = frame.copy()
                                    print(f"[DEBUG] Best plate updated for ID {track_id}: {plate_text} (Conf: {plate_conf:.2f}) and screenshot")
                                    print(f"[DEBUG] Saved screenshot shape for ID {track_id}: {best_plate_frame.shape}")
                                else:
                                    print("❌ best_plate_frame = frame.copy() failed: frame is empty or invalid")
                                    best_plate_frame = None
                            self.log_detection("Plate", plate_conf, plate_text, track_id)

                # Color detection
                roi = frame[y1:y2, x1:x2]
                hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
                mean_hsv = cv2.mean(hsv_roi)[:3]
                mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
                mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
                hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))
                #screenshot safe
                if isinstance(best_plate_frame, np.ndarray) and best_plate_frame.size > 0:
                    safe_screenshot = best_plate_frame.copy()
                elif isinstance(original_frame, np.ndarray) and original_frame.size > 0:
                    safe_screenshot = original_frame.copy()
                else:
                    print("❌ No valid frame available, using dummy fallback image")
                    safe_screenshot = np.zeros((10, 10, 3), dtype=np.uint8)  # fallback
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
                        "screenshot": safe_screenshot,
                        "direction":direction if direction else "undetermined"
                    }

                detections.append({
                    "label": label,
                    "color_annotation": hex_color,
                    "confidence": float(confidence),
                    "coordinates": [x1, y1, x2, y2],
                    "plates": [self.plate_buffer[track_id]] if track_id in self.plate_buffer else None,
                    "best_plate": self.plate_buffer[track_id] if track_id in self.plate_buffer else None
                })
                print(f"direction: {direction}")

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

                        label = info["label"].lower()
                        direction = info.get("direction", None)
                        timestamp_str = info['timestamp'].strftime("%Y-%m-%d %H:%M:%S")



                        # 🚗 CAR
                        best_plate = self.plate_buffer.get(lost_id)
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]) and label == "car":
                            try:
                                self.upload_vehicle_exit(
                                    plate_text=best_plate["ocr_text"],
                                    plate_confidence=best_plate["confidence"],
                                    exit_time=timestamp_str,
                                    timestamp_str=timestamp_str,
                                    screenshot_frame=info['screenshot'],
                                    vehicle_type=info['label'],
                                    hex_color=info['color'],
                                )
                                # Clean up
                                self.detection_history.pop(lost_id, None)
                                self.plate_buffer.pop(lost_id, None)
                                self.crossed_ids.discard(lost_id)
                                self.logged_lost_ids.add(lost_id)
                            except Exception as e:
                                print(f"❌ Exception in upload_vehicle_exit: {e}")

                        # 🚲 BICYCLE (No plate)
                        if label == "bicycle":
                            if self.is_exit_camera:
                                self.upload_vehicle_exit(
                                    plate_text="NO PLATE",
                                    plate_confidence=0.0,
                                    exit_time=timestamp_str,
                                    screenshot_frame=info["screenshot"],
                                    timestamp_str=timestamp_str,
                                    vehicle_type="bicycle",
                                    hex_color=info["color"]
                                )
                            else:
                                self.upload_vehicle_entry(
                                    plate_text="NO PLATE",
                                    plate_confidence=0.0,
                                    entry_time=timestamp_str,
                                    screenshot_frame=info["screenshot"],
                                    timestamp_str=timestamp_str,
                                    vehicle_type="bicycle",
                                    hex_color=info["color"]
                                )
                        # 🏍 MOTORCYCLE
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]) and label == "motorcycle":
                            print(f"[DEBUG] Calling upload_vehicle_entry with screenshot type: {type(info['screenshot'])}")
                            print(f"[DEBUG] Motorcycle logic triggered — direction: {direction}, is_exit_camera: {getattr(self, 'is_exit_camera', 'undefined')}")
                            plate_text = best_plate["ocr_text"]
                            plate_confidence = best_plate["confidence"]
                            if self.is_exit_camera:
                                if direction == "right":  # ✅ Entry from Exit side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )
                                elif direction == "left":  # ✅ Exit from Exit side
                                    self.upload_vehicle_exit(
                                        plate_text=plate_text,
                                        plate_confidence=0.0,
                                        exit_time=timestamp_str,
                                        screenshot_frame=info["screenshot"],
                                        timestamp_str=timestamp_str,
                                        vehicle_type="motorcycle",
                                        hex_color=info["color"]
                                    )
                            else:
                                if direction == "right":  # ✅ Entry from Entry side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )
                                elif direction == "left":  # ✅ Exit from Entry side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )

                        # ✅ Mark as processed only after everything above
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

    def frame_producer_ffmpeg(self):
        while self.running and self.ffmpeg_process and self.ffmpeg_process.stdout:
            raw_frame = self.ffmpeg_process.stdout.read(self.frame_size)
            if not raw_frame:
                continue
            frame = np.frombuffer(raw_frame, np.uint8).reshape((self.frame_height, self.frame_width, 3))

            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put(frame)

            time.sleep(0.03)
    def frame_producer_opencv(self):
        while self.running:
            ret, frame = self.video_capture.read()
            if not ret:
                print("🎞️ End of video or read failed.")
                break

            frame = cv2.resize(frame, (self.frame_width, self.frame_height))

            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put(frame)

            time.sleep(1 / 30)  # ~30 FPS



    def frame_processor(self):
        while self.running:
            if self.frame_queue.empty():
                time.sleep(0.01)
                continue


            frame = self.frame_queue.get()
            self._frame_index += 1

            # ✅ Skip every N frames (e.g., process every 2nd frame)
            if self._frame_index % 2 != 0:
                continue  # skip this frame
            annotated_frame, detections = self.process_frame(frame, size=(960, 540))
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
        self.frame_width = 960
        self.frame_height = 540
        self.frame_size = self.frame_width * self.frame_height * 3
        if self.ocr is None:
            self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
        if not hasattr(self, 'model') or self.model is None:
            self.model = YOLO(self.model_path)  # or self.model_path if you've saved it


        is_rtsp = self.video_path.startswith("rtsp://")
        self.ffmpeg_process = None
        

        if is_rtsp:
            print("📡 Starting RTSP stream using FFmpeg pipe...")

            self.ffmpeg_cmd = [
                'ffmpeg',
                '-rtsp_transport', 'tcp',
                '-i', self.video_path,
                '-vf', 'scale=640:480',
                '-f', 'image2pipe',
                '-pix_fmt', 'bgr24',
                '-vcodec', 'rawvideo',
                '-'
            ]

            try:
                self.ffmpeg_process = subprocess.Popen(
                    self.ffmpeg_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    bufsize=10**8
                )
            except Exception as e:
                print(f"❌ FFmpeg launch failed: {e}")
                self.running = False
                return

            self.producer_thread = Thread(target=self.frame_producer_ffmpeg)
        else:
            print("📼 Starting video file using OpenCV...")
            self.video_capture = cv2.VideoCapture(self.video_path)
            if not self.video_capture.isOpened():
                print("❌ Failed to open video file.")
                self.running = False
                return
            self.producer_thread = Thread(target=self.frame_producer_opencv)

        self.processor_thread = Thread(target=self.frame_processor)
        self.emit_thread = Thread(target=self.emit_frames)

        for t in [self.producer_thread, self.processor_thread, self.emit_thread]:
            t.daemon = True
            t.start()

        print("✅ Video processing started.")
    def stop(self):
        if not self.running:
            return

        self.running = False

        # Release video resources
        if hasattr(self, "ffmpeg_process") and self.ffmpeg_process:
            self.ffmpeg_process.terminate()
            self.ffmpeg_process.wait()
            self.ffmpeg_process = None

        if hasattr(self, "video_capture") and self.video_capture:
            self.video_capture.release()
            self.video_capture = None

        # Clean up OCR to reset its internal state
        if self.ocr:
            del self.ocr
            self.ocr = None

        # Clear detection-related data
        self.crossed_ids.clear()
        self.detection_history.clear()
        self.logged_lost_ids.clear()
        self.plate_buffer.clear()
        self.class_counts.clear()
        self.model = None

        print("🛑 Video processing stopped and buffers cleared.")






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
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)
        self.model_path = model_path
        self._frame_index = 0
        self.is_exit_camera=False

        
        # Tracking variables
        self.line_x = 250  # Line position for counting
        self.crossed_ids = set()  # Track IDs that have crossed the line
        self.class_counts = defaultdict(int)  # Count of objects by class
        self.detection_history = {}  # Store detection history for each track ID
        self.plate_read_ids = set()
        self.plates_detected_ids = set()
        self.plate_buffer = {}  
        self.previous_centers = {} 

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
            blur = cv2.GaussianBlur(gray, (3, 3), 0)
            cv2.rectangle(image, (x1, y1), (x2, y2), (0, 255, 255), 2)
            thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 4)
            
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
        # Remove all non-alphanumeric characters (e.g., -, ., spaces)
        cleaned = re.sub(r'[^A-Za-z0-9]', '', plate_text).upper()

        # Check if it matches the pattern ABC1234
        if re.fullmatch(r'[A-Z]{3}\d{4}', cleaned):
            # Format it as ABC 1234
            formatted = f"{cleaned[:3]} {cleaned[3:]}"
            return formatted
        elif re.fullmatch(r'\d{3}[A-Z]{3}', cleaned):  # Motorcycle plate
            formatted = f"{cleaned[:3]} {cleaned[3:]}"
            return formatted

        return None
    
    def assign_bicycle(self, entry_id, customer_id, plate_number, entry_time):
        from models.parking_slot import ParkingSlot
        from models.parking_session import ParkingSession

        with Session(self.engine) as session:
            # Search for available slot in 'bike area left'
            slot = session.query(ParkingSlot)\
                .filter_by(section="bike area left", vehicle_type="bicycle", status="available", is_active=True)\
                .order_by(ParkingSlot.slot_number.asc())\
                .first()

            # If none, try 'bike area right'
            if not slot:
                slot = session.query(ParkingSlot)\
                    .filter_by(section="bike area right", vehicle_type="bicycle", status="available", is_active=True)\
                    .order_by(ParkingSlot.slot_number.asc())\
                    .first()

            if not slot:
                print("❌ No available bicycle slots in either section.")
                return

            try:
                # Assign slot
                slot.status = "occupied"
                slot.current_vehicle_id = entry_id

                # Create parking session
                session_entry = ParkingSession(
                    entry_id=entry_id,
                    slot_id=slot.slot_id,
                    lot_id=slot.lot_id,
                    customer_id=customer_id,
                    plate_number=plate_number,
                    start_time=entry_time,
                    status="active"
                )

                session.add(session_entry)
                session.commit()
                print(f"✅ Bicycle assigned to slot {slot.slot_number} in {slot.section}.")
            except Exception as e:
                session.rollback()
                print(f"❌ Failed to assign bicycle: {e}")
    def assign_motorcycle(self, entry_id, customer_id, plate_number, entry_time):
        from models.parking_slot import ParkingSlot
        from models.parking_session import ParkingSession

        with Session(self.engine) as session:
            # Find available motorcycle slot in elevated parking
            slot = session.query(ParkingSlot)\
                .filter_by(section="elevated parking", vehicle_type="motorcycle", status="available", is_active=True)\
                .order_by(ParkingSlot.slot_number.asc())\
                .first()

            if not slot:
                print("❌ No available motorcycle slots in elevated parking.")
                return

            try:
                # Assign slot
                slot.status = "occupied"
                slot.current_vehicle_id = entry_id

                # Create parking session
                session_entry = ParkingSession(
                    entry_id=entry_id,
                    slot_id=slot.slot_id,
                    lot_id=slot.lot_id,
                    customer_id=customer_id,
                    plate_number=plate_number,
                    start_time=entry_time,
                    status="active"
                )

                session.add(session_entry)
                session.commit()
                print(f"✅ Motorcycle assigned to slot {slot.slot_number} in elevated parking.")
            except Exception as e:
                session.rollback()
                print(f"❌ Failed to assign motorcycle: {e}")

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
                status =  "assigned" if vehicle_type.lower() in ["bicycle", "motorcycle"] else "unassigned"
                entry = VehicleEntry(
                    entry_id=str(uuid.uuid4()),
                    plate_number=plate_text,
                    entry_time=datetime.strptime(entry_time, "%Y-%m-%d %H:%M:%S"),
                    image_url=public_url,
                    customer_id=customer_id,
                    vehicle_type=vehicle_type,  # Default or based on detection
                    hex_color=hex_color,  # Default or detected color
                    guard_id=self.active_guard_id,
                    status=status
                )
                
                try:
                    session.add(entry)
                    session.commit()
                    print("✅ Entry inserted into database")
                    if vehicle_type.lower() == "bicycle":
                        self.assign_bicycle(entry.entry_id, customer_id, plate_text, entry.entry_time)
                    elif vehicle_type.lower() == "motorcycle":
                        self.assign_motorcycle(entry.entry_id, customer_id, plate_text, entry.entry_time)
                    
                    entry_status = "assigned" if vehicle_type.lower() in ["bicycle", "motorcycle"] else "unassigned"
                    self.socketio.emit("new_vehicle_entry", {
                        "entry_id": str(entry.entry_id),
                        "plate_number": plate_text,
                        "entry_time": entry_time,
                        "image_url": public_url,
                        "guard_id": str(self.active_guard_id) if self.active_guard_id else None,
                        "status": entry_status
                    })
                    try:
                        import requests
                        requests.get("http://localhost:5000/api/unassigned-vehicles")
                        print("📣 Triggered /api/unassigned-vehicles")
                    except Exception as e:
                        print(f"❌ Failed to notify unassigned vehicles: {e}")

                except Exception as e:
                    session.rollback()
                    print(f"❌ Failed to insert entry: {e}")

        except Exception as e:
            print(f"❌ Exception in upload_vehicle_entry: {e}")
    def auto_release_slot(self, plate_number, exit_time_str):
        from models.parking_session import ParkingSession
        from models.parking_slot import ParkingSlot
        from models.vehicle_exit import VehicleExit

        try:
            with Session(self.engine) as session:
                # Get the latest active session for this plate
                session_record = session.query(ParkingSession)\
                    .filter_by(plate_number=plate_number, status='active', exit_id=None)\
                    .order_by(ParkingSession.start_time.desc())\
                    .first()

                if not session_record:
                    print(f"⚠️ No active session found for auto-exit of {plate_number}")
                    return

                # Mark slot as available
                slot = session_record.slot
                if slot:
                    slot.status = 'available'
                    slot.current_vehicle_id = None

                # Calculate session end and duration
                exit_time = datetime.strptime(exit_time_str, "%Y-%m-%d %H:%M:%S")
                session_record.end_time = exit_time
                session_record.status = 'completed'
                if session_record.start_time:
                    duration = exit_time - session_record.start_time
                    session_record.duration_minutes = int(duration.total_seconds() // 60)

                session.commit()
                print(f"✅ Auto-unassigned slot {slot.slot_number} for {plate_number} (Duration: {session_record.duration_minutes} mins)")

        except Exception as e:
            print(f"❌ Failed to auto-release slot: {e}")

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
                    # ✅ Update parking session and slot status
                    try:
                        # Find active parking session matching the entry
                        session_record = session.query(ParkingSession)\
                            .filter_by(entry_id=entry.entry_id, status='active', exit_id=None)\
                            .order_by(ParkingSession.start_time.desc())\
                            .first()

                        if session_record:
                            session_record.exit_id = exit_record.exit_id
                            session_record.end_time = exit_record.exit_time
                            session_record.status = 'completed'

                            # ✅ Calculate duration in minutes
                            if session_record.end_time and session_record.start_time:
                                duration = session_record.end_time - session_record.start_time
                                session_record.duration_minutes = int(duration.total_seconds() // 60)

                            # ✅ Mark the assigned slot as available & unlink current_vehicle_id
                            slot = session_record.slot
                            if slot:
                                slot.status = 'available'
                                slot.current_vehicle_id = None
                            session.commit()
                            print(f"✅ Parking session completed for plate {plate_text}")
                        else:
                            print(f"⚠️ No active session found for plate {plate_text}")

                    except Exception as e:
                        session.rollback()
                        print(f"❌ Failed to update parking session: {e}")

                    # ✅ Trigger parking status update
                    try:
                        import requests
                        requests.get("http://localhost:5000/parking/get-parking-status")
                        print("📣 Triggered /parking/get-parking-status")
                    except Exception as e:
                        print(f"❌ Failed to notify parking status: {e}")


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

    def process_frame(self, frame, size=None):
        self.is_exit_camera = False
        filtered_boxes = []
        filtered_track_ids = []
        filtered_confidences = []
        filtered_class_indices = []
        print(self.active_guard_id)
        if size:
            frame = cv2.resize(frame, size)
        original_frame = frame.copy()  # Clean version for screenshot
        best_plate_frame = None

        results = self.model.track(frame, persist=True, conf=0.5, iou=0.5)
        detections = []

        target_classes = {'car', 'motorcycle', 'bike', 'bicycle'}
        plate_line_x = 250  # Detection boundary

        # Draw plate detection boundary
        cv2.line(frame, (plate_line_x, 0), (plate_line_x, frame.shape[0]), (0, 255, 0), 2)

        moto_line_x = 640 if isinstance(self, EntryVideoProcessor) else 220
        cv2.line(frame, (moto_line_x, 0), (moto_line_x, frame.shape[0]), (0, 0, 255), 2)
        cv2.putText(frame, "Motorcycle Line", (moto_line_x + 10, 80),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
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
                # Determine direction
                direction = self.detection_history.get(track_id, {}).get("direction", None)
                if track_id in self.previous_centers:
                    prev_cx = self.previous_centers[track_id]
                    if cx < prev_cx:
                        direction = "left"
                    elif cx > prev_cx:
                        direction = "right"
                if direction in ["left", "right"]:
                    if track_id in self.detection_history:
                        self.detection_history[track_id]["direction"] = direction 
                self.previous_centers[track_id] = cx
                # Draw object center and ID
                cv2.circle(frame, (cx, cy), 4, (0, 255, 0), -1)
                cv2.putText(frame, f"ID:{track_id}", (x1, y1-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 1)

                # Plate detection
                if label =="motorcycle" or x2 > plate_line_x:
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
                            raw_text = self.extract_text_from_roi(plate_roi, [[0, 0, px2-px1, py2-py1]])

                            if raw_text.strip() == "":
                                continue

                            # ✅ Normalize plate format: ABC1234 → ABC 1234
                            cleaned = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()
                            if re.fullmatch(r'[A-Z]{3}\d{4}', cleaned):
                                plate_text = f"{cleaned[:3]} {cleaned[3:]}"
                            elif re.fullmatch(r'\d{3}[A-Z]{3}', cleaned):  # Motorcycle plate
                                plate_text = f"{cleaned[:3]} {cleaned[3:]}"
                            else:
                                plate_text = raw_text  # fallback if it doesn't match

                            new_plate = {
                                "label": "Plate",
                                "confidence": plate_conf,
                                "coordinates": [px1+x1, py1+y1, px2+x1, py2+y1],
                                "ocr_text": plate_text.strip()
                            }

                            old_plate = self.plate_buffer.get(track_id)
                            if (old_plate is None or plate_conf > old_plate["confidence"]) and self.is_valid_plate_format(plate_text):
                                self.plate_buffer[track_id] = new_plate

                                if isinstance(frame, np.ndarray) and frame.size > 0:
                                    best_plate_frame = frame.copy()
                                    print(f"[DEBUG] Best plate updated for ID {track_id}: {plate_text} (Conf: {plate_conf:.2f}) and screenshot")
                                    print(f"[DEBUG] Saved screenshot shape for ID {track_id}: {best_plate_frame.shape}")
                                else:
                                    print("❌ best_plate_frame = frame.copy() failed: frame is empty or invalid")
                                    best_plate_frame = None
                            self.log_detection("Plate", plate_conf, plate_text, track_id)

                # Color detection
                roi = frame[y1:y2, x1:x2]
                hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
                mean_hsv = cv2.mean(hsv_roi)[:3]
                mean_hsv_uint8 = np.array([[mean_hsv]], dtype=np.uint8)
                mean_bgr = cv2.cvtColor(mean_hsv_uint8, cv2.COLOR_HSV2BGR)[0][0]
                hex_color = '#{:02x}{:02x}{:02x}'.format(int(mean_bgr[2]), int(mean_bgr[1]), int(mean_bgr[0]))
                #screenshot safe
                if isinstance(best_plate_frame, np.ndarray) and best_plate_frame.size > 0:
                    safe_screenshot = best_plate_frame.copy()
                elif isinstance(original_frame, np.ndarray) and original_frame.size > 0:
                    safe_screenshot = original_frame.copy()
                else:
                    print("❌ No valid frame available, using dummy fallback image")
                    safe_screenshot = np.zeros((10, 10, 3), dtype=np.uint8)  # fallback
                                # Check if crossed
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
                        "screenshot": safe_screenshot
                        ,"direction":direction if direction else "undetermined"
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
                        label = info["label"].lower()
                        best_plate = self.plate_buffer.get(lost_id)
                        timestamp_str = info['timestamp'].strftime("%Y-%m-%d %H:%M:%S")
                        #car
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]) and label == "car":

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

                        direction = info.get("direction", None)
                        if label == "bicycle":
                            
                            if self.is_exit_camera:
                                self.upload_vehicle_exit(
                                    plate_text="NO PLATE",
                                    plate_confidence=0.0,
                                    exit_time=timestamp_str,
                                    screenshot_frame=info["screenshot"],
                                    timestamp_str=timestamp_str,
                                    vehicle_type="bicycle",
                                    hex_color=info["color"]
                                )

                            else:
                                self.upload_vehicle_entry(
                                    plate_text="NO PLATE",
                                    plate_confidence=0.0,
                                    entry_time=timestamp_str,
                                    screenshot_frame=info["screenshot"],
                                    timestamp_str=timestamp_str,
                                    vehicle_type="bicycle",
                                    hex_color=info["color"]
                                )
                        # 🏍 MOTORCYCLE
                        if best_plate and self.is_valid_plate_format(best_plate["ocr_text"]) and label == "motorcycle":
                            print(f"[DEBUG] Calling upload_vehicle_entry with screenshot type: {type(info['screenshot'])}")
                            print(f"[DEBUG] Motorcycle logic triggered — direction: {direction}, is_exit_camera: {getattr(self, 'is_exit_camera', 'undefined')}")
                            plate_text = best_plate["ocr_text"]
                            plate_confidence = best_plate["confidence"]
                            if self.is_exit_camera:
                                if direction == "right":  # ✅ Entry from Exit side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )
                                elif direction == "left":  # ✅ Exit from Exit side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )
                            else:
                                if direction == "right":  # ✅ Entry from Entry side
                                    self.upload_vehicle_entry(
                                        plate_text=plate_text,
                                        plate_confidence=plate_confidence,
                                        entry_time=timestamp_str,
                                        screenshot_frame=info['screenshot'],
                                        timestamp_str=timestamp_str,
                                        vehicle_type=label,
                                        hex_color=info['color']
                                    )
                                elif direction == "left":  # ✅ Exit from Entry side

                                    self.upload_vehicle_exit(
                                        plate_text=plate_text,
                                        plate_confidence=0.0,
                                        exit_time=timestamp_str,
                                        screenshot_frame=info["screenshot"],
                                        timestamp_str=timestamp_str,
                                        vehicle_type="motorcycle",
                                        hex_color=info["color"]
                                    )

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
   
    def frame_producer_ffmpeg(self):
        while self.running and self.ffmpeg_process and self.ffmpeg_process.stdout:
            raw_frame = self.ffmpeg_process.stdout.read(self.frame_size)
            if not raw_frame:
                continue
            frame = np.frombuffer(raw_frame, np.uint8).reshape((self.frame_height, self.frame_width, 3))

            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put(frame)

            time.sleep(0.03)
    def frame_producer_opencv(self):
        while self.running:
            ret, frame = self.video_capture.read()
            if not ret:
                print("🎞️ End of video or read failed.")
                break

            frame = cv2.resize(frame, (self.frame_width, self.frame_height))

            while not self.frame_queue.empty():
                self.frame_queue.get_nowait()
            self.frame_queue.put(frame)

            time.sleep(1 / 30)  # ~30 FPS


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
            self._frame_index += 1

            # ✅ Skip every N frames (e.g., process every 2nd frame)
            if self._frame_index % 2 != 0:
                continue  # skip this frame
            annotated_frame, detections = self.process_frame(frame, size=(960, 540))
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 90]
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
#test 
    def start(self):
        if self.running:
            return

        self.running = True
        self.frame_width = 960
        self.frame_height = 540
        self.frame_size = self.frame_width * self.frame_height * 3
        if self.ocr is None:
            self.ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

        is_rtsp = isinstance(self.video_path, str) and self.video_path.startswith("rtsp://")
        self.ffmpeg_process = None

        if is_rtsp:
            print("📡 Starting RTSP stream using FFmpeg pipe...")

            self.ffmpeg_cmd = [
                'ffmpeg',
                '-rtsp_transport', 'tcp',
                '-i', self.video_path,
                '-vf', 'scale=640:480',
                '-f', 'image2pipe',
                '-pix_fmt', 'bgr24',
                '-vcodec', 'rawvideo',
                '-'
            ]

            try:
                self.ffmpeg_process = subprocess.Popen(
                    self.ffmpeg_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    bufsize=10**8
                )
            except Exception as e:
                print(f"❌ FFmpeg launch failed: {e}")
                self.running = False
                return

            self.producer_thread = Thread(target=self.frame_producer_ffmpeg)
        else:
            print("📼 Starting video file using OpenCV...")
            self.video_capture = cv2.VideoCapture(self.video_path)
            if not self.video_capture.isOpened():
                print("❌ Failed to open video file.")
                self.running = False
                return
            self.producer_thread = Thread(target=self.frame_producer_opencv)

        self.processor_thread = Thread(target=self.frame_processor)
        self.emit_thread = Thread(target=self.emit_frames)

        for t in [self.producer_thread, self.processor_thread, self.emit_thread]:
            t.daemon = True
            t.start()

        print("✅ Video processing started.")
    def stop(self):
        if not self.running:
            return

        self.running = False

        # Release video resources
        if hasattr(self, "ffmpeg_process") and self.ffmpeg_process:
            self.ffmpeg_process.terminate()
            self.ffmpeg_process.wait()
            self.ffmpeg_process = None

        if hasattr(self, "video_capture") and self.video_capture:
            self.video_capture.release()
            self.video_capture = None

        # Clean up OCR to reset its internal state
        if self.ocr:
            del self.ocr
            self.ocr = None

        # Clear detection-related data
        self.crossed_ids.clear()
        self.detection_history.clear()
        self.logged_lost_ids.clear()
        self.plate_buffer.clear()
        self.class_counts.clear()

        print("🛑 Video processing stopped and buffers cleared.")