import { getEmotionColorByName, EMOTION_COLOR_MAP } from './emotionColorMap'

/**
 * 감정 점수를 퍼센트로 정규화하는 공통 함수
 * @param {Object} emotionScores - 감정 점수 객체
 * @returns {Object} 정규화된 감정 점수 객체 (합이 100이 되도록)
 */
export function normalizeEmotionScores(emotionScores) {
  if (!emotionScores || typeof emotionScores !== 'object') {
    return {}
  }

  // 모든 값을 숫자로 변환
  const scores = {}
  for (const [emotion, value] of Object.entries(emotionScores)) {
    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
    // 이미 0~100 범위인 경우 그대로 사용, 0~1 범위인 경우 100 곱하기
    if (numValue >= 0 && numValue <= 1) {
      scores[emotion] = numValue * 100
    } else if (numValue >= 0 && numValue <= 100) {
      scores[emotion] = numValue
    } else {
      scores[emotion] = 0
    }
  }

  // 합 계산
  const total = Object.values(scores).reduce((sum, val) => sum + val, 0)

  // 합이 0이면 균등 분포
  if (total === 0) {
    const count = Object.keys(scores).length || 7
    const equalValue = 100 / count
    return Object.fromEntries(Object.keys(scores).map(k => [k, equalValue]))
  }

  // 정규화 (합이 100이 되도록)
  const normalized = {}
  let normalizedTotal = 0
  for (const [emotion, value] of Object.entries(scores)) {
    const normalizedValue = Math.round((value / total) * 100)
    normalized[emotion] = normalizedValue
    normalizedTotal += normalizedValue
  }

  // 반올림 오차 보정 (합이 정확히 100이 되도록)
  const diff = 100 - normalizedTotal
  if (diff !== 0) {
    // 가장 큰 값에 차이를 더하거나 빼기
    const entries = Object.entries(normalized).sort((a, b) => b[1] - a[1])
    if (entries.length > 0) {
      entries[0][1] += diff
      normalized[entries[0][0]] = entries[0][1]
    }
  }

  return normalized
}

/**
 * 감정 점수를 퍼센트 문자열로 포맷팅
 * @param {number} score - 감정 점수
 * @returns {string} 퍼센트 문자열 (예: "25%")
 */
export function formatEmotionScore(score) {
  if (typeof score !== 'number' || isNaN(score)) {
    return '0%'
  }
  // 이미 0~100 범위인 경우
  if (score >= 0 && score <= 100) {
    return `${Math.round(score)}%`
  }
  // 0~1 범위인 경우
  if (score > 0 && score <= 1) {
    return `${Math.round(score * 100)}%`
  }
  return '0%'
}

/**
 * 영문 감정명을 한글로 변환하는 매핑
 */
const EMOTION_NAME_MAP = {
  // 영문 → 한글
  'joy': '기쁨',
  'happiness': '기쁨',
  'love': '사랑',
  'surprise': '놀람',
  'fear': '두려움',
  'anger': '분노',
  'angry': '분노',
  'shame': '부끄러움',
  'shy': '부끄러움',
  'sadness': '슬픔',
  'sad': '슬픔',
  // 한글은 그대로
  '기쁨': '기쁨',
  '사랑': '사랑',
  '놀람': '놀람',
  '두려움': '두려움',
  '분노': '분노',
  '부끄러움': '부끄러움',
  '슬픔': '슬픔'
}

/**
 * 감정명(영문 또는 한글)을 한글로 변환
 * @param {string} emotion - 감정명 (영문 또는 한글)
 * @returns {string} 한글 감정명
 */
export function getEmotionName(emotion) {
  if (!emotion) return '기쁨'
  
  const normalized = typeof emotion === 'string' ? emotion.toLowerCase().trim() : ''
  return EMOTION_NAME_MAP[normalized] || EMOTION_NAME_MAP[emotion] || emotion || '기쁨'
}

/**
 * 감정명으로 색상 가져오기 (영문/한글 모두 지원)
 * @param {string} emotion - 감정명 (영문 또는 한글)
 * @returns {string} 색상 코드
 */
export function getEmotionColor(emotion) {
  if (!emotion) return '#9ca3af'
  
  // 한글로 변환
  const koreanName = getEmotionName(emotion)
  
  // 색상 반환
  return getEmotionColorByName(koreanName)
}

/**
 * 감정 점수를 맥락 기반으로 긍정/부정 분류 (emotion_polarity 활용)
 * @param {Object} emotionScores - 감정 점수 객체
 * @param {Object} emotionPolarity - 감정 극성 정보 { "놀람": "positive", "부끄러움": "negative" }
 * @returns {Object} { positive: number, negative: number }
 */
export function classifyEmotionsWithContext(emotionScores, emotionPolarity = {}) {
  const scores = emotionScores || {}
  const polarity = emotionPolarity || {}
  
  // 기본 긍정/부정 감정
  let positive = (scores['기쁨'] || 0) + (scores['사랑'] || 0)
  let negative = (scores['분노'] || 0) + (scores['슬픔'] || 0) + (scores['두려움'] || 0)
  
  // 놀람: 맥락 기반 분류
  const surprise = scores['놀람'] || 0
  if (surprise > 0) {
    const surprisePolarity = polarity['놀람']
    if (surprisePolarity === 'positive') {
      positive += surprise
      console.log('[감정 분류] 놀람을 긍정으로 분류:', surprise, '점을 긍정에 추가')
    } else if (surprisePolarity === 'negative') {
      negative += surprise
      console.log('[감정 분류] 놀람을 부정으로 분류:', surprise, '점을 부정에 추가')
    } else {
      console.log('[감정 분류] 놀람의 극성이 없어서 제외:', surprise, '점 (극성:', surprisePolarity, ')')
    }
  }
  
  // 부끄러움: 맥락 기반 분류
  const shame = scores['부끄러움'] || 0
  if (shame > 0) {
    const shamePolarity = polarity['부끄러움']
    if (shamePolarity === 'positive') {
      positive += shame
      console.log('[감정 분류] 부끄러움을 긍정으로 분류:', shame, '점을 긍정에 추가')
    } else if (shamePolarity === 'negative') {
      negative += shame
      console.log('[감정 분류] 부끄러움을 부정으로 분류:', shame, '점을 부정에 추가')
    } else {
      console.log('[감정 분류] 부끄러움의 극성이 없어서 제외:', shame, '점 (극성:', shamePolarity, ')')
    }
  }
  
  return { positive, negative }
}
