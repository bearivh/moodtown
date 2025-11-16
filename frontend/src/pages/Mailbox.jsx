import { useState, useEffect } from 'react'
import { getAllLetters, markLetterAsRead, deleteLetter, getUnreadLetterCount } from '../utils/mailboxUtils'
import './Mailbox.css'

function Mailbox({ onNavigate, selectedDate }) {
  const [letters, setLetters] = useState([])
  const [selectedLetter, setSelectedLetter] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)

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
    setLetters(allLetters)
    // getAllLetters에서 이미 편지 목록을 가져왔으므로, 여기서는 읽지 않은 개수만 계산
    const unreadCount = allLetters.filter(letter => !letter.isRead && !letter.read).length
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
    if (window.confirm('이 편지를 삭제하시겠습니까?')) {
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
      <div className="mailbox-header">
        {onNavigate && (
          <button
            className="mailbox-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <h1 className="mailbox-title">감정 우체통</h1>
        <p className="mailbox-subtitle">
          주민들이 보낸 편지를 확인하세요
          {unreadCount > 0 && (
            <span className="mailbox-unread-badge">읽지 않은 편지 {unreadCount}개</span>
          )}
        </p>
      </div>

      <div className="mailbox-content">
        {/* 편지 목록 */}
        <div className="mailbox-letters-section">
          <h2 className="mailbox-section-title">편지 목록</h2>
          {letters.length === 0 ? (
            <div className="mailbox-empty">
              <div className="mailbox-empty-icon">📭</div>
              <p>편지가 없습니다.</p>
              <p className="mailbox-empty-hint">
                행복 나무에서 열매가 열리거나, 스트레스 우물이 넘치거나,<br />
                일기를 작성하면 주민들이 편지를 보내요!
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


