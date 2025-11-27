# 🚀 배포 가이드

MoodTown 애플리케이션의 배포 과정에 대한 설명입니다.

## 프로덕션 배포

### Backend 배포

#### Railway 배포
1. Railway 계정 생성 및 프로젝트 생성
2. PostgreSQL 데이터베이스 추가
3. GitHub 저장소 연결
4. 환경 변수 설정:
   - `DATABASE_URL`: PostgreSQL 연결 문자열
   - `OPENAI_API_KEY`: OpenAI API 키
   - `SECRET_KEY`: 세션 시크릿 키
   - `FRONTEND_URL`: 프론트엔드 URL
   - `ENVIRONMENT`: `production`
5. `Procfile` 생성:
   ```
   web: gunicorn app:app
   ```

### Frontend 배포

#### Vercel 배포
1. Vercel 계정 생성
2. GitHub 저장소 연결
3. 프로젝트 설정:
   - 프레임워크: Vite
   - 빌드 명령: `npm run build`
   - 출력 디렉토리: `dist`
4. 환경 변수 설정:
   - `VITE_API_URL`: 백엔드 API URL
5. 배포

## 환경 변수

### Backend 환경 변수
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

### Frontend 환경 변수
```env
VITE_API_URL=https://your-backend-api-url.com
```

## 데이터베이스 마이그레이션

프로덕션 환경에서는 데이터베이스가 자동으로 초기화됩니다. 수동으로 초기화하려면:

```bash
python -c "from db import init_db; init_db()"
```

## 모니터링

### 로깅
- 애플리케이션 로그는 Railway 대시보드에서 확인 가능
- 에러 로그는 자동으로 기록됩니다

### 헬스 체크
```
GET /health
```

## 관련 문서

- [백엔드 가이드](BACKEND.md)
- [프론트엔드 가이드](FRONTEND.md)

[← README로 돌아가기](../README.md)