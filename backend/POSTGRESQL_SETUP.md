# PostgreSQL 설정 가이드 (Railway)

## SECRET_KEY 생성 완료 ✅

생성된 SECRET_KEY:
```
8a75420cc21f49e4951a10dfa9ddfcb46792a1687102a0e6870d2783c0ebbf24
```

이 값을 Railway 환경 변수에 설정하세요: `SECRET_KEY=8a75420cc21f49e4951a10dfa9ddfcb46792a1687102a0e6870d2783c0ebbf24`

---

## Railway에서 PostgreSQL 설정하기

### 1단계: PostgreSQL 서비스 추가

1. Railway 대시보드에서 프로젝트 선택
2. **"New"** 버튼 클릭 → **"Database"** 선택 → **"Add PostgreSQL"** 클릭
3. PostgreSQL 서비스가 자동으로 생성되고 연결 정보가 제공됩니다

### 2단계: 환경 변수 확인

Railway가 자동으로 다음 환경 변수를 생성합니다:
- `DATABASE_URL` - PostgreSQL 연결 문자열
- `PGHOST` - 호스트
- `PGPORT` - 포트
- `PGDATABASE` - 데이터베이스 이름
- `PGUSER` - 사용자명
- `PGPASSWORD` - 비밀번호

### 3단계: 백엔드 서비스에 PostgreSQL 연결

1. 백엔드 서비스로 이동
2. **"Variables"** 탭 클릭
3. PostgreSQL 서비스의 변수들이 자동으로 연결되어 있는지 확인
4. `USE_POSTGRESQL=true` 환경 변수 추가

### 4단계: 배포 확인

배포 후 로그에서 다음 메시지를 확인:
```
✅ PostgreSQL 데이터베이스 연결 완료
✅ 데이터베이스 초기화 완료
```

---

## 데이터베이스 자동 전환

현재 코드는 환경 변수에 따라 자동으로 전환됩니다:

- **SQLite 사용** (기본값, 개발 환경)
  - `USE_POSTGRESQL` 환경 변수가 없거나 `false`일 때

- **PostgreSQL 사용** (프로덕션)
  - `USE_POSTGRESQL=true` 환경 변수 설정 시
  - `DATABASE_URL` 환경 변수가 있으면 자동 감지

---

## SQLite → PostgreSQL 마이그레이션

### 기존 데이터가 있는 경우

1. **데이터 내보내기** (SQLite)
   ```bash
   sqlite3 moodtown.db .dump > backup.sql
   ```

2. **PostgreSQL로 가져오기** (필요 시)
   - Railway PostgreSQL 서비스의 연결 정보 사용
   - pgAdmin 또는 psql 클라이언트로 접속하여 데이터 가져오기

### 새로 시작하는 경우

- 자동으로 테이블이 생성되므로 추가 작업 불필요

---

## 로컬 개발 환경에서 PostgreSQL 테스트

### 1. PostgreSQL 설치
```bash
# Windows (Chocolatey)
choco install postgresql

# 또는 Docker 사용
docker run --name moodtown-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### 2. 환경 변수 설정 (.env 파일)
```env
USE_POSTGRESQL=true
DATABASE_URL=postgresql://postgres:password@localhost:5432/moodtown
```

### 3. 테스트 실행
```bash
cd backend
python app.py
```

---

## 문제 해결

### 연결 오류

1. **환경 변수 확인**
   - Railway 대시보드 → Variables 탭
   - `DATABASE_URL`이 올바르게 설정되었는지 확인

2. **서비스 연결 확인**
   - PostgreSQL 서비스가 백엔드 서비스와 연결되어 있는지 확인
   - Railway에서 자동으로 연결해주지만, 수동으로도 가능합니다

3. **로그 확인**
   ```bash
   railway logs
   ```
   또는 Railway 대시보드 → Logs 탭

### 테이블 생성 오류

- 데이터베이스 권한 확인
- 초기화 로그에서 오류 메시지 확인

---

## PostgreSQL vs SQLite 비교

| 기능 | SQLite | PostgreSQL |
|------|--------|------------|
| **데이터 지속성** | 파일 시스템 (임시) | 영구 저장 ✅ |
| **동시 접속** | 제한적 | 다중 사용자 지원 ✅ |
| **프로덕션 적합성** | 개발용 | 프로덕션 권장 ✅ |
| **Railway 호환성** | 데이터 손실 가능 | 안정적 ✅ |

**결론**: 프로덕션 환경에서는 PostgreSQL 사용을 강력히 권장합니다!

