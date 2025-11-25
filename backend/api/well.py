from flask import Blueprint, request, jsonify, session
from db import get_well_state, save_well_state
from .middleware import get_current_user_id

well_bp = Blueprint("well", __name__)

@well_bp.route("/api/well/state", methods=["GET"])
def get_well():
    user_id = get_current_user_id() or 0
    state = get_well_state(user_id)
    return jsonify(state)

@well_bp.route("/api/well/state", methods=["POST"])
def update_well():
    user_id = get_current_user_id() or 0
    data = request.get_json() or {}
    if save_well_state(data, user_id):
        return jsonify({"success": True, "message": "우물 상태가 저장되었습니다."})
    return jsonify({"error": "우물 상태 저장에 실패했습니다."}), 500

@well_bp.route("/api/well/subtract", methods=["POST"])
def subtract_well_water():
    user_id = get_current_user_id() or 0
    data = request.get_json() or {}
    subtract_amount = data.get("amount", 0)
    state = get_well_state(user_id)
    new_water_level = max(0, state.get("waterLevel", 0) - subtract_amount)
    is_overflowing = new_water_level >= 500
    new_state = {
        "waterLevel": new_water_level,
        "isOverflowing": is_overflowing,
        "lastOverflowDate": state.get("lastOverflowDate")
    }
    if save_well_state(new_state, user_id):
        return jsonify({"success": True, "waterLevel": new_water_level, "isOverflowing": is_overflowing})
    return jsonify({"error": "우물 상태 업데이트에 실패했습니다."}), 500


