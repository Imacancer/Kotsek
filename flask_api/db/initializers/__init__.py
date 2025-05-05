
from .parking_initializer import initialize_parking_slots

def run_all_initializers():
    """Run all database initializers."""
    initialize_parking_slots()
    # Add other initializers here as needed