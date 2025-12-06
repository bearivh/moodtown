import os
import json
from typing import Dict, Tuple, List, Optional

# Transformers 모델 사용
try:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    import torch
    TRANSFORMERS_AVAILABLE = True
    print("[Transformers] 라이브러리 import 성공")
except Exception as e:
    TRANSFORMERS_AVAILABLE = False
    print(f"[Transformers] 라이브러리 import 실패: {e}")
    import traceback
    traceback.print_exc()

# Transformers 모델 경로
# 환경 변수에서 가져오기 (Railway에서 설정한 Hugging Face Hub 경로)
# 없으면 로컬 경로 사용 (개발 환경용)
TRANSFORMERS_MODEL_PATH = os.environ.get(
    "TRANSFORMERS_MODEL_PATH",
    os.path.join(
        os.path.dirname(__file__), 
        "models", 
        "moodtown_emotion_model"
    )
)

LABELS = ["분노", "슬픔", "불안", "상처", "당황", "기쁨"]  # 휴리스틱 fallback용 (모델 없을 때)

# 전역 변수
_model = None
_tokenizer = None


def _load_transformers_model_if_available() -> bool:
    """Transformers 모델 로드"""
    global _model, _tokenizer
    
    if _model is not None and _tokenizer is not None:
        print("[Transformers] 모델이 이미 로드되어 있습니다.")
        return True
    
    if not TRANSFORMERS_AVAILABLE:
        print("[Transformers] Transformers 라이브러리를 사용할 수 없습니다.")
        return False
    
    # Hugging Face Hub 경로인지 확인 (슬래시가 있으면 Hub 경로)
    is_hub_path = "/" in TRANSFORMERS_MODEL_PATH and not os.path.isabs(TRANSFORMERS_MODEL_PATH) and not os.path.exists(TRANSFORMERS_MODEL_PATH)
    
    if not is_hub_path and not os.path.exists(TRANSFORMERS_MODEL_PATH):
        print(f"[Transformers] 모델 경로가 존재하지 않습니다: {TRANSFORMERS_MODEL_PATH}")
        print(f"[Transformers] 절대 경로: {os.path.abspath(TRANSFORMERS_MODEL_PATH)}")
        return False
    
    if is_hub_path:
        print(f"[Transformers] Hugging Face Hub에서 모델 로드: {TRANSFORMERS_MODEL_PATH}")
    else:
        print(f"[Transformers] 로컬 경로에서 모델 로드: {TRANSFORMERS_MODEL_PATH}")
    
    try:
        print(f"[Transformers] 모델 로드 시작: {TRANSFORMERS_MODEL_PATH}")
        
        # Hugging Face Hub 경로인지 확인
        is_hub_path = "/" in TRANSFORMERS_MODEL_PATH and not os.path.isabs(TRANSFORMERS_MODEL_PATH) and not os.path.exists(TRANSFORMERS_MODEL_PATH)
        
        # 로컬 경로인 경우에만 파일 검증
        if not is_hub_path and os.path.isdir(TRANSFORMERS_MODEL_PATH):
            # 모델 파일 검증 (safetensors 파일 확인)
            model_files = os.listdir(TRANSFORMERS_MODEL_PATH)
            safetensors_files = [f for f in model_files if f.endswith('.safetensors')]
            
            if safetensors_files:
                # safetensors 파일 크기 확인 (Git LFS 포인터 파일인지 확인)
                for sf in safetensors_files:
                    sf_path = os.path.join(TRANSFORMERS_MODEL_PATH, sf)
                    file_size = os.path.getsize(sf_path)
                    print(f"[Transformers] {sf} 파일 크기: {file_size} bytes")
                    # Git LFS 포인터 파일은 보통 100-200 bytes 정도
                    if file_size < 1000:
                        print(f"⚠️ [Transformers] {sf} 파일이 너무 작습니다. Git LFS 파일이 제대로 다운로드되지 않았을 수 있습니다.")
        
        _tokenizer = AutoTokenizer.from_pretrained(TRANSFORMERS_MODEL_PATH)
        print("[Transformers] Tokenizer 로드 완료")
        _model = AutoModelForSequenceClassification.from_pretrained(TRANSFORMERS_MODEL_PATH)
        print("[Transformers] Model 로드 완료")
        _model.eval()  # 평가 모드로 설정
        print("[Transformers] 모델 로드 성공!")
        return True
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"⚠️ [Transformers] 모델 로드 실패: {error_msg}")
        
        # 특정 에러에 대한 안내
        if "header too large" in error_msg.lower() or "safetensor" in error_msg.lower():
            print("⚠️ [Transformers] 모델 파일이 손상되었거나 Git LFS 파일이 제대로 다운로드되지 않았습니다.")
            print("⚠️ [Transformers] Railway 배포 환경에서 Git LFS 파일을 가져오려면:")
            print("   1. Railway에서 Git LFS를 지원하는지 확인")
            print("   2. 또는 모델 파일을 직접 업로드하는 방법 사용")
            print("⚠️ [Transformers] Heuristic fallback으로 계속 진행합니다.")
        
        print(f"[Transformers] 상세 에러:")
        traceback.print_exc()
        return False


def _predict_with_transformers(text: str) -> Dict[str, float]:
    """Transformers 모델로 예측"""
    global _model, _tokenizer
    
    if _model is None or _tokenizer is None:
        return {}
    
    try:
        # 토크나이징
        inputs = _tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        )
        
        # 예측
        with torch.no_grad():
            outputs = _model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)[0]
        
        # 라벨 매핑 (모델의 5개 라벨)
        id2label = {
            0: "기쁨",
            1: "당황",
            2: "분노",
            3: "불안",
            4: "슬픔"
        }
        
        scores = {}
        for idx, prob in enumerate(probs):
            label = id2label.get(idx, f"label_{idx}")
            scores[label] = float(prob)
        
        return scores
    except Exception as e:
        print(f"Transformers 예측 실패: {e}")
        return {}


def _heuristic_predict(text: str) -> Tuple[str, Dict[str, float]]:
    t = text.lower()
    scores = {k: 0.0 for k in LABELS}

    if any(k in t for k in ["기쁘", "행복", "좋았", "즐거", "신났"]):
        scores["기쁨"] += 0.7
    if any(k in t for k in ["불안", "걱정", "두렵", "초조"]):
        scores["불안"] += 0.6
    if any(k in t for k in ["화가", "짜증", "열받", "빡치"]):
        scores["분노"] += 0.65
    if any(k in t for k in ["슬프", "우울", "눈물", "서럽"]):
        scores["슬픔"] += 0.65
    if any(k in t for k in ["당황", "난처", "머쓱"]):
        scores["당황"] += 0.5
    if any(k in t for k in ["상처", "섭섭", "속상", "서운"]):
        scores["상처"] += 0.6

    fatigue = any(k in t for k in ["피곤", "지치", "지침", "힘들", "고단", "피로"])
    if fatigue:
        scores["슬픔"] += 0.6
        scores["불안"] += 0.4

    # 전체 0이면 균등 분포
    if sum(scores.values()) == 0:
        base = 1.0 / len(scores)
        scores = {k: base for k in scores}

    # 정규화
    total = sum(scores.values()) or 1.0
    probs = {k: v / total for k, v in scores.items()}

    label = max(probs.items(), key=lambda x: x[1])[0]
    return label, probs


def predict(text: str) -> Dict:
    if not text or not text.strip():
        # 빈 입력 → 균등 분포 (7개 감정)
        base = 1.0 / 7
        return {
            "label": "기쁨", 
            "scores": {
                "기쁨": base, "사랑": base, "놀람": base, "두려움": base,
                "분노": base, "부끄러움": base, "슬픔": base
            },
            "model_type": "heuristic"
        }

    # 1순위: Transformers 모델 사용
    if _load_transformers_model_if_available():
        try:
            print("[Transformers] 예측 시작")
            model_scores = _predict_with_transformers(text)
            
            if model_scores:
                print(f"[Transformers] 예측 성공: {model_scores}")
                # 모델 라벨 → 7개 감정 시스템 매핑
                # 모델 라벨: ["기쁨", "당황", "분노", "불안", "슬픔"]
                emotion_scores = {
                    "기쁨": 0.0,
                    "사랑": 0.0,
                    "놀람": 0.0,
                    "두려움": 0.0,
                    "분노": 0.0,
                    "부끄러움": 0.0,
                    "슬픔": 0.0
                }
                
                # 직접 매칭되는 감정
                emotion_scores["기쁨"] = model_scores.get("기쁨", 0.0)
                emotion_scores["분노"] = model_scores.get("분노", 0.0)
                emotion_scores["슬픔"] = model_scores.get("슬픔", 0.0)
                
                # 매핑이 필요한 감정들
                # "불안" → "두려움" (100% 그대로 사용)
                fear_score = model_scores.get("불안", 0.0)
                emotion_scores["두려움"] = fear_score
                
                # "당황" → "놀람" + "부끄러움" (키워드 기반 분산)
                panic_score = model_scores.get("당황", 0.0)
                if panic_score > 0:
                    # 놀람 관련 키워드
                    surprise_keywords = [
                        "놀라", "놀랐", "놀람", "충격", "황당", "어이없", "신기", "대박",
                        "기쁜 소식", "좋은 소식", "반가운", "합격", "성공", "축하",
                        "실망", "문제 생겼", "사고", "망했", "나쁜 소식", "멘붕", "큰일"
                    ]
                    # 부끄러움 관련 키워드
                    shy_keywords = [
                        "부끄러", "부끄럽", "창피", "민망", "수치심", "망신", "무안",
                        "머쓱", "당황", "난처", "설레", "두근", "얼굴 빨개졌",
                        "좋아하는 사람", "썸", "욕먹었", "오해받", "실수해서", "잘못해서"
                    ]
                    
                    text_lower = text.lower()
                    surprise_count = sum(1 for keyword in surprise_keywords if keyword in text_lower)
                    shy_count = sum(1 for keyword in shy_keywords if keyword in text_lower)
                    
                    # 키워드 기반 분산
                    if surprise_count > 0 or shy_count > 0:
                        total_count = surprise_count + shy_count
                        if total_count > 0:
                            # 키워드 비율에 따라 분산
                            surprise_ratio = surprise_count / total_count
                            shy_ratio = shy_count / total_count
                        else:
                            # 키워드가 둘 다 있으면 균등 분산
                            surprise_ratio = 0.5
                            shy_ratio = 0.5
                    else:
                        # 키워드가 없으면 기본적으로 놀람에 더 많이 할당 (당황의 본질)
                        surprise_ratio = 0.7
                        shy_ratio = 0.3
                    
                    emotion_scores["놀람"] += panic_score * surprise_ratio
                    emotion_scores["부끄러움"] += panic_score * shy_ratio
                else:
                    # 당황 점수가 0이면 분산하지 않음
                    pass
                
                # "기쁨" → "사랑" 매핑 (키워드 기반)
                love_keywords = [
                    "사랑", "좋아", "애정", "그리움", "보고싶", "그리워", "사랑해", "좋아해",
                    "예뻐", "귀여워", "소중", "소중해", "사랑스러워", "고마워", "감사", "고마",
                    "사랑한다", "좋아한다", "그리워해", "보고파", "보고싶어", "좋아하는", "사랑하는",
                    "마음에 들어", "정들었", "애정", "애착", "사랑스럽"
                ]
                text_lower = text.lower()
                love_count = sum(1 for keyword in love_keywords if keyword in text_lower)
                
                if love_count > 0 and emotion_scores["기쁨"] > 0:
                    # "기쁨" 점수의 30%를 "사랑"으로 재분배
                    love_portion = emotion_scores["기쁨"] * 0.3
                    emotion_scores["기쁨"] -= love_portion
                    emotion_scores["사랑"] += love_portion
                
                # 정규화 (합이 1이 되도록)
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
                else:
                    base = 1.0 / len(emotion_scores)
                    emotion_scores = {k: base for k in emotion_scores}
                
                # 최종 라벨
                label = max(emotion_scores.items(), key=lambda x: x[1])[0]
                
                print("[Transformers] 최종 결과 반환")
                return {"label": label, "scores": emotion_scores, "model_type": "transformers"}
            else:
                print("[Transformers] 예측 결과가 비어있습니다. fallback으로 진행")
        except Exception as e:
            import traceback
            print(f"[Transformers] 모델 예측 중 오류: {e}")
            print(f"[Transformers] 상세 에러:")
            traceback.print_exc()
            # fallback으로 계속 진행

    # fallback
    label, scores = _heuristic_predict(text)
    
    # heuristic 결과도 7개 감정으로 매핑
    emotion_scores = {
        "기쁨": 0.0,
        "사랑": 0.0,
        "놀람": 0.0,
        "두려움": 0.0,
        "분노": 0.0,
        "부끄러움": 0.0,
        "슬픔": 0.0
    }
    
    # 직접 매칭
    emotion_scores["기쁨"] = scores.get("기쁨", 0.0)
    emotion_scores["분노"] = scores.get("분노", 0.0)
    emotion_scores["슬픔"] = scores.get("슬픔", 0.0)
    
    # "불안" → "두려움"
    emotion_scores["두려움"] = scores.get("불안", 0.0)
    
    # "당황" → "놀람" + "부끄러움" (키워드 기반 분산)
    panic_score = scores.get("당황", 0.0)
    if panic_score > 0:
        text_lower = text.lower()
        surprise_keywords = ["놀라", "놀랐", "놀람", "충격", "황당", "어이없", "신기", "대박"]
        shy_keywords = ["부끄러", "부끄럽", "창피", "민망", "수치심", "머쓱", "당황", "난처"]
        
        surprise_count = sum(1 for keyword in surprise_keywords if keyword in text_lower)
        shy_count = sum(1 for keyword in shy_keywords if keyword in text_lower)
        
        if surprise_count > 0 or shy_count > 0:
            total_count = surprise_count + shy_count
            surprise_ratio = surprise_count / total_count if total_count > 0 else 0.5
            shy_ratio = shy_count / total_count if total_count > 0 else 0.5
        else:
            surprise_ratio = 0.7
            shy_ratio = 0.3
        
        emotion_scores["놀람"] += panic_score * surprise_ratio
        emotion_scores["부끄러움"] += panic_score * shy_ratio
    
    # "상처" → "슬픔" (상처는 슬픔에 포함)
    emotion_scores["슬픔"] += scores.get("상처", 0.0)
    
    # "기쁨" → "사랑" 매핑 (키워드 기반)
    love_keywords = ["사랑", "좋아", "애정", "그리움", "보고싶", "그리워", "사랑해", "좋아해"]
    text_lower = text.lower()
    love_count = sum(1 for keyword in love_keywords if keyword in text_lower)
    
    if love_count > 0 and emotion_scores["기쁨"] > 0:
        love_portion = emotion_scores["기쁨"] * 0.3
        emotion_scores["기쁨"] -= love_portion
        emotion_scores["사랑"] += love_portion
    
    # 정규화
    total = sum(emotion_scores.values())
    if total > 0:
        emotion_scores = {k: v / total for k, v in emotion_scores.items()}
    else:
        base = 1.0 / len(emotion_scores)
        emotion_scores = {k: base for k in emotion_scores}
    
    # 최종 라벨
    label = max(emotion_scores.items(), key=lambda x: x[1])[0]
    
    return {"label": label, "scores": emotion_scores, "model_type": "heuristic"}
