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
    n_gpu_layers=-1,
    n_batch=512,
    use_mlock=True,
    use_mmap=True,
    verbose=False
)
print("[moodPage] ✅ Llama model loaded.")


# ==============================
# 1) JSON 안전 추출 함수
# ==============================
def extract_json(text: str):
    if not text:
        return {}

    cleaned = re.sub(r"```[\s\S]*?```", "", text).strip()
    m = re.search(r"<BEGIN_JSON>([\s\S]*?)<END_JSON>", cleaned)
    if m:
        candidate = m.group(1).strip()
    else:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            print("[moodPage] ⚠️ JSON braces not found in output")
            print("[RAW OUTPUT]", cleaned[:800])
            return {}
        candidate = cleaned[start:end + 1]

    try:
        return json.loads(candidate)
    except Exception as e:
        print("[moodPage] JSON parse failed:", e)
        print("[RAW JSON CANDIDATE]", candidate[:600])
        return {}


# ==============================
# 2) 프롬프트 정의
# ==============================
PROMPT_ANALYZE_DIARY = """\
당신은 한국어 감정 분석 전문가입니다.
다음 일기를 읽고 사용자의 감정을 정리하세요.
오직 JSON만 출력하며, 태그 <BEGIN_JSON> ~ <END_JSON> 사이에 작성하세요.
감정 요약이 아닌 '일기의 내용 요약'을 summary로 작성하세요.

<BEGIN_JSON>
{
  "summary": "일기의 주요 사건과 내용 요약 (감정 분석이 아니라 스토리 요약)",
  "keywords": ["감정1", "감정2", ...],
  "emotion_scores": {"감정1": 20, "감정2": 30, ...},
  "pos_neg_ratio": {"positive": 0.6, "negative": 0.4}
}
<END_JSON>
"""

PROMPT_ANALYZE_PHOTO_TEMPLATE = """\
당신은 감정 분석 전문가입니다.
다음은 사용자가 업로드한 사진의 자동 캡션입니다: "{caption}"

이 사진은 사용자의 하루 일기와 연관되어 있습니다.
사진이 단순히 평온하다, 차분하다는 식의 묘사가 아니라,
일기와 사진을 함께 고려했을 때, 사진이 전달하는 정서적 분위기를 분석하세요.
정확하게 분위기나 정서를 나타내는 단어들을 사용하세요.

오직 하나의 JSON만 출력하고 <BEGIN_JSON>과 <END_JSON>으로 감싸세요.

<BEGIN_JSON>
{
  "photo_mood": "사진이 일기 감정과 조화를 이루거나 대조되는 정서적 분위기"
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
        prompt = f"{PROMPT_ANALYZE_DIARY}\n\n일기 내용:\n{text}\n\n출력 시작:"
        print("[moodPage] Running Llama inference for diary analysis...")

        out = model(
            prompt,
            max_tokens=512,
            temperature=0.6,
            top_p=0.9,
            stop=["<END_JSON>", "<|eot_id|>"]
        )
        raw_text = out["choices"][0]["text"]
        print("[DEBUG] Diary Raw Output (head 500):", raw_text[:500].replace("\n", " "))
        diary_json = extract_json(raw_text)
    except Exception as e:
        print("[ERROR] Diary analysis failed:", e)
        diary_json = {}

    # ----- (B) 사진 분석 -----
    photo_json = {}
    if image_path:
        try:
            caption = describe_image(image_path)
            print("[Image Caption]", caption)

            # 캡션을 자연스러운 한국어로 번역 (짧고 감정 중심)
            translate_prompt = f"Translate this caption into natural short Korean for emotional analysis: {caption}"
            tr_out = model(translate_prompt, max_tokens=60)
            caption_kr = tr_out["choices"][0]["text"].strip()
            if not caption_kr:
                caption_kr = caption  # fallback

            photo_prompt = PROMPT_ANALYZE_PHOTO_TEMPLATE.replace("{caption}", caption_kr)
            print("[moodPage] Running Llama inference for photo analysis...")

            out_photo = model(
                photo_prompt,
                max_tokens=256,
                temperature=0.6,
                top_p=0.9,
                stop=["<END_JSON>", "<|eot_id|>"]
            )
            raw_photo = out_photo["choices"][0]["text"]
            print("[DEBUG] Photo Raw Output (head 500):", raw_photo[:500].replace("\n", " "))
            photo_json = extract_json(raw_photo)
        except Exception as e:
            print("[ERROR] Photo analysis failed:", e)
            photo_json = {}

    # ----- (C) 결과 병합 -----
    result = {
        "summary": diary_json.get("summary", ""),
        "keywords": diary_json.get("keywords", []),
        "emotion_scores": diary_json.get("emotion_scores", {}),
        "pos_neg_ratio": diary_json.get("pos_neg_ratio", {}),
        "photo_mood": photo_json.get("photo_mood", "")
    }

    # ----- (D) 감정 지수 정규화 (총합 100으로)
    if isinstance(result["emotion_scores"], dict):
        scores = {k: max(0, float(v)) for k, v in result["emotion_scores"].items() if isinstance(v, (int, float, str))}
        total = sum(scores.values())
        if total > 0:
            result["emotion_scores"] = {k: round(v / total * 100, 1) for k, v in scores.items()}
        else:
            result["emotion_scores"] = {}
    else:
        result["emotion_scores"] = {}

    # ----- (E) 긍/부정 비율 정규화
    posneg = result.get("pos_neg_ratio", {})
    try:
        pos = float(posneg.get("positive", 0))
        neg = float(posneg.get("negative", 0))
    except Exception:
        pos, neg = 0.5, 0.5
    if pos + neg == 0:
        pos, neg = 0.5, 0.5
    total = pos + neg
    pos, neg = pos / total, neg / total
    result["pos_neg_ratio"] = {"positive": round(pos, 3), "negative": round(neg, 3)}

    # ----- (F) photo_mood 기본값 (비었을 때 보완)
    if not result["photo_mood"]:
        result["photo_mood"] = "사진에서 뚜렷한 감정 분위기를 찾지 못함"

    # ----- (G) 최종 출력 -----
    print("[DEBUG] FINAL RESULT BEFORE RETURN:")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("============================\n")

    return result