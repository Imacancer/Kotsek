from ultralytics import YOLO


model = YOLO('/Users/manuel/Documents/C2_Project/flask_api/runs/detect/train/weights/best.pt')


input_video_path = '/Users/manuel/Documents/C2_Project/flask_api/sample'


results = model.predict(source=input_video_path, save=True, save_txt=True)


print("Detection complete. Output saved in:", results.save_dir)
