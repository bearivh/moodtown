// API 유틸리티 함수들
// Vite 프록시를 통해 같은 origin에서 실행되므로 상대 경로 사용
const API_BASE_URL = ''

// fetch 옵션에 credentials 추가 (세션 쿠키 전송)
const fetchOptions = {
  credentials: 'include'
}

/**
 * 일기 내용을 분석하고 대화를 생성합니다.
 * @param {string} content - 일기 내용
 * @returns {Promise<Object>} 감정 분석 결과와 대화
 */
export async function analyzeDiary(content) {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    })

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('일기 분석 오류:', error)
    throw error
  }
}

/**
 * 텍스트 감정 분석 (모드 선택: 'ml' | 'gpt')
 * - ml: 데모 전용, 서버 상태 변경 없음
 * - gpt: 기존 analyze 로직과 동일(대화 포함)
 * @param {{content: string, mode: 'ml'|'gpt'}} payload
 * @returns {Promise<Object>}
 */
export async function analyzeText({ content, mode = 'ml' }) {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, mode }),
    })
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    // gpt 응답에 mode가 빠져도 프론트에서 식별 가능하도록 보강
    if (mode === 'gpt' && data && !data.mode) {
      return { mode: 'gpt', ...data }
    }
    return data
  } catch (error) {
    console.error('텍스트 분석 오류:', error)
    throw error
  }
}

/**
 * 캐릭터들과 실시간 대화합니다.
 * @param {string} message - 사용자 메시지
 * @param {Array<string>} characters - 활성 캐릭터 목록
 * @param {string} date - 세션 구분용 날짜 (선택)
 * @returns {Promise<Object>} 대화 응답
 */
export async function chatWithCharacters(message, characters = [], date = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, characters, date }),
    })

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('채팅 오류:', error)
    throw error
  }
}

/**
 * 마을사무소용 통계(Top 3 감정 비중, 나무/우물 기여도)를 가져옵니다.
 * @returns {Promise<Object>}
 */
export async function getOfficeStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats/office`)
    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('마을사무소 통계 불러오기 오류:', error)
    throw error
  }
}

/**
 * 특정 일기와 유사한 일기 찾기
 * @param {string} diaryId - 일기 ID
 * @param {number} limit - 반환할 최대 개수 (기본값: 5)
 * @param {number} minSimilarity - 최소 유사도 (0~1, 기본값: 0.3)
 * @returns {Promise<Object>} 유사 일기 목록
 */
export async function getSimilarDiaries(diaryId, limit = 5, minSimilarity = 0.3) {
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      min_similarity: minSimilarity.toString()
    })
    const response = await fetch(`${API_BASE_URL}/api/diaries/${diaryId}/similar?${params}`)
    if (!response.ok) {
      if (response.status === 503) {
        // 모델이 학습되지 않은 경우
        return { success: false, error: '유사 일기 검색 모델이 아직 학습되지 않았습니다.' }
      }
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('유사 일기 검색 오류:', error)
    throw error
  }
}

/**
 * 텍스트를 기준으로 유사한 일기 찾기
 * @param {string} text - 검색할 텍스트
 * @param {number} limit - 반환할 최대 개수 (기본값: 5)
 * @param {number} minSimilarity - 최소 유사도 (0~1, 기본값: 0.3)
 * @returns {Promise<Object>} 유사 일기 목록
 */
export async function findSimilarDiariesByText(text, limit = 5, minSimilarity = 0.3) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diaries/similar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        limit,
        min_similarity: minSimilarity
      }),
    })
    if (!response.ok) {
      if (response.status === 503) {
        // 모델이 학습되지 않은 경우
        return { success: false, error: '유사 일기 검색 모델이 아직 학습되지 않았습니다.' }
      }
      throw new Error(`API 오류: ${response.status}`)
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error('유사 일기 검색 오류:', error)
    throw error
  }
}

/**
 * OpenAI 응답에서 대화 JSON을 파싱합니다.
 * @param {string} text - OpenAI 응답 텍스트
 * @returns {Array<Object>} 파싱된 대화 배열
 */
// 감정명 -> 주민 이름 매핑
const EMOTION_TO_CHARACTER = {
  '기쁨': '노랑이',
  '사랑': '초록이',
  '놀람': '보라',
  '두려움': '남색이',
  '분노': '빨강이',
  '부끄러움': '주황이',
  '슬픔': '파랑이'
}

// 주민 이름 보정 함수
function normalizeCharacterName(characterName, emotionName) {
  if (!characterName) {
    // 주민 이름이 없으면 감정명으로 주민 이름 찾기
    return EMOTION_TO_CHARACTER[emotionName] || characterName
  }
  
  // 주민 이름이 감정명과 같으면 주민 이름으로 변환
  if (EMOTION_TO_CHARACTER[characterName]) {
    return EMOTION_TO_CHARACTER[characterName]
  }
  
  // 이미 주민 이름이면 그대로 사용
  const validNames = Object.values(EMOTION_TO_CHARACTER)
  if (validNames.includes(characterName)) {
    return characterName
  }
  
  // 감정명으로 주민 이름 찾기
  if (emotionName && EMOTION_TO_CHARACTER[emotionName]) {
    return EMOTION_TO_CHARACTER[emotionName]
  }
  
  return characterName
}

export function parseDialogue(text) {
  if (!text) return []
  
  try {
    // 1. BEGIN_JSON/END_JSON 태그로 감싸진 경우
    const jsonMatch = text.match(/<BEGIN_JSON>([\s\S]*?)<END_JSON>/i)
    if (jsonMatch) {
      const jsonText = jsonMatch[1].trim()
      try {
        const data = JSON.parse(jsonText)
        const dialogue = data.dialogue || []
        // 빈 텍스트 필터링 및 주민 이름 보정
        return dialogue
          .filter(msg => {
            const text = msg.대사 || msg.text || msg.dialogue || ''
            return text && text.trim().length > 0
          })
          .map(msg => {
            const emotion = msg.감정 || msg.emotion || ''
            const characterName = msg.캐릭터 || msg.character || ''
            // 주민 이름 보정
            const normalizedName = normalizeCharacterName(characterName, emotion)
            return {
              ...msg,
              캐릭터: normalizedName,
              character: normalizedName
            }
          })
      } catch (e) {
        console.warn('[파싱] JSON 파싱 실패:', e)
      }
    }

    // 2. 코드 블록으로 감싸진 경우 (```json ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (codeBlockMatch) {
      const jsonText = codeBlockMatch[1].trim()
      try {
        const data = JSON.parse(jsonText)
        const dialogue = data.dialogue || []
        // 빈 텍스트 필터링 및 주민 이름 보정
        return dialogue
          .filter(msg => {
            const text = msg.대사 || msg.text || msg.dialogue || ''
            return text && text.trim().length > 0
          })
          .map(msg => {
            const emotion = msg.감정 || msg.emotion || ''
            const characterName = msg.캐릭터 || msg.character || ''
            // 주민 이름 보정
            const normalizedName = normalizeCharacterName(characterName, emotion)
            return {
              ...msg,
              캐릭터: normalizedName,
              character: normalizedName
            }
          })
      } catch (e) {
        console.warn('[파싱] JSON 파싱 실패:', e)
      }
    }

    // 3. JSON 객체가 직접 있는 경우
    const jsonObjectMatch = text.match(/\{[\s\S]*"dialogue"[\s\S]*\}/)
    if (jsonObjectMatch) {
      try {
        const data = JSON.parse(jsonObjectMatch[0])
        const dialogue = data.dialogue || []
        // 빈 텍스트 필터링 및 주민 이름 보정
        return dialogue
          .filter(msg => {
            const text = msg.대사 || msg.text || msg.dialogue || ''
            return text && text.trim().length > 0
          })
          .map(msg => {
            const emotion = msg.감정 || msg.emotion || ''
            const characterName = msg.캐릭터 || msg.character || ''
            // 주민 이름 보정
            const normalizedName = normalizeCharacterName(characterName, emotion)
            return {
              ...msg,
              캐릭터: normalizedName,
              character: normalizedName
            }
          })
      } catch (e) {
        // 마지막 중괄호까지 추출 시도
        try {
          const lastBrace = jsonObjectMatch[0].lastIndexOf('}')
          if (lastBrace > 0) {
            const data = JSON.parse(jsonObjectMatch[0].substring(0, lastBrace + 1))
            const dialogue = data.dialogue || []
            // 빈 텍스트 필터링 및 주민 이름 보정
            return dialogue
              .filter(msg => {
                const text = msg.대사 || msg.text || msg.dialogue || ''
                return text && text.trim().length > 0
              })
              .map(msg => {
                const emotion = msg.감정 || msg.emotion || ''
                const characterName = msg.캐릭터 || msg.character || ''
                // 주민 이름 보정
                const normalizedName = normalizeCharacterName(characterName, emotion)
                return {
                  ...msg,
                  캐릭터: normalizedName,
                  character: normalizedName
                }
              })
          }
        } catch (e2) {
          console.warn('[파싱] JSON 파싱 실패:', e2)
        }
      }
    }

    // 4. 배열 형태로 직접 있는 경우
    const arrayMatch = text.match(/\[[\s\S]*\{[\s\S]*"캐릭터"[\s\S]*\}[\s\S]*\]/i)
    if (arrayMatch) {
      try {
        const data = JSON.parse(arrayMatch[0])
        const dialogue = Array.isArray(data) ? data : []
        // 빈 텍스트 필터링 및 주민 이름 보정
        return dialogue
          .filter(msg => {
            const text = msg.대사 || msg.text || msg.dialogue || ''
            return text && text.trim().length > 0
          })
          .map(msg => {
            const emotion = msg.감정 || msg.emotion || ''
            const characterName = msg.캐릭터 || msg.character || ''
            // 주민 이름 보정
            const normalizedName = normalizeCharacterName(characterName, emotion)
            return {
              ...msg,
              캐릭터: normalizedName,
              character: normalizedName
            }
          })
      } catch (e) {
        console.warn('[파싱] 배열 파싱 실패:', e)
      }
    }

    console.warn('[파싱] 대화 파싱 실패:', text.substring(0, 200))
    return []
  } catch (error) {
    console.error('[파싱] 대화 파싱 오류:', error)
    console.error('[파싱] 원본 텍스트:', text.substring(0, 500))
    return []
  }
}

/**
 * 회원가입
 * @param {string} username - 아이디
 * @param {string} password - 비밀번호
 * @param {string} name - 이름 (선택)
 * @returns {Promise<Object>} 사용자 정보
 */
export async function register(username, password, name = '') {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password, name }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('회원가입 오류:', error)
    throw error
  }
}

/**
 * 로그인
 * @param {string} username - 아이디
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 사용자 정보
 */
export async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('로그인 오류:', error)
    throw error
  }
}

/**
 * 로그아웃
 * @returns {Promise<Object>}
 */
export async function logout() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('로그아웃 오류:', error)
    throw error
  }
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 * @returns {Promise<Object>} 사용자 정보 (로그인하지 않았으면 null)
 */
export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`API 오류: ${response.status}`)
    }

    const data = await response.json()
    // authenticated가 false이거나 user가 null이면 null 반환
    if (!data.authenticated || !data.user) {
      return null
    }
    return data.user
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error)
    return null
  }
}

