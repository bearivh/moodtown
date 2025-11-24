from flask import Blueprint, request, jsonify
from db import get_all_letters, save_letter, mark_letter_as_read, delete_letter

letters_bp = Blueprint("letters", __name__)

@letters_bp.route("/api/letters", methods=["GET"])
def get_letters():
    """모든 편지 가져오기"""
    letters = get_all_letters()
    return jsonify(letters)

@letters_bp.route("/api/letters", methods=["POST"])
def add_letter():
    """편지 추가"""
    data = request.get_json() or {}
    if save_letter(data):
        return jsonify({"success": True, "message": "편지가 저장되었습니다."})
    return jsonify({"error": "편지 저장에 실패했습니다."}), 500

@letters_bp.route("/api/letters/<letter_id>/read", methods=["POST"])
def mark_read(letter_id):
    """편지 읽음 처리"""
    if mark_letter_as_read(letter_id):
        return jsonify({"success": True, "message": "편지가 읽음 처리되었습니다."})
    return jsonify({"error": "편지 읽음 처리에 실패했습니다."}), 500

@letters_bp.route("/api/letters/<letter_id>", methods=["DELETE"])
def delete_letter_route(letter_id):
    """편지 삭제"""
    if delete_letter(letter_id):
        return jsonify({"success": True, "message": "편지가 삭제되었습니다."})
    return jsonify({"error": "편지 삭제에 실패했습니다."}), 500

@letters_bp.route("/api/letters/unread/count", methods=["GET"])
def get_unread_count():
    """읽지 않은 편지 개수 가져오기"""
    letters = get_all_letters()
    unread_count = sum(1 for letter in letters if not letter.get('isRead', False))
    return jsonify({"count": unread_count})

