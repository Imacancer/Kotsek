from models.guards import Guard
from flask import request, jsonify, Blueprint, current_app


guard_bp = Blueprint('guard', __name__)

@guard_bp.route('/guard/set-active-guard', methods=['POST'])
def set_active_guard():
    try:
        data = request.get_json()
        guard_id = data.get('guard_id')
        
        # If guard_id is None, it means deactivate the current guard
        if guard_id is None:
            current_app.set_active_guard(None)
            return jsonify({
                "success": True,
                "message": "Guard deactivated. New detections will be unassigned.",
                "active_guard": None
            })
            
        # Verify the guard exists
        guard = Guard.query.get(guard_id)
        if not guard:
            return jsonify({"success": False, "error": "Guard not found"}), 404
            
        # Set the active guard in the video processor
        success = current_app.set_active_guard(guard_id)
        if success:
            return jsonify({
                "success": True,
                "message": f"Active guard set to: {guard.name}",
                "active_guard": {
                    "id": str(guard.guard_id),
                    "name": guard.name
                }
            })
        else:
            return jsonify({"success": False, "error": "Failed to set active guard"}), 500
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    

@guard_bp.route('/guard/active-guard', methods=['GET'])
def get_active_guard():
    try:
        guard_id = current_app.video_processor.active_guard_id
        if not guard_id:
            return jsonify({
                "active_guard": None
            })
            
        # Get guard details
        guard = Guard.query.get(guard_id)
        if not guard:
            return jsonify({
                "active_guard": None
            })
            
        return jsonify({
            "active_guard": {
                "id": str(guard.guard_id),
                "name": guard.name,
                "contact": guard.contact
            }
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@guard_bp.route('/guard/guards', methods=['GET'])
def get_all_guards():
    try:
        # Get all active guards
        guards = Guard.query.filter_by(is_active=True).all()
        
        # Format the guard data
        result = []
        for guard in guards:
            result.append({
                "guard_id": str(guard.guard_id),
                "name": guard.name,
                "contact": guard.contact
            })
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500