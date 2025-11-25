from flask import Blueprint, request, jsonify
from db import get_all_letters, save_letter, mark_letter_as_read, delete_letter, get_unread_letter_count
from services.letter_generator import generate_letter_with_gpt
from .middleware import get_current_user_id

letters_bp = Blueprint("letters", __name__)

@letters_bp.route("/api/letters", methods=["GET"])
def get_letters():
    """모든 편지 가져오기"""
    user_id = get_current_user_id()
    letters = get_all_letters(user_id)
    return jsonify(letters)

@letters_bp.route("/api/letters", methods=["POST"])
def add_letter():
    """편지 추가"""
    user_id = get_current_user_id()
    data = request.get_json() or {}
    if save_letter(data, user_id):
        return jsonify({"success": True, "message": "편지가 저장되었습니다."})
    return jsonify({"error": "편지 저장에 실패했습니다."}), 500

@letters_bp.route("/api/letters/<letter_id>/read", methods=["POST"])
def mark_read(letter_id):
    """편지 읽음 처리"""
    user_id = get_current_user_id()
    if mark_letter_as_read(letter_id, user_id):
        return jsonify({"success": True, "message": "편지가 읽음 처리되었습니다."})
    return jsonify({"error": "편지 읽음 처리에 실패했습니다."}), 500

@letters_bp.route("/api/letters/<letter_id>", methods=["DELETE"])
def delete_letter_route(letter_id):
    """편지 삭제"""
    user_id = get_current_user_id()
    if delete_letter(letter_id, user_id):
        return jsonify({"success": True, "message": "편지가 삭제되었습니다."})
    return jsonify({"error": "편지 삭제에 실패했습니다."}), 500

@letters_bp.route("/api/letters/unread/count", methods=["GET"])
def get_unread_count():
    """읽지 않은 편지 개수 가져오기"""
    user_id = get_current_user_id()
    count = get_unread_letter_count(user_id)
    return jsonify({"count": count})

@letters_bp.route("/api/letters/generate", methods=["POST"])
def generate_letter():
    """GPT를 사용하여 편지 생성"""
    data = request.get_json() or {}
    letter_type = data.get('type')  # 'celebration', 'comfort', 'cheer', 'well_overflow'
    emotion_scores = data.get('emotion_scores', {})
    fruit_count = data.get('fruit_count')
    diary_text = data.get('diary_text', '')
    
    if not letter_type:
        return jsonify({"error": "type 필드가 필요합니다."}), 400
    
    try:
        letter = generate_letter_with_gpt(
            letter_type=letter_type,
            emotion_scores=emotion_scores,
            fruit_count=fruit_count,
            diary_text=diary_text
        )
        return jsonify(letter)
    except Exception as e:
        print(f"편지 생성 오류: {e}")
        return jsonify({"error": f"편지 생성에 실패했습니다: {str(e)}"}), 500

