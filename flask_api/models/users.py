from db.db import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from models.base import generate_uuid, PG_UUID
class User(db.Model):
    __tablename__ = 'user_profiles'

    
    id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(80), unique=True, nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    google_id = db.Column(db.String(120), unique=True, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_verified = db.Column(db.Boolean, default=False)
    is_blocked = db.Column(db.Boolean, default=False)
    image_url = db.Column(db.Text, nullable=True)
    role = db.Column(db.String(50))
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_verified': self.is_verified,
            'is_blocked': self.is_blocked,
            'image_url': self.image_url,
            'role': self.role
        }