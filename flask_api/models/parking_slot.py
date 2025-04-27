from models.base import db, generate_uuid, datetime, PG_UUID

class ParkingSlot(db.Model):
    __tablename__ = 'parking_slots'
    slot_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    slot_number = db.Column(db.Integer, nullable=False)
    section = db.Column(db.String(50), nullable=False)  # 'top', 'left', 'center', 'right', etc.
    vehicle_type = db.Column(db.String(20), nullable=False)  # 'car', 'motorcycle', 'bicycle'
    status = db.Column(db.String(20), default='available')  # 'available', 'occupied', 'reserved'
    is_active = db.Column(db.Boolean, default=True)  # In case you need to disable slots
    
    # Foreign key to the current vehicle occupying this slot (if any)
    current_vehicle_id = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('vehicle_entries.entry_id'), nullable=True)
    
    # If this is a reserved slot, who is it reserved for
    reserved_for = db.Column(PG_UUID(as_uuid=True), db.ForeignKey('parking_customers.customer_id'), nullable=True)
    
    # For area-specific identification
    # In ParkingSlot model:
    lot_id = db.Column(db.String(50), db.ForeignKey('parking_lots.lot_id'), nullable=False) # 'PE1_Car', 'PE2_Bike', 'Elevated_MCP'
    
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    current_vehicle = db.relationship('VehicleEntry', foreign_keys=[current_vehicle_id], backref='assigned_slot', lazy=True)
    reserved_customer = db.relationship('ParkingCustomer', foreign_keys=[reserved_for], backref='reserved_slots', lazy=True)
    
    def __repr__(self):
        return f'<ParkingSlot {self.slot_number} ({self.section}) - {self.status}>'