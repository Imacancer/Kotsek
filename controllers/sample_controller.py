# controller/userController.py
from models.sample_model import User
from db.db import db
from flask import jsonify
from sqlalchemy.exc import IntegrityError

class UserController:
    @staticmethod
    def create_user(data):
        if not data.get('username') or not data.get('email'):
            return jsonify({'error': 'Username and email are required'}), 400
            
        try:
            user = User(
                username=data['username'],
                email=data['email']
            )
            db.session.add(user)
            db.session.commit()
            return jsonify(user.to_dict()), 201
            
        except IntegrityError as e:
            db.session.rollback()
            if 'UNIQUE constraint' in str(e):
                if 'users.username' in str(e):
                    message = 'Username already exists'
                else:
                    message = 'Email already exists'
                return jsonify({'error': message}), 400
            return jsonify({'error': str(e)}), 400
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @staticmethod
    def get_users():
        try:
            users = User.query.all()
            return jsonify([user.to_dict() for user in users]), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @staticmethod
    def get_user(user_id):
        try:
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            return jsonify(user.to_dict()), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500