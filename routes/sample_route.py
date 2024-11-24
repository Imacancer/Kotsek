from flask import Blueprint, request, jsonify
from controllers.sample_controller import UserController
from flask_cors import cross_origin

user_bp = Blueprint('user', __name__)

@user_bp.route('/test', methods=['GET'])
@cross_origin()
def test():
    return jsonify({"message": "API is working"}), 200

@user_bp.route('/users', methods=['POST', 'OPTIONS'])
@cross_origin()
def create_user():
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return jsonify({}), 200
        
    try:
        # Debug prints
        print("Request received")
        print("Headers:", dict(request.headers))
        print("Data:", request.get_data(as_text=True))
        
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        return UserController.create_user(data)
    except Exception as e:
        print(f"Error in create_user: {str(e)}")
        return jsonify({"error": str(e)}), 400

@user_bp.route('/users', methods=['GET'])
@cross_origin()
def get_users():
    return UserController.get_users()

@user_bp.route('/users/<int:user_id>', methods=['GET'])
@cross_origin()
def get_user(user_id):
    return UserController.get_user(user_id)