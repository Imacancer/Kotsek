from flask import Blueprint, request, redirect, url_for, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    JWTManager
)
from datetime import datetime, timedelta
import os
import json
import requests
from models.users import User
from db.db import db
from dotenv import load_dotenv
from supabase import create_client, Client
import uuid
import secrets

load_dotenv()

supabase: Client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_KEY'))

auth_bp = Blueprint('auth', __name__)

# OAuth State String for CSRF protection (similar to oauthStateString in Golang)
OAUTH_STATE_STRING = secrets.token_hex(16)

# JWT Secret (similar to jwtSecret in Golang)
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'c2lrbG9NTkw')

def init_jwt(app):
    """Initialize JWT with the Flask app"""
    app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    jwt = JWTManager(app)
    return jwt

def generate_google_oauth_config():
    """Generate Google OAuth configuration (similar to googleOauthConfig in Golang)"""
    return {
        'client_id': os.getenv('GOOGLE_CLIENT_ID'),
        'client_secret': os.getenv('GOOGLE_CLIENT_SECRET'),
        'redirect_uri': os.getenv('GOOGLE_REDIRECT_URI'),
        'scope': 'email profile',
        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
        'token_uri': 'https://oauth2.googleapis.com/token',
        'userinfo_uri': 'https://www.googleapis.com/oauth2/v2/userinfo'
    }

@auth_bp.route('/google/login', methods=['GET'])
def google_login():
    """Direct user to Google's OAuth login page"""
    google_config = generate_google_oauth_config()
    
    # Build the authorization URL
    auth_url = f"{google_config['auth_uri']}?client_id={google_config['client_id']}&redirect_uri={google_config['redirect_uri']}&response_type=code&scope={google_config['scope']}&state={OAUTH_STATE_STRING}"
    
    return redirect(auth_url)

@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    # Check for error parameter
    error = request.args.get('error')
    if error:
        # User cancelled the login or another error occurred
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error={error}", code=303)
    
    # Get the authorization code
    code = request.args.get('code')
    if not code:
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=no_code", code=303)
    
    # Exchange authorization code for tokens
    google_config = generate_google_oauth_config()
    token_response = requests.post(
        google_config['token_uri'],
        data={
            'code': code,
            'client_id': google_config['client_id'],
            'client_secret': google_config['client_secret'],
            'redirect_uri': google_config['redirect_uri'],
            'grant_type': 'authorization_code'
        }
    )
    
    if token_response.status_code != 200:
        print(f"Token error: {token_response.text}")
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=token_exchange_failed", code=303)
    
    token_data = token_response.json()
    access_token = token_data.get('access_token')
    
    # Get user info using the access token
    user_info_response = requests.get(
        google_config['userinfo_uri'],
        headers={'Authorization': f"Bearer {access_token}"}
    )
    
    if user_info_response.status_code != 200:
        print(f"User info error: {user_info_response.text}")
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=user_info_failed", code=303)
    
    user_info = user_info_response.json()
    
    # Extract user details
    email = user_info.get('email')
    first_name = user_info.get('given_name', '')
    last_name = user_info.get('family_name', '')
    picture = user_info.get('picture')
    google_id = user_info.get('id')
    
    if not email or not google_id:
        return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=missing_user_info", code=303)
    
    # Find or create user
    user = User.query.filter_by(google_id=google_id).first()
    
    # If user doesn't exist by google_id, try finding by email
    if not user:
        user = User.query.filter_by(email=email).first()
        # If user exists by email but no google_id, update their google_id
        if user:
            user.google_id = google_id
            db.session.commit()
    
    # If still no user, create a new one
    if not user:
        # Handle profile image if available
        image_url = None
        if picture:
            try:
                # Download the image
                response = requests.get(picture)
                if response.status_code == 200:
                    bucket_name = 'profile_images'
                    file_path = f"user_profiles/{google_id}_avatar.jpg"
                    
                    # Upload to Supabase
                    try:
                        supabase.storage.from_(bucket_name).upload(
                            file_path,
                            response.content,
                            file_options={"content-type": "image/jpeg"}
                        )
                        try:
                            # Generate a signed URL with the Supabase client
                            signed_url = supabase.storage.from_(bucket_name).create_signed_url(
                                file_path,
                                60 * 60 * 24 * 7  # 7 days expiration in seconds
                            )
                            # Extract the complete signed URL
                            image_url = signed_url['signedURL']
                        except Exception as e:
                            print(f"Error generating signed URL: {e}")
                            # Fallback to a default image or handle the error appropriately
                            image_url = None
                    except Exception as e:
                        print(f"Error uploading image: {e}")
                        # Fall back to the Google-provided URL
                        image_url = picture
            except Exception as e:
                print(f"Error processing profile image: {e}")
                image_url = picture
        
        # Create new user
        user = User(
            email=email,
            username=f"{first_name} {last_name}".strip() or email.split('@')[0],
            google_id=google_id,
            is_verified=True,
            image_url=image_url
        )
        
        try:
            db.session.add(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Error creating user: {e}")
            return redirect(f"{os.getenv('FRONTEND_URL')}/login?error=user_creation_failed", code=303)
    
    # Generate JWT tokens
    jwt_access_token = create_access_token(
        identity=user.id,
        additional_claims={
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'picture': user.image_url or picture
        }
    )
    print(f"Access token: {jwt_access_token}")
    refresh_token = create_refresh_token(identity=user.id)
    
    # Determine authentication provider
    auth_provider = "google"
    
    # Redirect to frontend with token
    frontend_url = os.getenv('FRONTEND_URL')
    redirect_url = f"{frontend_url}?token={jwt_access_token}&authProvider={auth_provider}"
    
    return redirect(redirect_url, code=303)

@auth_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    """Get user information from JWT token (similar to GetUser in Golang)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get additional claims from the token
    # This matches the Golang structure where claims are extracted from the token
    return jsonify(user.to_dict()), 200

# Keep your existing routes for non-Google authentication
@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        # Get form data instead of JSON
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        profile_image = request.files.get('profile_image')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'Email already exists'}), 400

        # Handle image upload
        image_url = None
        if profile_image and profile_image.filename != '':
            # Generate unique filename
            file_ext = os.path.splitext(profile_image.filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_ext}"
            
            # Upload to Supabase Storage
            bucket_name = 'profile_images'
            file_path = f"user_profiles/{unique_filename}"
            
            # Upload the file
            try:
                supabase.storage.from_(bucket_name).upload(
                    file_path,
                    profile_image.read(),
                    file_options={"content-type": profile_image.mimetype}
                )
                # Generate public URL
                image_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/{bucket_name}/{file_path}"
            except Exception as upload_error:
                print(f"Error uploading image: {upload_error}")
                return jsonify({'error': 'Failed to upload profile image'}), 500

        # Create new user
        new_user = User(
            email=email,
            username=username,
            is_verified=False,
            image_url=image_url  # This will be None if no image was uploaded
        )
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()

        # Generate JWT tokens for immediate login after registration
        access_token = create_access_token(identity=new_user.id)
        refresh_token = create_refresh_token(identity=new_user.id)

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': new_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data['email']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict()
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    current_user_id = get_jwt_identity()
    access_token = create_access_token(identity=current_user_id)
    
    return jsonify({'access_token': access_token}), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    # Similar to the Golang implementation - just return OK
    # Since JWTs are stateless, actual logout happens on client side
    return jsonify({'message': 'Logged out successfully'}), 200