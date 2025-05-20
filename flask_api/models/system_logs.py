from db.db import db
from datetime import datetime
import uuid
from models.base import generate_uuid, PG_UUID, datetime

class SystemLog(db.Model):
    __tablename__ = 'system_logs'
    id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.now)
    log_type = db.Column(db.String(50), nullable=False)  # e.g., 'user_action', 'system_event', 'error'
    action = db.Column(db.String(255), nullable=False)
    details = db.Column(db.JSON)
    user_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('user_profiles.id'))
    ip_address = db.Column(db.String(45))
    
    def to_dict(self):
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'log_type': self.log_type,
            'action': self.action,
            'details': self.details,
            'user_id': self.user_id,
            'ip_address': self.ip_address
        } 