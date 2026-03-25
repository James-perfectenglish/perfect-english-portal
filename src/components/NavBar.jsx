import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

const TABS = [
  { path: '/',          label: 'Home',     icon: '🏠' },
  { path: '/practise',  label: 'Practise', icon: '🎯' },
  { path: '/learn',     label: 'Learn',    icon: '📚' },
  { path: '/play',      label: 'Play',     icon: '🎮' },
  { path: '/progress',  label: 'Progress', icon: '📊' },
]

const PROGRESS_DOT_KEY = 'pep_progress_last_visit'
const DOT_THRESHOLD_DAYS = 7

function shouldShowDot() {
  try {
    const last = localStorage.getItem(PROGRESS_DOT_KEY)
    if (!last) return true
    const daysSince = (Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24)
    return daysSince >= DOT_THRESHOLD_DAYS
  } catch { return false }
}

export default function NavBar({ isTeacher, presentMode = false }) {
  const location = useLocation()
  const [showDot, setShowDot] = useState(false)

  useEffect(() => {
    setShowDot(shouldShowDot())
  }, [])

  useEffect(() => {
    if (location.pathname === '/progress') {
      try { localStorage.setItem(PROGRESS_DOT_KEY, Date.now().toString()) } catch {}
      setShowDot(false)
    }
  }, [location.pathname])

  if (isTeacher) return null

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* ── MOBILE / PRESENT MODE: fixed bottom tab bar ── */}
      <nav style={{
        display: 'flex',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'white',
        borderTop: '0.5px solid #e2e8f0',
        padding: '6px 0 max(4px, env(safe-area-inset-bottom))',
      }} className="pep-bottom-nav">
        {TABS.map(tab => {
          const active = isActive(tab.path)
          const isDot = tab.path === '/progress' && showDot
          return (
            <Link key={tab.path} to={tab.path} style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              textDecoration: 'none',
              padding: '2px 0',
              position: 'relative',
            }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '9px',
                fontWeight: active ? 600 : 500,
                color: active ? '#667eea' : '#718096',
                lineHeight: 1,
              }}>{tab.label}</span>
              {active && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '20px',
                  height: '2px',
                  background: '#667eea',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              {isDot && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 'calc(50% - 14px)',
                  width: '7px',
                  height: '7px',
                  background: '#e53e3e',
                  borderRadius: '50%',
                  border: '1.5px solid white',
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── DESKTOP: top nav — hidden in present mode ── */}
      {!presentMode && (
        <header style={{
          background: 'white',
          borderBottom: '0.5px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          width: '100%',
        }} className="pep-top-nav">
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '0 1rem',
            display: 'flex',
            alignItems: 'center',
            height: '52px',
            gap: '4px',
          }}>
            <a href="https://perfect-english.org" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', marginRight: '24px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                <span style={{ color: '#2C3E50' }}>Perfect</span>
                <span style={{ color: '#3498DB' }}> English</span>
              </span>
            </a>
            {TABS.map(tab => {
              const active = isActive(tab.path)
              const isDot = tab.path === '/progress' && showDot
              return (
                <Link key={tab.path} to={tab.path} style={{
                  textDecoration: 'none',
                  padding: '0 12px',
                  height: '52px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.88rem',
                  fontWeight: active ? 600 : 500,
                  color: active ? '#667eea' : '#4a5568',
                  borderBottom: active ? '2px solid #667eea' : '2px solid transparent',
                  position: 'relative',
                  whiteSpace: 'nowrap',
                }}>
                  {tab.label}
                  {isDot && (
                    <span style={{
                      position: 'absolute',
                      top: '10px',
                      right: '6px',
                      width: '6px',
                      height: '6px',
                      background: '#e53e3e',
                      borderRadius: '50%',
                      border: '1.5px solid white',
                    }} />
                  )}
                </Link>
              )
            })}
          </div>
        </header>
      )}

      {/* ── CSS to show/hide based on screen size ── */}
      <style>{`
        .pep-bottom-nav { display: flex; }
        .pep-top-nav { display: none; }
        @media (min-width: 768px) {
          .pep-bottom-nav { display: ${presentMode ? 'flex' : 'none'}; }
          .pep-top-nav { display: ${presentMode ? 'none' : 'block'}; }
        }
        .pep-page-content { padding-bottom: 70px; }
        @media (min-width: 768px) {
          .pep-page-content { padding-bottom: ${presentMode ? '70px' : '0'}; }
        }
      `}</style>
    </>
  )
}
