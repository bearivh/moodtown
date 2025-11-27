# API REFERENCE

moodtown 백엔드 API 엔드포인트 문서입니다.

## 기본 정보

- **Base URL**: `http://localhost:5000` 개발 URL
- **인증**: 세션 쿠키 기반 (대부분의 엔드포인트는 인증 필요)

## 인증 (Auth)

### 회원가입
```
POST /api/auth/register
```

**Request Body**:
```json
{
  "username": "사용자명",
  "password": "비밀번호"
}
```

**Response**: 200 OK
```json
{
  "message": "회원가입 성공",
  "user": {
    "id": 1,
    "username": "사용자명"
  }
}
```

### 로그인
```
POST /api/auth/login
```

**Request Body**:
```json
{
  "username": "사용자명",
  "password": "비밀번호"
}
```

**Response**: 200 OK (세션 쿠키 설정)

### 로그아웃
```
POST /api/auth/logout
```

**Response**: 200 OK

### 현재 사용자 정보
```
GET /api/auth/me
```

**Response**: 200 OK
```json
{
  "id": 1,
  "username": "사용자명"
}
```

## 일기 (Diaries)

### 일기 목록 조회
```
GET /api/diaries?date=YYYY-MM-DD
```

**Query Parameters**:
- `date` (optional): 특정 날짜의 일기 조회

**Response**: 200 OK
```json
[
  {
    "id": "일기ID",
    "title": "일기 제목",
    "content": "일기 내용",
    "date": "2024-01-01",
    "emotion_scores": {...},
    "created_at": "..."
  }
]
```

### 특정 일기 조회
```
GET /api/diaries/<diary_id>
```

**Response**: 200 OK

### 일기 생성
```
POST /api/diaries
```

**Request Body**:
```json
{
  "title": "일기 제목",
  "content": "일기 내용",
  "date": "2024-01-01"
}
```

**Response**: 201 Created

### 일기 수정
```
POST /api/diaries/replace
```

**Request Body**:
```json
{
  "id": "일기ID",
  "title": "수정된 제목",
  "content": "수정된 내용",
  "date": "2024-01-01"
}
```

**Response**: 200 OK

### 일기 삭제
```
DELETE /api/diaries/<diary_id>
```

**Response**: 200 OK

### 마을 사무소 통계
```
GET /api/stats/office
```

**Response**: 200 OK
```json
{
  "calendarData": {...},
  "weeklyStats": {...},
  "monthlyStats": {...},
  "additionalStats": {...}
}
```

### 유사 일기 찾기 (ID 기준)
```
GET /api/diaries/<diary_id>/similar?top_n=5&min_similarity=0.3
```

**Query Parameters**:
- `top_n` (optional): 반환할 일기 개수 (기본값: 5)
- `min_similarity` (optional): 최소 유사도 (기본값: 0.3)

**Response**: 200 OK

### 유사 일기 찾기 (텍스트 기준)
```
POST /api/diaries/similar
```

**Request Body**:
```json
{
  "text": "일기 텍스트",
  "top_n": 5,
  "min_similarity": 0.3
}
```

**Response**: 200 OK

## 와글와글 광장 (Plaza)

### 대화 조회
```
GET /api/plaza/conversations/<date>
```

**Path Parameters**:
- `date`: 날짜 (YYYY-MM-DD 형식)

**Response**: 200 OK
```json
{
  "conversation": [...],
  "emotion_scores": {...}
}
```

### 대화 저장
```
POST /api/plaza/conversations
```

**Request Body**:
```json
{
  "date": "2024-01-01",
  "conversation": [...],
  "emotion_scores": {...}
}
```

**Response**: 200 OK

## 행복 나무 (Tree)

### 나무 상태 조회
```
GET /api/tree/state
```

**Response**: 200 OK
```json
{
  "stage": "TREE",
  "progress": 75,
  "fruit_count": 3
}
```

### 나무 상태 저장
```
POST /api/tree/state
```

**Request Body**:
```json
{
  "stage": "TREE",
  "progress": 75,
  "fruit_count": 3
}
```

**Response**: 200 OK

### 열매 개수 조회
```
GET /api/tree/fruits
```

**Response**: 200 OK
```json
{
  "count": 3
}
```

### 열매 개수 저장
```
POST /api/tree/fruits
```

**Request Body**:
```json
{
  "count": 3
}
```

**Response**: 200 OK

### 나무 성장도 감소
```
POST /api/tree/subtract
```

**Request Body**:
```json
{
  "amount": 30
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "growth": 270,
  "stage": 3
}
```

## 스트레스 우물 (Well)

### 우물 상태 조회
```
GET /api/well/state
```

**Response**: 200 OK
```json
{
  "water_percent": 60
}
```

### 우물 상태 저장
```
POST /api/well/state
```

**Request Body**:
```json
{
  "water_percent": 60
}
```

**Response**: 200 OK

### 물 높이 감소
```
POST /api/well/subtract
```

**Request Body**:
```json
{
  "amount": 30
}
```

**Response**: 200 OK

## 편지 (Letters)

### 편지 목록 조회
```
GET /api/letters
```

**Response**: 200 OK
```json
[
  {
    "id": "편지ID",
    "sender": "노랑이",
    "content": "편지 내용",
    "read": false,
    "created_at": "..."
  }
]
```

### 편지 생성 (관리자)
```
POST /api/letters
```

### 편지 읽음 처리
```
POST /api/letters/<letter_id>/read
```

**Response**: 200 OK

### 편지 삭제
```
DELETE /api/letters/<letter_id>
```

**Response**: 200 OK

### 읽지 않은 편지 개수
```
GET /api/letters/unread/count
```

**Response**: 200 OK
```json
{
  "count": 3
}
```

### 편지 생성 (GPT)
```
POST /api/letters/generate
```

**Request Body**:
```json
{
  "type": "celebration",
  "emotion_scores": {...},
  "fruit_count": 3,
  "diary_text": "일기 내용"
}
```

**Request Fields**:
- `type` (required): 편지 종류 ("celebration", "comfort", "cheer", "well_overflow", "emotion_high")
- `emotion_scores` (optional): 감정 점수
- `fruit_count` (optional): 열매 개수
- `diary_text` (optional): 일기 내용

**Response**: 200 OK
```json
{
  "title": "편지 제목",
  "content": "편지 내용",
  "from": "주민 이름",
  "type": "편지 종류"
}
```

## 감정 분석 (Analysis)

### 감정 분석 (v1)
```
POST /api/analyze
```

**Request Body**:
```json
{
  "content": "일기 내용"
}
```

**Response**: 200 OK
```json
{
  "emotion_result": {
    "emotion_scores": {...},
    "emotion_polarity": {...}
  },
  "openai_dialogue": "대화 내용"
}
```

### 감정 분석 (v2)
```
POST /api/analyze2
```

**Request Body**:
```json
{
  "content": "일기 내용",
  "mode": "gpt"  // 또는 "ml"
}
```

**Response**: 200 OK

## 채팅 (Chat)

### 주민과 채팅
```
POST /api/chat
```

**Request Body**:
```json
{
  "message": "사용자 메시지",
  "characters": ["기쁨", "사랑"],
  "date": "2024-01-01",
  "diary_content": "일기 내용"
}
```

**Request Fields**:
- `message` (required): 사용자 메시지
- `characters` (required): 참여 감정 주민 배열 (예: ["기쁨", "사랑"])
- `date` (optional): 세션 날짜 (기본값: "default")
- `diary_content` (optional): 일기 내용

**Response**: 200 OK
```json
{
  "reply": "주민들의 대답"
}
```

## 헬스 체크

### 서버 상태 확인
```
GET /health
```

**Response**: 200 OK
```json
{
  "status": "healthy",
  "message": "API is running",
  "environment": "development"
}
```

## 에러 응답

모든 에러는 다음 형식으로 반환됩니다:

```json
{
  "error": "에러 메시지"
}
```

**상태 코드**:
- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `401`: 인증 필요
- `404`: 리소스를 찾을 수 없음
- `500`: 서버 오류


[← README로 돌아가기](../README.md)
