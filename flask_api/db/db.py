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

    # Optional: Set engine options for connection pooling in production
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 10,
        'pool_recycle': 300,
        'pool_pre_ping': True
    }

    db.init_app(app)
