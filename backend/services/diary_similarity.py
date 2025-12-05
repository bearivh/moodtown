"""
유사 일기 검색 서비스
Sentence Transformer 모델을 사용하여 일기 간 텍스트 유사도를 계산하고,
감정 점수를 기반으로 감정 유사도를 계산하여 유사한 일기를 찾아줌
"""
import os
import json
from typing import List, Dict, Tuple, Optional, Any, TYPE_CHECKING
import numpy as np
from datetime import datetime

try:
    from sentence_transformers import SentenceTransformer
    _HAS_SENTENCE_TRANSFORMER = True
    print(f"[diary_similarity] sentence-transformers import 성공")
except ImportError as e:
    _HAS_SENTENCE_TRANSFORMER = False
    SentenceTransformer = None  # type: ignore
    print(f"[diary_similarity] sentence-transformers import 실패: {e}")

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_NAME = "jhgan/ko-sentence-transformer-multilingual"

_model: Optional[Any] = None


def load_model() -> bool:
    """Sentence Transformer 모델 로드"""
    global _model
    
    if _model is not None:
        return True
    
    if not _HAS_SENTENCE_TRANSFORMER:
        print(f"⚠️ 모델 로드 실패: sentence-transformers가 설치되지 않았습니다.")
        return False
    
    try:
        print(f"[모델로드] Sentence Transformer 모델 로딩 시작: {MODEL_NAME}")
        _model = SentenceTransformer(MODEL_NAME)
        print(f"[모델로드] 모델 로드 성공!")
        return True
    except Exception as e:
        print(f"⚠️ 모델 로드 실패: {e}")
        import traceback
        traceback.print_exc()
        return False


def get_diary_vector(diary_text: str) -> Optional[np.ndarray]:
    """일기 텍스트를 벡터로 변환 (Sentence Transformer 사용)"""
    if not load_model():
        return None
    
    if not diary_text or not diary_text.strip():
        return None
    
    try:
        # sentence transformer는 토큰화 불필요, 직접 텍스트 입력
        vector = _model.encode(diary_text, convert_to_numpy=True)
        return vector
    except Exception as e:
        print(f"⚠️ 벡터 변환 실패: {e}")
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


def find_similar_diaries_separated(
    target_diary_id: Optional[str] = None,
    target_diary_text: Optional[str] = None,
    user_id: Optional[int] = None,
    min_text_similarity: float = 0.3,
    min_emotion_similarity: float = 0.3,
    exclude_date: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    유사한 일기 찾기 - 텍스트 유사도와 감정 유사도를 분리해서 각각 1개씩 반환
    
    Args:
        target_diary_id: 기준 일기 ID (데이터베이스에서 조회)
        target_diary_text: 기준 일기 텍스트 (직접 제공)
        user_id: 사용자 ID (해당 사용자의 일기만 검색)
        min_text_similarity: 최소 텍스트 유사도 임계값
        min_emotion_similarity: 최소 감정 유사도 임계값
        exclude_date: 제외할 날짜 (현재 일기와 같은 날짜 제외 등)
    
    Returns:
        {
            "text_similar": {...},  # 텍스트가 가장 유사한 일기 1개
            "emotion_similar": {...}  # 감정이 가장 유사한 일기 1개
        }
        모델이 없으면 None 반환
    """
    if not load_model():
        print(f"⚠️ 모델 로드 실패: sentence-transformers가 설치되지 않았을 수 있습니다.")
        return None
    
    # PostgreSQL 연결을 위한 import
    try:
        from db import get_db, get_diary_by_id, get_all_diaries
    except ImportError:
        print("⚠️ db 모듈을 import할 수 없습니다.")
        return None
    
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
            return None
    
    elif target_diary_text:
        target_vector = get_diary_vector(target_diary_text)
    
    if target_vector is None:
        return None
    
    # 사용자 ID가 없으면 빈 리스트 반환
    if user_id is None:
        print("⚠️ user_id가 필요합니다.")
        return None
    
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
        
        print(f"[유사일기검색] 전체 일기 개수: {len(all_diaries)}, 필터링 후: {len(filtered_diaries)}")
        
    except Exception as e:
        print(f"⚠️ 일기 목록 조회 실패: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    # 각 일기와의 유사도 계산
    text_similarities = []
    emotion_similarities = []
    target_emotion_scores = target_diary.get("emotion_scores", {}) if target_diary else {}
    
    print(f"[유사일기검색] 필터링된 일기 개수: {len(filtered_diaries)}")
    print(f"[유사일기검색] 최소 텍스트 유사도: {min_text_similarity}, 최소 감정 유사도: {min_emotion_similarity}")
    
    for diary in filtered_diaries:
        diary_id = diary.get("id")
        diary_content = diary.get("content", "")
        
        # 벡터 계산
        diary_vector = get_diary_vector(diary_content)
        if diary_vector is None:
            continue
        
        # 텍스트 유사도 계산
        text_sim = cosine_similarity(target_vector, diary_vector)
        
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
        emotion_sim = calculate_emotion_similarity(target_emotion_scores, diary_emotion_scores)
        
        # 모든 유사도 저장 (임계값과 관계없이)
        text_similarities.append({
            "id": diary_id,
            "date": diary.get("date", ""),
            "title": diary.get("title", ""),
            "content": diary_content[:200] + "..." if len(diary_content) > 200 else diary_content,
            "similarity": float(text_sim),
            "emotion_scores": diary_emotion_scores
        })
        
        emotion_similarities.append({
            "id": diary_id,
            "date": diary.get("date", ""),
            "title": diary.get("title", ""),
            "content": diary_content[:200] + "..." if len(diary_content) > 200 else diary_content,
            "similarity": float(emotion_sim),
            "emotion_scores": diary_emotion_scores
        })
    
    # 텍스트 유사도 순으로 정렬
    text_similarities.sort(key=lambda x: x["similarity"], reverse=True)
    # 감정 유사도 순으로 정렬
    emotion_similarities.sort(key=lambda x: x["similarity"], reverse=True)
    
    print(f"[유사일기검색] 텍스트 유사도 후보: {len(text_similarities)}개")
    print(f"[유사일기검색] 감정 유사도 후보: {len(emotion_similarities)}개")
    
    # 임계값을 만족하는 것 중 최상위 1개 선택, 없으면 전체 중 최상위 1개 선택
    text_result = None
    emotion_result = None
    
    # 텍스트 유사도: 임계값 이상인 것 중 최상위, 없으면 전체 중 최상위
    for item in text_similarities:
        if item["similarity"] >= min_text_similarity:
            text_result = item
            break
    if text_result is None and text_similarities:
        text_result = text_similarities[0]
        print(f"[유사일기검색] 텍스트 유사도 임계값 미만이지만 최상위 결과 반환: {text_result['similarity']:.3f}")
    
    # 감정 유사도: 임계값 이상인 것 중 최상위, 없으면 전체 중 최상위
    for item in emotion_similarities:
        if item["similarity"] >= min_emotion_similarity:
            emotion_result = item
            break
    if emotion_result is None and emotion_similarities:
        emotion_result = emotion_similarities[0]
        print(f"[유사일기검색] 감정 유사도 임계값 미만이지만 최상위 결과 반환: {emotion_result['similarity']:.3f}")
    
    result = {
        "text_similar": text_result,
        "emotion_similar": emotion_result
    }
    
    return result


# 하위 호환성을 위한 기존 함수 (deprecated)
def find_similar_diaries(
    target_diary_id: Optional[str] = None,
    target_diary_text: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 5,
    min_similarity: float = 0.3,
    exclude_date: Optional[str] = None
) -> Optional[List[Dict[str, Any]]]:
    """
    유사한 일기 찾기 (하위 호환성용, deprecated)
    새로운 코드는 find_similar_diaries_separated를 사용하세요.
    """
    result = find_similar_diaries_separated(
        target_diary_id=target_diary_id,
        target_diary_text=target_diary_text,
        user_id=user_id,
        min_text_similarity=min_similarity,
        min_emotion_similarity=min_similarity,
        exclude_date=exclude_date
    )
    
    if result is None:
        return None
    
    # 기존 형식으로 변환 (텍스트 유사도 우선)
    similar_diaries = []
    if result.get("text_similar"):
        similar_diaries.append(result["text_similar"])
    if result.get("emotion_similar") and result["emotion_similar"].get("id") != result.get("text_similar", {}).get("id"):
        similar_diaries.append(result["emotion_similar"])
    
    return similar_diaries[:limit]


def find_similar_diaries_by_text(
    text: str,
    user_id: Optional[int] = None,
    limit: int = 5,
    min_similarity: float = 0.3
) -> List[Dict[str, Any]]:
    """
    텍스트를 기준으로 유사한 일기 찾기 (특정 일기 ID 없이)
    """
    result = find_similar_diaries_separated(
        target_diary_text=text,
        user_id=user_id,
        min_text_similarity=min_similarity,
        min_emotion_similarity=min_similarity
    )
    
    if result is None:
        return []
    
    # 기존 형식으로 변환
    similar_diaries = []
    if result.get("text_similar"):
        similar_diaries.append(result["text_similar"])
    if result.get("emotion_similar") and result["emotion_similar"].get("id") != result.get("text_similar", {}).get("id"):
        similar_diaries.append(result["emotion_similar"])
    
    return similar_diaries[:limit]


def get_similarity_score(text1: str, text2: str) -> float:
    """두 텍스트 간의 유사도 점수 반환 (0~1)"""
    vec1 = get_diary_vector(text1)
    vec2 = get_diary_vector(text2)
    
    if vec1 is None or vec2 is None:
        return 0.0
    
    return float(cosine_similarity(vec1, vec2))
