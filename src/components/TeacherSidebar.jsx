import { useNavigate } from 'react-router-dom'
import { LEVEL_BUTTONS, VOCATIONAL_TRACKS, bandOf } from './teacherControls'

const NAV_LINKS = [
  { icon: '🏠', label: 'Home',     path: '/'         },
  { icon: '🎯', label: 'Practise', path: '/practise' },
  { icon: '📚', label: 'Learn',    path: '/learn'    },
  { icon: '🎮', label: 'Play',     path: '/play'     },
  { icon: '📊', label: 'Progress', path: '/progress' },
]

function SbBtn({ icon, title, onClick, active, badge, style: extraStyle = {} }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: active ? '#EDE9FE' : 'none',
        border: 'none',
        fontSize: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: active ? '#667eea' : '#4a5568',
        flexShrink: 0,
        ...extraStyle,
      }}
    >
      {icon}
      {badge && (
        <span style={{
          position: 'absolute',
          bottom: '-1px',
          right: '-2px',
          fontSize: '0.5rem',
          fontWeight: 800,
          lineHeight: 1,
          padding: '1px 3px',
          borderRadius: '6px',
          background: '#667eea',
          color: 'white',
        }}>{badge}</span>
      )}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: '32px',
      height: '0.5px',
      background: '#e2e8f0',
      margin: '4px 0',
      flexShrink: 0,
    }} />
  )
}

export default function TeacherSidebar({
  teachLang,
  teachLevel,
  teachTracks = [],
  onToggleLang,
  onSetBand,
  onToggleTrack,
  onBrowseClick,
  onTeacherClick,
  onPresentMode,
}) {
  const navigate = useNavigate()
  const isEs = teachLang === 'es'
  const activeBand = bandOf(teachLevel)

  return (
    <>
      <style>{`
        .teacher-sidebar {
          display: none !important;
        }
        @media (min-width: 768px) {
          .teacher-sidebar {
            display: flex !important;
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            width: 48px;
            z-index: 100;
          }
          .teacher-main-content {
            margin-left: 48px;
          }
        }
      `}</style>
      <div
        className="teacher-sidebar"
        style={{
          background: 'white',
          borderRight: '0.5px solid #e2e8f0',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          overflowY: 'auto',
        }}
      >
        {/* Nav links */}
        {NAV_LINKS.map(link => (
          <SbBtn
            key={link.path}
            icon={link.icon}
            title={link.label}
            onClick={() => navigate(link.path)}
          />
        ))}

        <Divider />

        {/* Language toggle */}
        <SbBtn
          icon={isEs ? '🇪🇸' : '🇬🇧'}
          title={`Language: ${isEs ? 'Spanish' : 'English'} — click to switch`}
          onClick={onToggleLang}
          active={isEs}
        />

        <Divider />

        {/* Level band — tap to cycle sub-level */}
        {LEVEL_BUTTONS.map(b => {
          const isActive = activeBand === b.band
          return (
            <SbBtn
              key={b.band}
              icon={b.emoji}
              title={`${b.label}${isActive ? ` — ${teachLevel} (click to cycle)` : ' — click to preview'}`}
              onClick={() => onSetBand(b.band)}
              active={isActive}
              badge={isActive ? teachLevel : null}
              style={{ fontSize: '0.95rem' }}
            />
          )
        })}

        <Divider />

        {/* Track filters — multi-select, kept off the normal lists until active */}
        {VOCATIONAL_TRACKS.map(t => (
          <SbBtn
            key={t.key}
            icon={t.emoji}
            title={`${t.label} track — ${teachTracks.includes(t.key) ? 'showing (click to hide)' : 'click to show its content'}`}
            onClick={() => onToggleTrack(t.key)}
            active={teachTracks.includes(t.key)}
          />
        ))}

        <Divider />

        <SbBtn icon="🔍" title="Browse questions"    onClick={onBrowseClick}  />
        <SbBtn icon="👨‍🏫" title="Teacher dashboard" onClick={onTeacherClick} />

        {/* Spacer pushes Present Mode to bottom */}
        <div style={{ flex: 1, minHeight: '8px' }} />

        {/* Present Mode */}
        <SbBtn
          icon="▶"
          title="Present Mode — show students your screen"
          onClick={onPresentMode}
          style={{ color: '#667eea', fontSize: '0.85rem' }}
        />
      </div>
    </>
  )
}
