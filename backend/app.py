import os, sys
from flask import Flask
from flask_cors import CORS
from db import init_db

# Ensure backend path for api package imports
sys.path.append(os.path.dirname(__file__))
from api.routes import register_all  # noqa: E402

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'moodtown-secret-key-for-session')  # 세션을 위한 비밀키

# 세션 설정 (영구 세션, 31일)
from datetime import timedelta
app.permanent_session_lifetime = timedelta(days=31)
# 개발 환경에서 세션 쿠키 설정
# CORS cross-origin 요청에서 쿠키를 전송하려면 SameSite='None'과 Secure=True 필요
# 하지만 localhost에서는 HTTPS 없이 Secure=False 사용 가능
# 최신 브라우저는 localhost에서 Secure=False + SameSite='None' 조합을 허용함
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'   # 프록시 사용 시 same-origin으로 처리됨
app.config['SESSION_COOKIE_SECURE'] = False     # localhost에서는 False (HTTPS 없이)
app.config['SESSION_COOKIE_HTTPONLY'] = True    # XSS 방지
app.config['SESSION_COOKIE_PATH'] = '/'         # 쿠키 경로

# CORS 설정 (세션 쿠키를 위한 설정)
CORS(app, 
     supports_credentials=True, 
     origins=['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'],
     allow_headers=['Content-Type', 'Authorization'],
     expose_headers=['Set-Cookie'])

# DB 초기화 및 라우트 등록
init_db()
register_all(app)

if __name__ == "__main__":
    app.run(debug=True)


