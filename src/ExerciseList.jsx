import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

// Exercises
import Prepositions from './Prepositions'
import PhrasalVerbs from './PhrasalVerbs'
import OfficeVocabulary from './OfficeVocabulary'
import SpanishVocabulary from './SpanishVocabulary'
import SentenceBuilding from './SentenceBuilding'
import ListeningExercise from './ListeningExercise'
import OddOneOut from './OddOneOut'
import ErrorCorrection from './ErrorCorrection'
import MatchingExercise from './MatchingExercise'
import SentenceAuction from './SentenceAuction'

// Unified flashcard template + data
import FlashcardTemplate from './FlashcardTemplate'
import MemoryGame from './MemoryGame'
import { BORRAS_CARDS } from './data/BorrasCards'
import { HOTEL_CARDS } from './data/HotelCards'

// Flashcard set IDs from Supabase
const IRREGULAR_VERBS_ID = 1
const PHRASAL_VERBS_ID = 2

const ACTIVE_EXERCISES = [
  'Prepositions Practice',
  'Business Phrasal Verbs',
  'Office Vocabulary',
  'Spanish Vocabulary',
  'Irregular Verbs Flashcards',
  'Essential Phrasal Verbs',
  'Sentence Building',
  'Listening Exercises',
  'Borrás Flashcards',
  'Borrás Memory Game',
  'Hotel Flashcards',
  'Hotel Memory Game',
  'Odd One Out',
  'Error Correction',
  'Matching',
  'Sentence Auction',
]

// ── Track mapping ──
// 'general' = shown to all students regardless of track
// Other track names match what's stored in profiles.tracks
const EXERCISE_TRACK_MAP = {
  'Prepositions Practice':      ['general'],
  'Business Phrasal Verbs':     ['general', 'business'],
  'Office Vocabulary':          ['general', 'business'],
  'Spanish Vocabulary':         ['spanish'],
  'Irregular Verbs Flashcards': ['general', 'spanish'],
  'Essential Phrasal Verbs':    ['general'],
  'Sentence Building':          ['general'],
  'Listening Exercises':        ['general', 'hotels'],
  'Borrás Flashcards':          ['bathroom', 'spanish'],
  'Borrás Memory Game':         ['bathroom', 'spanish'],
  'Hotel Flashcards':           ['hotels'],
  'Hotel Memory Game':          ['hotels'],
  'Odd One Out':                ['general'],
  'Error Correction':           ['general'],
  'Matching':                   ['general'],
  'Sentence Auction':           ['general'],
}

// Which tracks are "specific" — exercises tagged ONLY to these are hidden from others
const SPECIFIC_TRACKS = ['bathroom', 'hotels', 'spanish']

// Given a student's tracks array, should this exercise be shown?
function shouldShowExercise(exerciseTitle, userTracks) {
  // No tracks assigned = see everything (teacher view, or unassigned student)
  if (!userTracks || userTracks.length === 0) return true

  const exerciseTracks = EXERCISE_TRACK_MAP[exerciseTitle] || ['general']

  // Always show general exercises
  if (exerciseTracks.includes('general')) return true

  // Show if the exercise matches any of the user's tracks
  return exerciseTracks.some(t => userTracks.includes(t))
}

// Is this exercise specifically for the user's track(s)? (for badge + ordering)
function isTrackExercise(exerciseTitle, userTracks) {
  if (!userTracks || userTracks.length === 0) return false
  const exerciseTracks = EXERCISE_TRACK_MAP[exerciseTitle] || ['general']
  // It's a "track exercise" if it matches a specific (non-general) track the user has
  return exerciseTracks.some(t => SPECIFIC_TRACKS.includes(t) && userTracks.includes(t))
}

function ExerciseList({ userLevel, userTracks = [] }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeExercise, setActiveExercise] = useState(null)
  const location = useLocation()

  useEffect(() => {
    setActiveExercise(null)
  }, [location.key])

  useEffect(() => {
    fetchExercises()
  }, [userLevel, userTracks])

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('recommended_order', { ascending: true })

    if (data) {
      const hasTracks = userTracks && userTracks.length > 0

      // Filter out exercises that don't belong to this student's tracks
      const visible = data.filter(e => shouldShowExercise(e.title, userTracks))

      if (hasTracks) {
        // Track exercises first, then general ones
        const trackOnes = visible.filter(e => isTrackExercise(e.title, userTracks))
        const generalOnes = visible.filter(e => !isTrackExercise(e.title, userTracks))
        setExercises([...trackOnes, ...generalOnes])
      } else {
        // No tracks — use level-based ordering (original behaviour)
        const recommended = visible.filter(e => e.level === userLevel)
        const others = visible.filter(e => e.level !== userLevel)
        setExercises([...recommended, ...others])
      }
    }
    setLoading(false)
  }

  const startExercise = (exercise) => {
    if (ACTIVE_EXERCISES.includes(exercise.title)) setActiveExercise(exercise)
  }

  const back = () => setActiveExercise(null)

  // ── Exercise routing ──
  if (activeExercise) {
    const t = activeExercise.title
    if (t === 'Prepositions Practice') return <Prepositions onComplete={back} onBack={back} />
    if (t === 'Business Phrasal Verbs') return <PhrasalVerbs onComplete={back} onBack={back} />
    if (t === 'Office Vocabulary') return <OfficeVocabulary onComplete={back} onBack={back} />
    if (t === 'Spanish Vocabulary') return <SpanishVocabulary onComplete={back} onBack={back} />
    if (t === 'Irregular Verbs Flashcards') return (
      <FlashcardTemplate flashcardSetId={IRREGULAR_VERBS_ID} setName="irregular-verbs" onBack={back} />
    )
    if (t === 'Essential Phrasal Verbs') return (
      <FlashcardTemplate flashcardSetId={PHRASAL_VERBS_ID} setName="phrasal-verbs" onBack={back} />
    )
    if (t === 'Sentence Building') return <SentenceBuilding onComplete={back} onBack={back} />
    if (t === 'Listening Exercises') return <ListeningExercise onBack={back} />
    if (t === 'Borrás Flashcards') return (
      <FlashcardTemplate
        title="Borrás Flashcards"
        subtitle="Bathroom vocabulary in context 🚿"
        levelBadge="Level: A1–B1"
        setName="borras"
        cards={BORRAS_CARDS}
        hasRounds={true}
        showMemoryGame={true}
        onBack={back}
      />
    )
    if (t === 'Borrás Memory Game') return (
      <MemoryGame
        title="Borrás Memory Game"
        subtitle="Match the English word to its Spanish translation 🚿"
        levelBadge="Level: A1–B1"
        cards={BORRAS_CARDS}
        gameName="borras"
        cardBackImage="/og-image.png"
        onBack={back}
      />
    )
    if (t === 'Hotel Flashcards') return (
      <FlashcardTemplate
        title="Hotel Flashcards"
        subtitle="Essential hotel vocabulary in context 🏨"
        levelBadge="Level: A2"
        setName="hotel"
        cards={HOTEL_CARDS}
        hasRounds={true}
        showMemoryGame={true}
        onBack={back}
      />
    )
    if (t === 'Hotel Memory Game') return (
      <MemoryGame
        title="Hotel Memory Game"
        subtitle="Match the English word to its Spanish translation 🏨"
        levelBadge="Level: A2"
        cards={HOTEL_CARDS}
        gameName="hotel"
        cardBackImage="/og-image.png"
        onBack={back}
      />
    )
    if (t === 'Odd One Out') return <OddOneOut onComplete={back} onBack={back} />
    if (t === 'Error Correction') return <ErrorCorrection onComplete={back} onBack={back} />
    if (t === 'Matching') return <MatchingExercise onComplete={back} onBack={back} />
    if (t === 'Sentence Auction') return <SentenceAuction onComplete={back} onBack={back} />
  }

  // ── Exercise list ──
  if (loading) return <div>Loading exercises...</div>

  if (exercises.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No exercises available yet.</p>
        <p>Check back soon!</p>
      </div>
    )
  }

  const hasTracks = userTracks && userTracks.length > 0

  return (
    <div style={{ marginTop: '30px' }}>
      <h2 style={{ color: '#2d3748', marginBottom: '5px' }}>
        {hasTracks ? 'Your Exercises' : 'Recommended Exercises'}
      </h2>
      <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '20px' }}>
        {hasTracks
          ? 'Your track exercises appear first'
          : 'Exercises matched to your level appear first'}
      </p>
      <div style={{ display: 'grid', gap: '20px' }}>
        {exercises.map((exercise) => {
          const isActive = ACTIVE_EXERCISES.includes(exercise.title)
          const isTrack = isTrackExercise(exercise.title, userTracks)
          const isLevelMatch = !hasTracks && exercise.level === userLevel

          // Border colour: purple for track match, blue-ish for level match, grey otherwise
          const borderStyle = isTrack
            ? '2px solid #667eea'
            : isLevelMatch
              ? '2px solid #667eea'
              : '1px solid #e2e8f0'

          const bgColour = isTrack
            ? '#f7f8ff'
            : isLevelMatch
              ? '#f7f8ff'
              : '#f9f9f9'

          return (
            <div
              key={exercise.id}
              style={{
                border: borderStyle,
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: bgColour,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                <h3 style={{ color: '#2d3748', margin: 0 }}>{exercise.title}</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {isTrack && (
                    <span style={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: 'white',
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>⭐ Your Track</span>
                  )}
                  {isLevelMatch && (
                    <span style={{
                      background: '#667eea', color: 'white',
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '0.8rem', fontWeight: 600,
                    }}>Recommended</span>
                  )}
                </div>
              </div>
              <p style={{ color: '#4a5568', marginTop: '8px' }}>{exercise.description}</p>
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                <span>📚 {exercise.topic}</span>
                <span style={{ marginLeft: '15px' }}>🎯 Level: {exercise.level}</span>
                {exercise.passing_score
                  ? <span style={{ marginLeft: '15px' }}>✅ Pass: {exercise.passing_score}%</span>
                  : <span style={{ marginLeft: '15px' }}>✅ Self-paced</span>
                }
              </div>
              <button
                onClick={() => startExercise(exercise)}
                style={{
                  marginTop: '15px', padding: '10px 20px',
                  backgroundColor: isActive ? '#667eea' : '#cbd5e0',
                  color: 'white', border: 'none', borderRadius: '6px',
                  cursor: isActive ? 'pointer' : 'not-allowed', fontWeight: 600,
                }}
              >
                {isActive ? 'Start Exercise' : 'Coming Soon'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ExerciseList
