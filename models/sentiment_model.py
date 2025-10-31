import os
import json
import re
from llama_cpp import Llama
from utils.image_caption import describe_image


# ==============================
# 0) 모델 파일 경로 & 로드
# ==============================
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "llm_data",
    "llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"
)

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {MODEL_PATH}")

print(f"[moodPage] Loading Llama model from {MODEL_PATH} ...")
model = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_gpu_layers=-1,   # GPU 있으면 최대한 올리기
    n_batch=512,       # 추론 속도 향상
    use_mlock=True,
    use_mmap=True,
    verbose=False
)
print("[moodPage] ✅ Llama model loaded.")


# ==============================
# 1) 안정적인 JSON 추출기
#   - <BEGIN_JSON> ... <END_JSON> 범위로 먼저 시도
#   - 없으면 균형괄호로 첫 JSON 블록 추출
# ==============================
def extract_json(text: str):
    if not text:
        return {}

    # 1) 코드펜스 제거
    cleaned = re.sub(r"```[\s\S]*?```", "", text).strip()

    # 2) 태그 범위가 있으면 그 안만 취함
    m = re.search(r"<BEGIN_JSON>([\s\S]*?)<END_JSON>", cleaned)
    if m:
        candidate = m.group(1).strip()
    else:
        # 3) 일반 출력: 첫 번째 JSON 블록만 추출 (균형괄호)
        start = cleaned.find("{")
        if start == -1:
            print("[moodPage] ⚠️ No '{' found in LLM output")
            print("[RAW OUTPUT]", cleaned[:1000])
            return {}
        depth = 0
        end = None
        in_str = False
        esc = False
        for i in range(start, len(cleaned)):
            ch = cleaned[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break
        if end is None:
            print("[moodPage] ⚠️ No matching '}' found for JSON")
            print("[RAW OUTPUT]", cleaned[:1000])
            return {}
        candidate = cleaned[start:end]

    # 4) 줄 끝에 달린 주석류 제거 (태그 밖 노이즈 방지용)
    candidate = candidate.split("\n#")[0].split("\n//")[0].strip()

    # 5) 파싱
    try:
        return json.loads(candidate)
    except Exception as e:
        print("[moodPage] JSON parse failed:", e)
        print("[RAW JSON CANDIDATE]", candidate[:2000])
        return {}


# ==============================
# 2) 프롬프트 (오직 JSON만, 한국어만, 태그로 감싸기)
# ==============================
PROMPT_ANALYZE_DIARY = """\
당신은 한국어 감정 분석기입니다.
다음 일기를 읽고 **오직 하나의 JSON 객체만** 출력하세요.
반드시 <BEGIN_JSON> 과 <END_JSON> 태그로 감싸고, 태그 밖에는 아무것도 출력하지 마세요.
설명/예시/주석/마크다운/코드펜스는 절대 금지. 한국어로 작성.

형식:
<BEGIN_JSON>
{
  "summary": "일기의 전반적인 감정 요약",
  "keywords": ["감정1", "감정2", ...],
  "emotion_scores": {"감정1": 20, "감정2": 30, ...},
  "pos_neg_ratio": {"positive": 0.6, "negative": 0.4}
}
<END_JSON>
"""

PROMPT_ANALYZE_PHOTO_TEMPLATE = """\
당신은 한국어 이미지 감정 분석기입니다.
다음은 이미지 자동 캡션입니다: "{caption}"
이 사진에 무엇이 담겨 있고 어떤 분위기/감정이 느껴지는지 **오직 하나의 JSON 객체**로 출력하세요.
반드시 <BEGIN_JSON> 과 <END_JSON> 태그로 감싸고, 태그 밖에는 아무것도 출력하지 마세요.
설명/예시/주석/마크다운/코드펜스 금지.

형식:
<BEGIN_JSON>
{
  "photo_description": "사진 속 장면에 대한 구체적 설명",
  "photo_mood": "사진에서 느껴지는 전반적 분위기"
}
<END_JSON>
"""


# ==============================
# 3) 메인 분석 함수
# ==============================
def analyze_diary(text: str, image_path: str = None):
    print("\n============================")
    print("[moodPage] analyze_diary() START")
    print("============================")

    # ----- (A) 일기 감정 분석 -----
    diary_json = {}
    try:
        diary_prompt = f"{PROMPT_ANALYZE_DIARY}\n\n일기 내용:\n{text}\n\n출력 시작:"
        print("[moodPage] Running Llama inference for diary analysis...")

        diary_output = model(
            diary_prompt,
            max_tokens=320,      # 속도 개선
            temperature=0.6,
            top_p=0.9,
            stop=["<END_JSON>", "<|eot_id|>"]  # 태그 끝에서 강제 중단
        )
        diary_text = diary_output["choices"][0]["text"]
        # 참고용: 너무 긴 로그는 잘라서
        print("[DEBUG] Diary Raw Output (head 500):", diary_text[:500].replace("\n", " "))
        diary_json = extract_json(diary_text)
    except Exception as e:
        print("[ERROR] Diary analysis failed:", e)
        diary_json = {}

    # ----- (B) 사진 분석 (옵션) -----
    photo_json = {}
    if image_path:
        try:
            caption = describe_image(image_path)
            print("[Image Caption]", caption)

            photo_prompt = PROMPT_ANALYZE_PHOTO_TEMPLATE.format(caption=caption) + "\n출력 시작:"
            print("[moodPage] Running Llama inference for photo analysis...")

            photo_output = model(
                photo_prompt,
                max_tokens=200,  # 사진은 더 짧게
                temperature=0.6,
                top_p=0.9,
                stop=["<END_JSON>", "<|eot_id|>"]
            )
            photo_text = photo_output["choices"][0]["text"]
            print("[DEBUG] Photo Raw Output (head 500):", photo_text[:500].replace("\n", " "))
            photo_json = extract_json(photo_text)
        except Exception as e:
            print("[ERROR] Photo analysis failed:", e)
            photo_json = {}

    # ----- (C) 결과 병합 -----
    result = {
        "summary": diary_json.get("summary", ""),
        "keywords": diary_json.get("keywords", []),
        "emotion_scores": diary_json.get("emotion_scores", {}),
        "pos_neg_ratio": diary_json.get("pos_neg_ratio", {}),
        "photo_description": photo_json.get("photo_description", ""),
        "photo_mood": photo_json.get("photo_mood", "")
    }

    # ----- (D) 정규화 (그래프 안전) -----
    # emotion_scores → 숫자 보정
    if not isinstance(result["emotion_scores"], dict):
        result["emotion_scores"] = {}
    norm_scores = {}
    for k, v in result["emotion_scores"].items():
        try:
            iv = int(float(v))
            iv = max(0, iv)
        except Exception:
            iv = 0
        norm_scores[str(k)] = iv
    result["emotion_scores"] = norm_scores

    # ✅ pos/neg 비율 보정 — "모델 값 유지"가 원칙, 필요 시에만 정규화
    posneg = result.get("pos_neg_ratio", {})
    # 문자열로 들어온 경우 파싱
    if isinstance(posneg, str):
        try:
            posneg = json.loads(posneg)
        except Exception:
            posneg = {}
    # 값 꺼내기 & float 변환
    def _to_float(x):
        try:
            return float(x)
        except Exception:
            return None

    pos = _to_float(posneg.get("positive")) if isinstance(posneg, dict) else None
    neg = _to_float(posneg.get("negative")) if isinstance(posneg, dict) else None

    # 한쪽만 있으면 나머지는 1 - 값
    if pos is None and neg is not None and 0 <= neg <= 1:
        pos = 1.0 - neg
    if neg is None and pos is not None and 0 <= pos <= 1:
        neg = 1.0 - pos

    # NaN/None 보정
    if pos is None: pos = 0.0
    if neg is None: neg = 0.0

    # 음수 제거
    pos = max(0.0, pos)
    neg = max(0.0, neg)

    # 합이 0이 아니면 "정규화만" 수행 (덮어쓰기 금지)
    if (pos + neg) > 0:
        total = pos + neg
        pos = pos / total
        neg = neg / total
    else:
        # 둘 다 0이면 디폴트는 부정 1.0 (사용자 기대를 반영)
        pos, neg = 0.0, 1.0

    result["pos_neg_ratio"] = {"positive": round(pos, 6), "negative": round(neg, 6)}

    # ----- (E) 최종 로그 -----
    print("[DEBUG] FINAL RESULT BEFORE RETURN:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("============================\n")

    return result
