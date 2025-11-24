import { memo, useMemo } from 'react'
import { getEmotionColor, getEmotionName } from '../utils/emotionUtils'
import './EmotionSky.css'

function EmotionSky({ emotion = 'joy', hasDiary = true }) {
  // 일기가 없으면 하얀색(구름이 낀 하늘)
  const isCloudy = !hasDiary || !emotion
  
  const backgroundStyle = useMemo(() => {
    if (isCloudy) {
      return 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0.85) 40%, rgba(255, 255, 255, 0.5) 70%, rgba(224, 246, 255, 0.3) 90%, rgba(224, 246, 255, 0) 100%)'
    }
    const skyColor = getEmotionColor(emotion)
    return `linear-gradient(to bottom, ${skyColor}66, ${skyColor}33, transparent)`
  }, [isCloudy, emotion])
  
  const skyLabel = useMemo(() => {
    return isCloudy ? '구름' : getEmotionName(emotion)
  }, [isCloudy, emotion])
  
  return (
    <div 
      className={`emotion-sky ${isCloudy ? 'emotion-sky-cloudy' : ''}`}
      style={{ 
        background: backgroundStyle
      }}
    >
      {/* 구름 효과 */}
      <div className="emotion-sky-clouds">
        {isCloudy ? (
          <>
            {/* 구름이 낀 하늘 - 최적화된 구름 조각들 */}
            <div className="emotion-sky-cloud cloud-piece cloud-piece-1"></div>
            <div className="emotion-sky-cloud cloud-piece cloud-piece-2"></div>
            <div className="emotion-sky-cloud cloud-piece cloud-piece-3"></div>
            <div className="emotion-sky-cloud cloud-piece cloud-piece-4"></div>
          </>
        ) : (
          <>
            <div className="emotion-sky-cloud cloud-1"></div>
            <div className="emotion-sky-cloud cloud-2"></div>
            <div className="emotion-sky-cloud cloud-3"></div>
          </>
        )}
      </div>
      
      {/* 하늘 설명 */}
      <div className="emotion-sky-label">
        <div>
          <span className="emotion-sky-text">오늘의 하늘: {skyLabel}</span>
          <span className="emotion-sky-info-icon">
            ?
            <div className="emotion-sky-tooltip">
              {isCloudy 
                ? '이 날짜에는 일기가 없어서 구름이 낀 하늘이에요. 일기를 쓰면 감정의 색으로 바뀌어요!'
                : '이 날짜의 일기에서 가장 많이 나타난 감정의 색으로 하늘이 표시돼요!'}
            </div>
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(EmotionSky)
