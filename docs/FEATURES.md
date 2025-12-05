# 🌈 MOODTOWN  
감정 기반 인터랙티브 타운형 감정 일기 플랫폼

![moodtown!](frontend/src/assets/icons/moodtown!.svg)

moodtown은 사용자의 일기를 **AI가 분석해 7가지 감정의 주민 캐릭터로 시각화**하고,  
감정 기반의 마을을 **성장·변화·반응**시키는 인터랙티브 감정 다이어리 플랫폼입니다.

---

## 🔗 배포 링크
[☘️ Go to moodtown!](https://moodtown-three.vercel.app/)

## 🎬 시연 영상
[![시연 영상 보기](https://img.shields.io/badge/click!-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/E_laHcBldvI)

## 🧪 테스트 계정
- **ID:** ososo  
- **PW:** moodtown  

---

# 📚 목차
- [1. 프로젝트 소개](#1-프로젝트-소개)
- [2. 주요 기능](#2-주요-기능)
- [3. 시스템 아키텍처](#3-시스템-아키텍처)
- [4. 머신러닝 모델 요약](#4-머신러닝-모델-요약)
- [5. 사용 기술 스택](#5-사용-기술-스택)
- [6. 실행 방법](#6-실행-방법)
- [7. 폴더 구조](#7-폴더-구조)
- [8. 시연 GIF / 스크린샷](#8-시연-gif--스크린샷)
- [9. 핵심 개념](#9-핵심-개념)
- [10. 문서 링크](#10-문서-링크)
- [📝 라이선스](#-라이선스)
- [📚 참고 자료](#-참고-자료)

---

# 1. 프로젝트 소개

moodtown은 **AI 감정 분석 + 감정 의인화 + 게임화(Gamification)**를 결합한 감정 일기 플랫폼입니다.

일기를 작성하면:

- 🤖 **AI 감정 분석 (GPT-4o-mini)**  
- 👥 **감정 주민 7명이 대화**  
- 🌳 **행복 나무 성장**  
- 💧 **스트레스 우물 변화**  
- 💌 **감정 편지 생성**  

사용자의 감정 상태가 마을 곳곳에 반영되며  
자기 이해와 감정 탐색을 돕는 **감정 기반 인터랙티브 타운 게임**입니다.

---

# 2. 주요 기능

## 🖼 기본 화면
<table>
  <tr>
    <td align="center"><img src="screenshots/login.png" width="90%"><br>로그인</td>
    <td align="center"><img src="screenshots/home.png" width="90%"><br>마을 입구</td>
    <td align="center"><img src="screenshots/village.png" width="90%"><br>마을 전체</td>
  </tr>
</table>

---

## 2-1. 🧩 무지개 주민 (Emotion Residents)

| 캐릭터 | 감정 | 설명 |
|-------|------|------|
| 빨강이 | 분노 | 화남, 짜증 |
| 주황이 | 부끄러움 | 수줍음, 자책 |
| 노랑이 | 기쁨 | 즐거움, 행복 |
| 초록이 | 사랑 | 따뜻함, 애정 |
| 파랑이 | 슬픔 | 우울, 속상함 |
| 남색이 | 두려움 | 불안, 초조 |
| 보라 | 놀람 | 충격, 호기심 |

![무지개 주민](screenshots/resident.png)

GPT가 주민의 말투·성격을 반영해 **스토리텔링 대화**를 생성합니다.

---

## 2-2. 🔍 감정 분석 시스템

| 유형 | 역할 | 정확도 | 실제 사용 |
|------|------|---------|-----------|
| ML 모델 | 참고용 감정 분류 | 보통 | ❌ |
| GPT-4o-mini | 실제 감정 분석 | 높음 | ✔ |

- 일기 텍스트 기반 **7가지 감정 점수 분석**
- 놀람·부끄러움은 **문맥 기반 극성(+/-) 분석**

<p align="center">
<img src="screenshots/ml_analysis.png" width="45%">
<img src="screenshots/gpt_analysis.png" width="45%">
</p>

---

## 2-3. ☁️ Emotion Sky (마을 하늘 변화)

- 가장 높은 감정 → 하늘 색 결정
- 감정별 색상:
  - 기쁨: 노랑  
  - 슬픔: 파랑  
  - 사랑: 연두  
  - 분노: 빨강  

`EmotionSky.jsx`에서 애니메이션 처리

---

## 2-4. 🌳 Happiness Tree (행복 나무)

### 성장 기여 감정  
기쁨 / 사랑 / 긍정 놀람 / 긍정 부끄러움

### 성장 단계

| 단계 | 점수 |
|------|------|
| 씨앗 | 0 |
| 새싹 | 40 |
| 묘목 | 100 |
| 중간 나무 | 220 |
| 큰 나무 | 380 |
| 열매 생성 | 600 |

열매 생성 →  
- 축하 편지  
- 우물 물 -30  
- 나무 리셋  

![tree](screenshots/tree.png)

---

## 2-5. 💧 Stress Well (스트레스 우물)

물을 채우는 감정:
- 분노 / 슬픔 / 두려움 / 부정 놀람 / 부정 부끄러움

특별 규칙:
- 긍정 감정만 있으면 -30  
- 열매 생성 시 -30  

<p align="center">
<img src="screenshots/well.png" width="45%">
<img src="screenshots/well_full.png" width="45%">
</p>

---

## 2-6. 🗣 Emotion Plaza (와글와글 광장)

- GPT가 감정 주민 대화 생성
- 주요 감정(score > 0): 적극적 참여  
- 반응 감정(score = 0): 보조적 참여  
- 일기 수정 시 자동 재생성

![plaza](screenshots/plaza.png)

---

## 2-7. 📬 Emotion Mail (편지 시스템)

| 편지 종류 | 조건 | 보낸 주민 |
|----------|------|-----------|
| 감정 편지 | 특정 감정 ≥ 70% | 해당 감정 |
| 축하 편지 | 열매 생성 | 기쁨·사랑 |
| 위로 편지 | 우물 넘침 | 슬픔·두려움·분노 |

![letter](screenshots/letter.png)

---

## 2-8. 🏠 Town Office (마을 사무소)

- 감정 캘린더
- 월간 감정 비율
- 주간 감정 추이
- 요일별 패턴
- streak
- **유사한 일기 찾기 (Doc2Vec)**

![office1](screenshots/office1.png)
![office2](screenshots/office2.png)

---

# 3. 시스템 아키텍처

## 📌 시스템 구조 다이어그램
![architecture](docs/architecture.svg)

## 📌 데이터 플로우
![data-flow](docs/data-flow.svg)

---

## 📌 감정 분석 / 대화 생성 프로세스

### ① 감정 분석
텍스트 입력
→ GPT-4o-mini 감정 점수 산출
→ 문맥 기반 극성 분석 (놀람/부끄러움)
→ 규칙 기반 분석 + GPT 결과 결합
→ 감정 점수 정규화 (총합 100)
→ 최종 감정 점수·극성 반환


### ② 대화 생성
감정 점수 확인
→ 주요/반응 감정 분류
→ 주민 성격·말투 기반 프롬프트 구성
→ GPT-4o-mini로 대화 생성
→ plaza_conversations 테이블에 저장


---

## 📌 프론트엔드 캐싱 구조

모듈 레벨 캐시(Map)로 즉시 로딩 제공:

- diaryCache  
- plazaDataCache  
- treeStateCache  
- wellStateCache  
- villageStateCache  

컴포넌트 언마운트와 무관하게 유지됨.

---

# 4. 머신러닝 모델 요약

## 4-1. 감정 분석 ML 모델 (참고용)

- Logistic Regression + TF-IDF  
- 감성대화말뭉치 사용  
- 프로젝트 감정 7종으로 매핑  
- 정확도 97.22%

라벨 매핑 규칙 포함  
(당황 → 놀람/부끄러움 50:50 등)

Confusion Matrix:  
![cm](backend/services/models/confusion_matrix.png)

---

## 4-2. 유사 일기 검색 모델 (실제 사용)

- Doc2Vec 기반 문서 임베딩  
- 텍스트 유사도 + 감정점수 유사도 결합  
- 마을사무소 “유사한 일기 찾기” 기능에서 사용\
최종 유사도 = (텍스트 유사도 × 0.6) + (감정 점수 유사도 × 0.4)


---

# 5. 사용 기술 스택

**Frontend**
- React 19.2.0  
- Vite (Rolldown 7.2.2)  
- Dongle Font  
- CSS Modules  

**Backend**
- Flask 3.1.2  
- PostgreSQL  
- OpenAI API (GPT-4o-mini)  
- Gunicorn / Railway  

**ML**
- scikit-learn Logistic Regression  
- Gensim Doc2Vec  

---

# 6. 실행 방법

## Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python -c "from db import init_db; init_db()"
python app.py
```

## Frontend
```bash
cd frontend
npm install
npm run dev
```

# 7. 폴더 구조
moodtown/
├── backend/
│   ├── api/
│   ├── services/
│   ├── core/
│   ├── app.py
│   └── db.py
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── utils/
│   │   └── assets/
├── screenshots/
├── docs/
└── README.md

# 8. 라이선스
MIL License

# 9. 
