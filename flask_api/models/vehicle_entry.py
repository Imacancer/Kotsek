from models.base import db, generate_uuid, datetime,PG_UUID

class VehicleEntry(db.Model):
    __tablename__ = 'vehicle_entries'

    
    entry_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    plate_number = db.Column(db.String(20), db.ForeignKey('parking_customers.plate_number'), nullable=False)
    entry_time = db.Column(db.DateTime, default=datetime.utcnow)
    image_url = db.Column(db.Text)
    guard_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('guards.guard_id'), nullable=True)
    customer_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('parking_customers.customer_id'), nullable=True)
    vehicle_type = db.Column(db.String(50))
    hex_color = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status =  db.Column(db.String(20), default='unassigned')
    
    def __repr__(self):
        return f'<VehicleEntry {self.plate_number} at {self.entry_time}>'