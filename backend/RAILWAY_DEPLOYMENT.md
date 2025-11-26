# Railway 백엔드 배포 가이드

이 문서는 Moodtown 백엔드를 Railway에 배포하는 방법을 설명합니다.

## 사전 준비

1. **Railway 계정 생성**
   - [Railway](https://railway.app)에 가입

2. **프로젝트 파일 확인**
   - `backend/Procfile` - 웹 서버 시작 명령
   - `backend/requirements.txt` - Python 패키지 의존성
   - `backend/runtime.txt` - Python 버전
   - `backend/railway.json` - Railway 설정 (선택사항)

## 배포 방법

### 방법 1: GitHub 연동 (권장)

1. **GitHub에 코드 푸시**
   ```bash
   git add .
   git commit -m "Railway 배포 준비"
   git push origin main
   ```

2. **Railway에서 프로젝트 생성**
   - Railway 대시보드 → "New Project"
   - "Deploy from GitHub repo" 선택
   - 저장소 선택 후 배포

3. **서비스 설정**
   - Root Directory를 `backend`로 설정
   - 자동으로 Procfile을 인식하여 배포 시작

### 방법 2: Railway CLI 사용

1. **CLI 설치**
   ```bash
   npm install -g @railway/cli
   ```

2. **로그인**
   ```bash
   railway login
   ```

3. **백엔드 폴더로 이동**
   ```bash
   cd backend
   ```

4. **프로젝트 초기화**
   ```bash
   railway init
   ```

5. **환경 변수 설정**
   ```bash
   railway variables set OPENAI_API_KEY=your_openai_api_key
   railway variables set SECRET_KEY=your_random_secret_key_here
   railway variables set ENVIRONMENT=production
   railway variables set RAILWAY_ENVIRONMENT=true
   railway variables set FRONTEND_URL=https://your-frontend-domain.com
   ```

6. **배포**
   ```bash
   railway up
   ```

## 필수 환경 변수

Railway 대시보드의 Variables 탭에서 다음 환경 변수를 설정하세요:

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 키 (필수) | `sk-...` |
| `SECRET_KEY` | Flask 세션 비밀키 (필수) | 랜덤 문자열 |
| `ENVIRONMENT` | 환경 설정 | `production` |
| `RAILWAY_ENVIRONMENT` | Railway 환경 감지 | `true` |
| `FRONTEND_URL` | 프론트엔드 URL (CORS용) | `https://your-app.vercel.app` |

## 중요 사항

### 1. SQLite 데이터베이스

현재 프로젝트는 SQLite를 사용합니다. Railway의 파일시스템은 **임시(ephemeral)**이므로:
- 재배포 시 데이터가 초기화됩니다
- 서비스 재시작 시 데이터가 유지되지 않을 수 있습니다

**해결 방법:**
- 프로덕션에서는 Railway의 PostgreSQL 서비스를 사용하는 것을 권장합니다
- 또는 Railway의 Persistent Volumes를 사용할 수 있습니다

### 2. 포트 설정

Railway는 자동으로 `PORT` 환경 변수를 제공합니다. `Procfile`에서 `$PORT`를 사용하므로 별도 설정이 필요 없습니다.

### 3. 프론트엔드 연동

배포 후 Railway에서 제공하는 URL을 확인하고, 프론트엔드의 API URL을 업데이트하세요:
```javascript
// frontend/src/utils/api.js
const API_URL = 'https://your-backend.railway.app';
```

### 4. CORS 설정

`app.py`에서 `FRONTEND_URL` 환경 변수를 통해 CORS가 설정됩니다. 
여러 도메인을 허용하려면 쉼표로 구분하세요:
```
FRONTEND_URL=https://app1.vercel.app,https://app2.vercel.app
```

## 배포 확인

1. **배포 상태 확인**
   ```bash
   railway status
   ```

2. **로그 확인**
   ```bash
   railway logs
   ```
   또는 Railway 대시보드의 Logs 탭에서 확인

3. **서비스 테스트**
   ```bash
   curl https://your-backend.railway.app/health
   ```

## 문제 해결

### 배포 실패

1. **로그 확인**
   - Railway 대시보드 → Logs 탭
   - 또는 `railway logs` 명령어

2. **주요 원인**
   - `requirements.txt`에 필요한 패키지 누락
   - 환경 변수 미설정
   - Python 버전 불일치

### 데이터베이스 오류

- SQLite 파일이 없는 경우 자동으로 생성됩니다
- 파일 권한 문제가 있을 수 있으므로 로그를 확인하세요

### CORS 오류

- `FRONTEND_URL` 환경 변수가 올바르게 설정되었는지 확인
- 프론트엔드에서 `credentials: 'include'` 설정 확인

## 추가 리소스

- [Railway 공식 문서](https://docs.railway.app)
- [Railway CLI 문서](https://docs.railway.app/develop/cli)
- `RAILWAY_CLI_GUIDE.md` - CLI 사용법 상세 가이드
