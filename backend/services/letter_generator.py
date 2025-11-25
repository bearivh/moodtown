from typing import Dict, List
from flask import Blueprint, request, jsonify
from core.common import client, CHARACTERS

chat_bp = Blueprint("chat", __name__)
chat_sessions: Dict[str, List[Dict[str, str]]] = {}


@chat_bp.route("/chat", methods=["POST"])
def chat_with_characters():
    data = request.get_json() or {}
    user_input = (data.get("message") or "").strip()
    active_emotions = data.get("characters") or []
    session_date = data.get("date", "default")

    if not user_input:
        return jsonify({"error": "message 필드가 비어 있습니다."}), 400
    if not active_emotions:
        return jsonify({"error": "characters 필드가 필요합니다."}), 400

    # 세션 초기화
    if session_date not in chat_sessions:
        chat_sessions[session_date] = []

    # 등장할 주민 정보 (말투 + 스타일 포함)
    character_info = "\n".join([
        f"- {CHARACTERS[e]['name']}({e}) — {CHARACTERS[e]['style']}"
        + (f"\n    말투 특징: {', '.join(CHARACTERS[e].get('speech_hints', []))}"
           if CHARACTERS[e].get("speech_hints") else "")
        for e in active_emotions if e in CHARACTERS
    ])

    # 전체 주민 말투 설명
    all_character_details = "\n".join([
        f"- {CHARACTERS[emo]['name']}({emo}): {CHARACTERS[emo].get('description', CHARACTERS[emo]['style'])}"
        + (f"\n    말투 특징: {', '.join(CHARACTERS[emo].get('speech_hints', []))}"
           if CHARACTERS[emo].get("speech_hints") else "")
        for emo in CHARACTERS.keys()
    ])

    # 이전 대화 msg 포함
    messages = [
        {
            "role": "system",
            "content": (
                "너는 사용자 마음속 감정들이 서로 대화하는 '내면 감정 주민'들의 작가다.\n"
                "주민들은 모두 반말을 쓰며, 사용자의 감정을 대신 표현하는 내면의 목소리다.\n"
                "주민들은 절대 제3자처럼 분석하거나 설명하지 않는다.\n"
                "주민들은 '사용자에게 말하는 것'이 아니라 '내면에서 서로 의견을 나누는 것'이다.\n"
                "JSON만 출력해야 하며, 캐릭터 이름은 반드시 주민 이름(노랑이, 초록이 등)만 사용해야 한다."
            )
        }
    ]

    # 최근 10개 메시지 유지
    for msg in chat_sessions[session_date][-10:]:
        messages.append(msg)

    # 사용자의 실제 입력
    user_message_wrapped = f"나: {user_input}"
    messages.append({"role": "user", "content": user_message_wrapped})

    chat_sessions[session_date].append({"role": "user", "content": user_message_wrapped})

    # -----------------------------
    # 🔥 최종 프롬프트 (Version 3)
    # -----------------------------
    prompt = (
        "당신은 사용자의 마음속에 사는 감정 주민들입니다.\n"
        "주민들은 사용자가 느끼는 감정을 그대로 느끼고, 각자의 말투로 반응합니다.\n\n"

        "등장할 주민들:\n"
        f"{character_info}\n\n"

        "⚠️ 규칙 (엄격하게 지켜야 함):\n"
        "1) 주민들은 반드시 반말만 사용해야 한다. 절대 존댓말 금지.\n"
        "2) 주민들은 사용자의 내면의 감정이며 ‘나’의 입장에서 말을 한다.\n"
        "3) 사용자가 한 행동을 다시 설명하거나 요약하는 말 금지.\n"
        "4) 감정 판단, 해석, 조언 금지. 오직 내면의 감정만 말해야 한다.\n"
        "5) 등장 주민들은 ‘사용자의 말’을 듣고 느낀 감정을 표현한다.\n"
        "6) 각 주민의 style과 speech_hints를 반드시 반영해 말투를 유지한다.\n"
        "7) 각 주민은 한 줄씩만 말하되 반드시 5자 이상의 의미 있는 대사를 포함해야 한다.\n"
        "8) JSON으로만 출력해야 한다. JSON 외의 문장 금지.\n"
        "9) 캐릭터에는 감정명이 아닌 주민 이름만 사용해야 한다.\n\n"

        "📘 사용자의 입력:\n"
        f"{user_input}\n\n"

        "다음 형식을 지켜서 출력하세요:\n"
        "<BEGIN_JSON>\n"
        "{ \"dialogue\": [ {\"캐릭터\": \"이름\", \"대사\": \"내용\"} ] }\n"
        "<END_JSON>"
    )

    messages.append({"role": "user", "content": prompt})

    # GPT 호출
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.8,
            max_tokens=500
        )
        reply = response.choices[0].message.content or ""
        chat_sessions[session_date].append({"role": "assistant", "content": reply})
    except Exception as e:
        reply = f"[OpenAI Error] {str(e)}"

    return jsonify({"reply": reply})
