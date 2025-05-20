from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os
from dotenv import load_dotenv

load_dotenv()
db = SQLAlchemy()

def init_db(app):
    # Use your Supabase DATABASE_URL environment variable
    DATABASE_URL = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Updated engine options for better connection pooling
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 20,  # Increased pool size
        'pool_recycle': 1800,  # Recycle connections after 30 minutes
        'pool_pre_ping': True,  # Enable connection health checks
        'pool_timeout': 30,  # 30 seconds timeout
        'max_overflow': 10,  # Allow up to 10 additional connections
        'echo': False
    }

    db.init_app(app)