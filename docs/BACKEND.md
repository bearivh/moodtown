# BACKEND

Flask 기반 백엔드 서버에 대한 전체 구조와 동작 방식의 설명입니다.

## 기술 스택

- Flask 3.1.2
- Python 3.x
-  PostgreSQL
    - **주요 테이블**:
      - `users`: 사용자 정보
      -   `diaries`: 일기 데이터 (제목, 내용, 날짜, 감정 점수)
      - `tree_state`: 행복 나무 상태 (성장 단계, 열매 수)
      - `well_state`: 스트레스 우물 상태 (물 높이)
      - `letters`: 감정 주민들이 보내는 편지
      - `plaza_conversations`: 와글와글 광장 대화 (JSONB)
- OpenAI API (GPT-4o-mini)
  - **주요 사용처**:
    1. **감정 분석** (`emotion_gpt.py`): 일기 텍스트를 분석하여 7가지 감정 점수 제공
    2. **대화 생성** (`conversation.py`): 감정 주민들이 일기에 대해 대화하는 내용 생성
    3. **편지 생성** (`letter_generator.py`): 감정 주민이 보내는 편지 생성

- 주요 라이브러리
  - **flask-cors 6.0.1**: CORS 처리
  - **psycopg2-binary 2.9.9+**: PostgreSQL 연결
  - **joblib 1.3.0+**: ML 모델 저장/로딩
  - **gunicorn 21.2.0+**: 프로덕션 서버
  - **python-dotenv 1.2.1**: 환경 변수 관리
  - **openai 1.0.0+**: OpenAI API 클라이언트

## 설치 및 실행

### ❤︎ 사전 요구사항
- Python 3.8 이상
- PostgreSQL 데이터베이스
- OpenAI API 키

### ❤︎ 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# 데이터베이스
DATABASE_URL=postgresql://user:password@host:port/database

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# 세션 시크릿
SECRET_KEY=your-secret-key

# 프론트엔드 URL (프로덕션)
FRONTEND_URL=https://your-frontend-domain.com

# 환경 설정
ENVIRONMENT=development  # 또는 production
```

### ❤︎ 설치
```bash
cd backend

# 가상환경 생성 및 활성화
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt
```

### 데이터베이스 초기화
```bash
python -c "from db import init_db; init_db()"
```

### 개발 서버 실행
```bash
python app.py
```

### 프로덕션 서버 실행
```bash
gunicorn app:app
```

