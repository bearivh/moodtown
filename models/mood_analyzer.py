# models/mood_analyzer.py
from llama_cpp import Llama
import re

# 🔹 모델 파일 경로 (본인 환경에 맞게 수정)
MODEL_PATH = "models/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"

# 🔹 Llama 모델 초기화 (CPU 모드)
llm = Llama(
    model_path=MODEL_PATH,
    n_gpu_layers=0,   # GPU 사용 안 함
    n_ctx=8192,
    verbose=False
)

def analyze_mood(text: str):
    """
    Llama 모델로 감정 분석 수행 후 (감정 리스트, 요약문) 반환
    """
    # 입력 검증
    if not text.strip():
        return ["중립"], "내용이 없습니다."
    if len(text.strip()) < 10:
        return ["분석 실패"], "일기 내용이 너무 짧습니다."

    # 프롬프트 구성
    prompt = f"""
너는 감정 분석 전문가야.
사용자가 쓴 일기를 읽고 사용자가 느낀 감정을 분석해.
감정은 실제로 느껴진 개수만큼만 적어야 해.
감정을 표현하는 단어 1~3개를 쉼표로 구분해서 적어줘.
감정 단어는 반드시 명확해야 하고, 감정을 나타내는 단어만 적어.
일기 내용을 그대로 옮겨 적지 마.
추측하거나 과장하거나, 애매한 감정은 적지 마.
감정이 한 가지면 하나만, 여러 가지면 여러 개를 써도 된다.

출력 형식은 아래와 같다:
감정: 감정을 표현하는 단어 1~3개. 쉼표로 구분.
요약: [일기 내용 요약한 문장]

---
일기:
{text}
---
출력 시작:
"""

    try:
        # 모델 호출
        result = llm(
            prompt,
            max_tokens=100,     # 과도한 반복 방지
            temperature=0.8,    # 반복 완화
            top_p=0.9,
            stop=["출력", "#", "\n\n", "<|end_of_text|>", "<|eot_id|>"]  # 루프 차단
        )

        output = result["choices"][0]["text"].strip()

        # 🔍 디버깅용 출력
        print("\n================= MODEL RAW OUTPUT =================")
        print(output)
        print("====================================================\n")

        # 불필요한 반복/노이즈 제거
        output = re.sub(r"(출력\s*(중|완료)[^가-힣]*)+", "", output)
        output = re.split(r"(#|<\|end_of_text\|>|<\|eot_id\|>|출력\s*끝|출력\s*종료)", output)[0].strip()

        # 감정 / 요약 파싱
        emotions, summary = parse_result(output)
        return emotions, summary

    except Exception as e:
        print(f"[Model Error] {e}")
        return ["에러"], "모델 실행 중 오류 발생"


def parse_result(text: str):
    """
    모델의 출력에서 감정/요약 추출
    """
    text = text.strip()

    emo_match = re.search(r"감정\s*[:：]\s*([^\n\r]+)", text)
    sum_match = re.search(r"요약\s*[:：]\s*([^\n\r]+)", text)

    if not emo_match or not sum_match:
        return ["분석 실패"], "요약 실패"

    raw_emotions = emo_match.group(1)
    emotions = [e.strip() for e in re.split(r"[,，\s]+", raw_emotions) if e.strip()]
    summary = sum_match.group(1).strip()

    return emotions or ["분석 실패"], summary or "요약 실패"
