import eventlet
eventlet.monkey_patch()
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from detection_service.exit_detection import ExitDetection
from detection_service.detection import VideoProcessor
from controllers.auth import auth_bp, init_jwt
from controllers.unassigned import vehicle_bp
from controllers.assign_guard import guard_bp
from controllers.parking_lot import parking_bp
from controllers.tungtungtungsahur import analytics_bp
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
    global video_processor, exit_detection
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
    app.register_blueprint(analytics_bp, url_prefix='/analytics')

    init_jwt(app)

    # Initialize the database and migrations
    init_db(app)              # This sets app.config['SQLALCHEMY_DATABASE_URI'] and initializes db
    # with app.app_context():
    #     from db.initializers import run_all_initializers // i uncomment nyo to after nyo mag migrate
    #     run_all_initializers()

    # Initialize SocketIO and any additional services
    socketio = SocketIO(app, ping_timeout=1, ping_interval=2, 
                        cors_allowed_origins="*", max_http_buffer_size=1e8, async_mode='eventlet')

    video_path = "./sample/mamamo.mov"  # Update path as necessary
    video_processor = VideoProcessor(socketio, video_path)  # Local variable
    app.video_processor = video_processor

    # exit_video_path = "./sample/exit_video.mov"  # Update with your exit video path
    # exit_detection = ExitDetection(socketio, exit_video_path)
    # app.exit_detection = exit_detection

    app.set_active_guard = lambda guard_id: app.video_processor.set_active_guard(guard_id)
    
    # Add a property to get the active guard ID
    @property
    def active_guard_id(app):
        return app.video_processor.active_guard_id
    
    app.active_guard_id = property(lambda app: app.video_processor.active_guard_id)

    @socketio.on("start_video")
    def handle_start_video(data):
        print("Received start_video event")
        video_processor.start()

    @socketio.on("stop_video")
    def handle_stop_video(data=None):
        print("Received stop_video event")
        video_processor.stop()

    # @socketio.on("start_exit_video")
    # def handle_start_exit_video(data):
    #     print("Received start_exit_video event")
    #     exit_detection.start()

    # @socketio.on("stop_exit_video")
    # def handle_stop_exit_video(data=None):
    #     print("Received stop_exit_video event")
    #     exit_detection.stop()

    return app, socketio

def create_exit_app():
    app = Flask(__name__)
    # ... minimal initialization for exit detection only ...
    socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=20, ping_interval=5, async_mode='eventlet')
    
    exit_detection = ExitDetection(socketio, "./sample/sample1.mov")
    app.exit_detection = exit_detection

    @socketio.on('connect')
    def handle_connect():
        print("Client connected to exit detection server")
    
    @socketio.on('disconnect')
    def handle_disconnect():
        print("Client disconnected from exit detection server") 
        if hasattr(app, 'exit_detection'):
            app.exit_detection.stop()
    
    @socketio.on("start_exit_video")
    def handle_start_exit_video(data):
        try:
            exit_detection.start()
        except Exception as e:
            print(f"Error starting exit video: {str(e)}")
            socketio.emit('error', {'message': 'Failed to start exit video'})

    @socketio.on("stop_exit_video")
    def handle_stop_exit_video(data=None):
        try:
            exit_detection.stop()
        except Exception as e:
            print(f"Error stopping exit video: {str(e)}")
            
    # Error handling for broken pipe
    @socketio.on_error()
    def error_handler(e):
        if isinstance(e, BrokenPipeError):
            print("Broken pipe error - client disconnected")
            if hasattr(app, 'exit_detection'):
                app.exit_detection.stop()
        else:
            print(f"SocketIO error: {str(e)}")
        
    return app, socketio


# Create a global app variable for Flask CLI to pick up
app, socketio = create_app()
exit_app, exit_socketio = create_exit_app()

if __name__ == '__main__':
    from threading import Thread
    import eventlet
    eventlet.monkey_patch()

    exit_thread = Thread(target=lambda: exit_socketio.run(exit_app, host='0.0.0.0', port=5002, use_reloader=False, log_output=True))
    exit_thread.daemon = True
    exit_thread.start()
    socketio.run(app, debug=True, host='0.0.0.0', port=5001, use_reloader=False, log_output=True)
