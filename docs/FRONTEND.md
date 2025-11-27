# FRONTEND

React 기반 프론트엔드 애플리케이션에 대한 설명입니다.

## 기술 스택

### ❤︎ React 19.2.0
- **역할**: 사용자 인터페이스 구축을 위한 JavaScript 라이브러리
- **사용 이유**: 
  - 컴포넌트 기반 아키텍처로 재사용 가능한 UI 요소 구성
  - 상태 관리와 리렌더링 최적화
  - 풍부한 생태계와 커뮤니티 지원
- **주요 기능**: 
  - 함수형 컴포넌트와 Hooks (`useState`, `useEffect`) 사용
  - 페이지별 컴포넌트 분리 (Home, Village, WriteDiary, Plaza, Tree, Well, Office, Mailbox)
- **데이터 캐싱 전략**:
  - **모듈 레벨 캐시**: 메모리(Map)에 데이터 저장, 컴포넌트 언마운트 후에도 유지
  - **캐시 우선 표시**: 페이지 전환 시 캐시된 데이터를 먼저 표시하여 즉각적인 UI 제공
  - **백그라운드 동기화**: 캐시 표시 후 백엔드와 동기화하여 최신 데이터 반영
  - **효과**: 페이지 전환 지연 최소화 및 사용자 경험 개선


### ❤︎ Vite (Rolldown 기반) 7.2.2
- **역할**: 프론트엔드 빌드 도구 및 개발 서버
- **사용 이유**:
  - 빠른 Hot Module Replacement (HMR)로 개발 경험 향상
  - Rolldown 기반으로 Rust로 작성된 빠른 번들러
  - 프로덕션 빌드 최적화
- **특징**: 
  - 개발 서버: `npm run dev`
  - 프로덕션 빌드: `npm run build` (최적화된 정적 파일 생성)

### ❤︎ CSS3
- **역할**: 커스텀 스타일링 및 애니메이션
- **주요 기능**:
  - Flexbox/Grid 레이아웃
  - CSS 애니메이션 (플로팅 주민, 배경 효과)
  - 반응형 디자인 (미디어 쿼리)
  - 커스텀 폰트 (Dongle 등)

## 설치 및 실행

### ❤︎ 사전 요구사항
- Node.js 18 이상
- npm 또는 yarn

### ❤︎ 설치
```bash
cd frontend
npm install
```

### ❤︎ 개발 서버 실행
```bash
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 실행됩니다.

### ❤︎ 프로덕션 빌드
```bash
npm run build
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

## 프로젝트 구조

```
frontend/
├── src/
│   ├── pages/              # 페이지 컴포넌트
│   │   ├── Home.jsx        # 홈 화면
│   │   ├── Village.jsx     # 마을 입구
│   │   ├── WriteDiary.jsx  # 일기 작성
│   │   ├── Plaza.jsx       # 와글와글 광장
│   │   ├── Tree.jsx        # 행복 나무
│   │   ├── Well.jsx        # 스트레스 우물
│   │   ├── Office.jsx      # 마을 사무소
│   │   └── Mailbox.jsx     # 우체통
│   ├── components/         # 재사용 컴포넌트
│   │   ├── FloatingResidents.jsx
│   │   ├── EmotionSky.jsx
│   │   └── ResidentsIntro.jsx
│   ├── utils/              # 유틸리티 함수
│   │   ├── storage.js      # 일기 데이터베이스 API 호출 함수
│   │   ├── api.js          # 기타 API 요청 함수(감정 분석, 채팅 등)
│   │   ├── diaryCache.js   # 캐시 관리
│   │   ├── emotionUtils.js # 감정 유틸리티
│   │   └── ...
│   └── App.jsx             # 메인 앱
├── package.json
└── vite.config.js
```

## 주요 기능


### ❤︎ 세션 관리
쿠키 기반 세션 관리:
- 로그인 상태 유지
- 세션 쿠키 자동 관리

### ❤︎ 사용자 인터페이스

#### ❥ 반응형 디자인
모바일, 태블릿, 데스크톱 모든 기기에서 맞춤 화면을 제공합니다.  
모바일 환경에서도 UI가 무너지지 않도록 페이지마다 별도 대응합니다.

#### ❥ CSS keyframes 기반의 부드러운 움직임 구현
- 플로팅 주민 캐릭터의 자연스러운 움직임
- 구름, 별 등 배경 요소의 부드러운 애니메이션
- `ease-in-out` 타이밍 함수로 자연스러운 가속/감속
- `transform` 속성 사용으로 성능 최적화

#### ❥ 접근성
- 직관적인 네비게이션
- 명확한 시각적 피드백
- 툴팁을 통한 부연 설명  
  

ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ  
[← README로 돌아가기](../README.md)

