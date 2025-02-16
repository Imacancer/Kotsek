from ultralytics import YOLO

# Load a model (YOLOv8 Nano as an example)
model = YOLO('yolov8s.pt')  

# Train the model
model.train(
    data="./datasets/coco128.yaml",
    epochs=50,
    imgsz=640,
    cache=True
)
