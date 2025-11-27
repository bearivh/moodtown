"""
유사 일기 검색 서비스
Doc2Vec 모델을 사용하여 일기 간 유사도를 계산하고 유사한 일기를 찾아줌
"""
import os
import json
from typing import List, Dict, Tuple, Optional, Any, TYPE_CHECKING
import numpy as np
from datetime import datetime

try:
    from gensim.models import Doc2Vec
    from gensim.models.doc2vec import TaggedDocument
    _HAS_GENSIM = True
    print(f"[diary_similarity] gensim import 성공")
except ImportError as e:
    _HAS_GENSIM = False
    # 타입 힌트용 더미 클래스
    Doc2Vec = None  # type: ignore
    print(f"[diary_similarity] gensim import 실패: {e}")

if TYPE_CHECKING:
    from gensim.models import Doc2Vec

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "diary_similarity_doc2vec.model"))

_model: Optional[Any] = None


def simple_tokenize(text: str) -> List[str]:
    """간단한 토큰화"""
    import re
    text = re.sub(r'[^\w\s가-힣]', ' ', text)
    tokens = text.split()
    return [t.strip() for t in tokens if t.strip() and len(t.strip()) > 1]


def load_model() -> bool:
    """Doc2Vec 모델 로드"""
    global _model
    
    if _model is not None:
        return True
    
    if not _HAS_GENSIM:
        print(f"⚠️ 모델 로드 실패: gensim이 설치되지 않았습니다.")
        return False
    
    # 경로 정규화
    normalized_path = os.path.abspath(MODEL_FILE)
    print(f"[모델로드] 모델 파일 경로 확인: {normalized_path}")
    print(f"[모델로드] 파일 존재 여부: {os.path.exists(normalized_path)}")
    
    if not os.path.exists(normalized_path):
        print(f"⚠️ 모델 파일이 존재하지 않습니다: {normalized_path}")
        return False
    
    try:
        print(f"[모델로드] 모델 로딩 시작...")
        _model = Doc2Vec.load(normalized_path)
        print(f"[모델로드] 모델 로드 성공!")
        return True
    except Exception as e:
        print(f"⚠️ 모델 로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_diary_vector(diary_text: str) -> Optional[np.ndarray]:
    """일기 텍스트를 벡터로 변환"""
    if not load_model():
        return None
    
    tokens = simple_tokenize(diary_text)
    if len(tokens) == 0:
        return None
    
    try:
        vector = _model.infer_vector(tokens)
        return vector
    except Exception:
        return None


def cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """코사인 유사도 계산"""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)


def calculate_emotion_similarity(emotion_scores1: Dict[str, Any], emotion_scores2: Dict[str, Any]) -> float:
    """
    두 일기의 감정 점수 간 유사도 계산 (0~1)
    감정 점수가 비슷할수록 높은 점수
    """
    if not emotion_scores1 or not emotion_scores2:
        return 0.5  # 감정 점수가 없으면 중간값 반환
    
    # 7개 감정 키
    emotion_keys = ["기쁨", "사랑", "놀람", "두려움", "분노", "부끄러움", "슬픔"]
    
    # 감정 벡터 생성
    vec1 = np.array([float(emotion_scores1.get(key, 0)) for key in emotion_keys])
    vec2 = np.array([float(emotion_scores2.get(key, 0)) for key in emotion_keys])
    
    # 정규화 (0~100 -> 0~1)
    if np.sum(vec1) > 0:
        vec1 = vec1 / 100.0
    if np.sum(vec2) > 0:
        vec2 = vec2 / 100.0
    
    # 코사인 유사도 계산
    return cosine_similarity(vec1, vec2)


def calculate_combined_similarity(
    text_similarity: float,
    emotion_similarity: float,
    emotion_scores1: Optional[Dict[str, Any]] = None,
    emotion_scores2: Optional[Dict[str, Any]] = None,
    text_weight: float = 0.5,
    emotion_weight: float = 0.5
) -> float:
    """
    텍스트 유사도와 감정 유사도를 결합
    
    Args:
        text_similarity: 텍스트 유사도 (0~1)
        emotion_similarity: 감정 유사도 (0~1)
        emotion_scores1: 기준 일기 감정 점수 (선택)
        emotion_scores2: 비교 일기 감정 점수 (선택)
        text_weight: 텍스트 가중치 (기본 0.5)
        emotion_weight: 감정 가중치 (기본 0.5)
    
    Returns:
        결합된 유사도 (0~1)
    """
    combined = (text_similarity * text_weight) + (emotion_similarity * emotion_weight)
    
    # 감정이 너무 다르면 페널티 부여
    if emotion_similarity < 0.4:  # 감정 유사도가 40% 미만
        penalty = (0.4 - emotion_similarity) * 1.5  # 강한 페널티
        combined = max(0.0, combined - penalty)
    
    # 긍정/부정 감정이 반대인 경우 추가 페널티
    if emotion_scores1 and emotion_scores2:
        positive_emotions = ["기쁨", "사랑"]
        negative_emotions = ["분노", "슬픔", "두려움"]
        
        # 기준 일기의 주요 감정
        target_pos = sum(emotion_scores1.get(e, 0) for e in positive_emotions)
        target_neg = sum(emotion_scores1.get(e, 0) for e in negative_emotions)
        
        # 비교 일기의 주요 감정
        diary_pos = sum(emotion_scores2.get(e, 0) for e in positive_emotions)
        diary_neg = sum(emotion_scores2.get(e, 0) for e in negative_emotions)
        
        # 긍정/부정이 반대인 경우 (예: 기준은 분노 높음, 비교는 기쁨 높음)
        if (target_neg > 50 and diary_pos > 50) or (target_pos > 50 and diary_neg > 50):
            # 반대 감정이면 40% 추가 감소
            combined = max(0.0, combined * 0.6)
    
    return min(1.0, combined)


def find_similar_diaries(
    target_diary_id: Optional[str] = None,
    target_diary_text: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 5,
    min_similarity: float = 0.3,
    exclude_date: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    유사한 일기 찾기 (PostgreSQL 사용)
    
    Args:
        target_diary_id: 기준 일기 ID (데이터베이스에서 조회)
        target_diary_text: 기준 일기 텍스트 (직접 제공)
        user_id: 사용자 ID (해당 사용자의 일기만 검색)
        limit: 반환할 최대 개수
        min_similarity: 최소 유사도 임계값
        exclude_date: 제외할 날짜 (현재 일기와 같은 날짜 제외 등)
    
    Returns:
        유사한 일기 목록 (similarity, diary 정보 포함)
        모델이 없으면 None 반환
    """
    if not load_model():
        print(f"⚠️ 모델 로드 실패: {MODEL_FILE} 파일이 없거나 gensim이 설치되지 않았을 수 있습니다.")
        return None
    
    # PostgreSQL 연결을 위한 import
    try:
        from db import get_db, get_diary_by_id, get_all_diaries
    except ImportError:
        print("⚠️ db 모듈을 import할 수 없습니다.")
        return []
    
    # 기준 일기 벡터 구하기
    target_vector = None
    target_diary = None
    
    if target_diary_id:
        # 데이터베이스에서 일기 조회
        try:
            target_diary = get_diary_by_id(target_diary_id)
            if target_diary:
                # emotion_scores가 dict인 경우 직접 사용, 아니면 JSON 파싱
                if isinstance(target_diary.get("emotion_scores"), dict):
                    emotion_scores = target_diary["emotion_scores"]
                else:
                    emotion_scores = json.loads(target_diary.get("emotion_scores") or "{}")
                
                target_diary = {
                    "id": target_diary["id"],
                    "date": target_diary["date"],
                    "title": target_diary.get("title", ""),
                    "content": target_diary.get("content", ""),
                    "emotion_scores": emotion_scores,
                    "user_id": target_diary.get("user_id")
                }
                target_vector = get_diary_vector(target_diary["content"])
                
                # user_id가 전달되지 않았으면 일기의 user_id 사용
                if user_id is None and target_diary.get("user_id"):
                    user_id = target_diary["user_id"]
        except Exception as e:
            print(f"⚠️ 일기 조회 실패: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    elif target_diary_text:
        target_vector = get_diary_vector(target_diary_text)
    
    if target_vector is None:
        return []
    
    # 사용자 ID가 없으면 빈 리스트 반환
    if user_id is None:
        print("⚠️ user_id가 필요합니다.")
        return []
    
    # 모든 일기 가져오기 (해당 사용자의 일기만)
    try:
        all_diaries = get_all_diaries(user_id=user_id)
        
        # 필터링: 내용이 있는 일기만, 현재 일기 제외, 특정 날짜 제외
        filtered_diaries = []
        for diary in all_diaries:
            # 현재 일기 제외
            if target_diary_id and diary.get("id") == target_diary_id:
                continue
            
            # 내용이 없는 일기 제외
            if not diary.get("content") or diary["content"].strip() == "":
                continue
            
            # 특정 날짜 제외
            if exclude_date and diary.get("date") == exclude_date:
                continue
            elif target_diary and target_diary.get("date") and diary.get("date") == target_diary["date"]:
                continue
            
            filtered_diaries.append(diary)
        
    except Exception as e:
        print(f"⚠️ 일기 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return []
    
    # 각 일기와의 유사도 계산
    similarities = []
    
    for diary in filtered_diaries:
        diary_id = diary.get("id")
        diary_content = diary.get("content", "")
        
        # 벡터 계산
        diary_vector = get_diary_vector(diary_content)
        if diary_vector is None:
            continue
        
        # 텍스트 유사도 계산
        text_similarity = cosine_similarity(target_vector, diary_vector)
        
        # 감정 점수 가져오기
        diary_emotion_scores = {}
        try:
            emotion_scores_raw = diary.get("emotion_scores")
            if emotion_scores_raw:
                if isinstance(emotion_scores_raw, dict):
                    diary_emotion_scores = emotion_scores_raw
                else:
                    diary_emotion_scores = json.loads(emotion_scores_raw)
        except Exception:
            pass
        
        # 감정 유사도 계산
        target_emotion_scores = target_diary.get("emotion_scores", {}) if target_diary else {}
        emotion_similarity = calculate_emotion_similarity(target_emotion_scores, diary_emotion_scores)
        
        # 결합된 유사도 계산 (텍스트 50% + 감정 50%, 감정 차이가 크면 페널티)
        combined_similarity = calculate_combined_similarity(
            text_similarity, 
            emotion_similarity,
            emotion_scores1=target_emotion_scores,
            emotion_scores2=diary_emotion_scores,
            text_weight=0.5,
            emotion_weight=0.5
        )
        
        if combined_similarity >= min_similarity:
            similarities.append({
                "id": diary_id,
                "date": diary.get("date", ""),
                "title": diary.get("title", ""),
                "content": diary_content[:200] + "..." if len(diary_content) > 200 else diary_content,  # 미리보기
                "similarity": float(combined_similarity),
                "text_similarity": float(text_similarity),  # 디버깅용
                "emotion_similarity": float(emotion_similarity),  # 디버깅용
                "emotion_scores": diary_emotion_scores
            })
    
    # 유사도 순으로 정렬
    similarities.sort(key=lambda x: x["similarity"], reverse=True)
    
    # 상위 N개만 반환
    return similarities[:limit]


def find_similar_diaries_by_text(
    text: str,
    user_id: Optional[int] = None,
    limit: int = 5,
    min_similarity: float = 0.3
) -> List[Dict[str, Any]]:
    """
    텍스트를 기준으로 유사한 일기 찾기 (특정 일기 ID 없이)
    """
    return find_similar_diaries(
        target_diary_text=text,
        user_id=user_id,
        limit=limit,
        min_similarity=min_similarity
    ) or []


def get_similarity_score(text1: str, text2: str) -> float:
    """두 텍스트 간의 유사도 점수 반환 (0~1)"""
    vec1 = get_diary_vector(text1)
    vec2 = get_diary_vector(text2)
    
    if vec1 is None or vec2 is None:
        return 0.0
    
    return float(cosine_similarity(vec1, vec2))

