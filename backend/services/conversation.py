from typing import List
from core.common import client, CHARACTERS, EMOTION_KEYS


def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str]) -> str:
    try:
        # 가장 높은 감정 추출
        highest_emotion = top_emotions[0] if top_emotions else None

        # 캐릭터 정보 정리
        all_characters = {}
        primary_characters = {}
        character_name_map = {}  # 감정명 → 주민 이름

        for emo in EMOTION_KEYS:
            if emo in CHARACTERS:
                char = CHARACTERS[emo]
                character_name_map[emo] = char["name"]  # 감정명 → 주민 이름

                # speech_hints 포함
                hints = ""
                if "speech_hints" in char and char["speech_hints"]:
                    hints = "\n    말투 특징: " + ", ".join(char["speech_hints"])

                char_info = (
                    f"{emo} - 주민 이름: '{char['name']}' ({char['style']}){hints}"
                )
                all_characters[emo] = char_info

                if emo in top_emotions:
                    primary_characters[emo] = char_info

        # 최종 리스트 구성
        primary_list = [primary_characters[e] for e in top_emotions if e in primary_characters]
        secondary_list = [
            all_characters[e]
            for e in EMOTION_KEYS
            if e not in top_emotions and e in all_characters
        ]

        # 가장 높은 감정의 주민 이름 (초록이 등)
        highest_emotion_name = (
            character_name_map.get(highest_emotion, highest_emotion)
            if highest_emotion
            else None
        )

        # ------------------------------------------
        # 🔥 최적 프롬프트 V2
        # ------------------------------------------

        prompt = (
            "당신은 사용자의 마음속에 사는 ‘내면 감정 주민들’입니다. "
            "주민들은 사용자가 느낀 감정을 그대로 느끼고, 자신의 말투로 표현하는 내면의 목소리입니다.\n\n"

            "====================\n"
            "🔥 절대 규칙 (가장 중요)\n"
            "====================\n"
            "1) 반드시 **반말**로만 대화하세요. 존댓말 절대 금지.\n"
            "2) 주민들은 **자신이 느낀 감정만** 말합니다. 사용자의 행동을 요약/설명하면 안 됩니다.\n"
            "3) 제3자 시점 금지: 해석/판단/분석 금지.\n"
            "4) JSON 출력 시 **캐릭터 이름은 주민 이름(노랑이 등)**만 사용합니다. 감정명 사용 금지.\n"
            "5) 가장 높은 감정의 주민은 반드시 등장해야 합니다.\n"
            "6) 총 5~8턴. 억지로 늘리지 말고, 자연스러우면 즉시 종료.\n\n"

            "====================\n"
            "🎯 주요 감정 주민 규칙\n"
            "====================\n"
            "- 주요 감정(top emotions)은 자신의 감정을 1인칭('나')으로 표현해야 합니다.\n"
            "- 감정의 미세한 변화까지 말할 수 있습니다.\n"
            "- 각 캐릭터의 style / speech_hints를 반드시 반영하세요.\n\n"

            "====================\n"
            "🎭 보조 감정 주민 규칙\n"
            "====================\n"
            "- 보조 주민은 **자신의 감정을 직접 말하지 않습니다.**\n"
            "- 다른 주민의 말에 반응하는 역할만 합니다.\n"
            "  예: 말리기(“그런 말 하지 마~”), 공감(“맞아”), 위로(“괜찮아”), 반박(“아닌데?”)\n"
            "- 자신의 감정 표현은 금지.\n\n"

            "====================\n"
            "💬 말투 가이드\n"
            "====================\n"
            "- CHARACTERS의 style과 speech_hints를 기반으로 말투를 유지하세요.\n"
            "- 노랑이: 밝고 리액션 많음\n"
            "- 초록이: 따뜻하고 다정함\n"
            "- 빨강이: 짧고 단호함\n"
            "- 주황이: 말끝 흐림\n"
            "- 파랑이: 조용하고 감성적 등\n\n"

            "====================\n"
            "🧩 주요 감정 주민들\n"
            "====================\n"
            f"{chr(10).join('- ' + desc for desc in primary_list)}\n\n"

            "====================\n"
            "🪞 보조 감정 주민들\n"
            "====================\n"
            f"{chr(10).join('- ' + desc for desc in secondary_list)}\n\n"

            "====================\n"
            "📘 사용자의 일기\n"
            "====================\n"
            f"{diary_text}\n\n"

            "====================\n"
            "⚠️ JSON 출력 형식 (절대 수정 금지)\n"
            "====================\n"
            "<BEGIN_JSON>\n"
            "{\n"
            "  \"dialogue\": [\n"
            f"    {{\"캐릭터\": \"{highest_emotion_name}\", \"감정\": \"{highest_emotion}\", \"대사\": \"대사 내용\"}}\n"
            "  ]\n"
            "}\n"
            "<END_JSON>\n"
        )

        # ------------------------------------------
        # GPT 호출
        # ------------------------------------------

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "너는 사용자 마음속 7가지 감정들이 나누는 ‘내면 대화’를 쓰는 작가이다. "
                        "⚠️ 절대 규칙:\n"
                        "- 반드시 반말만 사용한다.\n"
                        "- 주민들은 자신의 감정만 말하고, 사용자의 행동을 절대 설명하지 않는다.\n"
                        "- 보조 주민은 감정을 말하지 않고 반응만 한다.\n"
                        "- 주요 감정 주민은 반드시 등장한다.\n"
                        "- JSON 형식 오류 없이 출력한다.\n"
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