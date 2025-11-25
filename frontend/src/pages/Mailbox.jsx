import { useState, useEffect } from 'react'
import { getAllLetters, markLetterAsRead, deleteLetter, getUnreadLetterCount } from '../utils/mailboxUtils'
import FloatingResidents from '../components/FloatingResidents'
import './Mailbox.css'

function Mailbox({ onNavigate, selectedDate }) {
  const [letters, setLetters] = useState([])
  const [selectedLetter, setSelectedLetter] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    loadLetters()
    
    // 주기적으로 편지 목록 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadLetters()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [])

  const loadLetters = async () => {
    const allLetters = await getAllLetters()
    
    // 편지 정렬: 안 읽은 편지가 먼저, 그 다음 최신순
    const sortedLetters = allLetters.sort((a, b) => {
      // 안 읽은 편지 우선 (isRead 또는 read 또는 is_read 필드 확인)
      const aIsRead = !!(a.isRead || a.read || a.is_read)
      const bIsRead = !!(b.isRead || b.read || b.is_read)
      
      // 안 읽은 편지가 위로 (false가 먼저)
      if (aIsRead !== bIsRead) {
        return aIsRead ? 1 : -1
      }
      
      // 같은 읽음 상태면 날짜/시간으로 정렬 (최신순)
      // created_at을 우선적으로 사용하고, 없으면 date 사용
      const aTime = a.createdAt || a.created_at || a.date || ''
      const bTime = b.createdAt || b.created_at || b.date || ''
      
      // 날짜/시간을 Date 객체로 변환하여 비교
      let aDate = null
      let bDate = null
      
      try {
        if (aTime) {
          // ISO 형식 타임스탬프 (2024-01-01T12:00:00.000Z) 또는 날짜 형식 (2024-01-01)
          if (aTime.includes('T')) {
            aDate = new Date(aTime)
          } else {
            // YYYY-MM-DD 형식인 경우
            aDate = new Date(aTime + 'T00:00:00')
          }
        }
      } catch (e) {
        console.warn('날짜 파싱 실패:', aTime, e)
      }
      
      try {
        if (bTime) {
          if (bTime.includes('T')) {
            bDate = new Date(bTime)
          } else {
            bDate = new Date(bTime + 'T00:00:00')
          }
        }
      } catch (e) {
        console.warn('날짜 파싱 실패:', bTime, e)
      }
      
      // 둘 다 날짜가 있으면 비교 (더 최신 것이 먼저)
      if (aDate && bDate) {
        const diff = bDate.getTime() - aDate.getTime()
        if (diff !== 0) return diff > 0 ? 1 : -1
      } else if (aDate && !bDate) {
        return -1 // a가 더 최신
      } else if (!aDate && bDate) {
        return 1 // b가 더 최신
      }
      
      // 날짜가 없으면 문자열로 비교
      if (aTime && bTime) {
        const diff = bTime.localeCompare(aTime)
        if (diff !== 0) return diff
      } else if (aTime && !bTime) {
        return -1
      } else if (!aTime && bTime) {
        return 1
      }
      
      // 날짜도 없으면 ID로 정렬 (큰 ID가 먼저, 더 최근 것)
      const aId = parseInt(a.id) || 0
      const bId = parseInt(b.id) || 0
      return bId - aId
    })
    
    setLetters(sortedLetters)
    // 읽지 않은 개수 계산
    const unreadCount = sortedLetters.filter(letter => {
      const isRead = letter.isRead || letter.read || letter.is_read
      return !isRead
    }).length
    setUnreadCount(unreadCount)
  }

  const handleLetterClick = async (letter) => {
    setSelectedLetter(letter)
    
    // 읽지 않은 편지면 읽음 처리
    if (!letter.isRead && !letter.read) {
      await markLetterAsRead(letter.id)
      await loadLetters()
    }
  }

  const handleDeleteLetter = async (id) => {
    if (window.confirm('이 편지를 정말 삭제하시겠어요?')) {
      await deleteLetter(id)
      await loadLetters()
      
      // 삭제한 편지가 선택된 편지면 선택 해제
      if (selectedLetter && selectedLetter.id === id) {
        setSelectedLetter(null)
      }
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    })
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'celebration':
        return '🎉'
      case 'comfort':
        return '💙'
      case 'cheer':
        return '💛'
      default:
        return '📮'
    }
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'celebration':
        return '#fef3c7'
      case 'comfort':
        return '#dbeafe'
      case 'cheer':
        return '#fef3c7'
      default:
        return '#f3f4f6'
    }
  }

  return (
    <div className="mailbox-container">
      <FloatingResidents count={2} />
      <div className="mailbox-header">
        {onNavigate && (
          <button
            className="mailbox-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <div className="mailbox-header-content">
          <h1 className="mailbox-title">감정 우체통</h1>
          <p className="mailbox-subtitle">
            주민들이 보낸 편지를 확인하세요.
          </p>
        </div>
        <button 
          className="mailbox-info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="mailbox-info-toggle-icon">{showInfo ? '📖' : '📘'}</span>
          <span className="mailbox-info-toggle-text">우체통 설명서</span>
        </button>
      </div>

      {/* 설명 섹션 - 버튼 바로 밑에 표시 */}
      {showInfo && (
        <div className="mailbox-info-section">
          <div className="mailbox-info-content-wrapper">
            <h3 className="mailbox-info-title">우체통이 하는 일</h3>
            <div className="mailbox-info-cards">
              <div className="mailbox-info-card">
                <span className="mailbox-info-icon">🎉</span>
                <div className="mailbox-info-content">
                  <span className="mailbox-info-text">행복 나무에서 열매가 열리면</span>
                  <span className="mailbox-info-arrow">→</span>
                  <span className="mailbox-info-result">축하 편지가 도착해요</span>
                </div>
              </div>
              <div className="mailbox-info-card">
                <span className="mailbox-info-icon">💙</span>
                <div className="mailbox-info-content">
                  <span className="mailbox-info-text">스트레스 우물이 넘치면</span>
                  <span className="mailbox-info-arrow">→</span>
                  <span className="mailbox-info-result">위로 편지가 도착해요</span>
                </div>
              </div>
              <div className="mailbox-info-card">
                <span className="mailbox-info-icon">✉️</span>
                <div className="mailbox-info-content">
                  <span className="mailbox-info-text">편지를 읽으면</span>
                  <span className="mailbox-info-arrow">→</span>
                  <span className="mailbox-info-result">자동으로 읽음 처리돼요</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 우측 상단에 작은 알림 배지들 */}
      {unreadCount > 0 && (
        <div className="mailbox-alerts">
          <div className="mailbox-unread-notice">
            <span className="mailbox-unread-notice-icon">📬</span>
            <span className="mailbox-unread-notice-text">
              읽지 않은 편지 <strong>{unreadCount}개</strong>가 도착했어요!
            </span>
          </div>
        </div>
      )}

      <div className="mailbox-content">
        {/* 편지 목록 */}
        <div className="mailbox-letters-section">
          <h2 className="mailbox-section-title">편지 목록</h2>
          {letters.length === 0 ? (
            <div className="mailbox-empty">
              <div className="mailbox-empty-icon">📭</div>
              <p>편지가 없습니다.</p>
              <p className="mailbox-empty-hint">
                행복 나무에서 열매가 열리거나, 스트레스 우물이 넘치면<br />무지개 주민들이 편지를 보내요!
              </p>
            </div>
          ) : (
            <div className="mailbox-letters-list">
              {letters.map((letter) => (
                <div
                  key={letter.id}
                  className={`mailbox-letter-card ${selectedLetter?.id === letter.id ? 'mailbox-letter-card-selected' : ''} ${(!letter.isRead && !letter.read) ? 'mailbox-letter-unread' : ''}`}
                  onClick={() => handleLetterClick(letter)}
                  style={{ borderLeftColor: getTypeColor(letter.type) }}
                >
                  <div className="mailbox-letter-header">
                    <span className="mailbox-letter-icon">{getTypeIcon(letter.type)}</span>
                    {(!letter.isRead && !letter.read) && (
                      <span className="mailbox-letter-unread-dot">●</span>
                    )}
                  </div>
                  <div className="mailbox-letter-title">{letter.title}</div>
                  <div className="mailbox-letter-from">From: {letter.from}</div>
                  <div className="mailbox-letter-date">{formatDate(letter.date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 편지 내용 */}
        <div className="mailbox-letter-detail-section">
          <h2 className="mailbox-section-title">편지 내용</h2>
          {selectedLetter ? (
            <div className="mailbox-letter-detail">
              <div 
                className="mailbox-letter-detail-header"
                style={{ backgroundColor: getTypeColor(selectedLetter.type) }}
              >
                <div className="mailbox-letter-detail-icon">
                  {getTypeIcon(selectedLetter.type)}
                </div>
                <div className="mailbox-letter-detail-info">
                  <h3 className="mailbox-letter-detail-title">{selectedLetter.title}</h3>
                  <div className="mailbox-letter-detail-meta">
                    <span className="mailbox-letter-detail-from">From: {selectedLetter.from}</span>
                    <span className="mailbox-letter-detail-date">{formatDate(selectedLetter.date)}</span>
                  </div>
                </div>
              </div>
              <div className="mailbox-letter-detail-content">
                {selectedLetter.content.split('\n').map((line, idx) => (
                  <p key={idx} className="mailbox-letter-detail-line">
                    {line}
                  </p>
                ))}
              </div>
              <div className="mailbox-letter-detail-actions">
                <button
                  className="mailbox-delete-button"
                  onClick={() => handleDeleteLetter(selectedLetter.id)}
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <div className="mailbox-letter-detail-empty">
              <div className="mailbox-letter-detail-empty-icon">✉️</div>
              <p>왼쪽에서 편지를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Mailbox


