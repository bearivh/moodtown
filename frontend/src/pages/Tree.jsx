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
  const today = getTodayDateString()
  const isPastDate = selectedDate && selectedDate < today

  useEffect(() => {
    loadTreeData()
    if (selectedDate && isPastDate) {
      loadSelectedDateImpact()
    } else {
      setSelectedDateImpact(null)
    }
    
    // 주기적으로 상태 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadTreeData()
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
    let totalPositiveScore = 0
    for (const diary of diaries) {
      const emotionScores = diary.emotion_scores || {}
      const positiveScore = (emotionScores['기쁨'] || 0) + (emotionScores['사랑'] || 0)
      totalPositiveScore += positiveScore
    }
    
    if (totalPositiveScore > 0) {
      setSelectedDateImpact({
        date: selectedDate,
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
        <h1 className="tree-title">행복 나무</h1>
        <p className="tree-subtitle">
          긍정적인 감정이 쌓일수록 나무가 자라요
        </p>
        {isPastDate && (
          <div className="tree-date-notice">
            <span className="tree-date-notice-text">
              📅 현재 상태는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준입니다
            </span>
          </div>
        )}
      </div>

      <div className="tree-content">
        {/* 선택한 날짜의 일기로 인한 변화 표시 */}
        {selectedDateImpact && isPastDate && (
          <div className="tree-date-impact">
            <div className="tree-date-impact-icon">📝</div>
            <div className="tree-date-impact-content">
              <div className="tree-date-impact-title">
                {new Date(selectedDateImpact.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기로
              </div>
              <div className="tree-date-impact-message">
                행복 나무가 <strong>{selectedDateImpact.positiveScore}점</strong> 성장했어요! 🌱
              </div>
            </div>
          </div>
        )}
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
            나무가 열매를 맺을 때마다 바구니에 모여요
          </p>
        </div>

        {/* 설명 */}
        <div className="tree-info-section">
          <h3 className="tree-info-title">나무가 자라는 방법</h3>
          <ul className="tree-info-list">
            <li>일기를 작성하면 감정이 분석됩니다</li>
            <li>긍정적인 감정(기쁨, 사랑)이 나무를 성장시킵니다</li>
            <li>나무가 완전히 자라면 열매가 열립니다</li>
            <li>열매가 열리면 우체통에 축하 편지가 도착합니다</li>
            <li>나무는 다시 씨앗부터 자라기 시작합니다</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Tree

