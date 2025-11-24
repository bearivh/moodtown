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
