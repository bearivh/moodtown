import { useState, useEffect, useRef } from 'react'
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
import { clearAllDiaryCache } from './utils/diaryCache'
import { clearAllVillageCache } from './pages/Village'
import { clearAllPlazaCache } from './pages/Plaza'
import { clearWellStateCache } from './utils/wellUtils'
import { clearTreeStateCache } from './utils/treeUtils'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedDate, setSelectedDate] = useState(getTodayDateString())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // user.id 추적을 위한 ref (다른 사용자로 로그인한 경우 감지)
  const prevUserIdRef = useRef(null)

  // 모든 캐시 및 localStorage 초기화 함수
  const clearAllCaches = () => {
    // 모듈 레벨 캐시 초기화
    clearAllDiaryCache()
    clearAllVillageCache()
    clearAllPlazaCache()
    clearWellStateCache()
    clearTreeStateCache()
    
    // localStorage에 저장된 임시 데이터도 초기화
    try {
      localStorage.removeItem('wellBonus')
      localStorage.removeItem('wellReduced')
      localStorage.removeItem('treeBonus')
      localStorage.removeItem('wellWarningDismissed')
      console.log('[캐시 초기화] localStorage도 초기화되었습니다.')
    } catch (e) {
      console.warn('[캐시 초기화] localStorage 초기화 실패:', e)
    }
    
    console.log('[캐시 초기화] 모든 캐시가 초기화되었습니다.')
  }

  // 로그인 상태 확인 (페이지 로드 시)
  useEffect(() => {
    // 페이지가 로드될 때 이전 사용자 데이터가 남아있을 수 있으므로 초기화
    // (새로고침이나 다른 사용자로 로그인한 경우 대비)
    if (prevUserIdRef.current === null) {
      // 이전 사용자가 없으면 캐시 초기화
      clearAllCaches()
    }
    checkAuth()
  }, [])

  // user.id가 변경될 때 캐시 초기화 (다른 사용자로 로그인한 경우 대비)
  useEffect(() => {
    const prevUserId = prevUserIdRef.current
    const currentUserId = user?.id

    // user.id가 실제로 변경된 경우에만 캐시 초기화
    if (currentUserId && currentUserId !== prevUserId) {
      console.log(`[사용자 변경 감지] 이전 사용자: ${prevUserId}, 새 사용자: ${currentUserId}`)
      clearAllCaches()
      prevUserIdRef.current = currentUserId
    } else if (!currentUserId && prevUserId !== null) {
      // 로그아웃된 경우 (이전에 로그인된 사용자가 있었을 때만)
      console.log('[로그아웃 감지] 캐시 초기화')
      clearAllCaches()
      prevUserIdRef.current = null
    } else if (currentUserId && prevUserId === null) {
      // 처음 로그인한 경우 (이전에 로그인된 사용자가 없었을 때)
      prevUserIdRef.current = currentUserId
    }
  }, [user?.id])

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser()
      // 사용자가 변경되었는지 확인
      const prevUserId = prevUserIdRef.current
      if (currentUser?.id !== prevUserId) {
        console.log(`[인증 확인] 사용자 변경 감지: 이전=${prevUserId}, 현재=${currentUser?.id}`)
        if (currentUser?.id && prevUserId !== null) {
          // 이전 사용자가 있었고 새로운 사용자가 로그인한 경우
          clearAllCaches()
        }
        prevUserIdRef.current = currentUser?.id || null
      }
      setUser(currentUser)
    } catch (error) {
      // getCurrentUser는 401을 자동으로 처리하므로 여기서는 네트워크 오류만 처리
      console.error('인증 확인 오류:', error)
      // 로그인하지 않은 경우에도 이전 사용자 데이터 제거
      if (prevUserIdRef.current !== null) {
        console.log('[인증 확인] 로그인 상태 없음 - 캐시 초기화')
        clearAllCaches()
        prevUserIdRef.current = null
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = (userData) => {
    console.log('[로그인 성공] 새 사용자:', userData?.id, userData?.username)
    // 로그인 성공 시 즉시 캐시 초기화 (이전 사용자 데이터 제거)
    // setUser 전에 초기화하여 useEffect가 실행되기 전에 정리
    clearAllCaches()
    // prevUserIdRef는 null로 두고, useEffect에서 자동으로 업데이트되도록
    prevUserIdRef.current = null
    setUser(userData)
    setCurrentPage('home')
  }

  const handleLogout = async () => {
    try {
      await apiLogout()
      // 로그아웃 시 모든 캐시 초기화
      clearAllCaches()
      setUser(null)
      setCurrentPage('home')
    } catch (error) {
      console.error('로그아웃 오류:', error)
      // 오류가 발생해도 캐시는 초기화
      clearAllCaches()
      setUser(null)
      setCurrentPage('home')
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
