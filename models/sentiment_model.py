import os
import json
from llama_cpp import Llama

# ===== 모델 로드 =====
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "llm_data/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"
)

print(f"[moodPage] Loading model from {MODEL_PATH} ...")

model = Llama(
    model_path=MODEL_PATH,
    n_ctx=2048,
    n_gpu_layers=-1,  # GPU 사용
    verbose=False
)

# ===== 기본 프롬프트 =====
PROMPT_SYSTEM = """\
당신은 감정 분석 전문가입니다.
사용자의 일기를 읽고 JSON 형식으로 감정을 분석하세요.

출력 형식 예시:
{
  "summary": "하루를 간단히 요약",
  "keywords": ["감정1", "감정2", "감정3"],
  "emotion_scores": {"감정1": 40, "감정2": 30, "감정3": 30},
  "pos_neg_ratio": {"positive": 0.6, "negative": 0.4}
}
"""

# ===== 감정 분석 함수 =====
def analyze_diary(text: str):
    """
    Llama 모델을 사용해 일기의 감정 분석 JSON 결과를 반환
    """
    user_prompt = f"다음은 사용자의 일기입니다:\n{text}\n\n이 일기의 감정을 위 형식대로 분석하세요."
    full_prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n{PROMPT_SYSTEM}\n<|eot_id|><|start_header_id|>user<|end_header_id|>\n{user_prompt}\n<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n"

    print("[moodPage] Running Llama inference...")

    output = model(
        full_prompt,
        max_tokens=512,
        temperature=0.6,
        top_p=0.9,
        stop=["<|eot_id|>"]
    )

    text_out = output["choices"][0]["text"].strip()
    print("[RAW OUTPUT]", text_out)
    # JSON만 추출
    start = text_out.find("{")
    end = text_out.rfind("}")
    if start != -1 and end != -1:
        text_out = text_out[start:end+1]

    try:
        parsed = json.loads(text_out)
        return parsed
    except Exception as e:
        print("[moodPage] JSON parsing failed:", e)
        print("[RAW OUTPUT]", text_out)
        return {
            "summary": "모델 출력 파싱 실패",
            "keywords": [],
            "emotion_scores": {},
            "pos_neg_ratio": {"positive": 0.5, "negative": 0.5}
        }

