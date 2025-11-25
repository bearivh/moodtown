# Railway CLI 배포 가이드

웹 UI에서 "Failed to fetch" 오류가 발생할 때 사용하는 CLI 배포 방법입니다.

## 1. Railway CLI 설치

### Windows (PowerShell)
```powershell
npm install -g @railway/cli
```

또는 Chocolatey 사용:
```powershell
choco install railway-cli
```

## 2. 로그인

```bash
railway login
```

브라우저가 자동으로 열리면 Railway 계정으로 로그인합니다.

## 3. 프로젝트 생성 및 배포

### 백엔드 배포

1. **backend 폴더로 이동**
   ```bash
   cd backend
   ```

2. **Railway 프로젝트 초기화**
   ```bash
   railway init
   ```
   - 프로젝트 이름 입력 (예: `moodtown-backend`)
   - 또는 기존 프로젝트에 연결

3. **환경 변수 설정**
   ```bash
   railway variables set OPENAI_API_KEY=your_openai_api_key_here
   railway variables set SECRET_KEY=your_random_secret_key_here
   railway variables set ENVIRONMENT=production
   ```

4. **배포**
   ```bash
   railway up
   ```

5. **배포 URL 확인**
   ```bash
   railway domain
   ```

## 4. 환경 변수 관리

### 환경 변수 설정
```bash
railway variables set KEY=VALUE
```

### 환경 변수 확인
```bash
railway variables
```

### 환경 변수 삭제
```bash
railway variables unset KEY
```

## 5. 로그 확인

```bash
railway logs
```

실시간 로그를 보려면:
```bash
railway logs --follow
```

## 6. 서비스 관리

### 서비스 목록 확인
```bash
railway status
```

### 서비스 재시작
```bash
railway restart
```

## 문제 해결

### CLI 설치 오류
- Node.js가 설치되어 있는지 확인: `node --version`
- npm이 설치되어 있는지 확인: `npm --version`
- 관리자 권한으로 실행

### 로그인 실패
- `railway logout` 후 다시 `railway login` 시도
- 브라우저에서 Railway 계정 확인

### 배포 실패
- `railway logs`로 오류 확인
- `backend/requirements.txt`에 필요한 패키지가 모두 있는지 확인
- `backend/Procfile`이 올바르게 설정되어 있는지 확인

