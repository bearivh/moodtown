import { useState, useEffect } from 'react'
import {
  getWellState,
  getWaterLevelPercent,
  WELL_MAX_CAPACITY,
  resetWell
} from '../utils/wellUtils'
import FloatingResidents from '../components/FloatingResidents'
import { getDiariesByDate, getAllDiaries } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import { classifyEmotionsWithContext } from '../utils/emotionUtils'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import './Well.css'

// 이 함수들은 더 이상 사용되지 않습니다 (wellUtils.js에서 처리)

function Well({ onNavigate, selectedDate }) {
  const [wellState, setWellState] = useState(null)
  const [waterPercent, setWaterPercent] = useState(0)
  const [selectedDateImpact, setSelectedDateImpact] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [bonusInfo, setBonusInfo] = useState(null)
  const [reducedInfo, setReducedInfo] = useState(null)
  const [hideDateNotice, setHideDateNotice] = useState(false)
  const [hideDateImpact, setHideDateImpact] = useState(false)
  const [hideWarningAlert, setHideWarningAlert] = useState(false)
  const [emotionContributions, setEmotionContributions] = useState([])
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showResetSuccessPopup, setShowResetSuccessPopup] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const today = getTodayDateString()
  const isPastDate = selectedDate && selectedDate < today

  // 물 감소 정보 로드
  const loadWaterReducedInfo = async () => {
    const wellReducedStr = localStorage.getItem('wellReduced')
    if (!wellReducedStr) {
      setReducedInfo(null)
      return
    }
    
    try {
      const reducedData = JSON.parse(wellReducedStr)
      // 24시간 이내의 감소 정보만 표시
      if (Date.now() - reducedData.timestamp >= 24 * 60 * 60 * 1000) {
        localStorage.removeItem('wellReduced')
        setReducedInfo(null)
        return
      }
      
      // 같은 날짜의 보너스 정보가 있으면 물 감소 정보를 표시하지 않음 (서로 배타적)
      const wellBonusStr = localStorage.getItem('wellBonus')
      if (wellBonusStr) {
        try {
          const bonusData = JSON.parse(wellBonusStr)
          // 같은 날짜면 보너스가 우선 (물 감소 정보 삭제)
          if (bonusData.date === reducedData.date) {
            console.log('[우물 물 감소 무효] 같은 날짜의 보너스가 있어서 물 감소 정보 제거')
            localStorage.removeItem('wellReduced')
            setReducedInfo(null)
            return
          }
        } catch (e) {
          // 보너스 정보 파싱 실패 시 무시
        }
      }
      
      // 물 감소 날짜의 일기를 확인하여 실제로 긍정 감정이 있고 부정 감정이 없는지 검증
      const reducedDate = reducedData.date
      if (reducedDate) {
        const diaries = await getDiariesByDate(reducedDate)
        if (diaries.length > 0) {
          const diary = diaries[0]
          const emotionScores = diary.emotion_scores || {}
          const emotionPolarity = diary.emotion_polarity || {}
          
          // 긍정 감정(기쁨, 사랑) 확인
          const joy = emotionScores['기쁨'] || 0
          const love = emotionScores['사랑'] || 0
          
          // 부정 감정 확인
          const fear = emotionScores['두려움'] || 0
          const anger = emotionScores['분노'] || 0
          const sadness = emotionScores['슬픔'] || 0
          
          // 긍정 감정이 없거나 부정 감정이 있으면 물 감소 메시지 표시하지 않음
          if ((joy === 0 && love === 0) || fear > 0 || anger > 0 || sadness > 0) {
            console.log('[우물 물 감소 무효] 조건 불만족:', { 
              joy, love, fear, anger, sadness, 
              hasPositive: joy > 0 || love > 0,
              hasNegative: fear > 0 || anger > 0 || sadness > 0
            })
            localStorage.removeItem('wellReduced')
            setReducedInfo(null)
            return
          }
        }
      }
      
      setReducedInfo(reducedData)
    } catch (e) {
      console.error('[우물 물 감소 정보 파싱 오류]', e)
      localStorage.removeItem('wellReduced')
      setReducedInfo(null)
    }
  }

  // 보너스 정보 검증 및 로드
  const loadAndValidateBonusInfo = async () => {
    const wellBonusStr = localStorage.getItem('wellBonus')
    if (!wellBonusStr) {
      setBonusInfo(null)
      return
    }
    
    try {
      const bonusData = JSON.parse(wellBonusStr)
      // 24시간 이내의 보너스만 표시
      if (Date.now() - bonusData.timestamp >= 24 * 60 * 60 * 1000) {
        localStorage.removeItem('wellBonus')
        setBonusInfo(null)
        return
      }
      
      // 같은 날짜의 물 감소 정보가 있으면 보너스 정보를 표시하지 않음 (서로 배타적)
      const wellReducedStr = localStorage.getItem('wellReduced')
      if (wellReducedStr) {
        try {
          const reducedData = JSON.parse(wellReducedStr)
          // 같은 날짜면 물 감소가 우선 (보너스 정보 삭제)
          if (reducedData.date === bonusData.date) {
            console.log('[우물 보너스 무효] 같은 날짜의 물 감소가 있어서 보너스 정보 제거')
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
        } catch (e) {
          // 물 감소 정보 파싱 실패 시 무시
        }
      }
      
      // 보너스 날짜의 일기를 확인하여 실제로 부정 감정만 있었는지 검증
      const bonusDate = bonusData.date
      if (bonusDate) {
        const diaries = await getDiariesByDate(bonusDate)
        if (diaries.length > 0) {
          const diary = diaries[0]
          const emotionScores = diary.emotion_scores || {}
          const emotionPolarity = diary.emotion_polarity || {}
          
          // 긍정 감정(기쁨, 사랑) 확인
          const joy = emotionScores['기쁨'] || 0
          const love = emotionScores['사랑'] || 0
          
          // 부정 감정 확인
          const anger = emotionScores['분노'] || 0
          const sadness = emotionScores['슬픔'] || 0
          const fear = emotionScores['두려움'] || 0
          
          // 놀람/부끄러움 확인
          const surprise = emotionScores['놀람'] || 0
          const shame = emotionScores['부끄러움'] || 0
          const surprisePolarity = emotionPolarity['놀람']
          const shamePolarity = emotionPolarity['부끄러움']
          
          // 1. 긍정 감정이 있으면 무조건 보너스 무효
          if (joy > 0 || love > 0) {
            console.log('[우물 보너스 무효] 긍정 감정이 있음:', { joy, love, emotionScores })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 2. 부정 감정(분노, 슬픔, 두려움)이 하나도 없으면 보너스 무효
          const hasNegativeEmotions = anger > 0 || sadness > 0 || fear > 0
          if (!hasNegativeEmotions) {
            console.log('[우물 보너스 무효] 부정 감정이 없음:', { anger, sadness, fear, emotionScores })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 3. 놀람이 있고 긍정으로 분류되었으면 보너스 무효
          if (surprise > 0 && surprisePolarity === 'positive') {
            console.log('[우물 보너스 무효] 놀람이 긍정:', { surprise, surprisePolarity })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 4. 놀람이 있는데 부정도 아니고 null도 아니면 보너스 무효
          if (surprise > 0 && surprisePolarity && surprisePolarity !== 'negative') {
            console.log('[우물 보너스 무효] 놀람이 부정이 아님:', { surprise, surprisePolarity })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 5. 부끄러움이 있고 긍정으로 분류되었으면 보너스 무효
          if (shame > 0 && shamePolarity === 'positive') {
            console.log('[우물 보너스 무효] 부끄러움이 긍정:', { shame, shamePolarity })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 6. 부끄러움이 있는데 부정도 아니고 null도 아니면 보너스 무효
          if (shame > 0 && shamePolarity && shamePolarity !== 'negative') {
            console.log('[우물 보너스 무효] 부끄러움이 부정이 아님:', { shame, shamePolarity })
            localStorage.removeItem('wellBonus')
            setBonusInfo(null)
            return
          }
          
          // 모든 검증 통과
          console.log('[우물 보너스 유효] 검증 통과:', {
            joy,
            love,
            anger,
            sadness,
            fear,
            surprise,
            shame,
            emotionScores,
            emotionPolarity
          })
        } else {
          // 일기가 없으면 보너스 무효
          console.log('[우물 보너스 무효] 일기가 없음')
          localStorage.removeItem('wellBonus')
          setBonusInfo(null)
          return
        }
      }
      
      setBonusInfo(bonusData)
    } catch (e) {
      console.error('[우물 보너스 파싱 오류]', e)
      localStorage.removeItem('wellBonus')
      setBonusInfo(null)
    }
  }

  useEffect(() => {
    loadWellData()
    loadEmotionContributions()
    // 선택한 날짜가 있으면 해당 날짜, 없으면 오늘 날짜의 일기 확인
    const dateToCheck = selectedDate || today
    if (dateToCheck) {
      loadSelectedDateImpact()
    } else {
      setSelectedDateImpact(null)
    }
    
    // 보너스 정보 검증 및 로드 (먼저 실행)
    loadAndValidateBonusInfo()
    
    // 물 감소 정보 로드 (보너스 검증 후 실행하여 배타성 확인)
    loadWaterReducedInfo()
    
    // localStorage에서 경고 알림 닫기 상태 확인
    const warningDismissed = localStorage.getItem('wellWarningDismissed')
    if (warningDismissed) {
      // 24시간 이내에 닫았으면 다시 표시하지 않음
      const dismissedTime = parseInt(warningDismissed, 10)
      if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
        setHideWarningAlert(true)
      } else {
        localStorage.removeItem('wellWarningDismissed')
        setHideWarningAlert(false)
      }
    } else {
      setHideWarningAlert(false)
    }
    
    // 주기적으로 상태 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadWellData()
      loadEmotionContributions()
      const dateToCheck = selectedDate || today
      if (dateToCheck) {
        loadSelectedDateImpact()
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedDate, today])

  const loadSelectedDateImpact = async () => {
    const dateToCheck = selectedDate || today
    if (!dateToCheck) return
    
    const diaries = await getDiariesByDate(dateToCheck)
    if (diaries.length === 0) {
      setSelectedDateImpact(null)
      return
    }
    
    // 선택한 날짜의 일기 감정 점수 계산 (맥락 기반 분류 사용)
    let totalScore = 0
    for (const diary of diaries) {
      const emotionScores = diary.emotion_scores || {}
      const emotionPolarity = diary.emotion_polarity || {}
      const { negative } = classifyEmotionsWithContext(emotionScores, emotionPolarity)
      totalScore += negative
    }
    
    // 오늘 날짜이고 일기가 있는 경우, 물이 차오르지 않아도 메시지 표시
    if (dateToCheck === today && diaries.length > 0) {
      if (totalScore > 0) {
        setSelectedDateImpact({
          date: dateToCheck,
          negativeScore: totalScore,
          hasWaterAdded: true
        })
      } else {
        // 물이 차오르지 않은 경우
        setSelectedDateImpact({
          date: dateToCheck,
          negativeScore: 0,
          hasWaterAdded: false
        })
      }
    } else if (totalScore > 0) {
      // 과거 날짜는 물이 찰 때만 표시
      setSelectedDateImpact({
        date: dateToCheck,
        negativeScore: totalScore,
        hasWaterAdded: true
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

  // 우물 비우기 확인 다이얼로그 표시
  const handleResetWellClick = () => {
    setShowResetConfirm(true)
  }

  // 우물 비우기 확인 처리
  const handleResetConfirm = async () => {
    setIsResetting(true)
    setShowResetConfirm(false)
    
    try {
      await resetWell()
      // 상태 다시 로드
      await loadWellData()
      await loadEmotionContributions()
      // 날짜 영향도 다시 로드
      const dateToCheck = selectedDate || today
      if (dateToCheck) {
        loadSelectedDateImpact(dateToCheck)
      }
      
      // 보너스 정보 초기화
      setBonusInfo(null)
      setReducedInfo(null)
      localStorage.removeItem('wellBonus')
      localStorage.removeItem('wellReduced')
      
      // 완료 팝업 표시
      setIsResetting(false)
      setShowResetSuccessPopup(true)
    } catch (error) {
      console.error('우물 비우기 실패:', error)
      setIsResetting(false)
      alert('우물을 비우는 데 실패했습니다. 다시 시도해 주세요.')
    }
  }

  // 우물 비우기 취소
  const handleResetCancel = () => {
    setShowResetConfirm(false)
  }

  // 완료 팝업 닫기
  const handleCloseSuccessPopup = () => {
    setShowResetSuccessPopup(false)
  }

  const loadEmotionContributions = async () => {
    try {
      const allDiaries = await getAllDiaries()
      
      // 감정별 부정 점수 합산
      const emotionTotals = {
        '분노': 0,
        '슬픔': 0,
        '두려움': 0,
        '놀람': 0,
        '부끄러움': 0
      }
      
      for (const diary of allDiaries) {
        const scores = diary.emotion_scores || {}
        const emotionPolarity = diary.emotion_polarity || {}
        
        // 분노, 슬픔, 두려움은 항상 부정
        emotionTotals['분노'] += scores['분노'] || 0
        emotionTotals['슬픔'] += scores['슬픔'] || 0
        emotionTotals['두려움'] += scores['두려움'] || 0
        
        // 놀람: 맥락 기반 (부정인 경우만)
        const surprise = scores['놀람'] || 0
        if (surprise > 0 && emotionPolarity['놀람'] === 'negative') {
          emotionTotals['놀람'] += surprise
        }
        
        // 부끄러움: 맥락 기반 (부정인 경우만)
        const shame = scores['부끄러움'] || 0
        if (shame > 0 && emotionPolarity['부끄러움'] === 'negative') {
          emotionTotals['부끄러움'] += shame
        }
      }
      
      // 총합 계산
      const total = Object.values(emotionTotals).reduce((sum, val) => sum + val, 0)
      
      // 비율로 변환하여 기여도 배열 생성
      const contributions = Object.entries(emotionTotals)
        .map(([emotion, score]) => ({
          emotion,
          score,
          ratio: total > 0 ? score / total : 0
        }))
        .filter(item => item.score > 0) // 점수가 있는 것만
        .sort((a, b) => b.score - a.score) // 점수 높은 순으로 정렬
      
      setEmotionContributions(contributions)
    } catch (error) {
      console.error('감정 기여도 계산 실패:', error)
      setEmotionContributions([])
    }
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

  // 우물 상태 메시지 함수
  const getWellStatusMessage = () => {
    const percent = waterPercent

    if (isOverflowing) {
      return {
        message: "우물이 넘쳤어요!",
        description: "부정적인 감정이 너무 많이 쌓였어요. 긍정적인 일기를 작성하면 물이 줄어들 거예요. 주민들이 우체통에 위로의 편지를 보냈으니 확인해 보세요.",
        emoji: "⚠️"
      }
    } else if (percent >= 80) {
      return {
        message: "물이 거의 찼어요",
        description: "우물이 곧 넘칠 것 같아요. 긍정적인 일기를 작성하면 물이 줄어들 거예요.",
        emoji: "💧"
      }
    } else if (percent >= 50) {
      return {
        message: "물이 많이 찼어요",
        description: "부정적인 감정이 많이 쌓였어요. 긍정적인 일기를 작성해 보는 건 어때요?",
        emoji: "💦"
      }
    } else if (percent >= 20) {
      return {
        message: "물이 절반 정도 찼어요",
        description: "괜찮아요! 긍정적인 감정을 나누면 물이 줄어들 거예요.",
        emoji: "🌊"
      }
    } else {
      return {
        message: "물이 조금밖에 없어요",
        description: "좋아요! 우물이 깨끗해요. 계속 긍정적인 감정을 유지해 주세요.",
        emoji: "✨"
      }
    }
  }

  const wellStatus = getWellStatusMessage()

  return (
    <div className="well-container">
      <FloatingResidents count={2} />
      <div className="well-header">
        {onNavigate && (
          <button
            className="well-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <div className="well-header-content">
          <h1 className="well-title">스트레스 우물</h1>
          <p className="well-subtitle">
            부정적인 감정이 쌓이면 물이 차오르고, 긍정적인 감정이 모이면 물이 줄어들어요
          </p>
        </div>
        <button 
          className="well-info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="well-info-toggle-icon">{showInfo ? '📖' : '📘'}</span>
          <span className="well-info-toggle-text">우물 설명서</span>
        </button>
      </div>

      {/* 설명 섹션 - 버튼 바로 밑에 표시 */}
      {showInfo && (
        <div className="well-info-section">
          <div className="well-info-content-wrapper">
            <h3 className="well-info-title">우물이 작동하는 방법</h3>
            <div className="well-info-cards">
              <div className="well-info-card">
                <span className="well-info-icon">🧊</span>
                <div className="well-info-content">
                  <span className="well-info-text">부정 감정이 들어오면</span>
                  <span className="well-info-arrow">→</span>
                  <span className="well-info-result">물이 +30점 차올라요</span>
                </div>
              </div>
              <div className="well-info-card">
                <span className="well-info-icon">🔆</span>
                <div className="well-info-content">
                  <span className="well-info-text">행복 나무의 열매가 열리면</span>
                  <span className="well-info-arrow">→</span>
                  <span className="well-info-result">물이 –50점 줄어들어요</span>
                </div>
              </div>
              <div className="well-info-card">
                <span className="well-info-icon">🎉</span>
                <div className="well-info-content">
                  <span className="well-info-text">우물이 가득 차면</span>
                  <span className="well-info-arrow">→</span>
                  <span className="well-info-result">주민들이 위로의 편지를 보내요</span>
                </div>
              </div>
            </div>


          </div>
        </div>
      )}

      {/* 우측 상단에 작은 알림 배지들 */}
      <div className="well-alerts">
        {!isOverflowing && waterPercent > 50 && !hideWarningAlert && (
          <div className="well-warning-alert">
            <span className="well-warning-alert-icon">⚠️</span>
            <span className="well-warning-alert-text">
              우물의 물이 절반 이상 찼어요. 긍정적인 일기를 작성하면 물이 줄어들 거예요.
            </span>
            <button
              className="well-alert-close"
              onClick={() => {
                // localStorage에 닫기 상태 저장
                localStorage.setItem('wellWarningDismissed', Date.now().toString())
                setHideWarningAlert(true)
              }}
            >
              ✕
            </button>
          </div>
        )}
        {isPastDate && !hideDateNotice && (
          <div className="well-date-notice">
            <span className="well-date-notice-text">
              📅 현재 상태는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준이에요.
            </span>
            <button
              className="well-alert-close"
              onClick={() => setHideDateNotice(true)}
            >
              ✕
            </button>
          </div>
        )}
        {bonusInfo && (
          <div className="well-bonus-message">
            <span className="well-bonus-icon">💧</span>
            <span className="well-bonus-text">
              부정적인 감정만 있어서 우물에 물이 <strong>{bonusInfo.bonusScore}점</strong> 더 차올랐어요.
            </span>
            <button
              className="well-alert-close"
              onClick={() => {
                localStorage.removeItem('wellBonus')
                setBonusInfo(null)
              }}
            >
              ✕
            </button>
          </div>
        )}
        {reducedInfo && (
          <div className="well-reduced-message">
            <span className="well-reduced-icon">✨</span>
            <span className="well-reduced-text">
              긍정적인 감정으로 우물에 물이 <strong>{reducedInfo.reducedAmount}점</strong> 줄어들었어요.
            </span>
            <button
              className="well-alert-close"
              onClick={() => {
                localStorage.removeItem('wellReduced')
                setReducedInfo(null)
              }}
            >
              ✕
            </button>
          </div>
        )}
        {selectedDateImpact && !hideDateImpact && (
          <div className="well-date-impact">
            <span className="well-date-impact-icon">📝</span>
            <span className="well-date-impact-text">
              {selectedDateImpact.hasWaterAdded === false ? (
                <>오늘은 물이 차오르지 않았어요. 😊</>
              ) : (
                <>
                  {selectedDateImpact.date === today ? '오늘의 일기로' : `${new Date(selectedDateImpact.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기로`} 우물에 <strong>{selectedDateImpact.negativeScore}점</strong> 물이 차올랐어요. 💧
                </>
              )}
            </span>
            <button
              className="well-alert-close"
              onClick={() => setHideDateImpact(true)}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      <div className="well-content">
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
              
              {/* 물 높이 숫자 */}
              <div className="well-water-level-text">
                {wellState.waterLevel} / {WELL_MAX_CAPACITY}
              </div>
              
              {/* 우물 가장자리 */}
              <div className="well-rim"></div>
            </div>
            
            {/* 넘침 경고 */}
          </div>

          {/* 우물 상태 메시지 */}
          <div className={`well-status-message ${isOverflowing ? 'well-status-overflowing' : ''}`}>
            <div className="well-status-emoji">{wellStatus.emoji}</div>
            <div className="well-status-content">
              <div className="well-status-title">{wellStatus.message}</div>
              <div className="well-status-description">{wellStatus.description}</div>
            </div>
        {isOverflowing && (
          <button
            className="well-reset-button"
            onClick={handleResetWellClick}
          >
            우물 비우기
          </button>
        )}
          </div>

        </div>

        {/* 감정별 기여도 섹션 */}
        <div className="well-contribution-section">
          <h2 className="well-contribution-title">스트레스 우물 기여도</h2>
          <p className="well-contribution-description">
            어떤 감정이 우물에 물이 차오르게 했는지 확인할 수 있어요.
          </p>
          {emotionContributions.length > 0 ? (
            <div className="well-contribution-list">
              {emotionContributions.map((item) => (
                <div key={item.emotion} className="well-contribution-item">
                  <div className="well-contribution-label">
                    <span className="well-contribution-emotion">
                      {item.emotion}
                    </span>
                    <span className="well-contribution-percent">
                      {Math.round(item.ratio * 100)}%
                    </span>
                  </div>
                  <div className="well-contribution-bar-container">
                    <div
                      className="well-contribution-bar"
                      style={{ 
                        width: `${item.ratio * 100}%`,
                        backgroundColor: getEmotionColorByName(item.emotion)
                      }}
                    />
                  </div>
                  <div className="well-contribution-score">
                    {Math.round(item.score)}점
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="well-contribution-empty">
              아직 기여도 데이터가 없어요. 일기를 작성하면 확인할 수 있어요.
            </p>
          )}
        </div>
      </div>

      {/* 우물 비우기 확인 다이얼로그 */}
      {showResetConfirm && (
        <div className="well-reset-confirm-popup">
          <div className="well-reset-confirm-content">
            <div className="well-reset-confirm-icon">💧</div>
            <h3 className="well-reset-confirm-title">정말 비우시겠습니까?</h3>
            <div className="well-reset-confirm-message">
              우물의 모든 물이 사라지고 초기 상태로 돌아갑니다.
            </div>
            <div className="well-reset-confirm-buttons">
              <button
                type="button"
                className="well-reset-confirm-button well-reset-confirm-button-cancel"
                onClick={handleResetCancel}
                disabled={isResetting}
              >
                취소
              </button>
              <button
                type="button"
                className="well-reset-confirm-button well-reset-confirm-button-confirm"
                onClick={handleResetConfirm}
                disabled={isResetting}
              >
                {isResetting ? '비우는 중...' : '비우기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 우물 비우기 완료 팝업 */}
      {showResetSuccessPopup && (
        <div className="well-reset-success-popup">
          <div className="well-reset-success-popup-content">
            <div className="well-reset-success-icon">✨</div>
            <h3 className="well-reset-success-title">비워졌습니다!</h3>
            <div className="well-reset-success-message">
              우물이 깨끗하게 비워졌어요!
            </div>
            <button
              type="button"
              className="well-reset-success-button"
              onClick={handleCloseSuccessPopup}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Well

