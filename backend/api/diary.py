from flask import Blueprint, request, jsonify
from db import (
    get_all_diaries, get_diaries_by_date, get_diary_by_id,
    save_diary, delete_diary, delete_plaza_conversation_by_date,
    delete_diary_by_date, get_tree_state, save_tree_state,
    get_well_state, save_well_state
)

diary_bp = Blueprint("diary", __name__)

@diary_bp.route("/api/diaries", methods=["GET"])
def list_diaries():
    date = request.args.get("date")
    if date:
        diaries = get_diaries_by_date(date)
    else:
        diaries = get_all_diaries()
    return jsonify(diaries)

@diary_bp.route("/api/diaries/<diary_id>", methods=["GET"])
def get_diary(diary_id):
    diary = get_diary_by_id(diary_id)
    if diary:
        return jsonify(diary)
    return jsonify({"error": "일기를 찾을 수 없습니다."}), 404

@diary_bp.route("/api/diaries", methods=["POST"])
def create_diary_endpoint():
    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 데이터가 없습니다."}), 400
    if save_diary(data):
        return jsonify({"success": True, "message": "일기가 저장되었습니다."})
    return jsonify({"error": "일기 저장에 실패했습니다."}), 500

@diary_bp.route("/api/diaries/<diary_id>", methods=["DELETE"])
def delete_diary_endpoint(diary_id):
    if delete_diary(diary_id):
        return jsonify({"success": True, "message": "일기가 삭제되었습니다."})
    return jsonify({"error": "일기 삭제에 실패했습니다."}), 500

@diary_bp.route("/api/diaries/replace", methods=["POST"])
def replace_diary():
    data = request.get_json() or {}
    date = data.get("date")
    old_emotion_scores = data.get("old_emotion_scores", {})
    new_diary_data = data.get("new_diary")
    if not date or not new_diary_data:
        return jsonify({"error": "날짜와 새 일기 데이터가 필요합니다."}), 400

    old_positive_score = (old_emotion_scores.get("기쁨", 0) or 0) + (old_emotion_scores.get("사랑", 0) or 0)
    old_negative_score = (
        (old_emotion_scores.get("분노", 0) or 0) +
        (old_emotion_scores.get("슬픔", 0) or 0) +
        (old_emotion_scores.get("두려움", 0) or 0) +
        (old_emotion_scores.get("부끄러움", 0) or 0)
    )
    if old_positive_score > 0:
        state = get_tree_state()
        new_growth = max(0, state.get("growth", 0) - old_positive_score)
        stage_thresholds = [0, 40, 100, 220, 380, 600]
        new_stage = state.get("stage", 0)
        for i in range(len(stage_thresholds) - 1, -1, -1):
            if new_growth >= stage_thresholds[i]:
                new_stage = i
                break
        save_tree_state({"growth": new_growth, "stage": new_stage, "lastFruitDate": state.get("lastFruitDate")})
    if old_negative_score > 0:
        state = get_well_state()
        new_water_level = max(0, state.get("waterLevel", 0) - old_negative_score)
        is_overflowing = new_water_level >= 500
        save_well_state({
            "waterLevel": new_water_level,
            "isOverflowing": is_overflowing,
            "lastOverflowDate": state.get("lastOverflowDate")
        })
    delete_plaza_conversation_by_date(date)
    delete_diary_by_date(date)
    if save_diary(new_diary_data):
        return jsonify({"success": True, "message": "일기가 덮어씌워졌습니다."})
    return jsonify({"error": "일기 저장에 실패했습니다."}), 500


