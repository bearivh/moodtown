from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from db import (
    get_all_diaries,
    get_diaries_by_date,
    get_diary_by_id,
    save_diary,
    delete_diary,
    delete_plaza_conversation_by_date,
    delete_diary_by_date,
    get_tree_state,
    save_tree_state,
    get_well_state,
    save_well_state,
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

    old_positive_score = (old_emotion_scores.get("기쁨", 0) or 0) + (
        old_emotion_scores.get("사랑", 0) or 0
    )
    # 스트레스 우물을 차오르게 하는 감정: 슬픔, 분노, 두려움
    old_negative_score = (
        (old_emotion_scores.get("분노", 0) or 0)
        + (old_emotion_scores.get("슬픔", 0) or 0)
        + (old_emotion_scores.get("두려움", 0) or 0)
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
        save_tree_state(
            {
                "growth": new_growth,
                "stage": new_stage,
                "lastFruitDate": state.get("lastFruitDate"),
            }
        )
    if old_negative_score > 0:
        state = get_well_state()
        new_water_level = max(0, state.get("waterLevel", 0) - old_negative_score)
        is_overflowing = new_water_level >= 500
        save_well_state(
            {
                "waterLevel": new_water_level,
                "isOverflowing": is_overflowing,
                "lastOverflowDate": state.get("lastOverflowDate"),
            }
        )
    delete_plaza_conversation_by_date(date)
    delete_diary_by_date(date)
    if save_diary(new_diary_data):
        return jsonify({"success": True, "message": "일기가 덮어씌워졌습니다."})
    return jsonify({"error": "일기 저장에 실패했습니다."}), 500


@diary_bp.route("/api/stats/office", methods=["GET"])
def get_office_stats():
    """
    마을사무소에서 보여줄 감정 통계.

    - 전체 일기의 emotion_scores를 합산하여 Top 3 감정 및 비중 계산
    - 행복 나무 / 스트레스 우물 상태를 기반으로 기여도 요약
    """
    diaries = get_all_diaries()

    # 감정 점수 합산 (일기 emotion_scores 기준, 전체 기준 Top3)
    emotion_keys = ["기쁨", "사랑", "놀람", "두려움", "분노", "부끄러움", "슬픔"]
    emotion_totals = {k: 0 for k in emotion_keys}

    for diary in diaries:
        scores = diary.get("emotion_scores") or {}
        for key in emotion_keys:
            value = scores.get(key, 0) or 0
            try:
                emotion_totals[key] += float(value)
            except (TypeError, ValueError):
                # 숫자가 아닌 값이 들어와도 서비스가 죽지 않도록 방어
                continue

    total_emotion_score = sum(emotion_totals.values())

    sorted_emotions = sorted(
        emotion_totals.items(), key=lambda item: item[1], reverse=True
    )
    top_emotions = []
    for name, score in sorted_emotions[:3]:
        if score <= 0:
            continue
        ratio = (score / total_emotion_score) if total_emotion_score > 0 else 0
        top_emotions.append(
            {
                "name": name,
                "score": score,
                "ratio": ratio,
            }
        )

    # 행복 나무 / 스트레스 우물 기여도 요약 (최근 7일 기준)
    today = datetime.now().date()
    week_start = today - timedelta(days=6)

    weekly_tree_value = 0.0  # 긍정 기여 (기쁨 + 사랑)
    weekly_well_value = 0.0  # 부정 기여 (분노 + 슬픔 + 두려움 + 부끄러움)

    for diary in diaries:
        diary_date_str = diary.get("date")
        if not diary_date_str:
            continue
        try:
            diary_date = datetime.strptime(diary_date_str, "%Y-%m-%d").date()
        except Exception:
            # 날짜 포맷이 이상해도 서비스 중단 방지
            continue

        if not (week_start <= diary_date <= today):
            continue

        scores = diary.get("emotion_scores") or {}

        def safe_float(v):
            try:
                return float(v or 0)
            except (TypeError, ValueError):
                return 0.0

        # 행복 나무를 자라게 하는 감정: 사랑, 기쁨
        pos = safe_float(scores.get("기쁨")) + safe_float(scores.get("사랑"))
        # 스트레스 우물을 차오르게 하는 감정: 슬픔, 분노, 두려움
        neg = safe_float(scores.get("분노")) + safe_float(scores.get("슬픔")) + safe_float(
            scores.get("두려움")
        )

        weekly_tree_value += pos
        weekly_well_value += neg

    total_tree_well = weekly_tree_value + weekly_well_value
    tree_ratio = (weekly_tree_value / total_tree_well) if total_tree_well > 0 else 0
    well_ratio = (weekly_well_value / total_tree_well) if total_tree_well > 0 else 0

    return jsonify(
        {
            "topEmotions": top_emotions,
            "totalEmotionScore": total_emotion_score,
            "treeWellContribution": {
                "tree": {
                    "value": weekly_tree_value,
                    "ratio": tree_ratio,
                },
                "well": {
                    "value": weekly_well_value,
                    "ratio": well_ratio,
                },
            },
            "totalTreeWellValue": total_tree_well,
        }
    )

