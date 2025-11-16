import { useState, useEffect } from 'react'
import { getAllDiaries } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import './Home.css'

function Home({ onNavigate, selectedDate }) {
  const [date, setDate] = useState(selectedDate || getTodayDateString())
  const [availableDates, setAvailableDates] = useState([])

  useEffect(() => {
    // 일기가 있는 날짜 목록 가져오기
    const loadDates = async () => {
      const diaries = await getAllDiaries()
      const dates = [...new Set(diaries.map(diary => diary.date))].sort().reverse()
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
      <div className="home-content">
        {/* 마을 입구 제목 */}
        <div className="home-title-section">
          <h1 className="home-title">
            감정 마을
          </h1>
          <p className="home-subtitle">
            당신의 감정이 살아있는 마을에 오신 것을 환영합니다
          </p>
        </div>

        {/* 마을 안내도 버튼 */}
        <div className="home-guide-section">
          <button
            className="home-guide-button"
            onClick={() => onNavigate && onNavigate('guide')}
          >
            🗺️ 마을 안내도
          </button>
          <p className="home-guide-hint">
            마을 소개와 주민들을 만나보세요
          </p>
        </div>

        {/* 날짜 선택 섹션 */}
        <div className="home-date-section">
          <label htmlFor="date-select" className="home-date-label">
            확인할 날짜를 선택하세요
          </label>
          <input
            type="date"
            id="date-select"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="home-date-input"
            max={getTodayDateString()}
          />
          <p className="home-date-display">
            {formatDateDisplay(date)}
          </p>
          {availableDates.length > 0 && (
            <div className="home-date-hint">
              <p>일기가 있는 날짜:</p>
              <div className="home-date-list">
                {availableDates.slice(0, 5).map(d => (
                  <button
                    key={d}
                    className={`home-date-quick-select ${d === date ? 'active' : ''}`}
                    onClick={() => setDate(d)}
                  >
                    {new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 마을 입장 버튼 */}
        <div className="home-enter-section">
          <button
            className="enter-village-button"
            onClick={handleEnterVillage}
          >
            🏘️ 마을 입장하기
          </button>
          <p className="enter-village-hint">
            선택한 날짜의 마을 상태를 확인할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home
