import json
import re
import traceback
from typing import Dict, Any
from core.common import client, EMOTION_KEYS

def extract_json(text: str):
    if not text:
        return None
    # <BEGIN_JSON> ~ <END_JSON>
    m = re.search(r"<BEGIN_JSON>([\s\S]*?)<END_JSON>", text)
    if m:
        block = m.group(1).strip()
        try:
            return json.loads(block)
        except:
            pass
    # 브레이스 기반
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            block = text[start:end + 1]
            return json.loads(block)
    except:
        pass
    return None

def analyze_emotions_with_gpt(diary_text: str) -> Dict[str, Any]:
    """
    GPT 기반 7감정 분석 (강화 버전)
    """
    default_scores = {
        "기쁨": 25, "사랑": 20, "놀람": 15,
        "두려움": 10, "분노": 10, "부끄러움": 10, "슬픔": 10
    }
    default_top = ["기쁨", "사랑", "놀람", "슬픔"]

    # 강화 프롬프트
    emotion_prompt = f"""
당신은 감정 분석 전문가입니다. 
다음 일기를 읽고 7가지 감정(기쁨, 사랑, 놀람, 두려움, 분노, 부끄러움, 슬픔)의 강도를 
0~100 사이 정수로만 분석하세요.

⚠️ 절대적으로 지켜야 할 규칙(중요!)
1. 결과는 무조건 JSON 형식으로만 출력하세요.
2. 각 감정 값은 반드시 정수여야 하며, "높음", "낮음" 같은 단어 표현 금지.
3. 감정은 반드시 0~100 사이 정수이며, 소수점·문자열 금지.
4. 일기에서 감정이 명확하게 드러나지 않는 경우 반드시 0점.
5. 과거를 회상하는 내용은 슬픔이 아님(좋은 추억은 슬픔 X).
6. 슬픔/우울/눈물/아픔 표현이 없으면 슬픔은 기본적으로 0~5점 이하.
7. 긍정 일기(행복/만족/감사 등) → 기쁨·사랑 높음, 슬픔 0~5점.
8. 분노/짜증 명확 → 분노 높음(기쁨·사랑 낮음).
9. 불안/걱정/초조/두려움 명확 → 두려움 높음.
10. 피곤/힘듦/지침/번아웃 표현이 있으면:
   - 기쁨은 0~5점 이하
   - 슬픔과 두려움 상대적으로 높음
   - 분노/부끄러움은 높은 점수 지양
11. 모든 감정이 0점이면 안 됨.

⚠️ 출력 형식(절대 어기지 말 것)
<BEGIN_JSON>
{{
  "emotion_scores": {{
    "기쁨": 0~100 정수,
    "사랑": 0~100 정수,
    "놀람": 0~100 정수,
    "두려움": 0~100 정수,
    "분노": 0~100 정수,
    "부끄러움": 0~100 정수,
    "슬픔": 0~100 정수
  }}
}}
<END_JSON>

아래 일기를 분석하세요:

--- 일기 시작 ---
{diary_text}
--- 일기 끝 ---

JSON 형식만 출력하세요.
""".strip()

    try:
        # GPT 호출
        emotion_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 전문 감정 분석기입니다. "
                        "감정 점수를 매우 엄격하고 일관되게 평가합니다. "
                        "지시한 JSON 형식 외 모든 출력 금지."
                    )
                },
                {"role": "user", "content": emotion_prompt}
            ],
            temperature=0.1,
            max_tokens=350
        )
        emotion_reply = emotion_response.choices[0].message.content or ""
        parsed = extract_json(emotion_reply)

        # 파싱 실패 → 기본값
        if not parsed or "emotion_scores" not in parsed:
            scores = default_scores.copy()
        else:
            scores = parsed.get("emotion_scores", {})

        if not isinstance(scores, dict):
            scores = default_scores.copy()

        # 모든 감정 키 보장
        for emo in EMOTION_KEYS:
            if emo not in scores:
                scores[emo] = 0

        # 숫자 변환 + 0~100 클램핑
        for emo in list(scores.keys()):
            try:
                v = int(float(scores[emo]))
            except:
                v = 0
            scores[emo] = max(0, min(100, v))

        # 총합 0이면 기본값
        total_raw = sum(scores.values())
        if total_raw == 0:
            scores = default_scores.copy()
            total_raw = sum(scores.values())

        # 정규화(합 100)
        norm_scores = {emo: int(round(scores[emo] / total_raw * 100)) for emo in EMOTION_KEYS}
        diff = 100 - sum(norm_scores.values())
        if diff != 0:
            max_emo = max(norm_scores.items(), key=lambda x: x[1])[0]
            norm_scores[max_emo] += diff

        # 피곤/지침 보정
        fatigue = any(k in diary_text for k in ["피곤", "지치", "지침", "힘들", "고단", "피로"])
        if fatigue and norm_scores["기쁨"] > 10:
            cut = norm_scores["기쁨"] - 10
            norm_scores["기쁨"] = 10
            norm_scores["슬픔"] += int(round(cut * 0.6))
            norm_scores["두려움"] += int(round(cut * 0.4))

        # 5% 이하 감정 제거 및 재정규화
        # 1단계: 5% 이하 감정을 0으로 처리
        filtered_scores = {}
        for emo in EMOTION_KEYS:
            if norm_scores[emo] > 5:  # 5% 초과만 유지
                filtered_scores[emo] = norm_scores[emo]
            else:
                filtered_scores[emo] = 0
        
        # 2단계: 남은 감정만 다시 정규화하여 합이 100이 되도록
        remaining_total = sum(filtered_scores.values())
        if remaining_total > 0:
            # 남은 감정들의 비율을 유지하면서 합이 100이 되도록 정규화
            norm_scores = {emo: int(round(filtered_scores[emo] / remaining_total * 100)) for emo in EMOTION_KEYS}
            # 반올림으로 인한 차이 보정
            diff = 100 - sum(norm_scores.values())
            if diff != 0:
                # 0이 아닌 감정 중 가장 큰 값에 차이 추가
                non_zero_emotions = [(emo, val) for emo, val in norm_scores.items() if val > 0]
                if non_zero_emotions:
                    max_emo = max(non_zero_emotions, key=lambda x: x[1])[0]
                    norm_scores[max_emo] += diff
        else:
            # 모든 감정이 5% 이하인 경우 기본값 사용
            norm_scores = default_scores.copy()
            # 기본값도 정규화
            default_total = sum(norm_scores.values())
            norm_scores = {emo: int(round(norm_scores[emo] / default_total * 100)) for emo in EMOTION_KEYS}
            diff = 100 - sum(norm_scores.values())
            if diff != 0:
                max_emo = max(norm_scores.items(), key=lambda x: x[1])[0]
                norm_scores[max_emo] += diff

        # 상위 4개
        sorted_emotions = sorted(norm_scores.items(), key=lambda x: x[1], reverse=True)
        top_emotions = [emo for emo, val in sorted_emotions[:4] if val > 0] or default_top

        return {
            "emotion_scores": norm_scores,
            "top_emotions": top_emotions
        }
    except Exception:
        traceback.print_exc()
        return {
            "emotion_scores": default_scores.copy(),
            "top_emotions": default_top[:]
        }