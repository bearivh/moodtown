// 한글 감정명을 색상으로 매핑

export const EMOTION_COLOR_MAP = {
  '기쁨': '#fef08a',      // 연한 노랑 (파스텔)
  '사랑': '#86efac',       // 연한 초록 (파스텔)
  '놀람': '#c4b5fd',       // 연한 보라 (파스텔)
  '두려움': '#a5b4fc',     // 연한 인디고 (파스텔)
  '분노': '#fca5a5',       // 연한 빨강 (파스텔)
  '부끄러움': '#fdba74',   // 연한 주황 (파스텔)
  '슬픔': '#93c5fd'        // 연한 파랑 (파스텔)
}

/**
 * 한글 감정명으로 색상 가져오기
 * @param {string} emotionName - 한글 감정명
 * @returns {string} 색상 코드
 */
export function getEmotionColorByName(emotionName) {
  return EMOTION_COLOR_MAP[emotionName] || '#9ca3af'
}

