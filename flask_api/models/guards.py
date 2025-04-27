from models.base import db, generate_uuid, datetime, PG_UUID

class Guard(db.Model):
    __tablename__ = 'guards'
    
    guard_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), nullable=False)
    contact = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    entries = db.relationship('VehicleEntry', backref='guard', lazy=True)
    exits = db.relationship('VehicleExit', backref='guard', lazy=True)
    
    def __repr__(self):
        return f'<Guard {self.name}>'