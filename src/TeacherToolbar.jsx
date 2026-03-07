// TeacherToolbar — drop into any page that needs the teacher controls.
// Usage:
//   import TeacherToolbar from './TeacherToolbar'
//   <TeacherToolbar isTeacher={isTeacher} globalLang={globalLang} onToggleLang={onToggleLang} onBrowseClick={onBrowseClick} onTeacherClick={onTeacherClick} />

const BTN = {
  height: '34px',
  borderRadius: '8px',
  background: '#f0f0f5',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4a5568',
}

export default function TeacherToolbar({ isTeacher, globalLang, onToggleLang, onBrowseClick, onTeacherClick }) {
  if (!isTeacher) return null
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {onToggleLang && (
        <button
          onClick={onToggleLang}
          title={globalLang === 'en' ? 'Switch to Spanish mode' : 'Switch to English mode'}
          style={{ ...BTN, width: '34px', fontSize: '1.1rem' }}
        >
          {globalLang === 'en' ? '🇬🇧' : '🇪🇸'}
        </button>
      )}
      {onBrowseClick && (
        <button
          onClick={onBrowseClick}
          title="Question browser"
          style={{ ...BTN, padding: '0 10px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          🔍 Browse
        </button>
      )}
      {onTeacherClick && (
        <button
          onClick={onTeacherClick}
          title="Teacher dashboard"
          style={{ ...BTN, width: '34px', fontSize: '1rem' }}
        >
          👨‍🏫
        </button>
      )}
    </div>
  )
}
