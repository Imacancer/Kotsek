# parking_routes.py
from flask import Blueprint, request, jsonify
from models.base import db
from models.vehicle_entry import VehicleEntry
from models.parking_slot import ParkingSlot
from models.parking_lot import ParkingLot
from models.parking_session import ParkingSession
from models.customer import ParkingCustomer
from uuid import UUID
from datetime import datetime

parking_bp = Blueprint('parking', __name__)

@parking_bp.route('/parking/assign-slot', methods=['POST'])
def assign_parking_slot():
    data = request.json
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Required parameters
    slot_id = data.get('slot_id')  
    slot_section = data.get('slot_section')
    entry_id = data.get('entry_id')
    lot_id = data.get('lot_id')
    slot_number = data.get('slot_number') 
    
    try:
        # Check if vehicle entry exists and is unassigned
        vehicle_entry = VehicleEntry.query.filter_by(entry_id=entry_id, status='unassigned').first()
        if not vehicle_entry:
            return jsonify({"error": "Unassigned vehicle entry not found"}), 404
        
        # Find the specific parking slot
        parking_slot = ParkingSlot.query.filter_by(
            slot_number=slot_id,
            section=slot_section,
            lot_id=lot_id
        ).first()
        
        if not parking_slot:
            return jsonify({"error": "Parking slot not found"}), 404
            
        # Check if slot is available
        if parking_slot.status != 'available':
            return jsonify({"error": f"Parking slot is not available (current status: {parking_slot.status})"}), 409
            
        # Update parking slot
        parking_slot.status = 'occupied'
        parking_slot.current_vehicle_id = vehicle_entry.entry_id
        parking_slot.updated_at = datetime.utcnow()
        
        # Update vehicle entry
        vehicle_entry.status = 'assigned'
        
        # Create new parking session
        new_session = ParkingSession(
            entry_id=vehicle_entry.entry_id,
            slot_id=parking_slot.slot_id,
            lot_id=lot_id,
            customer_id=vehicle_entry.customer_id,
            plate_number=vehicle_entry.plate_number,
            start_time=datetime.utcnow(),
            status='active'
        )
        
        db.session.add(new_session)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": f"Vehicle assigned to slot {slot_section}-{slot_id}",
            "data": {
                "slot_id": str(parking_slot.slot_id),
                "slot_number": parking_slot.slot_number,
                "section": parking_slot.section,
                "status": parking_slot.status,
                "entry_id": str(vehicle_entry.entry_id),
                "plate_number": vehicle_entry.plate_number,
                "lot_id": parking_slot.lot_id,
                "session_id": str(new_session.session_id)
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@parking_bp.route('/parking/release-slot', methods=['POST'])
def release_parking_slot():
    print("🔔 [DEBUG] Entered release_parking_slot endpoint")
    data = request.json
    print("📦 [DEBUG] Incoming request data:", data)
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    slot_id = data.get('id')
    section = data.get('section')
    slot_number = data.get('slot_number')
    exit_id = data.get('exit_id')
    print(f"📍 [DEBUG] slot_id: {slot_id}, section: {section}, slot_number: {slot_number}, exit_id: {exit_id}")
    try:
        parking_slot = None

        # ✅ Try finding by UUID if valid
        if slot_id:
            try:
                uuid_obj = UUID(slot_id)
                parking_slot = ParkingSlot.query.get(uuid_obj)
            except (ValueError, TypeError):
                pass  # Not a valid UUID, will fall back

        # ✅ Fallback: Try finding by section and slot_number
        if not parking_slot and section and slot_number:
            try:
                parking_slot = ParkingSlot.query.filter_by(
                    section=section,
                    slot_number=int(slot_number)
                ).first()
            except Exception as e:
                return jsonify({"error": f"Invalid slot_number: {e}"}), 400

        if not parking_slot:
            return jsonify({"error": "Parking slot not found"}), 404
            
        if parking_slot.status != 'occupied':
            return jsonify({
                "error": f"Parking slot is not occupied (current status: {parking_slot.status})"
            }), 409

        # ✅ Get vehicle entry
        vehicle_entry = VehicleEntry.query.filter_by(entry_id=parking_slot.current_vehicle_id).first()

        # ✅ Get and complete active session
        active_session = ParkingSession.query.filter_by(
            slot_id=parking_slot.slot_id,
            status='active'
        ).order_by(ParkingSession.start_time.desc()).first()

        if active_session:
            active_session.end_time = datetime.utcnow()
            active_session.status = 'completed'

            # ✅ Duration in minutes
            if active_session.start_time:
                duration = active_session.end_time - active_session.start_time
                active_session.duration_minutes = int(duration.total_seconds() // 60)

            if exit_id:
                active_session.exit_id = exit_id

        # ✅ Update parking slot
        parking_slot.status = 'available'
        parking_slot.current_vehicle_id = None  # Will be NULL in DB
        parking_slot.updated_at = datetime.utcnow()

        # ✅ Update vehicle
        if vehicle_entry:
            vehicle_entry.status = 'exited'

        db.session.commit()

        response_data = {
            "success": True,
            "message": f"Slot {parking_slot.section}-{parking_slot.slot_number} released",
            "data": {
                "slot_id": str(parking_slot.slot_id),
                "slot_number": parking_slot.slot_number,
                "section": parking_slot.section,
                "status": parking_slot.status,
                "lot_id": parking_slot.lot_id
            }
        }

        if active_session:
            response_data["data"]["session"] = {
                "session_id": str(active_session.session_id),
                "plate_number": active_session.plate_number,
                "duration_minutes": active_session.duration_minutes
            }

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@parking_bp.route('/parking/get-parking-status', methods=['GET'])
def get_slots_by_vehicle_type():
    try:
        # Get optional filter parameter
        vehicle_type = request.args.get('vehicle_type')
        lot_id = request.args.get('lot_id')
        
        # Base query
        query = db.session.query(
            ParkingSlot, 
            VehicleEntry.plate_number
        ).outerjoin(
            VehicleEntry, 
            ParkingSlot.current_vehicle_id == VehicleEntry.entry_id
        )
        
        # Apply filters if provided
        if vehicle_type:
            query = query.filter(ParkingSlot.vehicle_type == vehicle_type)
        if lot_id:
            query = query.filter(ParkingSlot.lot_id == lot_id)
            
        # Execute query
        results = query.all()
        
        # Initialize data structure
        response_data = {
            "car": {
                "left": [],
                "right": [],
                "center": [],
                "top": []
            },
            "motorcycle": [],
            "bicycle": []
        }
        
        # Process query results
        for slot, plate_number in results:
            slot_data = {
                "id": str(slot.slot_id),
                "slot_number": slot.slot_number,
                "lot_id": slot.lot_id,
                "status": slot.status,
                "plate_number": plate_number
            }
            
            if slot.vehicle_type == 'car':
                # For cars, organize by section
                if slot.section in response_data["car"]:
                    response_data["car"][slot.section].append(slot_data)
            elif slot.vehicle_type == 'motorcycle':
                # For motorcycles, add to flat list without sections
                response_data["motorcycle"].append(slot_data)
            elif slot.vehicle_type == 'bicycle':
                # For bicycles, add to flat list without sections
                slot_data["section"] = slot.section
                response_data["bicycle"].append(slot_data)
        
        # Get statistics for each vehicle type
        stats = {}
        
        # Car statistics - aggregate across all car lots
        car_lots = ParkingLot.query.filter_by(vehicle_type='car').all()
        stats["car"] = {
            "total": sum(lot.total_capacity for lot in car_lots),
            "occupied": sum(lot.occupied_count() for lot in car_lots),
            "reserved": sum(lot.reserved_count() for lot in car_lots),
            "available": sum(lot.available_count() for lot in car_lots)
        }
        
        # Motorcycle statistics
        motorcycle_lots = ParkingLot.query.filter_by(vehicle_type='motorcycle').all()
        stats["motorcycle"] = {
            "total": sum(lot.total_capacity for lot in motorcycle_lots),
            "occupied": sum(lot.occupied_count() for lot in motorcycle_lots),
            "reserved": sum(lot.reserved_count() for lot in motorcycle_lots),
            "available": sum(lot.available_count() for lot in motorcycle_lots)
        }
        
        # Bicycle statistics
        bicycle_lots = ParkingLot.query.filter_by(vehicle_type='bicycle').all()
        stats["bicycle"] = {
            "total": sum(lot.total_capacity for lot in bicycle_lots),
            "occupied": sum(lot.occupied_count() for lot in bicycle_lots),
            "reserved": sum(lot.reserved_count() for lot in bicycle_lots),
            "available": sum(lot.available_count() for lot in bicycle_lots)
        }
        
        # Add capacity status for each vehicle type
        for vehicle_type in stats:
            if stats[vehicle_type]["total"] > 0:
                occupied_ratio = stats[vehicle_type]["occupied"] / stats[vehicle_type]["total"]
                stats[vehicle_type]["capacity_status"] = "High" if occupied_ratio > 0.8 else \
                                                         "Medium" if occupied_ratio > 0.5 else "Low"
            else:
                stats[vehicle_type]["capacity_status"] = "N/A"
        
        return jsonify({
            "success": True,
            "data": {
                "slots": response_data,
                "stats": stats
            }
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@parking_bp.route('/parking/history', methods=['GET'])
def get_parking_history():
    try:
        # Filter parameters
        slot_id = request.args.get('slot_id')
        lot_id = request.args.get('lot_id')
        plate_number = request.args.get('plate_number')
        customer_id = request.args.get('customer_id')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Base query
        query = db.session.query(ParkingSession)
        
        # Apply filters
        if slot_id:
            query = query.filter(ParkingSession.slot_id == slot_id)
        if lot_id:
            query = query.filter(ParkingSession.lot_id == lot_id)
        if plate_number:
            query = query.filter(ParkingSession.plate_number == plate_number)
        if customer_id:
            query = query.filter(ParkingSession.customer_id == customer_id)
        if start_date:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(ParkingSession.start_time >= start_datetime)
        if end_date:
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            query = query.filter(ParkingSession.start_time <= end_datetime)
            
        # Execute query and limit results
        sessions = query.order_by(ParkingSession.start_time.desc()).limit(100).all()
        
        # Format results
        results = []
        for session in sessions:
            slot = ParkingSlot.query.get(session.slot_id)
            customer = ParkingCustomer.query.get(session.customer_id)
            
            results.append({
                "session_id": str(session.session_id),
                "plate_number": session.plate_number,
                "customer_name": f"{customer.first_name} {customer.last_name}" if customer else "Unknown",
                "slot_info": f"{slot.section}-{slot.slot_number}" if slot else "Unknown",
                "lot_id": session.lot_id,
                "start_time": session.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                "end_time": session.end_time.strftime('%Y-%m-%d %H:%M:%S') if session.end_time else None,
                "duration_minutes": session.duration_minutes,
                "status": session.status
            })
        
        return jsonify({
            "success": True,
            "count": len(results),
            "data": results
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500