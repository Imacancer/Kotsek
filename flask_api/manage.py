from flask import Flask
from db.db import init_db
from flask_cors import CORS
from flask_socketio import SocketIO
from routes.sample_route import user_bp
from controllers.wsocket import start_video

def create_app():
    app = Flask(__name__)

    # CORS configuration
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5001", "http://127.0.0.1:5001"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })

    app.config['JSON_SORT_KEYS'] = False
    app.config['CORS_HEADERS'] = 'Content-Type'

    
    init_db(app)

    
    app.register_blueprint(user_bp)

    
    socketio = SocketIO(app, ping_timeout=1, ping_interval=2, cors_allowed_origins="*", max_http_buffer_size=1e8)

    
    start_video(socketio)

    return app, socketio

if __name__ == '__main__':
    app, socketio = create_app()
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
