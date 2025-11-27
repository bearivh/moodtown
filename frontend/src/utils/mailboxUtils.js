// 우체통 관련 유틸리티 함수들

// 환경 변수에서 API URL을 가져오고, 없으면 빈 문자열(프록시 사용)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 모든 편지 가져오기
 * @returns {Promise<Array>} 편지 배열
 */
export async function getAllLetters() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters`, {
      credentials: 'include'
    })
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const letters = await response.json()
    return letters || []
  } catch (error) {
    console.error('편지 불러오기 실패:', error)
    return []
  }
}

/**
 * 편지 추가
 * @param {Object} letter - 편지 객체 { title, content, from, date, type }
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addLetter(letter) {
  try {
    const newLetter = {
      id: letter.id || Date.now().toString(),
      title: letter.title || '',
      content: letter.content || '',
      from: letter.from || '감정 마을',
      date: letter.date || new Date().toISOString().split('T')[0],
      type: letter.type || 'normal', // normal, celebration, warning 등
      isRead: letter.isRead || false,
      createdAt: letter.createdAt || new Date().toISOString()
    }
    
    const response = await fetch(`${API_BASE_URL}/api/letters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(newLetter),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('편지 추가 실패:', error)
    return false
  }
}

/**
 * GPT로 편지 생성
 * @param {string} letterType - 편지 타입 ('celebration', 'comfort', 'cheer', 'well_overflow')
 * @param {Object} options - 옵션 { emotion_scores, fruit_count, diary_text }
 * @returns {Promise<Object>} 생성된 편지 객체
 */
async function generateLetter(letterType, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        type: letterType,
        emotion_scores: options.emotion_scores || {},
        fruit_count: options.fruit_count,
        diary_text: options.diary_text || ''
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    const letter = await response.json()
    return letter
  } catch (error) {
    console.error('편지 생성 실패:', error)
    // 오류 시 기본 편지 반환
    return {
      title: '💌 주민들의 편지',
      content: '안녕하세요! 주민들이 편지를 보냈어요.',
      from: '감정 마을'
    }
  }
}

/**
 * 행복 열매 축하 편지 추가
 * @param {number} fruitCount - 현재 행복 열매 개수
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addHappyFruitCelebrationLetter(fruitCount) {
  try {
    const letter = await generateLetter('celebration', { fruit_count: fruitCount })
    letter.type = 'celebration'
    letter.date = new Date().toISOString().split('T')[0]
    return await addLetter(letter)
  } catch (error) {
    console.error('행복 열매 축하 편지 추가 실패:', error)
    return false
  }
}

/**
 * 편지 읽음 처리
 * @param {string} id - 편지 ID
 * @returns {Promise<boolean>} 업데이트 성공 여부
 */
export async function markLetterAsRead(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters/${id}/read`, {
      method: 'POST',
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('편지 읽음 처리 실패:', error)
    return false
  }
}

/**
 * 편지 삭제
 * @param {string} id - 편지 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteLetter(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    
    return true
  } catch (error) {
    console.error('편지 삭제 실패:', error)
    return false
  }
}

/**
 * 읽지 않은 편지 개수 가져오기
 * @returns {Promise<number>} 읽지 않은 편지 개수
 */
export async function getUnreadLetterCount() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters/unread/count`, {
      credentials: 'include'
    })
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    return data.count || 0
  } catch (error) {
    console.error('읽지 않은 편지 개수 불러오기 실패:', error)
    return 0
  }
}

/**
 * 스트레스 우물 넘침 위로 편지 추가
 * @param {Object} emotionScores - 감정 점수 객체
 * @param {string} diaryText - 일기 내용 (선택적)
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addWellOverflowComfortLetter(emotionScores, diaryText = '') {
  try {
    const letter = await generateLetter('well_overflow', { 
      emotion_scores: emotionScores,
      diary_text: diaryText
    })
    letter.type = 'comfort'
    letter.date = new Date().toISOString().split('T')[0]
    return await addLetter(letter)
  } catch (error) {
    console.error('우물 넘침 위로 편지 추가 실패:', error)
    return false
  }
}

/**
 * 부정 감정만 있을 때 사랑 주민의 위로 편지
 * @param {string} diaryText - 일기 내용 (선택적)
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addNegativeOnlyComfortLetter(diaryText = '') {
  try {
    const letter = await generateLetter('comfort', { diary_text: diaryText })
    letter.type = 'comfort'
    letter.date = new Date().toISOString().split('T')[0]
    return await addLetter(letter)
  } catch (error) {
    console.error('부정 감정만 있을 때 위로 편지 추가 실패:', error)
    return false
  }
}
