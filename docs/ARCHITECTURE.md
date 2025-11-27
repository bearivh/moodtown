# SYSTEM ARCHITECTURE

moodtown의 시스템 아키텍처에 대한 상세 설명입니다.

## 기술 스택 흐름 다이어그램

![시스템 아키텍처](architecture.svg)

## 데이터 플로우 다이어그램

![데이터 플로우](data-flow.svg)


## 시스템 동작 원리

### 1. 일기 저장 플로우

```
사용자 작성 → 프론트엔드 → 백엔드 API
                      ↓
              GPT-4o-mini 감정 분석
                      ↓
              감정 점수 + 극성(polarity) 산출
                      ↓
              PostgreSQL 저장
                      ↓
              나무/우물 상태 업데이트
                      ↓
              대화 생성 (GPT)
                      ↓
              대화 저장 (DB)
                      ↓
              편지 생성 (필요시)
                      ↓
              응답 반환
```

### 2. 감정 분석 프로세스

1. **텍스트 전처리**: 일기 텍스트 정제
2. **GPT-4o-mini 분석**: 
   - 시스템 프롬프트로 7가지 감정 점수 요청
   - 각 감정에 대한 0~100점 점수 반환
   - 놀람/부끄러움의 경우 문맥 기반 극성 분석 요청
3. **하이브리드 극성 판단**:
   - 놀람/부끄러움은 부정적일 수도, 긍정적일 수도 있음
      - 긍정 놀람: 좋은 소식, 반가운 소식 / 부정 놀람: 충격, 갑작스러운 악재
      - 긍정 부끄러움: 수줍음, 두근거림 / 부정 부끄러움: 창피함, 수치심, 자책
   - Rule-based: 키워드 패턴 매칭
   - GPT 기반: 문맥 이해
   - 두 결과를 결합하여 최종 놀람과 부끄러움의 극성 결정
        - 스트레스 우물/행복 나무 반영에 사용됨
4. **점수 정규화**: 7가지 감정 점수의 총합이 100이 되도록 정규화
5. **결과 반환**: JSON 형식으로 감정 점수 및 극성 반환

### 3. 대화 생성 프로세스

1. **감정 점수 분석**: 0점 초과 감정 확인
2. **주민 선정**: 
   - 주요 감정 (score > 0): 자신의 감정을 주로 표현
   - 반응 감정 (score = 0): 다른 감정들에게 반응만
3. **GPT 프롬프트 구성**:
   - 일기 내용
   - 주민의 성격, 말투
   - 역할 규칙 (주요 감정 vs 반응 감정)
4. **대화 생성**: GPT가 각 주민의 특성을 반영한 자연스러운 대화 생성
5. **DB 저장**: 생성된 대화를 JSONB 형식으로 저장

### 4. 캐시 시스템

프론트엔드는 모듈 레벨 캐싱을 사용하여 성능을 최적화합니다:

- **`diaryCache`**: 날짜별 일기 데이터 캐시
- **`plazaDataCache`**: 광장 대화 및 감정 점수 캐시
- **`wellStateCache`**: 우물 상태 캐시
- **`treeStateCache`**: 나무 상태 캐시
- **`villageStateCache`**: 마을 상태 캐시

캐시는 컴포넌트가 언마운트되어도 유지되어, 같은 페이지로 돌아왔을 때 즉시 데이터를 표시할 수 있습니다.

## 프로젝트 구조

```
moodtown/
├── backend/                 # Flask 백엔드
│   ├── api/                # API 라우트
│   │   ├── auth.py        # 인증
│   │   ├── diary.py       # 일기 CRUD
│   │   ├── letters.py     # 편지 관리
│   │   ├── tree.py        # 행복 나무
│   │   ├── well.py        # 스트레스 우물
│   │   └── routes.py      # 메인 라우트
│   ├── services/          # 비즈니스 로직
│   │   ├── emotion_gpt.py      # GPT 감정 분석
│   │   ├── emotion_ml.py       # ML 감정 분석
│   │   ├── conversation.py     # 광장 대화 생성
│   │   ├── letter_generator.py # 편지 생성
│   │   ├── diary_similarity.py # 유사 일기 검색
│   │   ├── train_emotion_ml.py # 감정 분석 모델 학습
│   │   ├── train_diary_similarity.py # 유사 일기 검색 모델 학습
│   │   └── models/        # 학습된 모델 파일
│   ├── core/              # 공통 모듈
│   │   └── common.py      # 공통 함수 및 캐릭터 정보
│   ├── characters.json    # 감정 주민 캐릭터 정의
│   ├── db.py             # 데이터베이스 연결 및 함수
│   └── app.py            # Flask 앱 진입점
│
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── pages/        # 페이지 컴포넌트
│   │   │   ├── Home.jsx         # 홈 화면
│   │   │   ├── Village.jsx      # 마을 입구
│   │   │   ├── WriteDiary.jsx   # 일기 작성
│   │   │   ├── Plaza.jsx        # 와글와글 광장
│   │   │   ├── Tree.jsx         # 행복 나무
│   │   │   ├── Well.jsx         # 스트레스 우물
│   │   │   ├── Office.jsx       # 마을 사무소
│   │   │   └── Mailbox.jsx      # 우체통
│   │   ├── components/   # 재사용 컴포넌트
│   │   ├── utils/        # 유틸리티 함수
│   │   └── App.jsx       # 메인 앱
│   └── package.json
│
├── 감성대화말뭉치(최종데이터)_Training.json    # ML 학습 데이터
└── README.md  
```

ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ  
[← README로 돌아가기](../README.md)