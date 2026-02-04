import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Prepositions from './Prepositions'
import PhrasalVerbs from './PhrasalVerbs'
import OfficeVocabulary from './OfficeVocabulary'
function ExerciseList({ userLevel }) {
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeExercise, setActiveExercise] = useState(null)

  useEffect(() => {
    fetchExercises()
  }, [userLevel])

  const fetchExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('recommended_order', { ascending: true })

   if (data) {
  console.log('Exercises from Supabase:', data.map(e => e.title))
  // Sort so user's level comes first
      const recommended = data.filter(e => e.level === userLevel)
      const others = data.filter(e => e.level !== userLevel)
      setExercises([...recommended, ...others])
    }
    setLoading(false)
  }

const startExercise = (exercise) => {
  if (exercise.title === 'Prepositions Practice' || exercise.title === 'Business Phrasal Verbs' || exercise.title === 'Office Vocabulary') {
    setActiveExercise(exercise)
  }
}

  // Show the active exercise if one is selected
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

  return (
    <div style={{ marginTop: '30px' }}>
      <h2 style={{ color: '#2d3748', marginBottom: '5px' }}>Recommended Exercises</h2>
      <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '20px' }}>Exercises matched to your level appear first</p>
      <div style={{ display: 'grid', gap: '20px' }}>
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            style={{
              border: exercise.level === userLevel ? '2px solid #667eea' : '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: exercise.level === userLevel ? '#f7f8ff' : '#f9f9f9'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ color: '#2d3748', margin: 0 }}>{exercise.title}</h3>
              {exercise.level === userLevel && (
                <span style={{ background: '#667eea', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>
                  Recommended
                </span>
              )}
            </div>
            <p style={{ color: '#4a5568', marginTop: '8px' }}>{exercise.description}</p>
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              <span>📚 {exercise.topic}</span>
              <span style={{ marginLeft: '15px' }}>🎯 Level: {exercise.level}</span>
              <span style={{ marginLeft: '15px' }}>✅ Pass: {exercise.passing_score}%</span>
            </div>
            <button
  onClick={() => startExercise(exercise)}
  style={{
    marginTop: '15px',
    padding: '10px 20px',
    backgroundColor: (exercise.title === 'Prepositions Practice' || exercise.title === 'Business Phrasal Verbs'|| exercise.title === 'Office Vocabulary') ? '#667eea' : '#cbd5e0',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: (exercise.title === 'Prepositions Practice' || exercise.title === 'Business Phrasal Verbs'|| exercise.title === 'Office Vocabulary') ? 'pointer' : 'not-allowed',
    fontWeight: 600
  }}
>
  {(exercise.title === 'Prepositions Practice' || exercise.title === 'Business Phrasal Verbs'|| exercise.title === 'Office Vocabulary'|| exercise.title === 'Office Vocabulary') ? 'Start Exercise' : 'Coming Soon'}
</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ExerciseList