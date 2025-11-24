from typing import List
from core.common import client, CHARACTERS, EMOTION_KEYS

def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str]) -> str:
    try:
        # 캐릭터 정보 정리
        all_characters = {}
        primary_characters = {}

        for emo in EMOTION_KEYS:
            if emo in CHARACTERS:
                char_info = f"{emo} ({CHARACTERS[emo]['name']}): {CHARACTERS[emo]['style']}"
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
            "2) 사용자의 행동을 설명하는 **3인칭 서술 금지**.\n"
            "   - 금지: \"너는 여행을 갔지.\"\n"
            "   - 허용: \"가족들과 시간을 보냈을 때 내 마음이 따뜻해졌어.\"\n"
            "3) 주민들은 제3자 관찰자처럼 말하지 않습니다.\n"
            "   - 금지: \"좋은 경험을 한 것 같아.\"\n"
            "   - 허용: \"오늘 마음이 편안했어.\"\n"
            "4) 주민들은 서로에게 반응하며 대화를 이어갑니다.\n"
            "5) 주요 감정 주민들은 더 적극적으로 말합니다.\n"
            "6) 총 **5~8턴**, JSON 배열에 **5개 이상 객체**를 반드시 포함해야 합니다.\n\n"

            "🧩 주요 감정 주민들 (오늘 감정이 강하게 나타난 캐릭터):\n"
            f"{chr(10).join('- ' + desc for desc in primary_list)}\n\n"

            "🪞 보조 감정 주민들 (반응하거나 균형 잡기 역할):\n"
            f"{chr(10).join('- ' + desc for desc in secondary_list)}\n\n"

            "📘 사용자의 일기:\n"
            f"{diary_text}\n\n"

            "아래 JSON 형식으로만 출력하세요:\n"
            "<BEGIN_JSON>\n"
            "{\n"
            "  \"dialogue\": [\n"
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
                        "모든 감정 주민은 자신이 느낀 감정을 1인칭으로 말하고, "
                        "사용자의 감정을 대변하며, 캐릭터 고유의 말투를 유지해야 한다."
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


