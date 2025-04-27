from models.base import db, generate_uuid, datetime, PG_UUID

class ParkingSession(db.Model):
    __tablename__ = 'parking_sessions'
    
    session_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    
    # Link to vehicle entry and exit records
    entry_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('vehicle_entries.entry_id'), nullable=False)
    exit_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('vehicle_exits.exit_id'), nullable=True)
    
    # Link to parking slot and lot
    slot_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('parking_slots.slot_id'), nullable=False)
    lot_id = db.Column(db.String(50), db.ForeignKey('parking_lots.lot_id'), nullable=False)
    
    # Link to customer
    customer_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('parking_customers.customer_id'), nullable=False)
    plate_number = db.Column(db.String(20), db.ForeignKey('parking_customers.plate_number'), nullable=False)
    
    # Session timing
    start_time = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    
    # Additional fields you might want
    duration_minutes = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), default='active')  # 'active', 'completed', 'cancelled'
    
    # Relationships
    entry = db.relationship('VehicleEntry', foreign_keys=[entry_id], backref='parking_session')
    exit = db.relationship('VehicleExit', foreign_keys=[exit_id], backref='parking_session')
    slot = db.relationship('ParkingSlot', foreign_keys=[slot_id], backref='sessions')
    lot = db.relationship('ParkingLot', foreign_keys=[lot_id], backref='sessions')
    customer = db.relationship('ParkingCustomer', foreign_keys=[customer_id], backref='sessions')
    
    def __repr__(self):
        return f'<ParkingSession {self.plate_number} at slot {self.slot.slot_number}>'