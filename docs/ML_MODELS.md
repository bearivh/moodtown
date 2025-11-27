# 🤖 머신러닝 모델 학습

이 프로젝트는 두 가지 ML 모델을 사용합니다.

## 1. 감정 분석 모델 (Emotion Classification)

### 개요
일기의 감정을 분류하는 **Logistic Regression** 기반 텍스트 분류 모델입니다. ML 모델의 분석 결과는 정확하지 않으므로 **참고용**으로 제공되며, 실제 마을 시스템에는 GPT-4o-mini의 분석 결과가 사용됩니다.

### 데이터셋
- **출처**: 과학기술정보통신부와 한국지능정보사회진흥원이 운영하는 국가 AI 개발 지원 플랫폼 [AI hub](https://aihub.or.kr/)
- **데이터셋**: [감성 대화 말뭉치 데이터셋](https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=86)
  - 원천 데이터(.xlsx)와 라벨링 데이터(.json) 중 라벨링 데이터를 사용했습니다.
- **파일**:
  - `감성대화말뭉치(최종데이터)_Training.json`: 학습 데이터
  - `감성대화말뭉치(최종데이터)_Validation.json`: 검증 데이터
- **데이터 형식**: JSON 파일, 각 데이터는 대화 텍스트와 감정 라벨을 포함

### 알고리즘 및 구조

#### 1. 텍스트 전처리
한국어 텍스트를 토큰화하여 학습 데이터 생성

#### 2. 특징 추출: TF-IDF Vectorization
- **TF-IDF (Term Frequency-Inverse Document Frequency)**: 단어의 중요도를 계산하는 방법
  - **TF (Term Frequency)**: 문서 내 단어 빈도
  - **IDF (Inverse Document Frequency)**: 전체 문서 대비 단어 출현 빈도의 역수
- **설정**:
  - `max_features=70000`: 최대 70,000개의 특징 단어 사용
  - `ngram_range=(1, 2)`: 1-gram과 2-gram 사용 (예: "기쁘다", "기쁘다 오늘")
  - `min_df=3`: 최소 3개 문서에서 등장한 단어만 사용
  - `sublinear_tf=True`: TF 값을 로그 스케일로 변환하여 더 나은 성능

#### 3. 분류 모델: Logistic Regression
- **알고리즘**: 다중 클래스 분류를 위한 Logistic Regression
- **설정**:
  - `solver="saga"`: 대규모 데이터셋에 적합한 최적화 알고리즘
  - `multi_class="multinomial"`: 다중 클래스 분류 방식
  - `class_weight="balanced"`: 클래스 불균형 문제 해결
  - `C=1.5`: 정규화 강도 (C 값이 클수록 더 복잡한 모델)
  - `max_iter=400`: 최대 반복 횟수
  - `n_jobs=4`: 병렬 처리 (4개 코어 사용)

#### 4. 후처리 및 매핑

**ML 모델의 원본 라벨 (6가지)**:
- ["분노", "슬픔", "불안", "상처", "당황", "기쁨"]

**프로젝트의 7가지 감정 시스템으로 매핑**:
- **기쁨**: 직접 매칭 (ML 모델의 "기쁨" 그대로 사용)
- **사랑**: 키워드 기반 매핑 ("기쁨"에서 키워드 감지 시 30% 재분배)
- **놀람**: "당황"에서 **50%** 매핑
- **두려움**: "불안"에서 매핑 (0.7배 스케일링)
- **분노**: 직접 매칭 (ML 모델의 "분노" 그대로 사용)
- **부끄러움**: "당황"에서 **50%** 매핑 (ML 모델에 직접적으로는 없지만, "당황"에서 생성됨)
- **슬픔**: "슬픔" + "상처"에서 매핑 ("상처"는 0.8배로 추가)

**매핑 상세 설명**:
- **"당황"** → "놀람" 50% + "부끄러움" 50%로 분산
- **"상처"** → "슬픔"에 0.8배로 추가
- **"불안"** → "두려움"으로 0.7배 스케일링
- **"사랑"** → "기쁨" 점수가 있을 때, 사랑 관련 키워드(사랑, 좋아, 애정, 그리움, 소중 등)가 감지되면 "기쁨" 점수의 30%를 "사랑"으로 재분배

**점수 조정 규칙**:
- 부정적 키워드가 있으면 "기쁨" 점수 감소
- "두려움" 점수 최대값 0.25로 제한 (과도한 예측 방지)
- 긍정적 키워드가 있으면 "기쁨" 점수 증가, 부정 감정 감소

### 학습 방법
```bash
cd backend/services

# 기본 학습 (데이터셋 경로 자동 탐지)
python train_emotion_ml.py

# 옵션 지정
python train_emotion_ml.py \
    --data-path "../감성대화말뭉치(최종데이터)_Training.json" \
    --val-path "../감성대화말뭉치(최종데이터)_Validation.json" \
    --output-dir "./models"
```

### 학습 과정
1. **데이터 로딩**: JSON 파일에서 텍스트와 라벨 추출
2. **데이터 분할**: 학습 데이터를 90% 학습 / 10% 테스트로 분할
3. **TF-IDF 벡터화**: 텍스트를 수치 벡터로 변환
4. **모델 학습**: Logistic Regression 모델 학습
5. **평가**: 테스트 데이터로 정확도, Precision, Recall, F1-Score 계산
6. **검증 데이터 평가**: Validation 데이터셋으로 추가 평가
7. **모델 저장**: 학습된 모델과 벡터라이저를 `joblib` 형식으로 저장

### 학습 결과

#### 전체 평가 지표
- **정확도 (Accuracy)**: **97.22%**
- **Macro F1-Score**: **97.70%**

#### 감정별 평가 지표

| 감정 | Precision | Recall | F1-Score | Support |
|------|-----------|--------|----------|---------|
| **기쁨** | 98.16% | 97.07% | 97.62% | 991 |
| **놀람** | 98.57% | 97.43% | 98.00% | 779 |
| **두려움** | 97.36% | 96.75% | 97.05% | 3,048 |
| **부끄러움** | 99.44% | 98.32% | 98.88% | 179 |
| **분노** | 95.55% | 97.10% | 96.32% | 1,482 |
| **사랑** | 98.92% | 98.66% | 98.79% | 372 |
| **슬픔** | 96.96% | 97.47% | 97.21% | 3,472 |

> **참고**: 위 지표들은 프로젝트의 7가지 감정 시스템으로 매핑 후의 결과입니다.  
> Support는 테스트 데이터에서 각 감정이 나타난 샘플 수입니다.

#### 저장된 파일
- **모델 파일**: `backend/services/models/emotion_ml.joblib`
  - 포함 내용: 분류기(`clf`), 벡터라이저(`vectorizer`), 클래스 목록(`classes`)
- **평가 지표**: `backend/services/models/metrics.json`
  - 정확도, Macro F1-Score 및 각 감정별 상세 지표 포함
- **Confusion Matrix**: `backend/services/models/confusion_matrix.png`
  - 테스트 데이터에 대한 혼동 행렬 시각화

### 모델 사용 방법
```python
from services.emotion_ml import predict

# 일기 텍스트 분석
result = predict("오늘 정말 기뻤어요!")
# 반환: {"label": "기쁨", "scores": {"기쁨": 0.85, "사랑": 0.0, ...}}
```

---

## 2. 유사 일기 검색 모델 (Diary Similarity)

### 개요
일기 간 유사도를 계산하여 비슷한 감정이나 내용의 일기를 찾아주는 **Doc2Vec** 기반 문서 임베딩 모델입니다. 이 모델은 **실제 기능**으로 사용되며, 마을 사무소의 "비슷한 일기 찾기" 기능에서 활용됩니다.

### 알고리즘: Doc2Vec

**Doc2Vec이란?**
- **Word2Vec**의 확장 버전으로, 단어뿐만 아니라 **문서 전체를 벡터로 표현**하는 방법
- 각 문서(일기)를 고정된 크기의 벡터로 변환하여 유사한 문서들을 찾을 수 있음
- **장점**: 
  - 문서의 의미적 유사도를 벡터 거리로 계산
  - 단어 순서와 문맥을 고려한 의미 표현
  - 학습 데이터에 없는 새로운 문서도 임베딩 가능

**학습 방식:**
1. 각 문서를 태그와 단어 시퀀스로 변환 (`TaggedDocument`)
2. 신경망 기반 학습으로 문서 벡터 생성
3. 유사한 의미의 문서들은 벡터 공간에서 가까운 위치에 배치

### 데이터셋
- **동일한 데이터셋 사용**: 감성 대화 말뭉치 데이터셋
- **목적**: 한국어 텍스트의 의미 패턴 학습

### 학습 방법
```bash
cd backend/services

# 유사 일기 검색 모델 학습
python train_diary_similarity.py

# 옵션 지정
python train_diary_similarity.py \
    --data-path "../감성대화말뭉치(최종데이터)_Training.json" \
    --output-dir "./models"
```

### 학습 과정
1. **데이터 로딩**: 대화 말뭉치에서 텍스트 추출
2. **토큰화**: 텍스트를 단어 단위로 분리
3. **TaggedDocument 생성**: 각 문서를 고유 태그와 함께 준비
4. **Doc2Vec 모델 학습**: 
   - 벡터 크기, 윈도우 크기, 학습률 등 하이퍼파라미터 설정
   - 신경망 학습을 통해 문서 벡터 생성
5. **모델 저장**: 학습된 Doc2Vec 모델 저장

### 학습 결과

#### 모델 설정 정보
- **벡터 크기 (Vector Size)**: 128 차원
- **윈도우 크기 (Window)**: 5
- **최소 단어 빈도 (Min Count)**: 2
- **학습 에폭 (Epochs)**: 20
- **어휘 크기 (Vocabulary Size)**: 69,221개 단어
- **학습 문서 수**: 51,644개
  - 감성 대화 말뭉치: 51,628개
  - 사용자 일기: 16개 (학습 시점 기준)
- **모델 구조**: PV-DM (Paragraph Vector - Distributed Memory)

> **참고**: Doc2Vec은 분류 모델이 아닌 임베딩 모델이므로 정확도, F1-Score 같은 전통적인 평가 지표가 없습니다.  
> 대신 문서 간 유사도를 코사인 유사도로 계산하여 유사한 일기를 찾는 방식으로 동작합니다.

#### 저장된 파일
- **모델 파일**: `backend/services/models/diary_similarity_doc2vec.model`
  - Gensim 형식으로 저장된 Doc2Vec 모델
- **메타데이터**: `backend/services/models/diary_similarity_metadata.json`
  - 모델 하이퍼파라미터 및 학습 정보

### 유사도 계산 방법

#### 1. 텍스트 유사도 (Doc2Vec)
- 일기 텍스트를 Doc2Vec 모델로 벡터화
- 코사인 유사도(Cosine Similarity)로 두 일기의 텍스트 유사도 계산

#### 2. 감정 점수 유사도
- 두 일기의 감정 점수 분포를 비교
- 유클리드 거리 또는 코사인 유사도 사용

#### 3. 최종 유사도 결합
```
최종 유사도 = (텍스트 유사도 × 0.6) + (감정 점수 유사도 × 0.4)
```
- 텍스트 유사도에 더 높은 가중치 부여
- 두 가지 요소를 종합적으로 고려하여 더 정확한 유사도 계산

### 모델 사용 방법
```python
from services.diary_similarity import find_similar_diaries

# 유사한 일기 찾기
similar_diaries = find_similar_diaries(
    diary_id="일기ID",
    user_id=사용자ID,
    top_n=5,  # 상위 5개
    min_similarity=0.3  # 최소 유사도 0.3
)
```

### 활용 사례
- **마을 사무소**: 특정 일기와 유사한 과거 일기들을 찾아 감정 패턴 파악
- **자기 이해**: 비슷한 상황에서의 감정 변화 추이 확인
- **통계 분석**: 유사한 감정을 보이는 일기들의 통계 제공

## 학습 전 체크리스트

1. **데이터셋 준비**
   - `감성대화말뭉치(최종데이터)_Training.json` 파일이 프로젝트 루트 또는 `backend/` 폴더에 있는지 확인

2. **의존성 설치**
   ```bash
   pip install scikit-learn gensim joblib matplotlib seaborn
   ```

3. **출력 디렉토리 확인**
   - `backend/services/models/` 폴더가 존재하는지 확인 (없으면 자동 생성됨)

## 모델 사용

학습된 모델은 애플리케이션 실행 시 자동으로 로드됩니다:
- 감정 분석: `backend/services/emotion_ml.py`의 `ml_predict()` 함수
- 유사 일기 검색: `backend/services/diary_similarity.py`의 `find_similar_diaries()` 함수


## 관련 문서

- [시스템 아키텍처](ARCHITECTURE.md)
- [백엔드 가이드](BACKEND.md)
- [API 레퍼런스](API_REFERENCE.md)


[← README.md로 돌아가기](../README.md)

