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
from utils.email_sender import generate_otp, send_otp_email
import redis
import time

load_dotenv()

supabase: Client = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_SERVICE_ROLE_KEY'))

auth_bp = Blueprint('auth', __name__)

# OAuth State String for CSRF protection (similar to oauthStateString in Golang)
OAUTH_STATE_STRING = secrets.token_hex(16)

# JWT Secret (similar to jwtSecret in Golang)
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'c2lrbG9NTkw')

# Initialize Redis for OTP storage with connection retry and error handling
def init_redis():
    """Initialize Redis connection with retry logic"""
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                db=0,
                decode_responses=True,
                socket_timeout=5,  # 5 seconds timeout
                socket_connect_timeout=5,  # 5 seconds connection timeout
                retry_on_timeout=True
            )
            # Test the connection
            redis_client.ping()
            print("✅ Successfully connected to Redis")
            return redis_client
        except redis.ConnectionError as e:
            if attempt < max_retries - 1:
                print(f"⚠️ Redis connection attempt {attempt + 1} failed: {str(e)}")
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("❌ Failed to connect to Redis after multiple attempts")
                raise
        except Exception as e:
            print(f"❌ Unexpected error connecting to Redis: {str(e)}")
            raise

try:
    redis_client = init_redis()
except Exception as e:
    print(f"❌ Redis initialization failed: {str(e)}")
    print("⚠️ Running without Redis - OTP functionality will be disabled")
    redis_client = None

# OTP expiration time (10 minutes)
OTP_EXPIRY = 600

def init_jwt(app):
    """Initialize JWT with the Flask app"""
    app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    jwt = JWTManager(app)
    return jwt

ORGANIZATION_DOMAIN = os.getenv('ORGANIZATION_DOMAIN')

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
    # auth_url = f"{google_config['auth_uri']}?client_id={google_config['client_id']}&redirect_uri={google_config['redirect_uri']}&response_type=code&scope={google_config['scope']}&state={OAUTH_STATE_STRING}"
    auth_url = (
        f"{google_config['auth_uri']}?client_id={google_config['client_id']}"
        f"&redirect_uri={google_config['redirect_uri']}&response_type=code"
        f"&scope={google_config['scope']}&state={OAUTH_STATE_STRING}"
        f"&hd={ORGANIZATION_DOMAIN}"
    )
    
    return redirect(auth_url)

@auth_bp.route('/google/callback', methods=['GET'])
def google_callback():
    """Handle Google OAuth callback"""
    # Check for error parameter
    error = request.args.get('error')
    if error:
        # User cancelled the login or another error occurred
        return redirect(f"{os.getenv('ERROR_PAGE')}?error={error}", code=303)
    
    # Get the authorization code
    code = request.args.get('code')
    if not code:
        return redirect(f"{os.getenv('ERROR_PAGE')}?error=no_code", code=303)
    
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
        return redirect(f"{os.getenv('ERROR_PAGE')}?error=token_exchange_failed", code=303)
    
    token_data = token_response.json()
    access_token = token_data.get('access_token')
    
    # Get user info using the access token
    user_info_response = requests.get(
        google_config['userinfo_uri'],
        headers={'Authorization': f"Bearer {access_token}"}
    )
    
    if user_info_response.status_code != 200:
        print(f"User info error: {user_info_response.text}")
        return redirect(f"{os.getenv('ERROR_PAGE')}?error=user_info_failed", code=303)
    
    user_info = user_info_response.json()
    
    # Extract user details
    email = user_info.get('email')
    first_name = user_info.get('given_name', '')
    last_name = user_info.get('family_name', '')
    picture = user_info.get('picture')
    google_id = user_info.get('id')
    
    if not email or not google_id:
        return redirect(f"{os.getenv('ERROR_PAGE')}?error=missing_user_info", code=303)
    
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
            image_url=image_url,
            role='Attendant' if not user else user.role  # Only set default role for new users
        )
        
        try:
            db.session.add(user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Error creating user: {e}")
            return redirect(f"{os.getenv('ERROR_PAGE')}?error=user_creation_failed", code=303)
    
    # Generate JWT tokens
    jwt_access_token = create_access_token(
        identity=user.id,
        additional_claims={
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'picture': user.image_url or picture,
            'role': user.role,
            'is_blocked': user.is_blocked
        }
    )
    print(f"JWT Claims: {jwt_access_token}")
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

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        # Get form data
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        profile_image = request.files.get('profile_image')

        print(f"📝 Registration attempt for email: {email}")

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # Check if user exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'Email already exists'}), 400

        # Handle image upload if provided
        image_url = None
        if profile_image and profile_image.filename != '':
            try:
                # Generate unique filename
                file_ext = os.path.splitext(profile_image.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_ext}"
                
                # Upload to Supabase Storage
                bucket_name = 'profile.images'
                file_path = f"user_profiles/{unique_filename}"
                
                print(f"📤 Uploading image to Supabase: {file_path}")
                
                # Upload the file
                supabase.storage.from_(bucket_name).upload(
                    file_path,
                    profile_image.read(),
                    file_options={"content-type": profile_image.mimetype}
                )
                
                # Generate public URL
                image_url = f"{os.getenv('SUPABASE_URL')}/storage/v1/object/public/{bucket_name}/{file_path}"
                print(f"✅ Image uploaded successfully: {image_url}")
                
            except Exception as upload_error:
                print(f"❌ Error uploading image: {upload_error}")
                return jsonify({'error': 'Failed to upload profile image'}), 500

        # Generate OTP
        otp = generate_otp()
        print(f"🔑 Generated OTP: {otp}")
        
        # Store OTP in Redis with expiration
        if redis_client is None:
            return jsonify({'error': 'OTP service is currently unavailable'}), 503

        otp_key = f"register_otp:{email}"
        otp_data = {
            'otp': otp,
            'username': username,
            'password': generate_password_hash(password),
            'image_url': image_url,
            'role': 'Attendant'  # Default role for new users
        }
        
        print(f"💾 Storing OTP data in Redis: {otp_data}")
        redis_client.setex(
            otp_key,
            OTP_EXPIRY,
            json.dumps(otp_data)
        )

        # Verify the data was stored correctly
        stored_data = redis_client.get(otp_key)
        print(f"✅ Verified stored data: {stored_data}")

        # Send OTP email
        if send_otp_email(email, otp):
            print(f"✅ OTP email sent to: {email}")
            return jsonify({
                'message': 'OTP sent to your email',
                'email': email,
                'requires_otp': True
            }), 200
        else:
            print("❌ Failed to send OTP email")
            return jsonify({'error': 'Failed to send OTP'}), 500

    except redis.RedisError as e:
        print(f"❌ Redis error during registration: {str(e)}")
        return jsonify({'error': 'OTP service is currently unavailable'}), 503
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        return jsonify({'error': str(e)}), 500
    



#Mag install ng redis first before paganahin itong endpoints, also set up redis first before running the endpoints




@auth_bp.route('/verify-registration', methods=['POST'])
def verify_registration():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')

        print(f"🔍 Verifying registration for email: {email}")
        print(f"🔑 Received OTP: {otp}")

        if not email or not otp:
            print("❌ Missing email or OTP")
            return jsonify({'error': 'Email and OTP are required'}), 400

        # Get stored OTP data
        otp_key = f"register_otp:{email}"
        stored_data = redis_client.get(otp_key)
        
        print(f"📦 Stored data from Redis: {stored_data}")

        if not stored_data:
            print("❌ No stored data found in Redis")
            return jsonify({'error': 'OTP expired or invalid'}), 400

        stored_data = json.loads(stored_data)
        print(f"🔐 Stored OTP: {stored_data['otp']}")
        
        if otp != stored_data['otp']:
            print(f"❌ OTP mismatch - Received: {otp}, Stored: {stored_data['otp']}")
            return jsonify({'error': 'Invalid OTP'}), 400

        print("✅ OTP verified successfully")

        # Create new user
        new_user = User(
            email=email,
            username=stored_data['username'],
            password_hash=stored_data['password'],
            image_url=stored_data['image_url'],
            role=stored_data.get('role', 'Attendant'),  # Get role from stored data or default to 'Attendant'
            is_verified=True
        )
        
        db.session.add(new_user)
        db.session.commit()

        # Clean up OTP
        redis_client.delete(otp_key)

        # Generate tokens
        access_token = create_access_token(identity=new_user.id)
        refresh_token = create_refresh_token(identity=new_user.id)

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': new_user.to_dict()
        }), 201

    except Exception as e:
        print(f"❌ Error during verification: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400

        # Find user
        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Generate OTP
        otp = generate_otp()
        
        # Store OTP in Redis
        otp_key = f"login_otp:{email}"
        redis_client.setex(
            otp_key,
            OTP_EXPIRY,
            json.dumps({
                'otp': otp,
                'user_id': str(user.id)
            })
        )

        # Send OTP email
        if send_otp_email(email, otp):
            return jsonify({
                'message': 'OTP sent to your email',
                'email': email,
                'requires_otp': True
            }), 200
        else:
            return jsonify({'error': 'Failed to send OTP'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify-login', methods=['POST'])
def verify_login():
    try:
        data = request.get_json()
        email = data.get('email')
        otp = data.get('otp')

        if not email or not otp:
            return jsonify({'error': 'Email and OTP are required'}), 400

        # Get stored OTP data
        otp_key = f"login_otp:{email}"
        stored_data = redis_client.get(otp_key)

        if not stored_data:
            return jsonify({'error': 'OTP expired or invalid'}), 400

        stored_data = json.loads(stored_data)
        
        if otp != stored_data['otp']:
            return jsonify({'error': 'Invalid OTP'}), 400

        # Get user
        user = User.query.get(stored_data['user_id'])
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Clean up OTP
        redis_client.delete(otp_key)

        # Generate tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)

        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

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

@auth_bp.route('/test-email', methods=['POST'])
def test_email():
    try:
        data = request.get_json()
        test_email = data.get('email')
        
        if not test_email:
            return jsonify({'error': 'Email is required'}), 400

        # Generate test OTP
        otp = generate_otp()
        
        # Send test email
        if send_otp_email(test_email, otp):
            return jsonify({
                'message': 'Test email sent successfully',
                'otp': otp  # Only for testing, remove in production
            }), 200
        else:
            return jsonify({'error': 'Failed to send test email'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500