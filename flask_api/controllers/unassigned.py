from flask import Blueprint, jsonify,Response, stream_with_context
from models.vehicle_entry import VehicleEntry
from models.parking_lot import ParkingLot
from sqlalchemy import not_, or_
from datetime import datetime
import json
import time

# Create a blueprint for the API
vehicle_bp = Blueprint('api', __name__)

@vehicle_bp.route('/api/unassigned-vehicles', methods=['GET'])
def stream_unassigned_vehicles():
    def event_stream():
        while True:
            try:
                # Get unassigned vehicles
                unassigned_vehicles = VehicleEntry.query.filter_by(status="unassigned").all()
                
                # Format the data
                vehicles_data = []
                for vehicle in unassigned_vehicles:
                    entry_time = vehicle.entry_time.strftime('%H:%M')
                    entry_date = vehicle.entry_time.strftime('%Y-%m-%d')
                    
                    vehicles_data.append({
                        'id': str(vehicle.entry_id),
                        'image': vehicle.image_url or '/default-vehicle.png',
                        'time': entry_time,
                        'type': vehicle.vehicle_type,
                        'plate': vehicle.plate_number,
                        'color': vehicle.hex_color,
                        'date': entry_date,
                        'created_at': vehicle.created_at.isoformat()
                    })
                
                # Send the data as a server-sent event
                yield f"data: {json.dumps({'success': True, 'data': vehicles_data})}\n\n"
                
                # Wait before sending the next update
                time.sleep(2)
            except Exception as e:
                print(f"Error in event stream: {str(e)}")
                yield f"data: {json.dumps({'success': False, 'error': str(e)})}\n\n"
                time.sleep(5)
    
    return Response(stream_with_context(event_stream()), 
                    mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache',
                             'Access-Control-Allow-Origin': '*'})