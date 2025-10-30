# models/vision_analyzer.py
import torch
from PIL import Image
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
from llama_cpp import Llama

# --------------------------
# 1️⃣ 이미지 캡셔닝 모델 (영문)
# --------------------------
CAPTION_MODEL_ID = "nlpconnect/vit-gpt2-image-captioning"
device = torch.device("cpu")

print("[VisionAnalyzer] 모델 로드 중...")
feature_extractor = ViTImageProcessor.from_pretrained(CAPTION_MODEL_ID)
tokenizer = AutoTokenizer.from_pretrained(CAPTION_MODEL_ID)
caption_model = VisionEncoderDecoderModel.from_pretrained(CAPTION_MODEL_ID).to(device)
print("[VisionAnalyzer] 로드 완료.")

# --------------------------
# 2️⃣ Bllossom (한국어 감정 요약)
# --------------------------
BLOSSOM_PATH = "models/llama-3-Korean-Bllossom-8B-Q4_K_M.gguf"

llm = Llama(
    model_path=BLOSSOM_PATH,
    n_ctx=4096,
    n_threads=6,
    verbose=False
)

# --------------------------
# 3️⃣ 이미지 감정/분위기 분석 함수
# --------------------------
def analyze_image_mood(image_path: str) -> str:
    """
    이미지의 분위기나 감정을 Bllossom이 한국어 키워드로 요약
    """
    try:
        # (1) 이미지 → 영어 캡션 생성
        image = Image.open(image_path).convert("RGB")
        pixel_values = feature_extractor(images=image, return_tensors="pt").pixel_values.to(device)

        generated_ids = caption_model.generate(
            pixel_values,
            max_length=64,
            num_beams=5,
            early_stopping=True
        )

        english_caption = tokenizer.decode(generated_ids[0], skip_special_tokens=True)
        print("[English Caption]", english_caption)

        # (2) 영어 문장 → 한국어 감정 키워드 요약
        prompt = f"""
        아래 영어 문장을 보고, 사진의 분위기나 감정을 한국어로 1~3개의 키워드로 요약해줘.
        예시: 따뜻함, 평화로움, 고요함
        영어 문장: "{english_caption}"
        """

        result = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0.7
        )
        mood_keywords = result["choices"][0]["message"]["content"].strip()

        return mood_keywords

    except Exception as e:
        print("[Error in analyze_image_mood]:", e)
        return "이미지를 분석하는 중 오류가 발생했습니다."
