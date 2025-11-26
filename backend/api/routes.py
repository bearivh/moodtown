import os
import sys
from flask import Blueprint, jsonify, request

# Ensure backend root on sys.path for absolute-style imports (core/, services/)
sys.path.append(os.path.dirname(__file__) + "/..")

from core.common import ml_predict  # type: ignore
from services.emotion_gpt import analyze_emotions_with_gpt
from services.conversation import generate_dialogue_with_gpt
from .chat import chat_bp
from .diary import diary_bp
from .tree import tree_bp
from .well import well_bp
from .letters import letters_bp
from .auth import auth_bp

api_bp = Blueprint("api", __name__)

@api_bp.route("/")
def home():
    return {"message": "EmotionTown Chatbot API running 🚀"}

@api_bp.route("/health")
def health():
    """Railway 헬스체크 엔드포인트"""
    return jsonify({
        "status": "healthy",
        "message": "API is running",
        "environment": os.environ.get("ENVIRONMENT", "development")
    }), 200

@api_bp.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json() or {}
    diary_text = (data.get("content") or "").strip()
    if not diary_text:
        return jsonify({"error": "content 필드가 비어 있습니다."}), 400
    emo_result = analyze_emotions_with_gpt(diary_text)
    dialogue = generate_dialogue_with_gpt(diary_text, emo_result.get("top_emotions", []))
    return jsonify({"emotion_result": emo_result, "openai_dialogue": dialogue})

@api_bp.route("/analyze2", methods=["POST"])
def analyze_v2():
    data = request.get_json() or {}
    text = (data.get("content") or "").strip()
    mode = data.get("mode", "gpt")
    if not text:
        return jsonify({"error": "content 필드가 비어 있습니다."}), 400
    if mode == "ml":
        if ml_predict is None:
            return jsonify({"error": "ML 분석 모듈이 로드되지 않았습니다."}), 500
        ml_out = ml_predict(text)
        return jsonify({
            "mode": "ml",
            "result": {"label": ml_out.get("label", "기쁨"), "scores": ml_out.get("scores", {})},
            "meta": {"source": "demo-ml", "persisted": False}
        })
    elif mode == "gpt":
        emo_result = analyze_emotions_with_gpt(text)
        dialogue = generate_dialogue_with_gpt(text, emo_result.get("top_emotions", []))
        return jsonify({
            "mode": "gpt",
            "emotion_result": emo_result,
            "openai_dialogue": dialogue,
            "meta": {"source": "gpt", "persisted": False}
        })
    else:
        return jsonify({"error": "invalid mode"}), 400

def register_all(app):
    app.register_blueprint(api_bp, url_prefix="")
    app.register_blueprint(chat_bp, url_prefix="")
    app.register_blueprint(diary_bp, url_prefix="")
    app.register_blueprint(tree_bp, url_prefix="")
    app.register_blueprint(well_bp, url_prefix="")
    app.register_blueprint(letters_bp, url_prefix="")
    app.register_blueprint(auth_bp, url_prefix="")


