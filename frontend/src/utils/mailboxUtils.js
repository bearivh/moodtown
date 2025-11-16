// 우체통 관련 유틸리티 함수들

const API_BASE_URL = 'http://127.0.0.1:5000'

/**
 * 모든 편지 가져오기
 * @returns {Promise<Array>} 편지 배열
 */
export async function getAllLetters() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/letters`)
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
 * 행복 열매 축하 편지 추가
 * @param {number} fruitCount - 현재 행복 열매 개수
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addHappyFruitCelebrationLetter(fruitCount) {
  const letter = {
    title: '🎉 행복 열매 축하 편지',
    content: `축하합니다! 행복 나무에서 ${fruitCount}번째 행복 열매가 열렸어요! 🌳✨\n\n당신의 긍정적인 감정들이 나무를 키워 열매를 맺었습니다. 앞으로도 행복한 하루 하루를 보내시길 바라요!`,
    from: '노랑이 & 초록이',
    type: 'celebration',
    date: new Date().toISOString().split('T')[0]
  }
  
  return await addLetter(letter)
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
    const response = await fetch(`${API_BASE_URL}/api/letters/unread/count`)
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
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addWellOverflowComfortLetter(emotionScores) {
  // 부정 감정이 높은 순서로 정렬
  const negativeEmotions = [
    { name: '슬픔', score: emotionScores['슬픔'] || 0, char: '파랑이' },
    { name: '분노', score: emotionScores['분노'] || 0, char: '빨강이' },
    { name: '두려움', score: emotionScores['두려움'] || 0, char: '보라' },
    { name: '부끄러움', score: emotionScores['부끄러움'] || 0, char: '주황이' }
  ].filter(e => e.score > 0).sort((a, b) => b.score - a.score)

  // 가장 높은 부정 감정 2-3개 선택
  const topEmotions = negativeEmotions.slice(0, 3)
  
  if (topEmotions.length === 0) {
    // 부정 감정이 없으면 기본 위로 메시지
    const letter = {
      title: '💧 우물이 넘쳤어요',
      content: `스트레스 우물의 물이 가득 차서 넘쳤어요. 힘들었던 마음은 이대로 흘려 보내고, 좋아하는 일들로 마음을 채워 보세요. 기분이 나아질 거예요. 💙`,
      from: '무지개 주민들',
      type: 'comfort',
      date: new Date().toISOString().split('T')[0]
    }
    return await addLetter(letter)
  }

  // 주민들의 위로 메시지 구성
  const comfortMessages = []
  
  if (topEmotions[0]) {
    const e1 = topEmotions[0]
    if (e1.name === '슬픔') {
      comfortMessages.push(`${e1.char}: "슬픈 감정이 많았구나... 나도 그런 날이 있어. 울어도 괜찮아. 눈물이 닦여지면 조금 나아질 거야."`)
    } else if (e1.name === '분노') {
      comfortMessages.push(`${e1.char}: "화가 많이 났구나. 그 감정도 이해해. 하지만 너무 자신을 힘들게 하지는 마. 화도 때로는 필요하지만, 너 자신에게 너무 엄격하지 말아줘."`)
    } else if (e1.name === '두려움') {
      comfortMessages.push(`${e1.char}: "무서웠구나... 두려움은 자연스러운 감정이야. 하지만 너는 이미 그걸 견뎌냈어. 너는 생각보다 훨씬 용감해."`)
    } else if (e1.name === '부끄러움') {
      comfortMessages.push(`${e1.char}: "부끄러웠구나... 나도 그런 때가 있어. 하지만 너는 괜찮아. 완벽하지 않아도 돼. 그게 바로 사람이니까."`)
    }
  }

  if (topEmotions[1]) {
    const e2 = topEmotions[1]
    if (e2.name === '슬픔') {
      comfortMessages.push(`${e2.char}: "슬픔도 감정의 일부야. 그 감정을 받아들이고, 시간이 지나면 나아질 거야."`)
    } else if (e2.name === '분노') {
      comfortMessages.push(`${e2.char}: "화도 괜찮아. 하지만 그 감정에 사로잡히지 말고, 자신을 다독여줘."`)
    } else if (e2.name === '두려움') {
      comfortMessages.push(`${e2.char}: "두려워도 괜찮아. 그 감정을 인정하고, 천천히 나아가면 돼."`)
    } else if (e2.name === '부끄러움') {
      comfortMessages.push(`${e2.char}: "부끄러움도 괜찮아. 모든 사람이 그런 때가 있어. 너만 그런 게 아니야."`)
    }
  }

  // 긍정적인 주민들도 위로 메시지 추가
  comfortMessages.push(`노랑이: "힘든 날이었구나. 하지만 내일은 더 나은 날이 될 거야. 나와 함께 긍정적인 에너지를 모아볼까?"`)
  comfortMessages.push(`초록이: "사랑해. 너는 소중해. 힘든 날에도 너는 충분히 잘하고 있어. 나는 항상 네 편이야."`)

  const letter = {
    title: '💧 우물이 넘쳤어요 - 주민들의 위로',
    content: `스트레스 우물의 물이 가득 차서 넘쳤어요. 힘든 하루였나봐요.\n\n주민들이 위로의 말을 전해요:\n\n${comfortMessages.join('\n\n')}\n\n힘든 날도 지나가고, 긍정적인 감정들이 물을 줄여줄 거예요. 조금만 견뎌보세요. 당신은 충분히 강해요. 💙`,
    from: topEmotions.map(e => e.char).join(', ') + ', 노랑이, 초록이',
    type: 'comfort',
    date: new Date().toISOString().split('T')[0]
  }
  
  return await addLetter(letter)
}

/**
 * 부정 감정만 있을 때 사랑 주민의 위로 편지
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addNegativeOnlyComfortLetter() {
  const letter = {
    title: '💌 힘든 날, 노랑이(기쁨)의 위로',
    content: `오늘 일기에는 힘든 감정들만 가득했구나. 괜찮아, 그런 날도 있는 법이지. 하지만 너의 마음 속에는 나도 존재하고 있다는 걸 잊지 마! 내일은 더 나은 날이 될 거야. 💚`,
    from: '노랑이',
    type: 'comfort',
    date: new Date().toISOString().split('T')[0]
  }
  return await addLetter(letter)
}

/**
 * 긍정 감정만 있을 때 초록이(사랑)의 응원 편지
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function addPositiveOnlyCheerLetter() {
  const letter = {
    title: '✨ 기쁜 날, 사랑이의 응원',
    content: `오늘 일기에는 행복한 감정들만 가득했구나! 정말 멋진 하루였어! 네가 느끼는 행복이 나에게도 전해지는 것 같아. 앞으로도 반짝이는 하루들을 만들어가자. 💛`,
    from: '초록이',
    type: 'cheer',
    date: new Date().toISOString().split('T')[0]
  }
  return await addLetter(letter)
}
