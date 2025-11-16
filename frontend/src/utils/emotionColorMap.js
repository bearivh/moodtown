// 한글 감정명을 색상으로 매핑

export const EMOTION_COLOR_MAP = {
  '기쁨': '#eab308',      // 노랑
  '사랑': '#22c55e',       // 초록
  '놀람': '#a855f7',       // 보라
  '두려움': '#6366f1',     // 남색
  '분노': '#ef4444',       // 빨강
  '부끄러움': '#f97316',   // 주황
  '슬픔': '#3b82f6'        // 파랑
}

/**
 * 한글 감정명으로 색상 가져오기
 * @param {string} emotionName - 한글 감정명
 * @returns {string} 색상 코드
 */
export function getEmotionColorByName(emotionName) {
  return EMOTION_COLOR_MAP[emotionName] || '#9ca3af'
}

