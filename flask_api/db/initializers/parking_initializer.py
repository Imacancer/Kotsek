# db/initializers/parking_initializer.py
from models.parking_slot import ParkingSlot
from models.parking_lot import ParkingLot
from db.db import db
from datetime import datetime

def initialize_parking_slots():
    """Initialize parking slots and lots in the database if they don't already exist."""
    # Check if slots already exist
    if ParkingSlot.query.count() > 0:
        print("Parking slots already initialized")
        return
    
    # Initialize car slots
    sections = {
        'top': 13,     # For slots 1-13
        'left': 13,    # For slots on the left
        'right': 9,    # For slots on the right
        'center': 28   # For center slots
    }
    
    for section, count in sections.items():
        for i in range(1, count + 1):
            db.session.add(ParkingSlot(
                slot_number=i,
                section=section,
                vehicle_type='car',
                status='available',
                lot_id='PE1_Car' if section != 'center' else 'PE1_Car_Center'
            ))
    
    # Initialize bike areas
    bike_areas = [
        {'name': 'Bike Area Left', 'lot_id': 'PE1_Bike', 'capacity': 14},
        {'name': 'Bike Area Right', 'lot_id': 'PE2_Bike', 'capacity': 14}
    ]
    
    for area in bike_areas:
        # Add to parking_lots table
        db.session.add(ParkingLot(
            lot_id=area['lot_id'],
            name=area['name'],
            total_capacity=area['capacity'],
            vehicle_type='bicycle'
        ))
    
    # Initialize motorcycle area
    db.session.add(ParkingLot(
        lot_id='Elevated_MCP',
        name='Motor Parking Lot',
        total_capacity=30,
        vehicle_type='motorcycle'
    ))
    
    db.session.commit()
    print("Parking slots initialized successfully")