# BACKEND

Flask 기반 백엔드 서버에 대한 전체 구조와 동작 방식의 설명입니다.

## 기술 스택

### ❤︎ Flask 3.1.2
- **역할**: Python 기반 웹 프레임워크(RESTful API 서버)
- **사용 이유**:
  - 경량화되고 유연한 구조
  - RESTful API 구축에 적합
  - Python 생태계와의 호환성
- **주요 기능**:
  - 라우팅 (`@app.route`)
  - 요청/응답 처리
  - 세션 관리 및 인증
  - 에러 핸들링

### ❤︎ Python 3.x
- **역할**: 백엔드 서버 및 ML 모델 실행 환경
- **사용 이유**:
  - 풍부한 데이터 과학 라이브러리 (scikit-learn, Gensim)
  - OpenAI API와의 쉬운 통합
  - 빠른 프로토타이핑 가능

### ❤︎ PostgreSQL
- **역할**: 관계형 데이터베이스 관리 시스템
- **사용 이유**:
  - JSONB 타입으로 유연한 데이터 저장 (감정 점수, 대화 등)
  - ACID 트랜잭션 보장
  - 확장성과 안정성
- **주요 테이블**:
  - `users`: 사용자 정보
  - `diaries`: 일기 데이터 (제목, 내용, 날짜, 감정 점수)
  - `tree_state`: 행복 나무 상태 (성장 단계, 열매 수)
  - `well_state`: 스트레스 우물 상태 (물 높이)
  - `letters`: 감정 주민들이 보내는 편지
  - `plaza_conversations`: 와글와글 광장 대화 (JSONB)

### ❤︎ OpenAI API (GPT-4o-mini)
- **역할**: 감정 분석, 대화 생성, 편지 생성
- **주요 사용처**:
  1. **감정 분석** (`emotion_gpt.py`): 일기 텍스트를 분석하여 7가지 감정 점수 제공
  2. **대화 생성** (`conversation.py`): 감정 주민들이 일기에 대해 대화하는 내용 생성
  3. **편지 생성** (`letter_generator.py`): 감정 주민이 보내는 편지 생성

### ❤︎ 주요 라이브러리
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

## 프로젝트 구조

```
backend/
├── api/                    # API 라우트
│   ├── auth.py            # 인증
│   ├── diary.py           # 일기 CRUD
│   ├── letters.py         # 편지 관리
│   ├── tree.py            # 행복 나무
│   ├── well.py            # 스트레스 우물
│   └── routes.py          # 감정 분석 및 주요 GPT 엔드포인트
├── services/              # 비즈니스 로직
│   ├── emotion_gpt.py     # GPT 감정 분석
│   ├── emotion_ml.py      # ML 감정 분석
│   ├── conversation.py    # 광장 대화 생성
│   ├── letter_generator.py # 편지 생성
│   └── diary_similarity.py # 유사 일기 검색
├── core/                  # 공통 모듈
│   └── common.py          # 공통 함수 및 캐릭터 정보
├── characters.json        # 감정 주민 캐릭터 정의
├── db.py                 # 데이터베이스 연결 및 함수
└── app.py                # Flask 앱 진입점
```

## 주요 기능

### ❤︎ 인증
- 세션 기반 인증 (쿠키)
- 사용자별 데이터 분리

### ❤︎ 에러 핸들링
- 일관된 에러 응답 형식
- 로깅 및 디버깅

### ❤ 감정 분석 / 대화 / 편지 시스템
- GPT 호출을 라우트에서 직접 처리하지 않고 services/* 에서 비즈니스 로직 분리
- 감정 점수 → 마을 시스템 업데이트
### ❤︎ 보안
- SQL 인젝션 방지 (파라미터화된 쿼리)
- XSS 방지 (쿠키 HttpOnly 설정)
- CORS 설정 (프로덕션 환경)  


ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ  
[← README로 돌아가기](../README.md)
