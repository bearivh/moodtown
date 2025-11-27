from typing import List, Dict
from core.common import client, CHARACTERS, EMOTION_KEYS


def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str], emotion_scores: Dict[str, int] = None) -> str:
    try:
        # emotion_scores가 없으면 기본값 사용 (호환성 유지)
        if emotion_scores is None:
            emotion_scores = {emo: 0 for emo in EMOTION_KEYS}
            for emotion in top_emotions:
                if emotion in EMOTION_KEYS:
                    emotion_scores[emotion] = 100 // len(top_emotions) if top_emotions else 0
        
        # 주요 감정 (score > 0): 자신의 감정을 주로 표현
        main_emotions = [emo for emo in EMOTION_KEYS if emotion_scores.get(emo, 0) > 0]
        # 반응 감정 (score = 0): 반응만 (위로, 동조, 반박 등)
        reactive_emotions = [emo for emo in EMOTION_KEYS if emotion_scores.get(emo, 0) == 0]
        
        # 주요 감정(반드시 참여) 주민 정보 수집
        participating_characters = []
        for emotion in main_emotions:
            if emotion in CHARACTERS:
                participating_characters.append({
                    "name": CHARACTERS[emotion]["name"],
                    "emotion": emotion,
                    "role": "main"
                })
        
        # 참여할 주민 목록 문자열 생성 (주요 감정만)
        main_characters_list = ", ".join([f"{char['name']}({char['emotion']})" for char in participating_characters])
        
        # 반응 감정 목록 (참고용, 선택적 참여)
        reactive_characters_list = ", ".join([f"{CHARACTERS[emo]['name']}({emo})" for emo in reactive_emotions if emo in CHARACTERS])
        
        # 주요 감정의 감정별 특성 정보 (반드시 참여)
        main_character_descriptions = []
        for emotion in main_emotions:
            if emotion in CHARACTERS:
                char_info = CHARACTERS[emotion]
                name = char_info["name"]
                style = char_info.get("style", "")
                speech_hints = ", ".join(char_info.get("speech_hints", []))
                main_character_descriptions.append(
                    f"- {name}({emotion}) [⭐ 자신의 감정을 주로 표현]: {style}\n"
                    f"  말투 특징: {speech_hints}"
                )
        
        # 반응 감정의 감정별 특성 정보 (참고용, 선택적 참여)
        reactive_character_descriptions = []
        for emotion in reactive_emotions:
            if emotion in CHARACTERS:
                char_info = CHARACTERS[emotion]
                name = char_info["name"]
                style = char_info.get("style", "")
                speech_hints = ", ".join(char_info.get("speech_hints", []))
                reactive_character_descriptions.append(
                    f"- {name}({emotion}) [💬 반응만 (위로/동조/반박), 선택적 참여]: {style}\n"
                    f"  말투 특징: {speech_hints}"
                )
        
        main_character_roles_text = "\n".join(main_character_descriptions) if main_character_descriptions else "(없음)"
        reactive_character_roles_text = "\n".join(reactive_character_descriptions) if reactive_character_descriptions else "(없음)"
        
        # 가장 높은 감정 추출 (예시에 사용)
        highest_emotion = main_emotions[0] if main_emotions else (top_emotions[0] if top_emotions else None)
        highest_emotion_name = None
        if highest_emotion and highest_emotion in CHARACTERS:
            highest_emotion_name = CHARACTERS[highest_emotion]["name"]

        prompt = (
            "당신은 사용자의 마음속 감정들이 서로 나누는 '내면 대화'를 생성하는 모델입니다.\n\n"
            "🔥 핵심 규칙\n\n"
            "1) 모든 대사는 반말로만 말합니다.\n"
            "2) 주민들은 **절대 사용자를 언급하지 않습니다.** 사용자에게 말하는 것이 아닙니다.\n"
            "3) 주민들은 주민들끼리만 대화하고 서로에게 반응합니다 (동의/반박/위로/격려).\n"
            "4) 총 5~8개의 대사.\n"
            "5) JSON 형식만 출력.\n"
            "6) 캐릭터 이름은 반드시 주민 이름(노랑이, 빨강이, 주황이, 보라, 파랑이, 초록이, 남색이)만 사용.\n"
            "7) 감정 주민들은 개별 인격이 아니라 '사용자의 감정 자체'입니다. 한 사람의 마음에 사는 감정들임을 잊지 마세요.\n"
            "8) 각 주민은 \"나도 예전에 그런 적 있어\", \"전에 겪어봤지\", \"옛날에\" 등의 표현을 해서는 안 됩니다.\n\n"
            "9) 사용자의 일기에 있는 내용은 주민들이 직접 겪은 일입니다.\n\n"
            f"⭐ 주요 감정 (반드시 참여, 자신의 감정을 주로 표현): {main_characters_list if main_characters_list else '(없음)'}\n\n"
            f"💬 반응 감정 (선택적 참여, 필요할 때만 자연스럽게 참여): {reactive_characters_list if reactive_characters_list else '(없음)'}\n\n"
            "🧩 각 주민의 감정별 역할과 말투\n\n"
            "**[반드시 참여할 주민]**\n"
            f"{main_character_roles_text}\n\n"
            "**[선택적으로 참여할 수 있는 주민 (참고용)]**\n"
            f"{reactive_character_roles_text}\n\n"
            "📌 역할 규칙 (중요!)\n\n"
            "- **⭐ 주요 감정 (반드시 참여, 자신의 감정을 주로 표현):**\n"
            "  * 이 주민들은 반드시 대화에 참여해야 합니다.\n"
            "  * 자신의 감정을 1인칭('나')으로 구체적으로 표현합니다.\n"
            "  * 안 좋은 예: \"정말 행복했겠네\"\n"
            "  * 좋은 예: \"정말 행복했어!\"\n"
            "  * 제 3자적 설명·분석·요약 금지입니다.\n" 
            "  * 자신이 맡은 감정에 충실하게 말해야 합니다.\n"
            "- **💬 반응 감정 (선택적 참여, 필요할 때만 자연스럽게):**\n"
            "  * 이 주민들은 대화에 참여할 필요가 없습니다. 필요할 때만 자연스럽게 참여하세요.\n"
            "  * 참여할 경우, 자신의 감정을 표현하지 않고 주요 감정들에게만 반응합니다 (위로, 동조, 반박, 격려 등).\n"
            "  * 억지로 참여시키지 마세요. 대화 흐름상 자연스러울 때만 참여하도록 하세요.\n"
            "  * 예: \"그런 생각도 들 수 있겠네\", \"나도 그렇게 느꼈어\", \"하지만 이렇게 생각해볼 수도 있어\"\n"
            "  * 자신의 감정 특성(말투, 스타일)은 유지하되, 자신의 감정을 직접 언급하지 않습니다.\n"
            "- 주민들은 서로에게 반응하며 (공감/걱정/놀람/말리기 등) 자연스럽게 대화를 이어갑니다.\n"
            "- **각 주민은 자신의 감정 특성에 맞지 않는 말을 하면 안 됩니다.** 예를 들어, 노랑이(기쁨)가 부정적인 말을 하거나, 파랑이(슬픔)가 밝고 경쾌하게 말하는 것은 안 됩니다.\n\n"
            "📝 대화 예시\n"
            "일기: 친구가 무례한 행동을 해서 화가 났다.\n"
            "주요 감정 (반드시 참여): 빨강이(분노 50%), 파랑이(슬픔 30%)\n"
            "반응 감정 (선택적 참여): 노랑이(기쁨 0%), 초록이(사랑 0%)\n"
            "대화:\n"
            "- 빨강이(분노): \"으휴! 그 상황에서 너무 짜증났어! 왜 이렇게 무례한 거야?\" (자신의 감정 표현)\n"
            "- 파랑이(슬픔): \"그래도 나를 너무 막 대하는 것 같아... 마음이 무겁네.\" (자신의 감정 표현)\n"
            "- 초록이(사랑): \"그 친구도 나쁜 의도는 아니었을 거야.\" (선택적 참여, 반응만, 위로)\n"
            "※ 참고: 노랑이(기쁨)는 자연스럽지 않아서 참여하지 않았음\n"
            "⚠️ 주의: 주요 감정은 반드시 참여하고 자신의 감정을 표현합니다. 반응 감정은 필요할 때만 자연스럽게 참여하며, 억지로 참여시키지 마세요!\n\n"
            "📘 일기:\n\n"
            f"{diary_text}\n\n"
            "<BEGIN_JSON>\n"
            "{\n"
            "  \"dialogue\": [\n"
            f"    {{\"캐릭터\": \"{highest_emotion_name}\", \"감정\": \"{highest_emotion}\", \"대사\": \"내용\"}},\n"
            "    {\"캐릭터\": \"주민 이름\", \"감정\": \"감정명\", \"대사\": \"내용\"},\n"
            "    ... (주요 감정은 반드시 포함, 반응 감정은 자연스러울 때만 포함)\n"
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