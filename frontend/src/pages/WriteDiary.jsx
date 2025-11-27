import { useState, useEffect } from 'react'
import { saveDiary, getDiariesByDate, replaceDiary, getDominantEmotionByDate } from '../utils/storage'
import { analyzeDiary, analyzeText } from '../utils/api'
import { addPositiveEmotion, getHappyFruitCount } from '../utils/treeUtils'
import { addNegativeEmotion, reduceWaterLevel, getWellState } from '../utils/wellUtils'
import { addHappyFruitCelebrationLetter, addWellOverflowComfortLetter } from '../utils/mailboxUtils'
import { getTodayDateString } from '../utils/dateUtils'
import { normalizeEmotionScores, classifyEmotionsWithContext } from '../utils/emotionUtils'
import { clearDiaryCacheForDate, setDiariesForDate } from '../utils/diaryCache'
import { clearVillageCacheForDate, updateVillageCacheForDate } from './Village'
import FloatingResidents from '../components/FloatingResidents'
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
  const [showFullMlResult, setShowFullMlResult] = useState(false) // ML: 전체 결과 표시 여부
  const [showSaveSuccessPopup, setShowSaveSuccessPopup] = useState(false) // 저장 완료 팝업 표시 여부
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('') // 저장 완료 메시지

  const getContentKey = (txt) => `${(txt || '').trim()}::${(txt || '').length}`

  // selectedDate prop이 변경되면 date state 업데이트
  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate)
    }
  }, [selectedDate])

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
      // 1. 감정 분석: 저장 시에는 항상 GPT 분석 사용 (ML은 미리보기 전용)
      let analysisResult = null
      const key = getContentKey(content)
      // GPT 분석 결과가 캐시에 있으면 재사용, 없으면 새로 분석
      if (analysisCache.contentKey === key && analysisCache.gpt) {
        analysisResult = analysisCache.gpt
      } else {
        analysisResult = await analyzeDiary(content.trim())
        setAnalysisCache(prev => ({ contentKey: key, gpt: analysisResult, ml: prev.ml }))
        // 저장 시에는 미리보기 결과를 표시하지 않음 (setDemoResult 호출 안 함)
      }
      const emotionScores = analysisResult.emotion_result?.emotion_scores || {}
      const emotionPolarity = analysisResult.emotion_result?.emotion_polarity || {}
      
      // 디버깅: 놀람/부끄러움 극성 확인
      console.log('[일기 저장] 감정 점수:', emotionScores)
      console.log('[일기 저장] 감정 극성:', emotionPolarity)
      if ((emotionScores['놀람'] || 0) > 0) {
        console.log('[일기 저장] 놀람 점수:', emotionScores['놀람'], '극성:', emotionPolarity['놀람'])
      }
      if ((emotionScores['부끄러움'] || 0) > 0) {
        console.log('[일기 저장] 부끄러움 점수:', emotionScores['부끄러움'], '극성:', emotionPolarity['부끄러움'])
      }
      
      // 2-3. 긍정/부정 감정 점수 계산 (맥락 기반 분류)
      const { positive: positiveScore, negative: negativeScore } = 
        classifyEmotionsWithContext(emotionScores, emotionPolarity)
      
      console.log('[일기 저장] 계산된 점수 - 긍정:', positiveScore, '부정:', negativeScore)
      
      const newDiaryData = {
        title: title.trim() || '제목 없음',
        content: content.trim(),
        date: date,
        emotion_scores: emotionScores,
        emotion_polarity: emotionPolarity,
        analyzed_at: new Date().toISOString()
      }

      // 4. 저장하기 직전에 다시 한 번 기존 일기가 있는지 확인 (최신 상태 확인)
      const currentDiaries = await getDiariesByDate(date)
      console.log('[일기 저장] 저장 직전 확인 - 날짜:', date, '기존 일기 개수:', currentDiaries.length)
      
      // 현재 작성 중인 일기와 동일한 ID가 있는지 확인 (자기 자신 제외)
      const currentExistingDiary = currentDiaries.find(d => {
        // 같은 날짜의 다른 일기인지 확인 (ID가 다르거나 ID가 없는 경우)
        return d.id !== newDiaryData.id
      }) || (currentDiaries.length > 0 ? currentDiaries[0] : null)
      
      if (currentExistingDiary) {
        console.log('[일기 저장] 기존 일기 발견:', currentExistingDiary)
        // 기존 일기가 있으면 확인 다이얼로그 표시
        setExistingDiary(currentExistingDiary)
        setPendingDiaryData({ newDiaryData, emotionScores, positiveScore, negativeScore })
        setShowReplaceConfirm(true)
        setIsSaving(false)
        return
      }
      
      console.log('[일기 저장] 기존 일기 없음, 새로 저장 진행')

      // 5. 기존 일기가 없으면 바로 저장
      setExistingDiary(null) // 상태도 업데이트
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

  const handleGoToVillage = () => {
    setShowSaveSuccessPopup(false)
    if (onNavigate) {
      onNavigate('village')
    }
  }

  const saveAndUpdateStates = async (diaryData, emotionScores, positiveScore, negativeScore, isReplace = false) => {
    try {
      // 기존 일기가 없고 덮어쓰기가 아닐 때만 새로 저장 (덮어쓰기인 경우 백엔드에서 이미 저장됨)
      if (!existingDiary && !isReplace) {
        await saveDiary(diaryData)
      }

      // 먼저 같은 날짜의 기존 정보 모두 삭제 (덮어쓰기 방지)
      const existingWellBonusStr = localStorage.getItem('wellBonus')
      const existingWellReducedStr = localStorage.getItem('wellReduced')
      
      if (existingWellBonusStr) {
        try {
          const bonusData = JSON.parse(existingWellBonusStr)
          if (bonusData.date === date) {
            localStorage.removeItem('wellBonus')
            console.log('[우물 정보 삭제] 같은 날짜의 기존 보너스 제거')
          }
        } catch (e) {
          localStorage.removeItem('wellBonus')
        }
      }
      if (existingWellReducedStr) {
        try {
          const reducedData = JSON.parse(existingWellReducedStr)
          if (reducedData.date === date) {
            localStorage.removeItem('wellReduced')
            console.log('[우물 정보 삭제] 같은 날짜의 기존 물 감소 제거')
          }
        } catch (e) {
          localStorage.removeItem('wellReduced')
        }
      }
      
      // 감정 점수 확인
      const joy = emotionScores['기쁨'] || 0
      const love = emotionScores['사랑'] || 0
      const hasPositiveEmotions = joy > 0 || love > 0
      
      // 나무 성장 처리 (감정 점수와 극성 정보도 전달하여 보너스 계산)
      let fruitProduced = false
      let fruitWaterReduced = false
      let fruitReducedAmount = 0
      
      if (positiveScore > 0) {
        const emotionPolarity = diaryData.emotion_polarity || {}
        const treeResult = await addPositiveEmotion(positiveScore, emotionScores, emotionPolarity)
        fruitProduced = treeResult.fruitProduced || false
        
        // 열매가 열려서 물이 줄어든 경우 저장
        if (fruitProduced) {
          // treeUtils.js에서 이미 reduceWaterLevel을 호출했지만,
          // 여기서는 정보만 저장 (나중에 우물 처리에서 검증)
          fruitWaterReduced = true
          fruitReducedAmount = 50
          
          const fruitCount = await getHappyFruitCount()
          await addHappyFruitCelebrationLetter(fruitCount)
        }
        
        // 보너스 점수가 있으면 localStorage에 저장 (나무 페이지에서 표시)
        // 단, 실제로 사랑/기쁨만 있는지 다시 한 번 검증
        if (treeResult.bonusScore > 0) {
          // 부정 감정 확인
          const fear = emotionScores['두려움'] || 0
          const anger = emotionScores['분노'] || 0
          const sadness = emotionScores['슬픔'] || 0
          
          // 놀람과 부끄러움의 극성 확인
          const surprise = emotionScores['놀람'] || 0
          const shame = emotionScores['부끄러움'] || 0
          const surprisePolarity = emotionPolarity['놀람']
          const shamePolarity = emotionPolarity['부끄러움']
          
          // 부정 감정이 있으면 보너스 점수 저장하지 않음
          if (fear > 0 || anger > 0 || sadness > 0) {
            console.log('[나무 보너스 무효] 부정 감정이 있음:', { fear, anger, sadness, emotionScores })
            localStorage.removeItem('treeBonus')
          } else if (surprise > 0 && surprisePolarity !== 'positive') {
            console.log('[나무 보너스 무효] 놀람이 부정:', { surprise, surprisePolarity })
            localStorage.removeItem('treeBonus')
          } else if (shame > 0 && shamePolarity !== 'positive') {
            console.log('[나무 보너스 무효] 부끄러움이 부정:', { shame, shamePolarity })
            localStorage.removeItem('treeBonus')
          } else {
            // 모든 검증 통과: 보너스 점수 저장
            localStorage.setItem('treeBonus', JSON.stringify({
              bonusScore: treeResult.bonusScore,
              date: date,
              timestamp: Date.now()
            }))
          }
        } else {
          // 보너스 점수가 0이면 localStorage에서 삭제
          localStorage.removeItem('treeBonus')
        }
      }
      
      // 우물 업데이트 처리 (감정 점수와 극성 정보도 전달하여 보너스 계산)
      // 조건 분기: negativeScore 기준으로 명확하게 분리
      if (negativeScore > 5) {
        // 부정 감정이 충분히 있는 경우 (5점 초과): 물 증가 처리만
        // 물 감소는 절대 일어나면 안 됨! (열매로 인한 감소 포함)
        // 같은 날짜의 물 감소 정보 강제 삭제
        if (existingWellReducedStr) {
          try {
            const reducedData = JSON.parse(existingWellReducedStr)
            if (reducedData.date === date) {
              localStorage.removeItem('wellReduced')
              console.log('[우물 정보 삭제] 부정 감정만 있으므로 물 감소 정보 제거')
            }
          } catch (e) {
            localStorage.removeItem('wellReduced')
          }
        }
        localStorage.removeItem('wellReduced') // 추가로 한 번 더 삭제 (안전장치)
        
        const emotionPolarity = diaryData.emotion_polarity || {}
        const wellResult = await addNegativeEmotion(negativeScore, emotionScores, emotionPolarity)
        
        // 보너스 점수 처리 (부정 감정만 있고 긍정 감정이 없는 경우만)
        if (wellResult.bonusScore > 0 && !hasPositiveEmotions) {
          // 최종 검증: 한 번 더 확인
          const anger = emotionScores['분노'] || 0
          const sadness = emotionScores['슬픔'] || 0
          const fear = emotionScores['두려움'] || 0
          const surprise = emotionScores['놀람'] || 0
          const shame = emotionScores['부끄러움'] || 0
          const surprisePolarity = emotionPolarity['놀람']
          const shamePolarity = emotionPolarity['부끄러움']
          
          // 최종 검증: 긍정 감정이 없고, 부정 감정이 있고, 놀람/부끄러움이 부정이거나 없어야 함
          const hasNegativeEmotions = anger > 0 || sadness > 0 || fear > 0
          const surpriseIsNegative = surprise === 0 || surprisePolarity === 'negative'
          const shameIsNegative = shame === 0 || shamePolarity === 'negative'
          
          if (hasNegativeEmotions && surpriseIsNegative && shameIsNegative && !hasPositiveEmotions) {
            // 모든 검증 통과: 보너스 점수 저장
            localStorage.setItem('wellBonus', JSON.stringify({
              bonusScore: wellResult.bonusScore,
              date: date,
              timestamp: Date.now()
            }))
            console.log('[우물 보너스 저장] 보너스 점수:', wellResult.bonusScore, '감정 점수:', emotionScores, 'positiveScore:', positiveScore, 'negativeScore:', negativeScore)
          } else {
            console.log('[우물 보너스 무효] 최종 검증 실패:', {
              hasNegativeEmotions,
              surpriseIsNegative,
              shameIsNegative,
              hasPositiveEmotions,
              emotionScores,
              emotionPolarity
            })
            localStorage.removeItem('wellBonus')
          }
        } else {
          // 보너스가 없거나 긍정 감정이 있으면 보너스 삭제
          localStorage.removeItem('wellBonus')
        }
        
        // 우물이 넘치면 우체통에 위로 편지 추가
        if (wellResult.overflowed) {
          await addWellOverflowComfortLetter(emotionScores, diaryData.content)
        }
      } else if (negativeScore > 0 && negativeScore <= 5) {
        // 부정 감정이 있지만 매우 낮은 경우 (5점 이하): 보너스 없음
        const emotionPolarity = diaryData.emotion_polarity || {}
        localStorage.removeItem('wellBonus') // 보너스 없음
        
        if (hasPositiveEmotions) {
          // 긍정 감정이 있으면 물 감소 처리
          const reduceResult = await reduceWaterLevel(30) // 30점 감소
          
          // 물이 줄어들었다면 localStorage에 저장
          if (reduceResult.reducedAmount > 0) {
            localStorage.setItem('wellReduced', JSON.stringify({
              reducedAmount: reduceResult.reducedAmount,
              date: date,
              timestamp: Date.now()
            }))
            console.log('[우물 물 감소] 물이 줄어듦:', reduceResult.reducedAmount, '점', 'positiveScore:', positiveScore, 'negativeScore:', negativeScore)
          }
        } else {
          // 긍정 감정이 없으면 물 증가 처리 (보너스 없음, negativeScore가 너무 낮음)
          const wellResult = await addNegativeEmotion(negativeScore, emotionScores, emotionPolarity)
          
          if (wellResult.overflowed) {
            await addWellOverflowComfortLetter(emotionScores, diaryData.content)
          }
        }
      } else {
        // 부정 감정이 없는 경우 (negativeScore === 0 또는 매우 낮음)
        localStorage.removeItem('wellBonus')
        
        // 긍정 감정이 있고 부정 감정이 없으면 물 감소 처리
        if (hasPositiveEmotions && negativeScore === 0) {
          const reduceResult = await reduceWaterLevel(30) // 30점 감소
          
          // 물이 줄어들었다면 localStorage에 저장
          if (reduceResult.reducedAmount > 0) {
            localStorage.setItem('wellReduced', JSON.stringify({
              reducedAmount: reduceResult.reducedAmount,
              date: date,
              timestamp: Date.now()
            }))
            console.log('[우물 물 감소] 물이 줄어듦:', reduceResult.reducedAmount, '점', 'positiveScore:', positiveScore, 'negativeScore:', negativeScore)
          }
        }
      }
      
      // 캐시 업데이트: 일기 저장 후 마을 페이지 캐시 무효화 및 업데이트
      try {
        // 일기 캐시 무효화 (최신 데이터 가져오기 위해)
        clearDiaryCacheForDate(date)
        
        // 최신 일기 데이터 가져오기
        const updatedDiaries = await getDiariesByDate(date)
        
        // 일기 캐시 업데이트
        setDiariesForDate(date, updatedDiaries)
        
        // Village 캐시 무효화
        clearVillageCacheForDate(date)
        
        // 가장 강한 감정 찾기
        const hasDiary = updatedDiaries.length > 0
        let dominantEmotion = 'joy'
        if (hasDiary) {
          const dominant = await getDominantEmotionByDate(date)
          if (dominant) {
            const emotionMap = {
              '기쁨': 'joy',
              '사랑': 'love',
              '놀람': 'surprise',
              '두려움': 'fear',
              '분노': 'anger',
              '부끄러움': 'shame',
              '슬픔': 'sadness'
            }
            dominantEmotion = emotionMap[dominant.emotion] || 'joy'
          }
        } else {
          dominantEmotion = null
        }
        
        // Village 캐시 업데이트
        updateVillageCacheForDate(date, {
          hasDiary: hasDiary,
          dominantEmotion: dominantEmotion
        })
        
        console.log('[캐시 업데이트] 일기 저장 후 캐시 갱신 완료:', { date, hasDiary, dominantEmotion })
      } catch (cacheError) {
        console.error('[캐시 업데이트] 오류:', cacheError)
        // 캐시 업데이트 실패해도 일기 저장은 성공했으므로 계속 진행
      }
      
      // 메시지 구성 (보너스 메시지 제거)
      let saveMessageText = '일기가 저장되었습니다! ✨'
      // 저장 완료 팝업 표시
      setSaveSuccessMessage(saveMessageText)
      setShowSaveSuccessPopup(true)
      // 미리보기 결과 초기화 (저장 완료 팝업이 뜰 때 미리보기 블록이 보이지 않도록)
      setDemoResult(null)
      setCurrentMode(null)
      // 폼 초기화
      setTitle('')
      setContent('')
      setDate(getTodayDateString())
      setExistingDiary(null)
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
    
    // 정규화된 점수 사용
    const normalizedScores = normalizeEmotionScores(scores)
    
    let entries
    if (Array.isArray(orderKeys) && orderKeys.length > 0) {
      // 지정된 순서로 표시(누락은 0)
      entries = orderKeys.map(k => [k, normalizedScores[k] || 0])
    } else {
      // 데이터셋 라벨 기반: 점수 내림차순
      entries = Object.entries(normalizedScores).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    }
    if (hideZeros) {
      entries = entries.filter(([, v]) => typeof v === 'number' ? v > 0 : true)
    }
    if (entries.length === 0) return null
    
    return (
      <div className="demo-scores">
        {entries.map(([k, v]) => (
          <div key={k} className="demo-score-row">
            <span className="demo-score-label">{k} </span>
            <span className="demo-score-value">
              {Math.round(v)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ML 결과 전용 렌더링 함수 (이미 정규화된 값 표시)
  const renderNormalizedScores = (normalizedScores, orderKeys = null, hideZeros = false) => {
    if (!normalizedScores || typeof normalizedScores !== 'object') return null
    
    let entries
    if (Array.isArray(orderKeys) && orderKeys.length > 0) {
      // 지정된 순서로 표시(누락은 0)
      entries = orderKeys.map(k => [k, normalizedScores[k] || 0])
    } else {
      // 점수 내림차순
      entries = Object.entries(normalizedScores)
        .map(([k, v]) => [k, typeof v === 'number' ? v : 0])
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    }
    if (hideZeros) {
      entries = entries.filter(([, v]) => typeof v === 'number' ? v > 0 : true)
    }
    if (entries.length === 0) return null
    
    return (
      <div className="demo-scores">
        {entries.map(([k, v]) => (
          <div key={k} className="demo-score-row">
            <span className="demo-score-label">{k} </span>
            <span className="demo-score-value">
              {Math.round(v)}%
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ML 데모 전용: 퍼센트로 변환하고 합이 100이 되도록 정규화
  const normalizeScoresForDisplay = (scores, thresholdPercent = 0) => {
    if (!scores || typeof scores !== 'object') return {}
  
    // 1단계: 0~1 확률을 퍼센트로 변환
    const entries = []
    let total = 0
  
    // 점수 계산: 각 감정별 퍼센트 변환
    for (const [k, vRaw] of Object.entries(scores)) {
      let v = typeof vRaw === 'number' ? vRaw : 0
      // 0~1 확률 → 0~100 변환
      let percent = v <= 1 ? v * 100 : v
      // 임계값 이하는 0으로 처리
      if (percent <= thresholdPercent) percent = 0
      entries.push({ key: k, percent: percent, original: v })
      total += percent
    }
  
    // 2단계: 퍼센트 합이 100을 넘는 경우, 재정규화
    if (total !== 100) {
      const diff = 100 - total
      // 총합이 100이 아닐 경우, 차이만큼 감정 점수 조정
      entries.sort((a, b) => b.original - a.original)  // 내림차순 정렬 (원본값 기준)
  
      // 오차가 가장 큰 항목에 차이를 더해줌
      if (Math.abs(diff) > 1) {
        const target = entries[0]
        target.percent += diff  // 차이를 가장 큰 항목에 추가
      }
    }
  
    // 3단계: 반올림
    const rounded = {}
    let roundedTotal = 0
    
    // 반올림 처리
    entries.forEach(entry => {
      const val = Math.round(entry.percent)
      rounded[entry.key] = val
      roundedTotal += val
    })
  
    // 4단계: 차이 보정 (합이 정확히 100이 되도록)
    const finalDiff = 100 - roundedTotal
    if (finalDiff !== 0) {
      const nonZeroEntries = entries.filter(e => rounded[e.key] > 0)
      if (nonZeroEntries.length > 0) {
        const target = nonZeroEntries[0]
        rounded[target.key] = rounded[target.key] + finalDiff
      }
    }
  
    const finalTotal = Object.values(rounded).reduce((sum, val) => sum + val, 0)
    console.log('🔍 Final normalized scores:', rounded, 'Total:', finalTotal)
    
    return rounded
  }  

  return (
    <div className="write-diary-container">
      <FloatingResidents count={2} />
      <div className="write-diary-header">
        {onNavigate && (
          <button
            className="back-button"
            onClick={() => onNavigate('village')}
          >
            ← 마을로 돌아가기
          </button>
        )}
        <div className="write-diary-header-content">
          <h1 className="write-diary-title">일기 쓰기</h1>
          <p className="write-diary-subtitle">  오늘 하루를 자유롭게 기록해 보세요!  </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="write-diary-form">
        {/* 날짜 표시 */}
        <div className="form-group">
          <label className="form-label">날짜</label>
          <div className="date-display">
            {(() => {
              if (!date) return ''
              const dateObj = new Date(date + 'T00:00:00')
              return dateObj.toLocaleDateString('ko-KR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                weekday: 'long'
              })
            })()}
          </div>
        </div>

        {/* 제목 입력 */}
        <div className="form-group">
          <label htmlFor="title" className="form-label">제목</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="form-input"
            placeholder="오늘 일기의 제목을 입력해 주세요."
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
              setShowFullMlResult(false)
            }}
            className="form-textarea"
            placeholder="오늘 하루 있었던 일들을 적어 보세요. 주민들이 기다리고 있어요."
            rows={12}
            required
          />
          <div className="character-count">
            {content.length}자
          </div>
        </div>

        {/* 분석하기 섹션: ML 데모 / GPT 미리보기 */}
        <div className="form-group">
          <div className="analyze-buttons-container">
            <div className="analyze-button-wrapper">
              <button
                type="button"
                className="submit-button analyze-button-ml"
                onClick={handleAnalyzeDemoML}
                disabled={demoLoading || !content.trim()}
              >
                {demoLoading ? '분석 중...' : 'ML 모델로 감정 분석하기'}
              </button>
              <div className="analyze-tooltip-container">
                <span className="analyze-tooltip-icon">?</span>
                <div className="analyze-tooltip">
                  <strong>ML 모델로 분석하기란?</strong>
                  <p>머신러닝으로 학습된 감정 분석 모델이 일기의 감정 통계를 간단히 보여 줘요.</p>
                  <p>다만 정확도가 낮을 수 있어 참고용으로만 제공돼요.</p>
                </div>
              </div>
            </div>
            <div className="analyze-button-wrapper">
              <button
                type="button"
                className="submit-button analyze-button-gpt"
                onClick={handleAnalyzePreviewGPT}
                disabled={demoLoading || !content.trim()}
              >
                {demoLoading ? '분석 중...' : 'GPT-4o mini로 감정 분석하기'}
              </button>
              <div className="analyze-tooltip-container">
                <span className="analyze-tooltip-icon">?</span>
                <div className="analyze-tooltip">
                  <strong>GPT-4o mini로 분석하기란?</strong>
                  <p>GPT-4o mini가 일기를 읽고 더 정교하게 감정을 분석해 줘요.</p>
                  <p>일기를 저장하면 이 분석 결과가 최종적으로 저장돼요.</p>
                </div>
              </div>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            ML 모델로 분석한 결과는 마을에 반영되지 않아요.
          </p>

          {/* 데모/미리보기 결과 표시 */}
          {demoResult && (
            <div className="demo-result" style={{ marginTop: 12, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {demoResult.mode === 'ml' ? 'ML 모델 감정 분석 결과' : 'GPT-4o mini 감정 분석 결과'}
              </div>
              {demoResult.mode === 'ml' && (
                <>
                  {(() => {
                    const rawScores = demoResult?.result?.scores || {}
                    console.log('🔍 ML raw scores from backend:', JSON.stringify(rawScores, null, 2))
                    const normalized = normalizeScoresForDisplay(rawScores, 0)
                    const total = Object.values(normalized).reduce((sum, val) => sum + val, 0)
                    console.log('🔍 ML normalized scores:', JSON.stringify(normalized, null, 2))
                    console.log('🔍 Total:', total)
                    if (Math.abs(total - 100) > 1) {
                      console.error('❌ ERROR: Total is not 100!', total, normalized)
                    }
                    
                    // 가장 높은 감정 찾기
                    const sortedEntries = Object.entries(normalized)
                      .filter(([k, v]) => v > 0)
                      .sort((a, b) => b[1] - a[1])
                    const topEmotion = sortedEntries[0] ? sortedEntries[0][0] : null
                    const topEmotionPercent = sortedEntries[0] ? sortedEntries[0][1] : 0
                    
                    if (!showFullMlResult) {
                      // 간단한 결과만 표시
                      return (
                        <>
                          <div style={{ marginBottom: 8, fontSize: 16 }}>
                            분석 결과: <strong>{topEmotion || '-'}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowFullMlResult(true)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 13,
                              lineHeight: 1.2,
                              border: '1px solid #ccc',
                              borderRadius: 6,
                              background: '#f0f0f0',
                              cursor: 'pointer',
                              marginTop: 8,
                              fontFamily: "'Dongle', sans-serif"
                            }}
                          >
                            분석결과 전체 보기
                          </button>
                        </>
                      )
                    } else {
                      // 전체 결과 표시
                      return (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            예측 감정: <strong>{demoResult?.result?.label || '-'}</strong>
                          </div>
                          {renderNormalizedScores(normalized, null, false)}
                          <div style={{ marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => setShowFullMlResult(false)}
                              style={{
                                padding: '4px 8px',
                                fontSize: 12,
                                lineHeight: 1.2,
                                border: '1px solid #ccc',
                                borderRadius: 6,
                                background: '#fafafa',
                                cursor: 'pointer',
                                fontFamily: "'Dongle', sans-serif"
                              }}
                            >
                              간단히 보기
                            </button>
                          </div>
                        </>
                      )
                    }
                  })()}
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
            <p>⚠️ 이 날짜에 이미 일기가 있어요! 저장하면 기존 일기가 덮어씌워져요.</p>
            <p className="existing-diary-warning-detail">
              기존 일기로 생성된 와글와글 광장 대화, 행복나무 성장도, 우물 수위 등이 되돌려지고 새로운 일기 값으로 업데이트 돼요.
            </p>
          </div>
        )}

        {/* 덮어쓰기 확인 다이얼로그 */}
        {showReplaceConfirm && (
          <div className="replace-confirm-dialog">
            <div className="replace-confirm-content">
              <h3>기존 일기 덮어쓰기</h3>
              <p>이 날짜에 이미 일기가 있어요. 저장하면:</p>
              <ul>
                <li>기존 일기가 삭제돼요.</li>
                <li>기존 일기로 생성된 와글와글 광장 대화가 삭제돼요.</li>
                <li>기존 일기로 성장한 행복나무 성장도가 되돌려져요.</li>
                <li>기존 일기로 채워진 우물 수위가 되돌려져요.</li>
                <li>새로운 일기 값으로 다시 계산돼요.</li>
              </ul>
              <p className="replace-confirm-question">이대로 덮어쓸까요?</p>
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

        {/* 저장 완료 팝업 */}
        {showSaveSuccessPopup && (
          <div className="save-success-popup">
            <div className="save-success-popup-content">
              <div className="save-success-icon">✨</div>
              <h3 className="save-success-title">저장 완료!</h3>
              <div className="save-success-message">
                {saveSuccessMessage.split('\n').map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
              <button
                type="button"
                className="save-success-button"
                onClick={handleGoToVillage}
              >
                마을로 돌아가기
              </button>
            </div>
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

