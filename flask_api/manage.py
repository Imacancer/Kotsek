from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from detection_service.detection import VideoProcessor
from controllers.auth import auth_bp, init_jwt
import os 
from dotenv import load_dotenv
from db.db import init_db, db  # Import the init_db function and db instance
from flask_migrate import Migrate  # Import Flask-Migrate

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv('SECRET_KEY', 'FB27D156173716A31912F1BD6CEDB')

    # CORS configuration
    CORS(app)

    app.config['JSON_SORT_KEYS'] = False
    app.config['CORS_HEADERS'] = 'Content-Type'
    
    
    # Register the auth blueprint
    app.register_blueprint(auth_bp)

    init_jwt(app)

    # Initialize the database and migrations
    init_db(app)              # This sets app.config['SQLALCHEMY_DATABASE_URI'] and initializes db
    migrate = Migrate(app, db)  # Attaches Flask-Migrate to your app

    # Initialize SocketIO and any additional services
    socketio = SocketIO(app, ping_timeout=1, ping_interval=2, 
                        cors_allowed_origins="*", max_http_buffer_size=1e8)

    video_path = "./sample/mamamo.mov"  # Update path as necessary
    video_processor = VideoProcessor(socketio, video_path)

    @socketio.on("start_video")
    def handle_start_video(data):
        print("Received start_video event")
        video_processor.start()

    @socketio.on("stop_video")
    def handle_stop_video(data=None):
        print("Received stop_video event")
        video_processor.stop()

    return app, socketio

# Create a global app variable for Flask CLI to pick up
app, socketio = create_app()

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
