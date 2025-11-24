"""
편지 생성 서비스 - GPT를 사용하여 편지 내용 생성
"""
from typing import Dict, Any, List
from core.common import client, CHARACTERS, EMOTION_KEYS

def generate_letter_with_gpt(
    letter_type: str,
    emotion_scores: Dict[str, int] = None,
    fruit_count: int = None,
    diary_text: str = None
) -> Dict[str, str]:
    """
    GPT를 사용하여 편지 생성
    
    Args:
        letter_type: 편지 타입 ('celebration', 'comfort', 'cheer', 'well_overflow')
        emotion_scores: 감정 점수 딕셔너리
        fruit_count: 행복 열매 개수 (celebration 타입일 때)
        diary_text: 일기 내용 (선택적)
    
    Returns:
        {'title': str, 'content': str, 'from': str}
    """
    
    # 캐릭터 정보 정리
    character_info = {}
    for emo in EMOTION_KEYS:
        if emo in CHARACTERS:
            char = CHARACTERS[emo]
            hints_text = ""
            if 'speech_hints' in char and char['speech_hints']:
                hints_text = "\n    말투 특징: " + ", ".join(char['speech_hints'])
            character_info[emo] = f"{emo} ({char['name']}): {char['style']}{hints_text}"
    
    if letter_type == 'celebration':
        # 행복 열매 축하 편지
        prompt = f"""당신은 감정 마을의 주민들입니다. 사용자가 행복 나무에서 {fruit_count}번째 행복 열매를 얻었습니다.

주민 정보:
{character_info.get('기쁨', '')}
{character_info.get('사랑', '')}

다음 규칙을 따라 축하 편지를 작성해주세요:
1. 노랑이(기쁨)와 초록이(사랑)의 말투를 사용하여 축하 메시지를 작성하세요.
2. 반말로 편하게 작성하세요.
3. 따뜻하고 기쁜 마음이 전해지는 내용으로 작성하세요.
4. 2-3문단 정도의 적당한 길이로 작성하세요.

다음 형식으로 출력하세요:
<BEGIN_JSON>
{{
  "title": "편지 제목 (이모지 포함)",
  "content": "편지 내용",
  "from": "보낸이 이름 (예: 노랑이 & 초록이)"
}}
<END_JSON>
"""
    
    elif letter_type == 'well_overflow':
        # 우물 넘침 위로 편지
        # 부정 감정이 높은 순서로 정렬
        negative_emotions = [
            {'name': '슬픔', 'score': emotion_scores.get('슬픔', 0), 'char': '파랑이'},
            {'name': '분노', 'score': emotion_scores.get('분노', 0), 'char': '빨강이'},
            {'name': '두려움', 'score': emotion_scores.get('두려움', 0), 'char': '남색이'},
            {'name': '부끄러움', 'score': emotion_scores.get('부끄러움', 0), 'char': '주황이'}
        ]
        negative_emotions = [e for e in negative_emotions if e['score'] > 0]
        negative_emotions.sort(key=lambda x: x['score'], reverse=True)
        
        top_emotions = negative_emotions[:3]
        
        if not top_emotions:
            # 부정 감정이 없으면 기본 위로
            top_emotions = [{'name': '슬픔', 'char': '파랑이'}]
        
        char_list = [e['char'] for e in top_emotions] + ['노랑이', '초록이']
        char_info_text = "\n".join([character_info.get(emo['name'], '') for emo in top_emotions if emo['name'] in character_info])
        char_info_text += f"\n{character_info.get('기쁨', '')}\n{character_info.get('사랑', '')}"
        
        emotion_desc = ", ".join([f"{e['name']}({e['score']}점)" for e in top_emotions])
        
        diary_context = ""
        if diary_text and diary_text.strip():
            diary_context = f"\n\n사용자의 일기 내용 (참고용):\n--- 일기 시작 ---\n{diary_text[:500]}\n--- 일기 끝 ---\n"
        
        prompt = f"""당신은 감정 마을의 주민들입니다. 사용자의 스트레스 우물이 넘쳤고, 다음 부정 감정들이 높았습니다: {emotion_desc}{diary_context}

주민 정보:
{char_info_text}

다음 규칙을 따라 위로 편지를 작성해주세요:
1. 부정 감정 주민들({', '.join([e['char'] for e in top_emotions])})이 각자의 말투로 위로 메시지를 작성하세요.
2. 노랑이(기쁨)와 초록이(사랑)도 따뜻한 응원 메시지를 추가하세요.
3. 반말로 편하게 작성하세요.
4. 각 주민의 말투 특징을 정확히 반영하세요.
5. 3-4문단 정도의 적당한 길이로 작성하세요.
6. 주민들의 메시지는 자연스럽게 이어지도록 작성하세요.
7. ⚠️ 일기 내용을 직접 언급하거나 요약하지 마세요. 감정에 집중하여 위로 메시지를 작성하세요.

다음 형식으로 출력하세요:
<BEGIN_JSON>
{{
  "title": "편지 제목 (이모지 포함)",
  "content": "편지 내용 (주민들의 메시지를 자연스럽게 이어서 작성)",
  "from": "보낸이 이름 (예: 파랑이, 빨강이, 노랑이, 초록이)"
}}
<END_JSON>
"""
    
    elif letter_type == 'comfort':
        # 부정 감정만 있을 때 위로 편지
        diary_context = ""
        if diary_text and diary_text.strip():
            diary_context = f"\n\n사용자의 일기 내용 (참고용):\n--- 일기 시작 ---\n{diary_text[:500]}\n--- 일기 끝 ---\n"
        
        prompt = f"""당신은 감정 마을의 주민들입니다. 사용자의 일기에는 부정적인 감정들만 가득했습니다.{diary_context}

주민 정보:
{character_info.get('기쁨', '')}
{character_info.get('사랑', '')}

다음 규칙을 따라 위로 편지를 작성해주세요:
1. 노랑이(기쁨)의 말투를 사용하여 위로 메시지를 작성하세요.
2. 반말로 편하게 작성하세요.
3. 따뜻하고 희망적인 내용으로 작성하세요.
4. 2-3문단 정도의 적당한 길이로 작성하세요.
5. ⚠️ 일기 내용을 직접 언급하거나 요약하지 마세요. 감정에 집중하여 위로 메시지를 작성하세요.

다음 형식으로 출력하세요:
<BEGIN_JSON>
{{
  "title": "편지 제목 (이모지 포함)",
  "content": "편지 내용",
  "from": "보낸이 이름 (예: 노랑이)"
}}
<END_JSON>
"""
    
    elif letter_type == 'cheer':
        # 긍정 감정만 있을 때 응원 편지
        diary_context = ""
        if diary_text and diary_text.strip():
            diary_context = f"\n\n사용자의 일기 내용 (참고용):\n--- 일기 시작 ---\n{diary_text[:500]}\n--- 일기 끝 ---\n"
        
        prompt = f"""당신은 감정 마을의 주민들입니다. 사용자의 일기에는 긍정적인 감정들만 가득했습니다.{diary_context}

주민 정보:
{character_info.get('사랑', '')}

다음 규칙을 따라 응원 편지를 작성해주세요:
1. 초록이(사랑)의 말투를 사용하여 응원 메시지를 작성하세요.
2. 반말로 편하게 작성하세요.
3. 따뜻하고 기쁜 내용으로 작성하세요.
4. 2-3문단 정도의 적당한 길이로 작성하세요.
5. ⚠️ 일기 내용을 직접 언급하거나 요약하지 마세요. 감정에 집중하여 응원 메시지를 작성하세요.

다음 형식으로 출력하세요:
<BEGIN_JSON>
{{
  "title": "편지 제목 (이모지 포함)",
  "content": "편지 내용",
  "from": "보낸이 이름 (예: 초록이)"
}}
<END_JSON>
"""
    
    else:
        return {
            'title': '💌 주민들의 편지',
            'content': '안녕하세요! 주민들이 편지를 보냈어요.',
            'from': '감정 마을'
        }
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "당신은 감정 마을의 주민입니다. 사용자에게 따뜻하고 진심 어린 편지를 작성합니다. 반드시 JSON 형식으로만 출력하세요."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=500
        )
        
        reply = response.choices[0].message.content or ""
        
        # JSON 추출
        import re
        json_match = re.search(r"<BEGIN_JSON>([\s\S]*?)<END_JSON>", reply)
        if json_match:
            import json
            try:
                parsed = json.loads(json_match.group(1).strip())
                return {
                    'title': parsed.get('title', '💌 주민들의 편지'),
                    'content': parsed.get('content', '안녕하세요! 주민들이 편지를 보냈어요.'),
                    'from': parsed.get('from', '감정 마을')
                }
            except:
                pass
        
        # JSON 파싱 실패 시 기본값 반환
        return {
            'title': '💌 주민들의 편지',
            'content': '안녕하세요! 주민들이 편지를 보냈어요.',
            'from': '감정 마을'
        }
        
    except Exception as e:
        print(f"편지 생성 오류: {e}")
        # 오류 시 기본값 반환
        return {
            'title': '💌 주민들의 편지',
            'content': '안녕하세요! 주민들이 편지를 보냈어요.',
            'from': '감정 마을'
        }

