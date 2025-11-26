import { useState } from 'react'
import { register, login } from '../utils/api'
import './Login.css'

function Login({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true) // true: 로그인, false: 회원가입
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        // 로그인
        const result = await login(username, password)
        if (result.success && onLoginSuccess) {
          onLoginSuccess(result.user)
        }
      } else {
        // 회원가입
        if (username.length < 3) {
          setError('아이디는 최소 3자 이상이어야 합니다.')
          setLoading(false)
          return
        }
        if (password.length < 4) {
          setError('비밀번호는 최소 4자 이상이어야 합니다.')
          setLoading(false)
          return
        }
        if (!name || name.trim().length === 0) {
          setError('이름을 입력해 주세요.')
          setLoading(false)
          return
        }
        const result = await register(username, password, name)
        if (result.success && onLoginSuccess) {
          onLoginSuccess(result.user)
        }
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      {/* 배경 구름 레이어 */}
      <div className="login-sky-clouds" aria-hidden="true">
        <div className="login-cloud cloud-1" />
        <div className="login-cloud cloud-2" />
        <div className="login-cloud cloud-3" />
        <div className="login-cloud cloud-4" />
      </div>

      <div className="login-content">
        <div className="login-card">
          <h1 className="login-title">moodtown</h1>
          <p className="login-subtitle">
            {isLogin ? '다시 돌아오신 것을 환영해요! 🌟' : '새로운 마을에 오신 것을 환영해요! 🏘️'}
          </p>

          <div className="login-toggle">
            <button
              className={`login-toggle-btn ${isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true)
                setError('')
              }}
            >
              로그인
            </button>
            <button
              className={`login-toggle-btn ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false)
                setError('')
              }}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
            {!isLogin && (
              <div className="login-form-group">
                <label className="login-label">이름</label>
                <input
                  type="text"
                  className="login-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="login-form-group">
              <label className="login-label">아이디</label>
              <input
                type="text"
                className="login-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                autoComplete="username"
                required
              />
            </div>

            <div className="login-form-group">
              <label className="login-label">비밀번호</label>
              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? '처리 중...' : isLogin ? '로그인' : '회원가입'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login

