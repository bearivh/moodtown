// API 유틸리티 함수들

const API_BASE_URL = 'http://127.0.0.1:5000'

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
 * OpenAI 응답에서 대화 JSON을 파싱합니다.
 * @param {string} text - OpenAI 응답 텍스트
 * @returns {Array<Object>} 파싱된 대화 배열
 */
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
        // 빈 텍스트 필터링
        return dialogue.filter(msg => {
          const text = msg.대사 || msg.text || msg.dialogue || ''
          return text && text.trim().length > 0
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
        // 빈 텍스트 필터링
        return dialogue.filter(msg => {
          const text = msg.대사 || msg.text || msg.dialogue || ''
          return text && text.trim().length > 0
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
        // 빈 텍스트 필터링
        return dialogue.filter(msg => {
          const text = msg.대사 || msg.text || msg.dialogue || ''
          return text && text.trim().length > 0
        })
      } catch (e) {
        // 마지막 중괄호까지 추출 시도
        try {
          const lastBrace = jsonObjectMatch[0].lastIndexOf('}')
          if (lastBrace > 0) {
            const data = JSON.parse(jsonObjectMatch[0].substring(0, lastBrace + 1))
            const dialogue = data.dialogue || []
            // 빈 텍스트 필터링
            return dialogue.filter(msg => {
              const text = msg.대사 || msg.text || msg.dialogue || ''
              return text && text.trim().length > 0
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
        // 빈 텍스트 필터링
        return dialogue.filter(msg => {
          const text = msg.대사 || msg.text || msg.dialogue || ''
          return text && text.trim().length > 0
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

