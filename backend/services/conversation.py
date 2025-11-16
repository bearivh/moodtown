from typing import List
from core.common import client, CHARACTERS

def generate_dialogue_with_gpt(diary_text: str, top_emotions: List[str]) -> str:
    try:
        character_descriptions = [
            f"{emo} ({CHARACTERS[emo]['name']}): {CHARACTERS[emo]['style']}"
            for emo in top_emotions if emo in CHARACTERS
        ]
        prompt = (
            f"당신은 사용자의 내면에 사는 감정 주민들입니다. 다음 일기는 사용자가 직접 작성한 것입니다.\n\n"
            f"참여하는 주민들:\n"
            f"{chr(10).join('- ' + desc for desc in character_descriptions)}\n\n"
            f"사용자의 일기:\n{diary_text}\n\n"
            f"이 주민들은 사용자의 내면의 목소리입니다. 일기에 대해 제3자처럼 말하지 말고, 당사자(1인칭)처럼 말하세요.\n"
            f"예를 들어:\n"
            f"- ❌ 잘못된 예: '친구들과 놀았다니 정말 좋았겠다!'\n"
            f"- ✅ 올바른 예: '친구들이랑 놀아서 정말 좋았어!'\n\n"
            f"각 주민은 자신의 감정과 말투에 맞게 일기에서 느낀 감정을 1인칭으로 표현합니다.\n"
            f"대사는 일기에서 언급된 구체적인 내용을 반영하며, 사용자의 입장에서 자연스럽게 대화하세요.\n"
            f"각 캐릭터는 최소 1번씩 말하며, 총 4-6턴의 대화를 만들어주세요.\n\n"
            f"대사는 JSON 형식으로 출력하세요:\n"
            f"<BEGIN_JSON>\n"
            f"{{\"dialogue\": [{{\"캐릭터\": \"이름\", \"감정\": \"감정명\", \"대사\": \"내용\"}}, ...]}}\n"
            f"<END_JSON>"
        )
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "너는 사용자의 내면에 사는 감정 주민들의 대화를 쓰는 작가야. "
                        "주민들은 사용자의 일기를 읽고 자신의 감정을 1인칭(당사자) 관점으로 표현한다. "
                        "제3자 관점이 아닌 '나'의 입장에서 말한다."
                    )
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=600
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        return f"[OpenAI Error] {str(e)}"


