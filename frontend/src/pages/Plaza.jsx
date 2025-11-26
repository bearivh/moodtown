import { useState, useEffect, useRef } from 'react'
import { getDiariesByDate, getPlazaConversationByDate, savePlazaConversationByDate } from '../utils/storage'
import { analyzeDiary, parseDialogue, chatWithCharacters } from '../utils/api'
import { normalizeEmotionScores } from '../utils/emotionUtils'
import { getCachedDiariesForDate, setDiariesForDate } from '../utils/diaryCache'
import FloatingResidents from '../components/FloatingResidents'
import redImage from '../assets/characters/red.png'
import orangeImage from '../assets/characters/orange.png'
import yellowImage from '../assets/characters/yellow.png'
import greenImage from '../assets/characters/green.png'
import blueImage from '../assets/characters/blue.png'
import navyImage from '../assets/characters/navy.png'
import purpleImage from '../assets/characters/purple.png'
import './Plaza.css'

// 모듈 레벨 캐시 - 컴포넌트 언마운트와 무관하게 유지됨
const plazaDataCache = new Map()

// 캐릭터 정보 (백엔드 characters.json과 동기화)
const CHARACTER_INFO = {
  '기쁨': { name: '노랑이', emoji: '🟡', color: '#eab308', pastelColor: '#fff9cc', image: yellowImage },
  '사랑': { name: '초록이', emoji: '🟢', color: '#22c55e', pastelColor: '#ccffcc', image: greenImage },
  '놀람': { name: '보라', emoji: '🟣', color: '#a855f7', pastelColor: '#f0e6ff', image: purpleImage },
  '두려움': { name: '남색이', emoji: '🔷', color: '#6366f1', pastelColor: '#d4d1ff', image: navyImage },
  '분노': { name: '빨강이', emoji: '🔴', color: '#ef4444', pastelColor: '#ffcccc', image: redImage },
  '부끄러움': { name: '주황이', emoji: '🟠', color: '#f97316', pastelColor: '#ffe4cc', image: orangeImage },
  '슬픔': { name: '파랑이', emoji: '🔵', color: '#3b82f6', pastelColor: '#cce4ff', image: blueImage }
}

function Plaza({ onNavigate, selectedDate }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 챗봇 관련 상태
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false) // 채팅 기능 활성화 여부
  const [chatCollapsed, setChatCollapsed] = useState(false) // 채팅창 접힘 여부
  const chatEndRef = useRef(null)
  
  // 설명서 관련 상태
  const [showInfo, setShowInfo] = useState(false)

  // 초기값을 캐시에서 가져오기 (lazy initialization)
  const [dateDiaries, setDateDiaries] = useState(() => {
    if (selectedDate) {
      // 먼저 모듈 레벨 캐시 확인
      const cached = plazaDataCache.get(selectedDate)
      if (cached?.diaries) {
        return cached.diaries
      }
      // 일기 캐시 확인
      const cachedDiaries = getCachedDiariesForDate(selectedDate)
      if (cachedDiaries) {
        return cachedDiaries
      }
    }
    return []
  })
  
  const [conversation, setConversation] = useState(() => {
    if (selectedDate) {
      const cached = plazaDataCache.get(selectedDate)
      return cached?.conversation || []
    }
    return []
  })
  
  const [emotionScores, setEmotionScores] = useState(() => {
    if (selectedDate) {
      const cached = plazaDataCache.get(selectedDate)
      return cached?.emotionScores || {}
    }
    return {}
  })

  useEffect(() => {
    if (!selectedDate) return

    let isMounted = true // 컴포넌트가 마운트되어 있는지 추적

    // 캐시에서 즉시 복원
    const cached = plazaDataCache.get(selectedDate)
    if (cached && cached.conversation && cached.conversation.length > 0) {
      // 캐시에 대화가 있으면 즉시 표시하고 API 호출 건너뛰기
      setConversation(cached.conversation || [])
      setEmotionScores(cached.emotionScores || {})
      setDateDiaries(cached.diaries || [])
      setLoading(false)
      setShowChat(true)
      return // 캐시에 저장된 대화가 있으면 여기서 종료
    } else if (cached) {
      // 캐시에 일기는 있지만 대화가 없는 경우
      setConversation(cached.conversation || [])
      setEmotionScores(cached.emotionScores || {})
      setDateDiaries(cached.diaries || [])
      setLoading(false)
    } else {
      // 일기 캐시 확인
      const cachedDiaries = getCachedDiariesForDate(selectedDate)
      if (cachedDiaries) {
        setDateDiaries(cachedDiaries)
      }
    }

    const loadData = async () => {
      // 캐시에 저장된 대화가 있으면 API 호출 건너뛰기
      const cached = plazaDataCache.get(selectedDate)
      if (cached && cached.conversation && cached.conversation.length > 0) {
        return
      }
      // 선택한 날짜의 일기 가져오기 (캐시 확인 후)
      let diaries = getCachedDiariesForDate(selectedDate)
      if (!diaries) {
        diaries = await getDiariesByDate(selectedDate)
        if (!isMounted) return
        // 캐시에 저장
        setDiariesForDate(selectedDate, diaries)
      }
      
      setDateDiaries(diaries)

      // 일기가 있으면 저장된 대화가 있는지 확인
      if (diaries.length > 0) {
        // 먼저 저장된 대화 확인
        const savedConversation = await getPlazaConversationByDate(selectedDate)
        if (!isMounted) return
        
        if (savedConversation && savedConversation.conversation && savedConversation.conversation.length > 0) {
          // 저장된 대화가 있으면 불러오기 (재생성하지 않음, 로딩 없이 즉시 표시)
          setConversation(savedConversation.conversation)
          setEmotionScores(savedConversation.emotionScores || {})
          setLoading(false)
          // 대화가 있으면 챗봇 활성화
          setShowChat(true)
          
          // 모듈 레벨 캐시에 저장
          plazaDataCache.set(selectedDate, {
            conversation: savedConversation.conversation,
            emotionScores: savedConversation.emotionScores || {},
            diaries: diaries
          })
          return // 저장된 대화가 있으면 여기서 종료
        } else {
          // 저장된 대화가 없으면 새로 생성 (이 경우에만 로딩 표시)
          setLoading(true)
          const combinedContent = diaries.map(d => d.content).join('\n\n')
          analyzeDateDiaries(combinedContent)
        }
      } else {
        setConversation([])
        setEmotionScores({})
        setLoading(false)
        
        // 모듈 레벨 캐시에도 저장
        plazaDataCache.set(selectedDate, {
          conversation: [],
          emotionScores: {},
          diaries: diaries
        })
      }
    }
    
    loadData()
    
    // cleanup 함수: 컴포넌트가 언마운트되면 플래그 설정
    return () => {
      isMounted = false
    }
  }, [selectedDate])

  const analyzeDateDiaries = async (content) => {
    if (!content.trim()) return

    // 이미 저장된 대화가 있는지 다시 확인 (중복 생성 방지)
    const existingConversation = await getPlazaConversationByDate(selectedDate)
    if (existingConversation && existingConversation.conversation && existingConversation.conversation.length > 0) {
      // 이미 저장된 대화가 있으면 불러오기만 하고 재생성하지 않음
      setConversation(existingConversation.conversation)
      setEmotionScores(existingConversation.emotionScores || {})
      setLoading(false)
      // 캐시 업데이트
      plazaDataCache.set(selectedDate, {
        conversation: existingConversation.conversation,
        emotionScores: existingConversation.emotionScores || {},
        diaries: dateDiaries
      })
      return
    }

    setLoading(true)
    setError('')
    setConversation([])

    try {
      const result = await analyzeDiary(content)
      
      // 감정 점수 설정
      const scores = result.emotion_result?.emotion_scores || {}
      setEmotionScores(scores)
      
      // 대화 파싱
      let dialogue = parseDialogue(result.openai_dialogue || '')
      
      // 가장 높은 감정이 대화에 포함되어 있는지 확인
      if (scores && Object.keys(scores).length > 0) {
        const sortedEmotions = Object.entries(scores)
          .sort(([, a], [, b]) => (b || 0) - (a || 0))
        const highestEmotion = sortedEmotions[0]?.[0]
        
        if (highestEmotion) {
          const highestEmotionName = CHARACTER_INFO[highestEmotion]?.name
          
          // 가장 높은 감정의 주민이 대화에 참여했는지 확인
          const hasHighestEmotion = dialogue.some(msg => {
            const emotion = msg.감정 || msg.emotion || ''
            const characterName = msg.캐릭터 || msg.character || ''
            return emotion === highestEmotion || characterName === highestEmotionName
          })
          
          // 가장 높은 감정의 주민이 대화에 없으면 추가
          if (!hasHighestEmotion && highestEmotionName) {
            const highestEmotionInfo = CHARACTER_INFO[highestEmotion]
            if (highestEmotionInfo) {
              // 가장 높은 감정의 주민 대화 추가 (간단한 대사)
              dialogue = [
                {
                  캐릭터: highestEmotionName,
                  character: highestEmotionName,
                  감정: highestEmotion,
                  emotion: highestEmotion,
                  대사: `${highestEmotionName === '초록이' ? '오늘 정말 따뜻한 하루였어.' : 
                         highestEmotionName === '노랑이' ? '와! 정말 기분 좋은 하루였어!' :
                         highestEmotionName === '파랑이' ? '오늘은 좀 그런 날이었어...' :
                         highestEmotionName === '빨강이' ? '오늘 정말 짜증났어.' :
                         highestEmotionName === '남색이' ? '오늘 좀 불안했어...' :
                         highestEmotionName === '주황이' ? '오늘 좀 창피했어...' :
                         highestEmotionName === '보라' ? '헉! 오늘 정말 놀라운 일이 있었어!' :
                         '오늘 하루 생각해본다.'}`
                },
                ...dialogue
              ]
            }
          }
        }
      }
      
      setConversation(dialogue)
      
      // 대화 저장
      if (selectedDate && dialogue.length > 0) {
        await savePlazaConversationByDate(selectedDate, dialogue, scores)
        // 모듈 레벨 캐시 업데이트
        plazaDataCache.set(selectedDate, {
          conversation: dialogue,
          emotionScores: scores,
          diaries: dateDiaries
        })
        // 대화 생성 완료 후 챗봇 활성화
        setShowChat(true)
        
        // 캐시에 저장 (다음에 재진입 시 즉시 표시)
        savedDataRef.current[selectedDate] = {
          conversation: dialogue,
          emotionScores: scores,
          diaries: dateDiaries
        }
      }
      
    } catch (err) {
      console.error('분석 오류:', err)
      setError('일기 분석에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  // 챗봇 메시지 전송
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setChatLoading(true)

    // 사용자 메시지 추가
    const newUserMsg = { type: 'user', text: userMessage }
    setChatMessages(prev => [...prev, newUserMsg])

    try {
      // 활성 캐릭터 목록 추출 (감정 점수가 있는 상위 4개)
      const activeEmotions = Object.entries(emotionScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
        .map(([emotion]) => emotion)

      const result = await chatWithCharacters(userMessage, activeEmotions, selectedDate)
      console.log('[챗봇] 백엔드 응답:', result)
      
      const dialogue = parseDialogue(result.reply || '')
      console.log('[챗봇] 파싱된 대화:', dialogue)

      // 주민들의 응답 추가 (빈 텍스트 필터링)
      if (dialogue.length > 0) {
        const validMessages = dialogue
          .map(msg => ({
            type: 'character',
            character: msg.캐릭터 || msg.character || '',
            emotion: msg.감정 || msg.emotion || '',
            text: msg.대사 || msg.text || msg.dialogue || ''
          }))
          .filter(msg => msg.text && msg.text.trim().length > 0) // 빈 텍스트 제거
        
        if (validMessages.length > 0) {
          setChatMessages(prev => [...prev, ...validMessages])
        } else {
          console.warn('[챗봇] 파싱된 대화가 있지만 유효한 텍스트가 없음')
          setChatMessages(prev => [...prev, {
            type: 'system',
            text: '주민들의 응답을 준비하고 있어요...'
          }])
        }
      } else {
        console.warn('[챗봇] 대화 파싱 실패 또는 빈 응답')
        setChatMessages(prev => [...prev, {
          type: 'system',
          text: '주민들이 응답을 준비하고 있어요...'
        }])
      }
    } catch (err) {
      console.error('채팅 오류:', err)
      setChatMessages(prev => [...prev, {
        type: 'system',
        text: '주민들과 대화하는 중 오류가 발생했어요.'
      }])
    } finally {
      setChatLoading(false)
      // 스크롤을 맨 아래로
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }

  // Enter 키로 메시지 전송
  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleChatSend()
    }
  }

  // 챗봇 메시지 스크롤
  useEffect(() => {
    if (showChat) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }, [chatMessages, showChat])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })
  }

  return (
    <div className="plaza-container">
      <FloatingResidents count={2} />
      <div className="plaza-header">
        {onNavigate && (
          <button
            className="plaza-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <div className="plaza-header-content">
          <h1 className="plaza-title">와글와글 광장</h1>
          <p className="plaza-subtitle">
            {selectedDate ? formatDate(selectedDate) : ''}의 주민들 대화
          </p>
        </div>
        <button 
          className="plaza-info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="plaza-info-toggle-icon">{showInfo ? '📖' : '📘'}</span>
          <span className="plaza-info-toggle-text">광장 설명서</span>
        </button>
      </div>

      {/* 설명 섹션 - 버튼 바로 밑에 표시 */}
      {showInfo && (
        <div className="plaza-info-section">
          <div className="plaza-info-content-wrapper">
            <h3 className="plaza-info-title">광장이 작동하는 방법</h3>
            <div className="plaza-info-cards">
              <div className="plaza-info-card">
                <span className="plaza-info-icon">📊</span>
                <div className="plaza-info-content">
                  <span className="plaza-info-text">일기를 작성하면</span>
                  <span className="plaza-info-arrow">→</span>
                  <span className="plaza-info-result">감정 분석 결과가 표시돼요</span>
                </div>
              </div>
              <div className="plaza-info-card">
                <span className="plaza-info-icon">💬</span>
                <div className="plaza-info-content">
                  <span className="plaza-info-text">감정 분석 결과를 바탕으로</span>
                  <span className="plaza-info-arrow">→</span>
                  <span className="plaza-info-result">주민들이 대화를 시작해요</span>
                </div>
              </div>
              <div className="plaza-info-card">
                <span className="plaza-info-icon">🤖</span>
                <div className="plaza-info-content">
                  <span className="plaza-info-text">주민들과 대화하기에서</span>
                  <span className="plaza-info-arrow">→</span>
                  <span className="plaza-info-result">주민들과 직접 채팅할 수 있어요</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="plaza-content">
        {loading && (
          <div className="plaza-loading">
            <div className="plaza-loading-spinner"></div>
            <p>주민들이 모이는 중...</p>
          </div>
        )}

        {error && (
          <div className="plaza-error">
            {error}
          </div>
        )}

        {!loading && !error && dateDiaries.length === 0 && (
          <div className="plaza-empty">
            <p>이 날짜에는 일기가 없어요.</p>
            <button 
              className="plaza-write-button"
              onClick={() => onNavigate && onNavigate('write')}
            >
              일기 쓰기
            </button>
          </div>
        )}

        {!loading && !error && dateDiaries.length > 0 && conversation.length > 0 && (
          <>
            {/* 감정 점수 표시 */}
            <div className="plaza-emotions">
              <h3>감정 분석 결과</h3>
              <div className="plaza-emotion-scores">
                {Object.entries(normalizeEmotionScores(emotionScores))
                  .sort(([, a], [, b]) => b - a)
                  .map(([emotion, score]) => {
                    const charInfo = CHARACTER_INFO[emotion]
                    const normalizedScore = Math.round(score)
                    return (
                      <div key={emotion} className="plaza-emotion-item">
                        {charInfo?.image ? (
                          <img src={charInfo.image} alt={charInfo.name} className="plaza-emotion-image" />
                        ) : (
                          <span className="plaza-emotion-emoji">{charInfo?.emoji || '😊'}</span>
                        )}
                        <span className="plaza-emotion-name">
                          {charInfo?.name || emotion} ({emotion})
                        </span>
                        <div className="plaza-emotion-bar">
                          <div 
                            className="plaza-emotion-bar-fill"
                            style={{ 
                              width: `${normalizedScore}%`,
                              backgroundColor: charInfo?.color || '#9ca3af'
                            }}
                          ></div>
                        </div>
                        <span className="plaza-emotion-score">{normalizedScore}%</span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* 대화와 채팅을 가로로 배치 */}
            <div className="plaza-conversation-chat-wrapper">
              {/* 대화 표시 */}
              <div className="plaza-conversation">
                <h3 className="plaza-conversation-title">주민들 대화</h3>
                <div className="plaza-conversation-messages">
                  {conversation.map((msg, idx) => {
                    const emotion = msg.감정 || msg.emotion || ''
                    const characterName = msg.캐릭터 || msg.character || ''
                    const text = msg.대사 || msg.text || msg.dialogue || ''
                    
                    // 감정명으로 찾기
                    let charInfo = CHARACTER_INFO[emotion]
                    
                    // 캐릭터 이름으로 찾기 (감정명으로 못 찾은 경우)
                    if (!charInfo && characterName) {
                      charInfo = Object.values(CHARACTER_INFO).find(
                        char => char.name === characterName
                      )
                      
                      if (!charInfo) {
                        const emotionByChar = Object.keys(CHARACTER_INFO).find(
                          emo => CHARACTER_INFO[emo].name === characterName
                        )
                        if (emotionByChar) {
                          charInfo = CHARACTER_INFO[emotionByChar]
                        }
                      }
                    }
                    
                    // 기본값 설정
                    if (!charInfo) {
                      charInfo = { name: characterName || emotion, emoji: '😊', color: '#9ca3af' }
                    }
                    
                    return (
                      <div key={idx} className="plaza-message">
                        <div 
                          className="plaza-message-avatar"
                          style={{ backgroundColor: charInfo.pastelColor || charInfo.color }}
                        >
                          {charInfo.image ? (
                            <img src={charInfo.image} alt={charInfo.name} className="plaza-character-image" />
                          ) : (
                            charInfo.emoji
                          )}
                        </div>
                        <div className="plaza-message-content">
                          <div className="plaza-message-name">
                            {charInfo.name}
                          </div>
                          <div className="plaza-message-text">{text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 챗봇 섹션 */}
              {showChat && (
                <div className="plaza-chat-section">
                <div className="plaza-chat-header">
                  <h3>주민들과 대화하기</h3>
                  <button 
                    className="plaza-chat-toggle"
                    onClick={() => setChatCollapsed(!chatCollapsed)}
                  >
                    {chatCollapsed ? '펼치기' : '접기'}
                  </button>
                </div>
                {!chatCollapsed && (
                <div className="plaza-chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="plaza-chat-empty">
                      <p>. . . 💬</p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => {
                    if (msg.type === 'user') {
                      return (
                        <div key={idx} className="plaza-chat-message plaza-chat-message-user">
                          <div className="plaza-chat-message-text">{msg.text}</div>
                        </div>
                      )
                    } else if (msg.type === 'character') {
                      // 빈 텍스트가 있으면 렌더링하지 않음
                      if (!msg.text || !msg.text.trim()) {
                        return null
                      }
                      
                      const characterName = msg.character
                      const emotion = msg.emotion
                      let charInfo = CHARACTER_INFO[emotion]
                      
                      if (!charInfo && characterName) {
                        charInfo = Object.values(CHARACTER_INFO).find(
                          char => char.name === characterName
                        )
                        if (!charInfo) {
                          const emotionByChar = Object.keys(CHARACTER_INFO).find(
                            emo => CHARACTER_INFO[emo].name === characterName
                          )
                          if (emotionByChar) {
                            charInfo = CHARACTER_INFO[emotionByChar]
                          }
                        }
                      }
                      
                      if (!charInfo) {
                        charInfo = { name: characterName || emotion, emoji: '😊', color: '#9ca3af' }
                      }
                      
                      return (
                        <div key={idx} className="plaza-chat-message plaza-chat-message-character">
                          <div 
                            className="plaza-chat-message-avatar"
                            style={{ backgroundColor: charInfo.pastelColor || charInfo.color }}
                          >
                            {charInfo.image ? (
                              <img src={charInfo.image} alt={charInfo.name} className="plaza-character-image" />
                            ) : (
                              charInfo.emoji
                            )}
                          </div>
                          <div className="plaza-chat-message-content">
                            <div className="plaza-chat-message-name">{charInfo.name}</div>
                            <div className="plaza-chat-message-text">{msg.text}</div>
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <div key={idx} className="plaza-chat-message plaza-chat-message-system">
                          <div className="plaza-chat-message-text">{msg.text}</div>
                        </div>
                      )
                    }
                  })}
                  {chatLoading && (
                    <div className="plaza-chat-message plaza-chat-message-system">
                      <div className="plaza-chat-message-text">주민들이 생각하고 있어요...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                )}
                {!chatCollapsed && (
                <div className="plaza-chat-input-container">
                  <input
                    type="text"
                    className="plaza-chat-input"
                    placeholder="주민들에게 말을 걸어 보세요..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    disabled={chatLoading}
                  />
                  <button
                    className="plaza-chat-send-button"
                    onClick={handleChatSend}
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    전송
                  </button>
                </div>
                )}
              </div>
              )}
            </div>
          </>
        )}

        {!loading && !error && dateDiaries.length > 0 && conversation.length === 0 && (
          <div className="plaza-empty-conversation">
            <p>대화를 생성할 수 없어요.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Plaza

