from typing import Dict, Any, Optional
from core.common import client, CHARACTERS


def generate_letter_with_gpt(
    letter_type: str,
    emotion_scores: Optional[Dict[str, Any]] = None,
    diary_text: str = "",
    fruit_count: Optional[int] = None
) -> Dict[str, str]:
    """
    GPT를 사용하여 편지 생성
    
    Args:
        letter_type: 'emotion_high', 'celebration', 'comfort', 'cheer', 'well_overflow'
        emotion_scores: 감정 점수 정보
        diary_text: 일기 내용
        fruit_count: 열매 개수
    
    Returns:
        {'title': str, 'content': str, 'from': str}
    """
    emotion_scores = emotion_scores or {}
    diary_text = diary_text or ""
    
    # 주민 이름 매핑 (감정명 -> 주민 이름)
    emotion_to_character = {}
    for emo_key, char_info in CHARACTERS.items():
        if 'name' in char_info:
            emotion_to_character[emo_key] = char_info['name']
    
    # 편지 타입별 프롬프트 생성
    if letter_type == 'emotion_high':
        emotion_name = emotion_scores.get('emotion_name', '')
        score = emotion_scores.get('score', 0)
        character_name = emotion_to_character.get(emotion_name, '주민')
        
        prompt = f"""당신은 감정 마을의 주민 '{character_name}'입니다. 
사용자의 일기에서 '{emotion_name}' 감정이 {score}점으로 매우 높게 나타났습니다.

다음 일기 내용을 읽고, 주민의 입장에서 따뜻하고 위로가 되는 편지를 작성해주세요.

일기 내용:
{diary_text[:500]}

편지 작성 규칙:
1. 주민의 특성과 말투를 반영하세요.
2. 반말로 작성하세요.
3. 감정을 인정하고 공감해주세요.
4. 격려와 위로의 메시지를 포함하세요.
5. 편지 제목과 내용을 JSON 형식으로 출력하세요.

출력 형식:
{{
  "title": "편지 제목",
  "content": "편지 내용",
  "from": "{character_name}"
}}"""
    
    elif letter_type == 'celebration':
        # 행복 열매 개수에 따른 표현
        if fruit_count and fruit_count > 0:
            if fruit_count == 1:
                fruit_mention = "첫 번째 행복 열매"
            elif fruit_count == 2:
                fruit_mention = "두 번째 행복 열매"
            elif fruit_count == 3:
                fruit_mention = "세 번째 행복 열매"
            elif fruit_count == 4:
                fruit_mention = "네 번째 행복 열매"
            elif fruit_count == 5:
                fruit_mention = "다섯 번째 행복 열매"
            else:
                fruit_mention = f"{fruit_count}번째 행복 열매"
            celebration_message = f"{fruit_mention}가 열렸어요!"
            example_mention = f"'{fruit_mention}가 열렸어! 축하해!'"
        else:
            celebration_message = "행복 열매가 열렸어요!"
            fruit_mention = "행복 열매"
            example_mention = "'행복 열매가 열렸어! 축하해!'"
        
        prompt = f"""감정 마을의 행복 나무에서 {celebration_message} 주민들이 사용자를 축하하는 편지를 작성해주세요.

일기 내용:
{diary_text[:500]}

편지 작성 규칙:
1. 긍정적이고 축하하는 톤으로 작성하세요.
2. 반말로 작성하세요.
3. 반드시 "{fruit_mention}"가 열렸다는 것을 편지 내용에 명시적으로 언급하세요.
   - 예시: {example_mention}
   - 행복 열매에 대한 언급이 편지 내용에 자연스럽게 포함되어야 합니다.
4. 사용자의 긍정적인 변화를 인정해 주세요.
5. 편지 제목과 내용을 JSON 형식으로 출력하세요.

출력 형식:
{{
  "title": "편지 제목",
  "content": "편지 내용",
  "from": "감정 마을"
}}"""
    
    elif letter_type == 'well_overflow':
        prompt = f"""감정 마을의 주민들이 사용자에게 위로의 편지를 작성해주세요.
스트레스 우물이 가득 차서 넘쳤다는 의미입니다.

일기 내용:
{diary_text[:500]}

편지 작성 규칙:
1. 따뜻하고 위로하는 톤으로 작성하세요.
2. 반말로 작성하세요.
3. 사용자의 감정을 인정하고 공감해주세요.
4. 희망적인 메시지를 포함하세요.
5. 편지 제목과 내용을 JSON 형식으로 출력하세요.

출력 형식:
{{
  "title": "편지 제목",
  "content": "편지 내용",
  "from": "감정 마을"
}}"""
    
    else:  # 'comfort', 'cheer' 등 기본 타입
        prompt = f"""감정 마을의 주민들이 사용자에게 편지를 작성해주세요.

일기 내용:
{diary_text[:500]}

편지 작성 규칙:
1. 따뜻하고 위로하는 톤으로 작성하세요.
2. 반말로 작성하세요.
3. 사용자의 감정을 인정하고 공감해주세요.
4. 격려의 메시지를 포함하세요.
5. 편지 제목과 내용을 JSON 형식으로 출력하세요.

출력 형식:
{{
  "title": "편지 제목",
  "content": "편지 내용",
  "from": "감정 마을"
}}"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 감정 마을의 주민입니다. 사용자에게 따뜻하고 진심어린 편지를 작성해주세요. 반드시 JSON 형식으로만 출력하세요."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.8,
            max_tokens=800
        )
        
        reply = response.choices[0].message.content or ""
        
        # JSON 추출
        import json
        import re
        
        # JSON 부분 추출
        json_match = re.search(r'\{[^{}]*\}', reply, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
            letter_data = json.loads(json_str)
            
            return {
                'title': letter_data.get('title', '💌 주민들의 편지'),
                'content': letter_data.get('content', ''),
                'from': letter_data.get('from', '감정 마을')
            }
        else:
            # JSON이 없으면 기본값 반환
            return {
                'title': '💌 주민들의 편지',
                'content': reply.strip(),
                'from': '감정 마을'
            }
            
    except Exception as e:
        print(f"[편지 생성 오류] {e}")
        # 오류 발생 시 기본 편지 반환
        return {
            'title': '💌 주민들의 편지',
            'content': '안녕하세요. 오늘 하루 고생 많으셨어요. 내일도 화이팅!',
            'from': '감정 마을'
        }
