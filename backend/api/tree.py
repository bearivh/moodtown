from flask import Blueprint, request, jsonify
from db import get_tree_state, save_tree_state, get_happy_fruit_count, save_happy_fruit_count

tree_bp = Blueprint("tree", __name__)

@tree_bp.route("/api/tree/state", methods=["GET"])
def get_tree():
    state = get_tree_state()
    return jsonify(state)

@tree_bp.route("/api/tree/state", methods=["POST"])
def update_tree():
    data = request.get_json() or {}
    if save_tree_state(data):
        return jsonify({"success": True, "message": "나무 상태가 저장되었습니다."})
    return jsonify({"error": "나무 상태 저장에 실패했습니다."}), 500

@tree_bp.route("/api/tree/fruits", methods=["GET"])
def get_fruits():
    count = get_happy_fruit_count()
    return jsonify({"count": count})

@tree_bp.route("/api/tree/fruits", methods=["POST"])
def update_fruits():
    data = request.get_json() or {}
    count = data.get("count", 0)
    if save_happy_fruit_count(count):
        return jsonify({"success": True, "count": count})
    return jsonify({"error": "열매 개수 저장에 실패했습니다."}), 500

@tree_bp.route("/api/tree/subtract", methods=["POST"])
def subtract_tree_growth():
    data = request.get_json() or {}
    subtract_amount = data.get("amount", 0)
    state = get_tree_state()
    new_growth = max(0, state.get("growth", 0) - subtract_amount)
    stage_thresholds = [0, 40, 100, 220, 380, 600]
    new_stage = state.get("stage", 0)
    for i in range(len(stage_thresholds) - 1, -1, -1):
        if new_growth >= stage_thresholds[i]:
            new_stage = i
            break
    new_state = {
        "growth": new_growth,
        "stage": new_stage,
        "lastFruitDate": state.get("lastFruitDate")
    }
    if save_tree_state(new_state):
        return jsonify({"success": True, "growth": new_growth, "stage": new_stage})
    return jsonify({"error": "나무 상태 업데이트에 실패했습니다."}), 500


