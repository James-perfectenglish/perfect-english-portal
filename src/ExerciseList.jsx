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

// Unified flashcard template + data
import FlashcardTemplate from './FlashcardTemplate'
import MemoryGame from './MemoryGame'
import { BORRAS_CARDS } from './data/BorrasCards'
import { HOTEL_CARDS } from './data/HotelCards'

// Flashcard set IDs from Supabase
const IRREGULAR_VERBS_ID = 1
const PHRASAL_VERBS_ID   = 2

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
]

function ExerciseList({ userLevel }) {
  const [exercises, setExercises]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeExercise, setActiveExercise] = useState(null)

  const location = useLocation()
  useEffect(() => { setActiveExercise(null) }, [location.key])
  useEffect(() => { fetchExercises() }, [userLevel])

  const fetchExercises = async () => {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .order('recommended_order', { ascending: true })
    if (data) {
      const recommended = data.filter(e => e.level === userLevel)
      const others      = data.filter(e => e.level !== userLevel)
      setExercises([...recommended, ...others])
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

    if (t === 'Prepositions Practice')
      return <Prepositions onComplete={back} onBack={back} />

    if (t === 'Business Phrasal Verbs')
      return <PhrasalVerbs onComplete={back} onBack={back} />

    if (t === 'Office Vocabulary')
      return <OfficeVocabulary onComplete={back} onBack={back} />

    if (t === 'Spanish Vocabulary')
      return <SpanishVocabulary onComplete={back} onBack={back} />

    if (t === 'Irregular Verbs Flashcards')
      return (
        <FlashcardTemplate
          flashcardSetId={IRREGULAR_VERBS_ID}
          setName="irregular-verbs"
          onBack={back}
        />
      )

    if (t === 'Essential Phrasal Verbs')
      return (
        <FlashcardTemplate
          flashcardSetId={PHRASAL_VERBS_ID}
          setName="phrasal-verbs"
          onBack={back}
        />
      )

    if (t === 'Sentence Building')
      return <SentenceBuilding onComplete={back} onBack={back} />

    if (t === 'Listening Exercises')
      return <ListeningExercise onBack={back} />

    if (t === 'Borrás Flashcards')
      return (
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

    if (t === 'Borrás Memory Game')
      return (
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

    if (t === 'Hotel Flashcards')
      return (
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

    if (t === 'Hotel Memory Game')
      return (
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

    if (t === 'Odd One Out')
      return <OddOneOut onComplete={back} onBack={back} />

    if (t === 'Error Correction')
      return <ErrorCorrection onComplete={back} onBack={back} />
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

  return (
    <div style={{ marginTop: '30px' }}>
      <h2 style={{ color: '#2d3748', marginBottom: '5px' }}>Recommended Exercises</h2>
      <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '20px' }}>Exercises matched to your level appear first</p>
      <div style={{ display: 'grid', gap: '20px' }}>
        {exercises.map((exercise) => {
          const isActive = ACTIVE_EXERCISES.includes(exercise.title)
          return (
            <div key={exercise.id} style={{
              border: exercise.level === userLevel ? '2px solid #667eea' : '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: exercise.level === userLevel ? '#f7f8ff' : '#f9f9f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ color: '#2d3748', margin: 0 }}>{exercise.title}</h3>
                {exercise.level === userLevel && (
                  <span style={{ background: '#667eea', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>Recommended</span>
                )}
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
                  cursor: isActive ? 'pointer' : 'not-allowed', fontWeight: 600
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
