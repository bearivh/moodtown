import './VillageSection.css'

function VillageSection({ onNavigate }) {
  const places = [
    {
      id: 'plaza',
      name: '와글와글 광장',
      description: '무지개 주민들이 일기를 바탕으로 대화하는 곳',
      icon: '🏛️',
      link: 'plaza'
    },
    {
      id: 'map',
      name: '감정 지도',
      description: '날짜별 감정 기록을 한눈에 보는 지도',
      icon: '🗺️',
      link: '/map'
    },
    {
      id: 'mailbox',
      name: '감정 편지함',
      description: '주민들이 보내는 특별한 편지를 확인하세요',
      icon: '📮',
      link: '/mailbox'
    },
    {
      id: 'tree',
      name: '행복 나무',
      description: '긍정적인 감정이 쌓일 때마다 자라는 나무',
      icon: '🌳',
      link: '/tree'
    },
    {
      id: 'well',
      name: '스트레스 우물',
      description: '부정 감정이 누적되면 차오르는 우물',
      icon: '💧',
      link: '/well'
    },
    {
      id: 'archive',
      name: '감정 아카이브',
      description: '과거의 감정 기록을 되돌아보는 곳',
      icon: '📚',
      link: '/archive'
    }
  ]

  return (
    <div className="village-section">
      <h2 className="village-section-title">
        마을 둘러보기
      </h2>
      <div className="village-places-grid">
        {places.map((place) => (
          <div
            key={place.id}
            className="village-place-card"
            onClick={() => {
              if (onNavigate && place.link) {
                onNavigate(place.link)
              }
            }}
          >
            <div className="village-place-icon">{place.icon}</div>
            <h3 className="village-place-name">
              {place.name}
            </h3>
            <p className="village-place-description">
              {place.description}
            </p>
            <div className="village-place-hint">
              클릭하여 방문하기 →
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default VillageSection
