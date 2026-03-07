import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}
function normalise(str) {
  return (str || '').toLowerCase().trim().replace(/[''`]/g, "'").replace(/\s+/g, ' ')
}
function fisherYates(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function parseJsonb(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

function renderQuestion(text) {
  const parts = text.split('_______')
  if (parts.length === 1) return <span>{text}</span>
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span style={{ display: 'inline-block', width: '80px', borderBottom: '2px solid #667eea', margin: '0 4px', verticalAlign: 'bottom' }} />
          )}
        </span>
      ))}
    </span>
  )
}

// ── EXACT same LEVELS definition as SentenceBuilding.jsx ─────────────────────
const LEVELS = [
  {
    key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2',
    badgeLabel: 'Level: A1 – A2', group: 'A',
    description: 'Multiple choice questions at beginner level.',
    colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱'
  },
  {
    key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2',
    badgeLabel: 'Level: B1 – B2', group: 'B',
    description: 'Mixed multiple choice and gap fill questions.',
    colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘'
  },
  {
    key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2',
    badgeLabel: 'Level: C1 – C2', group: 'C',
    description: 'Gap fill questions at advanced level.',
    colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓'
  },
]

function getSuggestedLevel(userLevel) {
  const l = (userLevel || 'B1').toUpperCase()
  if (l.startsWith('A') || l === 'SPANISH') return 'beginner'
  if (l.startsWith('C')) return 'advanced'
  return 'intermediate'
}

export default function TopicPracticeExercise({ exercise, userLevel, onBack, onComplete }) {
  const [stage, setStage]               = useState('level-select')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [questionCounts, setQuestionCounts] = useState({})
  const [questions, setQuestions]       = useState([])
  const [current, setCurrent]           = useState(0)
  const [userAnswer, setUserAnswer]     = useState('')
  const [selectedOption, setSelected]   = useState(null)
  const [feedback, setFeedback]         = useState(null)
  const [isChecking, setIsChecking]     = useState(false)
  const [results, setResults]           = useState([])
  const [sessionSaved, setSessionSaved] = useState(false)
  const inputRef = useRef(null)

  const passMark    = exercise.passing_score || 7
  const totalTarget = 10
  const suggested   = getSuggestedLevel(userLevel)

  // Fetch counts on first render via useEffect-equivalent: we call it once on mount
  // (handled inline since this component re-mounts fresh each time)
  useState(() => { fetchCounts() }, [])

  async function fetchCounts() {
    if (exercise.topic === 'spanish') {
      const { data } = await supabase.from('question_bank').select('level').eq('topic', exercise.topic).eq('language', 'es')
      if (data) {
        const counts = {}
        LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length })
        setQuestionCounts(counts)
      }
    } else {
      const { data } = await supabase.from('question_bank').select('level').eq('topic', exercise.topic).in('language', ['en', 'both'])
      if (data) {
        const counts = {}
        LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length })
        setQuestionCounts(counts)
      }
    }
  }

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return
    setSelectedLevel(level)
    setStage('loading')
    fetchQuestions(level)
  }

  async function fetchQuestions(level) {
    setCurrent(0); setResults([]); setFeedback(null)
    setUserAnswer(''); setSelected(null); setSessionSaved(false)

    const levelGroup = level.group

    let query = supabase.from('question_bank').select('*').eq('topic', exercise.topic).in('level', level.dbLevels).is('sequence_group', null)
    if (exercise.topic === 'spanish') query = query.eq('language', 'es')
    else query = query.in('language', ['en', 'both'])
    const { data, error } = await query

    if (error || !data || data.length === 0) { setStage('playing'); setQuestions([]); return }

    let selected = []
    if (levelGroup === 'A') {
      const mc = fisherYates(data.filter(q => q.type === 'multiple_choice'))
      selected = mc.slice(0, totalTarget)
      if (selected.length < totalTarget) selected = [...selected, ...fisherYates(data.filter(q => !selected.includes(q)))].slice(0, totalTarget)
    } else if (levelGroup === 'C') {
      const gf = fisherYates(data.filter(q => q.type === 'gap_fill'))
      selected = gf.slice(0, totalTarget)
      if (selected.length < totalTarget) selected = [...selected, ...fisherYates(data.filter(q => !selected.includes(q)))].slice(0, totalTarget)
    } else {
      const mc = fisherYates(data.filter(q => q.type === 'multiple_choice'))
      const gf = fisherYates(data.filter(q => q.type === 'gap_fill'))
      let mcSlice = mc.slice(0, 5), gfSlice = gf.slice(0, 5)
      if (mcSlice.length + gfSlice.length < totalTarget) {
        const used = new Set([...mcSlice, ...gfSlice])
        mcSlice = [...mcSlice, ...fisherYates(data.filter(q => !used.has(q))).slice(0, totalTarget - mcSlice.length - gfSlice.length)]
      }
      selected = fisherYates([...mcSlice, ...gfSlice])
    }

    const prepared = selected.map(q => q.type === 'multiple_choice' ? { ...q, shuffledOptions: fisherYates(parseJsonb(q.options)) } : q)
    setQuestions(prepared)
    setStage('playing')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setSelectedLevel(null); setQuestions([]); setCurrent(0); setResults([])
    setFeedback(null); setUserAnswer(''); setSelected(null); setStage('level-select')
    fetchCounts()
  }

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setStage('loading'); fetchQuestions(selectedLevel)
  }

  // ── Answer checking ─────────────────────────────────────────────────────────
  const checkAnswer = async () => {
    const q = questions[current]
    if (!q || isChecking) return
    if (q.type === 'multiple_choice') { if (!selectedOption) return; checkMC(q, selectedOption) }
    else { if (!userAnswer.trim()) return; await checkGapFill(q, userAnswer.trim()) }
  }

  const checkMC = (q, sel) => {
    const norm = normalise(sel)
    const alts = parseJsonb(q.acceptable_alternatives)
    const isCorrect = normalise(q.correct_answer) === norm || alts.some(a => normalise(a) === norm)
    setFeedback({ isCorrect, correct: q.correct_answer, type: 'mc' })
    setResults(prev => [...prev, { question: q, isCorrect }])
  }

  const checkGapFill = async (q, answer) => {
    setIsChecking(true)
    const norm = normalise(answer), correctNorm = normalise(q.correct_answer)
    const alts = parseJsonb(q.acceptable_alternatives), informal = parseJsonb(q.informal_accepted)
    const addR = (ok) => setResults(prev => [...prev, { question: q, isCorrect: ok }])

    if (norm === correctNorm) { setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'exact' }); addR(true); setIsChecking(false); return }
    if (alts.some(a => normalise(a) === norm)) { setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'alternative' }); addR(true); setIsChecking(false); return }
    if (informal.some(a => normalise(a) === norm)) { setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'informal', note: q.informal_feedback }); addR(true); setIsChecking(false); return }
    const dist = levenshtein(norm, correctNorm)
    const fuzzy = dist === 1 || (dist === 2 && correctNorm.length >= 6) || alts.some(a => { const d = levenshtein(norm, normalise(a)); return d === 1 || (d === 2 && normalise(a).length >= 6) })
    if (fuzzy) { setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'fuzzy' }); addR(true); setIsChecking(false); return }
    try {
      const res = await fetch('/api/mark-gap-fill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.question, correctAnswer: q.correct_answer, studentAnswer: answer, acceptableAlternatives: alts, informalAccepted: informal }) })
      const data = await res.json()
      setFeedback({ isCorrect: data.correct, correct: q.correct_answer, type: 'ai', note: data.feedback })
      addR(data.correct)
    } catch {
      setFeedback({ isCorrect: false, correct: q.correct_answer, type: 'fail' }); addR(false)
    }
    setIsChecking(false)
  }

  const nextQuestion = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (current + 1 >= questions.length) {
      if (!sessionSaved) {
        setSessionSaved(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const sc = results.filter(r => r.isCorrect).length
          await supabase.from('topic_sessions').insert({ student_id: user.id, topic: exercise.topic, score: sc, total: questions.length, passed: sc >= passMark })
        }
      }
      setStage('finished'); return
    }
    setCurrent(c => c + 1); setFeedback(null); setUserAnswer(''); setSelected(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') { if (feedback) nextQuestion(); else checkAnswer() } }

  const q           = questions[current]
  const score       = results.filter(r => r.isCorrect).length
  const progressPct = questions.length > 0 ? (current / questions.length) * 100 : 0
  const optLabels   = ['A', 'B', 'C', 'D']

  // ============================================================
  // LEVEL SELECT — copied exactly from SentenceBuilding.jsx
  // ============================================================
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{exercise.title}</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{exercise.description}</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start practising</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0
              const available = count > 0
              const isMyLevel = level.key === suggested
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)}
                  style={{ border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: available ? 'pointer' : 'default', background: isMyLevel ? level.colourLight : available ? 'white' : '#f9fafb', opacity: available ? 1 : 0.55, transition: 'transform 0.15s ease, box-shadow 0.15s ease', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: isMyLevel ? `0 0 0 2px ${level.colour}` : 'none' }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30` } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isMyLevel ? `0 0 0 2px ${level.colour}` : 'none' }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                      <span style={{ background: available ? level.colour : '#a0aec0', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{level.sublabel}</span>
                      {isMyLevel && <span style={{ background: level.colour, color: 'white', padding: '2px 8px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700 }}>My level</span>}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>{level.description}</p>
                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem', color: available ? '#4a5568' : '#a0aec0', fontWeight: 500 }}>
                      {available ? `${count} question${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                    </span>
                  </div>
                  {available && <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>}
                </div>
              )
            })}
          </div>
          {onBack && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Back to Exercises</button>
            </div>
          )}
        </div>
      </div>
      </div>
    )
  }

  // ============================================================
  // EXERCISE SCREEN (loading / playing / finished)
  // ============================================================
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{exercise.title}</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{exercise.description}</p>
        {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

        {/* Loading */}
        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading questions...</div>}

        {/* No questions */}
        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚧</div>
            <h2 style={{ color: '#2d3748', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Questions for this level are being added.</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>← Choose Another Level</button>
          </div>
        )}

        {/* Question */}
        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Progress: {current + 1}/{questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>

            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Level/type badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                {q.level && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8', color: q.level.startsWith('A') ? '#276749' : q.level.startsWith('B') ? '#2b6cb0' : '#c05621' }}>{q.level}</div>}
                <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, background: q.type === 'multiple_choice' ? '#ebf8ff' : '#faf5ff', color: q.type === 'multiple_choice' ? '#2b6cb0' : '#6b46c1' }}>
                  {q.type === 'multiple_choice' ? '📝 Multiple Choice' : '✏️ Gap Fill'}
                </div>
              </div>

              {/* Question text */}
              <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', color: '#2d3748', lineHeight: 1.6, marginBottom: '1.25rem', fontWeight: 500 }}>
                {renderQuestion(q.question)}
              </div>

              {/* Gap fill hint */}
              {q.type === 'gap_fill' && !feedback && (
                <p style={{ fontSize: '0.78rem', color: '#a0aec0', marginBottom: '0.75rem' }}>👆 Type your answer and press Enter</p>
              )}

              {/* MC options - before answer */}
              {q.type === 'multiple_choice' && !feedback && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                  {(q.shuffledOptions || parseJsonb(q.options)).map((opt, i) => {
                    const isSel = selectedOption === opt
                    return (
                      <button key={i} onClick={() => setSelected(opt)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', border: `2px solid ${isSel ? '#667eea' : '#e2e8f0'}`, background: isSel ? '#f0f0ff' : 'white', fontSize: '0.95rem', color: '#2d3748', transition: 'all 0.15s', fontWeight: isSel ? 600 : 400 }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? '#667eea' : '#f0f0f5', color: isSel ? 'white' : '#718096', fontWeight: 700, fontSize: '0.8rem' }}>{optLabels[i]}</span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* MC options - after answer */}
              {q.type === 'multiple_choice' && feedback && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
                  {(q.shuffledOptions || parseJsonb(q.options)).map((opt, i) => {
                    const isOk  = normalise(opt) === normalise(q.correct_answer) || parseJsonb(q.acceptable_alternatives).some(a => normalise(a) === normalise(opt))
                    const wasSel = selectedOption === opt
                    let bg = 'white', border = '#e2e8f0', color = '#2d3748'
                    if (isOk) { bg = '#f0fff4'; border = '#48bb78'; color = '#276749' }
                    else if (wasSel) { bg = '#fff5f5'; border = '#fc8181'; color = '#9b2c2c' }
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: `2px solid ${border}`, background: bg, fontSize: '0.95rem', color }}>
                        <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOk ? '#48bb78' : wasSel ? '#fc8181' : '#f0f0f5', color: (isOk || wasSel) ? 'white' : '#718096', fontWeight: 700, fontSize: '0.8rem' }}>
                          {isOk ? '✓' : wasSel ? '✗' : optLabels[i]}
                        </span>
                        {opt}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Gap fill input */}
              {q.type === 'gap_fill' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <input ref={inputRef} type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={handleKeyDown} disabled={!!feedback || isChecking} placeholder="Type your answer here..."
                    style={{ width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '10px', border: `2px solid ${feedback ? (feedback.isCorrect ? '#48bb78' : '#fc8181') : '#e2e8f0'}`, outline: 'none', boxSizing: 'border-box', background: feedback ? (feedback.isCorrect ? '#f0fff4' : '#fff5f5') : 'white', color: '#2d3748' }}
                  />
                </div>
              )}

              {/* Feedback */}
              {feedback && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '1rem', background: feedback.isCorrect ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.isCorrect ? '#c6f6d5' : '#fed7d7'}` }}>
                  <div style={{ fontWeight: 700, color: feedback.isCorrect ? '#276749' : '#9b2c2c', fontSize: '0.95rem', marginBottom: '2px' }}>
                    {feedback.isCorrect ? '✅ Correct!' : `❌ Not quite — the answer is "${feedback.correct}"`}
                  </div>
                  {feedback.isCorrect && feedback.type === 'fuzzy' && <div style={{ color: '#c05621', fontSize: '0.82rem' }}>⚠️ Watch your spelling!</div>}
                  {feedback.note && feedback.type !== 'fuzzy' && <div style={{ color: '#4a5568', fontSize: '0.82rem', marginTop: '2px' }}>{feedback.note}</div>}
                </div>
              )}

              {/* Check / Next button */}
              {!feedback ? (
                <button onClick={checkAnswer} disabled={isChecking || (q.type === 'multiple_choice' ? !selectedOption : !userAnswer.trim())}
                  style={{ width: '100%', padding: '1rem', marginTop: '0.25rem', fontSize: '1rem', background: (q.type === 'multiple_choice' ? !selectedOption : !userAnswer.trim()) || isChecking ? '#e2e8f0' : 'linear-gradient(135deg, #667eea, #764ba2)', color: (q.type === 'multiple_choice' ? !selectedOption : !userAnswer.trim()) || isChecking ? '#a0aec0' : 'white', border: 'none', borderRadius: '10px', cursor: (q.type === 'multiple_choice' ? !selectedOption : !userAnswer.trim()) || isChecking ? 'not-allowed' : 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>
                  {isChecking ? '⏳ Checking...' : 'Check Answer'}
                </button>
              ) : (
                <button onClick={nextQuestion} style={{ width: '100%', padding: '1rem', marginTop: '0.75rem', fontSize: '1rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                  {current + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#a0aec0' }}>
              {score} correct so far · need {passMark} to pass
            </div>
          </>
        )}

        {/* Finished */}
        {stage === 'finished' && (() => {
          const finalScore = results.filter(r => r.isCorrect).length
          const finalPass  = finalScore >= passMark
          return (
            <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{finalScore >= 9 ? '🏆' : finalScore >= 7 ? '⭐' : finalScore >= 5 ? '👍' : '💪'}</div>
              <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: finalPass ? '#48bb78' : finalScore >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{finalScore}/{questions.length}</div>
              <p style={{ color: '#4a5568' }}>{finalScore >= 9 ? 'Outstanding! Excellent work.' : finalPass ? 'Great work! You passed.' : finalScore >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>

              {/* Review */}
              <div style={{ textAlign: 'left', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', margin: '1.25rem 0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Review</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '8px', background: r.isCorrect ? '#f0fff4' : '#fff5f5', border: `1px solid ${r.isCorrect ? '#c6f6d5' : '#fed7d7'}`, fontSize: '0.84rem' }}>
                      <span style={{ flexShrink: 0 }}>{r.isCorrect ? '✅' : '❌'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#4a5568', lineHeight: 1.4 }}>{r.question.question}</div>
                        {!r.isCorrect && <div style={{ color: '#38a169', marginTop: '3px', fontWeight: 600 }}>Answer: {r.question.correct_answer}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
                <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>
                {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
    </div>
  )
}
