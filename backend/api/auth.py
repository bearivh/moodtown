import os
import sys
from flask import Blueprint, request, jsonify, session
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(__file__) + "/..")
from db import create_user, verify_user_password, get_user_by_id

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    """회원가입"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "요청 데이터가 없습니다."}), 400
        
        print(f"[회원가입] 받은 데이터: {data}")
        
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        name = data.get('name', '').strip()
        
        print(f"[회원가입] 파싱된 값 - username: '{username}', password: '{password}', name: '{name}'")
        
        # 유효성 검사
        if not username or not password:
            print(f"[회원가입] 유효성 검사 실패 - username 비어있음: {not username}, password 비어있음: {not password}")
            return jsonify({"error": "아이디와 비밀번호는 필수입니다."}), 400
        
        if not name or not name.strip():
            return jsonify({"error": "이름은 필수입니다."}), 400
        
        if len(username) < 3:
            return jsonify({"error": "아이디는 최소 3자 이상이어야 합니다."}), 400
        
        if len(password) < 4:
            return jsonify({"error": "비밀번호는 최소 4자 이상이어야 합니다."}), 400
        
        # 회원가입 전에 이전 세션 정리 (중요: 로그아웃 후 재가입 시 문제 방지)
        session.clear()
        
        # 사용자 생성
        user_id = create_user(username, password, name)
        
        if user_id is None:
            return jsonify({"error": "이미 존재하는 아이디입니다."}), 400
        
        # 세션에 사용자 정보 저장 (영구 세션)
        session.permanent = True
        session['user_id'] = user_id
        session['username'] = username
        
        print(f"[회원가입] 세션 저장: user_id={user_id}")
        print(f"[회원가입] 세션 내용: {dict(session)}")
        
        response = jsonify({
            "success": True,
            "user": {
                "id": user_id,
                "username": username,
                "name": name
            }
        })
        
        # 세션이 제대로 저장되도록 명시적으로 처리
        import flask
        flask.session.permanent = True
        
        return response, 201
        
    except Exception as e:
        print(f"회원가입 오류: {e}")
        return jsonify({"error": "회원가입 중 오류가 발생했습니다."}), 500

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """로그인"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "요청 데이터가 없습니다."}), 400
        
        print(f"[로그인] 받은 데이터: {data}")
        
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        print(f"[로그인] 파싱된 값 - username: '{username}', password: '{password}'")
        
        if not username or not password:
            print(f"[로그인] 유효성 검사 실패 - username 비어있음: {not username}, password 비어있음: {not password}")
            return jsonify({"error": "아이디와 비밀번호를 입력해주세요."}), 400
        
        # 로그인 전에 이전 세션 정리 (중요: 로그아웃 후 재로그인 시 문제 방지)
        session.clear()
        
        # 사용자 인증
        user = verify_user_password(username, password)
        
        if not user:
            return jsonify({"error": "아이디 또는 비밀번호가 올바르지 않습니다."}), 401
        
        # 세션에 사용자 정보 저장 (영구 세션)
        session.permanent = True
        session['user_id'] = user['id']
        session['username'] = user.get('username') or user.get('email')  # 마이그레이션 호환성
        
        print(f"[로그인] 세션 저장: user_id={user['id']}")
        print(f"[로그인] 세션 내용: {dict(session)}")
        
        response = jsonify({
            "success": True,
            "user": {
                "id": user['id'],
                "username": user.get('username') or user.get('email'),  # 마이그레이션 호환성
                "name": user.get('name')
            }
        })
        
        # 세션이 제대로 저장되도록 명시적으로 처리 (Flask가 자동으로 쿠키 설정)
        # session 객체를 수정하면 Flask가 자동으로 Set-Cookie 헤더를 추가함
        
        return response, 200
        
    except Exception as e:
        print(f"로그인 오류: {e}")
        return jsonify({"error": "로그인 중 오류가 발생했습니다."}), 500

@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """로그아웃"""
    try:
        from flask import current_app
        
        # 세션 정보 출력 (디버깅)
        print(f"[로그아웃] 로그아웃 전 세션: {dict(session)}")
        
        # 세션 clear
        session.clear()
        
        # 쿠키를 명시적으로 삭제하기 위해 응답에 쿠키 만료 설정
        response = jsonify({"success": True})
        
        # Flask의 세션 쿠키 이름 가져오기 (기본값: 'session')
        session_cookie_name = current_app.config.get('SESSION_COOKIE_NAME', 'session')
        
        # 쿠키를 삭제하기 위해 만료 시간을 과거로 설정
        expires = datetime.utcnow() - timedelta(days=1)
        
        is_production = os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')
        
        response.set_cookie(
            session_cookie_name,
            '',
            expires=expires,
            httponly=True,
            samesite='None' if is_production else 'Lax',
            secure=is_production,
            path='/'
        )
        
        print(f"[로그아웃] 로그아웃 후 세션: {dict(session)}")
        print(f"[로그아웃] 세션 쿠키 삭제: {session_cookie_name}")
        
        return response, 200
    except Exception as e:
        print(f"로그아웃 오류: {e}")
        # 오류가 발생해도 세션은 정리
        try:
            session.clear()
        except:
            pass
        return jsonify({"error": "로그아웃 중 오류가 발생했습니다."}), 500

@auth_bp.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """현재 로그인한 사용자 정보"""
    try:
        print(f"[인증 확인] 세션 쿠키: {request.cookies.get('session')}")
        print(f"[인증 확인] 세션 내용: {dict(session)}")
        
        user_id = session.get('user_id')
        if not user_id:
            # 로그인하지 않은 상태는 200으로 반환 (401 대신)
            return jsonify({
                "authenticated": False,
                "user": None
            }), 200
        
        user = get_user_by_id(user_id)
        if not user:
            session.clear()
            return jsonify({
                "authenticated": False,
                "user": None
            }), 200
        
        return jsonify({
            "authenticated": True,
            "user": {
                "id": user['id'],
                "username": user.get('username') or user.get('email'),  # 마이그레이션 호환성
                "name": user.get('name')
            }
        }), 200
        
    except Exception as e:
        print(f"사용자 정보 조회 오류: {e}")
        return jsonify({
            "authenticated": False,
            "user": None
        }), 200

