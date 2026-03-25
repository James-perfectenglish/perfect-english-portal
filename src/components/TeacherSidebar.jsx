import { useNavigate } from 'react-router-dom'
import { TRACK_EMOJI, TRACK_LABEL } from './TeacherToolbar'

const NAV_LINKS = [
  { icon: '🏠', label: 'Home',     path: '/'         },
  { icon: '🎯', label: 'Practise', path: '/practise' },
  { icon: '📚', label: 'Learn',    path: '/learn'    },
  { icon: '🎮', label: 'Play',     path: '/play'     },
  { icon: '📊', label: 'Progress', path: '/progress' },
]

function SbBtn({ icon, title, onClick, active, style: extraStyle = {} }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
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

export default function TeacherSidebar({ teacherTrack, onCycleTrack, onBrowseClick, onTeacherClick, onPresentMode }) {
  const navigate = useNavigate()

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

        {/* Teacher tools */}
        <SbBtn
          icon={TRACK_EMOJI[teacherTrack] || '🇬🇧'}
          title={`Track: ${TRACK_LABEL[teacherTrack] || 'English'} — click to cycle`}
          onClick={onCycleTrack}
          active={teacherTrack && teacherTrack !== 'en'}
        />
        <SbBtn icon="🔍" title="Browse questions"    onClick={onBrowseClick}  />
        <SbBtn icon="👨‍🏫" title="Teacher dashboard" onClick={onTeacherClick} />

        <Divider />

        {/* Spacer pushes Present Mode to bottom */}
        <div style={{ flex: 1 }} />

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
