from flask import Flask
from db.db import init_db
from flask_cors import CORS
from routes.sample_route import user_bp

def create_app():
    app = Flask(__name__)
    
    #pede nyo palitan yung cors configuration dito kung may conflict sa port na gamt
    
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5001", "http://127.0.0.1:5001"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    app.config['JSON_SORT_KEYS'] = False
    app.config['CORS_HEADERS'] = 'Content-Type'
    
    # Initialize database
    init_db(app)
    
    # Register blueprints
    app.register_blueprint(user_bp)
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5001)