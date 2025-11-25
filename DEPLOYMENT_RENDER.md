# Render + Vercel 배포 가이드

이 프로젝트는 프론트엔드를 Vercel에, 백엔드를 Render에 배포합니다.

## 1. Render 백엔드 배포

### 1.1 Render 계정 생성 및 저장소 연결

1. [Render](https://render.com/) 접속
2. "Get Started for Free" 클릭
3. GitHub 계정으로 로그인
4. GitHub 저장소 접근 권한 허용

### 1.2 Web Service 생성

1. Render Dashboard에서 "New +" 버튼 클릭
2. "Web Service" 선택
3. GitHub 저장소 선택:
   - 저장소 목록에서 `bearivh/moodPage` 선택
   - "Connect" 클릭

### 1.3 서비스 설정

다음 설정을 입력하세요:

**Basic Settings:**
- **Name**: `moodtown-backend` (또는 원하는 이름)
- **Region**: `Singapore` (또는 가장 가까운 지역)
- **Branch**: `main`
- **Root Directory**: `backend` ⚠️ **중요!**

**Build & Deploy:**
- **Environment**: `Python 3`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`

**Plan:**
- **Free** 선택 (무료 티어)

### 1.4 환경 변수 설정

"Environment" 섹션에서 다음 환경 변수들을 추가:

```
OPENAI_API_KEY=your_openai_api_key_here
SECRET_KEY=your_random_secret_key_here
ENVIRONMENT=production
```

**중요**: `FRONTEND_URL`은 Vercel 배포 후에 추가합니다!

### 1.5 배포 시작

1. 모든 설정이 완료되었는지 확인
2. "Create Web Service" 버튼 클릭
3. 배포가 시작되며 약 5-10분 소요
4. 배포 완료 후 생성된 URL 확인 (예: `https://moodtown-backend.onrender.com`)

### 1.6 배포 확인

- Dashboard에서 "Logs" 탭에서 배포 로그 확인
- "Events" 탭에서 배포 상태 확인
- 배포가 완료되면 제공된 URL로 접속 테스트

---

## 2. Vercel 프론트엔드 배포

### 2.1 Vercel 프로젝트 생성

1. [Vercel](https://vercel.com/) 접속 및 로그인
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택 (`bearivh/moodPage`)
4. "Import" 클릭

### 2.2 프로젝트 설정

**Framework Settings 화면에서:**

1. **Root Directory** 설정:
   - "Edit" 클릭
   - `frontend` 입력

2. **Advanced Options** (필요시):
   - **Build Command**: `npm run build` (자동 감지됨)
   - **Output Directory**: `dist` (자동 감지됨)
   - **Install Command**: `npm install` (기본값)

### 2.3 환경 변수 설정

**"Environment Variables" 섹션에서:**

```
VITE_API_BASE_URL=https://moodtown-backend.onrender.com
```

⚠️ Render URL을 정확히 입력하세요!

### 2.4 배포

1. "Deploy" 버튼 클릭
2. 배포 완료 후 URL 확인 (예: `https://moodtown.vercel.app`)

---

## 3. 배포 후 설정 연결

### 3.1 Render 환경 변수 업데이트

Vercel 배포가 완료되면:

1. Render Dashboard로 돌아가기
2. Web Service 선택 → "Environment" 탭
3. 다음 환경 변수 추가:

```
FRONTEND_URL=https://your-vercel-app.vercel.app
```

4. "Save Changes" 클릭
5. 서비스가 자동으로 재배포됨

---

## 4. 문제 해결

### CORS 오류
- Render의 `FRONTEND_URL` 환경 변수에 Vercel URL이 정확히 설정되어 있는지 확인
- 브라우저 콘솔에서 오류 메시지 확인
- Render 로그에서 CORS 관련 오류 확인

### 세션 쿠키 문제
- Render와 Vercel 모두 HTTPS를 사용하는지 확인 (자동)
- Render에서 `ENVIRONMENT=production`이 설정되어 있는지 확인

### API 연결 실패
- Network 탭에서 요청 URL 확인
- Render 대시보드에서 로그 확인
- `VITE_API_BASE_URL` 환경 변수가 올바른지 확인

### Render 서비스가 15분 후 자동으로 잠들 때 (무료 티어)
- 무료 티어는 15분 비활성 시 자동으로 잠듦
- 첫 요청 시 깨어나는 데 약 30초-1분 소요
- 이는 무료 티어의 정상적인 동작입니다

---

## 5. 배포 순서 요약

1. ✅ **Render 백엔드 배포 먼저**
   - Render에서 Web Service 생성
   - 환경 변수 설정 (OPENAI_API_KEY, SECRET_KEY, ENVIRONMENT)
   - 배포 완료 후 URL 확인

2. ✅ **Vercel 프론트엔드 배포**
   - Vercel에서 프로젝트 생성
   - Root Directory: `frontend` 설정
   - 환경 변수 `VITE_API_BASE_URL`에 Render URL 설정
   - 배포 완료 후 URL 확인

3. ✅ **Render 환경 변수 업데이트**
   - Render에 `FRONTEND_URL` 환경 변수 추가 (Vercel URL)
   - 서비스 자동 재배포

---

## 6. 주의사항

### Render 무료 티어 제한:
- **자동 Sleep**: 15분 비활성 시 자동으로 잠듦
- **첫 요청 지연**: 깨어나는 데 30초-1분 소요
- **월 750시간**: 무료 사용 시간 제한

### 해결 방법:
- 무료로 계속 사용: 첫 요청 지연을 감수
- 유료 플랜 업그레이드: 항상 활성 상태 유지 (월 $7부터)

---

## 7. 로컬 개발

배포 후에도 로컬 개발은 계속 가능합니다:

1. 백엔드: `cd backend && python app.py`
2. 프론트엔드: `cd frontend && npm run dev`

로컬 개발 시에는 기존 프록시 설정이 그대로 작동합니다.

