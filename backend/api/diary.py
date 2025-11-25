import os
import sys
from flask import Blueprint, request, jsonify, session
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
    save_plaza_conversation,
    get_plaza_conversation_by_date,
    save_letter,
)
from .middleware import get_current_user_id
from services.letter_generator import generate_letter_with_gpt
import json

# 유사 일기 검색 서비스 import
_HAS_SIMILARITY = False
try:
    # 절대 경로로 services 모듈 import
    from services.diary_similarity import find_similar_diaries, find_similar_diaries_by_text, load_model
    _HAS_SIMILARITY = True
    print("[diary.py] 유사 일기 검색 모듈 로드 성공")
    # 서버 시작 시 모델 미리 로드 시도
    try:
        model_loaded = load_model()
        if model_loaded:
            print("[diary.py] 모델 미리 로드 성공")
        else:
            print("[diary.py] 모델 미리 로드 실패 - API 호출 시 다시 시도됩니다")
    except Exception as model_e:
        print(f"[diary.py] 모델 미리 로드 중 오류: {model_e}")
except Exception as e:
    import traceback
    print(f"[diary.py] 유사 일기 검색 모듈 로드 실패: {e}")
    traceback.print_exc()
    _HAS_SIMILARITY = False

diary_bp = Blueprint("diary", __name__)


@diary_bp.route("/api/diaries", methods=["GET"])
def list_diaries():
    user_id = get_current_user_id()
    date = request.args.get("date")
    if date:
        diaries = get_diaries_by_date(date, user_id)
    else:
        diaries = get_all_diaries(user_id)
    return jsonify(diaries)

@diary_bp.route("/api/diaries/<diary_id>", methods=["GET"])
def get_diary(diary_id):
    diary = get_diary_by_id(diary_id)
    if diary:
        return jsonify(diary)
    return jsonify({"error": "일기를 찾을 수 없습니다."}), 404


@diary_bp.route("/api/diaries", methods=["POST"])
def create_diary_endpoint():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401
    
    data = request.get_json()
    if not data:
        return jsonify({"error": "요청 데이터가 없습니다."}), 400
    
    if save_diary(data, user_id):
        # 일기 저장 성공 후 감정 점수 확인하여 편지 생성
        emotion_scores_raw = data.get('emotion_scores', {})
        
        # emotion_scores 파싱 (다양한 형식 지원)
        emotion_scores = {}
        if isinstance(emotion_scores_raw, str):
            try:
                parsed = json.loads(emotion_scores_raw)
                if isinstance(parsed, dict) and 'emotion_scores' in parsed:
                    emotion_scores = parsed.get('emotion_scores', {})
                else:
                    emotion_scores = parsed
            except:
                emotion_scores = {}
        elif isinstance(emotion_scores_raw, dict):
            if 'emotion_scores' in emotion_scores_raw:
                emotion_scores = emotion_scores_raw.get('emotion_scores', {})
            else:
                emotion_scores = emotion_scores_raw
        
        if emotion_scores and isinstance(emotion_scores, dict):
            # 감정 점수가 70점 이상인 감정 찾기
            EMOTION_THRESHOLD = 70
            high_emotions = []
            
            for emotion, score in emotion_scores.items():
                if isinstance(score, (int, float)) and score >= EMOTION_THRESHOLD:
                    high_emotions.append({'emotion': emotion, 'score': score})
            
            # 가장 높은 감정 하나만 선택 (여러 개면 가장 높은 것)
            if high_emotions:
                high_emotions.sort(key=lambda x: x['score'], reverse=True)
                top_emotion = high_emotions[0]
                
                try:
                    # 해당 감정 주민에게 편지 생성
                    letter_data = generate_letter_with_gpt(
                        letter_type='emotion_high',
                        emotion_scores={
                            'emotion_name': top_emotion['emotion'],
                            'score': top_emotion['score']
                        },
                        diary_text=data.get('content', '')
                    )
                    
                    # 편지 저장
                    letter = {
                        'title': letter_data.get('title', '💌 주민들의 편지'),
                        'content': letter_data.get('content', ''),
                        'from': letter_data.get('from', '감정 마을'),
                        'type': 'emotion_high',
                        'date': data.get('date', datetime.now().strftime('%Y-%m-%d'))
                    }
                    save_letter(letter, user_id)
                    print(f"[편지 생성] {top_emotion['emotion']} 감정이 {top_emotion['score']}점으로 높아서 편지 생성됨")
                except Exception as e:
                    print(f"[편지 생성 실패] 감정 점수 기반 편지 생성 오류: {e}")
                    import traceback
                    traceback.print_exc()
                    # 편지 생성 실패해도 일기 저장은 성공으로 처리
        
        return jsonify({"success": True, "message": "일기가 저장되었습니다."})
    return jsonify({"error": "일기 저장에 실패했습니다."}), 500


@diary_bp.route("/api/diaries/<diary_id>", methods=["DELETE"])
def delete_diary_endpoint(diary_id):
    if delete_diary(diary_id):
        return jsonify({"success": True, "message": "일기가 삭제되었습니다."})
    return jsonify({"error": "일기 삭제에 실패했습니다."}), 500


@diary_bp.route("/api/diaries/replace", methods=["POST"])
def replace_diary():
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401
    
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
        state = get_tree_state(user_id)
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
            },
            user_id
        )
    if old_negative_score > 0:
        state = get_well_state(user_id)
        new_water_level = max(0, state.get("waterLevel", 0) - old_negative_score)
        is_overflowing = new_water_level >= 500
        save_well_state(
            {
                "waterLevel": new_water_level,
                "isOverflowing": is_overflowing,
                "lastOverflowDate": state.get("lastOverflowDate"),
            },
            user_id
        )
    delete_plaza_conversation_by_date(date)
    delete_diary_by_date(date)
    if save_diary(new_diary_data, user_id):
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
    weekly_well_value = 0.0  # 부정 기여 (분노 + 슬픔 + 두려움)

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


@diary_bp.route("/api/plaza/conversations/<date>", methods=["GET"])
def get_plaza_conversation(date):
    """특정 날짜의 광장 대화 가져오기"""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({
            "conversation": [],
            "emotionScores": {}
        })
    
    try:
        conversation = get_plaza_conversation_by_date(date, user_id)
        if conversation:
            return jsonify({
                "conversation": conversation.get("conversation", []),
                "emotionScores": conversation.get("emotionScores", {})
            })
        # 대화가 없는 경우 빈 응답 반환 (404 대신 200으로 빈 데이터 반환)
        return jsonify({
            "conversation": [],
            "emotionScores": {}
        })
    except Exception as e:
        print(f"광장 대화 가져오기 오류: {e}")
        import traceback
        traceback.print_exc()
        # 에러 발생 시에도 빈 응답 반환 (500 대신 200으로 빈 데이터 반환)
        return jsonify({
            "conversation": [],
            "emotionScores": {}
        })


@diary_bp.route("/api/plaza/conversations", methods=["POST"])
def save_plaza_conversation_endpoint():
    """광장 대화 저장"""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"error": "로그인이 필요합니다."}), 401
    
    data = request.get_json() or {}
    date = data.get("date")
    conversation = data.get("conversation", [])
    emotion_scores = data.get("emotionScores", {})
    
    if not date:
        return jsonify({"error": "날짜가 필요합니다."}), 400
    
    if save_plaza_conversation(date, conversation, emotion_scores, user_id):
        return jsonify({"success": True, "message": "대화가 저장되었습니다."})
    return jsonify({"error": "대화 저장에 실패했습니다."}), 500


@diary_bp.route("/api/diaries/<diary_id>/similar", methods=["GET"])
def get_similar_diaries(diary_id):
    """특정 일기와 유사한 일기 찾기"""
    print(f"[유사일기검색] 요청 받음 - diary_id: {diary_id}, _HAS_SIMILARITY: {_HAS_SIMILARITY}")
    
    if not _HAS_SIMILARITY:
        print("[유사일기검색] _HAS_SIMILARITY가 False입니다. 모듈이 로드되지 않았습니다.")
        return jsonify({
            "success": False,
            "error": "유사 일기 검색 모듈을 로드할 수 없습니다. Flask 서버를 재시작해주세요.",
            "hint": "서버 시작 시 '[diary.py] 유사 일기 검색 모듈 로드 성공' 메시지가 나타나야 합니다. 없다면 서버를 재시작하거나 gensim을 설치해주세요: pip install gensim"
        }), 503
    
    limit = request.args.get("limit", 5, type=int)
    min_similarity = request.args.get("min_similarity", 0.3, type=float)
    
    try:
        print(f"[유사일기검색] 일기 ID: {diary_id}, limit: {limit}, min_similarity: {min_similarity}")
        similar_diaries = find_similar_diaries(
            target_diary_id=diary_id,
            limit=limit,
            min_similarity=min_similarity
        )
        print(f"[유사일기검색] 결과: {type(similar_diaries)}, 개수: {len(similar_diaries) if similar_diaries is not None else 'None'}")
        
        # 모델이 로드되지 않았을 경우
        if similar_diaries is None:
            print("⚠️ [유사일기검색] 모델 로드 실패로 None 반환")
            return jsonify({
                "success": False,
                "error": "유사 일기 검색 모델이 로드되지 않았습니다.",
                "hint": "모델 파일이 없거나 손상되었을 수 있습니다. train_diary_similarity.py 스크립트로 모델을 학습시켜주세요."
            }), 503
        
        return jsonify({
            "success": True,
            "similar_diaries": similar_diaries,
            "count": len(similar_diaries)
        })
    except Exception as e:
        print(f"❌ [유사일기검색] 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"유사 일기 검색 중 오류가 발생했습니다: {str(e)}"
        }), 500


@diary_bp.route("/api/diaries/similar", methods=["POST"])
def find_similar_diaries_by_text_endpoint():
    """텍스트를 기준으로 유사한 일기 찾기"""
    if not _HAS_SIMILARITY:
        return jsonify({"error": "유사 일기 검색 기능을 사용할 수 없습니다. 모델이 학습되지 않았을 수 있습니다."}), 503
    
    data = request.get_json() or {}
    text = data.get("text") or data.get("content")
    
    if not text:
        return jsonify({"error": "텍스트가 필요합니다."}), 400
    
    limit = data.get("limit", 5)
    min_similarity = data.get("min_similarity", 0.3)
    
    try:
        similar_diaries = find_similar_diaries_by_text(
            text=text,
            limit=limit,
            min_similarity=min_similarity
        )
        return jsonify({
            "success": True,
            "similar_diaries": similar_diaries,
            "count": len(similar_diaries)
        })
    except Exception as e:
        print(f"유사 일기 검색 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "유사 일기 검색 중 오류가 발생했습니다."}), 500

