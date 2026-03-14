// TeacherToolbar — drop into any page that needs the teacher controls.
// Usage:
//   import TeacherToolbar from './TeacherToolbar'
//   <TeacherToolbar isTeacher={isTeacher} teacherTrack={teacherTrack} onCycleTrack={onCycleTrack} onBrowseClick={onBrowseClick} onTeacherClick={onTeacherClick} />

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

export const TRACK_CYCLE = ['en', 'spanish', 'bathroom', 'hotels', 'business']

export const TRACK_EMOJI = {
  en:       '🇬🇧',
  spanish:  '🇪🇸',
  bathroom: '🛁',
  hotels:   '🏨',
  business: '💼',
}

export const TRACK_LABEL = {
  en:       'English (no override)',
  spanish:  'Spanish track',
  bathroom: 'Bathroom track',
  hotels:   'Hotels track',
  business: 'Business track',
}

export default function TeacherToolbar({ isTeacher, teacherTrack = 'en', onCycleTrack, onBrowseClick, onTeacherClick }) {
  if (!isTeacher) return null
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      {onCycleTrack && (
        <button
          onClick={onCycleTrack}
          title={`Track: ${TRACK_LABEL[teacherTrack]} — click to cycle`}
          style={{ ...BTN, width: '34px', fontSize: '1.1rem' }}
        >
          {TRACK_EMOJI[teacherTrack] || '🇬🇧'}
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
