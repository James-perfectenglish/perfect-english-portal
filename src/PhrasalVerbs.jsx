import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const questions = [
  {
    id: 1,
    sentence: "We need to ___________ the project deadline by two weeks.",
    options: ["put off", "put up", "put on", "put through"],
    correct: "put off",
    explanation: "'Put off' means to postpone or delay something. We use it when moving a deadline to a later date."
  },
  {
    id: 2,
    sentence: "The CEO will ___________ the new strategy at tomorrow's meeting.",
    options: ["set up", "set out", "set off", "set back"],
    correct: "set out",
    explanation: "'Set out' means to explain or present something clearly and in detail, especially plans or ideas."
  },
  {
    id: 3,
    sentence: "Could you ___________ this report before we send it to the client?",
    options: ["look into", "look up", "look after", "look over"],
    correct: "look over",
    explanation: "'Look over' means to examine or review something quickly but carefully."
  },
  {
    id: 4,
    sentence: "The negotiations ___________ because both sides couldn't agree on the terms.",
    options: ["broke up", "broke down", "broke out", "broke off"],
    correct: "broke down",
    explanation: "'Break down' means to fail or stop working, often used for negotiations, discussions, or systems that fail."
  },
  {
    id: 5,
    sentence: "We should ___________ a meeting to discuss the budget issues.",
    options: ["set out", "set off", "set up", "set down"],
    correct: "set up",
    explanation: "'Set up' means to arrange or organise something, like a meeting, appointment, or system."
  },
  {
    id: 6,
    sentence: "The accountant needs to ___________ these figures before the audit.",
    options: ["go off", "go over", "go into", "go on"],
    correct: "go over",
    explanation: "'Go over' means to examine or review something carefully, often in detail."
  },
  {
    id: 7,
    sentence: "Let's ___________ from where we left off yesterday.",
    options: ["carry out", "carry through", "carry over", "carry on"],
    correct: "carry on",
    explanation: "'Carry on' means to continue doing something, especially after a pause or interruption."
  },
  {
    id: 8,
    sentence: "The company decided to ___________ the contract with the supplier.",
    options: ["call up", "call on", "call off", "call for"],
    correct: "call off",
    explanation: "'Call off' means to cancel something that was planned, like a meeting, contract, or event."
  },
  {
    id: 9,
    sentence: "The manager asked us to ___________ the quarterly report by Friday.",
    options: ["hand out", "hand over", "hand in", "hand down"],
    correct: "hand in",
    explanation: "'Hand in' means to submit or give something to someone in authority, like a report or assignment."
  },
  {
    id: 10,
    sentence: "We need to ___________ the new software before we can use it company-wide.",
    options: ["roll back", "roll up", "roll over", "roll out"],
    correct: "roll out",
    explanation: "'Roll out' means to introduce or launch something gradually, especially a product or plan."
  }
]

function PhrasalVerbs({ onComplete, onBack }) {
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
        .eq('title', 'Business Phrasal Verbs')
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
        .eq('title', 'Business Phrasal Verbs')
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
    if (percentage === 100) return { text: "Perfect! You have mastered business phrasal verbs!", color: '#48bb78' }
    if (percentage >= 70) return { text: "Well done! You have a strong grasp of phrasal verbs.", color: '#48bb78' }
    if (percentage >= 50) return { text: "Good work! Keep practising these phrasal verbs.", color: '#4299e1' }
    return { text: "Phrasal verbs are tricky! Review the explanations and try again.", color: '#ed8936' }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid white', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', position: 'absolute', left: '1rem', top: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>← Back</button>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Business Phrasal Verbs</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Master essential phrasal verbs for business communication</p>
        <span style={{ display: 'inline-block', background: '#ed8936', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Level: C1 Advanced</span>
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

export default PhrasalVerbs