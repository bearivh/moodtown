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
            
            # ML 모델 라벨 → 7개 감정 시스템 매핑
            # 모델 라벨: ["분노", "슬픔", "불안", "상처", "당황", "기쁨"]
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
            emotion_scores["기쁨"] = scores.get("기쁨", 0.0)
            emotion_scores["분노"] = scores.get("분노", 0.0)
            emotion_scores["슬픔"] = scores.get("슬픔", 0.0)
            
            # 매핑이 필요한 감정들
            # "불안" → "두려움" (하지만 두려움 점수 제한)
            fear_score = scores.get("불안", 0.0)
            emotion_scores["두려움"] = fear_score * 0.7  # 두려움 점수를 70%로 축소
            
            # "상처" → "슬픔"에 추가 (비율 감소로 슬픔 과다 증가 방지)
            hurt_score = scores.get("상처", 0.0)
            emotion_scores["슬픔"] += hurt_score * 0.5  # 0.8 → 0.5로 감소
            
            # "당황" → "놀람" (50%) + "부끄러움" (50%)으로 분산
            panic_score = scores.get("당황", 0.0)
            emotion_scores["놀람"] += panic_score * 0.5
            emotion_scores["부끄러움"] += panic_score * 0.5
            
            # "기쁨" → "사랑" 매핑 (키워드 기반)
            # 사랑 관련 키워드가 있으면 "기쁨"의 일부를 "사랑"으로 재분배
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
            
            # 후처리 규칙: 부정적인 키워드가 있으면 기쁨 점수 감소
            # 두려움 관련 키워드 (별도로 분리하여 두려움 점수 직접 감소에 사용)
            fear_keywords = [
                "불안", "걱정", "두렵", "무서", "초조", "불안해", "걱정돼", "두려워", "무서워",
                "불안하다", "걱정된다", "두려워한다", "무서워한다", "초조하다"
            ]
            
            # 분노 관련 키워드
            anger_keywords = [
                "화나", "짜증", "분노", "열받", "빡치", "화났", "짜증나", "화나서", "짜증나서",
                "열받아", "빡쳐", "성나", "화났어", "짜증났어"
            ]
            
            # 슬픔 관련 키워드
            sadness_keywords = [
                "슬프", "우울", "눈물", "서럽", "속상", "섭섭", "상처", "서운", "슬펐",
                "우울해", "눈물나", "서러워", "속상해", "슬퍼서"
            ]
            
            # 일반 부정 키워드
            negative_keywords = [
                "복잡", "힘들", "어렵", "스트레스", "피곤", "지치", "지침",
                "실망", "후회", "아쉬", "답답", "막막", "힘없", "무기력", "집중 안", "안 돼",
                "못하", "실패", "떨어", "망치", "놓칠", "잘못", "문제", "고민",
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
            
            # 감정별 키워드 카운트
            fear_count = sum(1 for keyword in fear_keywords if keyword in text_lower)
            anger_count = sum(1 for keyword in anger_keywords if keyword in text_lower)
            sadness_count = sum(1 for keyword in sadness_keywords if keyword in text_lower)
            negative_count = sum(1 for keyword in negative_keywords if keyword in text_lower) + fear_count + anger_count + sadness_count
            strong_positive_count = sum(1 for keyword in strong_positive_keywords if keyword in text_lower)
            
            # 두려움 키워드가 많으면 두려움 점수를 직접 조정 (다른 감정으로 재분배)
            if fear_count == 0 and emotion_scores.get("두려움", 0) > 0.25:
                # 두려움 키워드가 없는데 두려움이 높으면 다른 감정으로 재분배
                excess_fear = emotion_scores["두려움"] - 0.2
                if excess_fear > 0:
                    emotion_scores["두려움"] = 0.2
                    # 슬픔과 분노에 재분배
                    emotion_scores["슬픔"] = emotion_scores.get("슬픔", 0) + excess_fear * 0.5
                    emotion_scores["분노"] = emotion_scores.get("분노", 0) + excess_fear * 0.5
                    # 재정규화
                    total = sum(emotion_scores.values())
                    if total > 0:
                        emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 분노 키워드가 많으면 분노 점수 증가, 두려움 감소
            if anger_count >= 2 and emotion_scores.get("두려움", 0) > 0.15:
                fear_penalty = emotion_scores["두려움"] * 0.5
                emotion_scores["두려움"] = max(0.05, emotion_scores["두려움"] - fear_penalty)
                emotion_scores["분노"] = emotion_scores.get("분노", 0) + fear_penalty * 0.8
                emotion_scores["슬픔"] = emotion_scores.get("슬픔", 0) + fear_penalty * 0.2
                # 재정규화
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 슬픔 키워드가 많으면 슬픔 점수 증가, 두려움 감소
            if sadness_count >= 2 and emotion_scores.get("두려움", 0) > 0.15:
                fear_penalty = emotion_scores["두려움"] * 0.4
                emotion_scores["두려움"] = max(0.05, emotion_scores["두려움"] - fear_penalty)
                emotion_scores["슬픔"] = emotion_scores.get("슬픔", 0) + fear_penalty
                # 재정규화
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            original_joy = emotion_scores.get("기쁨", 0.0)
            should_reduce_joy = False
            reduction_factor = 1.0
            
            # 규칙 1: 부정 키워드가 많을 때만 기쁨 감소 (threshold 증가)
            # 긍정 키워드가 부정 키워드보다 많으면 기쁨 감소 안 함
            if negative_count >= 3 and strong_positive_count < negative_count:
                should_reduce_joy = True
                if negative_count >= 5:
                    reduction_factor = 0.1 if strong_positive_count < 2 else 0.3
                elif negative_count >= 4:
                    reduction_factor = 0.2 if strong_positive_count < 2 else 0.4
                else:  # negative_count >= 3
                    reduction_factor = 0.3 if strong_positive_count < 2 else 0.5
            
            # 규칙 2: 기쁨 점수가 매우 높을 때만 약간 감소 (규칙 완화)
            if original_joy >= 0.5 and negative_count >= 3:
                should_reduce_joy = True
                reduction_factor = min(reduction_factor, 0.8)  # 약간만 감소
            
            # 규칙 3: 기쁨이 가장 높은 감정인데 부정 키워드가 많으면 감소
            sorted_emotions = sorted(emotion_scores.items(), key=lambda x: x[1], reverse=True)
            top_emotion = sorted_emotions[0][0] if sorted_emotions else None
            if top_emotion == "기쁨" and negative_count >= 3 and strong_positive_count < negative_count:
                should_reduce_joy = True
                if negative_count >= 4:
                    reduction_factor = min(reduction_factor, 0.3)
                else:
                    reduction_factor = min(reduction_factor, 0.5)
            
            # 규칙 4: 긍정 키워드가 많으면 기쁨 증가 (부정 키워드가 있어도 허용)
            should_boost_joy = False
            boost_factor = 1.0
            
            # 긍정 키워드가 부정 키워드보다 많거나 같으면 기쁨 증가
            if strong_positive_count >= 1 and strong_positive_count >= negative_count * 0.7:
                should_boost_joy = True
                if strong_positive_count >= 4:
                    boost_factor = 2.5  # 기쁨을 2.5배 증가
                elif strong_positive_count >= 3:
                    boost_factor = 2.0
                elif strong_positive_count >= 2:
                    boost_factor = 1.7
                else:
                    boost_factor = 1.4
                
                # 부정 키워드가 있으면 증가 폭을 약간 줄임
                if negative_count > 0:
                    boost_factor *= 0.85
            
            # 기쁨 점수 조정 적용 (부정 키워드가 있을 때 감소)
            if should_reduce_joy:
                new_joy = max(0.02, original_joy * reduction_factor)
                joy_reduction = original_joy - new_joy
                emotion_scores["기쁨"] = new_joy
                
                # 감소한 기쁨 점수를 다른 감정에 재분배 (부정 감정 우선, 두려움 과도 증가 방지)
                if joy_reduction > 0:
                    negative_emotions = ["슬픔", "분노", "놀람"]  # 두려움 제외 (재분배 안 함)
                    two_fear_emotions = ["부끄러움", "두려움"]  # 두려움 계열은 별도 처리
                    neg_total = sum(emotion_scores.get(e, 0) for e in negative_emotions)
                    
                    # 두려움 재분배 비중을 매우 낮게 설정 (10%)
                    fear_reduction_ratio = 0.1
                    
                    if neg_total > 0:
                        # 주로 슬픔, 분노, 놀람에 재분배 (90%)
                        for neg_emo in negative_emotions:
                            if neg_emo in emotion_scores:
                                ratio = emotion_scores[neg_emo] / neg_total
                                emotion_scores[neg_emo] += joy_reduction * ratio * 0.9
                        
                        # 두려움과 부끄러움에는 최소한만 재분배 (10%)
                        fear_total = sum(emotion_scores.get(e, 0) for e in two_fear_emotions)
                        if fear_total > 0:
                            for fear_emo in two_fear_emotions:
                                if fear_emo in emotion_scores:
                                    ratio = emotion_scores[fear_emo] / fear_total
                                    emotion_scores[fear_emo] += joy_reduction * ratio * 0.1
                        else:
                            # 두려움 계열이 없으면 균등 분배 (최소한만)
                            per_fear_emo = joy_reduction * 0.05
                            for fear_emo in two_fear_emotions:
                                emotion_scores[fear_emo] = emotion_scores.get(fear_emo, 0) + per_fear_emo
                    else:
                        # 부정 감정이 없으면 슬픔, 분노에 주로 분배 (두려움 최소)
                        emotion_scores["슬픔"] = emotion_scores.get("슬픔", 0) + joy_reduction * 0.45
                        emotion_scores["분노"] = emotion_scores.get("분노", 0) + joy_reduction * 0.45
                        emotion_scores["놀람"] = emotion_scores.get("놀람", 0) + joy_reduction * 0.05
                        emotion_scores["두려움"] = emotion_scores.get("두려움", 0) + joy_reduction * 0.05
                
                # 재정규화
                total = sum(emotion_scores.values())
                if total > 0:
                    emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 슬픔 점수가 과도하게 높으면 (0.4 이상) 기쁨으로 일부 재분배
            sadness_score = emotion_scores.get("슬픔", 0)
            if sadness_score > 0.4:
                # 0.35로 제한
                max_sadness = 0.35
                if sadness_score > max_sadness:
                    excess_sadness = sadness_score - max_sadness
                    emotion_scores["슬픔"] = max_sadness
                    
                    # 초과분의 30%를 기쁨으로 재분배 (기쁨 증가)
                    joy_boost = excess_sadness * 0.3
                    emotion_scores["기쁨"] = emotion_scores.get("기쁨", 0) + joy_boost
                    
                    # 나머지 70%는 다른 감정에 재분배
                    other_emotions = ["분노", "놀람", "부끄러움", "두려움"]
                    other_total = sum(emotion_scores.get(e, 0) for e in other_emotions)
                    
                    if other_total > 0:
                        for emo in other_emotions:
                            if emo in emotion_scores:
                                ratio = emotion_scores[emo] / other_total
                                emotion_scores[emo] += excess_sadness * 0.7 * ratio
                    else:
                        # 다른 감정이 없으면 분노와 놀람에 균등 분배
                        emotion_scores["분노"] = emotion_scores.get("분노", 0) + excess_sadness * 0.35
                        emotion_scores["놀람"] = emotion_scores.get("놀람", 0) + excess_sadness * 0.35
                    
                    # 재정규화
                    total = sum(emotion_scores.values())
                    if total > 0:
                        emotion_scores = {k: v / total for k, v in emotion_scores.items()}
            
            # 두려움 점수가 과도하게 높으면 (0.3 이상) 다른 감정으로 재분배 (더 강하게 제한)
            fear_score = emotion_scores.get("두려움", 0)
            if fear_score > 0.3:
                # 0.25로 제한 (더 강하게 제한)
                max_fear = 0.25
                if fear_score > max_fear:
                    excess_fear = fear_score - max_fear
                    emotion_scores["두려움"] = max_fear
                
                    # 초과분의 일부를 기쁨으로 재분배 (10%)
                    joy_boost = excess_fear * 0.1
                    emotion_scores["기쁨"] = emotion_scores.get("기쁨", 0) + joy_boost
                    
                    # 나머지 90%는 다른 부정 감정에 재분배 (슬픔, 분노 우선)
                    other_negative = ["슬픔", "분노", "놀람", "부끄러움"]
                    other_total = sum(emotion_scores.get(e, 0) for e in other_negative)
                    
                    if other_total > 0:
                        for emo in other_negative:
                            if emo in emotion_scores:
                                ratio = emotion_scores[emo] / other_total
                                emotion_scores[emo] += excess_fear * 0.9 * ratio
                    else:
                        # 다른 부정 감정이 없으면 슬픔과 분노에 균등 분배
                        emotion_scores["슬픔"] = emotion_scores.get("슬픔", 0) + excess_fear * 0.45
                        emotion_scores["분노"] = emotion_scores.get("분노", 0) + excess_fear * 0.45
                    
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
