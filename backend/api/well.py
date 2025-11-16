from flask import Blueprint, request, jsonify
from db import get_well_state, save_well_state

well_bp = Blueprint("well", __name__)

@well_bp.route("/api/well/state", methods=["GET"])
def get_well():
    state = get_well_state()
    return jsonify(state)

@well_bp.route("/api/well/state", methods=["POST"])
def update_well():
    data = request.get_json() or {}
    if save_well_state(data):
        return jsonify({"success": True, "message": "우물 상태가 저장되었습니다."})
    return jsonify({"error": "우물 상태 저장에 실패했습니다."}), 500

@well_bp.route("/api/well/subtract", methods=["POST"])
def subtract_well_water():
    data = request.get_json() or {}
    subtract_amount = data.get("amount", 0)
    state = get_well_state()
    new_water_level = max(0, state.get("waterLevel", 0) - subtract_amount)
    is_overflowing = new_water_level >= 500
    new_state = {
        "waterLevel": new_water_level,
        "isOverflowing": is_overflowing,
        "lastOverflowDate": state.get("lastOverflowDate")
    }
    if save_well_state(new_state):
        return jsonify({"success": True, "waterLevel": new_water_level, "isOverflowing": is_overflowing})
    return jsonify({"error": "우물 상태 업데이트에 실패했습니다."}), 500


