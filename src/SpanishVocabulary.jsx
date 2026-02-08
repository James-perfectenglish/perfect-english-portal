import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const questions = [
  { id: 1, sentence: "¿Qué significa 'la casa'?\nWhat does 'la casa' mean?", options: ["the house", "the street", "the garden", "the car"], correct: "the house", explanation: "'La casa' means 'the house'. It's a feminine noun, so we use 'la'." },
  { id: 2, sentence: "¿Qué significa 'el perro'?\nWhat does 'el perro' mean?", options: ["the dog", "the cat", "the bird", "the fish"], correct: "the dog", explanation: "'El perro' means 'the dog'. It's a masculine noun, so we use 'el'." },
  { id: 3, sentence: "¿Qué significa 'comer'?\nWhat does 'comer' mean?", options: ["to eat", "to drink", "to sleep", "to walk"], correct: "to eat", explanation: "'Comer' means 'to eat'. It's a regular -er verb." },
  { id: 4, sentence: "¿Qué significa 'la familia'?\nWhat does 'la familia' mean?", options: ["the family", "the friend", "the neighbour", "the teacher"], correct: "the family", explanation: "'La familia' means 'the family'. It's a feminine noun." },
  { id: 5, sentence: "¿Qué significa 'trabajar'?\nWhat does 'trabajar' mean?", options: ["to work", "to study", "to play", "to rest"], correct: "to work", explanation: "'Trabajar' means 'to work'. It's a regular -ar verb." },
  { id: 6, sentence: "¿Qué significa 'el agua'?\nWhat does 'el agua' mean?", options: ["the water", "the wine", "the coffee", "the milk"], correct: "the water", explanation: "'El agua' means 'the water'. Although 'agua' is feminine, we use 'el' because it starts with a stressed 'a'." },
  { id: 7, sentence: "¿Qué significa 'grande'?\nWhat does 'grande' mean?", options: ["big", "small", "new", "old"], correct: "big", explanation: "'Grande' means 'big' or 'large'. It can also mean 'great'." },
  { id: 8, sentence: "¿Qué significa 'la ciudad'?\nWhat does 'la ciudad' mean?", options: ["the city", "the town", "the village", "the country"], correct: "the city", explanation: "'La ciudad' means 'the city'. It's a feminine noun." },
  { id: 9, sentence: "¿Qué significa 'hablar'?\nWhat does 'hablar' mean?", options: ["to speak", "to listen", "to write", "to read"], correct: "to speak", explanation: "'Hablar' means 'to speak' or 'to talk'. It's a regular -ar verb." },
  { id: 10, sentence: "¿Qué significa 'el tiempo'?\nWhat does 'el tiempo' mean?", options: ["both time and weather", "the money", "the time", "the weather"], correct: "both time and weather", explanation: "'El tiempo' can mean both 'the time' and 'the weather' in Spanish. Context tells you which!" },
  { id: 11, sentence: "¿Qué significa 'la comida'?\nWhat does 'la comida' mean?", options: ["the food", "the drink", "the breakfast", "the dinner"], correct: "the food", explanation: "'La comida' means 'the food'. It can also mean 'lunch' specifically." },
  { id: 12, sentence: "¿Qué significa 'nuevo'?\nWhat does 'nuevo' mean?", options: ["new", "old", "young", "ancient"], correct: "new", explanation: "'Nuevo' means 'new'. The feminine form is 'nueva'." },
  { id: 13, sentence: "¿Qué significa 'la escuela'?\nWhat does 'la escuela' mean?", options: ["the school", "the university", "the library", "the office"], correct: "the school", explanation: "'La escuela' means 'the school'. It's a feminine noun." },
  { id: 14, sentence: "¿Qué significa 'dormir'?\nWhat does 'dormir' mean?", options: ["to sleep", "to wake up", "to dream", "to rest"], correct: "to sleep", explanation: "'Dormir' means 'to sleep'. It's an irregular verb (o→ue in present tense)." },
  { id: 15, sentence: "¿Qué significa 'el libro'?\nWhat does 'el libro' mean?", options: ["the book", "the notebook", "the magazine", "the newspaper"], correct: "the book", explanation: "'El libro' means 'the book'. It's a masculine noun." },
  { id: 16, sentence: "¿Qué significa 'bonito'?\nWhat does 'bonito' mean?", options: ["pretty", "ugly", "expensive", "cheap"], correct: "pretty", explanation: "'Bonito' means 'pretty' or 'nice'. The feminine form is 'bonita'." },
  { id: 17, sentence: "¿Qué significa 'el coche'?\nWhat does 'el coche' mean?", options: ["the car", "the bus", "the train", "the bicycle"], correct: "the car", explanation: "'El coche' means 'the car'. In some Spanish-speaking countries, 'el carro' is also used." },
  { id: 18, sentence: "¿Qué significa 'la mesa'?\nWhat does 'la mesa' mean?", options: ["the table", "the chair", "the desk", "the bed"], correct: "the table", explanation: "'La mesa' means 'the table'. It's a feminine noun." },
  { id: 19, sentence: "¿Qué significa 'comprar'?\nWhat does 'comprar' mean?", options: ["to buy", "to sell", "to pay", "to cost"], correct: "to buy", explanation: "'Comprar' means 'to buy'. It's a regular -ar verb." },
  { id: 20, sentence: "¿Qué significa 'el hermano'?\nWhat does 'el hermano' mean?", options: ["the brother", "the father", "the son", "the friend"], correct: "the brother", explanation: "'El hermano' means 'the brother'. 'La hermana' means 'the sister'." }
]

function SpanishVocabulary({ onComplete, onBack }) {
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
        .eq('title', 'Spanish Vocabulary')
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
        .eq('title', 'Spanish Vocabulary')
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
    if (percentage === 100) return { text: "¡Perfecto! You know your Spanish vocabulary!", color: '#48bb78' }
    if (percentage >= 70) return { text: "¡Muy bien! You have good Spanish vocabulary knowledge.", color: '#48bb78' }
    if (percentage >= 50) return { text: "¡Bien! Keep learning these Spanish words.", color: '#4299e1' }
    return { text: "Keep practising! Review the vocabulary and try again.", color: '#ed8936' }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Spanish Vocabulary</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Essential Spanish vocabulary with bilingual practice</p>
        <span style={{ display: 'inline-block', background: '#48bb78', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>Level: A1 Beginner</span>
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
              <div style={{ fontSize: '1.15rem', color: '#2d3748', marginBottom: '12px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {q.sentence}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
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
                  <strong>{isCorrect ? '✓ ¡Correcto!' : '✗ Incorrect'}</strong>
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

export default SpanishVocabulary