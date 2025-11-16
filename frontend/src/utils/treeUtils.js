// 행복 나무 관련 유틸리티 함수들

const API_BASE_URL = 'http://127.0.0.1:5000'

// 나무 성장 단계 설정
export const TREE_STAGES = {
  SEED: 0,        // 씨앗
  SPROUT: 1,      // 새싹
  SEEDLING: 2,    // 묘목
  MEDIUM: 3,      // 중간 나무
  LARGE: 4,       // 큰 나무
  FRUIT: 5        // 열매 열림
}

// 각 단계별 필요한 긍정 감정 점수
export const TREE_STAGE_THRESHOLDS = {
  [TREE_STAGES.SEED]: 0,
  [TREE_STAGES.SPROUT]: 40,      // 40점 이상: 새싹
  [TREE_STAGES.SEEDLING]: 100,   // 100점 이상: 묘목
  [TREE_STAGES.MEDIUM]: 220,     // 220점 이상: 중간 나무
  [TREE_STAGES.LARGE]: 380,      // 380점 이상: 큰 나무
  [TREE_STAGES.FRUIT]: 600       // 600점 이상: 열매 열림
}

/**
 * 나무 상태 가져오기
 * @returns {Promise<Object>} { growth: number, stage: number, lastFruitDate: string }
 */
export async function getTreeState() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tree/state`)
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const state = await response.json()
    
    // growth를 숫자로 변환
    const growth = typeof state.growth === 'number' ? state.growth : (parseInt(state.growth, 10) || 0)
    
    // 성장도에 맞는 단계 계산 (백엔드에서도 계산하지만, 프론트엔드에서도 검증)
    let calculatedStage = TREE_STAGES.SEED
    for (let stage = TREE_STAGES.FRUIT; stage >= TREE_STAGES.SEED; stage--) {
      if (growth >= TREE_STAGE_THRESHOLDS[stage]) {
        calculatedStage = stage
        break
      }
    }
    
    // stage를 숫자로 변환
    let stage = calculatedStage
    if (typeof state.stage === 'number') {
      // 저장된 단계와 계산된 단계가 다르면 계산된 단계 사용
      if (state.stage !== calculatedStage) {
        console.warn(`단계 불일치 감지: 저장된 단계=${state.stage}, 계산된 단계=${calculatedStage}, 성장도=${growth}`)
        stage = calculatedStage
      } else {
        stage = state.stage
      }
    } else if (typeof state.stage === 'string') {
      // 문자열이면 계산된 단계 사용
      stage = calculatedStage
    }
    
    return {
      growth: growth,
      stage: stage,
      lastFruitDate: state.lastFruitDate || state.last_fruit_date || null
    }
  } catch (error) {
    console.error('나무 상태 불러오기 실패:', error)
    // 기본값
    return {
      growth: 0,
      stage: TREE_STAGES.SEED,
      lastFruitDate: null
    }
  }
}

/**
 * 나무 상태 저장
 * @param {Object} state - 나무 상태
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function saveTreeState(state) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tree/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        growth: state.growth || 0,
        stage: state.stage !== undefined ? state.stage : TREE_STAGES.SEED,
        lastFruitDate: state.lastFruitDate || null
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('나무 상태 저장 실패:', error)
    return false
  }
}

/**
 * 현재 단계에 도달하기까지 필요한 점수 계산
 * @param {number} currentGrowth - 현재 성장도
 * @param {number} currentStage - 현재 단계
 * @returns {number} 다음 단계까지 필요한 점수
 */
export function getPointsToNextStage(currentGrowth, currentStage) {
  const nextStage = currentStage + 1
  if (nextStage > TREE_STAGES.FRUIT) {
    return 0 // 이미 최대 단계
  }
  
  const nextThreshold = TREE_STAGE_THRESHOLDS[nextStage]
  const needed = nextThreshold - currentGrowth
  return Math.max(0, needed)
}

/**
 * 현재 단계에서의 진행도 계산 (0~100)
 * @param {number} currentGrowth - 현재 성장도
 * @param {number} currentStage - 현재 단계
 * @returns {number} 진행도 (0~100)
 */
export function getStageProgress(currentGrowth, currentStage) {
  if (currentStage >= TREE_STAGES.FRUIT) {
    return 100
  }
  
  const currentThreshold = TREE_STAGE_THRESHOLDS[currentStage]
  const nextThreshold = TREE_STAGE_THRESHOLDS[currentStage + 1]
  const stageRange = nextThreshold - currentThreshold
  
  if (stageRange === 0) return 100
  
  const progressInStage = currentGrowth - currentThreshold
  const progressPercent = (progressInStage / stageRange) * 100
  
  return Math.min(100, Math.max(0, progressPercent))
}

/**
 * 사랑/기쁨만 있는지 확인 (보너스 점수 조건)
 * @param {Object} emotionScores - 감정 점수 객체
 * @returns {boolean} 사랑/기쁨만 있는 경우 true
 */
function isOnlyLoveAndJoy(emotionScores) {
  if (!emotionScores) return false
  
  const joy = emotionScores['기쁨'] || 0
  const love = emotionScores['사랑'] || 0
  const surprise = emotionScores['놀람'] || 0
  const fear = emotionScores['두려움'] || 0
  const anger = emotionScores['분노'] || 0
  const shame = emotionScores['부끄러움'] || 0
  const sadness = emotionScores['슬픔'] || 0
  
  // 사랑과 기쁨이 있고, 다른 감정들의 합이 10 이하인 경우
  const otherEmotionsSum = surprise + fear + anger + shame + sadness
  return (joy > 0 || love > 0) && otherEmotionsSum <= 10
}

/**
 * 긍정 감정 점수 추가 및 나무 성장 처리
 * @param {number} positiveScore - 추가할 긍정 감정 점수 (기쁨 + 사랑)
 * @param {Object} emotionScores - 감정 점수 객체 (보너스 계산용)
 * @returns {Promise<Object>} { growth: number, stage: number, fruitProduced: boolean, bonusScore: number }
 */
export async function addPositiveEmotion(positiveScore, emotionScores = null) {
  const state = await getTreeState()
  
  // 보너스 점수 계산 (사랑/기쁨만 있는 경우)
  let bonusScore = 0
  if (emotionScores && isOnlyLoveAndJoy(emotionScores)) {
    // 기본 점수의 25% 보너스
    bonusScore = Math.floor(positiveScore * 0.25)
  }
  
  const totalScore = positiveScore + bonusScore
  let newGrowth = state.growth + totalScore
  let newStage = state.stage
  let fruitProduced = false
  
  // 성장도에 맞는 단계를 항상 재계산 (저장된 단계가 잘못되어 있을 수 있음)
  // 먼저 현재 성장도로도 단계를 계산
  let currentCalculatedStage = TREE_STAGES.SEED
  for (let stage = TREE_STAGES.FRUIT; stage >= TREE_STAGES.SEED; stage--) {
    if (state.growth >= TREE_STAGE_THRESHOLDS[stage]) {
      currentCalculatedStage = stage
      break
    }
  }
  
  // 열매 단계에 도달했는지 확인
  if (newGrowth >= TREE_STAGE_THRESHOLDS[TREE_STAGES.FRUIT]) {
    newStage = TREE_STAGES.FRUIT
    fruitProduced = true
    
    // 행복 열매 개수 증가
    await addHappyFruit()
    
    // 열매가 열리면 우물 물이 조금 줄어듦 (동적 import로 순환 참조 방지)
    const { reduceWaterLevel } = await import('./wellUtils')
    await reduceWaterLevel(50) // 50점 감소
    
    // 나무 상태 초기화 (성장도는 0으로, 단계는 SEED로)
    newGrowth = 0
    newStage = TREE_STAGES.SEED
  } else {
    // 새로운 성장도에 맞는 단계 계산
    for (let stage = TREE_STAGES.FRUIT; stage >= TREE_STAGES.SEED; stage--) {
      if (newGrowth >= TREE_STAGE_THRESHOLDS[stage]) {
        newStage = stage
        break
      }
    }
  }
  
  const newState = {
    growth: newGrowth,
    stage: newStage,
    lastFruitDate: fruitProduced ? new Date().toISOString().split('T')[0] : state.lastFruitDate
  }
  
  await saveTreeState(newState)
  
  return {
    growth: newGrowth,
    stage: newStage,
    fruitProduced: fruitProduced,
    bonusScore: bonusScore
  }
}

/**
 * 행복 열매 개수 가져오기
 * @returns {Promise<number>} 행복 열매 개수
 */
export async function getHappyFruitCount() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tree/fruits`)
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    return data.count || 0
  } catch (error) {
    console.error('행복 열매 개수 불러오기 실패:', error)
    return 0
  }
}

/**
 * 행복 열매 개수 증가
 * @returns {Promise<number>} 새로운 열매 개수
 */
export async function addHappyFruit() {
  try {
    const currentCount = await getHappyFruitCount()
    const newCount = currentCount + 1
    
    const response = await fetch(`${API_BASE_URL}/api/tree/fruits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count: newCount }),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return newCount
  } catch (error) {
    console.error('행복 열매 추가 실패:', error)
    return 0
  }
}

/**
 * 나무 단계 이름 가져오기
 * @param {number} stage - 나무 단계
 * @returns {string} 단계 이름
 */
export function getStageName(stage) {
  const stageNames = {
    [TREE_STAGES.SEED]: '씨앗',
    [TREE_STAGES.SPROUT]: '새싹',
    [TREE_STAGES.SEEDLING]: '묘목',
    [TREE_STAGES.MEDIUM]: '중간 나무',
    [TREE_STAGES.LARGE]: '큰 나무',
    [TREE_STAGES.FRUIT]: '열매 열림'
  }
  return stageNames[stage] || '알 수 없음'
}

/**
 * 나무 단계 이모지 가져오기
 * @param {number} stage - 나무 단계
 * @returns {string} 이모지
 */
export function getStageEmoji(stage) {
  const stageEmojis = {
    [TREE_STAGES.SEED]: '🌱',
    [TREE_STAGES.SPROUT]: '🌿',
    [TREE_STAGES.SEEDLING]: '🌳',
    [TREE_STAGES.MEDIUM]: '🌲',
    [TREE_STAGES.LARGE]: '🌴',
    [TREE_STAGES.FRUIT]: '🍎'
  }
  return stageEmojis[stage] || '🌱'
}
