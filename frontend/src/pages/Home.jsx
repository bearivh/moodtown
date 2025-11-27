import { useState, useEffect } from 'react'
import { getAllDiaries } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import moodtownLogo from '../assets/icons/moodtown!.svg'
import './Home.css'

function Home({ onNavigate, selectedDate, user, onLogout }) {
  const [date, setDate] = useState(selectedDate || getTodayDateString())
  const [availableDates, setAvailableDates] = useState([])
  const [showDateList, setShowDateList] = useState(false)

  useEffect(() => {
    // 일기가 있는 날짜 목록 가져오기 - 현재 월 기준으로만 필터링
    const loadDates = async () => {
      const diaries = await getAllDiaries()
      const today = new Date()
      const currentYear = today.getFullYear()
      const currentMonth = today.getMonth() + 1 // getMonth()는 0부터 시작하므로 +1
      
      // 현재 월의 날짜만 필터링
      const dates = [...new Set(diaries.map(diary => diary.date))]
        .filter(dateStr => {
          const date = new Date(dateStr + 'T00:00:00')
          return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth
        })
        .sort()
      setAvailableDates(dates)
    }
    loadDates()
    
    // 선택된 날짜가 있으면 그 날짜 사용
    if (selectedDate) {
      setDate(selectedDate)
    }
  }, [selectedDate])

  const handleEnterVillage = () => {
    if (onNavigate) {
      onNavigate('village', date)
    }
  }

  const formatDateDisplay = (dateStr) => {
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
    <div className="home-container">
      {/* 배경 구름 레이어 */}
      <div className="home-sky-clouds" aria-hidden="true">
        <div className="home-cloud cloud-1" />
        <div className="home-cloud cloud-2" />
        <div className="home-cloud cloud-3" />
        <div className="home-cloud cloud-4" />
      </div>

      {/* 아기자기한 마을 장식 요소들 */}
      <div className="home-village-decoration" aria-hidden="true">
        <div className="home-house house-1">🏠</div>
        <div className="home-house house-2">🏡</div>
        <div className="home-house house-3">🏘️</div>
        <div className="home-tree tree-1">🌳</div>
        <div className="home-tree tree-2">🌲</div>
        <div className="home-tree tree-3">☘️</div>
      </div>

      {/* 떠다니는 별 이모지들 */}
      <div className="home-floating-stars" aria-hidden="true">
        <div className="home-star star-1">⭐</div>
        <div className="home-star star-2">✨</div>
        <div className="home-star star-3">💫</div>
        <div className="home-star star-4">⭐</div>
        <div className="home-star star-5">✨</div>
        <div className="home-star star-6">💫</div>
        <div className="home-star star-7">⭐</div>
        <div className="home-star star-8">✨</div>
        <div className="home-star star-9">💫</div>
        <div className="home-star star-10">⭐</div>
      </div>

      <div className="home-content">
        {/* 로그아웃 버튼 */}
        {onLogout && (
          <div className="home-logout-section">
            <button
              className="home-logout-button"
              onClick={onLogout}
            >
              로그아웃
            </button>
          </div>
        )}
        
        {/* 마을 입구 제목 */}
        <div className="home-title-section">
          <img 
            src={moodtownLogo} 
            alt="moodtown!" 
            className="home-title-logo"
          />
        </div>

        {/* 날짜 선택 & 마을 입장 카드 */}
        <div className="home-action-card">
          {/* 마을 안내도 버튼 - 말풍선 */}
          <div className="home-guide-speech-bubble">
            <button
              className="home-guide-button"
              onClick={() => onNavigate && onNavigate('guide')}
            >
              🗺️ 마을 안내도
            </button>
          </div>

          {/* 귀여운 멘트 */}
          <div className="home-action-intro">
            <p className="home-action-intro-text">
              오늘은 어떤 마음의 마을로 놀러갈까요?
            </p>
            <p className="home-action-intro-hint">
              날짜를 선택하면, 그날의 감정들이 살고 있는 작은 마을이 열려요.
            </p>
          </div>

          {/* 날짜 선택 섹션 - 포탈 박스 */}
          <div className="home-date-section">
            <label htmlFor="date-select" className="home-date-label">
              확인할 날짜를 선택하세요.
            </label>
            <div className="home-portal-box">
              <div className="home-portal-glow"></div>
              <div className="home-portal-content">
                <input
                  type="date"
                  id="date-select"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="home-date-input"
                  max={getTodayDateString()}
                />
                {date && (
                  <p className="home-date-display">
                    {formatDateDisplay(date)}의 마을로 갈까요?
                  </p>
                )}
              </div>
            </div>
            {availableDates.length > 0 && (
              <div className="home-date-hint">
                <button 
                  className="home-date-toggle"
                  onClick={() => setShowDateList(!showDateList)}
                >
                  <span>{new Date().getMonth() + 1}월 일기가 있는 날짜 ({availableDates.length})</span>
                  <span className={`home-date-toggle-icon ${showDateList ? 'open' : ''}`}>▼</span>
                </button>
                {showDateList && (
                  <div className="home-date-list">
                    {availableDates.map(d => (
                      <button
                        key={d}
                        className={`home-date-quick-select ${d === date ? 'active' : ''}`}
                        onClick={() => setDate(d)}
                      >
                        {new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 마을 입장 버튼 */}
          <div className="home-enter-section">
            <button
              className="enter-village-button"
              onClick={handleEnterVillage}
            >
              🏘️ 마을 입장하기!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
