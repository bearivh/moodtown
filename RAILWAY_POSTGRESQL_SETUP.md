# Railway에서 PostgreSQL 설정 가이드

## 1. Railway에서 PostgreSQL 서비스 추가

1. Railway 대시보드로 이동
2. 프로젝트 선택
3. **"+ New"** 버튼 클릭
4. **"Database"** 선택
5. **"Add PostgreSQL"** 선택

## 2. PostgreSQL 연결 정보 확인

PostgreSQL 서비스가 생성되면:
1. PostgreSQL 서비스를 클릭
2. **"Variables"** 탭으로 이동
3. `DATABASE_URL` 환경 변수를 확인

또는 PostgreSQL 서비스에서:
1. **"Connect"** 탭으로 이동
2. 연결 정보 확인

## 3. 백엔드 서비스에 환경 변수 추가

1. 백엔드 서비스(Flask 앱) 선택
2. **"Variables"** 탭으로 이동
3. **"+ New Variable"** 클릭
4. 다음 환경 변수 추가:

### 옵션 1: DATABASE_URL 사용 (권장)
- **Variable Name**: `DATABASE_URL`
- **Value**: PostgreSQL 서비스의 `DATABASE_URL` 값을 복사하여 붙여넣기
  - 예: `postgresql://postgres:password@hostname:5432/railway`

### 옵션 2: USE_POSTGRESQL 강제 설정
PostgreSQL이 자동 감지되지 않는 경우:
- **Variable Name**: `USE_POSTGRESQL`
- **Value**: `true`
- 그리고 `DATABASE_URL`도 함께 설정

## 4. 서버 재시작

환경 변수를 추가한 후:
1. Railway에서 서비스를 재배포하거나
2. **"Deployments"** 탭에서 최신 커밋을 재배포

## 5. 로그 확인

서버가 시작되면 로그에서 다음 메시지를 확인하세요:

```
🔍 DATABASE_URL 존재 여부: True
🔍 DATABASE_URL 미리보기: postgresql://postgres:...
🔍 DATABASE_URL에 'postgres' 포함 여부: True
✅ DATABASE_URL에서 PostgreSQL 감지됨
🔍 최종 USE_POSTGRESQL 값: True
🔌 PostgreSQL 데이터베이스 연결 중...
✅ PostgreSQL 데이터베이스 초기화 완료: postgresql://...
```

SQLite를 사용하는 경우:
```
ℹ️  PostgreSQL 환경 변수가 없습니다. SQLite를 사용합니다.
🔌 SQLite 데이터베이스 연결 중...
✅ SQLite 데이터베이스 초기화 완료: /app/moodtown.db
```

## 문제 해결

### PostgreSQL이 감지되지 않는 경우
1. `DATABASE_URL` 환경 변수가 올바르게 설정되었는지 확인
2. `DATABASE_URL`에 `postgres` 또는 `postgresql`이 포함되어 있는지 확인
3. `USE_POSTGRESQL=true` 환경 변수를 추가

### 연결 실패 시
- 로그에서 "⚠️  PostgreSQL 연결 실패" 메시지 확인
- `DATABASE_URL` 형식이 올바른지 확인
- `psycopg2-binary` 패키지가 `requirements.txt`에 있는지 확인

## 참고

- PostgreSQL 서비스는 Railway에서 자동으로 관리됩니다
- `DATABASE_URL`은 Railway가 자동으로 생성하며, PostgreSQL 서비스의 Variables 탭에서 확인할 수 있습니다
- 백엔드 서비스와 PostgreSQL 서비스는 같은 프로젝트에 있어야 합니다

