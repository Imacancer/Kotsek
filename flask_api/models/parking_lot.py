from models.base import db, datetime
from models.parking_slot import ParkingSlot

class ParkingLot(db.Model):
    __tablename__ = 'parking_lots'
    lot_id = db.Column(db.String(50), primary_key=True)  # 'PE1_Car', 'PE2_Bike', 'Elevated_MCP', etc.
    name = db.Column(db.String(100), nullable=False)
    total_capacity = db.Column(db.Integer, nullable=False)
    vehicle_type = db.Column(db.String(20), nullable=False)  # 'car', 'motorcycle', 'bicycle'
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    slots = db.relationship('ParkingSlot', backref='lot', lazy=True)
    
    def occupied_count(self):
        from sqlalchemy import func
        return db.session.query(func.count(ParkingSlot.slot_id))\
            .filter(ParkingSlot.lot_id == self.lot_id, ParkingSlot.status == 'occupied').scalar()
    
    def reserved_count(self):
        from sqlalchemy import func
        return db.session.query(func.count(ParkingSlot.slot_id))\
            .filter(ParkingSlot.lot_id == self.lot_id, ParkingSlot.status == 'reserved').scalar()
    
    def available_count(self):
        from sqlalchemy import func
        return db.session.query(func.count(ParkingSlot.slot_id))\
            .filter(ParkingSlot.lot_id == self.lot_id, ParkingSlot.status == 'available').scalar()
    
    def __repr__(self):
        return f'<ParkingLot {self.name}>'