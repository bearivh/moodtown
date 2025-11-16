import './ResidentsIntro.css'
import redImage from '../assets/characters/red.png'
import orangeImage from '../assets/characters/orange.png'
import yellowImage from '../assets/characters/yellow.png'
import greenImage from '../assets/characters/green.png'
import blueImage from '../assets/characters/blue.png'
import navyImage from '../assets/characters/navy.png'

function ResidentsIntro() {
  const residents = [
    {
      name: '빨강이',
      emotion: 'anger',
      emotionName: '분노',
      color: '#ef4444',
      pastelColor: '#ffcccc',
      description: '화가 날 때 나타나는 주민',
      image: redImage,
      speech: '너무 화가 나!'
    },
    {
      name: '주황이',
      emotion: 'shame',
      emotionName: '부끄러움',
      color: '#f97316',
      pastelColor: '#ffe4cc',
      description: '부끄러울 때 나타나는 주민',
      image: orangeImage,
      speech: '부끄러워...'
    },
    {
      name: '노랑이',
      emotion: 'joy',
      emotionName: '기쁨',
      color: '#eab308',
      pastelColor: '#fff9cc',
      description: '기쁠 때 나타나는 주민',
      image: yellowImage,
      speech: '정말 즐거워 ㅎㅎ'
    },
    {
      name: '초록이',
      emotion: 'love',
      emotionName: '사랑',
      color: '#22c55e',
      pastelColor: '#ccffcc',
      description: '사랑할 때 나타나는 주민',
      image: greenImage,
      speech: '너무 좋아'
    },
    {
      name: '파랑이',
      emotion: 'sadness',
      emotionName: '슬픔',
      color: '#3b82f6',
      pastelColor: '#cce4ff',
      description: '슬플 때 나타나는 주민',
      image: blueImage,
      speech: '슬퍼 ㅠㅠ'
    },
    {
      name: '남색이',
      emotion: 'fear',
      emotionName: '두려움',
      color: '#6366f1',
      pastelColor: '#d4d1ff',
      description: '무서울 때 나타나는 주민',
      image: navyImage,
      speech: '무서워...'
    },
    {
      name: '보라',
      emotion: 'surprise',
      emotionName: '놀람',
      color: '#a855f7',
      pastelColor: '#e6ccff',
      description: '놀랄 때 나타나는 주민',
      speech: '정말 놀라워!'
    }
  ]

  return (
    <div className="residents-intro">
      <h2 className="residents-intro-title">
        무지개 주민들
      </h2>
      <div className="residents-grid">
        {/* 윗줄: 첫 4개 주민 */}
        {residents.slice(0, 4).map((resident) => (
          <div
            key={resident.name}
            className="resident-card"
          >
            {resident.speech && (
              <div className="resident-speech-bubble">
                {resident.speech}
              </div>
            )}
            <div 
              className="resident-avatar"
              style={{ backgroundColor: resident.pastelColor || resident.color }}
            >
              {resident.image ? (
                <img src={resident.image} alt={resident.name} className="resident-image" />
              ) : (
                resident.name[0]
              )}
            </div>
            <h3 className="resident-name">{resident.name}</h3>
            <p className="resident-emotion">{resident.emotionName}</p>
            <p className="resident-description">{resident.description}</p>
          </div>
        ))}
        
        {/* 밑줄: 나머지 3개 주민 + 소개글 */}
        {residents.slice(4).map((resident) => (
          <div
            key={resident.name}
            className="resident-card"
          >
            {resident.speech && (
              <div className="resident-speech-bubble">
                {resident.speech}
              </div>
            )}
            <div 
              className="resident-avatar"
              style={{ backgroundColor: resident.pastelColor || resident.color }}
            >
              {resident.image ? (
                <img src={resident.image} alt={resident.name} className="resident-image" />
              ) : (
                resident.name[0]
              )}
            </div>
            <h3 className="resident-name">{resident.name}</h3>
            <p className="resident-emotion">{resident.emotionName}</p>
            <p className="resident-description">{resident.description}</p>
          </div>
        ))}
        
        {/* 무지개 주민들 소개글 */}
        <div className="resident-intro-card">
          <div className="resident-intro-icon">🌈</div>
          <h3 className="resident-intro-title">무지개 주민들</h3>
          <p className="resident-intro-text">
            무지개 주민들은 당신의 내면에 사는 감정의 목소리예요. 
            일기를 쓰면 주민들이 나타나서 함께 대화하고, 
            당신의 감정을 이해하고 응원해줘요. 
            각 주민은 서로 다른 색깔과 성격을 가지고 있어요.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResidentsIntro
