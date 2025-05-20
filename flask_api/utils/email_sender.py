import os
from dotenv import load_dotenv
import random
import string
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# SendGrid configuration
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
SENDER_EMAIL = os.getenv('SENDER_EMAIL')

def verify_sendgrid_credentials():
    """Verify SendGrid credentials are properly configured"""
    if not SENDGRID_API_KEY:
        logger.error("SendGrid API key not found in environment variables")
        return False
    
    if not SENDER_EMAIL:
        logger.error("Sender email not found in environment variables")
        return False
    
    return True

def generate_otp(length=6):
    """Generate a random OTP"""
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(receiver_email, otp):
    """Send OTP email to user using SendGrid"""
    if not verify_sendgrid_credentials():
        logger.error("SendGrid credentials verification failed")
        return False

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        
        # Create email content
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Your Verification Code</h2>
                <p>Please use the following code to verify your account:</p>
                <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
                    <strong>{otp}</strong>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <hr style="border: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
            </body>
        </html>
        """

        # Create message
        message = Mail(
            from_email=Email(SENDER_EMAIL),
            to_emails=To(receiver_email),
            subject='Your KoTsek Verification Code',
            html_content=Content("text/html", html_content)
        )

        # Send email
        logger.info(f"Sending OTP email to: {receiver_email}")
        response = sg.send(message)
        logger.info(f"Email sent successfully. Status code: {response.status_code}")
        
        return True
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return False

def test_sendgrid_connection():
    """Test SendGrid connection and credentials"""
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        # Try to get account information to test the connection
        response = sg.client.api_keys.get()
        logger.info("SendGrid connection test successful!")
        return True
    except Exception as e:
        logger.error(f"SendGrid connection test failed: {str(e)}")
        return False

# Test the connection when the module is imported
if __name__ == "__main__":
    test_sendgrid_connection() 