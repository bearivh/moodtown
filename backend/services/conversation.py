from typing import List
from core.common import client, CHARACTERS, EMOTION_KEYS


def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str]) -> str:
    try:
        # 가장 높은 감정 추출
        highest_emotion = top_emotions[0] if top_emotions else None

        # 가장 높은 감정의 주민 이름
        highest_emotion_name = None
        if highest_emotion and highest_emotion in CHARACTERS:
            highest_emotion_name = CHARACTERS[highest_emotion]["name"]

        prompt = (
            "당신은 사용자의 마음속 감정들이 서로 나누는 '내면 대화'를 생성하는 모델입니다.\n\n"
            "🔥 핵심 규칙\n\n"
            "1) 모든 대사는 반말로만 말합니다.\n"
            "2) 주민들은 **절대 사용자를 언급하지 않습니다.** 사용자에게 말하는 것이 아닙니다.\n"
            "3) 주민들은 **자신의 감정**을 1인칭('나')으로 표현하며, 제 3자적 설명·분석·요약 금지입니다.\n"
            "4) 주민들은 주민들끼리만 대화하고 서로에게 반응합니다 (동의/반박/위로/격려).\n"
            "5) 총 5~8개의 대사.\n"
            "6) JSON 형식만 출력.\n"
            "7) 캐릭터 이름은 반드시 주민 이름(노랑이, 빨강이, 주황이, 보라, 파랑이, 초록이, 남색이)만 사용.\n"
            "8) 감정 주민들은 개별 인격이 아니라 ‘사용자의 감정 자체’이며, 현재 느껴지는 감정만 표현합니다.\n"
            "9) 각 주민은 “나도 예전에 그런 적 있어”, “전에 겪어봤지”, “옛날에” 등의 표현을 해서는 안 됩니다.\n\n"
            "🧩 역할 규칙\n\n"
            "- 주요 감정(top emotions):\n"
            "  - 자기 감정을 1인칭(‘나’)으로 구체적으로 표현합니다.\n"
            "- 보조 감정:\n"
            "  - 감정을 직접 말하지 않고, 짧은 반응만 합니다.\n"
            "  - (공감/걱정/놀람/말리기 등)\n"
            "  - *감정 단어 사용 금지:* “속상해”, “걱정돼”, “기뻐” 등 금지.\n\n"
            "📝 대화 예시\n"
            "일기: 친구가 무례한 행동을 해서 화가 났다.\n"
            "대화:\n"
            "- 빨강이(분노): \"으휴! 그 상황에서 너무 짜증났어! 왜 이렇게 무례한 거야?\"\n"
            "- 노랑이(기쁨): \"그래도 너무 화내지는 말자. 기분만 더 안 좋아지잖아.\"\n"
            "- 파랑이(슬픔): \"그래도 나를 너무 막 대하는 것 같아서 속상해.\"\n\n"
            "📘 일기:\n\n"
            f"{diary_text}\n\n"
            "<BEGIN_JSON>\n"
            "{\n"
            "  \"dialogue\": [\n"
            f"    {{\"캐릭터\": \"{highest_emotion_name}\", \"감정\": \"{highest_emotion}\", \"대사\": \"내용\"}},\n"
            "    {\"캐릭터\": \"주민 이름\", \"감정\": null, \"대사\": \"반응\"},\n"
            "    {\"캐릭터\": \"주민 이름\", \"감정\": null, \"대사\": \"반응\"}\n"
            "  ]\n"
            "}\n"
            "<END_JSON>\n"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "너는 사용자의 마음속 감정들이 나누는 '내면 대화'를 쓰는 작가이다. "
                        "반말로만 대화하며, 주민들은 자신의 감정만 말하고 서로에게 반응한다."
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