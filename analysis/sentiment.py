from llama_cpp import Llama

MODEL_PATH = "models/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=6
)

def analyze_emotion(text: str):
    prompt = f"""
너는 감정 분석 전문가야.
사용자가 쓴 일기를 보고, 사용자가 일기 속에서 느낀 주요 감정 1~3개를 단계적으로 분석해.
확실하게 느낀 감정만 골라서 적고, 추측하거나 애매한 감정은 적지 마.
감정은 실제로 느껴진 개수만큼 적어야 해.
하나만 느껴지면 하나만, 여러 개 느껴지면 그 개수만큼 적어.
감정을 적을 때는 명확한 기분을 나타내는 단어로 적어야 해.
그리고 각 감정의 지수를 매겨 줘. 전체 지수의 합이 100이 되도록 해.
일기 내용 요약은  겪은 일을 단계적으로 작성해서 간결하게 요약해 줘.
출력 형식은 아래 예시를 엄격히 따라야 해.:
    감정: [감정1(지수), 감정2(지수), 감정3(지수)]
    요약: [일기 내용 요약]

지시가 끝났어. 이제부터는 출력만 해.
---

일기:
{text}

---
출력 시작:
"""
    result = llm(
        prompt,
        max_tokens=120,
        temperature=0.6,
        top_p=0.9,
        stop=["---", "<|end_of_text|>", "<|eot_id|>"]
    )

    output = result["choices"][0]["text"].strip()
    print("🔍 RAW OUTPUT >>>", repr(output))  # 확인용
    return output or "감정 분석 실패"