from flask import Blueprint, jsonify, request
from sqlalchemy import func, extract, desc, and_, text
from datetime import datetime, timedelta
import calendar
from models.base import db
from models.vehicle_entry import VehicleEntry
from models.vehicle_exit import VehicleExit
from models.parking_session import ParkingSession
from models.customer import ParkingCustomer
from models.parking_slot import ParkingSlot
from models.parking_lot import ParkingLot

analytics_bp = Blueprint('analytics', __name__)

# Helper function to get date range for different time periods
def get_date_range(time_period):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    if time_period == 'day':
        start_date = today
        end_date = today + timedelta(days=1)
    elif time_period == 'week':
        # Get the start of the current week (Monday)
        start_date = today - timedelta(days=today.weekday())
        end_date = start_date + timedelta(days=7)
    elif time_period == 'month':
        # Get the start of the current month
        start_date = today.replace(day=1)
        # Get the start of the next month
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1)
    else:
        raise ValueError("Invalid time period. Use 'day', 'week', or 'month'")
    
    return start_date, end_date

@analytics_bp.route('/weekly-summary', methods=['GET'])
def weekly_summary():
    """
    Generate a comprehensive weekly summary report suitable for PDF export
    Contains parking slot utilization, entrance/exit data, and customer analytics
    
    Query Parameters:
    - start_date: Required start date in YYYY-MM-DD format.
    - end_date: Required end date in YYYY-MM-DD format.
    """
    try:
        # Parse start and end dates from query parameters
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        
        # Validate that both dates are provided
        if not start_date_str or not end_date_str:
            return jsonify({'error': 'Both start_date and end_date are required'}), 400
            
        # Parse the dates
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Please use YYYY-MM-DD'}), 400
        
        # Format dates for display
        start_date_display = start_date.strftime('%B %d, %Y')
        end_date_display = end_date.strftime('%B %d, %Y')
        
        # Initialize report structure
        report = {
            "report_title": f"Parking System Summary Report",
            "date_range": {
                "start_date": start_date_str,
                "end_date": end_date_str,
                "display_range": f"{start_date_display} - {end_date_display}"
            },
            "generated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC'),
            "sections": []
        }
        
        # -----------------------------------
        # Section 1: Overall Traffic Summary
        # -----------------------------------
        
        # Query for entries and exits during the selected period
        total_entries = db.session.query(func.count(VehicleEntry.entry_id)).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        ).scalar()
        
        total_exits = db.session.query(func.count(VehicleExit.exit_id)).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time <= end_date
        ).scalar()
        
        # Query for entries by vehicle type
        entries_by_type = db.session.query(
            VehicleEntry.vehicle_type, 
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        ).group_by(
            VehicleEntry.vehicle_type
        ).all()
        
        # Calculate average parking duration for the period
        avg_duration = db.session.query(
            func.avg(ParkingSession.duration_minutes).label('avg_duration')
        ).filter(
            ParkingSession.start_time >= start_date,
            ParkingSession.start_time <= end_date,
            ParkingSession.duration_minutes.isnot(None)
        ).scalar()
        
        # Format the average duration
        avg_duration_formatted = "N/A"
        if avg_duration:
            hours = int(avg_duration // 60)
            minutes = int(avg_duration % 60)
            avg_duration_formatted = f"{hours}h {minutes}m"
        
        # Build the traffic summary section
        traffic_summary = {
            "section_title": "Traffic Overview",
            "total_entries": total_entries,
            "total_exits": total_exits,
            "total_traffic": total_entries + total_exits,
            "vehicle_type_distribution": {vt: count for vt, count in entries_by_type},
            "average_parking_duration": {
                "minutes": round(avg_duration) if avg_duration else 0,
                "formatted": avg_duration_formatted
            }
        }
        
        report["sections"].append(traffic_summary)
        
        # -----------------------------------
        # Section 2: Daily Traffic Breakdown
        # -----------------------------------
        
        # Calculate the number of days in the selected range
        days_delta = (end_date.date() - start_date.date()).days + 1
        
        # Prepare a structure for all days in the selected range
        days_of_week = []
        daily_data = {}
        
        # Create a list of all dates in the range and initialize data structures
        for i in range(days_delta):
            current_date = start_date.date() + timedelta(days=i)
            day_str = current_date.strftime('%Y-%m-%d')
            day_name = current_date.strftime('%A')
            
            days_of_week.append({
                'date': day_str,
                'day_name': day_name
            })
            
            daily_data[day_str] = {
                'entries': 0,
                'exits': 0,
                'day_name': day_name
            }
        
        # Query for entries grouped by date
        entries_by_date = db.session.query(
            func.date(VehicleEntry.entry_time).label('date'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        ).group_by('date').all()
        
        # Query for exits grouped by date
        exits_by_date = db.session.query(
            func.date(VehicleExit.exit_time).label('date'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time <= end_date
        ).group_by('date').all()
        
        # Update the entries data
        for date_obj, count in entries_by_date:
            date_str = date_obj.strftime('%Y-%m-%d')
            if date_str in daily_data:
                daily_data[date_str]['entries'] = count
        
        # Update the exits data
        for date_obj, count in exits_by_date:
            date_str = date_obj.strftime('%Y-%m-%d')
            if date_str in daily_data:
                daily_data[date_str]['exits'] = count
        
        # Format the results for the report
        daily_traffic = []
        for day_info in days_of_week:
            date_str = day_info['date']
            data = daily_data[date_str]
            daily_traffic.append({
                'date': date_str,
                'day_name': day_info['day_name'],
                'entries': data['entries'],
                'exits': data['exits'],
                'total': data['entries'] + data['exits']
            })
        
        # Find the busiest day
        busiest_day = max(daily_traffic, key=lambda x: x['total']) if daily_traffic else None
        
        # Build the daily breakdown section
        daily_breakdown = {
            "section_title": "Daily Traffic Breakdown",
            "daily_data": daily_traffic,
            "busiest_day": busiest_day
        }
        
        report["sections"].append(daily_breakdown)
        
        # -----------------------------------
        # Section 3: Hourly Traffic Patterns
        # -----------------------------------
        
        # Query for hourly entries
        hourly_entries = db.session.query(
            extract('hour', VehicleEntry.entry_time).label('hour'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time <= end_date
        ).group_by('hour').order_by('hour').all()
        
        # Query for hourly exits
        hourly_exits = db.session.query(
            extract('hour', VehicleExit.exit_time).label('hour'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time <= end_date
        ).group_by('hour').order_by('hour').all()
        
        # Format hourly data for all hours of the day (0-23)
        hourly_traffic = []
        for hour in range(24):
            entry_count = next((count for h, count in hourly_entries if int(h) == hour), 0)
            exit_count = next((count for h, count in hourly_exits if int(h) == hour), 0)
            
            hourly_traffic.append({
                'hour': hour,
                'hour_display': f"{hour:02d}:00 - {hour:02d}:59",
                'entries': entry_count,
                'exits': exit_count,
                'total': entry_count + exit_count
            })
        
        # Find peak hours
        peak_entry_hour = max(hourly_traffic, key=lambda x: x['entries']) if hourly_traffic else None
        peak_exit_hour = max(hourly_traffic, key=lambda x: x['exits']) if hourly_traffic else None
        
        # Build the hourly patterns section
        hourly_patterns = {
            "section_title": "Hourly Traffic Patterns",
            "hourly_data": hourly_traffic,
            "peak_entry_hour": peak_entry_hour,
            "peak_exit_hour": peak_exit_hour
        }
        
        report["sections"].append(hourly_patterns)
        
        # -----------------------------------
        # Section 4: Parking Slot Utilization
        # -----------------------------------
        
        # Query for total hours of slot usage during the period
        slot_usage = db.session.query(
            ParkingSlot.slot_id,
            ParkingSlot.slot_number,
            ParkingSlot.section,
            ParkingLot.name.label('lot_name'),
            func.sum(ParkingSession.duration_minutes).label('total_minutes')
        ).join(
            ParkingSession, ParkingSession.slot_id == ParkingSlot.slot_id
        ).join(
            ParkingLot, ParkingLot.lot_id == ParkingSlot.lot_id
        ).filter(
            ParkingSession.start_time >= start_date,
            ParkingSession.start_time <= end_date,
            ParkingSession.duration_minutes.isnot(None)
        ).group_by(
            ParkingSlot.slot_id,
            ParkingSlot.slot_number,
            ParkingSlot.section,
            ParkingLot.name
        ).order_by(desc('total_minutes')).limit(10).all()
        
        # Format the slot usage data
        top_slots = []
        for row in slot_usage:
            minutes = row.total_minutes or 0
            hours = round(minutes / 60, 2)
            
            # Format duration
            if minutes < 60:
                formatted_duration = f"{minutes} minutes"
            else:
                hours_int = int(minutes // 60)
                mins_int = int(minutes % 60)
                formatted_duration = f"{hours_int}h {mins_int}m"
            
            top_slots.append({
                'slot_id': str(row.slot_id),
                'slot_number': row.slot_number,
                'section': row.section,
                'lot_name': row.lot_name,
                'total_hours': hours,
                'total_minutes': minutes,
                'formatted_duration': formatted_duration
            })
        
        # Get section usage statistics
        section_usage = db.session.query(
            ParkingSlot.section,
            ParkingLot.name.label('lot_name'),
            func.sum(ParkingSession.duration_minutes).label('total_minutes'),
            func.count(ParkingSession.session_id).label('session_count')
        ).join(
            ParkingSession, ParkingSession.slot_id == ParkingSlot.slot_id
        ).join(
            ParkingLot, ParkingLot.lot_id == ParkingSlot.lot_id
        ).filter(
            ParkingSession.start_time >= start_date,
            ParkingSession.start_time <= end_date
        ).group_by(
            ParkingSlot.section,
            ParkingLot.name
        ).order_by(desc('total_minutes')).all()
        
        # Format section usage data
        section_stats = []
        for row in section_usage:
            minutes = row.total_minutes or 0
            hours = round(minutes / 60, 2)
            
            section_stats.append({
                'section': row.section,
                'lot_name': row.lot_name,
                'total_hours': hours,
                'session_count': row.session_count,
                'formatted_duration': format_duration(minutes)
            })
        
        # Build the slot utilization section
        slot_utilization = {
            "section_title": "Parking Slot Utilization",
            "top_utilized_slots": top_slots,
            "section_statistics": section_stats
        }
        
        report["sections"].append(slot_utilization)
        
        # -----------------------------------
        # Section 5: Customer Analytics
        # -----------------------------------
        
        # Query for top customers during the period
        top_customers = db.session.query(
            ParkingCustomer.customer_id,
            ParkingCustomer.first_name,
            ParkingCustomer.last_name,
            ParkingCustomer.vehicle_type,
            func.count(ParkingSession.session_id).label('visit_count'),
            func.sum(ParkingSession.duration_minutes).label('total_minutes')
        ).join(
            ParkingSession, ParkingSession.customer_id == ParkingCustomer.customer_id
        ).filter(
            ParkingSession.start_time >= start_date,
            ParkingSession.start_time <= end_date
        ).group_by(
            ParkingCustomer.customer_id,
            ParkingCustomer.first_name,
            ParkingCustomer.last_name,
            ParkingCustomer.vehicle_type
        ).order_by(desc('visit_count')).limit(10).all()
        
        # Format top customers data
        top_customer_data = []
        for cust in top_customers:
            minutes = cust.total_minutes or 0
            
            top_customer_data.append({
                'customer_id': str(cust.customer_id),
                'name': f"{cust.first_name} {cust.last_name}",
                'vehicle_type': cust.vehicle_type,
                'visits': cust.visit_count,
                'total_parking_time': {
                    'minutes': minutes,
                    'hours': round(minutes / 60, 2),
                    'formatted': format_duration(minutes)
                }
            })
        
        # Query for favorite parking spots of top customers
        customer_favorite_spots = []
        
        for cust in top_customers[:5]:  # Limit to top 5 for report brevity
            favorite_spots = db.session.query(
                ParkingSlot.slot_id,
                ParkingSlot.slot_number,
                ParkingSlot.section,
                ParkingLot.name.label('lot_name'),
                func.count(ParkingSession.session_id).label('usage_count')
            ).join(
                ParkingSession, ParkingSession.slot_id == ParkingSlot.slot_id
            ).join(
                ParkingLot, ParkingLot.lot_id == ParkingSlot.lot_id
            ).filter(
                ParkingSession.customer_id == cust.customer_id,
                ParkingSession.start_time >= start_date,
                ParkingSession.start_time <= end_date
            ).group_by(
                ParkingSlot.slot_id,
                ParkingSlot.slot_number,
                ParkingSlot.section,
                ParkingLot.name
            ).order_by(desc('usage_count')).limit(3).all()
            
            spots = [
                {
                    'slot_number': spot.slot_number,
                    'section': spot.section,
                    'lot_name': spot.lot_name,
                    'usage_count': spot.usage_count
                } for spot in favorite_spots
            ]
            
            if spots:
                customer_favorite_spots.append({
                    'customer_id': str(cust.customer_id),
                    'name': f"{cust.first_name} {cust.last_name}",
                    'favorite_spots': spots
                })
        
        # Build the customer analytics section
        customer_analytics = {
            "section_title": "Customer Analytics",
            "top_customers": top_customer_data,
            "customer_favorite_spots": customer_favorite_spots
        }
        
        report["sections"].append(customer_analytics)
        
        # -----------------------------------
        # Section 6: Duration Distribution
        # -----------------------------------
        
        # Set up duration ranges
        duration_ranges = [
            ('< 30 min', 0, 30),
            ('30-60 min', 30, 60),
            ('1-2 hours', 60, 120),
            ('2-4 hours', 120, 240),
            ('4-8 hours', 240, 480),
            ('> 8 hours', 480, None)
        ]
        
        # Query for duration distribution
        duration_dist = {}
        for label, min_val, max_val in duration_ranges:
            if max_val is None:
                # For the last range (> 8 hours)
                count = db.session.query(func.count(ParkingSession.session_id)).filter(
                    ParkingSession.duration_minutes >= min_val,
                    ParkingSession.start_time >= start_date,
                    ParkingSession.start_time <= end_date
                ).scalar()
            else:
                count = db.session.query(func.count(ParkingSession.session_id)).filter(
                    ParkingSession.duration_minutes >= min_val,
                    ParkingSession.duration_minutes < max_val,
                    ParkingSession.start_time >= start_date,
                    ParkingSession.start_time <= end_date
                ).scalar()
            duration_dist[label] = count
        
        # Build the duration distribution section
        duration_analysis = {
            "section_title": "Parking Duration Analysis",
            "duration_distribution": duration_dist
        }
        
        report["sections"].append(duration_analysis)
        
        return jsonify(report), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@analytics_bp.route('/traffic/current-week', methods=['GET'])
def current_week_traffic():
    """
    Get traffic data specifically for the current week with data for each day
    Returns entries and exits for each day in the current week
    """
    try:
        # Get the current date
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Calculate the start date (Sunday) of the current week
        # Python's weekday() returns 0 for Monday, so we adjust to get Sunday
        start_date = today - timedelta(days=(today.weekday() + 1) % 7)
        
        # The end date is 7 days after the start date
        end_date = start_date + timedelta(days=7)
        
        # Prepare a structure for all days of the week
        days_of_week = []
        daily_data = {}
        
        # Create a list of all dates in this week and initialize data structures
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            day_str = current_date.strftime('%Y-%m-%d')
            day_name = current_date.strftime('%A')
            display_date = current_date.strftime('%m/%d')
            
            days_of_week.append({
                'date': day_str,
                'day_name': day_name,
                'display_date': display_date
            })
            
            daily_data[day_str] = {
                'entries': 0,
                'exits': 0,
                'display_date': display_date,
                'day_name': day_name
            }
        
        # Query for entries grouped by date
        entries_by_date = db.session.query(
            func.date(VehicleEntry.entry_time).label('date'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time < end_date
        ).group_by('date').all()
        
        # Query for exits grouped by date
        exits_by_date = db.session.query(
            func.date(VehicleExit.exit_time).label('date'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time >= start_date,
            VehicleExit.exit_time < end_date
        ).group_by('date').all()
        
        # Query for entries by vehicle type
        entries_by_type = db.session.query(
            VehicleEntry.vehicle_type, 
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time >= start_date,
            VehicleEntry.entry_time < end_date
        ).group_by(
            VehicleEntry.vehicle_type
        ).all()
        
        # Update the entries data
        for date_obj, count in entries_by_date:
            date_str = date_obj.strftime('%Y-%m-%d')
            if date_str in daily_data:
                daily_data[date_str]['entries'] = count
        
        # Update the exits data
        for date_obj, count in exits_by_date:
            date_str = date_obj.strftime('%Y-%m-%d')
            if date_str in daily_data:
                daily_data[date_str]['exits'] = count
        
        # Format the results for the API response
        formatted_data = []
        for day_info in days_of_week:
            date_str = day_info['date']
            data = daily_data[date_str]
            formatted_data.append({
                'date': date_str,
                'day': day_info['day_name'],
                'display_date': data['display_date'],
                'entries': data['entries'],
                'exits': data['exits'],
                'total': data['entries'] + data['exits']
            })
        
        # Build the response
        result = {
            'time_period': 'current_week',
            'date_range': {
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': (end_date - timedelta(days=1)).strftime('%Y-%m-%d')  # End date minus 1 day for the actual end of week
            },
            'days_of_week': days_of_week,
            'traffic_data': formatted_data,
            'entries_by_type': {vt: count for vt, count in entries_by_type},
            'summary': {
                'total_entries': sum(data['entries'] for data in formatted_data),
                'total_exits': sum(data['exits'] for data in formatted_data)
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Vehicle Traffic Analytics
@analytics_bp.route('/traffic/<time_period>', methods=['GET'])
def traffic_analytics(time_period):
    """
    Get vehicle traffic analytics for a specific time period (day, week, month)
    Returns counts of entries and exits by vehicle type
    """
    try:
        start_date, end_date = get_date_range(time_period)
        
        # Query for entries by vehicle type
        entries_by_type = db.session.query(
            VehicleEntry.vehicle_type, 
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time.between(start_date, end_date)
        ).group_by(
            VehicleEntry.vehicle_type
        ).all()
        
        # Query for exits by vehicle type
        exits_by_type = db.session.query(
            VehicleExit.vehicle_type, 
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time.between(start_date, end_date)
        ).group_by(
            VehicleExit.vehicle_type
        ).all()
        
        # Format the results
        entries_data = {vt: count for vt, count in entries_by_type}
        exits_data = {vt: count for vt, count in exits_by_type}
        
        # Get hourly breakdown for the time period
        hourly_entries = db.session.query(
            extract('hour', VehicleEntry.entry_time).label('hour'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time.between(start_date, end_date)
        ).group_by('hour').order_by('hour').all()
        
        hourly_exits = db.session.query(
            extract('hour', VehicleExit.exit_time).label('hour'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time.between(start_date, end_date)
        ).group_by('hour').order_by('hour').all()
        
        # Format hourly data
        hourly_data = {
            'entries': {int(hour): count for hour, count in hourly_entries},
            'exits': {int(hour): count for hour, count in hourly_exits}
        }
        
        # Get current vehicles in the parking lot
        current_count = db.session.query(func.count(ParkingSlot.slot_id))\
            .filter(ParkingSlot.status == 'occupied').scalar()
        
        result = {
            'time_period': time_period,
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'summary': {
                'total_entries': sum(entries_data.values()),
                'total_exits': sum(exits_data.values()),
                'current_vehicles': current_count
            },
            'entries_by_type': entries_data,
            'exits_by_type': exits_data,
            'hourly_distribution': hourly_data
        }
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Day of week traffic patterns
@analytics_bp.route('/traffic/weekly-pattern', methods=['GET'])
def weekly_traffic_pattern():
    """
    Get traffic patterns by day of the week over the past 4 weeks
    """
    try:
        # Get date for 4 weeks ago
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(weeks=4)
        
        # Query entries by day of week
        entries_by_dow = db.session.query(
            extract('dow', VehicleEntry.entry_time).label('day_of_week'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time.between(start_date, end_date)
        ).group_by('day_of_week').order_by('day_of_week').all()
        
        # Query exits by day of week
        exits_by_dow = db.session.query(
            extract('dow', VehicleExit.exit_time).label('day_of_week'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time.between(start_date, end_date)
        ).group_by('day_of_week').order_by('day_of_week').all()
        
        # Convert to day names for better readability
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        
        entries_data = {days[int(dow)]: count for dow, count in entries_by_dow}
        exits_data = {days[int(dow)]: count for dow, count in exits_by_dow}
        
        result = {
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'entries_by_day': entries_data,
            'exits_by_day': exits_data
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Peak hours analytics
@analytics_bp.route('/traffic/peak-hours', methods=['GET'])
def peak_hours():
    """
    Get peak hours for entries and exits
    """
    try:
        # Get date for the past 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        # Query peak entry hours
        peak_entry_hours = db.session.query(
            extract('hour', VehicleEntry.entry_time).label('hour'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time.between(start_date, end_date)
        ).group_by('hour').order_by(desc('count')).limit(5).all()
        
        # Query peak exit hours
        peak_exit_hours = db.session.query(
            extract('hour', VehicleExit.exit_time).label('hour'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.exit_time.between(start_date, end_date)
        ).group_by('hour').order_by(desc('count')).limit(5).all()
        
        result = {
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'peak_entry_hours': {f"{int(hour):02d}:00-{int(hour):02d}:59": count for hour, count in peak_entry_hours},
            'peak_exit_hours': {f"{int(hour):02d}:00-{int(hour):02d}:59": count for hour, count in peak_exit_hours}
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Customer specific analytics
@analytics_bp.route('/customer/<customer_id>', methods=['GET'])
def customer_analytics(customer_id):
    """
    Get analytics for a specific customer
    """
    try:
        # Verify customer exists
        customer = ParkingCustomer.query.get(customer_id)
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
            
        # Get the last 30 entries
        recent_entries = VehicleEntry.query.filter_by(customer_id=customer_id).order_by(
            VehicleEntry.entry_time.desc()).limit(30).all()
            
        # Get the last 30 exits
        recent_exits = VehicleExit.query.filter_by(customer_id=customer_id).order_by(
            VehicleExit.exit_time.desc()).limit(30).all()
        
        # Calculate favorite entry times (hour of day)
        entry_hours = db.session.query(
            extract('hour', VehicleEntry.entry_time).label('hour'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.customer_id == customer_id
        ).group_by('hour').order_by(desc('count')).limit(3).all()
        
        # Calculate favorite exit times (hour of day)
        exit_hours = db.session.query(
            extract('hour', VehicleExit.exit_time).label('hour'),
            func.count(VehicleExit.exit_id).label('count')
        ).filter(
            VehicleExit.customer_id == customer_id
        ).group_by('hour').order_by(desc('count')).limit(3).all()
        
        # Calculate favorite days of week
        favorite_days = db.session.query(
            extract('dow', VehicleEntry.entry_time).label('day_of_week'),
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.customer_id == customer_id
        ).group_by('day_of_week').order_by(desc('count')).limit(3).all()
        
        # Calculate favorite parking spots
        favorite_spots = db.session.query(
            ParkingSlot.slot_number,
            ParkingSlot.section,
            ParkingSlot.lot_id,
            func.count(ParkingSession.session_id).label('usage_count')
        ).join(
            ParkingSession, ParkingSession.slot_id == ParkingSlot.slot_id
        ).filter(
            ParkingSession.customer_id == customer_id
        ).group_by(
            ParkingSlot.slot_id, ParkingSlot.slot_number, ParkingSlot.section, ParkingSlot.lot_id
        ).order_by(desc('usage_count')).limit(3).all()
        
        # Calculate average parking duration
        avg_duration = db.session.query(
            func.avg(ParkingSession.duration_minutes).label('avg_duration')
        ).filter(
            ParkingSession.customer_id == customer_id,
            ParkingSession.duration_minutes.isnot(None)
        ).scalar()
        
        # Format days of week
        days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        
        result = {
            'customer_info': {
                'customer_id': str(customer.customer_id),
                'name': f"{customer.first_name} {customer.last_name}",
                'plate_number': customer.plate_number,
                'vehicle_type': customer.vehicle_type
            },
            'entry_patterns': {
                'favorite_hours': {f"{int(hour):02d}:00-{int(hour):02d}:59": count for hour, count in entry_hours},
                'favorite_days': {days[int(dow)]: count for dow, count in favorite_days}
            },
            'exit_patterns': {
                'favorite_hours': {f"{int(hour):02d}:00-{int(hour):02d}:59": count for hour, count in exit_hours}
            },
            'parking_preferences': {
                'favorite_spots': [
                    {
                        'slot_number': row.slot_number,
                        'section': row.section,
                        'lot_id': row.lot_id,
                        'usage_count': row.usage_count
                    } for row in favorite_spots  # Directly iterate over query results
                ],
                'average_duration_minutes': round(avg_duration) if avg_duration else None
            },
            'recent_activity': {
                'entries': [
                    {
                        'entry_id': str(entry.entry_id),
                        'entry_time': entry.entry_time.isoformat(),
                        'vehicle_type': entry.vehicle_type
                    } for entry in recent_entries[:5]  # Just show the 5 most recent
                ],
                'exits': [
                    {
                        'exit_id': str(exit.exit_id),
                        'exit_time': exit.exit_time.isoformat(),
                        'vehicle_type': exit.vehicle_type
                    } for exit in recent_exits[:5]  # Just show the 5 most recent
                ]
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Parking lot occupancy analytics
@analytics_bp.route('/occupancy', methods=['GET'])
def occupancy_analytics():
    """
    Get current and historical occupancy statistics for parking lots
    """
    try:
        # Get current occupancy by lot
        current_occupancy = db.session.query(
            ParkingSlot.lot_id,
            func.count(ParkingSlot.slot_id).label('occupied_count')
        ).filter(
            ParkingSlot.status == 'occupied'
        ).group_by(ParkingSlot.lot_id).all()
        
        # Get total capacity by lot
        total_capacity = db.session.query(
            ParkingSlot.lot_id,
            func.count(ParkingSlot.slot_id).label('total_count')
        ).filter(
            ParkingSlot.is_active == True
        ).group_by(ParkingSlot.lot_id).all()
        
        # Calculate occupancy percentages
        occupancy_data = {}
        for lot_id, total in total_capacity:
            occupied = next((count for lid, count in current_occupancy if lid == lot_id), 0)
            occupancy_data[lot_id] = {
                'total_slots': total,
                'occupied_slots': occupied,
                'available_slots': total - occupied,
                'occupancy_rate': round((occupied / total) * 100, 2) if total > 0 else 0
            }
        
        # Get hourly occupancy rates for the past 24 hours
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=24)
        
        # This requires more complex SQL to get historical occupancy
        # Would need to analyze entries/exits over time
        # Simplified version just returns current data
            
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'current_occupancy': occupancy_data
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Vehicle type distribution analytics
@analytics_bp.route('/vehicle-types', methods=['GET'])
def vehicle_type_analytics():
    """
    Get distribution of vehicle types currently in the parking lot and historically
    """
    try:
        # Get current distribution by querying occupied slots
        current_distribution = db.session.query(
            VehicleEntry.vehicle_type,
            func.count(ParkingSlot.slot_id).label('count')
        ).join(
            ParkingSlot, ParkingSlot.current_vehicle_id == VehicleEntry.entry_id
        ).filter(
            ParkingSlot.status == 'occupied'
        ).group_by(VehicleEntry.vehicle_type).all()
        
        # Get historical distribution (last 30 days)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        historical_distribution = db.session.query(
            VehicleEntry.vehicle_type,
            func.count(VehicleEntry.entry_id).label('count')
        ).filter(
            VehicleEntry.entry_time.between(start_date, end_date)
        ).group_by(VehicleEntry.vehicle_type).all()
        
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'current_distribution': {vt: count for vt, count in current_distribution},
            'historical_distribution': {
                'date_range': {
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat()
                },
                'distribution': {vt: count for vt, count in historical_distribution}
            }
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Customer loyalty analytics - who are the most frequent customers
@analytics_bp.route('/customers/top', methods=['GET'])
def top_customers():
    """
    Get the top customers by frequency of visits
    """
    try:
        limit = request.args.get('limit', 10, type=int)
        
        top_by_entries = db.session.query(
            ParkingCustomer.customer_id,
            ParkingCustomer.first_name,
            ParkingCustomer.last_name,
            ParkingCustomer.plate_number,
            ParkingCustomer.vehicle_type,
            func.count(VehicleEntry.entry_id).label('entry_count')
        ).join(
            VehicleEntry, VehicleEntry.customer_id == ParkingCustomer.customer_id
        ).group_by(
            ParkingCustomer.customer_id,
            ParkingCustomer.first_name,
            ParkingCustomer.last_name,
            ParkingCustomer.plate_number,
            ParkingCustomer.vehicle_type
        ).order_by(desc('entry_count')).limit(limit).all()
        
        result = {
            'top_customers': [
                {
                    'customer_id': str(row.customer_id),
                    'name': f"{row.first_name} {row.last_name}",
                    'plate_number': row.plate_number,
                    'vehicle_type': row.vehicle_type,
                    'visit_count': row.entry_count
                } for row in top_by_entries
            ]
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Parking duration analytics
@analytics_bp.route('/duration', methods=['GET'])
def duration_analytics():
    """
    Get analytics on parking durations
    """
    try:
        # Get average parking duration overall
        avg_duration = db.session.query(
            func.avg(ParkingSession.duration_minutes).label('avg_duration')
        ).filter(
            ParkingSession.duration_minutes.isnot(None)
        ).scalar()
        
        # Get average duration by vehicle type
        avg_by_type = db.session.query(
            ParkingCustomer.vehicle_type,
            func.avg(ParkingSession.duration_minutes).label('avg_duration')
        ).join(
            ParkingSession, ParkingSession.customer_id == ParkingCustomer.customer_id
        ).filter(
            ParkingSession.duration_minutes.isnot(None)
        ).group_by(ParkingCustomer.vehicle_type).all()
        
        # Get duration distribution
        duration_ranges = [
            ('< 30 min', 0, 30),
            ('30-60 min', 30, 60),
            ('1-2 hours', 60, 120),
            ('2-4 hours', 120, 240),
            ('4-8 hours', 240, 480),
            ('> 8 hours', 480, None)
        ]
        
        duration_dist = {}
        for label, min_val, max_val in duration_ranges:
            if max_val is None:
                # For the last range (> 8 hours)
                count = db.session.query(func.count(ParkingSession.session_id)).filter(
                    ParkingSession.duration_minutes >= min_val
                ).scalar()
            else:
                count = db.session.query(func.count(ParkingSession.session_id)).filter(
                    ParkingSession.duration_minutes >= min_val,
                    ParkingSession.duration_minutes < max_val
                ).scalar()
            duration_dist[label] = count
        
        result = {
            'overall_stats': {
                'average_duration_minutes': round(avg_duration) if avg_duration else 0,
                'average_duration_formatted': f"{int(avg_duration // 60)}h {int(avg_duration % 60)}m" if avg_duration else "0h 0m"
            },
            'by_vehicle_type': {
                vt: {
                    'average_minutes': round(avg),
                    'formatted': f"{int(avg // 60)}h {int(avg % 60)}m"
                } for vt, avg in avg_by_type
            },
            'duration_distribution': duration_dist
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500


@analytics_bp.route('/parking-spots/top-duration', methods=['GET'])
def top_parking_spots_by_duration():
    """
    Get the top parking spots by total duration used across all sessions
    
    Query parameters:
    - time_period: 'day', 'week', or 'month' (default: 'day')
    - limit: Number of top spots to return (default: 20)
    """
    try:
        # Get query parameters
        time_period = request.args.get('time_period', 'day')
        limit = request.args.get('limit', 20, type=int)
        
        # Get date range based on time period
        start_date, end_date = get_date_range(time_period)
        
        # Query to get total duration for each parking spot
        top_spots = db.session.query(
            ParkingSlot.slot_id,
            ParkingSlot.slot_number,
            ParkingSlot.section,
            ParkingSlot.lot_id,
            ParkingLot.name.label('lot_name'),
            ParkingSlot.vehicle_type,
            func.sum(ParkingSession.duration_minutes).label('total_duration_minutes')
        ).join(
            ParkingSession, ParkingSession.slot_id == ParkingSlot.slot_id
        ).join(
            ParkingLot, ParkingLot.lot_id == ParkingSlot.lot_id
        ).filter(
            ParkingSession.start_time.between(start_date, end_date),
            ParkingSession.duration_minutes.isnot(None)
        ).group_by(
            ParkingSlot.slot_id,
            ParkingSlot.slot_number,
            ParkingSlot.section,
            ParkingSlot.lot_id,
            ParkingLot.name,
            ParkingSlot.vehicle_type
        ).order_by(
            desc('total_duration_minutes')
        ).limit(limit).all()
        
        # Format the results
        result = {
            'time_period': time_period,
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'top_spots': [
                {
                    'slot_id': str(row.slot_id),
                    'slot_number': row.slot_number,
                    'slot_name': f"Slot {row.slot_number}",
                    'section': row.section,
                    'lot_id': row.lot_id,
                    'lot_name': row.lot_name,
                    'vehicle_type': row.vehicle_type,
                    'total_duration_minutes': row.total_duration_minutes,
                    'total_duration_hours': round(row.total_duration_minutes / 60, 2),
                    'formatted_duration': format_duration(row.total_duration_minutes)
                } for row in top_spots
            ]
        }
        
        # Get top 3 spots for leaderboard
        if len(result['top_spots']) >= 3:
            result['top_three'] = result['top_spots'][:3]
        else:
            result['top_three'] = result['top_spots']
        
        return jsonify(result), 200
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

# Helper function to format duration in a human-readable way
def format_duration(minutes):
    """
    Format minutes into human-readable duration
    """
    if minutes < 60:
        return f"{minutes} min"
    elif minutes < 60 * 24:
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins}m"
    else:
        days = minutes // (60 * 24)
        hours = (minutes % (60 * 24)) // 60
        return f"{days}d {hours}h"
