import os
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def load_characters() -> Dict[str, Any]:
    # common.py가 core/ 하위로 이동했으므로 상위 디렉터리에서 characters.json을 찾음
    base_dir = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(base_dir, "characters.json")
    if not os.path.exists(path):
        raise FileNotFoundError("characters.json 파일이 없습니다.")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

CHARACTERS = load_characters()

EMOTION_KEYS = ["기쁨", "사랑", "놀람", "두려움", "분노", "부끄러움", "슬픔"]

# ML 감정 분석 (있으면 사용)
try:
    from services.emotion_ml import predict as ml_predict  # type: ignore
except Exception:
    ml_predict = None  # type: ignore


