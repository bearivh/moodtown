import ResidentsIntro from '../components/ResidentsIntro'
import './Guide.css'

function Guide({ onNavigate }) {
  return (
    <div className="guide-container">
      <div className="guide-content">
        {/* 헤더 */}
        <div className="guide-header">
          <button 
            className="guide-back-button"
            onClick={() => onNavigate && onNavigate('home')}
          >
            ← 돌아가기
          </button>
          <h1 className="guide-title">마을 안내도</h1>
        </div>

        {/* 마을 소개 섹션 */}
        <section className="guide-section">
          <div className="guide-section-header">
            <div className="guide-section-icon">🏘️</div>
            <h2 className="guide-section-title">moodtown에 오신 것을 환영합니다!</h2>
          </div>
          <div className="guide-section-content">
            <p className="guide-intro-text">
              이곳은 당신의 감정들이 작은 주민이 되어 살아가는 특별한 마을이에요.<br />
              일기를 쓰면 감정 주민들이 모습을 드러내고, 서로의 이야기를 건네기 시작해요.<br />
              행복한 날엔 나무가 자라고, 지친 날엔 우물에 물이 차오르며,
              마을은 당신의 하루를 닮아 변해가요.
            </p>
          </div>
        </section>

        {/* 마을 장소 소개 */}
        <section className="guide-section">
          <div className="guide-section-header">
            <div className="guide-section-icon">📍</div>
            <h2 className="guide-section-title">마을의 장소들</h2>
          </div>
          <div className="guide-places-grid">
            <div className="guide-place-card">
              <div className="guide-place-icon">📝</div>
              <h3 className="guide-place-title">일기 쓰기</h3>
              <p className="guide-place-description">
                매일의 하루를 기록하고 감정을 표현해보세요.<br />
                일기를 쓰면 주민들이 나타나서 함께 대화하고, 당신의 감정을 이해하고 응원해줘요.
              </p>
            </div>
            
            <div className="guide-place-card">
              <div className="guide-place-icon">💬</div>
              <h3 className="guide-place-title">와글와글 광장</h3>
              <p className="guide-place-description">
                일기의 감정을 바탕으로 주민들이 모여 대화하는 곳이에요.<br />
                당신의 감정을 이해하고 응원해 주는 주민들의 목소리를 들어보세요.
              </p>
            </div>
            
            <div className="guide-place-card">
              <div className="guide-place-icon">📮</div>
              <h3 className="guide-place-title">감정 우체통</h3>
              <p className="guide-place-description">
                주민들이 보내는 편지를 받아보세요.<br /> 
                축하, 위로, 응원의 메시지가 도착해요.
              </p>
            </div>
            
            <div className="guide-place-card">
              <div className="guide-place-icon">🌳</div>
              <h3 className="guide-place-title">행복 나무</h3>
              <p className="guide-place-description">
                행복한 감정이 쌓일수록 나무가 자라요.<br /> 
                나무가 열매를 맺으면 주민들이 축하 메시지를 보내 줘요!.<br />
                맺힌 열매로 스트레스 우물의 물을 줄일 수 있어요.
              </p>
            </div>
            
            <div className="guide-place-card">
              <div className="guide-place-icon">💧</div>
              <h3 className="guide-place-title">스트레스 우물</h3>
              <p className="guide-place-description">
                부정적인 감정이 쌓이면 우물의 물이 차올라요.<br /> 
                우물이 넘치면 주민들이 위로의 메시지를 보내요.
              </p>
            </div>
            
            <div className="guide-place-card">
              <div className="guide-place-icon">🏛️</div>
              <h3 className="guide-place-title">마을사무소</h3>
              <p className="guide-place-description">
                감정 캘린더와 주간 통계를 확인할 수 있어요.<br /> 
                시간에 따른 감정 변화를 한눈에 볼 수 있어요.
              </p>
            </div>
          </div>
        </section>

        {/* 주민 소개 섹션 */}
        <section className="guide-section">
          <ResidentsIntro />
        </section>
      </div>
    </div>
  )
}

export default Guide

