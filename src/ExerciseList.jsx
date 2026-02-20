import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Prepositions from './Prepositions'
import PhrasalVerbs from './PhrasalVerbs'
import OfficeVocabulary from './OfficeVocabulary'
import SpanishVocabulary from './SpanishVocabulary'
import VerbsFlashcards from './VerbsFlashcards'
import SentenceBuilding from './SentenceBuilding'
import ListeningExercise from './ListeningExercise'
import BorrasFlashcards from "./BorrasFlashcards"
import BorrasMemoryGame from "./BorrasMemoryGame"
import HotelFlashcards from "./HotelFlashcards"
import HotelMemoryGame from "./HotelMemoryGame"
import OddOneOut from "./OddOneOut"
import ErrorCorrection from "./ErrorCorrection"

function ExerciseList({ userLevel }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeExercise, setActiveExercise] = useState(null)

  const location = useLocation()
  useEffect(() => {
    setActiveExercise(null)
  }, [location.key])

  useEffect(() => {
    fetchExercises()
  }, [userLevel])

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('recommended_order', { ascending: true })

    if (data) {
      const recommended = data.filter(e => e.level === userLevel)
      const others = data.filter(e => e.level !== userLevel)
      setExercises([...recommended, ...others])
    }
    setLoading(false)
  }

  const startExercise = (exercise) => {
    const activeExercises = [
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
      'Error Correction'
    ]
    if (activeExercises.includes(exercise.title)) {
      setActiveExercise(exercise)
    }
  }

  if (activeExercise) {
    if (activeExercise.title === 'Prepositions Practice') {
      return <Prepositions onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Business Phrasal Verbs') {
      return <PhrasalVerbs onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Office Vocabulary') {
      return <OfficeVocabulary onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Spanish Vocabulary') {
      return <SpanishVocabulary onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Irregular Verbs Flashcards') {
      return <VerbsFlashcards flashcardSetId={1} onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Essential Phrasal Verbs') {
      return <VerbsFlashcards flashcardSetId={2} onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Sentence Building') {
      return <SentenceBuilding onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Listening Exercises') {
      return <ListeningExercise onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Borrás Flashcards') {
      return <BorrasFlashcards onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Borrás Memory Game') {
      return <BorrasMemoryGame onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Hotel Flashcards') {
      return <HotelFlashcards onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Hotel Memory Game') {
      return <HotelMemoryGame onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Odd One Out') {
      return <OddOneOut onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
    if (activeExercise.title === 'Error Correction') {
      return <ErrorCorrection onComplete={() => setActiveExercise(null)} onBack={() => setActiveExercise(null)} />
    }
  }

  if (loading) {
    return <div>Loading exercises...</div>
  }

  if (exercises.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No exercises available yet.</p>
        <p>Check back soon!</p>
      </div>
    )
  }

  const activeExercises = [
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
    'Error Correction'
  ]

  return (
    <div style={{ marginTop: '30px' }}>
      <h2 style={{ color: '#2d3748', marginBottom: '5px' }}>Recommended Exercises</h2>
      <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '20px' }}>Exercises matched to your level appear first</p>
      <div style={{ display: 'grid', gap: '20px' }}>
        {exercises.map((exercise) => {
          const isActive = activeExercises.includes(exercise.title)
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
                  <span style={{
                    background: '#667eea', color: 'white', padding: '2px 10px',
                    borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600
                  }}>Recommended</span>
                )}
              </div>
              <p style={{ color: '#4a5568', marginTop: '8px' }}>{exercise.description}</p>
              <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                <span>📚 {exercise.topic}</span>
                <span style={{ marginLeft: '15px' }}>🎯 Level: {exercise.level}</span>
                {exercise.passing_score ? (
                  <span style={{ marginLeft: '15px' }}>✅ Pass: {exercise.passing_score}%</span>
                ) : (
                  <span style={{ marginLeft: '15px' }}>✅ Self-paced</span>
                )}
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
