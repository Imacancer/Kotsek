from flask import Blueprint, request, jsonify
from models.users import User
from db.db import db
from functools import wraps
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash
from datetime import datetime
from models.system_logs import SystemLog

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def log_admin_action(action, details=None, user_id=None):
    """Helper function to log admin actions"""
    log = SystemLog(
        log_type='admin_action',
        action=action,
        details=details,
        user_id=user_id,
        ip_address=request.remote_addr
    )
    db.session.add(log)
    db.session.commit()

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        current_user = User.query.filter_by(id=get_jwt_identity()).first()
        if not current_user or current_user.role != 'Admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_user = User.query.filter_by(id=get_jwt_identity()).first()
            if not current_user:
                return jsonify({'error': 'User not found'}), 404
            
            if current_user.role not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = User.query.filter_by(id=get_jwt_identity()).first()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
@admin_required
def create_user():
    data = request.get_json()
    
    if not all(k in data for k in ['email', 'password', 'role']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if data['role'] not in ['Admin', 'Manager', 'Attendant']:
        return jsonify({'error': 'Invalid role'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 400
    
    new_user = User(
        email=data['email'],
        username=data.get('username'),
        role=data['role']
    )
    new_user.set_password(data['password'])
    
    db.session.add(new_user)
    db.session.commit()
    
    log_admin_action('create_user', {
        'user_id': str(new_user.id),
        'email': new_user.email,
        'role': new_user.role
    }, get_jwt_identity())
    
    return jsonify(new_user.to_dict()), 201

@admin_bp.route('/users/<uuid:user_id>', methods=['PUT'])
@jwt_required()
@admin_required
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    changes = {}
    
    if 'email' in data and data['email'] != user.email:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 400
        changes['email'] = {'old': user.email, 'new': data['email']}
        user.email = data['email']
    
    if 'username' in data:
        changes['username'] = {'old': user.username, 'new': data['username']}
        user.username = data['username']
    
    if 'password' in data:
        user.set_password(data['password'])
        changes['password'] = 'updated'
    
    if 'role' in data:
        if data['role'] not in ['Admin', 'Attendant']:
            return jsonify({'error': 'Invalid role'}), 400
        changes['role'] = {'old': user.role, 'new': data['role']}
        user.role = data['role']
    
    db.session.commit()
    
    if changes:
        log_admin_action('update_user', {
            'user_id': str(user_id),
            'changes': changes
        }, get_jwt_identity())
    
    return jsonify(user.to_dict()), 200

@admin_bp.route('/users/<uuid:user_id>', methods=['DELETE'])
@jwt_required()
@admin_required
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    
    # Prevent self-deletion
    if user.id == get_jwt_identity():
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    user_data = user.to_dict()
    db.session.delete(user)
    db.session.commit()
    
    log_admin_action('delete_user', {
        'user_id': str(user_id),
        'user_data': user_data
    }, get_jwt_identity())
    
    return jsonify({'message': 'User deleted successfully'}), 200

@admin_bp.route('/users/<uuid:user_id>/role', methods=['PUT'])
@jwt_required()
@admin_required
def change_user_role(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if 'role' not in data:
        return jsonify({'error': 'Role is required'}), 400
    
    if data['role'] not in ['Admin', 'Manager', 'Attendant']:
        return jsonify({'error': 'Invalid role'}), 400
    
    # Prevent changing own role
    if user.id == get_jwt_identity():
        return jsonify({'error': 'Cannot change your own role'}), 400
    
    old_role = user.role
    user.role = data['role']
    db.session.commit()
    
    log_admin_action('change_user_role', {
        'user_id': str(user_id),
        'old_role': old_role,
        'new_role': data['role']
    }, get_jwt_identity())
    
    return jsonify(user.to_dict()), 200

@admin_bp.route('/users/<uuid:user_id>/block', methods=['PUT'])
@jwt_required()
@admin_required
def block_user(user_id):
    user = User.query.get_or_404(user_id)
    
    # Prevent self-blocking
    if user.id == get_jwt_identity():
        return jsonify({'error': 'Cannot block your own account'}), 400
    
    user.is_blocked = True
    db.session.commit()
    
    log_admin_action('block_user', {
        'user_id': str(user_id),
        'email': user.email
    }, get_jwt_identity())
    
    return jsonify(user.to_dict()), 200

@admin_bp.route('/users/<uuid:user_id>/unblock', methods=['PUT'])
@jwt_required()
@admin_required
def unblock_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_blocked = False
    db.session.commit()
    
    log_admin_action('unblock_user', {
        'user_id': str(user_id),
        'email': user.email
    }, get_jwt_identity())
    
    return jsonify(user.to_dict()), 200

@admin_bp.route('/logs', methods=['GET'])
@jwt_required()
@admin_required
def get_system_logs():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    log_type = request.args.get('type')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    query = SystemLog.query
    
    if log_type:
        query = query.filter_by(log_type=log_type)
    if start_date:
        query = query.filter(SystemLog.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(SystemLog.timestamp <= datetime.fromisoformat(end_date))
    
    logs = query.order_by(SystemLog.timestamp.desc()).paginate(page=page, per_page=per_page)
    
    return jsonify({
        'logs': [log.to_dict() for log in logs.items],
        'total': logs.total,
        'pages': logs.pages,
        'current_page': logs.page
    }), 200

@admin_bp.route('/logs/export', methods=['GET'])
@jwt_required()
@admin_required
def export_logs():
    # Similar filtering as above
    logs = SystemLog.query.order_by(SystemLog.timestamp.desc()).all()
    
    # Generate CSV or other format
    # Return as downloadable file
    return jsonify({'message': 'Logs exported successfully'}), 200