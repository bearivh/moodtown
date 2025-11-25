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

    if session_date not in chat_sessions:
        chat_sessions[session_date] = []

    character_info = "\n".join([
        f"{CHARACTERS[e]['name']}({e}): {CHARACTERS[e]['style']}"
        + (f"\n    말투 특징: {', '.join(CHARACTERS[e].get('speech_hints', []))}" if CHARACTERS[e].get('speech_hints') else "")
        for e in active_emotions if e in CHARACTERS
    ])
    all_character_details = "\n".join([
        f"   - {CHARACTERS[emo]['name']}({emo}): {CHARACTERS[emo].get('description', CHARACTERS[emo]['style'])}"
        + (f"\n     말투 특징: {', '.join(CHARACTERS[emo].get('speech_hints', []))}" if CHARACTERS[emo].get('speech_hints') else "")
        for emo in CHARACTERS.keys()
    ])

    messages = [{
        "role": "system",
        "content": (
            "너는 사용자의 내면에 사는 감정 주민들의 대화를 쓰는 작가야. "
            "각 주민은 자신이 어떤 감정을 대표하는 주민인지 명확히 알고 있으며, "
            "그 감정의 특성에 맞는 말투와 내용으로 대답한다. "
            "주민들은 사용자의 내면의 목소리이며, 반말로 편하게 당사자(1인칭) 관점으로 말한다. "
        "제3자처럼 말하지 말고 '나'의 입장에서 직접적으로 대답한다. "
        "각 주민의 '말투 특징'을 정확히 반영하여 고유한 말투를 유지해야 한다."
        )
    }]
    for msg in chat_sessions[session_date][-10:]:
        messages.append(msg)

    user_message = f"나: {user_input}"
    messages.append({"role": "user", "content": user_message})
    chat_sessions[session_date].append({"role": "user", "content": user_message})

    prompt = (
        f"당신은 사용자의 내면에 사는 감정 주민들입니다. 다음은 사용자가 말한 내용입니다.\n\n"
        f"현재 등장 가능한 주민들:\n{character_info}\n\n"
        f"사용자가 말한 내용:\n{user_input}\n\n"
        f"⚠️ 중요한 대화 원칙:\n"
        f"1. 주민들은 사용자의 내면의 목소리입니다. 제3자처럼 말하지 말고, 당사자(1인칭)처럼 말하세요.\n"
        f"2. 반말로 편하게 대답하세요. 존댓말은 사용하지 마세요.\n"
        f"3. 사용자에게 대답하는 것이 아니라, 사용자의 마음속에서 나오는 목소리처럼 말하세요.\n"
        f"4. 각 주민은 자신이 어떤 감정을 대표하는 주민인지 알고, 그 감정의 특성에 맞게 대답하세요:\n"
        f"{all_character_details}\n"
        f"5. 예시:\n"
        f"   - ❌ 잘못된 예: '오늘 피곤하셨군요. 힘드셨을 것 같아요.' (존댓말, 제3자)\n"
        f"   - ✅ 올바른 예 (파랑이): '오늘 정말 피곤했어. 힘들었어...' (반말, 당사자, 슬픔의 톤)\n"
        f"   - ✅ 올바른 예 (노랑이): '친구들이랑 놀아서 정말 좋았어! 너무 즐거웠어!' (반말, 당사자, 기쁨의 톤)\n"
        f"   - ✅ 올바른 예 (빨강이): '정말 화가 나! 왜 이렇게 해야 하는 거야!' (반말, 당사자, 분노의 톤)\n"
        f"6. 사용자의 메시지와 관련이 있거나, 감정적으로 공감할 수 있는 주민들만 대답하세요.\n"
        f"7. 각 주민은 자신의 감정 역할을 명확히 알고, 그 감정의 특성에 맞는 말투와 내용으로 한 줄씩 대답하세요.\n"
        f"   각 주민의 '말투 특징'을 참고하여 정확한 말투를 사용하세요.\n"
        f"8. ⚠️ 중요: 모든 대사는 반드시 내용이 있어야 합니다. 빈 대사나 공백만 있는 대사를 만들지 마세요.\n"
        f"9. 대사는 최소 5자 이상의 의미 있는 내용이어야 합니다.\n\n"
        f"대사는 JSON 형식으로:\n"
        f"<BEGIN_JSON>\n{{\"dialogue\": [{{\"캐릭터\": \"이름\", \"대사\": \"내용\"}}, ...]}}\n<END_JSON>\n\n"
        f"⚠️ 반드시 지켜야 할 규칙:\n"
        f"- 대사 필드는 절대 비어있으면 안 됩니다.\n"
        f"- 모든 대사는 의미 있는 내용이 있어야 합니다.\n"
        f"- JSON 형식을 정확히 지켜주세요."
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


