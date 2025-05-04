from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from detection_service.detection import VideoProcessor,EntryVideoProcessor  
from controllers.auth import auth_bp, init_jwt
from controllers.unassigned import vehicle_bp
from controllers.assign_guard import guard_bp
from controllers.parking_lot import parking_bp
import os 
from dotenv import load_dotenv
from db.db import init_db, db  # Import the init_db function and db instance
#please before nyo start to migrate muna kayo ng models sa database search nyo na lang 2 command lang naman
# 1 alembic revision --autogenerate -m "your commit message"
# 2 alembic upgrade head

## Optional commands for Alembic migrations
# 3 alembic downgrade -1 // to rollback the last migration
# 4 alembic history // to see the history of migration
# 5 alembic stamp head // to stamp the current revision as the head without applying any changes

load_dotenv()


def create_app():
    global entry_video_processor, exit_video_processor
    app = Flask(__name__)
    app.secret_key = os.getenv('SECRET_KEY', 'FB27D156173716A31912F1BD6CEDB')

    # CORS configuration
    CORS(app)

    app.config['JSON_SORT_KEYS'] = False
    app.config['CORS_HEADERS'] = 'Content-Type'
    
    
    # Register the auth blueprint
    app.register_blueprint(auth_bp)
    app.register_blueprint(vehicle_bp)
    app.register_blueprint(guard_bp)
    app.register_blueprint(parking_bp)

    init_jwt(app)

    # Initialize the database and migrations
    init_db(app)              # This sets app.config['SQLALCHEMY_DATABASE_URI'] and initializes db
    # with app.app_context():
    #     from db.initializers import run_all_initializers // i uncomment nyo to after nyo mag migrate
    #     run_all_initializers()

    # Initialize SocketIO and any additional services
    socketio = SocketIO(app, ping_timeout=1, ping_interval=2, 
                        cors_allowed_origins="*", max_http_buffer_size=1e8)
    cctv = "rtmp://host.docker.internal:1935/live/test"

    video_path_exit = "./sample/1exitnew.mp4"  # Update path as necessary
    video_path_entry = "./sample/1entrynew.mp4"
    entry_video_processor = EntryVideoProcessor(socketio, video_path_entry) 
    exit_video_processor = VideoProcessor(socketio, video_path_exit)
    app.entry_video_processor = entry_video_processor
    app.exit_video_processor = exit_video_processor

    app.set_active_guard = lambda guard_id: (
        app.entry_video_processor.set_active_guard(guard_id),
        app.exit_video_processor.set_active_guard(guard_id)
    )


    
    # Add a property to get the active guard ID
    @property
    def active_guard_id(app):
        return app.entry_video_processor.active_guard_id
    
    app.active_guard_id = property(lambda app: app.entry_video_processor.active_guard_id)


    @socketio.on("start_entry_video")
    def handle_start_entry_video(data):
        print("Received start_entry_video event")
        entry_video_processor.start()

    @socketio.on("stop_entry_video")
    def handle_stop_entry_video(data=None):
        print("Received stop_entry_video event")
        entry_video_processor.stop()

    @socketio.on("start_exit_video")
    def handle_start_exit_video(data):
        print("Received start_exit_video event")
        exit_video_processor.start()

    @socketio.on("stop_exit_video")
    def handle_stop_exit_video(data=None):
        print("Received stop_exit_video event")
        exit_video_processor.stop()

    return app, socketio

# Create a global app variable for Flask CLI to pick up
app, socketio = create_app()

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5001, allow_unsafe_werkzeug=True)
