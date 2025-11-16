import { useState, useEffect } from 'react'
import {
  getWellState,
  getWaterLevelPercent,
  WELL_MAX_CAPACITY
} from '../utils/wellUtils'
import { getDiariesByDate } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import './Well.css'

function Well({ onNavigate, selectedDate }) {
  const [wellState, setWellState] = useState(null)
  const [waterPercent, setWaterPercent] = useState(0)
  const [selectedDateImpact, setSelectedDateImpact] = useState(null)
  const today = getTodayDateString()
  const isPastDate = selectedDate && selectedDate < today

  useEffect(() => {
    loadWellData()
    if (selectedDate && isPastDate) {
      loadSelectedDateImpact()
    } else {
      setSelectedDateImpact(null)
    }
    
    // 주기적으로 상태 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadWellData()
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedDate])

  const loadSelectedDateImpact = async () => {
    if (!selectedDate) return
    
    const diaries = await getDiariesByDate(selectedDate)
    if (diaries.length === 0) {
      setSelectedDateImpact(null)
      return
    }
    
    // 선택한 날짜의 일기 감정 점수 계산
    let totalNegativeScore = 0
    for (const diary of diaries) {
      const emotionScores = diary.emotion_scores || {}
      const negativeScore = 
        (emotionScores['분노'] || 0) + 
        (emotionScores['슬픔'] || 0) + 
        (emotionScores['두려움'] || 0) + 
        (emotionScores['부끄러움'] || 0)
      totalNegativeScore += negativeScore
    }
    
    if (totalNegativeScore > 0) {
      setSelectedDateImpact({
        date: selectedDate,
        negativeScore: totalNegativeScore
      })
    } else {
      setSelectedDateImpact(null)
    }
  }

  const loadWellData = async () => {
    const state = await getWellState()
    const percent = getWaterLevelPercent(state.waterLevel)
    
    setWellState(state)
    setWaterPercent(percent)
  }

  if (!wellState) {
    return (
      <div className="well-container">
        <div className="well-loading">로딩 중...</div>
      </div>
    )
  }

  const isOverflowing = wellState.isOverflowing
  const remainingCapacity = WELL_MAX_CAPACITY - wellState.waterLevel

  return (
    <div className="well-container">
      <div className="well-header">
        {onNavigate && (
          <button
            className="well-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <h1 className="well-title">스트레스 우물</h1>
        <p className="well-subtitle">
          부정적인 감정이 쌓이면 물이 차오르고, 긍정적인 감정이 모이면 물이 줄어들어요
        </p>
        {isPastDate && (
          <div className="well-date-notice">
            <span className="well-date-notice-text">
              📅 현재 상태는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준입니다
            </span>
          </div>
        )}
      </div>

      <div className="well-content">
        {/* 선택한 날짜의 일기로 인한 변화 표시 */}
        {selectedDateImpact && isPastDate && (
          <div className="well-date-impact">
            <div className="well-date-impact-icon">📝</div>
            <div className="well-date-impact-content">
              <div className="well-date-impact-title">
                {new Date(selectedDateImpact.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기로
              </div>
              <div className="well-date-impact-message">
                우물에 <strong>{selectedDateImpact.negativeScore}점</strong> 물이 차올랐어요 💧
              </div>
            </div>
          </div>
        )}
        {/* 우물 표시 영역 */}
        <div className="well-display-section">
          <div className="well-visual">
            {/* 우물 구조 */}
            <div className="well-structure">
              {/* 물 */}
              <div 
                className={`well-water ${isOverflowing ? 'well-water-overflowing' : ''}`}
                style={{ height: `${Math.min(100, waterPercent)}%` }}
              >
                <div className="well-water-wave"></div>
              </div>
              
              {/* 우물 가장자리 */}
              <div className="well-rim"></div>
            </div>
            
            {/* 넘침 경고 */}
            {isOverflowing && (
              <div className="well-overflow-warning">
                <div className="well-overflow-icon">⚠️</div>
                <div className="well-overflow-title">우물이 넘쳤어요!</div>
                <div className="well-overflow-message">
                  주민들이 우체통에 위로의 편지를 보냈어요. 확인해보세요.
                </div>
              </div>
            )}
          </div>

          {/* 물 높이 정보 */}
          <div className="well-stats">
            <div className="well-stat-item">
              <span className="well-stat-label">물 높이</span>
              <span className="well-stat-value">
                {wellState.waterLevel} / {WELL_MAX_CAPACITY}
              </span>
            </div>
            <div className="well-stat-item">
              <span className="well-stat-label">물 높이 비율</span>
              <span className="well-stat-value">{Math.round(waterPercent)}%</span>
            </div>
            {!isOverflowing && (
              <div className="well-stat-item">
                <span className="well-stat-label">남은 용량</span>
                <span className="well-stat-value">{remainingCapacity}점</span>
              </div>
            )}
          </div>

          {/* 물 높이 바 */}
          <div className="well-progress-section">
            <div className="well-progress-bar-container">
              <div
                className={`well-progress-bar ${isOverflowing ? 'well-progress-bar-full' : ''}`}
                style={{ width: `${waterPercent}%` }}
              ></div>
            </div>
            <div className="well-progress-label">
              {isOverflowing ? '우물이 가득 찼습니다' : `다음 넘침까지 ${remainingCapacity}점`}
            </div>
          </div>
        </div>

        {/* 설명 섹션 */}
        <div className="well-info-section">
          <h3 className="well-info-title">우물이 작동하는 방법</h3>
          <ul className="well-info-list">
            <li>일기를 작성하면 감정이 분석됩니다</li>
            <li>부정적인 감정(분노, 슬픔, 두려움, 부끄러움)이 우물에 물을 채웁니다</li>
            <li>긍정적인 감정(기쁨, 사랑)이 우물의 물을 줄입니다</li>
            <li>우물이 가득 차면 넘치고, 주민들이 위로의 편지를 보냅니다</li>
            <li>긍정적인 감정을 쌓으면 물이 줄어들어요</li>
          </ul>

          {/* 위로 메시지 */}
          {isOverflowing && (
            <div className="well-comfort-message">
              <h4 className="well-comfort-title">💙 주민들의 위로</h4>
              <p className="well-comfort-text">
                우물이 넘쳤어도 걱정 마세요. 힘든 날도 지나가고, 긍정적인 감정들이 물을 줄여줄 거예요. 
                주민들이 우체통에 위로의 편지를 보냈으니 확인해보세요.
              </p>
            </div>
          )}

          {/* 긍정 감정 유도 메시지 */}
          {!isOverflowing && waterPercent > 50 && (
            <div className="well-warning-message">
              <h4 className="well-warning-title">⚠️ 주의</h4>
              <p className="well-warning-text">
                우물의 물이 절반 이상 찼어요. 긍정적인 일기를 작성하면 물이 줄어들 거예요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Well

