from flask import Blueprint, request, jsonify
from models.base import db
from models.customer import ParkingCustomer
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from flask_jwt_extended import jwt_required, get_jwt_identity
from models.users import User
from functools import wraps
from controllers.admin import role_required

customer_bp = Blueprint('parking_customer', __name__)

# Helper function to validate UUID
def is_valid_uuid(uuid_string):
    try:
        UUID(uuid_string)
        return True
    except ValueError:
        return False

@customer_bp.route('/create-customer', methods=['POST'])
@jwt_required()
@role_required(['Admin', 'Manager'])
def create_customer():
    """Add a new parking customer or update existing one based on plate number"""
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['first_name', 'last_name', 'plate_number']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    try:
        # Check if customer with plate number exists
        existing_customer = ParkingCustomer.query.filter_by(
            plate_number=data['plate_number']
        ).first()
        
        if existing_customer:
            # Update existing customer
            existing_customer.first_name = data['first_name']
            existing_customer.last_name = data['last_name']
            existing_customer.is_registered = True
            
            # Update optional fields if provided
            optional_fields = ['contact_num', 'address', 'email', 'car_model']
            for field in optional_fields:
                if field in data:
                    setattr(existing_customer, field, data[field])
            
            db.session.commit()
            
            return jsonify({
                'message': 'Customer updated successfully',
                'customer_id': str(existing_customer.customer_id),
                'updated': True
            }), 200
            
        # Create new customer if plate number doesn't exist
        new_customer = ParkingCustomer(
            first_name=data['first_name'],
            last_name=data['last_name'],
            plate_number=data['plate_number'],
            color=data.get('color'),
            vehicle_type=data.get('vehicle_type'),
            contact_num=data.get('contact_num'),
            is_registered=data.get('is_registered', False),
            address=data.get('address'),
            email=data.get('email'),
            car_model=data.get('car_model')
        )
        
        db.session.add(new_customer)
        db.session.commit()
        
        return jsonify({
            'message': 'Customer added successfully',
            'customer_id': str(new_customer.customer_id),
            'created': True
        }), 201
        
    except IntegrityError as e:
        db.session.rollback()
        if 'email' in str(e).lower():
            return jsonify({'error': 'A customer with this email already exists'}), 409
        return jsonify({'error': 'Database integrity error'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/get-customers', methods=['GET'])
@jwt_required()
@role_required(['Admin', 'Manager', 'Attendant'])
def get_customers():
    """Fetch all parking customers with optional filtering"""
    try:
        # Log the current user's identity
        current_user_id = get_jwt_identity()
        print(f"Current user ID: {current_user_id}")
        
        current_user = User.query.filter_by(id=current_user_id).first()
        if not current_user:
            print(f"User not found for ID: {current_user_id}")
            return jsonify({'error': 'User not found'}), 404
            
        print(f"User role: {current_user.role}")
        
        # Get query parameters for filtering
        is_registered = request.args.get('is_registered')
        plate_number = request.args.get('plate_number')
        
        query = ParkingCustomer.query
        
        # Apply filters if provided
        if is_registered is not None:
            is_registered = is_registered.lower() == 'true'
            query = query.filter(ParkingCustomer.is_registered == is_registered)
            
        if plate_number:
            query = query.filter(ParkingCustomer.plate_number == plate_number)
        
        customers = query.all()
        
        result = []
        for customer in customers:
            result.append({
                'customer_id': str(customer.customer_id),
                'first_name': customer.first_name,
                'last_name': customer.last_name,
                'plate_number': customer.plate_number,
                'color': customer.color,
                'vehicle_type': customer.vehicle_type,
                'contact_num': customer.contact_num,
                'is_registered': customer.is_registered,
                'address': customer.address,
                'email': customer.email,
                'car_model': customer.car_model,
                'created_at': customer.created_at.isoformat() if customer.created_at else None,
                'updated_at': customer.updated_at.isoformat() if customer.updated_at else None
            })
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/get-customer/<customer_id>', methods=['GET'])
@jwt_required()
@role_required(['Admin', 'Manager', 'Attendant'])
def get_customer(customer_id):
    """Fetch a specific parking customer by ID"""
    if not is_valid_uuid(customer_id):
        return jsonify({'error': 'Invalid customer ID format'}), 400
        
    try:
        customer = ParkingCustomer.query.get(customer_id)
        
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        result = {
            'customer_id': str(customer.customer_id),
            'first_name': customer.first_name,
            'last_name': customer.last_name,
            'plate_number': customer.plate_number,
            'color': customer.color,
            'vehicle_type': customer.vehicle_type,
            'contact_num': customer.contact_num,
            'is_registered': customer.is_registered,
            'address': customer.address,
            'email': customer.email,
            'car_model': customer.car_model,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if customer.updated_at else None
        }
        
        return jsonify(result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@customer_bp.route('/update-customer/<customer_id>', methods=['PATCH'])
@jwt_required()
@role_required(['Admin', 'Manager'])
def update_customer(customer_id):
    """Update specific fields of a parking customer"""
    if not is_valid_uuid(customer_id):
        return jsonify({'error': 'Invalid customer ID format'}), 400
    
    data = request.get_json()
    try:
        customer = ParkingCustomer.query.get(customer_id)
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        # Only update specific allowed fields - removed plate_number, vehicle_type, car_model
        allowed_fields = [
            'contact_num', 'address', 'email', 'is_registered'
        ]
        
        updated = False
        for field in allowed_fields:
            if field in data:
                setattr(customer, field, data[field])
                updated = True
                
        if not updated:
            return jsonify({'error': 'No valid fields provided for update'}), 400
            
        db.session.commit()
        return jsonify({
            'message': 'Customer updated successfully',
            'customer_id': str(customer.customer_id)
        }), 200
        
    except IntegrityError as e:
        db.session.rollback()
        error_msg = str(e)
        print(f"IntegrityError: {error_msg}")
        return jsonify({'error': f'Database integrity error: {error_msg}'}), 409
    except Exception as e:
        db.session.rollback()
        print(f"Exception: {str(e)}")
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/update-registration/<customer_id>', methods=['PUT'])
@jwt_required()
@role_required(['Admin', 'Manager'])
def update_registration(customer_id):
    """Update only the is_registered field of a parking customer"""
    if not is_valid_uuid(customer_id):
        return jsonify({'error': 'Invalid customer ID format'}), 400
        
    data = request.get_json()
    
    if 'is_registered' not in data:
        return jsonify({'error': 'Missing is_registered field'}), 400
    
    try:
        customer = ParkingCustomer.query.get(customer_id)
        
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        customer.is_registered = data['is_registered']
        db.session.commit()
        
        return jsonify({
            'message': 'Registration status updated successfully',
            'customer_id': str(customer.customer_id),
            'is_registered': customer.is_registered
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@customer_bp.route('/<customer_id>', methods=['DELETE'])
@jwt_required()
@role_required(['Admin', 'Manager'])
def delete_customer(customer_id):
    """Remove a parking customer"""
    if not is_valid_uuid(customer_id):
        return jsonify({'error': 'Invalid customer ID format'}), 400
        
    try:
        customer = ParkingCustomer.query.get(customer_id)
        
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        db.session.delete(customer)
        db.session.commit()
        
        return jsonify({
            'message': 'Customer deleted successfully',
            'customer_id': str(customer_id)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500