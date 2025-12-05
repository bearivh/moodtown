# FRONTEND

React 기반 프론트엔드 애플리케이션에 대한 설명입니다.

## 기술 스택

### ❤︎ React 19.2.0
- **역할**: 사용자 인터페이스 구축을 위한 JavaScript 라이브러리
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

### ❤︎ CSS3
- **역할**: 커스텀 스타일링 및 애니메이션
- **주요 기능**:
  - Flexbox/Grid 레이아웃
  - CSS 애니메이션 (플로팅 주민, 배경 효과)
  - 반응형 디자인 (미디어 쿼리)


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


