from db.db import db
import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

def generate_uuid():
    return str(uuid.uuid4())