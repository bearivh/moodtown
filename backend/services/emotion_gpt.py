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
    놀람/부끄러움 polarity를 문맥 기반으로 분석하는 개선 버전
    
    - 놀람/부끄러움 관련 문장만 별도로 추출하여 polarity 판단
    - 긍정적 놀람 패턴/부정적 놀람 패턴 추가
    """
    lines = [s.strip() for s in re.split(r'[.!?]\s*', text) if s.strip()]
    
    # 놀람/부끄러움 트리거 단어
    surprise_triggers = ["놀랐", "놀랍", "생각보다", "예상보다", "헉", "우와", "대박", "처음엔", "갑자기"]
    shy_triggers = ["부끄러", "창피", "민망", "얼굴 빨개", "쑥스러"]
    
    def find_trigger_sentences(triggers):
        extracted = []
        for line in lines:
            if any(t in line for t in triggers):
                extracted.append(line)
        return extracted
    
    # 놀람/부끄러움 해당 문장만 추출
    surprise_sentences = find_trigger_sentences(surprise_triggers)
    shy_sentences = find_trigger_sentences(shy_triggers)
    
    # 분석할 텍스트 선택 (없으면 전체 텍스트)
    surprise_text = " ".join(surprise_sentences) if surprise_sentences else text
    shy_text = " ".join(shy_sentences) if shy_sentences else text
    
    result = {"놀람": None, "부끄러움": None}
    
    # -------------------- 놀람 판단 --------------------
    if score_surprise > 0:
        # 긍정 패턴 (직접 매칭)
        positive_patterns = [
            "생각보다 * 높", "생각보다 * 잘", "생각보다 * 좋",
            "예상보다 * 높", "예상보다 * 좋", "예상보다 * 잘",
            "기쁜 소식", "좋은 소식", "좋은 결과", "합격", "성공",
            "대박", "기분이 좋", "행복"
        ]
        negative_patterns = [
            "생각보다 * 낮", "생각보다 * 안 좋", "더 안 좋",
            "충격", "실망", "황당", "어이없", "큰일", "망했",
            "나쁜 소식", "문제 생겼", "사고"
        ]
        
        s = surprise_text
        t = s.lower()
        
        # 직접 패턴 매칭 (와일드카드 처리)
        def match_pattern(pattern, text):
            # 와일드카드(*)를 임의 문자 시퀀스로 변환
            pattern = pattern.replace("*", ".*")
            # 정규식으로 변환
            try:
                return bool(re.search(pattern, text, re.IGNORECASE))
            except:
                # 정규식 실패 시 단순 문자열 포함 확인
                return pattern.replace(".*", "") in text
        
        # 긍정 패턴 확인
        pos_match = any(match_pattern(p, t) for p in positive_patterns)
        # 부정 패턴 확인
        neg_match = any(match_pattern(p, t) for p in negative_patterns)
        
        if pos_match:
            result["놀람"] = "positive"
        elif neg_match:
            result["놀람"] = "negative"
        else:
            # fallback: 키워드 count
            t = s.lower()
            pos = sum(1 for w in POSITIVE_SURPRISE if w in t)
            neg = sum(1 for w in NEGATIVE_SURPRISE if w in t)
            
            if pos > neg and pos > 0:
                result["놀람"] = "positive"
            elif neg > pos and neg > 0:
                result["놀람"] = "negative"
            else:
                result["놀람"] = None
    
    # -------------------- 부끄러움 판단 --------------------
    if score_shy > 0:
        s = shy_text
        t = s.lower()
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
    GPT + Rule-Based Hybrid Polarity
    
    중요한 규칙:
    1) rule_based 값이 있으면 반드시 우선
    2) GPT 값은 보조
    3) 둘 다 None이면 놀람 문맥 긍정 키워드 기반 추가 fallback
    """
    rule = rule_based_polarity(text, score_surprise, score_shy)
    final = {"놀람": None, "부끄러움": None}

    for emo in ["놀람", "부끄러움"]:
        score = score_surprise if emo == "놀람" else score_shy
        if score == 0:
            final[emo] = None
            continue

        r = rule.get(emo)
        g = gpt_polarity.get(emo)

        # 규칙 기반이 최우선
        if r is not None:
            final[emo] = r
            continue

        # GPT polarity가 valid한 경우
        if g in ["positive", "negative"]:
            final[emo] = g
            continue

        # -------------------
        # 추가 fallback: 놀람의 경우 긍정 단어가 많으면 positive
        # -------------------
        if emo == "놀람":
            if any(w in text for w in ["좋았", "기뻤", "행복", "높았", "잘됐", "좋은 소식"]):
                final[emo] = "positive"
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