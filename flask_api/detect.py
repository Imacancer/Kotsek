from ultralytics import YOLO
import cv2
import numpy as np
from paddleocr import PaddleOCR

# Initialize YOLO and PaddleOCR models
model = YOLO('./plates/best.pt')
ocr = PaddleOCR(use_angle_cls=True, lang='en', use_gpu=False)

def process_frame_with_ocr(frame, detections):
    results = []
    # Check if detections exist and have boxes
    if not detections or len(detections[0].boxes) == 0:
        return results
    
    try:
        for detection in detections[0].boxes:  # Access boxes from first detection
            # Safely get bounding box coordinates
            if detection.xyxy.shape[0] > 0:  # Check if xyxy exists
                x1, y1, x2, y2 = map(int, detection.xyxy[0])
                
                # Ensure coordinates are within frame boundaries
                h, w = frame.shape[:2]
                x1, x2 = max(0, x1), min(w, x2)
                y1, y2 = max(0, y1), min(h, y2)
                
                # Extract plate region
                if x2 > x1 and y2 > y1:  # Ensure valid ROI
                    plate_roi = frame[y1:y2, x1:x2]
                    
                    # Preprocess for OCR
                    gray = cv2.cvtColor(plate_roi, cv2.COLOR_BGR2GRAY)
                    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                                cv2.THRESH_BINARY, 11, 2)
                    
                    # Perform OCR
                    ocr_result = ocr.ocr(thresh, cls=True)
                    
                    # Extract text from OCR result
                    if ocr_result and len(ocr_result) > 0:
                        text = " ".join([line[1][0] for line in ocr_result[0] if line and len(line) > 1])
                        confidence = float(detection.conf) if detection.conf is not None else 0.0
                        results.append({
                            'bbox': [x1, y1, x2, y2],
                            'text': text,
                            'confidence': confidence
                        })
                        print(f"Detected plate: {text} (Confidence: {confidence:.2f})")
    
    except Exception as e:
        print(f"Error processing detection: {str(e)}")
    
    return results

# Process video
input_video_path = './sample/mamamo.mov'
cap = cv2.VideoCapture(input_video_path)

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    
    try:
        # Run YOLO detection
        detections = model(frame)
        
        # Process detections with OCR
        results = process_frame_with_ocr(frame, detections)
        
        # Draw results on frame
        for result in results:
            x1, y1, x2, y2 = result['bbox']
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, result['text'], (x1, y1-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

        # Display frame
        cv2.imshow('Frame', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        continue

cap.release()
cv2.destroyAllWindows()

print("Detection complete with OCR")
