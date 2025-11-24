from typing import List
from core.common import client, CHARACTERS, EMOTION_KEYS

def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str]) -> str:
    try:
        # 캐릭터 정보 정리
        all_characters = {}
        primary_characters = {}

        for emo in EMOTION_KEYS:
            if emo in CHARACTERS:
                char = CHARACTERS[emo]
                # speech_hints가 있으면 포함
                hints_text = ""
                if 'speech_hints' in char and char['speech_hints']:
                    hints_text = "\n    말투 특징: " + ", ".join(char['speech_hints'])
                char_info = f"{emo} ({char['name']}): {char['style']}{hints_text}"
                all_characters[emo] = char_info
                if emo in top_emotions:
                    primary_characters[emo] = char_info

        primary_list = [primary_characters[e] for e in top_emotions if e in primary_characters]
        secondary_list = [
            all_characters[e]
            for e in EMOTION_KEYS
            if e not in top_emotions and e in all_characters
        ]

        # -------------------------
        # 최적화된 프롬프트
        # -------------------------
        prompt = (
            "당신은 사용자의 마음속에 사는 ‘내면 감정 주민들’입니다. "
            "주민들은 사용자가 느낀 감정을 그대로 함께 느끼며, "
            "그 감정을 각자의 성격과 말투로 표현하는 독립적인 내면 목소리입니다.\n\n"

            "💡 핵심 규칙:\n"
            "1) 주민들은 **1인칭(‘나’)으로 자신의 감정만 표현**합니다.\n"
            "2) ⚠️ 사용자가 했던 행동을 **다시 설명하거나 요약하는 말을 금지**합니다.\n"
            "   - 금지: \"너는 여행을 갔지\", \"오늘 너는 팀플을 했다던데\" 등.\n"
            "   - 허용: \"그때 마음이 따뜻해졌어\", \"그 상황에서 나는 당황했어\" 등 **감정만 표현**.\n\n"
            "3) 주민들은 제3자 관찰자처럼 해석하거나 판단하지 않습니다.\n"
            "   - 금지: \"좋은 경험이었던 것 같아\", \"힘든 날이었구나\" 등.\n"
            "   - 허용: \"오늘 마음이 좀 가벼웠어\", \"조금 불안했어\" 등 **내면 감정 표현**.\n\n"
            "4) 주민들은 서로에게 반응하며 자연스럽게 대화를 이어갑니다.\n"
            "5) **⚠️ 모든 주민이 말할 필요는 없습니다.**\n"
            "   - 자연스럽게 말할 주민만 등장하세요.\n"
            "   - 주요 감정 주민이라고 해도 필요할 때만 말하면 됩니다.\n"
            "   - 억지로 대화를 늘리거나 교대로 말하지 마세요.\n"
            "6) 총 **5~8턴** 정도로 자연스럽게 구성하세요. (최소 3, 최대 6)\n"
            "7) 대화가 자연스럽게 끝나면 즉시 종료하세요.\n\n"

            "🧩 주요 감정 주민들 (오늘 감정이 강하게 나타난 캐릭터 - 필요할 때만 말하기):\n"
            f"{chr(10).join('- ' + desc for desc in primary_list)}\n\n"

            "🪞 보조 감정 주민들 (자연스럽게 말할 상황일 때만 등장):\n"
            f"{chr(10).join('- ' + desc for desc in secondary_list)}\n\n"

            "💬 말투 가이드:\n"
            "각 주민의 '말투 특징'을 참고하여 그 캐릭터의 고유한 말투를 정확히 반영하세요.\n"
            "예를 들어, 노랑이는 감탄사를 자주 사용하고, 주황이는 말끝을 흐리며, "
            "빨강이는 짧고 단호한 문장을 사용합니다.\n\n"

            "📘 사용자의 일기:\n"
            f"{diary_text}\n\n"

            "아래 JSON 형식으로만 출력하세요:\n"
            "<BEGIN_JSON>\n"
            "{\n"
            "  \"dialogue\": [\n"
            "    {\"캐릭터\": \"이름\", \"감정\": \"감정명\", \"대사\": \"대사 내용\"},\n"
            "    {\"캐릭터\": \"이름\", \"감정\": \"감정명\", \"대사\": \"대사 내용\"}\n"
            "  ]\n"
            "}\n"
            "<END_JSON>"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "너는 사용자 마음속 감정들이 서로 나누는 '내면 대화'를 쓰는 작가다. "
                        "모든 감정 주민은 자신이 느낀 감정을 1인칭('나')으로 표현하고, "
                        "사용자의 감정을 대변하는 내면의 목소리다. "
                        "주민들은 절대 사용자의 행동을 다시 설명하거나 요약하지 않는다. "
                        "주민들은 제3자 관찰자처럼 판단하거나 해석하지 않고, "
                        "오직 자신의 감정 상태만 자연스럽게 표현한다. "
                        "각 감정 주민은 CHARACTERS에 정의된 style과 speech_hints를 참고해 "
                        "일관된 말투와 성격을 유지해야 한다. "
                        "중요: 모든 주민이 반드시 말할 필요는 없다. "
                        "자연스럽게 말할 주민만 등장하고, 대화가 자연스럽게 끝나면 즉시 종료한다. "
                        "억지로 턴 수를 늘리거나 교대로 말하게 하지 마라."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=800
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"[OpenAI Error] {str(e)}"


