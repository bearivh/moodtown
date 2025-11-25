// 스트레스 우물 관련 유틸리티 함수들

// Vite 프록시를 통해 같은 origin에서 실행되므로 상대 경로 사용
const API_BASE_URL = ''

// 우물 최대 용량 (넘침 임계값)
export const WELL_MAX_CAPACITY = 500

/**
 * 우물 상태 가져오기
 * @returns {Promise<Object>} { waterLevel: number, isOverflowing: boolean, lastOverflowDate: string }
 */
export async function getWellState() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/well/state`)
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const state = await response.json()
    return {
      waterLevel: state.waterLevel || state.water_level || 0,
      isOverflowing: state.isOverflowing || state.is_overflowing === 1 || false,
      lastOverflowDate: state.lastOverflowDate || state.last_overflow_date || null
    }
  } catch (error) {
    console.error('우물 상태 불러오기 실패:', error)
    // 기본값
    return {
      waterLevel: 0,
      isOverflowing: false,
      lastOverflowDate: null
    }
  }
}

/**
 * 우물 상태 저장
 * @param {Object} state - 우물 상태
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function saveWellState(state) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/well/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        waterLevel: state.waterLevel || 0,
        isOverflowing: state.isOverflowing || false,
        lastOverflowDate: state.lastOverflowDate || null
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('우물 상태 저장 실패:', error)
    return false
  }
}

/**
 * 물 높이 비율 계산 (0~100)
 * @param {number} waterLevel - 현재 물 높이
 * @returns {number} 물 높이 비율 (0~100)
 */
export function getWaterLevelPercent(waterLevel) {
  const percent = (waterLevel / WELL_MAX_CAPACITY) * 100
  return Math.min(100, Math.max(0, percent))
}

/**
 * 부정적인 감정만 있는지 확인 (보너스 점수 조건)
 * @param {Object} emotionScores - 감정 점수 객체
 * @param {Object} emotionPolarity - 감정 극성 정보 (선택적)
 * @returns {boolean} 부정적인 감정만 있는 경우 true
 */
function isOnlyNegativeEmotions(emotionScores, emotionPolarity = {}) {
  if (!emotionScores) return false
  
  const joy = emotionScores['기쁨'] || 0
  const love = emotionScores['사랑'] || 0
  const anger = emotionScores['분노'] || 0
  const sadness = emotionScores['슬픔'] || 0
  const fear = emotionScores['두려움'] || 0
  const surprise = emotionScores['놀람'] || 0
  const shame = emotionScores['부끄러움'] || 0
  
  // 항상 긍정 감정 (기쁨, 사랑)이 있으면 안 됨 (0점이어야 함)
  if (joy > 0 || love > 0) {
    return false
  }
  
  // 부정 감정(분노, 슬픔, 두려움) 중 하나라도 있어야 함
  const negativeEmotionsSum = anger + sadness + fear
  if (negativeEmotionsSum === 0) {
    // 부정 감정이 없으면 놀람/부끄러움만으로는 보너스 불가
    return false
  }
  
  // 놀람과 부끄러움 처리
  const surprisePolarity = emotionPolarity['놀람']
  const shamePolarity = emotionPolarity['부끄러움']
  
  // 놀람이 있으면 부정으로 분류되어야 함 (없거나 null이면 허용하지 않음)
  if (surprise > 0) {
    if (surprisePolarity !== 'negative') {
      // 놀람이 있는데 부정이 아니면 보너스 없음
      return false
    }
  }
  
  // 부끄러움이 있으면 부정으로 분류되어야 함 (없거나 null이면 허용하지 않음)
  if (shame > 0) {
    if (shamePolarity !== 'negative') {
      // 부끄러움이 있는데 부정이 아니면 보너스 없음
      return false
    }
  }
  
  // 모든 조건 통과: 긍정 감정 없음, 부정 감정 있음, 놀람/부끄러움은 부정이거나 없음
  return true
}

/**
 * 부정적인 감정이 하나도 없는지 확인
 * @param {Object} emotionScores - 감정 점수 객체
 * @returns {boolean} 부정적인 감정이 하나도 없는 경우 true
 */
function hasNoNegativeEmotions(emotionScores) {
  if (!emotionScores) return false
  
  const anger = emotionScores['분노'] || 0
  const sadness = emotionScores['슬픔'] || 0
  const fear = emotionScores['두려움'] || 0
  
  // 부정적인 감정들의 합이 5 이하인 경우 (작은 오차 허용)
  const negativeEmotionsSum = anger + sadness + fear
  return negativeEmotionsSum <= 5
}

/**
 * 부정 감정 점수 추가 및 우물 업데이트
 * @param {number} negativeScore - 추가할 부정 감정 점수
 * @param {Object} emotionScores - 감정 점수 객체 (보너스 계산용)
 * @param {Object} emotionPolarity - 감정 극성 정보 (보너스 계산용, 선택적)
 * @returns {Promise<Object>} { waterLevel: number, isOverflowing: boolean, overflowed: boolean, bonusScore: number }
 */
export async function addNegativeEmotion(negativeScore, emotionScores = null, emotionPolarity = null) {
  const state = await getWellState()
  
  // 보너스 점수 계산 (부정적인 감정만 있는 경우)
  let bonusScore = 0
  if (emotionScores) {
    const polarity = emotionPolarity || {}
    const isOnlyNegative = isOnlyNegativeEmotions(emotionScores, polarity)
    
    // 디버깅 로그
    const joy = emotionScores['기쁨'] || 0
    const love = emotionScores['사랑'] || 0
    
    if (isOnlyNegative) {
      console.log('[우물 보너스] 부정 감정만 있음:', {
        emotionScores,
        emotionPolarity: polarity,
        negativeScore,
        bonusScore: Math.floor(negativeScore * 0.25)
      })
      // 기본 점수의 25% 보너스
      bonusScore = Math.floor(negativeScore * 0.25)
    } else {
      // 긍정 감정이 있으면 보너스 없음 (명시적으로 확인)
      if (joy > 0 || love > 0) {
        console.log('[우물 보너스 차단] 긍정 감정이 있어서 보너스 없음:', {
          emotionScores,
          joy,
          love,
          negativeScore
        })
        bonusScore = 0
      } else {
        console.log('[우물 보너스] 부정 감정만 아님:', {
          emotionScores,
          emotionPolarity: polarity,
          joy,
          love,
          anger: emotionScores['분노'] || 0,
          sadness: emotionScores['슬픔'] || 0,
          fear: emotionScores['두려움'] || 0,
          surprise: emotionScores['놀람'] || 0,
          shame: emotionScores['부끄러움'] || 0
        })
        bonusScore = 0
      }
    }
  }
  
  const totalScore = negativeScore + bonusScore
  let newWaterLevel = state.waterLevel + totalScore
  let isOverflowing = false
  let overflowed = false
  
  // 우물이 가득 찼는지 확인
  if (newWaterLevel >= WELL_MAX_CAPACITY) {
    isOverflowing = true
    overflowed = !state.isOverflowing // 이전에 넘치지 않았는데 지금 넘치면 true
    newWaterLevel = WELL_MAX_CAPACITY // 최대값으로 제한
  } else {
    // 물이 줄어들면 넘침 상태 해제
    isOverflowing = false
  }
  
  const newState = {
    waterLevel: newWaterLevel,
    isOverflowing: isOverflowing,
    lastOverflowDate: overflowed ? new Date().toISOString().split('T')[0] : state.lastOverflowDate
  }
  
  await saveWellState(newState)
  
  return {
    waterLevel: newWaterLevel,
    isOverflowing: isOverflowing,
    overflowed: overflowed,
    bonusScore: bonusScore
  }
}

/**
 * 우물 물 감소 (긍정 감정 또는 열매 열림으로 인한 감소)
 * @param {number} amount - 감소시킬 점수
 * @returns {Promise<Object>} { waterLevel: number, isOverflowing: boolean, reducedAmount: number }
 */
export async function reduceWaterLevel(amount) {
  const state = await getWellState()
  const oldWaterLevel = state.waterLevel
  let newWaterLevel = Math.max(0, state.waterLevel - amount)
  const actualReduced = oldWaterLevel - newWaterLevel  // 실제로 줄어든 양
  
  // 물이 줄어들면 넘침 상태 해제
  let isOverflowing = newWaterLevel >= WELL_MAX_CAPACITY
  
  const newState = {
    waterLevel: newWaterLevel,
    isOverflowing: isOverflowing,
    lastOverflowDate: state.lastOverflowDate
  }
  
  await saveWellState(newState)
  
  return {
    waterLevel: newWaterLevel,
    isOverflowing: isOverflowing,
    reducedAmount: actualReduced  // 실제로 줄어든 양 반환
  }
}

/**
 * 우물 상태 초기화 (테스트용 또는 리셋 기능)
 * @returns {Promise<Object>} 초기화된 상태
 */
export async function resetWell() {
  const newState = {
    waterLevel: 0,
    isOverflowing: false,
    lastOverflowDate: null
  }
  await saveWellState(newState)
  return newState
}
