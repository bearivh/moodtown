# moodtown 🏘️

**배포 링크**  
[Go to moodtown!](https://moodtown-three.vercel.app/)

moodtown은 사용자의 일기를 AI가 분석해 7가지 감정의 주민 캐릭터로 시각화하고, 감정 기반의 마을을 성장시키는 인터랙티브 다이어리 플랫폼입니다.

## 📖 간단 소개

moodtown은 단순한 일기 앱을 넘어서, 감정을 시각화하고 게임화 요소를 통해 사용자의 감정 표현과 자기 이해를 돕는 플랫폼입니다. 일기를 작성하면:

- 🤖 **AI가 감정을 분석**하고 (GPT-4o-mini)
- 👥 **감정 주민들이 대화**를 나누며
- 🌳 **행복 나무가 자라나고**
- 💧 **스트레스 우물이 차오르며**
- 💌 **주민들이 편지**를 보내는

감정 기반 소셜 게임형 일기 플랫폼입니다.

## 📚 문서

자세한 내용은 다음 문서를 참고하세요:

- **[프로젝트 소개](docs/INTRO.md)** - 프로젝트 전체 소개 (확장 버전)
- **[주요 기능](docs/FEATURES.md)** - 주요 기능 상세 설명
- **[시스템 아키텍처](docs/ARCHITECTURE.md)** - 시스템 아키텍처 구조
- **[프론트엔드](docs/FRONTEND.md)** - 프론트엔드 실행/설계 설명
- **[백엔드](docs/BACKEND.md)** - 백엔드 실행/설계 설명
- **[ML 모델](docs/ML_MODELS.md)** - 감정 분석/Doc2Vec 모델 설명
- **[API 레퍼런스](docs/API_REFERENCE.md)** - API 라우트 문서
- **[게임 디자인](docs/GAME_DESIGN.md)** - 감정 마을/나무/우물의 게임 메커니즘
- **[배포 가이드](docs/DEPLOYMENT.md)** - 배포 과정 설명
- **[기여 가이드](docs/CONTRIBUTING.md)** - 기여 가이드

## 🚀 빠른 시작

### 사전 요구사항
- Python 3.8 이상
- Node.js 18 이상
- PostgreSQL 데이터베이스
- OpenAI API 키

### 설치 및 실행

#### 1. Backend 설정
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
python -c "from db import init_db; init_db()"
python app.py
```

#### 2. Frontend 설정
```bash
cd frontend
npm install
npm run dev
```

자세한 내용은 [백엔드 가이드](docs/BACKEND.md)와 [프론트엔드 가이드](docs/FRONTEND.md)를 참고하세요.

## 🛠️ 기술 스택

- **Frontend**: React 19.2.0, Vite (Rolldown 기반)
- **Backend**: Flask 3.1.2, Python 3.x
- **Database**: PostgreSQL
- **AI**: OpenAI API (GPT-4o-mini)
- **ML**: scikit-learn (감정 분석), Gensim (Doc2Vec)

자세한 내용은 [시스템 아키텍처](docs/ARCHITECTURE.md)를 참고하세요.

## 📁 프로젝트 구조

```
moodtown/
├── README.md
│
├── docs/                      # 📚 문서
│   ├── INTRO.md              # 프로젝트 전체 소개 (확장 버전)
│   ├── FEATURES.md           # 주요 기능 상세 설명
│   ├── ARCHITECTURE.md       # 시스템 아키텍처 구조
│   ├── FRONTEND.md           # 프론트엔드 실행/설계 설명
│   ├── BACKEND.md            # 백엔드 실행/설계 설명
│   ├── ML_MODELS.md          # 감정 분석/Doc2Vec 모델 설명
│   ├── API_REFERENCE.md      # API 라우트 문서
│   ├── GAME_DESIGN.md        # 감정 마을/나무/우물의 게임 메커니즘
│   ├── DEPLOYMENT.md         # 배포 과정 설명
│   ├── CONTRIBUTING.md       # 기여 가이드
│   ├── architecture.svg      # 시스템 아키텍처 다이어그램
│   └── data-flow.svg         # 데이터 플로우 다이어그램
│
├── backend/                  # 🐍 Flask 백엔드
│   ├── api/                  # API 라우트
│   │   ├── __init__.py
│   │   ├── auth.py          # 인증 API (회원가입, 로그인, 로그아웃)
│   │   ├── diary.py         # 일기 CRUD API
│   │   ├── letters.py       # 편지 관리 API
│   │   ├── tree.py          # 행복 나무 API
│   │   ├── well.py          # 스트레스 우물 API
│   │   ├── chat.py          # 채팅 API
│   │   ├── routes.py        # 메인 라우트 (감정 분석)
│   │   └── middleware.py    # 미들웨어 (인증 등)
│   │
│   ├── services/            # 비즈니스 로직
│   │   ├── emotion_gpt.py      # GPT 감정 분석
│   │   ├── emotion_ml.py       # ML 감정 분석 (참고용)
│   │   ├── conversation.py     # 광장 대화 생성
│   │   ├── letter_generator.py # 편지 생성
│   │   ├── diary_similarity.py # 유사 일기 검색
│   │   ├── train_emotion_ml.py # 감정 분석 모델 학습
│   │   ├── train_diary_similarity.py # 유사 일기 검색 모델 학습
│   │   └── models/          # 학습된 ML 모델 파일
│   │       ├── emotion_ml.joblib
│   │       ├── diary_similarity_doc2vec.model
│   │       ├── metrics.json
│   │       ├── confusion_matrix.png
│   │       └── ...
│   │
│   ├── core/                # 공통 모듈
│   │   ├── __init__.py
│   │   └── common.py        # 공통 함수 및 캐릭터 정보
│   │
│   ├── characters.json      # 감정 주민 캐릭터 정의
│   ├── db.py               # 데이터베이스 연결 및 함수
│   ├── app.py              # Flask 앱 진입점
│   ├── requirements.txt    # Python 의존성
│   ├── Procfile            # 프로덕션 배포 설정
│   ├── runtime.txt         # Python 버전 설정
│   └── railway.json        # Railway 배포 설정
│
├── frontend/                # ⚛️ React 프론트엔드
│   ├── src/
│   │   ├── pages/          # 페이지 컴포넌트
│   │   │   ├── Home.jsx         # 홈 화면
│   │   │   ├── Login.jsx        # 로그인 페이지
│   │   │   ├── Village.jsx      # 마을 입구
│   │   │   ├── WriteDiary.jsx   # 일기 작성
│   │   │   ├── Plaza.jsx        # 와글와글 광장
│   │   │   ├── Tree.jsx         # 행복 나무
│   │   │   ├── Well.jsx         # 스트레스 우물
│   │   │   ├── Office.jsx       # 마을 사무소
│   │   │   ├── Mailbox.jsx      # 우체통
│   │   │   ├── Guide.jsx        # 마을 안내도
│   │   │   └── *.css            # 각 페이지의 스타일 파일
│   │   │
│   │   ├── components/     # 재사용 컴포넌트
│   │   │   ├── FloatingResidents.jsx  # 플로팅 주민 캐릭터
│   │   │   ├── FloatingResidents.css
│   │   │   ├── EmotionSky.jsx         # 감정 하늘 배경
│   │   │   ├── EmotionSky.css
│   │   │   ├── ResidentsIntro.jsx     # 주민 소개
│   │   │   └── ResidentsIntro.css
│   │   │
│   │   ├── utils/          # 유틸리티 함수
│   │   │   ├── api.js            # API 호출 함수
│   │   │   ├── storage.js        # 데이터 저장/조회
│   │   │   ├── diaryCache.js     # 일기 캐시 관리
│   │   │   ├── emotionUtils.js   # 감정 관련 유틸리티
│   │   │   ├── emotionColorMap.js # 감정 색상 매핑
│   │   │   ├── dateUtils.js      # 날짜 유틸리티
│   │   │   ├── treeUtils.js      # 나무 관련 유틸리티
│   │   │   ├── wellUtils.js      # 우물 관련 유틸리티
│   │   │   └── mailboxUtils.js   # 편지 관련 유틸리티
│   │   │
│   │   ├── assets/         # 정적 리소스
│   │   │   ├── characters/  # 주민 캐릭터 이미지
│   │   │   │   ├── yellow.png (노랑이 - 기쁨)
│   │   │   │   ├── green.png (초록이 - 사랑)
│   │   │   │   ├── purple.png (보라 - 놀람)
│   │   │   │   ├── navy.png (남색이 - 두려움)
│   │   │   │   ├── red.png (빨강이 - 분노)
│   │   │   │   ├── orange.png (주황이 - 부끄러움)
│   │   │   │   └── blue.png (파랑이 - 슬픔)
│   │   │   └── icons/      # 아이콘 이미지
│   │   │
│   │   ├── style/          # 전역 스타일
│   │   │   └── globals.css
│   │   │
│   │   ├── App.jsx         # 메인 앱 컴포넌트
│   │   ├── App.css         # 앱 스타일
│   │   ├── main.jsx        # 진입점
│   │   └── index.css       # 전역 CSS
│   │
│   ├── public/             # 정적 파일
│   │   ├── favicon.svg
│   │   └── vite.svg
│   │
│   ├── index.html          # HTML 템플릿
│   ├── package.json        # npm 의존성
│   ├── vite.config.js      # Vite 설정
│   ├── eslint.config.js    # ESLint 설정
│   ├── vercel.json         # Vercel 배포 설정
│   └── README.md           # 프론트엔드 README
│
├── 감성대화말뭉치(최종데이터)_Training.json    # ML 학습 데이터
└── 감성대화말뭉치(최종데이터)_Validation.json  # ML 검증 데이터
```

## 📝 라이선스

이 프로젝트는 개인 프로젝트입니다.

## 🙏 감사 인사

- OpenAI GPT-4o-mini
- 감성대화말뭉치 데이터셋 (AI hub)

