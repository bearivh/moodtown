import { useState, useEffect } from 'react'
import { getAllDiaries, getDiariesByDate, getDominantEmotionByDate, getWeeklyEmotionStats, getMonthlyEmotionStats, getDiaryStreak, getEmotionAverages, getWeekdayPattern, getWritingActivity, deleteDiary } from '../utils/storage'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import { getTodayDateString } from '../utils/dateUtils'
import { getOfficeStats, getSimilarDiaries } from '../utils/api'
import { normalizeEmotionScores } from '../utils/emotionUtils'
import { clearDiaryCacheForDate } from '../utils/diaryCache'
import { clearVillageCacheForDate } from './Village'
import FloatingResidents from '../components/FloatingResidents'
import './Office.css'

function Office({ onNavigate, selectedDate: selectedDateFromVillage }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDiaries, setSelectedDiaries] = useState([])
  const [weeklyStats, setWeeklyStats] = useState(null)
  const [monthlyStats, setMonthlyStats] = useState(null)
  const [calendarData, setCalendarData] = useState({})
  const [diaryStreak, setDiaryStreak] = useState(null)
  const [emotionAverages, setEmotionAverages] = useState(null)
  const [weekdayPattern, setWeekdayPattern] = useState(null)
  const [writingActivity, setWritingActivity] = useState(null)
  const [selectedDateEmotionStats, setSelectedDateEmotionStats] = useState(null)
  const [selectedDateAllEmotions, setSelectedDateAllEmotions] = useState(null) // 선택된 날짜의 전체 감정 분석 결과
  const [officeStats, setOfficeStats] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [selectedDiaryForSimilarity, setSelectedDiaryForSimilarity] = useState(null)
  const [similarDiaries, setSimilarDiaries] = useState([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [similarError, setSimilarError] = useState(null)
  const [donutTooltip, setDonutTooltip] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [diaryToDelete, setDiaryToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const today = getTodayDateString()
  const isPastDate = selectedDateFromVillage && selectedDateFromVillage < today

  useEffect(() => {
    loadCalendarData()
    loadWeeklyStats()
    loadMonthlyStats()
    loadAdditionalStats()
  }, [currentMonth])

  const loadAdditionalStats = async () => {
    const streak = await getDiaryStreak()
    setDiaryStreak(streak)
    
    const averages = await getEmotionAverages()
    setEmotionAverages(averages)
    
    const pattern = await getWeekdayPattern()
    setWeekdayPattern(pattern)
    
    const activity = await getWritingActivity()
    setWritingActivity(activity)
  }

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

  const loadMonthlyStats = async () => {
    const stats = await getMonthlyEmotionStats()
    setMonthlyStats(stats)
  }

  const handleDateClick = async (dateStr) => {
    setSelectedDate(dateStr)
    const diaries = await getDiariesByDate(dateStr)
    setSelectedDiaries(diaries)
    // 유사 일기 검색 상태 초기화
    setSelectedDiaryForSimilarity(null)
    setSimilarDiaries([])
    setSimilarError(null)
    
    // 선택된 날짜의 전체 감정 점수 합산
    if (diaries.length > 0) {
      const allEmotionStats = {
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
        Object.keys(allEmotionStats).forEach(emotion => {
          allEmotionStats[emotion] += scores[emotion] || 0
        })
      }
      
      // 정규화된 감정 점수 계산
      const normalizedScores = normalizeEmotionScores(allEmotionStats)
      setSelectedDateAllEmotions(normalizedScores)
    } else {
      setSelectedDateAllEmotions(null)
    }
  }

  const handleFindSimilar = async (diary) => {
    setSelectedDiaryForSimilarity(diary)
    setLoadingSimilar(true)
    setSimilarError(null)
    setSimilarDiaries([])

    try {
      const result = await getSimilarDiaries(diary.id, 5, 0.3)
      
      if (result.success === false) {
        const errorMsg = result.error || '유사 일기 검색에 실패했어요'
        const hintMsg = result.hint ? `\n\n💡 ${result.hint}` : ''
        setSimilarError(errorMsg + hintMsg)
        setSimilarDiaries([])
      } else {
        setSimilarDiaries(result.similar_diaries || [])
      }
    } catch (error) {
      console.error('유사 일기 검색 오류:', error)
      setSimilarError('유사 일기 검색 중 오류가 발생했어요')
      setSimilarDiaries([])
    } finally {
      setLoadingSimilar(false)
    }
  }

  const handleDeleteDiary = async (diary) => {
    setDiaryToDelete(diary)
  }

  const confirmDeleteDiary = async () => {
    if (!diaryToDelete) return

    setDeleting(true)
    try {
      const success = await deleteDiary(diaryToDelete.id)
      if (success) {
        // 캐시 무효화
        clearDiaryCacheForDate(diaryToDelete.date)
        clearVillageCacheForDate(diaryToDelete.date)
        
        // 선택된 날짜의 일기 목록 새로고침
        if (selectedDate === diaryToDelete.date) {
          const updatedDiaries = await getDiariesByDate(selectedDate)
          setSelectedDiaries(updatedDiaries)
          
          // 일기가 하나도 없으면 감정 분석 결과도 초기화
          if (updatedDiaries.length === 0) {
            setSelectedDateAllEmotions(null)
            setSelectedDateEmotionStats(null)
          } else {
            // 감정 분석 결과 재계산
            const allEmotionStats = {
              '기쁨': 0,
              '사랑': 0,
              '놀람': 0,
              '두려움': 0,
              '분노': 0,
              '부끄러움': 0,
              '슬픔': 0
            }
            for (const diary of updatedDiaries) {
              const scores = diary.emotion_scores || {}
              Object.keys(allEmotionStats).forEach(emotion => {
                allEmotionStats[emotion] += scores[emotion] || 0
              })
            }
            const normalizedScores = normalizeEmotionScores(allEmotionStats)
            setSelectedDateAllEmotions(normalizedScores)
          }
        }
        
        // 캘린더 데이터 새로고침
        await loadCalendarData()
        await loadWeeklyStats()
        await loadMonthlyStats()
        await loadAdditionalStats()
        
        // 마을 입구에서 선택된 날짜가 있으면 해당 날짜 통계도 새로고침
        if (selectedDateFromVillage) {
          await loadSelectedDateEmotionStats()
        }
        
        // 현재 선택된 날짜가 있으면 다시 클릭하여 새로고침
        if (selectedDate) {
          await handleDateClick(selectedDate)
        }
        
        // 유사 일기 검색 중인 일기면 초기화
        if (selectedDiaryForSimilarity?.id === diaryToDelete.id) {
          setSelectedDiaryForSimilarity(null)
          setSimilarDiaries([])
        }
        
        setDiaryToDelete(null)
      } else {
        alert('일기 삭제에 실패했어요. 다시 시도해주세요.')
      }
    } catch (error) {
      console.error('일기 삭제 오류:', error)
      alert('일기 삭제 중 오류가 발생했어요.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteDiary = () => {
    setDiaryToDelete(null)
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

  // SVG 도넛 그래프를 위한 path 데이터 생성
  const createDonutPaths = (emotions) => {
    if (!emotions || emotions.length === 0) {
      return []
    }

    const size = 220
    const radius = size / 2
    const innerRadius = radius - 40
    const center = radius

    let currentAngle = -90 // 12시 방향부터 시작
    const paths = []

    emotions.forEach((emotion) => {
      const ratio = emotion.ratio || 0
      const angle = ratio * 360

      if (angle > 0) {
        const startAngle = (currentAngle * Math.PI) / 180
        const endAngle = ((currentAngle + angle) * Math.PI) / 180

        const x1 = center + radius * Math.cos(startAngle)
        const y1 = center + radius * Math.sin(startAngle)
        const x2 = center + radius * Math.cos(endAngle)
        const y2 = center + radius * Math.sin(endAngle)

        const x3 = center + innerRadius * Math.cos(endAngle)
        const y3 = center + innerRadius * Math.sin(endAngle)
        const x4 = center + innerRadius * Math.cos(startAngle)
        const y4 = center + innerRadius * Math.sin(startAngle)

        const largeArcFlag = angle > 180 ? 1 : 0

        const pathData = [
          `M ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          `L ${x3} ${y3}`,
          `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
          'Z'
        ].join(' ')

        paths.push({
          path: pathData,
          color: getEmotionColorByName(emotion.name),
          name: emotion.name,
          score: Math.round(emotion.score)
        })

        currentAngle += angle
      }
    })

    return paths
  }

  const handleDonutMouseEnter = (emotion, event) => {
    const donutElement = event.currentTarget.closest('.office-donut')
    if (!donutElement) return
    
    const rect = donutElement.getBoundingClientRect()
    const svg = event.currentTarget.ownerSVGElement
    const svgRect = svg.getBoundingClientRect()
    
    setTooltipPosition({
      x: event.clientX - svgRect.left,
      y: event.clientY - svgRect.top
    })
    setDonutTooltip({ name: emotion.name, score: emotion.score })
  }

  const handleDonutMouseLeave = () => {
    setDonutTooltip(null)
  }

  const handleDonutMouseMove = (event) => {
    if (donutTooltip) {
      const svg = event.currentTarget
      const svgRect = svg.getBoundingClientRect()
      setTooltipPosition({
        x: event.clientX - svgRect.left,
        y: event.clientY - svgRect.top
      })
    }
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

  // 긍정/부정 추이는 이미 정규화되어 합이 100이므로 최대값은 100
  const maxGraphValue = 100

  // 월간 감정 통계를 도넛 차트 형식으로 변환
  const monthlyEmotionDonut = monthlyStats ? (() => {
    const emotionStats = monthlyStats.emotionStats || {}
    const total = Object.values(emotionStats).reduce((sum, val) => sum + (val || 0), 0)
    
    if (total === 0) {
      return []
    }

    // 각 감정의 비율 계산 및 정렬
    const emotions = Object.entries(emotionStats)
      .map(([name, score]) => ({
        name,
        ratio: (score || 0) / total,
        score: score || 0
      }))
      .sort((a, b) => b.score - a.score) // 점수 높은 순으로 정렬
      .filter(item => item.score > 0) // 점수가 0보다 큰 것만

    return emotions
  })() : []

  // 도넛 그래프 path 데이터 생성 (한 번만 계산)
  const donutPaths = monthlyEmotionDonut.length > 0 ? createDonutPaths(monthlyEmotionDonut) : []

  return (
    <div className="office-container">
      <FloatingResidents count={2} />
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
            감정 캘린더 및 통계를 확인하세요.
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
                  <span className="office-info-text">월간 통계로</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">이번 달 감정을 확인해요</span>
                </div>
              </div>
              <div className="office-info-card">
                <span className="office-info-icon">📈</span>
                <div className="office-info-content">
                  <span className="office-info-text">일주일 추이로</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">최근 감정 변화를 확인해요</span>
                </div>
              </div>
              <div className="office-info-card">
                <span className="office-info-icon">🔍</span>
                <div className="office-info-content">
                  <span className="office-info-text">비슷한 일기 찾기로</span>
                  <span className="office-info-arrow">→</span>
                  <span className="office-info-result">유사한 감정 패턴을 발견해요</span>
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
              📅 누적 통계는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준이에요
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
                <p className="diary-detail-empty">이 날짜에는 일기가 없어요</p>
              ) : (
                <>
                  {/* 전체 감정 분석 결과 바 그래프 */}
                  {selectedDateAllEmotions && (
                    <div className="selected-date-emotion-graph">
                      <h5 className="emotion-graph-title">전체 감정 분석 결과</h5>
                      <div className="emotion-list">
                        {Object.entries(selectedDateAllEmotions)
                          .sort(([, a], [, b]) => b - a)
                          .map(([emotion, score]) => {
                            const normalizedScore = Math.round(score)
                            return (
                              <div key={emotion} className="emotion-list-item">
                                <span className="emotion-list-name">{emotion}:</span>
                                <span className="emotion-list-value">{normalizedScore}%</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                  
                  <div className="diary-detail-list">
                    {selectedDiaries.map(diary => (
                      <div key={diary.id} className="diary-detail-item">
                        <div className="diary-detail-header">
                          <h5 className="diary-detail-item-title">
                            {diary.title || '제목 없음'}
                          </h5>
                          {diary.emotion_scores && (
                            <div className="diary-emotion-scores">
                              {Object.entries(normalizeEmotionScores(diary.emotion_scores))
                                .sort(([, a], [, b]) => b - a)
                                .slice(0, 3)
                                .map(([emotion, score]) => {
                                  const normalizedScore = Math.round(score)
                                  return (
                                    <div
                                      key={emotion}
                                      className="emotion-score-badge"
                                      style={{ 
                                        backgroundColor: getEmotionColorByName(emotion),
                                        color: 'white'
                                      }}
                                    >
                                      {emotion} {normalizedScore}%
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </div>
                        <p className="diary-detail-content">{diary.content}</p>
                        <div className="diary-action-buttons">
                          <button
                            className="diary-similar-button"
                            onClick={() => handleFindSimilar(diary)}
                            disabled={loadingSimilar}
                          >
                            🔍 비슷한 일기 찾기
                          </button>
                          <button
                            className="diary-delete-button"
                            onClick={() => handleDeleteDiary(diary)}
                            disabled={deleting}
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 유사 일기 검색 결과 */}
          {selectedDiaryForSimilarity && (
            <div className="similar-diaries-section">
              <h4 className="similar-diaries-title">
                "{selectedDiaryForSimilarity.title || '제목 없음'}"와 비슷한 일기
              </h4>
              
              {loadingSimilar && (
                <div className="similar-diaries-loading">
                  유사한 일기를 찾는 중...
                </div>
              )}

              {similarError && (
                <div className="similar-diaries-error">
                  <div className="similar-diaries-error-title">⚠️ 검색 실패</div>
                  <div className="similar-diaries-error-message">{similarError}</div>
                </div>
              )}

              {!loadingSimilar && !similarError && similarDiaries.length === 0 && selectedDiaryForSimilarity && (
                <div className="similar-diaries-empty">
                  유사한 일기를 찾지 못했어요. 일기를 더 작성하면 비슷한 패턴을 찾을 수 있어요!
                </div>
              )}

              {!loadingSimilar && !similarError && similarDiaries.length > 0 && (
                <div className="similar-diaries-list">
                  {similarDiaries.map((similarDiary, index) => (
                    <div key={similarDiary.id} className="similar-diary-item">
                      <div className="similar-diary-header">
                        <div className="similar-diary-meta">
                          <span className="similar-diary-date">{formatDate(similarDiary.date)}</span>
                          <span className="similar-diary-similarity">
                            유사도: {Math.round(similarDiary.similarity * 100)}%
                          </span>
                        </div>
                        <h6 className="similar-diary-title">{similarDiary.title || '제목 없음'}</h6>
                      </div>
                      {similarDiary.emotion_scores && Object.keys(similarDiary.emotion_scores).length > 0 && (
                        <div className="diary-emotion-scores">
                          {Object.entries(normalizeEmotionScores(similarDiary.emotion_scores))
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3)
                            .map(([emotion, score]) => {
                              const normalizedScore = Math.round(score)
                              return (
                                <div
                                  key={emotion}
                                  className="emotion-score-badge"
                                  style={{ 
                                    backgroundColor: getEmotionColorByName(emotion),
                                    color: 'white'
                                  }}
                                >
                                  {emotion} {normalizedScore}%
                                </div>
                              )
                            })}
                        </div>
                      )}
                      <p className="similar-diary-content">{similarDiary.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 감정 통계 섹션 */}
        <div className="office-stats-section">
          {/* 이번 달 감정 통계 도넛 차트 */}
          <div className="office-overview-section">
            <h2 className="office-section-title">이번 달 감정 통계</h2>
            <div className="office-overview-grid">
              <div className="office-donut-card">
                <h3 className="stats-subtitle">이번 달 감정 비율이에요</h3>
                <div className="office-donut-wrapper">
                  <div className="office-donut">
                    <svg
                      width="220"
                      height="220"
                      viewBox="0 0 220 220"
                      className="office-donut-svg"
                      style={{ position: 'absolute', top: 0, left: 0 }}
                      onMouseMove={handleDonutMouseMove}
                      onMouseLeave={handleDonutMouseLeave}
                    >
                      {donutPaths.length > 0 ? (
                        donutPaths.map((item, index) => (
                          <path
                            key={`${item.name}-${index}`}
                            d={item.path}
                            fill={item.color}
                            onMouseEnter={(e) => handleDonutMouseEnter(item, e)}
                            style={{ cursor: 'pointer' }}
                          />
                        ))
                      ) : (
                        <circle
                          cx="110"
                          cy="110"
                          r="110"
                          fill="#e5e7eb"
                        />
                      )}
                    </svg>
                    {donutTooltip && (
                      <div
                        className="office-donut-tooltip"
                        style={{
                          left: `${tooltipPosition.x}px`,
                          top: `${tooltipPosition.y}px`
                        }}
                      >
                        <div className="office-donut-tooltip-name">{donutTooltip.name}</div>
                        <div className="office-donut-tooltip-score">{donutTooltip.score}점</div>
                      </div>
                    )}
                    <div className="office-donut-center">
                      <span className="office-donut-center-label">총 점수</span>
                      <span className="office-donut-center-value">
                        {monthlyStats ? Math.round(
                          Object.values(monthlyStats.emotionStats || {}).reduce((sum, val) => sum + (val || 0), 0)
                        ) : 0}
                      </span>
                    </div>
                    {donutTooltip && (
                      <div
                        className="office-donut-tooltip"
                        style={{
                          left: `${tooltipPosition.x}px`,
                          top: `${tooltipPosition.y}px`
                        }}
                      >
                        <div className="office-donut-tooltip-name">{donutTooltip.name}</div>
                        <div className="office-donut-tooltip-score">{donutTooltip.score}점</div>
                      </div>
                    )}
                  </div>
                  <div className="office-donut-legend">
                    {monthlyEmotionDonut.length > 0 ? (
                      monthlyEmotionDonut.map((emotion) => (
                        <div key={emotion.name} className="office-donut-legend-item">
                          <span
                            className="office-donut-legend-color"
                            style={{ backgroundColor: getEmotionColorByName(emotion.name) }}
                          />
                          <span className="office-donut-legend-name">{emotion.name}</span>
                          <span className="office-donut-legend-value">
                            {Math.round(emotion.ratio * 100)}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="office-donut-empty">통계를 낼 수 있는 감정 데이터가 없어요</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 일주일간 긍정/부정 점수 추이 그래프 (꺾은선) */}
          {weeklyStats && weeklyStats.dates && Array.isArray(weeklyStats.positiveScores) && Array.isArray(weeklyStats.negativeScores) && (
            <div className="stats-line-graph">
              <h2 className="office-section-title">일주일간 긍정/부정 추이</h2>
              <h3 className="stats-subtitle">최근 7일간 감정 점수 변화예요</h3>
              <div className="line-graph-container">
                <svg className="line-graph-svg" viewBox="0 0 600 250" preserveAspectRatio="xMidYMid meet">
                  {/* 배경 그리드 */}
                  <defs>
                    <pattern id="grid" width="85.7" height="50" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="50" stroke="#e5e7eb" strokeWidth="1" />
                      <line x1="0" y1="50" x2="85.7" y2="50" stroke="#e5e7eb" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  
                  {/* Y축 레이블 */}
                  {(() => {
                    const maxScore = Math.max(
                      ...weeklyStats.positiveScores,
                      ...weeklyStats.negativeScores,
                      10
                    )
                    const step = Math.ceil(maxScore / 5)
                    const ticks = []
                    for (let i = 0; i <= 5; i++) {
                      ticks.push(i * step)
                    }
                    return ticks.map((value, i) => (
                      <g key={i}>
                        <text
                          x="30"
                          y={220 - (i * 40)}
                          fontSize="10"
                          fill="#6b7280"
                          textAnchor="end"
                        >
                          {value}
                        </text>
                      </g>
                    ))
                  })()}
                  
                  {/* 꺾은선 그래프 */}
                  {(() => {
                    const maxScore = Math.max(
                      ...weeklyStats.positiveScores,
                      ...weeklyStats.negativeScores,
                      10
                    )
                    const scaleY = 200 / maxScore
                    const stepX = 600 / 7
                    
                    // 긍정 점수 선
                    const positivePoints = weeklyStats.positiveScores.map((score, i) => ({
                      x: 60 + (i * stepX),
                      y: 220 - (score * scaleY)
                    }))
                    
                    // 부정 점수 선
                    const negativePoints = weeklyStats.negativeScores.map((score, i) => ({
                      x: 60 + (i * stepX),
                      y: 220 - (score * scaleY)
                    }))
                    
                    // 경로 생성
                    const positivePath = `M ${positivePoints.map(p => `${p.x},${p.y}`).join(' L ')}`
                    const negativePath = `M ${negativePoints.map(p => `${p.x},${p.y}`).join(' L ')}`
                      
                      return (
                      <>
                        {/* 긍정 선 */}
                        <path
                          d={positivePath}
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* 부정 선 */}
                        <path
                          d={negativePath}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        
                        {/* 긍정 점들 */}
                        {positivePoints.map((point, i) => (
                          <circle
                            key={`positive-${i}`}
                            cx={point.x}
                            cy={point.y}
                            r="5"
                            fill="#22c55e"
                          />
                        ))}
                        
                        {/* 부정 점들 */}
                        {negativePoints.map((point, i) => (
                          <circle
                            key={`negative-${i}`}
                            cx={point.x}
                            cy={point.y}
                            r="5"
                            fill="#ef4444"
                          />
                        ))}
                        
                        {/* X축 날짜 레이블 */}
                        {weeklyStats.dates.map((dateStr, i) => {
                          const date = new Date(dateStr + 'T00:00:00')
                          const dayLabel = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                          return (
                            <text
                              key={dateStr}
                              x={60 + (i * stepX)}
                              y="240"
                              fontSize="10"
                              fill="#6b7280"
                              textAnchor="middle"
                            >
                              {dayLabel}
                            </text>
                          )
                        })}
                      </>
                    )
                  })()}
                </svg>
                
                {/* 범례 */}
                <div className="line-graph-legend">
                  <div className="line-graph-legend-item">
                    <div className="line-graph-legend-line positive"></div>
                    <span>긍정</span>
                  </div>
                  <div className="line-graph-legend-item">
                    <div className="line-graph-legend-line negative"></div>
                    <span>부정</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 추가 통계 섹션 */}
          <div className="office-additional-stats">
            {/* 연속 일기 작성 일수 (스트릭) */}
            {diaryStreak && (
              <div className="stats-card streak-card">
                <h3 className="stats-subtitle">🔥 연속 일기 작성</h3>
                <div className="streak-content">
                  <div className="streak-number">{diaryStreak.streak}</div>
                  <div className="streak-label">일 연속</div>
                  {diaryStreak.streak > 0 && (
                    <div className="streak-message">화이팅! 계속 써봐요! 💪</div>
                  )}
                </div>
              </div>
            )}

            {/* 일기 작성 활동도 */}
            {writingActivity && (
              <div className="stats-card activity-card">
                <h3 className="stats-subtitle">📝 일기 작성 활동도</h3>
                <div className="activity-content">
                  <div className="activity-item">
                    <div className="activity-label">이번 달</div>
                    <div className="activity-value">
                      <span className="activity-number">{writingActivity.monthlyCount}</span>
                      <span className="activity-unit">/{writingActivity.monthlyGoal}일</span>
                    </div>
                    <div className="activity-bar">
                      <div 
                        className="activity-bar-fill"
                        style={{ width: `${Math.min((writingActivity.monthlyCount / writingActivity.monthlyGoal) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="activity-item">
                    <div className="activity-label">이번 주</div>
                    <div className="activity-value">
                      <span className="activity-number">{writingActivity.weeklyCount}</span>
                      <span className="activity-unit">일</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 감정별 평균 점수 비교 */}
            {emotionAverages && emotionAverages.totalDiaries > 0 && (
              <div className="stats-card averages-card">
                <h3 className="stats-subtitle">📊 감정별 평균 점수</h3>
                <div className="averages-bar-chart">
                  {Object.entries(emotionAverages.emotionAverages)
                    .filter(([_, avg]) => avg > 0)
                    .sort(([_, a], [__, b]) => b - a)
                    .map(([emotion, avg]) => (
                      <div key={emotion} className="average-bar-item">
                        <div className="average-bar-label">
                          <span 
                            className="average-bar-color"
                            style={{ backgroundColor: getEmotionColorByName(emotion) }}
                          ></span>
                          <span className="average-bar-name">{emotion}</span>
                        </div>
                        <div className="average-bar-container">
                          <div
                            className="average-bar-fill"
                            style={{
                              width: `${(avg / 100) * 100}%`,
                              backgroundColor: getEmotionColorByName(emotion)
                            }}
                          ></div>
                        </div>
                        <span className="average-bar-value">{avg.toFixed(1)}점</span>
                      </div>
                    ))}
                  {Object.values(emotionAverages.emotionAverages).every(v => v === 0) && (
                    <p className="stats-empty">평균 점수 데이터가 없어요</p>
                  )}
                </div>
              </div>
            )}

            {/* 요일별 작성 패턴 */}
            {weekdayPattern && (
              <div className="stats-card weekday-card">
                <h3 className="stats-subtitle">📅 요일별 작성 패턴</h3>
                <div className="weekday-content">
                  {weekdayPattern.weekdayLabels.map((day, index) => {
                    const count = weekdayPattern.weekdayPattern[day] || 0
                    const maxCount = Math.max(...Object.values(weekdayPattern.weekdayPattern), 1)
                    const heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0

                      return (
                      <div key={day} className="weekday-item">
                        <div className="weekday-bar-container">
                            <div
                            className="weekday-bar"
                            style={{ height: `${heightPercent}%` }}
                            ></div>
                          </div>
                        <div className="weekday-label">{day}</div>
                        <div className="weekday-count">{count}</div>
                        </div>
                      )
                    })}
                </div>
              </div>
          )}
          </div>
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {diaryToDelete && (
        <div className="delete-dialog-overlay" onClick={cancelDeleteDiary}>
          <div className="delete-dialog-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="delete-dialog-title">일기 삭제</h3>
            <p className="delete-dialog-message">
              정말로 이 일기를 삭제하시겠어요?<br />
              삭제된 일기는 복구할 수 없어요.
            </p>
            <div className="delete-dialog-buttons">
              <button
                className="delete-dialog-cancel-button"
                onClick={cancelDeleteDiary}
                disabled={deleting}
              >
                취소
              </button>
              <button
                className="delete-dialog-confirm-button"
                onClick={confirmDeleteDiary}
                disabled={deleting}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Office

