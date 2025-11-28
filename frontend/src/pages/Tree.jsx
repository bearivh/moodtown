import { useState, useEffect } from 'react'
import {
  getTreeState,
  getHappyFruitCount,
  getStageName,
  getStageEmoji,
  getStageProgress,
  getPointsToNextStage,
  getTreeStateCache,
  updateTreeStateCache,
  TREE_STAGES
} from '../utils/treeUtils'
import FloatingResidents from '../components/FloatingResidents'
import { getDiariesByDate, getAllDiaries } from '../utils/storage'
import { getTodayDateString } from '../utils/dateUtils'
import { classifyEmotionsWithContext } from '../utils/emotionUtils'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import './Tree.css'

function Tree({ onNavigate, selectedDate }) {
  // 캐시에서 초기값 가져오기 (lazy initialization)
  const [treeState, setTreeState] = useState(() => {
    const cachedState = getTreeStateCache()
    if (cachedState) {
      return cachedState.state
    }
    return null
  })
  
  const [fruitCount, setFruitCount] = useState(0)
  const [progress, setProgress] = useState(() => {
    const cachedState = getTreeStateCache()
    if (cachedState && cachedState.progress !== undefined) {
      return cachedState.progress
    }
    return 0
  })
  const [pointsToNext, setPointsToNext] = useState(0)
  const [selectedDateImpact, setSelectedDateImpact] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const [bonusInfo, setBonusInfo] = useState(null)
  const [hideDateNotice, setHideDateNotice] = useState(false)
  const [hideDateImpact, setHideDateImpact] = useState(false)
  const [emotionContributions, setEmotionContributions] = useState([])
  const [showFruitPopup, setShowFruitPopup] = useState(false)
  const [fruitCountPopup, setFruitCountPopup] = useState(0)
  const today = getTodayDateString()
  const isPastDate = selectedDate && selectedDate < today

  // 보너스 정보 검증 및 로드
  const loadAndValidateBonusInfo = async () => {
    const treeBonusStr = localStorage.getItem('treeBonus')
    if (!treeBonusStr) {
      setBonusInfo(null)
      return
    }
    
    try {
      const bonusData = JSON.parse(treeBonusStr)
      // 24시간 이내의 보너스만 표시
      if (Date.now() - bonusData.timestamp >= 24 * 60 * 60 * 1000) {
        localStorage.removeItem('treeBonus')
        setBonusInfo(null)
        return
      }
      
      // 보너스 날짜의 일기를 확인하여 실제로 사랑/기쁨만 있었는지 검증
      const bonusDate = bonusData.date
      if (bonusDate) {
        const diaries = await getDiariesByDate(bonusDate)
        if (diaries.length > 0) {
          const diary = diaries[0]
          const emotionScores = diary.emotion_scores || {}
          const emotionPolarity = diary.emotion_polarity || {}
          
          // 부정 감정 확인
          const fear = emotionScores['두려움'] || 0
          const anger = emotionScores['분노'] || 0
          const sadness = emotionScores['슬픔'] || 0
          
          // 놀람/부끄러움 극성 확인
          const surprise = emotionScores['놀람'] || 0
          const shame = emotionScores['부끄러움'] || 0
          const surprisePolarity = emotionPolarity['놀람']
          const shamePolarity = emotionPolarity['부끄러움']
          
          // 부정 감정이 있으면 보너스 메시지 표시하지 않음
          if (fear > 0 || anger > 0 || sadness > 0) {
            console.log('[나무 보너스 무효] 부정 감정이 있음:', { fear, anger, sadness, emotionScores })
            localStorage.removeItem('treeBonus')
            setBonusInfo(null)
            return
          }
          
          // 놀람이 부정으로 분류되었으면 보너스 무효
          if (surprise > 0 && surprisePolarity !== 'positive') {
            console.log('[나무 보너스 무효] 놀람이 부정:', { surprise, surprisePolarity })
            localStorage.removeItem('treeBonus')
            setBonusInfo(null)
            return
          }
          
          // 부끄러움이 부정으로 분류되었으면 보너스 무효
          if (shame > 0 && shamePolarity !== 'positive') {
            console.log('[나무 보너스 무효] 부끄러움이 부정:', { shame, shamePolarity })
            localStorage.removeItem('treeBonus')
            setBonusInfo(null)
            return
          }
        }
      }
      
      setBonusInfo(bonusData)
    } catch (e) {
      console.error('[나무 보너스 파싱 오류]', e)
      localStorage.removeItem('treeBonus')
      setBonusInfo(null)
    }
  }

  useEffect(() => {
    // 캐시에서 즉시 복원
    const cachedState = getTreeStateCache()
    if (cachedState) {
      setTreeState(cachedState.state)
      setProgress(cachedState.progress || 0)
    }
    
    loadTreeData()
    loadEmotionContributions()
    // 선택한 날짜가 있으면 해당 날짜, 없으면 오늘 날짜의 일기 확인
    const dateToCheck = selectedDate || today
    if (dateToCheck) {
      loadSelectedDateImpact(dateToCheck)
    } else {
      setSelectedDateImpact(null)
    }
    
    // 보너스 정보 검증 및 로드
    loadAndValidateBonusInfo()
    
    // 열매 맺힘 팝업 확인
    checkFruitProduced()
    
    // 주기적으로 상태 업데이트 (5초마다)
    const interval = setInterval(() => {
      loadTreeData()
      loadEmotionContributions()
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
    
    // 선택한 날짜의 일기 감정 점수 계산 (맥락 기반 분류 사용)
    // 보너스 점수도 포함하여 실제 성장 점수 계산
    let totalPositiveScore = 0
    let totalBonusScore = 0
    
    for (const diary of diaries) {
      const emotionScores = diary.emotion_scores || {}
      const emotionPolarity = diary.emotion_polarity || {}
      const { positive } = classifyEmotionsWithContext(emotionScores, emotionPolarity)
      totalPositiveScore += positive
      
      // 보너스 점수 계산 (사랑/기쁨만 있는 경우)
      if (positive > 0) {
        const joy = emotionScores['기쁨'] || 0
        const love = emotionScores['사랑'] || 0
        const fear = emotionScores['두려움'] || 0
        const anger = emotionScores['분노'] || 0
        const sadness = emotionScores['슬픔'] || 0
        const surprise = emotionScores['놀람'] || 0
        const shame = emotionScores['부끄러움'] || 0
        
        // 부정 감정 확인
        const hasNegative = fear > 0 || anger > 0 || sadness > 0
        
        // 놀람/부끄러움 극성 확인
        const surpriseIsNegative = surprise > 0 && emotionPolarity['놀람'] !== 'positive'
        const shameIsNegative = shame > 0 && emotionPolarity['부끄러움'] !== 'positive'
        
        // 사랑/기쁨 중 하나 이상 있고, 부정 감정이 없으면 보너스
        if ((joy > 0 || love > 0) && !hasNegative && !surpriseIsNegative && !shameIsNegative) {
          totalBonusScore += Math.floor(positive * 0.25) // 25% 보너스
        }
      }
    }
    
    const totalGrowth = totalPositiveScore + totalBonusScore
    
    // 오늘 날짜이고 일기가 있는 경우, 성장이 없어도 메시지 표시
    if (date === today && diaries.length > 0) {
      if (totalGrowth > 0) {
        setSelectedDateImpact({
          date: date,
          positiveScore: totalGrowth,  // 보너스 포함 실제 성장 점수
          baseScore: totalPositiveScore,
          bonusScore: totalBonusScore,
          hasGrowth: true
        })
      } else {
        // 성장이 없는 경우
        setSelectedDateImpact({
          date: date,
          positiveScore: 0,
          hasGrowth: false
        })
      }
    } else if (totalGrowth > 0) {
      // 과거 날짜는 성장이 있을 때만 표시
      setSelectedDateImpact({
        date: date,
        positiveScore: totalGrowth,  // 보너스 포함 실제 성장 점수
        baseScore: totalPositiveScore,
        bonusScore: totalBonusScore,
        hasGrowth: true
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
    
    // 모듈 레벨 캐시 업데이트 (treeUtils의 캐시 사용)
    updateTreeStateCache(state, progressPercent)
  }

  const checkFruitProduced = () => {
    const fruitProducedStr = localStorage.getItem('treeFruitProduced')
    if (fruitProducedStr) {
      try {
        const fruitData = JSON.parse(fruitProducedStr)
        setFruitCountPopup(fruitData.fruitCount || 0)
        setShowFruitPopup(true)
      } catch (e) {
        console.error('[열매 팝업 파싱 오류]', e)
        localStorage.removeItem('treeFruitProduced')
      }
    }
  }

  const handleCloseFruitPopup = () => {
    setShowFruitPopup(false)
    localStorage.removeItem('treeFruitProduced')
    // 나무 상태 새로고침 (이미 초기화되어 있을 것)
    loadTreeData()
  }

  const loadEmotionContributions = async () => {
    try {
      const allDiaries = await getAllDiaries()
      
      // 감정별 긍정 점수 합산
      const emotionTotals = {
        '기쁨': 0,
        '사랑': 0,
        '놀람': 0,
        '부끄러움': 0
      }
      
      for (const diary of allDiaries) {
        const scores = diary.emotion_scores || {}
        const emotionPolarity = diary.emotion_polarity || {}
        
        // 기쁨, 사랑은 항상 긍정
        emotionTotals['기쁨'] += scores['기쁨'] || 0
        emotionTotals['사랑'] += scores['사랑'] || 0
        
        // 놀람: 맥락 기반
        const surprise = scores['놀람'] || 0
        if (surprise > 0 && emotionPolarity['놀람'] === 'positive') {
          emotionTotals['놀람'] += surprise
        }
        
        // 부끄러움: 맥락 기반
        const shame = scores['부끄러움'] || 0
        if (shame > 0 && emotionPolarity['부끄러움'] === 'positive') {
          emotionTotals['부끄러움'] += shame
        }
      }
      
      // 총합 계산
      const total = Object.values(emotionTotals).reduce((sum, val) => sum + val, 0)
      
      // 비율로 변환하여 기여도 배열 생성 (놀람/부끄러움의 경우 극성 정보 포함)
      const contributions = Object.entries(emotionTotals)
        .map(([emotion, score]) => {
          const contribution = {
            emotion,
            score,
            ratio: total > 0 ? score / total : 0
          }
          
          // 놀람/부끄러움이 기여도에 포함된 경우, 긍정으로 해석되었다는 정보 추가
          if ((emotion === '놀람' || emotion === '부끄러움') && score > 0) {
            contribution.isContextual = true
            contribution.polarity = 'positive'
          }
          
          return contribution
        })
        .filter(item => item.score > 0) // 점수가 있는 것만
        .sort((a, b) => b.score - a.score) // 점수 높은 순으로 정렬
      
      setEmotionContributions(contributions)
    } catch (error) {
      console.error('감정 기여도 계산 실패:', error)
      setEmotionContributions([])
    }
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
      {/* 열매 맺힘 축하 팝업 */}
      {showFruitPopup && (
        <div className="tree-fruit-popup-overlay" onClick={handleCloseFruitPopup}>
          <div className="tree-fruit-popup" onClick={(e) => e.stopPropagation()}>
            <div className="tree-fruit-popup-content">
              <div className="tree-fruit-popup-icon">🎉</div>
              <div className="tree-fruit-popup-title">
                축하해요! {fruitCountPopup}번째 행복 열매가 맺혔어요!
              </div>
              <button 
                className="tree-fruit-popup-close"
                onClick={handleCloseFruitPopup}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
      <FloatingResidents count={2} />
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
            
            {/* 나무 단계 정보 */}
            <div className="tree-stages-info">
              <h4 className="tree-stages-title">나무 성장 단계</h4>
              <div className="tree-stages-list">
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🟤</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">씨앗</span>
                    <span className="tree-stage-threshold">0점 이상</span>
                  </div>
                </div>
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🌱</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">새싹</span>
                    <span className="tree-stage-threshold">40점 이상</span>
                  </div>
                </div>
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🪴</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">묘목</span>
                    <span className="tree-stage-threshold">100점 이상</span>
                  </div>
                </div>
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🌲</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">중간 나무</span>
                    <span className="tree-stage-threshold">220점 이상</span>
                  </div>
                </div>
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🌳</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">큰 나무</span>
                    <span className="tree-stage-threshold">380점 이상</span>
                  </div>
                </div>
                <div className="tree-stage-item">
                  <span className="tree-stage-emoji">🍎</span>
                  <div className="tree-stage-detail">
                    <span className="tree-stage-name">열매 열림</span>
                    <span className="tree-stage-threshold">600점 이상</span>
                  </div>
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
              📅 현재 상태는 {new Date(today).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준이에요
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
              긍정적인 감정만 있어서 나무가 <strong>{bonusInfo.bonusScore}점</strong> 더 성장했어요!
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
              {selectedDateImpact.hasGrowth === false ? (
                <>오늘은 나무가 자라지 않았어요. 😊</>
              ) : (
                <>
                  {selectedDateImpact.date === today ? '오늘의 일기로' : `${new Date(selectedDateImpact.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}의 일기로`} 행복 나무가 <strong>{selectedDateImpact.positiveScore}점</strong> 성장했어요! 🌱
                </>
              )}
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
            
            {/* 행복 열매를 나무 밑에 작게 표시 */}
            {fruitCount > 0 && (
              <div className="tree-fruit-under">
                <span className="tree-fruit-emoji-small">🍎</span>
                <span className="tree-fruit-count-small">{fruitCount}개</span>
              </div>
            )}
          </div>

          {/* 성장 진행도 */}
          {!isFruitStage && treeState && (
            <div className="tree-progress-section">
              <div className="tree-progress-bar-container">
                <div
                  className="tree-progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                ></div>
              </div>
              <div className="tree-progress-info">
                <span className="tree-progress-text">
                  다음 단계까지 {pointsToNext}점 필요
                </span>
                <span className="tree-progress-percent">
                  {Math.round(Math.max(0, Math.min(100, progress)))}%
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

        {/* 감정별 기여도 섹션 */}
        <div className="tree-contribution-section">
          <h2 className="tree-contribution-title">행복 나무 성장 기여도</h2>
          <p className="tree-contribution-description">
            어떤 감정이 나무 성장에 기여했는지 확인할 수 있어요.
          </p>
          {emotionContributions.length > 0 ? (
            <div className="tree-contribution-list">
              {emotionContributions.map((item) => (
                <div key={item.emotion} className="tree-contribution-item">
                  <div className="tree-contribution-label">
                    <div className="tree-contribution-emotion-wrapper">
                      <span className="tree-contribution-emotion">
                        {item.emotion}
                      </span>
                      {(item.emotion === '놀람' || item.emotion === '부끄러움') && item.isContextual && (
                        <div className="tree-contribution-info-tooltip-container">
                          <span className="tree-contribution-info-icon">ⓘ</span>
                          <div className="tree-contribution-info-tooltip">
                            긍정적인 {item.emotion}으로 해석되어 행복 나무가 자라게 했어요.
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="tree-contribution-percent">
                      {Math.round(item.ratio * 100)}%
                    </span>
                  </div>
                  <div className="tree-contribution-bar-container">
                    <div
                      className="tree-contribution-bar"
                      style={{ 
                        width: `${item.ratio * 100}%`,
                        backgroundColor: getEmotionColorByName(item.emotion)
                      }}
                    />
                  </div>
                  <div className="tree-contribution-score">
                    {Math.round(item.score)}점
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="tree-contribution-empty">
              아직 기여도 데이터가 없어요. 일기를 작성하면 확인할 수 있어요.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Tree

