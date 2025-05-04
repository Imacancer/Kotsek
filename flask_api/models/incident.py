from models.base import db, generate_uuid, datetime, PG_UUID
from sqlalchemy.dialects.postgresql import JSONB

class Incident(db.Model):
    __tablename__ = 'incidents'
    
    id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    incident_name = db.Column(db.String(100), nullable=False)
    date = db.Column(db.DateTime, default=datetime.now)
    time = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=False)
    vehicles = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)


    
    def __repr__(self):
        return f'<Incident {self.incident_id} - Vehicle {self.vehicle_id} - Guard {self.guard_id}>'