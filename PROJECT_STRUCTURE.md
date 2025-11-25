# 프로젝트 구조

## 전체 구조
```
moodtown/
├── backend/              # Flask 백엔드
│   ├── api/             # API 엔드포인트
│   ├── core/            # 코어 유틸리티
│   ├── services/        # 비즈니스 로직 및 서비스
│   │   └── models/      # ML 모델 파일들
│   ├── app.py           # Flask 앱 진입점
│   ├── db.py            # 데이터베이스 관리
│   └── characters.json  # 캐릭터 설정
├── frontend/            # React 프론트엔드
│   ├── src/
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── components/  # 재사용 컴포넌트
│   │   ├── utils/       # 유틸리티 함수
│   │   ├── assets/      # 이미지 및 리소스
│   │   ├── index.css    # 전역 스타일 (통합됨)
│   │   └── main.jsx     # 진입점
│   └── public/          # 정적 파일
└── 감성대화말뭉치*.json # 학습 데이터 (프로젝트 루트)
```

## 주요 디렉토리 설명

### Backend
- **api/**: REST API 엔드포인트 정의
- **core/**: 공통 유틸리티 및 설정
- **services/**: 비즈니스 로직 (감정 분석, 편지 생성 등)
- **services/models/**: 학습된 ML 모델 파일들

### Frontend
- **pages/**: 각 페이지별 컴포넌트 및 CSS
- **components/**: 재사용 가능한 컴포넌트
- **utils/**: API 호출, 날짜 처리 등 유틸리티
- **assets/**: 이미지, 아이콘 등 정적 리소스

## 파일 위치 규칙
- 각 페이지의 CSS는 해당 페이지 파일과 같은 디렉토리에 위치
- 공통 스타일은 `src/index.css`에 통합
- 학습 데이터는 프로젝트 루트에 위치 (`.gitignore`에 포함)

