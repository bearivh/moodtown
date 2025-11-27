from typing import Dict, List
from flask import Blueprint, request, jsonify
from core.common import client, CHARACTERS

chat_bp = Blueprint("chat", __name__)
chat_sessions: Dict[str, List[Dict[str, str]]] = {}

@chat_bp.route("/api/chat", methods=["POST"])
def chat_with_characters():
    data = request.get_json() or {}
    user_input = (data.get("message") or "").strip()
    active_emotions = data.get("characters") or []
    session_date = data.get("date", "default")
    diary_content = data.get("diary_content") or None

    if not user_input:
        return jsonify({"error": "message 필드가 비어 있습니다."}), 400
    if not active_emotions:
        return jsonify({"error": "characters 필드가 필요합니다."}), 400

    if session_date not in chat_sessions:
        chat_sessions[session_date] = []

    character_info = "\n".join([
        f"{CHARACTERS[e]['name']}({e}): {CHARACTERS[e]['style']}"
        + (f"\n    말투 특징: {', '.join(CHARACTERS[e].get('speech_hints', []))}" if CHARACTERS[e].get('speech_hints') else "")
        for e in active_emotions if e in CHARACTERS
    ])

    messages = [{
        "role": "system",
        "content": (
            "너는 사용자의 내면 감정을 대표하는 '감정 주민'입니다. "
            "사용자의 메시지를 듣고, 각자의 감정 스타일에 맞게 자연스럽게 반말로 대답합니다."
        )
    }]
    for msg in chat_sessions[session_date][-10:]:
        messages.append(msg)

    user_message = f"나: {user_input}"
    messages.append({"role": "user", "content": user_message})
    chat_sessions[session_date].append({"role": "user", "content": user_message})

    # 일기 내용 섹션 구성 (일기 내용이 있는 경우에만)
    diary_section = ""
    if diary_content and diary_content.strip():
        diary_section = (
            f"\n\n📝 오늘 작성한 일기:\n\n"
            f"{diary_content.strip()}\n\n"
            "⚠️ 참고사항:\n"
            "- 이 일기는 사용자가 오늘 작성한 내용입니다.\n"
            "- 주민들은 이 일기 내용을 참고하여 사용자의 감정 상태를 이해할 수 있습니다.\n"
            "- 일기의 구체적인 내용이나 세부 사항을 언급할 수 있지만, 일기를 그대로 읽어주지는 않습니다.\n"
            "- 일기의 감정과 맥락을 바탕으로 사용자에게 자연스럽게 대화합니다.\n"
        )
    
    prompt = (
        "당신은 사용자의 내면 감정을 대표하는 '감정 주민'입니다.\n\n"
        "사용자의 메시지를 듣고, 각자의 감정 스타일에 맞게 자연스럽게 반말로 대답합니다.\n\n"
        "🎯 핵심 규칙\n\n"
        "1) 주민들은 사용자에게 직접 말합니다.\n"
        "2) \"너\", \"네가\", \"너한테\" 같은 표현 사용 가능.\n"
        "3) 감정 표현은 1인칭('나')으로 표현합니다.\n"
        "4) 말투는 스타일 + speech_hints 기반.\n"
        "5) 제3자 분석·심리평가 금지.\n"
        "6) JSON 출력 금지, 대사만 출력.\n\n"
        "⚠️ 중요한 구분\n"
        "- 이 대화는 사용자에게 직접 말하는 대화입니다.\n"
        "- \"너\", \"네가\", \"그치?\" 같은 표현을 사용하여 사용자와 자연스럽게 대화합니다.\n"
        "- 주민들은 사용자의 감정을 자신이 느끼는 것처럼 표현하면서도, 사용자와 명확히 구분되어 대화합니다.\n\n"
        "🧩 말하는 방식 예시\n\n"
        "사용자: 화가 나고 속상해서 기분이 안 좋아...\n"
        "대화:\n"
        "- 빨강이(분노): \"그러니까! 진짜 화났어. 그치?\"\n"
        "- 초록이(사랑): \"너가 좋아하는 것들을 떠올려 봐. 기분이 나아질 거야.\"\n"
        "- 파랑이(슬픔): \"그래도 많이 속상했겠다. 괜찮아?\"\n\n"
        f"{diary_section}"
        "📘 사용자 메시지:\n\n"
        f"{user_input}\n\n"
        "현재 등장한 주민:\n"
        f"{character_info}\n\n"
        "이제 각 주민이 한 줄씩 순서대로 사용자에게 말하세요.\n\n"
        "출력 형식:\n"
        "주민이름(감정명): \"대사 내용\"\n"
        "예:\n"
        "빨강이(분노): \"그러니까! 진짜 화났어. 그치?\"\n"
        "초록이(사랑): \"좋게 생각하자. 너가 좋아하는 것들을 떠올려 봐.\""
    )
    messages.append({"role": "user", "content": prompt})

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.8,
            max_tokens=400
        )
        reply = response.choices[0].message.content or ""
        chat_sessions[session_date].append({"role": "assistant", "content": reply})
    except Exception as e:
        reply = f"[OpenAI Error] {str(e)}"

    return jsonify({"reply": reply})


