from models.base import db, generate_uuid, datetime, PG_UUID

class ParkingCustomer(db.Model):
    __tablename__ = 'parking_customers'
   
    
    customer_id = db.Column(PG_UUID(as_uuid=True), primary_key=True, default=generate_uuid)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    plate_number = db.Column(db.String(20), unique=True, nullable=False)
    color = db.Column(db.String(50))
    vehicle_type = db.Column(db.String(50))
    contact_num = db.Column(db.String(50))
    is_registered = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    entries = db.relationship('VehicleEntry', backref='customer', lazy=True, foreign_keys='VehicleEntry.customer_id')
    exits = db.relationship('VehicleExit', backref='customer', lazy=True, foreign_keys='VehicleExit.customer_id')
    entries_by_plate = db.relationship('VehicleEntry', lazy=True, foreign_keys='VehicleEntry.plate_number', viewonly=True)
    exits_by_plate = db.relationship('VehicleExit', lazy=True, foreign_keys='VehicleExit.plate_number', viewonly=True)
    
    def __repr__(self):
        return f'<Customer {self.first_name} {self.last_name} ({self.plate_number})>'