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
    """
    Releases a parking slot, making it available.
    Can be used for occupied slots (vehicle exiting) or reserved slots (cancelling reservation).
    """
    print("🔔 [DEBUG] Entered release_parking_slot endpoint")
    data = request.json
    print("📦 [DEBUG] Incoming request data:", data)

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Identify the slot - prefer UUID, fallback to section/slot_number
    slot_uuid = data.get('id')
    section = data.get('section')
    slot_number = data.get('slot_number')
    # exit_id is used when a vehicle is exiting, not just cancelling a reservation
    exit_id = data.get('exit_id')

    print(f"📍 [DEBUG] slot_uuid: {slot_uuid}, section: {section}, slot_number: {slot_number}, exit_id: {exit_id}")

    try:
        parking_slot = None

        # ✅ Try finding by UUID if valid
        if slot_uuid:
            try:
                uuid_obj = UUID(slot_uuid)
                parking_slot = ParkingSlot.query.get(uuid_obj)
            except (ValueError, TypeError):
                pass  # Not a valid UUID, will fall back

        # ✅ Fallback: Try finding by section and slot_number if UUID not found or invalid
        if not parking_slot and section and slot_number is not None: # Check for None explicitly
            try:
                parking_slot = ParkingSlot.query.filter_by(
                    section=section,
                    slot_number=int(slot_number)
                ).first()
            except ValueError:
                return jsonify({"error": "Invalid slot_number format"}), 400
            except Exception as e:
                # Catch other potential errors during fallback lookup
                return jsonify({"error": f"Error during fallback slot lookup: {e}"}), 500


        if not parking_slot:
            return jsonify({"error": "Parking slot not found"}), 404

        # --- Handle different statuses ---

        # If slot is occupied, process vehicle exit and session completion
        if parking_slot.status == 'occupied':
            print(f"Releasing occupied slot {parking_slot.section}-{parking_slot.slot_number}")
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

            # ✅ Update parking slot status
            parking_slot.status = 'available'
            parking_slot.current_vehicle_id = None  # Will be NULL in DB
            parking_slot.reserved_for = None # Ensure reserved_for is also cleared on exit
            parking_slot.updated_at = datetime.utcnow()

            # ✅ Update vehicle entry status
            if vehicle_entry:
                vehicle_entry.status = 'exited'

            message = f"Slot {parking_slot.section}-{parking_slot.slot_number} released (vehicle exited)"

        # If slot is reserved, cancel the reservation
        elif parking_slot.status == 'reserved':
            print(f"Cancelling reservation for slot {parking_slot.section}-{parking_slot.slot_number}")
            parking_slot.status = 'available'
            parking_slot.reserved_for = None # Explicitly set to NULL
            parking_slot.current_vehicle_id = None # Ensure current_vehicle_id is also None
            parking_slot.updated_at = datetime.utcnow()
            message = f"Reservation cancelled for slot {parking_slot.section}-{parking_slot.slot_number}"

        # If slot is already available, nothing to do (maybe return a different status or message)
        elif parking_slot.status == 'available':
            print(f"Slot {parking_slot.section}-{parking_slot.slot_number} is already available.")
            message = f"Slot {parking_slot.section}-{parking_slot.slot_number} is already available."
            # You might choose to return 200 with a message or 409/400 depending on desired behavior
            return jsonify({
                "success": True, # Or False, depending on if you consider this an error
                "message": message,
                "data": {
                    "slot_id": str(parking_slot.slot_id),
                    "slot_number": parking_slot.slot_number,
                    "section": parking_slot.section,
                    "status": parking_slot.status,
                    "lot_id": parking_slot.lot_id
                }
            }), 200 # Return 200 as the desired state (available) is achieved


        else:
            # Handle other unexpected statuses if necessary
            return jsonify({"error": f"Cannot release slot with status: {parking_slot.status}"}), 400


        # Commit changes if we reached a state where commit is needed (occupied or reserved)
        if parking_slot.status in ['available']: # Commit if the status became available
            db.session.commit()
            print("Database committed.")


        response_data = {
            "success": True,
            "message": message,
            "data": {
                "slot_id": str(parking_slot.slot_id),
                "slot_number": parking_slot.slot_number,
                "section": parking_slot.section,
                "status": parking_slot.status,
                "lot_id": parking_slot.lot_id,
                "reserved_for_customer_id": str(parking_slot.reserved_for) if parking_slot.reserved_for else None,
                "current_vehicle_id": str(parking_slot.current_vehicle_id) if parking_slot.current_vehicle_id else None,
            }
        }

        # Include session data if a session was completed (only for occupied release)
        if 'active_session' in locals() and active_session and active_session.status == 'completed':
            response_data["data"]["session"] = {
                "session_id": str(active_session.session_id),
                "plate_number": active_session.plate_number,
                "duration_minutes": active_session.duration_minutes
            }


        print("Responding with:", response_data)
        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"Error during slot release: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Server error releasing slot: {str(e)}"}), 500

@parking_bp.route('/parking/get-parking-status', methods=['GET'])
def get_slots_by_vehicle_type():
    """
    Fetches the current status of all parking slots,
    including reserved customer details for reserved slots.
    """
    print("Attempting to fetch parking status...")
    try:
        # Base query to get all slots
        query = db.session.query(ParkingSlot)

        # Execute query
        all_slots = query.all()

        # Fetch all registered customers to easily look up reserved customer details
        # This avoids N+1 queries if many slots are reserved
        all_customers = ParkingCustomer.query.filter_by(is_registered=True).all()
        customer_lookup = {str(c.customer_id): c for c in all_customers}


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
        for slot in all_slots:
            slot_data = {
                "id": str(slot.slot_id),
                "slot_number": slot.slot_number,
                "lot_id": slot.lot_id,
                "section": slot.section, # Ensure section is included
                "status": slot.status,
                "current_vehicle_id": str(slot.current_vehicle_id) if slot.current_vehicle_id else None,
                "reserved_for": str(slot.reserved_for) if slot.reserved_for else None, # Include reserved_for UUID
                "plate_number": None, # Will be populated for occupied slots
                "reserved_customer_name": None, # Will be populated for reserved slots
                "reserved_plate_number": None, # Will be populated for reserved slots
            }

            # If occupied, fetch plate number from VehicleEntry
            if slot.status == 'occupied' and slot.current_vehicle_id:
                vehicle_entry = VehicleEntry.query.filter_by(entry_id=slot.current_vehicle_id).first()
                if vehicle_entry:
                    slot_data["plate_number"] = vehicle_entry.plate_number

            # If reserved, fetch customer details
            if slot.status == 'reserved' and slot.reserved_for:
                reserved_customer = customer_lookup.get(str(slot.reserved_for))
                if reserved_customer:
                    # Format display name and include plate number
                    display_name = f"{reserved_customer.first_name or ''} {reserved_customer.last_name or ''}".strip()
                    slot_data["reserved_customer_name"] = display_name if display_name else "Unnamed Customer"
                    slot_data["reserved_plate_number"] = reserved_customer.plate_number


            # Categorize slots
            if slot.vehicle_type == 'car':
                # For cars, organize by section
                if slot.section in response_data["car"]:
                    response_data["car"][slot.section].append(slot_data)
            elif slot.vehicle_type == 'motorcycle':
                # For motorcycles, add to flat list
                response_data["motorcycle"].append(slot_data)
            elif slot.vehicle_type == 'bicycle':
                # For bicycles, add to flat list
                response_data["bicycle"].append(slot_data)

        # Note: Calculating stats here might be less efficient if you have many lots.
        # Consider moving stat calculation to a separate endpoint or a more optimized query if performance is an issue.
        # For now, keeping the existing stat calculation logic as is, assuming it's functional.
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


        print("Successfully fetched and formatted parking status.")

        return jsonify({
            "success": True,
            "data": {
                "slots": response_data,
                "stats": stats
            }
        }), 200

    except Exception as e:
        import traceback
        print(f"Error fetching parking status: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Server error fetching parking status: {str(e)}"}), 500
    

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
    

# parking_routes.py (Add this function to your existing file)

@parking_bp.route('/parking/reserve-slot', methods=['POST'])
def reserve_parking_slot():
    """
    Reserves a parking slot for a registered customer.
    Allows reserving available or already reserved slots.
    """
    print("🔔 [DEBUG] Entered reserve_parking_slot endpoint")
    data = request.json
    print("📦 [DEBUG] Incoming request data:", data)

    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Required parameters
    # Required parameters
    # Expecting slot_number, slot_section, customer_id, and lot_id from frontend
    slot_number_str = data.get('slot_number') # Get slot_number as string
    slot_section = data.get('slot_section')
    customer_id = data.get('customer_id') # Can be customer UUID string or "" for "None"
    lot_id = data.get('lot_id')

    # Validate essential parameters (slot_number, section, lot_id must be present)
    if not all([slot_number_str, slot_section, lot_id is not None]): # Check lot_id is not None
        print(f"Missing parameters: slot_number={slot_number_str}, slot_section={slot_section}, lot_id={lot_id}")
        return jsonify({"error": "Missing required parameters (slot_number, slot_section, lot_id)"}), 400

    # Convert slot_number to integer
    try:
        slot_number = int(slot_number_str)
    except ValueError:
        print(f"Invalid slot_number format: {slot_number_str}")
        return jsonify({"error": "Invalid slot_number format"}), 400
    # Handle the "None" option for customer_id (sent as "")
    is_cancelling_reservation = (customer_id == "")

    # Find the parking slot by lot_id, section, and slot_number
    try:
        # Find the parking slot by lot_id, section, and slot_number (integer)
        parking_slot = ParkingSlot.query.filter_by(
            lot_id=lot_id,
            section=slot_section,
            slot_number=slot_number # Use the converted integer slot_number
        ).first()
    except ValueError:
        return jsonify({"error": "Invalid slot_number format"}), 400


    if not parking_slot:
        return jsonify({"error": "Parking slot not found"}), 404

    # --- Status Checks ---
    # If cancelling reservation, slot must be reserved
    if is_cancelling_reservation:
        if parking_slot.status != 'reserved':
            return jsonify({
                "error": f"Slot is not reserved (current status: {parking_slot.status}). Cannot cancel reservation."
            }), 409
    # If reserving, slot must be available or already reserved
    else: # customer_id is provided (not "")
        if parking_slot.status == 'occupied':
            return jsonify({
                "error": f"Parking slot is currently occupied. Cannot reserve."
            }), 409
        # If status is 'reserved', and it's for a different customer, that's allowed
        # If status is 'reserved' for the same customer, no change is needed, but we'll proceed and update anyway.


    # --- Customer Handling (if not cancelling) ---
    customer = None
    if not is_cancelling_reservation:
        try:
            customer_uuid = UUID(customer_id)
            customer = ParkingCustomer.query.get(customer_uuid)
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid customer ID format"}), 400

        if not customer:
            return jsonify({"error": "Registered customer not found"}), 404

    # --- Update Parking Slot ---
    try:
        if is_cancelling_reservation:
            print(f"Cancelling reservation for slot {slot_section}-{slot_number} in {lot_id}")
            parking_slot.status = 'available'
            parking_slot.reserved_for = None # Explicitly set to NULL
            message = f"Reservation cancelled for slot {slot_section}-{slot_number}"
        else:
            print(f"Reserving slot {slot_section}-{slot_number} in {lot_id} for customer {customer_id}")
            parking_slot.status = 'reserved'
            parking_slot.reserved_for = customer.customer_id # Link to the customer UUID
            message = f"Slot {slot_section}-{slot_number} reserved for {customer.first_name} {customer.last_name}"

        # Ensure current_vehicle_id is always None for reserved/available slots
        parking_slot.current_vehicle_id = None
        parking_slot.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            "success": True,
            "message": message,
            "data": {
                "slot_id": str(parking_slot.slot_id),
                "slot_number": parking_slot.slot_number,
                "section": parking_slot.section,
                "status": parking_slot.status,
                "lot_id": parking_slot.lot_id,
                "reserved_for_customer_id": str(parking_slot.reserved_for) if parking_slot.reserved_for else None,
                # Include reserved customer name/plate in response if reserved
                "reserved_customer_name": f"{customer.first_name} {customer.last_name}".strip() if customer else None,
                "reserved_plate_number": customer.plate_number if customer else None,
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        # Log the error for debugging on the server side
        import traceback
        print(f"Error during slot reservation/release: {e}")
        traceback.print_exc()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@parking_bp.route('/customer/registered-customers', methods=['GET']) # Using parking_bp based on your example
def get_registered_customers():
    """
    Fetches a list of registered parking customers.
    Filters for customers where is_registered is True.
    Returns data formatted for the frontend User interface,
    excluding the 'email' field as it's not in the ParkingCustomer model.
    """
    print("Attempting to fetch registered customers...") # Added debug print

    try:
        # Query the database for all registered customers
        # Assuming your ParkingCustomer model has an 'is_registered' column
        # Add a check for the column existence if necessary, though SQLAlchemy should handle it
        registered_customers = ParkingCustomer.query.filter_by(is_registered=True).all()

        print(f"Found {len(registered_customers)} registered customers.") # Added debug print

        # Format the data to match the frontend User interface
        customers_data = []
        for customer in registered_customers:
            # Ensure attributes are not None before accessing or use default values
            customer_id_str = str(customer.customer_id) if customer.customer_id else "N/A"
            # Removed customer_email as it's not in the model
            customer_first_name = customer.first_name if customer.first_name is not None else ""
            customer_last_name = customer.last_name if customer.last_name is not None else ""
            customer_plate_number = customer.plate_number if customer.plate_number is not None else "N/A" # Include plate number


            # Create a display name: prioritize first/last name
            display_name = f"{customer_first_name} {customer_last_name}".strip()
            # If no name, maybe use plate number as a fallback, but the request was name + plate
            if not display_name:
                display_name = "Unnamed Customer" # Fallback if no first/last name


            # Format for the dropdown: "Name - Plate Number"
            dropdown_display = f"{display_name} - {customer_plate_number}"


            customers_data.append({
                # Map backend customer_id (UUID) to frontend id (string)
                "id": customer_id_str, # Ensure ID is always a string
                # Removed "email": customer_email,
                "username": display_name, # Use the generated display name (without email fallback)
                "profile_image": None, # Assuming no profile image in your model
                "first_name": customer_first_name, # Include first_name
                "last_name": customer_last_name,   # Include last_name
                "plate_number": customer_plate_number, # Include plate number
                "display_name_with_plate": dropdown_display # Add the formatted string for dropdown
            })

        print("Successfully formatted customer data.") # Added debug print

        return jsonify({
            "success": True,
            "count": len(customers_data),
            "data": customers_data
        }), 200

    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching registered customers: {e}")
        traceback.print_exc() # Print traceback for detailed error info
        return jsonify({
            "success": False,
            "error": "An error occurred while fetching registered customers.",
            "details": str(e) # Include error details in response for debugging
        }), 500


