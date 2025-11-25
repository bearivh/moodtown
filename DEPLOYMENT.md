# 배포 가이드 (Vercel + Render)

이 프로젝트는 프론트엔드를 Vercel에, 백엔드를 **Render**에 배포합니다.

> ⚠️ **Railway는 제한 사항이 있어 Render로 변경했습니다.**  
> 자세한 Render 배포 가이드는 [`DEPLOYMENT_RENDER.md`](./DEPLOYMENT_RENDER.md)를 참고하세요.

## 빠른 시작 (Render)

1. **Render 백엔드 배포**:
   - [Render.com](https://render.com) 접속 → GitHub로 로그인
   - "New +" → "Web Service" → 저장소 선택
   - Root Directory: `backend` 설정
   - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
   - 환경 변수: `OPENAI_API_KEY`, `SECRET_KEY`, `ENVIRONMENT=production`

2. **Vercel 프론트엔드 배포**:
   - [Vercel.com](https://vercel.com) 접속 → GitHub로 로그인
   - "Add New..." → "Project" → 저장소 선택
   - Root Directory: `frontend` 설정
   - 환경 변수: `VITE_API_BASE_URL` (Render URL)

자세한 내용은 [`DEPLOYMENT_RENDER.md`](./DEPLOYMENT_RENDER.md)를 참고하세요.

---

## Railway 배포 (구버전, 문제 있음)

> ⚠️ Railway는 "Limited Access" 및 "Paused deploys" 문제로 인해 비추천됩니다.


## 1. Railway 백엔드 배포

### 1.1 Railway 프로젝트 생성

#### 방법 1: GitHub 저장소 연결 (웹 UI)

**"Failed to fetch" 오류가 발생하는 경우:**

1. **브라우저 새로고침 및 재시도**
   - Railway 대시보드를 완전히 새로고침 (Ctrl+F5)
   - 몇 분 후 다시 시도

2. **GitHub 계정 재연결**
   - Railway Settings → Connected Accounts
   - GitHub 연결 해제 후 다시 연결
   - GitHub에서 Railway 앱 권한 확인

3. **다른 브라우저나 시크릿 모드 시도**
   - 캐시 문제일 수 있음

4. **저장소 직접 URL로 접근**
   - Railway에서 "Deploy from GitHub repo" 선택
   - 저장소 URL 직접 입력: `https://github.com/bearivh/moodPage`

#### 방법 2: Railway CLI 사용 (추천)

웹 UI에서 계속 실패한다면 CLI를 사용하세요:

1. **Railway CLI 설치**
   ```bash
   npm install -g @railway/cli
   # 또는
   pip install railway
   ```

2. **로그인**
   ```bash
   railway login
   ```

3. **프로젝트 생성 및 배포**
   ```bash
   cd backend
   railway init
   railway up
   ```

4. **환경 변수 설정** (CLI 또는 웹 대시보드에서)
   ```bash
   railway variables set OPENAI_API_KEY=your_key
   railway variables set SECRET_KEY=your_secret
   railway variables set ENVIRONMENT=production
   ```

#### 방법 3: 수동 업로드 (임시)

1. Railway에서 "Empty Project" 생성
2. GitHub Actions 또는 다른 방법으로 배포

**저장소 선택 후 설정:**
- **Root Directory**: `backend` (중요!)
- **Service Name**: 원하는 이름

### 1.2 환경 변수 설정

Railway 대시보드에서 다음 환경 변수들을 설정하세요:

```
OPENAI_API_KEY=your_openai_api_key
SECRET_KEY=your_secret_key_for_sessions
ENVIRONMENT=production
FRONTEND_URL=https://your-vercel-app.vercel.app
PORT=5000
```

- `OPENAI_API_KEY`: OpenAI API 키 (필수)
- `SECRET_KEY`: 세션 암호화를 위한 비밀키 (랜덤 문자열 생성)
- `ENVIRONMENT`: `production`으로 설정
- `FRONTEND_URL`: Vercel에 배포된 프론트엔드 URL (예: `https://your-app.vercel.app`)
- `PORT`: Railway가 자동으로 설정하므로 변경 불필요

### 1.3 배포 확인

- Railway 대시보드에서 배포 상태 확인
- 배포 완료 후 생성된 URL 확인 (예: `https://your-app.railway.app`)
- 이 URL을 백엔드 API URL로 사용합니다

## 2. Vercel 프론트엔드 배포

### 2.1 Vercel 프로젝트 생성

1. [Vercel](https://vercel.com/)에 로그인
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### 2.2 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정하세요:

```
VITE_API_BASE_URL=https://your-railway-app.railway.app
```

### 2.3 배포 확인

- Vercel 대시보드에서 배포 상태 확인
- 배포 완료 후 생성된 URL 확인
- 프론트엔드 URL을 Railway의 `FRONTEND_URL` 환경 변수에 추가

## 3. 문제 해결

### CORS 오류
- Railway의 `FRONTEND_URL` 환경 변수에 Vercel URL이 정확히 설정되어 있는지 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 세션 쿠키 문제
- Railway와 Vercel 모두 HTTPS를 사용하는지 확인
- `SESSION_COOKIE_SECURE`가 프로덕션에서 `True`로 설정되어 있는지 확인

### API 연결 실패
- Network 탭에서 요청 URL 확인
- Railway 대시보드에서 로그 확인
- 환경 변수들이 올바르게 설정되었는지 확인

## 4. 배포 순서 요약

1. **Railway 백엔드 배포 먼저**
   - Railway에서 백엔드 배포
   - Railway URL 확인 (예: `https://your-app.railway.app`)

2. **Vercel 프론트엔드 배포**
   - Vercel에서 프론트엔드 배포
   - 환경 변수 `VITE_API_BASE_URL`에 Railway URL 설정
   - Vercel URL 확인 (예: `https://your-app.vercel.app`)

3. **Railway 환경 변수 업데이트**
   - Railway의 `FRONTEND_URL` 환경 변수에 Vercel URL 설정
   - Railway 서비스 재시작

## 5. 로컬 개발

배포 후에도 로컬 개발은 계속 가능합니다:

1. 백엔드: `cd backend && python app.py`
2. 프론트엔드: `cd frontend && npm run dev`

로컬 개발 시에는 기존 프록시 설정이 그대로 작동합니다.

