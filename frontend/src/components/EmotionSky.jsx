import { getEmotionColor, getEmotionName } from '../utils/emotionUtils'
import './EmotionSky.css'

function EmotionSky({ emotion = 'joy' }) {
  const skyColor = getEmotionColor(emotion)
  
  return (
    <div 
      className="emotion-sky"
      style={{ 
        background: `linear-gradient(to bottom, ${skyColor}66, ${skyColor}33, transparent)`
      }}
    >
      {/* 구름 효과 */}
      <div className="emotion-sky-clouds">
        <div className="emotion-sky-cloud cloud-1"></div>
        <div className="emotion-sky-cloud cloud-2"></div>
        <div className="emotion-sky-cloud cloud-3"></div>
      </div>
      
      {/* 하늘 설명 */}
      <div className="emotion-sky-label">
        <p>
          오늘의 하늘: {getEmotionName(emotion)}
        </p>
      </div>
    </div>
  )
}

export default EmotionSky
