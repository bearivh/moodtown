// 감정 관련 유틸리티 함수들

export const EMOTIONS = {
  ANGER: 'anger',
  SHAME: 'shame',
  JOY: 'joy',
  LOVE: 'love',
  SADNESS: 'sadness',
  FEAR: 'fear',
  SURPRISE: 'surprise'
}

export const EMOTION_COLORS = {
  [EMOTIONS.ANGER]: '#ef4444',      // 빨강
  [EMOTIONS.SHAME]: '#f97316',      // 주황
  [EMOTIONS.JOY]: '#eab308',        // 노랑
  [EMOTIONS.LOVE]: '#22c55e',       // 초록
  [EMOTIONS.SADNESS]: '#3b82f6',    // 파랑
  [EMOTIONS.FEAR]: '#6366f1',       // 남색
  [EMOTIONS.SURPRISE]: '#a855f7'    // 보라
}

export const EMOTION_NAMES = {
  [EMOTIONS.ANGER]: '분노',
  [EMOTIONS.SHAME]: '부끄러움',
  [EMOTIONS.JOY]: '기쁨',
  [EMOTIONS.LOVE]: '사랑',
  [EMOTIONS.SADNESS]: '슬픔',
  [EMOTIONS.FEAR]: '두려움',
  [EMOTIONS.SURPRISE]: '놀람'
}

/**
 * 감정에 해당하는 색상 반환
 * @param {string} emotion - 감정 타입
 * @returns {string} 색상 코드
 */
export function getEmotionColor(emotion) {
  return EMOTION_COLORS[emotion] || EMOTION_COLORS[EMOTIONS.JOY]
}

/**
 * 감정 이름 반환
 * @param {string} emotion - 감정 타입
 * @returns {string} 감정 이름
 */
export function getEmotionName(emotion) {
  return EMOTION_NAMES[emotion] || '알 수 없음'
}

/**
 * 감정이 긍정적인지 판단
 * @param {string} emotion - 감정 타입
 * @returns {boolean}
 */
export function isPositiveEmotion(emotion) {
  return emotion === EMOTIONS.JOY || emotion === EMOTIONS.LOVE
}

/**
 * 감정이 부정적인지 판단
 * @param {string} emotion - 감정 타입
 * @returns {boolean}
 */
export function isNegativeEmotion(emotion) {
  return emotion === EMOTIONS.ANGER || 
         emotion === EMOTIONS.SADNESS || 
         emotion === EMOTIONS.FEAR ||
         emotion === EMOTIONS.SHAME
}

