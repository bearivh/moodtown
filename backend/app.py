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

# 프로덕션 환경 감지
is_production = os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT')

# 세션 쿠키 설정
# 프로덕션에서는 HTTPS가 필요하므로 Secure=True, SameSite='None'
# 개발 환경에서는 Secure=False, SameSite='Lax'
app.config['SESSION_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['SESSION_COOKIE_SECURE'] = is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True    # XSS 방지
app.config['SESSION_COOKIE_PATH'] = '/'         # 쿠키 경로

# CORS 설정 (세션 쿠키를 위한 설정)
# 프로덕션 환경에서는 FRONTEND_URL 환경 변수에서 허용된 origin 목록을 가져옴
allowed_origins = os.environ.get('FRONTEND_URL', '').split(',') if os.environ.get('FRONTEND_URL') else []
# 개발 환경 origin도 추가
allowed_origins.extend([
    'http://localhost:5173', 
    'http://127.0.0.1:5173', 
    'http://localhost:3000', 
    'http://127.0.0.1:3000'
])
# 중복 제거
allowed_origins = list(set([origin.strip() for origin in allowed_origins if origin.strip()]))

CORS(app, 
     supports_credentials=True, 
     origins=allowed_origins,
     allow_headers=['Content-Type', 'Authorization'],
     expose_headers=['Set-Cookie'])

# DB 초기화 및 라우트 등록
init_db()
register_all(app)

if __name__ == "__main__":
    app.run(debug=True)


