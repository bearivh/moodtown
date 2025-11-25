import { useState, useEffect } from 'react'
import redImage from '../assets/characters/red.png'
import orangeImage from '../assets/characters/orange.png'
import yellowImage from '../assets/characters/yellow.png'
import greenImage from '../assets/characters/green.png'
import blueImage from '../assets/characters/blue.png'
import navyImage from '../assets/characters/navy.png'
import purpleImage from '../assets/characters/purple.png'
import './FloatingResidents.css'

const RESIDENT_IMAGES = [
  redImage,
  orangeImage,
  yellowImage,
  greenImage,
  blueImage,
  navyImage,
  purpleImage
]

function FloatingResidents({ count = 3 }) {
  const [residents, setResidents] = useState([])

  useEffect(() => {
    // 제목 양 옆에 주민들 배치 (버튼 바로 옆)
    const generateResidents = () => {
      const newResidents = []
      // 제목이 중앙에 있으므로, 제목 양 옆에 배치
      const positions = [
        { 
          left: 'calc(50% - 200px)', // 제목 왼쪽 바로 옆
          top: '80px' // 제목 높이 근처
        },
        { 
          left: 'calc(50% + 200px)', // 제목 오른쪽 바로 옆 (버튼 근처)
          top: '80px' 
        }
      ]
      
      // 중복 없이 주민 이미지 선택
      const availableImages = [...RESIDENT_IMAGES]
      
      for (let i = 0; i < Math.min(count, positions.length); i++) {
        // 남은 이미지 중에서 랜덤 선택
        const randomIndex = Math.floor(Math.random() * availableImages.length)
        const image = availableImages.splice(randomIndex, 1)[0]
        
        const position = positions[i]
        const delay = Math.random() * 2 // 0-2초
        const duration = 3 + Math.random() * 2 // 3-5초
        const size = 35 + Math.random() * 15 // 35-50px
        
        newResidents.push({
          id: i,
          image,
          left: position.left,
          top: position.top,
          delay,
          duration,
          size
        })
      }
      setResidents(newResidents)
    }

    generateResidents()
  }, [count])

  return (
    <div className="floating-residents-container">
      {residents.map((resident) => (
        <img
          key={resident.id}
          src={resident.image}
          alt="floating resident"
          className="floating-resident"
          style={{
            left: resident.left,
            top: resident.top,
            width: `${resident.size}px`,
            height: `${resident.size}px`,
            animationDelay: `${resident.delay}s`,
            animationDuration: `${resident.duration}s`
          }}
        />
      ))}
    </div>
  )
}

export default FloatingResidents

