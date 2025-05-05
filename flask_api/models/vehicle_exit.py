from models.base import db, generate_uuid, datetime, PG_UUID

class VehicleExit(db.Model):
    __tablename__ = 'vehicle_exits'

    
    exit_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    plate_number = db.Column(db.String(20), db.ForeignKey('parking_customers.plate_number'), nullable=False)
    exit_time = db.Column(db.DateTime, default=datetime.utcnow)
    image_url = db.Column(db.Text)
    guard_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('guards.guard_id'), nullable=True)
    customer_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('parking_customers.customer_id'), nullable=True)
    vehicle_type = db.Column(db.String(50))
    hex_color = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<VehicleExit {self.plate_number} at {self.exit_time}>'