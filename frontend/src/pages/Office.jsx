import { useState, useEffect } from 'react'
import { getAllDiaries, getDiariesByDate, getDominantEmotionByDate, getWeeklyEmotionStats } from '../utils/storage'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import { getTodayDateString } from '../utils/dateUtils'
import { getOfficeStats } from '../utils/api'
import './Office.css'

function Office({ onNavigate, selectedDate: selectedDateFromVillage }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDiaries, setSelectedDiaries] = useState([])
  const [weeklyStats, setWeeklyStats] = useState(null)
  const [calendarData, setCalendarData] = useState({})
  const [selectedDateEmotionStats, setSelectedDateEmotionStats] = useState(null)
  const [officeStats, setOfficeStats] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
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

  useEffect(() => {
    loadOfficeStats()
  }, [])

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

  const loadOfficeStats = async () => {
    try {
      const stats = await getOfficeStats()
      setOfficeStats(stats)
    } catch (error) {
      console.error('마을사무소 통계 로드 실패:', error)
    }
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

  const buildDonutBackground = (topEmotions) => {
    if (!topEmotions || topEmotions.length === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)'
    }

    let current = 0
    const segments = topEmotions.map((emotion) => {
      const color = getEmotionColorByName(emotion.name)
      const size = (emotion.ratio || 0) * 360
      const start = current
      const end = current + size
      current = end
      return `${color} ${start}deg ${end}deg`
    })

    if (current < 360) {
      segments.push(`#e5e7eb ${current}deg 360deg`)
    }

    return `conic-gradient(${segments.join(', ')})`
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
        <div className="office-header-content">
          <h1 className="office-title">마을사무소</h1>
          <p className="office-subtitle">
            감정 캘린더 및 통계를 확인하세요
          </p>
        </div>
        <button 
          className="office-info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="office-info-toggle-icon">{showInfo ? '📖' : '📘'}</span>
          <span className="office-info-toggle-text">사무소 설명서</span>
        </button>
      </div>

      {/* 설명 섹션 - 버튼 바로 밑에 표시 */}
      {showInfo && (
        <div className="office-info-section">
          <div className="office-info-content-wrapper">
            <h3 className="office-info-title">사무소가 하는 일</h3>
            <div className="office-info-cards">
              <div className="office-info-card">
                <span className="office-info-icon">📅</span>
                <div className="office-info-content">
                  <span className="office-info-text">감정 캘린더로</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">날짜별 감정을 확인해요</span>
                </div>
              </div>
              <div className="office-info-card">
                <span className="office-info-icon">📊</span>
                <div className="office-info-content">
                  <span className="office-info-text">주간 통계로</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">감정 추이를 분석해요</span>
                </div>
              </div>
              <div className="office-info-card">
                <span className="office-info-icon">🌳💧</span>
                <div className="office-info-content">
                  <span className="office-info-text">나무와 우물 기여도를</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">한눈에 볼 수 있어요</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 우측 상단에 작은 알림 배지들 */}
      <div className="office-alerts">
        {isPastDate && (
          <div className="office-date-notice">
            <span className="office-date-notice-text">
              📅 누적 통계는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준입니다
            </span>
          </div>
        )}
        {selectedDateEmotionStats && isPastDate && (
          <div className="office-date-impact">
            <span className="office-date-impact-icon">📝</span>
            <span className="office-date-impact-text">
              {new Date(selectedDateEmotionStats.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기 감정 점수를 확인했어요
            </span>
          </div>
        )}
      </div>

      <div className="office-content">

        {/* 감정 요약 섹션 (Top 3 도넛 + 나무/우물 기여도) */}
        {officeStats && (
          <div className="office-overview-section">
            <h2 className="office-section-title">마을 감정 요약</h2>
            <div className="office-overview-grid">
              <div className="office-donut-card">
                <h3 className="stats-subtitle">Top 3 감정 비중</h3>
                <div className="office-donut-wrapper">
                  <div
                    className="office-donut"
                    style={{ backgroundImage: buildDonutBackground(officeStats.topEmotions) }}
                  >
                    <div className="office-donut-center">
                      <span className="office-donut-center-label">총 점수</span>
                      <span className="office-donut-center-value">
                        {Math.round(officeStats.totalEmotionScore || 0)}
                      </span>
                    </div>
                  </div>
                  <div className="office-donut-legend">
                    {(officeStats.topEmotions || []).map((emotion) => (
                      <div key={emotion.name} className="office-donut-legend-item">
                        <span
                          className="office-donut-legend-color"
                          style={{ backgroundColor: getEmotionColorByName(emotion.name) }}
                        />
                        <span className="office-donut-legend-name">{emotion.name}</span>
                        <span className="office-donut-legend-value">
                          {Math.round((emotion.ratio || 0) * 100)}%
                        </span>
                      </div>
                    ))}
                    {(!officeStats.topEmotions || officeStats.topEmotions.length === 0) && (
                      <p className="office-donut-empty">아직 통계를 낼 수 있는 감정 데이터가 없어요.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="office-contribution-card">
                <h3 className="stats-subtitle">행복 나무 / 스트레스 우물 기여도</h3>
                <p className="office-contribution-description">
                  최근 일주일 동안 쌓인 감정들이 마을의 나무와 우물에 얼마나 영향을 줬는지 한눈에 볼 수 있어요.
                </p>
                <div className="office-contribution-bars">
                  {(() => {
                    const tree = officeStats.treeWellContribution?.tree || { value: 0, ratio: 0 }
                    const well = officeStats.treeWellContribution?.well || { value: 0, ratio: 0 }
                    const total = officeStats.totalTreeWellValue || 0
                    const safeTreeRatio = isNaN(tree.ratio) ? 0 : tree.ratio
                    const safeWellRatio = isNaN(well.ratio) ? 0 : well.ratio

                    return (
                      <>
                        <div className="office-contribution-item">
                          <div className="office-contribution-label">
                            <span className="office-contribution-name">행복 나무</span>
                            <span className="office-contribution-value">
                              {tree.value}점 ({Math.round(safeTreeRatio * 100)}%)
                            </span>
                          </div>
                          <div className="office-contribution-bar-container">
                            <div
                              className="office-contribution-bar tree"
                              style={{ width: `${safeTreeRatio * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="office-contribution-item">
                          <div className="office-contribution-label">
                            <span className="office-contribution-name">스트레스 우물</span>
                            <span className="office-contribution-value">
                              {well.value}점 ({Math.round(safeWellRatio * 100)}%)
                            </span>
                          </div>
                          <div className="office-contribution-bar-container">
                            <div
                              className="office-contribution-bar well"
                              style={{ width: `${safeWellRatio * 100}%` }}
                            />
                          </div>
                        </div>

                        <div className="office-contribution-total">
                          지금까지의 총 감정 에너지: <strong>{total}</strong>점
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
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

