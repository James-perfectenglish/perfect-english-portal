import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const questions = [
  {
    id: 1,
    sentence: "I need to print this document. Where is the ___________?",
    options: ["printer", "office", "keyboard", "screen"],
    correct: "printer",
    explanation: "A printer is the machine we use to print documents on paper."
  },
  {
    id: 2,
    sentence: "Can you send me that information by ___________?",
    options: ["email", "phone", "desk", "cable"],
    correct: "email",
    explanation: "Email is electronic mail - we use it to send messages and documents through the internet."
  },
  {
    id: 3,
    sentence: "I have a ___________ with my manager at 3 o'clock today.",
    options: ["meeting", "lunch", "coffee", "date"],
    correct: "meeting",
    explanation: "A meeting is when people get together to discuss work or make decisions."
  },
  {
    id: 4,
    sentence: "Please write your name and number on this ___________.",
    options: ["form", "door", "wall", "computer"],
    correct: "form",
    explanation: "A form is a document with spaces where you write information."
  },
  {
    id: 5,
    sentence: "I sit at my ___________ and work on my computer all day.",
    options: ["desk", "chair", "sofa", "table"],
    correct: "desk",
    explanation: "A desk is the piece of furniture where you sit and work in an office."
  },
  {
    id: 6,
    sentence: "My ___________ is very kind. She helps me when I have problems.",
    options: ["colleague", "mate", "customer", "student"],
    correct: "colleague",
    explanation: "A colleague is a person who works with you in the same company or office."
  },
  {
    id: 7,
    sentence: "I need to ___________ this letter and send it today.",
    options: ["sign", "bin", "look", "see"],
    correct: "sign",
    explanation: "To sign means to write your name on a document to show you approve it or agree with it."
  },
  {
    id: 8,
    sentence: "Can I use your ___________ to make a call?",
    options: ["phone", "printer", "scanner", "file"],
    correct: "phone",
    explanation: "A phone (or telephone) is what we use to make calls and speak to people who are not in the same place."
  },
  {
    id: 9,
    sentence: "I keep all my important papers in this ___________.",
    options: ["folder", "stapler", "plug", "bottle"],
    correct: "folder",
    explanation: "A folder is used to organise and store papers and documents."
  },
  {
    id: 10,
    sentence: "My ___________ starts at 9 am and finishes at 5 pm.",
    options: ["shift", "lunch", "dinner", "breakfast"],
    correct: "shift",
    explanation: "A shift is the period of time when you work. For example, a morning shift or an evening shift."
  }
]

function OfficeVocabulary({ onComplete, onBack }) {
  const [answered, setAnswered] = useState({})
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const saveAnswer = async (questionId, selected, correct) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: exercise } = await supabase
        .from('exercises')
        .select('id')
        .eq('title', 'Office Vocabulary')
        .single()

      if (exercise) {
        await supabase
          .from('student_answers')
          .insert({
            student_id: user.id,
            exercise_id: exercise.id,
            question_id: questionId,
            student_answer: selected,
            correct_answer: correct,
            is_correct: selected === correct,
            answered_at: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Error saving answer:', error)
    }
  }

  const handleAnswer = (questionId, selected) => {
    if (answered[questionId]) return

    const question = questions.find(q => q.id === questionId)
    const isCorrect = selected === question.correct
    
    saveAnswer(questionId, selected, question.correct)
    
    setAnswered(prev => ({ ...prev, [questionId]: selected }))
    if (isCorrect) setScore(prev => prev + 1)

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
        .eq('title', 'Office Vocabulary')
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
    if (percentage === 100) return { text: "Perfect! You know your office vocabulary!", color: '#48bb78' }
    if (percentage >= 70) return { text: "Well done! You have good knowledge of office words.", color: '#48bb78' }
    if (percentage >= 50) return { text: "Good work! Keep learning these office words.", color: '#4299e1' }
    return { text: "Keep practising! Review the vocabulary and try again.", color: '#ed8936' }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', position: 'absolute', left: '1rem', top: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>← Back</button>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Office Vocabulary</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Essential vocabulary for office environments</p>
        <span style={{ display: 'inline-block', background: '#48bb78', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Level: A2 Elementary</span>
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
          <span>Progress: {Object.keys(answered).length}/{questions.length}</span>
          <span>Score: {score}/{questions.length}</span>
        </div>

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
                {q.sentence}
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

export default OfficeVocabulary