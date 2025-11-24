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
            
            # 7개 감정 대분류로 정규화 (이미 7개 감정이면 그대로 사용)
            emotion_scores = {}
            for emo in ["기쁨", "사랑", "놀람", "두려움", "분노", "부끄러움", "슬픔"]:
                emotion_scores[emo] = scores.get(emo, 0.0)
            
            # 정규화 (합이 1이 되도록)
            total = sum(emotion_scores.values())
            if total > 0:
                emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            else:
                base = 1.0 / len(emotion_scores)
                emotion_scores = {k: base for k in emotion_scores}
            
            # 후처리 규칙: 부정적인 키워드가 있으면 기쁨 점수 감소
            negative_keywords = [
                "불안", "걱정", "복잡", "힘들", "어렵", "스트레스", "피곤", "지치", "지침",
                "슬프", "우울", "속상", "화나", "짜증", "분노", "두려움", "무서", "초조",
                "실망", "후회", "아쉬", "답답", "막막", "힘없", "무기력", "집중 안", "안 돼",
                "못하", "실패", "떨어", "망치", "놓칠", "잘못", "문제", "고민", "걱정",
                "미안", "죄송", "부담", "압박", "불편", "아픔", "아프", "힘겨", "고생",
                "번아웃", "지루", "따분", "심심", "외로", "외롭", "쓸쓸", "허탈", "허전",
                "서러", "서글", "안타깝", "안타까", "한심", "비참", "비관", "절망", "포기",
                "힘들어", "어려워", "안 되", "안돼", "안되는", "안되는데", "안되네", "안되겠",
                "못해", "못했", "못하겠", "못하네", "못하는", "못했어", "못했네", "못했는데",
                "예민", "예민해", "예민해지", "조금씩만", "부족", "부족하"
            ]
            
            # 강한 긍정 키워드
            strong_positive_keywords = [
                "행복", "기쁘", "좋았", "좋다", "즐거", "신났", "신나", "만족", "뿌듯",
                "즐겁", "재미", "재밌", "웃", "웃음", "기분 좋", "기분이 좋",
                "성취", "성공", "완벽", "완성", "해결", "좋은", "좋아",
                "가족", "여행", "추억", "즐거운", "기쁜", "행복한", "신나는"
            ]
            
            text_lower = text.lower()
            negative_count = sum(1 for keyword in negative_keywords if keyword in text_lower)
            strong_positive_count = sum(1 for keyword in strong_positive_keywords if keyword in text_lower)
            
            original_joy = emotion_scores.get("기쁨", 0.0)
            should_reduce_joy = False
            reduction_factor = 1.0
            
            # 규칙 1: 부정 키워드가 있으면 무조건 기쁨 감소
            if negative_count >= 1:
                should_reduce_joy = True
                if negative_count >= 4:
                    reduction_factor = 0.05 if strong_positive_count < 2 else 0.2
                elif negative_count >= 3:
                    reduction_factor = 0.1 if strong_positive_count < 2 else 0.4
                elif negative_count >= 2:
                    reduction_factor = 0.2 if strong_positive_count < 2 else 0.5
                else:
                    reduction_factor = 0.4 if strong_positive_count < 2 else 0.6
            
            # 규칙 2: 기쁨 점수가 0.25 이상이면 추가 감소
            if original_joy >= 0.25:
                should_reduce_joy = True
                if original_joy >= 0.4:
                    reduction_factor = min(reduction_factor, 0.5)
                elif original_joy >= 0.3:
                    reduction_factor = min(reduction_factor, 0.6)
                else:
                    reduction_factor = min(reduction_factor, 0.7)
            
            # 규칙 3: 기쁨이 가장 높은 감정인데 부정 키워드가 있으면 강력하게 감소
            sorted_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)
            top_emotion = sorted_emotions[0][0] if sorted_emotions else None
            if top_emotion == "기쁨" and negative_count >= 1:
                should_reduce_joy = True
                if negative_count >= 2:
                    reduction_factor = min(reduction_factor, 0.2)
                else:
                    reduction_factor = min(reduction_factor, 0.4)
            
            # 규칙 4: 긍정 키워드가 많고 부정 키워드가 없으면 기쁨 증가 및 부정 감정 감소
            should_boost_joy = False
            boost_factor = 1.0
            
            if negative_count == 0 and strong_positive_count >= 1:
                should_boost_joy = True
                if strong_positive_count >= 4:
                    boost_factor = 2.5  # 기쁨을 2.5배 증가
                elif strong_positive_count >= 3:
                    boost_factor = 2.0
                elif strong_positive_count >= 2:
                    boost_factor = 1.7
                else:
                    boost_factor = 1.4
            
            # 기쁨 점수 조정 적용 (부정 키워드가 있을 때 감소)
            if should_reduce_joy:
                new_joy = max(0.02, original_joy * reduction_factor)
                joy_reduction = original_joy - new_joy
                emotion_scores["기쁨"] = new_joy
                
                # 감소한 기쁨 점수를 다른 감정에 재분배 (부정 감정 우선)
                if joy_reduction > 0:
                    negative_emotions = ["두려움", "슬픔", "분노", "놀람"]
                    neg_total = sum(emotion_scores.get(e, 0) for e in negative_emotions)
                    if neg_total > 0:
                        for neg_emo in negative_emotions:
                            if neg_emo in emotion_scores:
                                ratio = emotion_scores[neg_emo] / neg_total
                                emotion_scores[neg_emo] += joy_reduction * ratio
                    else:
                        per_emotion = joy_reduction / len(negative_emotions)
                        for neg_emo in negative_emotions:
                            emotion_scores[neg_emo] = emotion_scores.get(neg_emo, 0) + per_emotion
                
                # 재정규화
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 긍정 키워드가 많을 때 기쁨 증가 및 부정 감정 감소
            if should_boost_joy:
                original_joy = emotion_scores.get("기쁨", 0.0)
                new_joy = min(0.85, original_joy * boost_factor)  # 최대 85%로 제한
                joy_increase = new_joy - original_joy
                emotion_scores["기쁨"] = new_joy
                
                # 부정 감정 점수 감소
                negative_emotions = ["슬픔", "두려움", "분노", "부끄러움"]
                neg_total = sum(emotion_scores.get(e, 0) for e in negative_emotions)
                
                if neg_total > 0 and joy_increase > 0:
                    # 부정 감정에서 감소시킬 양 계산
                    reduction_amount = min(joy_increase * 0.8, neg_total * 0.6)  # 부정 감정의 최대 60%까지만 감소
                    
                    for neg_emo in negative_emotions:
                        if neg_emo in emotion_scores and emotion_scores[neg_emo] > 0:
                            ratio = emotion_scores[neg_emo] / neg_total
                            reduction = reduction_amount * ratio
                            emotion_scores[neg_emo] = max(0.01, emotion_scores[neg_emo] - reduction)
                    
                    # 놀람도 약간 감소 (긍정 일기에서 놀람이 높게 나오는 것 방지)
                    if emotion_scores.get("놀람", 0) > 0.15:
                        surprise_reduction = min(emotion_scores["놀람"] * 0.3, 0.1)
                        emotion_scores["놀람"] = max(0.05, emotion_scores["놀람"] - surprise_reduction)
                        emotion_scores["기쁨"] += surprise_reduction
                
                # 재정규화
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 최종 라벨
            label = max(emotion_scores.items(), key=lambda x: x[1])[0]

            return {"label": label, "scores": emotion_scores}

        except Exception:
            pass  # 아래 휴리스틱 fallback

    # fallback
    label, scores = _heuristic_predict(text)
    return {"label": label, "scores": scores}
