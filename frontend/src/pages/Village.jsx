import { useState, useEffect, useMemo, useCallback } from 'react'
import EmotionSky from '../components/EmotionSky'
import { getDiariesByDate, getDominantEmotionByDate } from '../utils/storage'
import { getUnreadLetterCount } from '../utils/mailboxUtils'
import { getEmotionColorByName } from '../utils/emotionColorMap'
import './Village.css'

// 모듈 레벨 캐시 - 컴포넌트 언마운트와 무관하게 유지됨
const villageStateCache = new Map()

// 캐시 무효화 함수 (다른 컴포넌트에서 호출 가능)
export function clearVillageCacheForDate(date) {
  if (date) {
    villageStateCache.delete(date)
  }
}

// 캐시 업데이트 함수
export function updateVillageCacheForDate(date, state) {
  if (date && state) {
    villageStateCache.set(date, state)
  }
}

function Village({ onNavigate, selectedDate, user, onLogout }) {
  // 캐시에서 초기값 가져오기 (lazy initialization) - 렌더링 전에 즉시 적용
  const [hasDiary, setHasDiary] = useState(() => {
    if (selectedDate) {
      const cached = villageStateCache.get(selectedDate)
      return cached?.hasDiary ?? false
    }
    return false
  })
  
  const [dominantEmotion, setDominantEmotion] = useState(() => {
    if (selectedDate) {
      const cached = villageStateCache.get(selectedDate)
      return cached?.dominantEmotion ?? 'joy'
    }
    return 'joy'
  })
  
  const [dateDiaries, setDateDiaries] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  
  useEffect(() => {
    if (!selectedDate) return

    // 선택된 날짜가 변경될 때 캐시에서 즉시 복원
    // (일기 저장 후 같은 날짜로 돌아와도 최신 캐시 반영)
    const cachedState = villageStateCache.get(selectedDate)
    if (cachedState) {
      setHasDiary(cachedState.hasDiary)
      setDominantEmotion(cachedState.dominantEmotion)
    } else {
      // 캐시가 없으면 기본값으로 설정 (로딩 중 표시 방지)
      setHasDiary(false)
      setDominantEmotion('joy')
    }

    const loadData = async () => {
      // 선택한 날짜의 일기 확인
      const diaries = await getDiariesByDate(selectedDate)
      const newHasDiary = diaries.length > 0
      
      setDateDiaries(diaries)
      
      // 가장 강한 감정 찾기
      let newDominantEmotion = 'joy'
      if (newHasDiary) {
        const dominant = await getDominantEmotionByDate(selectedDate)
        if (dominant) {
          // 한글 감정명을 영어로 변환 (간단한 매핑)
          const emotionMap = {
            '기쁨': 'joy',
            '사랑': 'love',
            '놀람': 'surprise',
            '두려움': 'fear',
            '분노': 'anger',
            '부끄러움': 'shame',
            '슬픔': 'sadness'
          }
          newDominantEmotion = emotionMap[dominant.emotion] || 'joy'
        }
      } else {
        // 일기가 없으면 구름이 낀 하늘 (하얀색)
        newDominantEmotion = null
      }
      
      // 읽지 않은 편지 개수 확인
      const count = await getUnreadLetterCount()
      
      // 모든 상태를 한 번에 업데이트하여 깜빡임 방지
      setHasDiary(newHasDiary)
      setDominantEmotion(newDominantEmotion)
      setUnreadCount(count)
      
      // 모듈 레벨 캐시에 저장 (컴포넌트 언마운트와 무관하게 유지됨)
      villageStateCache.set(selectedDate, {
        hasDiary: newHasDiary,
        dominantEmotion: newDominantEmotion
      })
    }
    
    loadData()
  }, [selectedDate])
  
  // 주기적으로 읽지 않은 편지 개수 업데이트 (페이지가 보일 때만, 30초마다)
  useEffect(() => {
    let interval = null
    
    const updateUnreadCount = async () => {
      // 페이지가 보이고 포커스되어 있을 때만 업데이트
      if (!document.hidden && document.hasFocus()) {
        try {
          const count = await getUnreadLetterCount()
          setUnreadCount(count)
        } catch (error) {
          console.error('읽지 않은 편지 개수 가져오기 실패:', error)
        }
      }
    }
    
    // 페이지 가시성 변경 시 처리
    const handleVisibilityChange = () => {
      if (!document.hidden && document.hasFocus()) {
        // 페이지가 다시 보이면 즉시 업데이트
        updateUnreadCount()
      }
    }
    
    // 페이지 포커스 시 즉시 업데이트
    const handleFocus = () => {
      updateUnreadCount()
    }
    
    // 30초마다 업데이트 (페이지가 보일 때만)
    interval = setInterval(updateUnreadCount, 30000)
    
    // 이벤트 리스너 추가
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
  
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })
  }, [])

  const places = useMemo(() => [
    {
      id: 'write',
      name: '일기 쓰기',
      description: '오늘 하루를 기록해보세요',
      icon: '✍️',
      link: 'write',
      alwaysAvailable: true
    },
    {
      id: 'plaza',
      name: '와글와글 광장',
      description: hasDiary 
        ? '무지개 주민들이 일기를 바탕으로 대화하는 곳' 
        : '이 날짜의 일기를 작성하면 이용할 수 있습니다',
      icon: '🏛️',
      link: 'plaza',
      alwaysAvailable: false,
      disabled: !hasDiary
    },
    {
      id: 'mailbox',
      name: '감정 우체통',
      description: unreadCount > 0 
        ? `주민들이 보낸 편지 ${unreadCount}개가 도착했어요!` 
        : '주민들이 보내는 특별한 편지를 확인하세요',
      icon: '📮',
      link: 'mailbox',
      alwaysAvailable: true,
      disabled: false,
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      id: 'tree',
      name: '행복 나무',
      description: '긍정적인 감정이 쌓일 때마다 자라는 나무',
      icon: '🌳',
      link: 'tree',
      alwaysAvailable: false,
      disabled: false
    },
    {
      id: 'well',
      name: '스트레스 우물',
      description: '부정 감정이 누적되면 차오르는 우물',
      icon: '💧',
      link: 'well',
      alwaysAvailable: false,
      disabled: false
    },
    {
      id: 'office',
      name: '마을사무소',
      description: '감정 캘린더 및 통계 보기',
      icon: '🏠',
      link: 'office',
      alwaysAvailable: false,
      disabled: false
    }
  ], [hasDiary, unreadCount])

  const handlePlaceClick = useCallback((place) => {
    if (place.disabled) {
      return
    }
    if (onNavigate && place.link) {
      onNavigate(place.link)
    }
  }, [onNavigate])

  return (
    <div className="village-container">
      {/* 하늘 영역 */}
      <EmotionSky emotion={dominantEmotion} hasDiary={hasDiary} />

      {/* 마을 화면 */}
      <div className="village-content">
        <div className="village-header">
          {onNavigate && (
            <button
              className="village-back-button"
              onClick={() => onNavigate('home')}
            >
              ← 마을 입구로
            </button>
          )}
          {/* 선택한 날짜 표시 */}
          <div className="village-date-display">
            <h2 className="village-date-title">{selectedDate ? formatDate(selectedDate) : ''}</h2>
          </div>
          {/* 로그아웃 버튼 */}
          {onLogout && (
            <div className="village-user-info">
              <span className="village-user-name">
                {user?.name ? `${user.name}(${user.username || '사용자'})` : (user?.username || '사용자')}
              </span>
              <button
                className="village-logout-button"
                onClick={onLogout}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>

        {/* 일기 상태 표시 */}
        <div className="village-diary-status">
          {hasDiary ? (
            <div className="diary-status-has">
              <span className="diary-status-icon">✅</span>
              <span className="diary-status-text">이 날짜의 일기가 있어요! 주민들을 만날 수 있어요.</span>
            </div>
          ) : (
            <div className="diary-status-none">
              <span className="diary-status-text">오늘의 일기가 없어요! 마음을 기록하면 주민들을 만날 수 있어요.</span>
            </div>
          )}
        </div>

        {/* 마을 장소들 */}
        <div className="village-places-section">
          <h2 className="village-places-title">마을 둘러보기</h2>
          <div className="village-places-grid">
            {places.map((place) => (
              <div
                key={place.id}
                className={`village-place-card ${place.disabled ? 'village-place-disabled' : ''}`}
                onClick={() => handlePlaceClick(place)}
              >
                {place.disabled && (
                  <div className="village-place-lock-badge">🔒</div>
                )}
                <div className="village-place-icon">{place.icon}</div>
                <h3 className="village-place-name">
                  {place.name}
                  {place.badge && (
                    <span className="village-place-badge">{place.badge}</span>
                  )}
                </h3>
                <p className="village-place-description">{place.description}</p>
                {place.disabled && (
                  <div className="village-place-disabled-hint">
                    이용 불가
                  </div>
                )}
                {!place.disabled && (
                  <div className="village-place-hint">
                    click!
                  </div>
                )}
                {place.disabled && (
                  <div className="village-place-locked-message">
                    오늘 일기를 쓰면 활성화돼요!
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Village

