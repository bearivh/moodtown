# 문제 해결 가이드

## API 호출 오류 해결

### 오류 증상
- `405 Method Not Allowed`
- `Unexpected token '<', "<!doctype "... is not valid JSON`
- `Unexpected end of JSON input`

### 원인
`VITE_API_BASE_URL` 환경 변수가 설정되지 않아 요청이 프론트엔드 서버(Vercel)로 가고 있습니다.

### 해결 방법

#### 1. Vercel 환경 변수 확인

1. Vercel 대시보드 접속
2. 프로젝트 선택
3. **Settings** → **Environment Variables** 클릭
4. 다음 변수가 있는지 확인:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://your-backend.up.railway.app` (Railway 백엔드 URL)

#### 2. 환경 변수 추가/수정

**없으면 추가:**
1. **Add New** 클릭
2. **Key**: `VITE_API_BASE_URL` 입력
3. **Value**: Railway 백엔드 URL 입력 (예: `https://moodtown-backend-production.up.railway.app`)
4. **Environment**: Production, Preview, Development 모두 선택
5. **Save** 클릭

**있으면 수정:**
1. 기존 변수 클릭
2. **Value** 수정
3. **Save** 클릭

#### 3. 재배포 필수! ⚠️

환경 변수를 추가/수정한 후 **반드시 재배포**해야 합니다:

1. Vercel 대시보드 → **Deployments** 탭
2. 최신 배포 항목의 **⋯** (점 3개) 클릭
3. **Redeploy** 선택
4. 또는 새 커밋을 푸시하면 자동 재배포됩니다

#### 4. Railway 백엔드 URL 확인

Railway에서 백엔드 도메인을 생성했는지 확인:

1. Railway 대시보드 → 프로젝트 → 백엔드 서비스
2. **Settings** → **Networking** 확인
3. 도메인이 없으면 **Generate Domain** 클릭

### 확인 방법

브라우저 콘솔을 열고 다음 확인:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL)
```

- `undefined` 또는 빈 문자열이면 → 환경 변수가 설정되지 않음
- Railway URL이 보이면 → 정상

### 추가 체크리스트

- [ ] Vercel에 `VITE_API_BASE_URL` 환경 변수 설정됨
- [ ] Railway 백엔드 도메인 생성됨
- [ ] 환경 변수 변경 후 재배포함
- [ ] Railway 백엔드가 실행 중임 (`/health` 엔드포인트로 확인)
- [ ] 백엔드 `FRONTEND_URL` 환경 변수에 프론트엔드 URL 설정됨

### CORS 오류가 발생하는 경우

백엔드 Railway 환경 변수에 추가:
```
FRONTEND_URL=https://your-frontend.vercel.app
```

