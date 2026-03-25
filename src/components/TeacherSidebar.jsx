import { useNavigate } from 'react-router-dom'
import { TRACK_EMOJI, TRACK_LABEL } from './TeacherToolbar'

const GAME_LINKS = [
  { icon: '⏱️', label: 'Blurt!',            path: '/blurt'     },
  { icon: '🐍', label: 'Word Snake',         path: '/wordsnake' },
  { icon: '🎤', label: 'Lyrics Mixer',       path: '/lyrics'    },
  { icon: '🏛️', label: 'Sentence Auction',  path: '/play'      },
  { icon: '🧩', label: 'Borrás Memory Game', path: '/play'      },
  { icon: '🎮', label: 'Hotel Memory Game',  path: '/play'      },
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
        .teacher-sidebar { display: none !important; }
        @media (min-width: 768px) {
          .teacher-sidebar { display: flex !important; }
        }
      `}</style>
      <div
        className="teacher-sidebar"
        style={{
          width: '48px',
          flexShrink: 0,
          background: 'white',
          borderRight: '0.5px solid #e2e8f0',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          zIndex: 100,
        }}
      >
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

        {/* Games */}
        {GAME_LINKS.map(g => (
          <SbBtn
            key={g.label}
            icon={g.icon}
            title={g.label}
            onClick={() => navigate(g.path)}
          />
        ))}

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
