import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const questions = [

  {
    id: 1,
    sentence: "The meeting starts ___________ 9 o'clock.",
    options: ["at", "on", "in", "by"],
    correct: "at",
    explanation: "We use 'at' with specific times (at 9 o'clock, at midnight, at noon)."
  },
  {
    id: 2,
    sentence: "My birthday is ___________ the 15th of March.",
    options: ["at", "on", "in", "by"],
    correct: "on",
    explanation: "We use 'on' with specific dates and days (on Monday, on the 15th of March, on Christmas Day)."
  },
  {
    id: 3,
    sentence: "She's very good ___________ playing tennis.",
    options: ["at", "on", "in", "for"],
    correct: "at",
    explanation: "We use 'good at' when talking about skills and abilities. It's a fixed expression."
  },
  {
    id: 4,
    sentence: "I'm looking forward ___________ seeing you again.",
    options: ["to", "for", "at", "with"],
    correct: "to",
    explanation: "'Look forward to' is a fixed expression. Remember: 'to' is followed by -ing in this case (to seeing, not to see)."
  },
  {
    id: 5,
    sentence: "We travelled ___________ train from London to Edinburgh.",
    options: ["by", "with", "in", "on"],
    correct: "by",
    explanation: "We use 'by' with most forms of transport (by train, by car, by plane). Exception: on foot!"
  },
  {
    id: 6,
    sentence: "I'm interested ___________ learning how to bake.",
    options: ["for", "with", "in", "on"],
    correct: "in",
    explanation: "We use 'in' as a dependent preposition with interested (I'm interested in art)."
  },
  {
    id: 7,
    sentence: "She lives ___________ London.",
    options: ["in", "at", "on", "by"],
    correct: "in",
    explanation: "We use 'in' with cities, countries, and enclosed spaces (in London, in Spain, in a room)."
  },
  {
    id: 8,
    sentence: "The report must be finished ___________ Friday.",
    options: ["by", "until", "at", "in"],
    correct: "by",
    explanation: "We use 'by' to mean 'not later than' or 'before' a specific time or date (by Friday = before Friday ends)."
  },
  {
    id: 9,
    sentence: "I've been waiting ___________ twenty minutes!",
    options: ["for", "since", "during", "while"],
    correct: "for",
    explanation: "We use 'for' with a period of time (for 20 minutes, for 3 hours, for 5 years)."
  },
  {
    id: 10,
    sentence: "I've lived here ___________ 2020.",
    options: ["for", "since", "from", "by"],
    correct: "since",
    explanation: "We use 'since' with a specific point in time when something started (since 2020, since Monday, since January)."
  }
]

function Prepositions({ onComplete, onBack }) {
  const [answered, setAnswered] = useState({})
  const [score, setScore] = useState(0)
  useEffect(() => {
  window.scrollTo(0, 0)
}, [])
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAnswer = (questionId, selected) => {
    if (answered[questionId]) return

    const question = questions.find(q => q.id === questionId)
    const isCorrect = selected === question.correct

    setAnswered(prev => ({ ...prev, [questionId]: selected }))
    if (isCorrect) setScore(prev => prev + 1)

    // Check if all answered
    if (Object.keys(answered).length + 1 === questions.length) {
      setFinished(true)
      saveResult(isCorrect ? score + 1 : score)
    }
  }

 const saveResult = async (finalScore) => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: exercise } = await supabase
        .from('exercises')
        .select('id')
        .eq('title', 'Prepositions Practice')
        .single()

      if (exercise) {
        await supabase
          .from('student_attempts')
          .insert({
            student_id: user.id,
            exercise_id: exercise.id,
            score: finalScore,
            completed_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Error saving result:', error)
    }
    setSaving(false)
  }

  const percentage = Math.round((score / questions.length) * 100)

  const getResultMessage = () => {
    if (percentage === 100) return { text: "Perfect! You have an excellent understanding of English prepositions!", color: '#48bb78' }
    if (percentage >= 70) return { text: "Well done! You have a strong grasp of preposition usage.", color: '#48bb78' }
    if (percentage >= 50) return { text: "Good work! Keep practising these prepositions and review the explanations.", color: '#4299e1' }
    return { text: "Prepositions are tricky! Review the explanations and try again.", color: '#ed8936' }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
<div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>        
<button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', position: 'absolute', left: '1rem', top: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>← Back</button>        <span style={{ display: 'inline-block', background: '#4299e1', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Level: B1 Intermediate</span>
      </div>

      {/* White card body */}
      <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
          <span>Progress: {Object.keys(answered).length}/{questions.length}</span>
          <span>Score: {score}/{questions.length}</span>
        </div>

        {/* Questions */}
        {questions.map(q => {
          const userAnswer = answered[q.id]
          const isAnswered = userAnswer !== undefined
          const isCorrect = userAnswer === q.correct

          return (
            <div key={q.id} style={{
              border: `2px solid ${isAnswered ? (isCorrect ? '#48bb78' : '#f56565') : '#e2e8f0'}`,
              background: isAnswered ? (isCorrect ? '#f0fff4' : '#fff5f5') : 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontWeight: 700, color: '#667eea', fontSize: '0.85rem', marginBottom: '8px' }}>Question {q.id}</div>
              <div style={{ fontSize: '1.15rem', color: '#2d3748', marginBottom: '12px', lineHeight: 1.6 }}>
                {q.sentence.replace('___________', '________')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {q.options.map(opt => {
                  let bg = '#f7fafc', border = '#e2e8f0', color = '#2d3748', cursor = 'pointer'
                  if (isAnswered) {
                    cursor = 'not-allowed'
                    if (opt === q.correct) { bg = '#48bb78'; border = '#48bb78'; color = 'white' }
                    else if (opt === userAnswer) { bg = '#f56565'; border = '#f56565'; color = 'white' }
                    else { cursor = 'not-allowed'}
                  }
                  return (
                    <button key={opt} onClick={() => handleAnswer(q.id, opt)} style={{
                      padding: '10px', background: bg, border: `2px solid ${border}`, borderRadius: '6px',
                      color, cursor, fontWeight: 500, fontSize: '1rem', transition: 'all 0.2s'
                    }}>
                      {opt}
                    </button>
                  )
                })}
              </div>
              {/* Feedback */}
              {isAnswered && (
                <div style={{
                  marginTop: '12px', padding: '12px', borderRadius: '6px',
                  background: isCorrect ? '#c6f6d5' : '#fed7d7',
                  color: isCorrect ? '#22543d' : '#742a2a',
                  borderLeft: `4px solid ${isCorrect ? '#48bb78' : '#f56565'}`
                }}>
                  <strong>{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</strong>
                  <br />{q.explanation}
                </div>
              )}
            </div>
          )
        })}

        {/* Results */}
        {finished && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: getResultMessage().color, margin: '12px 0' }}>{score}/{questions.length}</div>
            <p style={{ color: '#4a5568' }}>{getResultMessage().text}</p>
            {saving && <p style={{ color: '#718096', fontSize: '0.9rem' }}>Saving your result...</p>}
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => { setAnswered({}); setScore(0); setFinished(false) }} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
              <button onClick={onBack} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Prepositions