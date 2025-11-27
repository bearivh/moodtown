# DEPLOYMENT GUIDE

moodtown 웹 애플리케이션의 **백엔드(Flask)**와 **프론트엔드(React)**를 프로덕션 환경에 배포하는 과정 정리입니다.

## 프로덕션 배포

### ❤︎ Backend 배포

#### ❥ Railway 배포
1-1. 프로젝트 생성

1. Railway 계정 생성
2. New Project → Deploy from GitHub Repo
3. moodtown 저장소 연결

1-2. PostgreSQL 데이터베이스 추가
- Railway → Add → PostgreSQL
- 생성된 DB의 Connection URL을 DATABASE_URL 값으로 사용

1-3. 환경 변수 설정  
- Railway → Variables

   | Key              | 설명                |
   | ---------------- | ----------------- |
   | `DATABASE_URL`   | PostgreSQL 연결 문자열 |
   | `OPENAI_API_KEY` | OpenAI API 키      |
   | `SECRET_KEY`     | 세션 암호 키           |
   | `FRONTEND_URL`   | Vercel 배포 주소      |
   | `ENVIRONMENT`    | `production`      |

1-4. Procfile
- Railway가 Flask를 프로덕션 환경에서 실행하도록 설정:  
web: gunicorn app:app

1-5. 배포
- Railway가 자동으로 빌드 → 배포 진행
- 결과 URL 예시:
https://moodtown-production.up.railway.app

### ❤︎ Frontend 배포
#### ❥ Vercel 배포
2-1. 프로젝트 생성
1. Vercel 계정 생성
2. GitHub 저장소 연결
3. Framework: Vite 선택

2-2. Build 옵션
- Build Command: npm run build
- Output Directory: dist

2-3. 환경 변수 설정  
- Vercel → Project → Settings → Environment Variables
   | Key            | 설명                  |
   | -------------- | ------------------- |
   | `VITE_API_URL` | Railway 백엔드 API URL |
   - 예:
https://moodtown-production.up.railway.app

2-4. 배포
- Push → 자동 빌드 → 자동 배포
- 결과 URL 예시:
https://moodtown.vercel.app

## 환경 변수

### ❤︎ Backend 환경 변수
```env
# 데이터베이스
DATABASE_URL=postgresql://user:password@host:port/database

# OpenAI API
OPENAI_API_KEY=your-openai-api-key

# 세션 시크릿
SECRET_KEY=your-secret-key

# 프론트엔드 URL (프로덕션)
FRONTEND_URL=https://your-frontend-domain.com

# 환경 설정
ENVIRONMENT=production
```

### ❤︎ Frontend 환경 변수
```env
VITE_API_URL=https://your-backend-api-url.com
```

## 데이터베이스 마이그레이션

프로덕션 환경에서는 데이터베이스가 자동으로 초기화됩니다. 수동으로 초기화하려면:

```bash
python -c "from db import init_db; init_db()"
```

## 모니터링

### ❤︎ 로깅
- 애플리케이션 로그는 Railway 대시보드에서 확인 가능
- 에러 로그는 자동으로 기록됩니다

### ❤︎ 헬스 체크
```
GET /health
```


ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ  
[← README로 돌아가기](../README.md)