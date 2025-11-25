import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Village from './pages/Village'
import WriteDiary from './pages/WriteDiary'
import Plaza from './pages/Plaza'
import Tree from './pages/Tree'
import Well from './pages/Well'
import Office from './pages/Office'
import Mailbox from './pages/Mailbox'
import Guide from './pages/Guide'
import Login from './pages/Login'
import { getTodayDateString } from './utils/dateUtils'
import { getCurrentUser, logout as apiLogout } from './utils/api'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 로그인 상태 확인
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      // getCurrentUser는 401을 자동으로 처리하므로 여기서는 네트워크 오류만 처리
      console.error('인증 확인 오류:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    setCurrentPage('home')
  }

  const handleLogout = async () => {
    try {
      await apiLogout()
      setUser(null)
      setCurrentPage('home')
    } catch (error) {
      console.error('로그아웃 오류:', error)
    }
  }

  const handleNavigate = (page, date = null) => {
    if (date) {
      setSelectedDate(date)
    }
    setCurrentPage(page)
  }

  // 로딩 중
  if (loading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <p>로딩 중...</p>
      </div>
    )
  }

  // 로그인하지 않은 경우
  if (!user) {
    return (
      <div className="App">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    )
  }

  // 로그인한 경우
  return (
    <div className="App">
      {currentPage === 'home' && <Home onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'guide' && <Guide onNavigate={handleNavigate} user={user} />}
      {currentPage === 'village' && <Village onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'write' && <WriteDiary onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'plaza' && <Plaza onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'tree' && <Tree onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'well' && <Well onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'office' && <Office onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
      {currentPage === 'mailbox' && <Mailbox onNavigate={handleNavigate} selectedDate={selectedDate} user={user} onLogout={handleLogout} />}
    </div>
  )
}

export default App
