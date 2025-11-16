// 데이터베이스 API 호출 유틸리티 함수들

const API_BASE_URL = 'http://127.0.0.1:5000'

/**
 * 모든 일기 가져오기
 * @returns {Promise<Array>} 일기 배열
 */
export async function getAllDiaries() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries`)
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
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries?date=${date}`)
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

      // 긍정/부정 점수 계산
      dayPositive += (scores['기쁨'] || 0) + (scores['사랑'] || 0)
      dayNegative += (scores['분노'] || 0) + 
                     (scores['슬픔'] || 0) + 
                     (scores['두려움'] || 0) + 
                     (scores['부끄러움'] || 0)
    })

    positiveTrend.push(dayPositive)
    negativeTrend.push(dayNegative)
  })

  return {
    dates: dateStrings,
    emotionStats,
    positiveTrend,
    negativeTrend
  }
}

/**
 * 특정 날짜의 광장 대화 가져오기
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} { conversation: Array, emotionScores: Object } 또는 null
 */
export async function getPlazaConversationByDate(date) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/plaza/conversations/${date}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`API 오류: ${response.status}`)
    }
    const result = await response.json()
    return result || null
  } catch (error) {
    console.error('대화 불러오기 실패:', error)
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
      body: JSON.stringify({
        date,
        conversation,
        emotionScores
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('대화 저장 실패:', error)
    return false
  }
}
