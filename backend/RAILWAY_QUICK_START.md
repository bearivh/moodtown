# Railway 배포 빠른 시작 가이드

## 배포 준비 완료 ✅

다음 파일들이 Railway 배포를 위해 준비되었습니다:

- ✅ `Procfile` - Gunicorn 웹 서버 시작 명령
- ✅ `railway.json` - Railway 배포 설정
- ✅ `requirements.txt` - Python 패키지 의존성
- ✅ `runtime.txt` - Python 3.13 버전
- ✅ 헬스체크 엔드포인트 (`/health`) 추가됨
- ✅ `.railwayignore` - 배포 시 제외할 파일 목록

## 배포 단계

### 1단계: GitHub에 푸시 (선택사항)

```bash
git add .
git commit -m "Railway 배포 준비"
git push origin main
```

### 2단계: Railway에서 프로젝트 생성

#### 옵션 A: 웹 UI 사용
1. [Railway](https://railway.app)에 로그인
2. "New Project" 클릭
3. "Deploy from GitHub repo" 선택 (또는 "Empty Project")
4. 저장소 선택 또는 코드 업로드
5. **Root Directory**를 `backend`로 설정 ⚠️ 중요!

#### 옵션 B: CLI 사용
```bash
cd backend
railway login
railway init
railway up
```

### 3단계: 환경 변수 설정

Railway 대시보드 → Variables 탭에서 다음 변수들을 추가하세요:

```
OPENAI_API_KEY=your_openai_api_key_here
SECRET_KEY=your_random_secret_key_here
ENVIRONMENT=production
RAILWAY_ENVIRONMENT=true
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

**SECRET_KEY 생성 방법:**
```python
import secrets
print(secrets.token_hex(32))
```

### 4단계: 배포 확인

1. **배포 상태 확인**
   - Railway 대시보드 → Deployments 탭
   - 배포가 성공하면 URL이 생성됩니다

2. **서비스 테스트**
   ```bash
   curl https://your-project.railway.app/health
   ```
   또는 브라우저에서 `/health` 엔드포인트 접속

3. **로그 확인**
   - Railway 대시보드 → Logs 탭
   - 또는 `railway logs` (CLI 사용 시)

## 주요 주의사항

### ⚠️ SQLite 데이터베이스
- Railway의 파일시스템은 **임시**입니다
- 재배포나 재시작 시 데이터가 초기화될 수 있습니다
- 프로덕션 환경에서는 PostgreSQL 사용을 권장합니다

### 🔗 프론트엔드 연동
배포 후 생성된 Railway URL을 프론트엔드의 API URL로 설정하세요:
```javascript
// frontend/src/utils/api.js
const API_URL = 'https://your-project.railway.app';
```

### 🔒 CORS 설정
`FRONTEND_URL` 환경 변수에 프론트엔드 도메인을 정확히 입력하세요.
여러 도메인은 쉼표로 구분:
```
FRONTEND_URL=https://app1.vercel.app,https://app2.vercel.app
```

## 문제 해결

### 배포 실패
- `railway logs` 또는 대시보드 Logs 탭에서 오류 확인
- `requirements.txt`에 모든 패키지가 포함되어 있는지 확인
- 환경 변수가 모두 설정되었는지 확인

### 502 Bad Gateway
- 서비스가 시작되는 데 시간이 걸릴 수 있습니다
- 로그에서 gunicorn이 정상적으로 시작되었는지 확인
- `PORT` 환경 변수가 자동으로 설정되는지 확인 (수동 설정 불필요)

### 데이터베이스 오류
- SQLite 파일은 자동으로 생성됩니다
- 파일 권한 문제가 있을 수 있으므로 로그 확인

## 추가 리소스

- 📖 상세 가이드: `RAILWAY_DEPLOYMENT.md`
- 🔧 CLI 가이드: `RAILWAY_CLI_GUIDE.md`
- 🌐 [Railway 공식 문서](https://docs.railway.app)
