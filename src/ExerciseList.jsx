import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Exercises
import TopicPracticeExercise from './TopicPracticeExercise'
import SentenceBuilding from './SentenceBuilding'
import ListeningExercise from './ListeningExercise'
import Dictation from './Dictation'
import OddOneOut from './OddOneOut'
import ErrorCorrection from './ErrorCorrection'
import MatchingExercise from './MatchingExercise'
import SentenceAuction from './SentenceAuction'
import FlashcardTemplate from './FlashcardTemplate'
import MemoryGame from './MemoryGame'
import { BORRAS_CARDS } from './data/BorrasCards'
import { HOTEL_CARDS } from './data/HotelCards'

const IRREGULAR_VERBS_ID = 1
const PHRASAL_VERBS_ID   = 2

const ACTIVE_EXERCISES = new Set([
  'Prepositions 📄', 'Business Phrasal Verbs 💼', 'Phrasal Verbs 📚',
  'Business Vocabulary 🗂️', 'Spanish Vocabulary 🇪🇸',
  'Hotel Vocabulary 🏨', 'Bathroom Vocabulary 🛁', 'Vocabulary 📒',
  'Irregular Verbs Flashcards', 'Essential Phrasal Verbs',
  'Sentence Building', 'Listening Exercises', 'Dictation',
  'Borrás Flashcards', 'Borrás Memory Game',
  'Hotel Flashcards', 'Hotel Memory Game',
  'Odd One Out', 'Error Correction',
  'Matching', 'Sentence Auction', 'Lyrics Mixer', 'Blurt!', 'Word Snake',
])

const EXERCISE_ICONS = {
  'Prepositions 📄':              '📄',
  'Business Phrasal Verbs 💼':    '💼',
  'Phrasal Verbs 📚':             '📚',
  'Business Vocabulary 🗂️':      '🗂️',
  'Spanish Vocabulary 🇪🇸':       '🇪🇸',
  'Hotel Vocabulary 🏨':          '🏨',
  'Bathroom Vocabulary 🛁':       '🛁',
  'Vocabulary 📒':                '📒',
  'Irregular Verbs Flashcards':   '📚',
  'Essential Phrasal Verbs':      '📖',
  'Sentence Building':            '🏗️',
  'Listening Exercises':          '🎧',
  'Dictation':                    '⌨️',
  'Borrás Flashcards':            '🚿',
  'Borrás Memory Game':           '🧩',
  'Hotel Flashcards':             '🏩',
  'Hotel Memory Game':            '🎮',
  'Odd One Out':                  '🔍',
  'Error Correction':             '🚨',
  'Matching':                     '🔗',
  'Sentence Auction':             '🏛️',
  'Lyrics Mixer':                 '🎤',
  'Blurt!':                       '⏱️',
  'Word Snake':                   '🐍',
}

const TABS = [
  { key: 'learn',    label: 'Learn'    },
  { key: 'practice', label: 'Practice' },
  { key: 'listen',   label: 'Listen'   },
  { key: 'play',     label: 'Play'     },
]

const SPECIFIC_TRACKS = ['bathroom', 'hotels', 'spanish', 'business', 'law', 'sports']

function shouldShowExercise(exercise, userTracks) {
  if (!userTracks || userTracks.length === 0) return true
  const exTracks = exercise.tracks || ['general']
  if (exTracks.includes('general')) return true
  return exTracks.some(t => userTracks.includes(t))
}

function isForYouFn(exercise, userTracks) {
  if (!userTracks || userTracks.length === 0) return false
  const exTracks = exercise.tracks || ['general']
  return exTracks.some(t => SPECIFIC_TRACKS.includes(t) && userTracks.includes(t))
}

export default function ExerciseList({
  userLevel,
  userTracks = [],
  isTeacher = false,
  onTeacherClick,
  onBrowseClick,
  globalLang,
  onToggleLang,
}) {
  const [exercises, setExercises]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [activeTab, setActiveTab]             = useState('learn')
  const [isListView, setIsListView]           = useState(false)
  const [activeExercise, setActiveExercise]   = useState(null)
  const [openedTitles, setOpenedTitles]       = useState(new Set())
  const [hasNewListening, setHasNewListening] = useState(false)

  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => { setActiveExercise(null) }, [location.key])
  useEffect(() => { fetchAll() }, [userTracks])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchExercises(), fetchOpenedTitles(), fetchListeningNew()])
    setLoading(false)
  }

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('recommended_order', { ascending: true })
    if (data) setExercises(data)
  }

  const fetchOpenedTitles = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('exercise_opens')
      .select('exercise_title')
      .eq('student_id', user.id)
    if (data) setOpenedTitles(new Set(data.map(r => r.exercise_title)))
  }

  const fetchListeningNew = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let q = supabase.from('listening_exercises').select('id')
    if (userTracks && userTracks.length > 0) q = q.overlaps('tracks', userTracks)
    const { data: available } = await q
    if (!available || available.length === 0) return

    const { data: sessions } = await supabase
      .from('listening_sessions')
      .select('exercise_id')
      .eq('student_id', user.id)

    const completedIds = new Set((sessions || []).map(s => s.exercise_id))
    setHasNewListening(available.some(e => !completedIds.has(e.id)))
  }

  const recordOpen = async (title) => {
    if (openedTitles.has(title)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('exercise_opens').upsert(
      { student_id: user.id, exercise_title: title },
      { onConflict: 'student_id,exercise_title', ignoreDuplicates: true }
    )
    setOpenedTitles(prev => new Set([...prev, title]))
  }

  const startExercise = (exercise) => {
    if (!ACTIVE_EXERCISES.has(exercise.title)) return
    recordOpen(exercise.title)
    if (exercise.title === 'Lyrics Mixer') { navigate('/lyrics');     return }
    if (exercise.type === 'blurt')         { navigate('/blurt');      return }
    if (exercise.title === 'Word Snake')   { navigate('/wordsnake');  return }
    setActiveExercise(exercise)
  }

  const back = () => setActiveExercise(null)

  const isNew = (exercise) => {
    if (exercise.title === 'Listening Exercises') return hasNewListening
    return !openedTitles.has(exercise.title)
  }

  // ── Exercise routing ──────────────────────────────────────────────────────
  if (activeExercise) {
    const t = activeExercise.title

    // All topic_practice exercises use the same reusable component
    if (activeExercise.type === 'topic_practice') {
      return (
        <TopicPracticeExercise
          exercise={activeExercise}
          userLevel={userLevel}
          onBack={back}
          onComplete={back}
        />
      )
    }

    if (t === 'Irregular Verbs Flashcards') return <FlashcardTemplate flashcardSetId={IRREGULAR_VERBS_ID} setName="irregular-verbs" onBack={back} />
    if (t === 'Essential Phrasal Verbs')    return <FlashcardTemplate flashcardSetId={PHRASAL_VERBS_ID} setName="phrasal-verbs" onBack={back} />
    if (t === 'Sentence Building')          return <SentenceBuilding onComplete={back} onBack={back} />
    if (t === 'Listening Exercises')        return <ListeningExercise onBack={back} userTracks={userTracks} />
    if (t === 'Dictation')                  return <Dictation onBack={back} userTracks={userTracks} />
    if (t === 'Borrás Flashcards') return (
      <FlashcardTemplate
        title="Borrás Flashcards" subtitle="Bathroom vocabulary in context 🚿"
        levelBadge="Level: A1–B1" setName="borras"
        cards={BORRAS_CARDS} hasRounds={true} showMemoryGame={true} onBack={back}
      />
    )
    if (t === 'Borrás Memory Game') return (
      <MemoryGame
        title="Borrás Memory Game" subtitle="Match the English word to its Spanish translation 🚿"
        levelBadge="Level: A1–B1" cards={BORRAS_CARDS}
        gameName="borras" cardBackImage="/og-image.png" onBack={back}
      />
    )
    if (t === 'Hotel Flashcards') return (
      <FlashcardTemplate
        title="Hotel Flashcards" subtitle="Essential hotel vocabulary in context 🏩"
        levelBadge="Level: A2" setName="hotel"
        cards={HOTEL_CARDS} hasRounds={true} showMemoryGame={true} onBack={back}
      />
    )
    if (t === 'Hotel Memory Game') return (
      <MemoryGame
        title="Hotel Memory Game" subtitle="Match the English word to its Spanish translation 🏩"
        levelBadge="Level: A2" cards={HOTEL_CARDS}
        gameName="hotel" cardBackImage="/og-image.png" onBack={back}
      />
    )
    if (t === 'Odd One Out')      return <OddOneOut onComplete={back} onBack={back} />
    if (t === 'Error Correction') return <ErrorCorrection onComplete={back} onBack={back} />
    if (t === 'Matching')         return <MatchingExercise onComplete={back} onBack={back} />
    if (t === 'Sentence Auction') return <SentenceAuction onComplete={back} onBack={back} />
  }

  // ── Filter + sort for active tab ──────────────────────────────────────────
  const tabExercises = exercises
    .filter(e => shouldShowExercise(e, userTracks))
    .filter(e => (e.category || 'practice') === activeTab)

  const forYouList  = tabExercises.filter(e => isForYouFn(e, userTracks))
  const generalList = tabExercises.filter(e => !isForYouFn(e, userTracks))
  const hasBoth     = forYouList.length > 0 && generalList.length > 0

  // ── Sub-components ────────────────────────────────────────────────────────

  const LevelBadge = ({ level }) => {
    const key = level?.[0] || 'B'
    const styles = {
      A: { background: '#f0fff4', color: '#276749' },
      B: { background: '#ebf8ff', color: '#2b6cb0' },
      C: { background: '#fffaf0', color: '#c05621' },
    }
    const s = styles[key] || styles.B
    return (
      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', flexShrink: 0, ...s }}>
        {level}
      </span>
    )
  }

  const ForYouBadge = () => (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '2px 7px', borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
      ⭐️ For You
    </span>
  )

  const NewBadge = () => (
    <span style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.4px', flexShrink: 0, whiteSpace: 'nowrap', borderRadius: '8px', padding: '2px 7px', border: '1.5px solid transparent', background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #667eea, #764ba2) border-box', display: 'inline-block' }}>
      <span style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 800, fontSize: '0.6rem' }}>
        NEW
      </span>
    </span>
  )

  const SectionLabel = ({ children }) => (
    <div style={{ gridColumn: 'span 2', fontSize: '0.7rem', fontWeight: 700, color: '#b0b8cc', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 4px 2px' }}>
      {children}
    </div>
  )

  const GridCard = ({ exercise }) => {
    const fy      = isForYouFn(exercise, userTracks)
    const newFlag = isNew(exercise)
    const active  = ACTIVE_EXERCISES.has(exercise.title)
    const icon    = EXERCISE_ICONS[exercise.title] || '📝'
    const isWide  = exercise.category === 'listen'

    const cardStyle = {
      border: `1.5px solid ${fy ? '#667eea' : '#e8e8f0'}`,
      borderRadius: '14px',
      padding: isWide ? '12px 14px' : '12px',
      background: fy ? 'linear-gradient(160deg, #f7f8ff 0%, #fdf5ff 100%)' : 'white',
      cursor: active ? 'pointer' : 'default',
      position: 'relative',
      display: 'flex',
      flexDirection: isWide ? 'row' : 'column',
      alignItems: isWide ? 'center' : 'flex-start',
      gap: isWide ? '12px' : '5px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      gridColumn: isWide ? 'span 2' : 'span 1',
    }

    if (isWide) {
      return (
        <div style={cardStyle} onClick={() => active && startExercise(exercise)}>
          <div style={{ fontSize: '2rem', flexShrink: 0 }}>{icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2d3748', lineHeight: 1.25 }}>{exercise.title}</div>
            <div style={{ fontSize: '0.71rem', color: '#718096', lineHeight: 1.4, marginTop: '3px' }}>{exercise.description}</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
              <LevelBadge level={exercise.level} />
              {fy && <ForYouBadge />}
              {newFlag && <NewBadge />}
              {active
                ? <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#667eea', marginLeft: 'auto' }}>Start →</span>
                : <span style={{ fontSize: '0.65rem', color: '#a0aec0', fontStyle: 'italic' }}>Coming soon</span>
              }
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={cardStyle} onClick={() => active && startExercise(exercise)}>
        {newFlag && <div style={{ position: 'absolute', top: 8, left: 8 }}><NewBadge /></div>}
        {fy      && <div style={{ position: 'absolute', top: 8, right: 8 }}><ForYouBadge /></div>}
        <div style={{ fontSize: '1.5rem', marginTop: (newFlag || fy) ? '18px' : '0' }}>{icon}</div>
        <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2d3748', lineHeight: 1.25 }}>{exercise.title}</div>
        <div style={{ fontSize: '0.71rem', color: '#718096', lineHeight: 1.4 }}>{exercise.description}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap', gap: '3px' }}>
          <LevelBadge level={exercise.level} />
          {active
            ? <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#667eea' }}>→</span>
            : <span style={{ fontSize: '0.65rem', color: '#a0aec0', fontStyle: 'italic' }}>Soon</span>
          }
        </div>
      </div>
    )
  }

  const ListCard = ({ exercise }) => {
    const fy      = isForYouFn(exercise, userTracks)
    const newFlag = isNew(exercise)
    const active  = ACTIVE_EXERCISES.has(exercise.title)
    const icon    = EXERCISE_ICONS[exercise.title] || '📝'

    return (
      <div
        style={{ border: `1.5px solid ${fy ? '#667eea' : '#e8e8f0'}`, borderRadius: '12px', padding: '12px 14px', background: fy ? 'linear-gradient(160deg, #f7f8ff 0%, #fdf5ff 100%)' : 'white', cursor: active ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        onClick={() => active && startExercise(exercise)}
      >
        <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2d3748' }}>{exercise.title}</div>
          <div style={{ fontSize: '0.74rem', color: '#718096', marginTop: '2px' }}>{exercise.description}</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '5px', flexWrap: 'wrap' }}>
            <LevelBadge level={exercise.level} />
            {fy && <ForYouBadge />}
            {newFlag && <NewBadge />}
            {!active && <span style={{ fontSize: '0.65rem', color: '#a0aec0', fontStyle: 'italic' }}>Coming soon</span>}
          </div>
        </div>
        {active && <div style={{ fontSize: '1rem', color: '#cbd5e0', flexShrink: 0 }}>→</div>}
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 0 80px', minHeight: '60vh' }}>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1rem 0.5rem' }}>
        <div>
          <div style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', fontWeight: 700, color: '#2d3748' }}>Exercises</div>
          <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '2px' }}>⭐️ For You exercises appear first</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, marginTop: '2px' }}>

          {isTeacher && onToggleLang && (
            <button
              onClick={onToggleLang}
              title={globalLang === 'en' ? 'Switch to Spanish mode' : 'Switch to English mode'}
              style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {globalLang === 'en' ? '🇬🇧' : '🇪🇸'}
            </button>
          )}

          {isTeacher && onBrowseClick && (
            <button
              onClick={onBrowseClick}
              title="Question browser"
              style={{ height: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#4a5568', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
            >
              🔍 Browse
            </button>
          )}

          {isTeacher && onTeacherClick && (
            <button
              onClick={onTeacherClick}
              title="Teacher dashboard"
              style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              👨‍🏫
            </button>
          )}

          <button
            onClick={() => setIsListView(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f0f0f5', borderRadius: '8px', padding: '5px 9px', cursor: 'pointer', border: 'none', fontSize: '0.72rem', fontWeight: 600, color: '#4a5568', whiteSpace: 'nowrap' }}
          >
            {isListView ? '⊞ Grid' : '☰ List'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0.75rem 1rem', scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s', border: activeTab === tab.key ? '2px solid transparent' : '2px solid #e2e8f0', background: activeTab === tab.key ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'white', color: activeTab === tab.key ? 'white' : '#4a5568', boxShadow: activeTab === tab.key ? '0 2px 8px rgba(102,126,234,0.35)' : 'none' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exercise content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#718096' }}>Loading exercises...</div>
      ) : tabExercises.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#718096' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚧</div>
          More exercises coming soon!
        </div>
      ) : isListView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 10px' }}>
          {hasBoth && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b0b8cc', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 4px 2px' }}>⭐️ For You</div>}
          {forYouList.map(e => <ListCard key={e.id} exercise={e} />)}
          {hasBoth && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b0b8cc', textTransform: 'uppercase', letterSpacing: '0.6px', padding: '8px 4px 2px' }}>All Exercises</div>}
          {generalList.map(e => <ListCard key={e.id} exercise={e} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '0 10px' }}>
          {hasBoth && <SectionLabel>⭐️ For You</SectionLabel>}
          {forYouList.map(e => <GridCard key={e.id} exercise={e} />)}
          {hasBoth && <SectionLabel>All Exercises</SectionLabel>}
          {generalList.map(e => <GridCard key={e.id} exercise={e} />)}
        </div>
      )}
    </div>
  )
}
