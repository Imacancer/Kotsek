from flask import Blueprint, request, jsonify
from models.vehicle_entry import VehicleEntry
from models.vehicle_exit import VehicleExit
from models.parking_lot import ParkingLot
from sqlalchemy import func
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from flask_jwt_extended import jwt_required
from controllers.admin import admin_required, role_required
import traceback
from models.parking_session import ParkingSession
from db.db import db  # Import the db instance from db.py instead of creating a new one
from models.parking_slot import ParkingSlot

regression_bp = Blueprint('regression', __name__)

def get_time_series_data(start_date, end_date, lot_id=None):
    """Get time series data for vehicle entries and exits"""
    try:
        # Get first day of current month
        current_date = datetime.now()
        start_date = current_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = current_date

        # Simple query for entries
        entries_query = db.session.query(
            func.date_trunc('hour', VehicleEntry.entry_time).label('timestamp'),
            func.count().label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        )
        
        # Simple query for exits
        exits_query = db.session.query(
            func.date_trunc('hour', VehicleExit.exit_time).label('timestamp'),
            func.count().label('count')
        ).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time <= end_date
        )
        
        # Add lot_id filter if provided
        if lot_id:
            entries_query = entries_query.join(
                ParkingSession, 
                VehicleEntry.entry_id == ParkingSession.entry_id
            ).filter(ParkingSession.lot_id == lot_id)
            
            exits_query = exits_query.join(
                ParkingSession, 
                VehicleExit.exit_id == ParkingSession.exit_id
            ).filter(ParkingSession.lot_id == lot_id)

        # Execute queries
        entries = entries_query.group_by('timestamp').all()
        exits = exits_query.group_by('timestamp').all()

        # Convert to pandas DataFrame
        entries_df = pd.DataFrame(entries, columns=['timestamp', 'count'])
        exits_df = pd.DataFrame(exits, columns=['timestamp', 'count'])
        
        return entries_df, exits_df

    except Exception as e:
        print(f"Error in get_time_series_data: {str(e)}")
        print(traceback.format_exc())
        raise
    finally:
        db.session.close()

@regression_bp.route('/traffic/prediction', methods=['GET'])
@jwt_required()
@role_required(['Admin'])
def predict_traffic():
    """Predict traffic patterns based on current month's data"""
    try:
        # Calculate date range (use current month's data)
        end_date = datetime.now()
        start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Get all entries and exits for the current month
        entries_query = db.session.query(
            func.date_trunc('hour', VehicleEntry.entry_time).label('timestamp'),
            func.count().label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        )
        
        exits_query = db.session.query(
            func.date_trunc('hour', VehicleExit.exit_time).label('timestamp'),
            func.count().label('count')
        ).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time <= end_date
        )
        
        # Execute queries
        entries = entries_query.group_by('timestamp').all()
        exits = exits_query.group_by('timestamp').all()

        # Convert to pandas DataFrame
        entries_df = pd.DataFrame(entries, columns=['timestamp', 'count'])
        exits_df = pd.DataFrame(exits, columns=['timestamp', 'count'])
        
        # Create a complete date-hour grid for the current month
        date_range = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Initialize the data structure for the graph
        graph_data = []
        
        # For each date in the current month
        for date in date_range:
            date_str = date.strftime('%Y-%m-%d')
            date_entries = entries_df[entries_df['timestamp'].dt.date == date.date()]
            date_exits = exits_df[exits_df['timestamp'].dt.date == date.date()]
            
            # For each specific hour (00:00, 12:00, 23:59)
            for hour in [0, 12, 23]:
                # Get entries and exits for this specific hour
                hour_entries = date_entries[date_entries['timestamp'].dt.hour == hour]
                hour_exits = date_exits[date_exits['timestamp'].dt.hour == hour]
                
                # Convert numpy/pandas types to Python native types
                entry_count = float(hour_entries['count'].sum()) if not hour_entries.empty else 0
                exit_count = float(hour_exits['count'].sum()) if not hour_exits.empty else 0
                
                graph_data.append({
                    'date': date_str,
                    'hour': int(hour),
                    'entries': round(entry_count, 2),
                    'exits': round(exit_count, 2),
                    'net_change': round(entry_count - exit_count, 2)
                })
        
        return jsonify({
            'prediction_type': 'graph',
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
            'data': graph_data
        }), 200
        
    except Exception as e:
        print(f"Error in predict_traffic: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    finally:
        db.session.close()

def calculate_turnover_rate(lot_id=None):
    """Calculate how quickly spots become available again"""
    try:
        # Get current month's data
        end_date = datetime.now()
        start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Query parking sessions with their duration
        query = db.session.query(
            VehicleEntry.entry_time,
            VehicleExit.exit_time,
            ParkingSession.lot_id
        ).join(
            ParkingSession,
            VehicleEntry.entry_id == ParkingSession.entry_id
        ).join(
            VehicleExit,
            VehicleExit.exit_id == ParkingSession.exit_id
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        )
        
        if lot_id:
            query = query.filter(ParkingSession.lot_id == lot_id)
            
        sessions = query.all()
        
        # Calculate average duration
        total_duration = 0
        count = 0
        for session in sessions:
            if session.exit_time:
                duration = (session.exit_time - session.entry_time).total_seconds() / 3600  # Convert to hours
                total_duration += duration
                count += 1
        
        avg_turnover_time = total_duration / count if count > 0 else 0
        turnover_rate = 24 / avg_turnover_time if avg_turnover_time > 0 else 0  # Spots per day
        
        return {
            "avg_turnover_time_hours": round(avg_turnover_time, 2),
            "turnover_rate_per_day": round(turnover_rate, 2),
            "confidence": round(min(1.0, count / 50), 2)  # Confidence based on sample size
        }
    except Exception as e:
        print(f"Error calculating turnover rate: {str(e)}")
        return None

def predict_visit_frequency(lot_id=None):
    """Predict how often customers will return"""
    try:
        # Get current month's data
        end_date = datetime.now()
        start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Query vehicle entries with their timestamps
        query = db.session.query(
            VehicleEntry.plate_number,
            VehicleEntry.entry_time,
                ParkingSession.lot_id
            ).join(
                ParkingSession,
                VehicleEntry.entry_id == ParkingSession.entry_id
            ).filter(
                VehicleEntry.entry_time >= start_date,
                VehicleEntry.entry_time <= end_date
        )
        
        if lot_id:
            query = query.filter(ParkingSession.lot_id == lot_id)
            
        entries = query.all()
            
        # Group by plate_number and count visits
        vehicle_visits = {}
        for entry in entries:
            if entry.plate_number not in vehicle_visits:
                vehicle_visits[entry.plate_number] = []
            vehicle_visits[entry.plate_number].append(entry.entry_time)
        
        # Calculate average days between visits
        visit_intervals = []
        for visits in vehicle_visits.values():
            if len(visits) > 1:
                visits.sort()
                for i in range(1, len(visits)):
                    interval = (visits[i] - visits[i-1]).total_seconds() / (24 * 3600)  # Convert to days
                    visit_intervals.append(interval)
        
        avg_interval = sum(visit_intervals) / len(visit_intervals) if visit_intervals else 0
        visits_per_month = len(entries) / ((end_date - start_date).days + 1) * 30  # Normalize to 30 days
        
        return {
            "avg_days_between_visits": round(avg_interval, 1),
            "visits_per_month": round(visits_per_month, 1),
            "confidence": round(min(1.0, len(visit_intervals) / 50), 2)
        }
    except Exception as e:
        print(f"Error predicting visit frequency: {str(e)}")
        return None

def predict_availability():
    """Predict available slots in the future"""
    try:
        # Get total spots by counting parking slots
        total_spots_query = db.session.query(func.count(ParkingSlot.slot_id))
        total_spots = total_spots_query.scalar()
        print(f"Total spots: {total_spots}")
        
        # Get current occupied and reserved spots from parking_slots
        current_occupied_query = db.session.query(func.count(ParkingSlot.slot_id)).filter(
            ParkingSlot.status.in_(['occupied', 'reserved'])
        )
        
        current_occupied = current_occupied_query.scalar()
        print(f"Current occupied spots: {current_occupied}")
        
        # Get current month's slot status changes
        end_date = datetime.now()
        start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Count slots that became available in current month
        recent_available_query = db.session.query(func.count(ParkingSlot.slot_id)).filter(
            ParkingSlot.status == 'available',
            ParkingSlot.updated_at >= start_date,
            ParkingSlot.updated_at <= end_date
        )
        
        recent_available = recent_available_query.scalar()
        print(f"Recent available slots: {recent_available}")
        
        # Calculate average availability rate per hour for the current month
        hours_elapsed = (end_date - start_date).total_seconds() / 3600
        availability_rate_per_hour = recent_available / hours_elapsed if hours_elapsed > 0 else 0
        print(f"Availability rate per hour: {availability_rate_per_hour}")
        
        # Calculate occupancy rates for different time intervals
        current_occupancy_rate = (current_occupied / total_spots * 100) if total_spots > 0 else 0
        
        # Predict future occupancy rates
        occupancy_30min = max(0, min(100, current_occupancy_rate - (availability_rate_per_hour * 0.5 / total_spots * 100)))
        occupancy_1hour = max(0, min(100, current_occupancy_rate - (availability_rate_per_hour / total_spots * 100)))
        occupancy_5hours = max(0, min(100, current_occupancy_rate - (availability_rate_per_hour * 5 / total_spots * 100)))
        
        # Predict future availability
        predictions = {
            "30_min": {
                "occupancy_rate": round(occupancy_30min, 1),
                "confidence": 0.9 if total_spots > 0 else 0
            },
            "1_hour": {
                "occupancy_rate": round(occupancy_1hour, 1),
                "confidence": 0.8 if total_spots > 0 else 0
            },
            "5_hours": {
                "occupancy_rate": round(occupancy_5hours, 1),
                "confidence": 0.7 if total_spots > 0 else 0
            }
        }
        
        return predictions
    except Exception as e:
        print(f"Error predicting availability: {str(e)}")
        print(traceback.format_exc())
        return None

def predict_peak_hours():
    """Predict daily peak hours"""
    try:
        # Get current month's data
        end_date = datetime.now()
        start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Query occupied slots grouped by hour
        query = db.session.query(
            func.extract('hour', ParkingSlot.updated_at).label('hour'),
            func.count().label('count')
            ).filter(
            ParkingSlot.status == 'occupied',
            ParkingSlot.updated_at >= start_date,
            ParkingSlot.updated_at <= end_date
        )
            
        hourly_counts = query.group_by('hour').all()
        print(f"Hourly counts: {hourly_counts}")
        
        # Get total spots by counting parking slots
        total_spots_query = db.session.query(func.count(ParkingSlot.slot_id))
        total_spots = total_spots_query.scalar()
        print(f"Total spots for peak hours: {total_spots}")
        
        # Calculate average occupancy per hour
        days_in_month = (end_date - start_date).days + 1
        peak_hours = []
        
        for hour, count in hourly_counts:
            avg_count = count / days_in_month
            occupancy_rate = (avg_count / total_spots) * 100 if total_spots > 0 else 0
            print(f"Hour {hour}: count={count}, avg_count={avg_count}, occupancy_rate={occupancy_rate}%")
            
            if occupancy_rate > 5:  # Lowered threshold to 5% to catch more peak hours
                peak_hours.append({
                    "hour": int(hour),
                    "occupancy_rate": round(occupancy_rate, 1),
                    "confidence": round(min(1.0, count / 50), 2)  # Confidence based on sample size
                })
        
        # Sort by occupancy rate
        peak_hours.sort(key=lambda x: x["occupancy_rate"], reverse=True)
        print(f"Peak hours found: {peak_hours}")
        
        return peak_hours[:3]  # Return top 3 peak hours
    except Exception as e:
        print(f"Error predicting peak hours: {str(e)}")
        print(traceback.format_exc())
        return None

@regression_bp.route('/predictions', methods=['GET'])
@jwt_required()
def get_predictions():
    try:
        print("Getting predictions for all lots")
        
        # Get predictions with error handling
        turnover_rate = calculate_turnover_rate()
        print(f"Turnover rate: {turnover_rate}")
        
        visit_frequency = predict_visit_frequency()
        print(f"Visit frequency: {visit_frequency}")
        
        availability = predict_availability()
        print(f"Availability: {availability}")
        
        peak_hours = predict_peak_hours()
        print(f"Peak hours: {peak_hours}")
        
        # Ensure we have valid data
        if not turnover_rate:
            turnover_rate = {
                "avg_turnover_time_hours": 0,
                "turnover_rate_per_day": 0,
                "confidence": 0
            }
        
        if not visit_frequency:
            visit_frequency = {
                "avg_days_between_visits": 0,
                "visits_per_month": 0,
                "confidence": 0
            }
        
        if not availability:
            availability = {
                "30_min": {"occupancy_rate": 0, "confidence": 0},
                "1_hour": {"occupancy_rate": 0, "confidence": 0},
                "5_hours": {"occupancy_rate": 0, "confidence": 0}
                }
        
        if not peak_hours:
            peak_hours = []
            
            return jsonify({
            "turnover_rate": turnover_rate,
            "visit_frequency": visit_frequency,
            "availability": availability,
            "peak_hours": peak_hours
        })
    except Exception as e:
        print(f"Error in get_predictions: {str(e)}")
        print(traceback.format_exc())
        return jsonify({
            "error": "Failed to generate predictions",
            "details": str(e)
        }), 500
    finally:
        db.session.close() 