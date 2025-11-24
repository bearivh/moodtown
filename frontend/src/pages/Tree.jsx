import { useState, useEffect } from 'react'
import {
  getTreeState,
  getHappyFruitCount,
  getStageName,
  getStageEmoji,
  getStageProgress,
  getPointsToNextStage,
  TREE_STAGES
} from '../utils/treeUtils'
import { getDiariesByDate } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import './Tree.css'

function Tree({ onNavigate, selectedDate }) {
  const [treeState, setTreeState] = useState(null)
  const [fruitCount, setFruitCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [pointsToNext, setPointsToNext] = useState(0)
  const [selectedDateImpact, setSelectedDateImpact] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [bonusInfo, setBonusInfo] = useState(null)
  const [hideDateNotice, setHideDateNotice] = useState(false)
  const [hideDateImpact, setHideDateImpact] = useState(false)
  const today = getTodayDateString()
  const isPastDate = selectedDate && selectedDate < today

  useEffect(() => {
    loadTreeData()
    // 선택한 날짜가 있으면 해당 날짜, 없으면 오늘 날짜의 일기 확인
    const dateToCheck = selectedDate || today
    if (dateToCheck) {
      loadSelectedDateImpact(dateToCheck)
    } else {
      setSelectedDateImpact(null)
    }
    
    // localStorage에서 보너스 정보 확인
    const treeBonusStr = localStorage.getItem('treeBonus')
    if (treeBonusStr) {
      try {
        const bonusData = JSON.parse(treeBonusStr)
        // 24시간 이내의 보너스만 표시
        if (Date.now() - bonusData.timestamp < 24 * 60 * 60 * 1000) {
          setBonusInfo(bonusData)
        } else {
          localStorage.removeItem('treeBonus')
          setBonusInfo(null)
        }
      } catch (e) {
        localStorage.removeItem('treeBonus')
        setBonusInfo(null)
      }
    } else {
      setBonusInfo(null)
    }
    
    // 주기적으로 상태 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadTreeData()
      const dateToCheck = selectedDate || today
      if (dateToCheck) {
        loadSelectedDateImpact(dateToCheck)
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [selectedDate, today])

  const loadSelectedDateImpact = async (date) => {
    if (!date) return
    
    const diaries = await getDiariesByDate(date)
    if (diaries.length === 0) {
      setSelectedDateImpact(null)
      return
    }
    
    // 선택한 날짜의 일기 감정 점수 계산
    let totalPositiveScore = 0
    for (const diary of diaries) {
      const emotionScores = diary.emotion_scores || {}
      const positiveScore = (emotionScores['기쁨'] || 0) + (emotionScores['사랑'] || 0)
      totalPositiveScore += positiveScore
    }
    
    if (totalPositiveScore > 0) {
      setSelectedDateImpact({
        date: date,
        positiveScore: totalPositiveScore
      })
    } else {
      setSelectedDateImpact(null)
    }
  }

  const loadTreeData = async () => {
    const state = await getTreeState()
    const count = await getHappyFruitCount()
    const progressPercent = getStageProgress(state.growth, state.stage)
    const pointsNeeded = getPointsToNextStage(state.growth, state.stage)
    
    setTreeState(state)
    setFruitCount(count)
    setProgress(progressPercent)
    setPointsToNext(pointsNeeded)
  }

  if (!treeState) {
    return (
      <div className="tree-container">
        <div className="tree-loading">로딩 중...</div>
      </div>
    )
  }

  const stageName = getStageName(treeState.stage)
  const stageEmoji = getStageEmoji(treeState.stage)
  const isFruitStage = treeState.stage === TREE_STAGES.FRUIT

  return (
    <div className="tree-container">
      <div className="tree-header">
        {onNavigate && (
          <button
            className="tree-back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <div className="tree-header-content">
          <h1 className="tree-title">행복 나무</h1>
          <p className="tree-subtitle">
            긍정적인 감정이 쌓일수록 나무가 자라요
          </p>
        </div>
        <button 
          className="tree-info-toggle"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="tree-info-toggle-icon">{showInfo ? '📖' : '📘'}</span>
          <span className="tree-info-toggle-text">나무 설명서</span>
        </button>
      </div>

      {/* 설명 섹션 - 버튼 바로 밑에 표시 */}
      {showInfo && (
        <div className="tree-info-section">
          <div className="tree-info-content-wrapper">
            <h3 className="tree-info-title">나무가 자라는 방법</h3>
            <div className="tree-info-cards">
              <div className="tree-info-card">
                <span className="tree-info-icon">🌱</span>
                <div className="tree-info-content">
                  <span className="tree-info-text">긍정 감정이 들어오면</span>
                  <span className="tree-info-arrow">→</span>
                  <span className="tree-info-result">나무가 성장해요</span>
                </div>
              </div>
              <div className="tree-info-card">
                <span className="tree-info-icon">🌳</span>
                <div className="tree-info-content">
                  <span className="tree-info-text">나무가 완전히 자라면</span>
                  <span className="tree-info-arrow">→</span>
                  <span className="tree-info-result">열매가 열려요</span>
                </div>
              </div>
              <div className="tree-info-card">
                <span className="tree-info-icon">🎉</span>
                <div className="tree-info-content">
                  <span className="tree-info-text">열매가 열리면</span>
                  <span className="tree-info-arrow">→</span>
                  <span className="tree-info-result">주민들이 축하 편지를 보내요</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 우측 상단에 작은 알림 배지들 */}
      <div className="tree-alerts">
        {isPastDate && !hideDateNotice && (
          <div className="tree-date-notice">
            <span className="tree-date-notice-text">
              📅 현재 상태는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준입니다
            </span>
            <button
              className="tree-alert-close"
              onClick={() => setHideDateNotice(true)}
            >
              ✕
            </button>
          </div>
        )}
        {bonusInfo && (
          <div className="tree-bonus-message">
            <span className="tree-bonus-icon">🌱</span>
            <span className="tree-bonus-text">
              사랑과 기쁨만 있어서 나무가 <strong>{bonusInfo.bonusScore}점</strong> 더 성장했어요!
            </span>
            <button
              className="tree-alert-close"
              onClick={() => {
                localStorage.removeItem('treeBonus')
                setBonusInfo(null)
              }}
            >
              ✕
            </button>
          </div>
        )}
        {selectedDateImpact && !hideDateImpact && (
          <div className="tree-date-impact">
            <span className="tree-date-impact-icon">📝</span>
            <span className="tree-date-impact-text">
              {selectedDateImpact.date === today ? '오늘의 일기로' : `${new Date(selectedDateImpact.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기로`} 행복 나무가 <strong>{selectedDateImpact.positiveScore}점</strong> 성장했어요! 🌱
            </span>
            <button
              className="tree-alert-close"
              onClick={() => setHideDateImpact(true)}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="tree-content">
        {/* 나무 표시 영역 */}
        <div className="tree-display-section">
          <div className="tree-visual">
            <div className="tree-emoji">{stageEmoji}</div>
            <div className="tree-stage-name">{stageName}</div>
          </div>

          {/* 성장 진행도 */}
          {!isFruitStage && (
            <div className="tree-progress-section">
              <div className="tree-progress-bar-container">
                <div
                  className="tree-progress-bar"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="tree-progress-info">
                <span className="tree-progress-text">
                  다음 단계까지 {pointsToNext}점 필요
                </span>
                <span className="tree-progress-percent">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          )}

          {/* 열매 단계 메시지 */}
          {isFruitStage && (
            <div className="tree-fruit-message">
              <div className="tree-fruit-icon">🎉</div>
              <div className="tree-fruit-text">
                열매가 열렸어요! 축하합니다! 🎊
              </div>
            </div>
          )}

          {/* 현재 성장도 정보 */}
          <div className="tree-stats">
            <div className="tree-stat-item">
              <span className="tree-stat-label">현재 성장도</span>
              <span className="tree-stat-value">{treeState.growth}점</span>
            </div>
            <div className="tree-stat-item">
              <span className="tree-stat-label">현재 단계</span>
              <span className="tree-stat-value">{stageName}</span>
            </div>
          </div>
        </div>

        {/* 행복 열매 바구니 */}
        <div className="tree-basket-section">
          <h2 className="tree-basket-title">행복 열매 바구니</h2>
          <div className="tree-basket">
            <div className="tree-basket-icon">🧺</div>
            <div className="tree-basket-count">{fruitCount}개</div>
            <div className="tree-basket-label">행복 열매</div>
          </div>
          <p className="tree-basket-description">
            나무가 열매를 맺을 때마다 바구니에 모여요.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Tree

