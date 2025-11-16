import os
import json
from typing import Dict, Tuple, List, Optional

try:
    from joblib import load as joblib_load
except Exception:
    joblib_load = None

MODEL_FILE = os.path.join(os.path.dirname(__file__), "models", "emotion_ml.joblib")

LABELS = ["분노", "슬픔", "불안", "상처", "당황", "기쁨"]  # 휴리스틱 fallback용 (모델 없을 때)

_clf = None
_vectorizer = None
_classes: Optional[List[str]] = None


def _load_model_if_available() -> bool:
    global _clf, _vectorizer, _classes

    if _clf is not None and _vectorizer is not None:
        return True

    if joblib_load is None:
        return False
    if not os.path.exists(MODEL_FILE):
        return False

    try:
        obj = joblib_load(MODEL_FILE)
        _clf = obj.get("clf")
        _vectorizer = obj.get("vectorizer")
        _classes = obj.get("classes")
        return _clf is not None and _vectorizer is not None
    except Exception:
        return False


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
        # 빈 입력 → 균등 분포
        base = 1.0 / len(LABELS)
        return {"label": "기쁨", "scores": {k: base for k in LABELS}}

    # ML 모델이 있으면 사용
    if _load_model_if_available():
        try:
            X = _vectorizer.transform([text])

            if hasattr(_clf, "predict_proba"):
                proba = _clf.predict_proba(X)[0]
                class_list = list(_clf.classes_)
            else:
                # decision_function softmax 변환
                import numpy as np
                decision = _clf.decision_function(X)[0]
                if not hasattr(decision, "__len__"):
                    decision = [decision, -decision]

                exps = np.exp(decision - np.max(decision))
                proba = exps / np.sum(exps)
                class_list = list(_clf.classes_)

            # 클래스 순서대로 매칭
            scores = {str(label): float(p) for label, p in zip(class_list, proba)}

            # 모델이 저장한 classes가 있으면 그 순서를 우선 사용
            if _classes:
                scores = {str(label): scores.get(str(label), 0.0) for label in _classes}

            # 최종 라벨
            label = max(scores.items(), key=lambda x: x[1])[0]

            return {"label": label, "scores": scores}

        except Exception:
            pass  # 아래 휴리스틱 fallback

    # fallback
    label, scores = _heuristic_predict(text)
    return {"label": label, "scores": scores}
