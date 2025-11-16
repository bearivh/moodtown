import { useState, useEffect } from 'react'
import { saveDiary, getDiariesByDate, replaceDiary } from '../utils/storage'
import { analyzeDiary, analyzeText } from '../utils/api'
import { addPositiveEmotion, getHappyFruitCount } from '../utils/treeUtils'
import { addNegativeEmotion, reduceWaterLevel, getWellState } from '../utils/wellUtils'
import { addHappyFruitCelebrationLetter, addWellOverflowComfortLetter } from '../utils/mailboxUtils'
import { getTodayDateString } from '../utils/dateUtils'
import './WriteDiary.css'

function WriteDiary({ onNavigate, selectedDate }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [date, setDate] = useState(selectedDate || getTodayDateString())
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [existingDiary, setExistingDiary] = useState(null)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [pendingDiaryData, setPendingDiaryData] = useState(null)
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoResult, setDemoResult] = useState(null) // {mode, emotion_result?{emotion_scores}, result?{scores}, ...}
  const [analysisCache, setAnalysisCache] = useState({ contentKey: null, gpt: null, ml: null }) // per-mode cache
  const [currentMode, setCurrentMode] = useState(null) // 'gpt' | 'ml' | null
  const [showLowMl, setShowLowMl] = useState(false) // ML: 5% 이하 표시 토글

  const getContentKey = (txt) => `${(txt || '').trim()}::${(txt || '').length}`

  // 날짜가 변경될 때마다 해당 날짜의 기존 일기 확인
  useEffect(() => {
    const checkExistingDiary = async () => {
      const diaries = await getDiariesByDate(date)
      if (diaries.length > 0) {
        setExistingDiary(diaries[0])
      } else {
        setExistingDiary(null)
      }
    }
    checkExistingDiary()
  }, [date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!content.trim()) {
      setSaveMessage('일기 내용을 입력해주세요.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    setIsSaving(true)
    
    try {
      // 1. 감정 분석: 현재 선택 모드의 캐시가 있으면 재사용, 없으면 기본 GPT 분석
      let analysisResult = null
      const key = getContentKey(content)
      if (analysisCache.contentKey === key && currentMode && analysisCache[currentMode]) {
        analysisResult = analysisCache[currentMode]
      } else {
        analysisResult = await analyzeDiary(content.trim())
        setAnalysisCache(prev => ({ contentKey: key, gpt: analysisResult, ml: prev.ml }))
        setCurrentMode('gpt')
        setDemoResult(analysisResult)
      }
      const emotionScores = analysisResult.emotion_result?.emotion_scores || {}
      
      // 2. 긍정 감정 점수 계산 (기쁨 + 사랑)
      const positiveScore = (emotionScores['기쁨'] || 0) + (emotionScores['사랑'] || 0)
      
      // 3. 부정 감정 점수 계산 (분노 + 슬픔 + 두려움 + 부끄러움)
      const negativeScore = (emotionScores['분노'] || 0) + 
                           (emotionScores['슬픔'] || 0) + 
                           (emotionScores['두려움'] || 0) + 
                           (emotionScores['부끄러움'] || 0)
      
      const newDiaryData = {
        title: title.trim() || '제목 없음',
        content: content.trim(),
        date: date,
        emotion_scores: emotionScores,
        analyzed_at: new Date().toISOString()
      }

      // 4. 기존 일기가 있는지 확인
      if (existingDiary) {
        // 기존 일기가 있으면 확인 다이얼로그 표시
        setPendingDiaryData({ newDiaryData, emotionScores, positiveScore, negativeScore })
        setShowReplaceConfirm(true)
        setIsSaving(false)
        return
      }

      // 5. 기존 일기가 없으면 바로 저장
      await saveAndUpdateStates(newDiaryData, emotionScores, positiveScore, negativeScore)
    } catch (error) {
      console.error('일기 저장 중 오류:', error)
      const errorMessage = error.message || '일기 저장 중 오류가 발생했습니다.'
      setSaveMessage(`오류: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
      setIsSaving(false)
    }
  }

  const handleReplaceConfirm = async () => {
    if (!pendingDiaryData) return
    
    setIsSaving(true)
    setShowReplaceConfirm(false)
    
    try {
      const { newDiaryData, emotionScores, positiveScore, negativeScore } = pendingDiaryData
      const oldEmotionScores = existingDiary?.emotion_scores || {}
      
      // 1. 기존 일기 덮어쓰기 (백엔드에서 관련 상태 되돌리기 포함)
      await replaceDiary(date, oldEmotionScores, newDiaryData)
      
      // 2. 새 일기로 나무/우물 업데이트 (덮어쓰기 플래그 전달)
      await saveAndUpdateStates(newDiaryData, emotionScores, positiveScore, negativeScore, true)
    } catch (error) {
      console.error('일기 덮어쓰기 중 오류:', error)
      const errorMessage = error.message || '일기 덮어쓰기 중 오류가 발생했습니다.'
      setSaveMessage(`오류: ${errorMessage}`)
      setTimeout(() => setSaveMessage(''), 5000)
      setIsSaving(false)
    }
  }

  const handleReplaceCancel = () => {
    setShowReplaceConfirm(false)
    setPendingDiaryData(null)
    setIsSaving(false)
  }

  const saveAndUpdateStates = async (diaryData, emotionScores, positiveScore, negativeScore, isReplace = false) => {
    try {
      // 기존 일기가 없고 덮어쓰기가 아닐 때만 새로 저장 (덮어쓰기인 경우 백엔드에서 이미 저장됨)
      if (!existingDiary && !isReplace) {
        await saveDiary(diaryData)
      }

      // 나무 성장 처리 (감정 점수도 전달하여 보너스 계산)
      let bonusMessages = []
      if (positiveScore > 0) {
        const treeResult = await addPositiveEmotion(positiveScore, emotionScores)
        
        // 보너스 점수가 있으면 사용자에게 알림
        if (treeResult.bonusScore > 0) {
          bonusMessages.push(`나무 보너스 ${treeResult.bonusScore}점 추가! (사랑과 기쁨만 있는 날)`)
        }
        
        // 열매가 열리면 우체통에 편지 추가
        if (treeResult.fruitProduced) {
          const fruitCount = await getHappyFruitCount()
          await addHappyFruitCelebrationLetter(fruitCount)
          bonusMessages.push(`행복 나무 열매가 열려 우물 물이 50점 줄었어요! 🍎`)
        }
      }
      
      // 우물 업데이트 처리 (감정 점수도 전달하여 보너스 계산)
      if (negativeScore > 0) {
        const wellResult = await addNegativeEmotion(negativeScore, emotionScores)
        
        // 보너스 점수가 있으면 사용자에게 알림
        if (wellResult.bonusScore > 0) {
          bonusMessages.push(`우물 보너스 ${wellResult.bonusScore}점 추가! (부정적인 감정만 있는 날)`)
        }
        
        // 우물이 넘치면 우체통에 위로 편지 추가
        if (wellResult.overflowed) {
          await addWellOverflowComfortLetter(emotionScores)
        }
      } else if (negativeScore <= 5) {
        // 부정적인 감정이 하나도 없거나 매우 낮으면 우물 물이 조금 줄어듦
        const wellState = await getWellState()
        const wellReduced = await reduceWaterLevel(30) // 30점 감소
        if (wellReduced.waterLevel < wellState.waterLevel) {
          bonusMessages.push(`부정적인 감정이 없어 우물 물이 30점 줄었어요! 💧`)
        }
      }
      
      // 메시지 구성
      let saveMessageText = '일기가 저장되었습니다! ✨'
      if (bonusMessages.length > 0) {
        saveMessageText += `\n${bonusMessages.join('\n')}`
      }
      setSaveMessage(saveMessageText)
      // 폼 초기화
      setTitle('')
      setContent('')
      setDate(getTodayDateString())
      setExistingDiary(null)
      
      setTimeout(() => {
        setSaveMessage('')
        // 마을로 이동
        if (onNavigate) {
          setTimeout(() => onNavigate('village'), 500)
        }
      }, 2000)
    } catch (error) {
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  // ===== 데모/미리보기: 시스템 반영 없이 분석만 =====
  const handleAnalyzeDemoML = async () => {
    if (!content.trim()) {
      setSaveMessage('일기 내용을 입력해주세요.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }
    const key = getContentKey(content)
    setCurrentMode('ml')
    if (analysisCache.contentKey === key && analysisCache.ml) {
      setDemoResult(analysisCache.ml)
      return
    }
    setDemoLoading(true)
    setDemoResult(null)
    try {
      const res = await analyzeText({ content: content.trim(), mode: 'ml' })
      setDemoResult(res)
      setAnalysisCache(prev => ({ contentKey: key, gpt: prev.gpt, ml: res }))
    } catch (e) {
      setSaveMessage(`ML 데모 오류: ${e.message || e}`)
      setTimeout(() => setSaveMessage(''), 4000)
    } finally {
      setDemoLoading(false)
    }
  }

  const handleAnalyzePreviewGPT = async () => {
    if (!content.trim()) {
      setSaveMessage('일기 내용을 입력해주세요.')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }
    const key = getContentKey(content)
    setCurrentMode('gpt')
    if (analysisCache.contentKey === key && analysisCache.gpt) {
      setDemoResult(analysisCache.gpt)
      return
    }
    setDemoLoading(true)
    setDemoResult(null)
    try {
      const res = await analyzeText({ content: content.trim(), mode: 'gpt' })
      // 미리보기에는 감정 점수만 표시. 저장 시 동일 값 재사용을 위해 원형을 그대로 보존.
      // 서버가 mode를 안 줄 수도 있어 보강됨(api.js).
      setDemoResult(res)
      setAnalysisCache(prev => ({ contentKey: key, gpt: res, ml: prev.ml }))
    } catch (e) {
      setSaveMessage(`GPT 미리보기 오류: ${e.message || e}`)
      setTimeout(() => setSaveMessage(''), 4000)
    } finally {
      setDemoLoading(false)
    }
  }

  const renderScores = (scores, orderKeys = null, hideZeros = false) => {
    if (!scores) return null
    let entries
    if (Array.isArray(orderKeys) && orderKeys.length > 0) {
      // 지정된 순서로 표시(누락은 0)
      entries = orderKeys.map(k => [k, typeof scores[k] === 'number' ? scores[k] : 0])
    } else {
      // 데이터셋 라벨 기반: 점수 내림차순
      entries = Object.entries(scores).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    }
    if (hideZeros) {
      entries = entries.filter(([, v]) => typeof v === 'number' ? v > 0 : true)
    }
    if (entries.length === 0) return null
    const formatVal = (v) => {
      if (typeof v !== 'number') return `${v}`
      if (v <= 1) return `${Math.round(v * 100)}%`     // 확률(0~1) → 퍼센트
      if (v <= 100) return `${v}%`                      // 0~100 점수 → 퍼센트 표시
      return `${v}`
    }
    return (
      <div className="demo-scores">
        {entries.map(([k, v]) => (
          <div key={k} className="demo-score-row">
            <span className="demo-score-label">{k}</span>
            <span className="demo-score-value">
              {formatVal(v)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ML 데모 전용: 3% 미만은 0으로 보이게 정규화(표시 전용)
  const normalizeScoresForDisplay = (scores, thresholdPercent = 0) => {
    if (!scores) return {}
    const out = {}
    for (const [k, vRaw] of Object.entries(scores)) {
      let v = typeof vRaw === 'number' ? vRaw : 0
      // 0~1 확률 → 0~100 변환
      let percent = v <= 1 ? Math.round(v * 100) : Math.round(v)
      if (percent <= thresholdPercent) percent = 0
      out[k] = percent
    }
    return out
  }

  return (
    <div className="write-diary-container">
      <div className="write-diary-header">
              {onNavigate && (
                <button
                  className="back-button"
                  onClick={() => onNavigate('village')}
                >
                  ← 마을로 돌아가기
                </button>
              )}
        <h1 className="write-diary-title">일기 쓰기</h1>
        <p className="write-diary-subtitle">오늘 하루를 자유롭게 기록해보세요. 감정은 자동으로 분석됩니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="write-diary-form">
        {/* 날짜 선택 */}
        <div className="form-group">
          <label htmlFor="date" className="form-label">날짜</label>
          <input
            type="date"
            id="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
            max={getTodayDateString()}
          />
        </div>

        {/* 제목 입력 */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">제목 (선택사항)</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder="오늘 하루는 어땠나요?"
            maxLength={50}
          />
        </div>

        {/* 일기 내용 */}
        <div className="form-group">
          <label htmlFor="content" className="form-label">일기 내용</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setAnalysisCache({ contentKey: null, gpt: null, ml: null })
              setDemoResult(null)
              setCurrentMode(null)
            }}
            className="form-textarea"
            placeholder="오늘 하루 있었던 일들을 자유롭게 적어보세요..."
            rows={12}
            required
          />
          <div className="character-count">
            {content.length}자
          </div>
        </div>

        {/* 분석하기 섹션: ML 데모 / GPT 미리보기 */}
        <div className="form-group">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="submit-button"
              onClick={handleAnalyzeDemoML}
              disabled={demoLoading || !content.trim()}
            >
              {demoLoading ? '분석 중...' : '분석하기 (ML 데모)'}
            </button>
            <button
              type="button"
              className="submit-button"
              onClick={handleAnalyzePreviewGPT}
              disabled={demoLoading || !content.trim()}
            >
              {demoLoading ? '분석 중...' : '분석하기 (GPT 미리보기)'}
            </button>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            ML 데모 결과는 마을 상태에 반영되지 않습니다. GPT 미리보기 또한 저장 전에는 반영되지 않습니다.
          </p>

          {/* 데모/미리보기 결과 표시 */}
          {demoResult && (
            <div className="demo-result" style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {demoResult.mode === 'ml' ? 'ML 데모 결과' : 'GPT 미리보기 결과'}
              </div>
              {demoResult.mode === 'ml' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    예측 감정: <strong>{demoResult?.result?.label || '-'}</strong>
                  </div>
                  {renderScores(
                    normalizeScoresForDisplay(demoResult?.result?.scores, showLowMl ? 0 : 9),
                    null,
                    !showLowMl // 기본 숨김, 토글 시 표시
                  )}
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setShowLowMl(v => !v)}
                      style={{
                        padding: '4px 8px',
                        fontSize: 12,
                        lineHeight: 1.2,
                        border: '1px solid #ccc',
                        borderRadius: 6,
                        background: '#fafafa',
                        cursor: 'pointer'
                      }}
                    >
                      {showLowMl ? '10% 미만 감정 숨기기' : '10% 미만 감정 보기'}
                    </button>
                    {!showLowMl && (
                      <span style={{ fontSize: 12, color: '#777' }}>
                        기본으로 10% 미만(한자릿수)은 숨겨집니다.
                      </span>
                    )}
                  </div>
                </>
              )}
              {demoResult.mode === 'gpt' && (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>감정 점수</div>
                  {renderScores(
                    demoResult?.emotion_result?.emotion_scores,
                    ['기쁨','사랑','놀람','두려움','분노','부끄러움','슬픔'] /* resident order */
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 기존 일기 안내 */}
        {existingDiary && !showReplaceConfirm && (
          <div className="existing-diary-warning">
            <p>⚠️ 이 날짜에 이미 일기가 있습니다. 저장하면 기존 일기가 덮어씌워집니다.</p>
            <p className="existing-diary-warning-detail">
              기존 일기로 생성된 와글와글 광장 대화, 행복나무 성장도, 우물 수위 등이 되돌려지고 새로운 일기 값으로 업데이트됩니다.
            </p>
          </div>
        )}

        {/* 덮어쓰기 확인 다이얼로그 */}
        {showReplaceConfirm && (
          <div className="replace-confirm-dialog">
            <div className="replace-confirm-content">
              <h3>기존 일기 덮어쓰기</h3>
              <p>이 날짜에 이미 일기가 있습니다. 저장하면:</p>
              <ul>
                <li>기존 일기가 삭제됩니다</li>
                <li>기존 일기로 생성된 와글와글 광장 대화가 삭제됩니다</li>
                <li>기존 일기로 성장한 행복나무 성장도가 되돌려집니다</li>
                <li>기존 일기로 채워진 우물 수위가 되돌려집니다</li>
                <li>새로운 일기 값으로 다시 계산됩니다</li>
              </ul>
              <p className="replace-confirm-question">정말로 덮어쓰시겠습니까?</p>
              <div className="replace-confirm-buttons">
                <button
                  type="button"
                  className="replace-confirm-button replace-confirm-button-cancel"
                  onClick={handleReplaceCancel}
                  disabled={isSaving}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="replace-confirm-button replace-confirm-button-confirm"
                  onClick={handleReplaceConfirm}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '덮어쓰기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 저장 메시지 */}
        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('실패') || saveMessage.includes('오류') ? 'save-message-error' : 'save-message-success'}`}>
            {saveMessage}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          className="submit-button"
          disabled={isSaving || !content.trim()}
        >
          {isSaving ? '저장 중...' : '일기 저장하기'}
        </button>
      </form>
    </div>
  )
}

export default WriteDiary

