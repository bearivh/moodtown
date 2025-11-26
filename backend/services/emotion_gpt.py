import json
import re
import traceback
from typing import Dict, Any
from core.common import client, EMOTION_KEYS

# ---------------------------------------
# JSON 추출
# ---------------------------------------
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

    # fallback: {...} 블록만
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end + 1])
    except:
        pass

    return None


# ===============================================================
#  Hybrid Polarity 시스템
# ===============================================================

POSITIVE_SURPRISE = [
    "기쁘", "좋은 소식", "반가운", "감동", "선물", "축하",
    "합격", "성공", "칭찬", "대박", "행복한", "잘됐다"
]

NEGATIVE_SURPRISE = [
    "충격", "실망", "황당", "어이없", "문제 생겼",
    "사고", "망했다", "나쁜 소식", "당황", "멘붕", "큰일", "무서웠"
]

POSITIVE_SHY = [
    "설레", "좋아하는 사람", "썸", "두근", "얼굴 빨개졌",
    "부끄러웠지만 좋았", "칭찬받아", "기분 좋게"
]

NEGATIVE_SHY = [
    "창피", "민망", "수치심", "망신", "무안",
    "머쓱", "욕먹었", "오해받", "실수해서", "잘못해서"
]


def rule_based_polarity(text: str, score_surprise: int, score_shy: int):
    """
    규칙 기반 polarity 계산
    """
    t = text.lower()
    result = {"놀람": None, "부끄러움": None}

    # --- 놀람 분석 ---
    if score_surprise > 0:
        pos = sum(1 for w in POSITIVE_SURPRISE if w in t)
        neg = sum(1 for w in NEGATIVE_SURPRISE if w in t)

        if pos > neg and pos > 0:
            result["놀람"] = "positive"
        elif neg > pos and neg > 0:
            result["놀람"] = "negative"
        else:
            result["놀람"] = None

    # --- 부끄러움 분석 ---
    if score_shy > 0:
        pos = sum(1 for w in POSITIVE_SHY if w in t)
        neg = sum(1 for w in NEGATIVE_SHY if w in t)

        if pos > neg and pos > 0:
            result["부끄러움"] = "positive"
        elif neg > pos and neg > 0:
            result["부끄러움"] = "negative"
        else:
            result["부끄러움"] = None

    return result


def hybrid_polarity(
    text: str,
    gpt_polarity: dict,
    score_surprise: int,
    score_shy: int
):
    """
    GPT + 규칙 기반 Hybrid Polarity
    """
    rule = rule_based_polarity(text, score_surprise, score_shy)
    final = {"놀람": None, "부끄러움": None}

    for emo in ["놀람", "부끄러움"]:
        score = score_surprise if emo == "놀람" else score_shy
        if score == 0:
            final[emo] = None
            continue

        rule_val = rule.get(emo)
        gpt_val = gpt_polarity.get(emo)

        # 규칙 기반이 있으면 무조건 우선
        if rule_val is not None:
            final[emo] = rule_val
            continue

        # GPT만 있으면 GPT 값 채택
        if gpt_val in ["positive", "negative"]:
            final[emo] = gpt_val
            continue

        final[emo] = None

    return final


# ===============================================================
#  메인 감정 분석 함수
# ===============================================================
def analyze_emotions_with_gpt(diary_text: str) -> Dict[str, Any]:
    """
    GPT + 규칙 기반 하이브리드 감정 분석기
    """
    # 기본 fallback
    default_scores = {
        "기쁨": 25, "사랑": 20, "놀람": 15,
        "두려움": 10, "분노": 10, "부끄러움": 10, "슬픔": 10
    }
    default_top = ["기쁨", "사랑", "놀람", "슬픔"]

    # ---------------- GPT Prompt ----------------
    prompt = f"""
당신은 감정 분석 전문가입니다.

다음 일기를 읽고 7가지 감정(기쁨, 사랑, 놀람, 두려움, 분노, 부끄러움, 슬픔)을
0~100 정수로 분석하세요.

<BEGIN_JSON>
{{
  "emotion_scores": {{
    "기쁨": 0,
    "사랑": 0,
    "놀람": 0,
    "두려움": 0,
    "분노": 0,
    "부끄러움": 0,
    "슬픔": 0
  }},
  "emotion_polarity": {{
    "놀람": null,
    "부끄러움": null
  }}
}}
<END_JSON>

일기:
{diary_text}

JSON만 출력하세요.
""".strip()

    try:
        gpt_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "감정 분석만 수행. JSON 이외 출력 금지."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=400
        )
        raw = gpt_resp.choices[0].message.content or ""
        parsed = extract_json(raw)
    except:
        parsed = None

    # ---------------- 파싱 실패 → 기본값 ----------------
    if not parsed or "emotion_scores" not in parsed:
        scores = default_scores.copy()
        gpt_polarity = {"놀람": None, "부끄러움": None}
    else:
        scores = parsed.get("emotion_scores", {})
        gpt_polarity = parsed.get("emotion_polarity", {})

    # ---------------- 숫자 정제 ----------------
    final_scores = {}
    for emo in EMOTION_KEYS:
        v = scores.get(emo, 0)
        try:
            v = int(float(v))
        except:
            v = 0
        final_scores[emo] = max(0, min(100, v))

    # ---------------- 모두 0 → 기본값 ----------------
    if sum(final_scores.values()) == 0:
        final_scores = default_scores.copy()

    # ---------------- 정규화 (합=100%) ----------------
    total = sum(final_scores.values())
    norm = {emo: int(round(final_scores[emo] / total * 100)) for emo in EMOTION_KEYS}

    # 반올림 오차 수정
    diff = 100 - sum(norm.values())
    if diff != 0:
        max_emo = max(norm.items(), key=lambda x: x[1])[0]
        norm[max_emo] += diff

    # ---------------- Hybrid Polarity 계산 ----------------
    final_polarity = hybrid_polarity(
        text=diary_text,
        gpt_polarity=gpt_polarity,
        score_surprise=norm["놀람"],
        score_shy=norm["부끄러움"]
    )

    # ---------------- Top emotions ----------------
    # 0%가 아닌 모든 감정을 포함 (와글와글 광장에서 모든 감정이 대화에 참여하도록)
    sorted_emotions = sorted(norm.items(), key=lambda x: x[1], reverse=True)
    top_emotions = [emo for emo, score in sorted_emotions if score > 0]

    if not top_emotions:
        top_emotions = default_top

    return {
        "emotion_scores": norm,
        "top_emotions": top_emotions,
        "emotion_polarity": final_polarity
    }