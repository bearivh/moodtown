// 데이터베이스 API 호출 유틸리티 함수들

import { classifyEmotionsWithContext } from './emotionUtils'
import { getCachedDiariesForDate, setDiariesForDate } from './diaryCache'

// 환경 변수에서 API URL을 가져오고, 없으면 빈 문자열(프록시 사용)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 모든 일기 가져오기
 * @returns {Promise<Array>} 일기 배열
 */
export async function getAllDiaries() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries`, {
      credentials: 'include'
    })
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const diaries = await response.json()
    return diaries || []
  } catch (error) {
    console.error('일기 불러오기 실패:', error)
    return []
  }
}

/**
 * 일기 저장
 * @param {Object} diary - 일기 객체
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function saveDiary(diary) {
  try {
    const newDiary = {
      id: diary.id || Date.now().toString(),
      date: diary.date || new Date().toISOString().split('T')[0],
      title: diary.title || '',
      content: diary.content || '',
      emotions: diary.emotions || [],
      emotion_scores: diary.emotion_scores || {},
      createdAt: diary.createdAt || new Date().toISOString(),
      ...diary
    }
    
    const response = await fetch(`${API_BASE_URL}/api/diaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(newDiary),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `API 오류: ${response.status}`
      console.error('일기 저장 실패:', errorMessage)
      throw new Error(errorMessage)
    }
    
    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('일기 저장 실패:', error)
    throw error  // 에러를 다시 throw하여 상위에서 처리할 수 있도록
  }
}

/**
 * 특정 날짜의 일기 가져오기
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Array>} 해당 날짜의 일기 배열
 */
export async function getDiariesByDate(date) {
  // 먼저 캐시 확인
  const cached = getCachedDiariesForDate(date)
  if (cached !== null) {
    return cached
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries?date=${date}`, {
      credentials: 'include'
    })
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const diaries = await response.json()
    const result = diaries || []
    // 캐시에 저장
    if (date) {
      setDiariesForDate(date, result)
    }
    return result
  } catch (error) {
    console.error('일기 불러오기 실패:', error)
    return []
  }
}

/**
 * 일기 덮어쓰기 (기존 일기 삭제 및 관련 상태 되돌리기)
 * @param {string} date - 날짜
 * @param {Object} oldEmotionScores - 기존 일기의 감정 점수
 * @param {Object} newDiary - 새 일기 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
export async function replaceDiary(date, oldEmotionScores, newDiary) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries/replace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        date,
        old_emotion_scores: oldEmotionScores,
        new_diary: newDiary
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error || `API 오류: ${response.status}`
      console.error('일기 덮어쓰기 실패:', errorMessage)
      throw new Error(errorMessage)
    }
    
    const result = await response.json()
    return result.success === true
  } catch (error) {
    console.error('일기 덮어쓰기 실패:', error)
    throw error
  }
}

/**
 * 특정 ID의 일기 가져오기
 * @param {string} id - 일기 ID
 * @returns {Promise<Object|null>} 일기 객체 또는 null
 */
export async function getDiaryById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries/${id}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`API 오류: ${response.status}`)
    }
    const diary = await response.json()
    return diary || null
  } catch (error) {
    console.error('일기 불러오기 실패:', error)
    return null
  }
}

/**
 * 일기 삭제
 * @param {string} id - 일기 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteDiary(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('일기 삭제 실패:', error)
    return false
  }
}

/**
 * 일기 수정
 * @param {string} id - 일기 ID
 * @param {Object} updatedDiary - 수정된 일기 객체
 * @returns {Promise<boolean>} 수정 성공 여부
 */
export async function updateDiary(id, updatedDiary) {
  try {
    const existingDiary = await getDiaryById(id)
    if (!existingDiary) return false
    
    const mergedDiary = {
      ...existingDiary,
      ...updatedDiary,
      id,
      updatedAt: new Date().toISOString()
    }
    
    return await saveDiary(mergedDiary)
  } catch (error) {
    console.error('일기 수정 실패:', error)
    return false
  }
}

/**
 * 날짜별 감정 통계 가져오기
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object>} 감정별 개수
 */
export async function getEmotionStatsByDate(date) {
  const diaries = await getDiariesByDate(date)
  const stats = {}
  
  diaries.forEach(diary => {
    diary.emotions?.forEach(emotion => {
      stats[emotion] = (stats[emotion] || 0) + 1
    })
  })
  
  return stats
}

/**
 * 오늘 일기가 있는지 확인
 * @returns {Promise<boolean>} 오늘 일기 존재 여부
 */
export async function hasTodayDiary() {
  const today = new Date().toISOString().split('T')[0]
  const todayDiaries = await getDiariesByDate(today)
  return todayDiaries.length > 0
}

/**
 * 오늘 일기 가져오기
 * @returns {Promise<Object|null>} 오늘 일기 객체 또는 null
 */
export async function getTodayDiary() {
  const today = new Date().toISOString().split('T')[0]
  const todayDiaries = await getDiariesByDate(today)
  return todayDiaries.length > 0 ? todayDiaries[0] : null
}

/**
 * 날짜별 가장 강한 감정 찾기
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} { emotion: string, score: number } 또는 null
 */
export async function getDominantEmotionByDate(date) {
  const diaries = await getDiariesByDate(date)
  if (diaries.length === 0) return null

  // 모든 일기의 감정 점수 합산
  const emotionTotals = {}
  
  diaries.forEach(diary => {
    const scores = diary.emotion_scores || {}
    Object.keys(scores).forEach(emotion => {
      emotionTotals[emotion] = (emotionTotals[emotion] || 0) + scores[emotion]
    })
  })

  // 가장 높은 점수의 감정 찾기
  let maxScore = 0
  let dominantEmotion = null
  
  Object.keys(emotionTotals).forEach(emotion => {
    if (emotionTotals[emotion] > maxScore) {
      maxScore = emotionTotals[emotion]
      dominantEmotion = emotion
    }
  })

  return dominantEmotion ? { emotion: dominantEmotion, score: maxScore } : null
}

/**
 * 일주일 간 감정 통계 가져오기
 * @param {Date} startDate - 시작 날짜 (기본값: 오늘로부터 7일 전)
 * @returns {Promise<Object>} { dates: Array, emotionStats: Object, positiveTrend: Array, negativeTrend: Array }
 */
export async function getWeeklyEmotionStats(startDate = null) {
  const diaries = await getAllDiaries()
  const endDate = new Date()
  const start = startDate || new Date(endDate)
  start.setDate(start.getDate() - 6) // 7일간 (오늘 포함)

  // 날짜 배열 생성
  const dates = []
  const dateStrings = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    dates.push(date)
    dateStrings.push(date.toISOString().split('T')[0])
  }

  // 감정별 통계
  const emotionStats = {
    '기쁨': 0,
    '사랑': 0,
    '놀람': 0,
    '두려움': 0,
    '분노': 0,
    '부끄러움': 0,
    '슬픔': 0
  }

  // 일별 긍정/부정 추이
  const positiveTrend = []
  const negativeTrend = []

  dateStrings.forEach(dateStr => {
    const dayDiaries = diaries.filter(d => d.date === dateStr)
    
    let dayPositive = 0
    let dayNegative = 0

    dayDiaries.forEach(diary => {
      const scores = diary.emotion_scores || {}
      
      // 감정별 점수 누적
      Object.keys(scores).forEach(emotion => {
        if (emotionStats.hasOwnProperty(emotion)) {
          emotionStats[emotion] += scores[emotion]
        }
      })

      // 긍정/부정 점수 계산 (맥락 기반 분류 사용)
      const emotionPolarity = diary.emotion_polarity || {}
      const { positive, negative } = classifyEmotionsWithContext(scores, emotionPolarity)
      dayPositive += positive
      dayNegative += negative
    })

    // 긍정/부정 합이 100이 되도록 정규화
    const totalDay = dayPositive + dayNegative
    if (totalDay > 0) {
      dayPositive = Math.round((dayPositive / totalDay) * 100)
      dayNegative = 100 - dayPositive // 반올림 오차 보정
    } else {
      // 둘 다 0이면 0:0으로 설정
      dayPositive = 0
      dayNegative = 0
    }

    positiveTrend.push(dayPositive)
    negativeTrend.push(dayNegative)
  })

  // 일별 실제 점수 (정규화 전)
  const positiveScores = []
  const negativeScores = []

  dateStrings.forEach(dateStr => {
    const dayDiaries = diaries.filter(d => d.date === dateStr)
    
    let dayPositiveScore = 0
    let dayNegativeScore = 0

    dayDiaries.forEach(diary => {
      const scores = diary.emotion_scores || {}
      const emotionPolarity = diary.emotion_polarity || {}
      const { positive, negative } = classifyEmotionsWithContext(scores, emotionPolarity)
      dayPositiveScore += positive
      dayNegativeScore += negative
    })

    positiveScores.push(dayPositiveScore)
    negativeScores.push(dayNegativeScore)
  })

  return {
    dates: dateStrings,
    emotionStats,
    positiveTrend, // 정규화된 비율 (0-100)
    negativeTrend, // 정규화된 비율 (0-100)
    positiveScores, // 실제 점수
    negativeScores  // 실제 점수
  }
}

/**
 * 이번 달 감정 통계 가져오기
 * @returns {Promise<Object>} { emotionStats: Object }
 */
export async function getMonthlyEmotionStats() {
  const diaries = await getAllDiaries()
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  // 이번 달 날짜 범위
  const startDateStr = startOfMonth.toISOString().split('T')[0]
  const endDateStr = endOfMonth.toISOString().split('T')[0]
  
  // 이번 달 일기만 필터링
  const monthlyDiaries = diaries.filter(d => {
    return d.date >= startDateStr && d.date <= endDateStr
  })
  
  // 감정별 통계
  const emotionStats = {
    '기쁨': 0,
    '사랑': 0,
    '놀람': 0,
    '두려움': 0,
    '분노': 0,
    '부끄러움': 0,
    '슬픔': 0
  }
  
  monthlyDiaries.forEach(diary => {
    const scores = diary.emotion_scores || {}
    Object.keys(scores).forEach(emotion => {
      if (emotionStats.hasOwnProperty(emotion)) {
        emotionStats[emotion] += scores[emotion] || 0
      }
    })
  })
  
  return { emotionStats }
}

/**
 * 연속 일기 작성 일수 계산 (스트릭)
 * @returns {Promise<Object>} { streak: number, lastWrittenDate: string }
 */
export async function getDiaryStreak() {
  const diaries = await getAllDiaries()
  if (diaries.length === 0) {
    return { streak: 0, lastWrittenDate: null }
  }
  
  // 날짜별로 정렬 (최신순)
  const dateSet = new Set(diaries.map(d => d.date))
  const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a))
  
  // 오늘부터 역순으로 연속된 날짜 계산
  const today = new Date()
  // 시간대 문제를 피하기 위해 문자열로 직접 비교
  const todayStr = today.toISOString().split('T')[0]
  
  let streak = 0
  let checkDate = new Date(today)
  checkDate.setHours(0, 0, 0, 0)
  let lastWrittenDate = sortedDates[0] || null
  
  // 오늘이 포함되어 있으면 스트릭 시작
  if (sortedDates.includes(todayStr)) {
    streak = 1
    checkDate.setDate(checkDate.getDate() - 1)
  } else {
    // 오늘 일기가 없으면 어제부터 시작
    checkDate.setDate(checkDate.getDate() - 1)
  }
  
  // 연속된 날짜 체크
  while (true) {
    const checkDateStr = checkDate.toISOString().split('T')[0]
    if (sortedDates.includes(checkDateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }
  
  // 최소 1일은 보장 (오늘 일기가 있으면)
  if (sortedDates.includes(todayStr) && streak === 0) {
    streak = 1
  }
  
  return { streak, lastWrittenDate }
}

/**
 * 감정별 평균 점수 계산
 * @returns {Promise<Object>} { emotionAverages: Object, totalDiaries: number }
 */
export async function getEmotionAverages() {
  const diaries = await getAllDiaries()
  if (diaries.length === 0) {
    return {
      emotionAverages: {},
      totalDiaries: 0
    }
  }
  
  const emotionTotals = {
    '기쁨': 0,
    '사랑': 0,
    '놀람': 0,
    '두려움': 0,
    '분노': 0,
    '부끄러움': 0,
    '슬픔': 0
  }
  
  const emotionCounts = {
    '기쁨': 0,
    '사랑': 0,
    '놀람': 0,
    '두려움': 0,
    '분노': 0,
    '부끄러움': 0,
    '슬픔': 0
  }
  
  diaries.forEach(diary => {
    const scores = diary.emotion_scores || {}
    Object.keys(scores).forEach(emotion => {
      if (emotionTotals.hasOwnProperty(emotion)) {
        const score = scores[emotion] || 0
        if (score > 0) {
          emotionTotals[emotion] += score
          emotionCounts[emotion]++
        }
      }
    })
  })
  
  // 평균 계산
  const emotionAverages = {}
  Object.keys(emotionTotals).forEach(emotion => {
    if (emotionCounts[emotion] > 0) {
      emotionAverages[emotion] = Math.round((emotionTotals[emotion] / emotionCounts[emotion]) * 10) / 10
    } else {
      emotionAverages[emotion] = 0
    }
  })
  
  return {
    emotionAverages,
    totalDiaries: diaries.length
  }
}

/**
 * 요일별 일기 작성 패턴 분석
 * @returns {Promise<Object>} { weekdayPattern: Object, weekdayLabels: Array }
 */
export async function getWeekdayPattern() {
  const diaries = await getAllDiaries()
  
  const weekdayCounts = {
    0: 0, // 일요일
    1: 0, // 월요일
    2: 0, // 화요일
    3: 0, // 수요일
    4: 0, // 목요일
    5: 0, // 금요일
    6: 0  // 토요일
  }
  
  diaries.forEach(diary => {
    const date = new Date(diary.date + 'T00:00:00')
    const weekday = date.getDay()
    weekdayCounts[weekday] = (weekdayCounts[weekday] || 0) + 1
  })
  
  const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']
  const weekdayPattern = {}
  
  weekdayLabels.forEach((label, index) => {
    weekdayPattern[label] = weekdayCounts[index] || 0
  })
  
  return { weekdayPattern, weekdayLabels }
}

/**
 * 이번 달 일기 작성 활동도
 * @returns {Promise<Object>} { monthlyCount: number, monthlyGoal: number, weeklyCount: number }
 */
export async function getWritingActivity() {
  const diaries = await getAllDiaries()
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  const startDateStr = startOfMonth.toISOString().split('T')[0]
  const endDateStr = endOfMonth.toISOString().split('T')[0]
  
  // 이번 달 일기
  const monthlyDiaries = diaries.filter(d => {
    return d.date >= startDateStr && d.date <= endDateStr
  })
  
  // 이번 주 일기
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const startWeekStr = startOfWeek.toISOString().split('T')[0]
  
  const weeklyDiaries = diaries.filter(d => {
    return d.date >= startWeekStr && d.date <= endDateStr
  })
  
  // 이번 달 목표 (월의 일수)
  const daysInMonth = endOfMonth.getDate()
  const daysPassed = today.getDate()
  const monthlyGoal = Math.ceil((daysPassed / daysInMonth) * daysInMonth) // 경과일 기준 목표
  
  return {
    monthlyCount: monthlyDiaries.length,
    monthlyGoal: daysInMonth, // 월 전체 일수
    weeklyCount: weeklyDiaries.length
  }
}

/**
 * 특정 날짜의 광장 대화 가져오기
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} { conversation: Array, emotionScores: Object } 또는 null
 */
export async function getPlazaConversationByDate(date) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plaza/conversations/${date}`, {
      credentials: 'include'
    })
    if (!response.ok) {
      // 404는 대화가 없는 것으로 간주 (정상)
      if (response.status === 404) {
        console.log('[대화 불러오기] 404 - 대화가 없음:', date)
        return null
      }
      // 401은 로그인 문제
      if (response.status === 401) {
        console.error('[대화 불러오기] 401 - 로그인 필요:', date)
        return null
      }
      // 500은 서버 에러
      if (response.status === 500) {
        console.error('[대화 불러오기] 500 - 서버 에러:', date)
        return null
      }
      console.error('[대화 불러오기] API 오류:', response.status, date)
      return null
    }
    const result = await response.json()
    console.log('[대화 불러오기] API 응답 전체:', result)
    // 빈 대화 배열이면 null 반환 (기존 동작 유지)
    if (result && result.conversation && Array.isArray(result.conversation) && result.conversation.length > 0) {
      console.log('[대화 불러오기] 성공:', date, result.conversation.length, '개 메시지')
      return result
    }
    console.log('[대화 불러오기] 빈 대화:', date, '응답:', result)
    return null
  } catch (error) {
    // 네트워크 에러 등
    console.error('[대화 불러오기] 네트워크 에러:', error, date)
    return null
  }
}

/**
 * 특정 날짜의 광장 대화 저장
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {Array} conversation - 대화 배열
 * @param {Object} emotionScores - 감정 점수 객체
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function savePlazaConversationByDate(date, conversation, emotionScores) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plaza/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        date,
        conversation,
        emotionScores
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[대화 저장] API 오류:', response.status, errorText)
      throw new Error(`API 오류: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('[대화 저장] 성공:', date, conversation.length, '개 메시지')
    return true
  } catch (error) {
    console.error('[대화 저장] 실패:', error, date)
    return false
  }
}
