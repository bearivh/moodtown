import os, sys
from flask import Flask
from flask_cors import CORS  # type: ignore
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
is_production = os.environ.get('ENVIRONMENT') == 'production' or os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RENDER')

# 세션 쿠키 설정
# 프로덕션에서는 HTTPS가 필요하므로 Secure=True, SameSite='None'
# 개발 환경에서는 Secure=False, SameSite='Lax'
app.config['SESSION_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
app.config['SESSION_COOKIE_SECURE'] = is_production
app.config['SESSION_COOKIE_HTTPONLY'] = True    # XSS 방지
app.config['SESSION_COOKIE_PATH'] = '/'         # 쿠키 경로

# CORS 설정 (세션 쿠키를 위한 설정)
# 프로덕션 환경에서는 FRONTEND_URL 환경 변수에서 허용된 origin 목록을 가져옴
FRONTEND_URL_ENV = os.environ.get('FRONTEND_URL', '')
print(f"🔍 FRONTEND_URL 환경 변수: {FRONTEND_URL_ENV}")
print(f"🔍 프로덕션 환경: {is_production}")

allowed_origins = []
if FRONTEND_URL_ENV:
    # 쉼표로 구분된 여러 URL 지원
    allowed_origins = [origin.strip() for origin in FRONTEND_URL_ENV.split(',') if origin.strip()]

# 개발 환경 origin도 추가
allowed_origins.extend([
    'http://localhost:5173', 
    'http://127.0.0.1:5173', 
    'http://localhost:3000', 
    'http://127.0.0.1:3000'
])

# Vercel 도메인 자동 추가 (vercel.app으로 끝나는 모든 도메인 허용)
# 프로덕션 환경에서 Vercel 도메인 자동 허용
if is_production:
    allowed_origins.extend([
        'https://moodtown-three.vercel.app',
        'https://moodtownfront.vercel.app',
        'https://moodtownfront-moonsihyeons-projects.vercel.app'
    ])

# 중복 제거
allowed_origins = list(set(allowed_origins))

print(f"🔍 허용된 CORS origins: {allowed_origins}")

# CORS 설정
CORS(app, 
     supports_credentials=True, 
     origins=allowed_origins if allowed_origins else '*',  # 디버깅: origins가 비어있으면 모든 origin 허용
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     expose_headers=['Set-Cookie'],
     max_age=3600)

# DB 초기화 및 라우트 등록
try:
    print("🔌 데이터베이스 초기화 시작...")
    init_db()
    print("✅ 데이터베이스 초기화 완료")
except Exception as e:
    print(f"❌ 데이터베이스 초기화 실패: {e}")
    import traceback
    traceback.print_exc()
    # 앱은 계속 실행되도록 하되, DB 연결이 안 될 수 있음을 로그에 기록
    print("⚠️  데이터베이스 연결 없이 앱을 시작합니다. 일부 기능이 작동하지 않을 수 있습니다.")

register_all(app)

if __name__ == "__main__":
    app.run(debug=True)


