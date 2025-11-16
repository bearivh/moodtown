import { useState, useEffect } from 'react'
import { getAllDiaries, getDiariesByDate, getDominantEmotionByDate, getWeeklyEmotionStats } from '../utils/storage'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import { getTodayDateString } from '../utils/dateUtils'
import './Office.css'

function Office({ onNavigate, selectedDate: selectedDateFromVillage }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDiaries, setSelectedDiaries] = useState([])
  const [weeklyStats, setWeeklyStats] = useState(null)
  const [calendarData, setCalendarData] = useState({})
  const [selectedDateEmotionStats, setSelectedDateEmotionStats] = useState(null)
  const today = getTodayDateString()
  const isPastDate = selectedDateFromVillage && selectedDateFromVillage < today

  useEffect(() => {
    loadCalendarData()
    loadWeeklyStats()
  }, [currentMonth])

  useEffect(() => {
    if (selectedDateFromVillage && isPastDate) {
      loadSelectedDateEmotionStats()
    } else {
      setSelectedDateEmotionStats(null)
    }
  }, [selectedDateFromVillage])

  const loadSelectedDateEmotionStats = async () => {
    if (!selectedDateFromVillage) return
    
    const diaries = await getDiariesByDate(selectedDateFromVillage)
    if (diaries.length === 0) {
      setSelectedDateEmotionStats(null)
      return
    }
    
    // 선택한 날짜의 일기 감정 점수 합산
    const emotionStats = {
      '기쁨': 0,
      '사랑': 0,
      '놀람': 0,
      '두려움': 0,
      '분노': 0,
      '부끄러움': 0,
      '슬픔': 0
    }
    
    for (const diary of diaries) {
      const scores = diary.emotion_scores || {}
      Object.keys(emotionStats).forEach(emotion => {
        emotionStats[emotion] += scores[emotion] || 0
      })
    }
    
    setSelectedDateEmotionStats({
      date: selectedDateFromVillage,
      stats: emotionStats
    })
  }

  const loadCalendarData = async () => {
    const diaries = await getAllDiaries()
    const data = {}
    
    for (const diary of diaries) {
      if (diary.date) {
        const dominant = await getDominantEmotionByDate(diary.date)
        if (dominant) {
          data[diary.date] = dominant
        }
      }
    }
    
    setCalendarData(data)
  }

  const loadWeeklyStats = async () => {
    const stats = await getWeeklyEmotionStats()
    setWeeklyStats(stats)
  }

  const handleDateClick = async (dateStr) => {
    setSelectedDate(dateStr)
    const diaries = await getDiariesByDate(dateStr)
    setSelectedDiaries(diaries)
  }

  const handlePrevMonth = () => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentMonth(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentMonth(newDate)
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

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

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  // 캘린더 날짜 배열 생성
  const calendarDays = []
  
  // 빈 칸 추가 (시작 요일 전)
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  
  // 날짜 추가
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    calendarDays.push(dateStr)
  }

  // 그래프 최대값 계산
  const maxGraphValue = weeklyStats ? Math.max(
    ...weeklyStats.positiveTrend,
    ...weeklyStats.negativeTrend,
    1
  ) : 100

  return (
    <div className="office-container">
      <div className="office-header">
        {onNavigate && (
          <button
            className="office-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <h1 className="office-title">마을사무소</h1>
        <p className="office-subtitle">감정 캘린더 및 통계를 확인하세요</p>
        {isPastDate && (
          <div className="office-date-notice">
            <span className="office-date-notice-text">
              📅 누적 통계는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준입니다
            </span>
          </div>
        )}
      </div>

      <div className="office-content">
        {/* 선택한 날짜의 일기 감정 점수 표시 */}
        {selectedDateEmotionStats && isPastDate && (
          <div className="office-selected-date-stats">
            <h3 className="office-selected-date-title">
              {new Date(selectedDateEmotionStats.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기 감정 점수
            </h3>
            <div className="office-selected-date-emotions">
              {Object.entries(selectedDateEmotionStats.stats)
                .filter(([, score]) => score > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([emotion, score]) => (
                  <div
                    key={emotion}
                    className="office-selected-date-emotion-item"
                    style={{ 
                      backgroundColor: getEmotionColorByName(emotion),
                      color: 'white'
                    }}
                  >
                    <span className="office-selected-date-emotion-name">{emotion}</span>
                    <span className="office-selected-date-emotion-score">{score}점</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* 감정 캘린더 섹션 */}
        <div className="office-calendar-section">
          <h2 className="office-section-title">감정 캘린더</h2>
          
          {/* 캘린더 헤더 */}
          <div className="calendar-header">
            <button className="calendar-nav-button" onClick={handlePrevMonth}>
              ←
            </button>
            <h3 className="calendar-month">{monthName}</h3>
            <button className="calendar-nav-button" onClick={handleNextMonth}>
              →
            </button>
          </div>

          {/* 캘린더 그리드 */}
          <div className="calendar-grid">
            {/* 요일 헤더 */}
            <div className="calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <div key={day} className="calendar-weekday">{day}</div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="calendar-days">
              {calendarDays.map((dateStr, index) => {
                if (!dateStr) {
                  return <div key={`empty-${index}`} className="calendar-day empty"></div>
                }

                const emotionData = calendarData[dateStr]
                const isSelected = selectedDate === dateStr
                const isToday = dateStr === getTodayDateString()

                return (
                  <div
                    key={dateStr}
                    className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => handleDateClick(dateStr)}
                  >
                    <span className="calendar-day-number">
                      {parseInt(dateStr.split('-')[2])}
                    </span>
                    {emotionData && (
                      <div
                        className="calendar-emotion-dot"
                        style={{ backgroundColor: getEmotionColorByName(emotionData.emotion) }}
                        title={emotionData.emotion}
                      ></div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 선택된 날짜의 일기 표시 */}
          {selectedDate && (
            <div className="calendar-diary-detail">
              <h4 className="diary-detail-title">
                {formatDate(selectedDate)}의 일기
              </h4>
              {selectedDiaries.length === 0 ? (
                <p className="diary-detail-empty">이 날짜에는 일기가 없습니다.</p>
              ) : (
                <div className="diary-detail-list">
                  {selectedDiaries.map(diary => (
                    <div key={diary.id} className="diary-detail-item">
                      <div className="diary-detail-header">
                        <h5 className="diary-detail-item-title">
                          {diary.title || '제목 없음'}
                        </h5>
                        {diary.emotion_scores && (
                          <div className="diary-emotion-scores">
                            {Object.entries(diary.emotion_scores)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3)
                              .map(([emotion, score]) => (
                                <div
                                  key={emotion}
                                  className="emotion-score-badge"
                                  style={{ 
                                    backgroundColor: getEmotionColorByName(emotion),
                                    color: 'white'
                                  }}
                                >
                                  {emotion} {score}%
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <p className="diary-detail-content">{diary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 일주일 간 감정 통계 섹션 */}
        <div className="office-stats-section">
          <h2 className="office-section-title">일주일 간 감정 통계</h2>

          {weeklyStats && (
            <>
              {/* 감정별 누적 지수 */}
              <div className="stats-emotion-bars">
                <h3 className="stats-subtitle">감정별 누적 지수</h3>
                <div className="emotion-bars-container">
                  {Object.entries(weeklyStats.emotionStats)
                    .sort(([, a], [, b]) => b - a)
                    .map(([emotion, score]) => {
                      const maxScore = Math.max(...Object.values(weeklyStats.emotionStats), 1)
                      const percentage = (score / maxScore) * 100
                      
                      return (
                        <div key={emotion} className="emotion-bar-item">
                          <div className="emotion-bar-label">
                            <span className="emotion-bar-name">{emotion}</span>
                            <span className="emotion-bar-value">{score}점</span>
                          </div>
                          <div className="emotion-bar-container">
                            <div
                              className="emotion-bar"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: getEmotionColorByName(emotion)
                              }}
                            ></div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* 긍정/부정 추이 그래프 */}
              <div className="stats-trend-graph">
                <h3 className="stats-subtitle">긍정/부정 추이</h3>
                <div className="trend-graph-container">
                  <div className="trend-graph-labels">
                    <div className="trend-label positive">긍정</div>
                    <div className="trend-label negative">부정</div>
                  </div>
                  <div className="trend-graph-bars">
                    {weeklyStats.dates.map((dateStr, index) => {
                      const date = new Date(dateStr + 'T00:00:00')
                      const dayLabel = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                      const positiveHeight = (weeklyStats.positiveTrend[index] / maxGraphValue) * 100
                      const negativeHeight = (weeklyStats.negativeTrend[index] / maxGraphValue) * 100

                      return (
                        <div key={dateStr} className="trend-day">
                          <div className="trend-day-bars">
                            <div
                              className="trend-bar positive"
                              style={{ height: `${positiveHeight}%` }}
                              title={`긍정: ${weeklyStats.positiveTrend[index]}점`}
                            ></div>
                            <div
                              className="trend-bar negative"
                              style={{ height: `${negativeHeight}%` }}
                              title={`부정: ${weeklyStats.negativeTrend[index]}점`}
                            ></div>
                          </div>
                          <div className="trend-day-label">{dayLabel}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Office

