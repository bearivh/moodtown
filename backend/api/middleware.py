"""
인증 관련 미들웨어 및 헬퍼 함수
"""
from functools import wraps
from flask import session, jsonify

def require_auth(f):
    """인증이 필요한 엔드포인트를 위한 데코레이터"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({"error": "로그인이 필요합니다."}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_current_user_id():
    """현재 로그인한 사용자 ID 반환 (없으면 None)"""
    return session.get('user_id')

