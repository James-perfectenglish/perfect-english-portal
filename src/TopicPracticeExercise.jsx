import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Level group helper ────────────────────────────────────────────────────────
function getLevelGroup(userLevel) {
  const l = (userLevel || 'B1').toUpperCase()
  if (l.startsWith('A') || l === 'SPANISH') return 'A'
  if (l.startsWith('C')) return 'C'
  return 'B'
}

// ── Question blank renderer ───────────────────────────────────────────────────
// Splits "She _______ smoking" into ["She ", " smoking"] around the blank
function renderQuestion(text) {
  const parts = text.split('_______')
  if (parts.length === 1) return <span>{text}</span>
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span style={{
              display: 'inline-block', width: '80px', borderBottom: '2px solid #667eea',
              margin: '0 4px', verticalAlign: 'bottom'
            }} />
          )}
        </span>
      ))}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TopicPracticeExercise({ exercise, userLevel, onBack, onComplete }) {
  const [questions, setQuestions]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState(false)
  const [current, setCurrent]         = useState(0)
  const [userAnswer, setUserAnswer]   = useState('')
  const [selectedOption, setSelected] = useState(null)
  const [feedback, setFeedback]       = useState(null)   // { isCorrect, correct, type, note }
  const [isChecking, setIsChecking]   = useState(false)
  const [results, setResults]         = useState([])
  const [done, setDone]               = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const inputRef = useRef(null)

  const levelGroup  = getLevelGroup(userLevel)
  const passMark    = exercise.passing_score || 7
  const totalTarget = 10

  // ── Fetch questions ─────────────────────────────────────────────────────────
  useEffect(() => { fetchQuestions() }, [])

  const fetchQuestions = async () => {
    setLoading(true)
    setLoadError(false)

    const levels = levelGroup === 'A' ? ['A1', 'A2'] : levelGroup === 'C' ? ['C1', 'C2'] : ['B1', 'B2']

    let query = supabase
      .from('question_bank')
      .select('*')
      .eq('topic', exercise.topic)
      .in('level', levels)
      .is('sequence_group', null)

    // Spanish topic has language='es'; everything else uses 'en'/'both'
    if (exercise.topic === 'spanish') {
      query = query.eq('language', 'es')
    } else {
      query = query.in('language', ['en', 'both'])
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) {
      setLoadError(true)
      setLoading(false)
      return
    }

    let selected = []

    if (levelGroup === 'A') {
      // All multiple choice
      const mc = fisherYates(data.filter(q => q.type === 'multiple_choice'))
      selected = mc.slice(0, totalTarget)
      // If not enough MC, pad with any available questions
      if (selected.length < totalTarget) {
        const remaining = fisherYates(data.filter(q => !selected.includes(q)))
        selected = [...selected, ...remaining].slice(0, totalTarget)
      }
    } else if (levelGroup === 'C') {
      // All gap fill
      const gf = fisherYates(data.filter(q => q.type === 'gap_fill'))
      selected = gf.slice(0, totalTarget)
      if (selected.length < totalTarget) {
        const remaining = fisherYates(data.filter(q => !selected.includes(q)))
        selected = [...selected, ...remaining].slice(0, totalTarget)
      }
    } else {
      // B: 5 MC + 5 gap fill, shuffled together
      const mc = fisherYates(data.filter(q => q.type === 'multiple_choice'))
      const gf = fisherYates(data.filter(q => q.type === 'gap_fill'))
      let mcSlice = mc.slice(0, 5)
      let gfSlice = gf.slice(0, 5)
      // Top up if not enough of either type
      if (mcSlice.length + gfSlice.length < totalTarget) {
        const used = new Set([...mcSlice, ...gfSlice])
        const extra = fisherYates(data.filter(q => !used.has(q)))
        const needed = totalTarget - mcSlice.length - gfSlice.length
        mcSlice = [...mcSlice, ...extra.slice(0, needed)]
      }
      selected = fisherYates([...mcSlice, ...gfSlice])
    }

    // Shuffle MC options with Fisher-Yates
    const prepared = selected.map(q => {
      if (q.type === 'multiple_choice') {
        const opts = parseJsonb(q.options)
        return { ...q, shuffledOptions: fisherYates(opts) }
      }
      return q
    })

    setQuestions(prepared)
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Check answer ────────────────────────────────────────────────────────────
  const checkAnswer = async () => {
    const q = questions[current]
    if (!q || isChecking) return
    if (q.type === 'multiple_choice') {
      if (!selectedOption) return
      checkMC(q, selectedOption)
    } else {
      if (!userAnswer.trim()) return
      await checkGapFill(q, userAnswer.trim())
    }
  }

  const checkMC = (q, selected) => {
    const norm = normalise(selected)
    const correct = normalise(q.correct_answer) === norm
    const alts = parseJsonb(q.acceptable_alternatives)
    const altCorrect = alts.some(a => normalise(a) === norm)
    const isCorrect = correct || altCorrect
    setFeedback({ isCorrect, correct: q.correct_answer, type: 'mc' })
    addResult(q, isCorrect)
  }

  const checkGapFill = async (q, answer) => {
    setIsChecking(true)
    const norm = normalise(answer)
    const correctNorm = normalise(q.correct_answer)
    const alts = parseJsonb(q.acceptable_alternatives)
    const informal = parseJsonb(q.informal_accepted)

    // 1. Exact match
    if (norm === correctNorm) {
      setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'exact' })
      addResult(q, true); setIsChecking(false); return
    }
    // 2. Acceptable alternatives
    if (alts.some(a => normalise(a) === norm)) {
      setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'alternative' })
      addResult(q, true); setIsChecking(false); return
    }
    // 3. Informal accepted
    if (informal.some(a => normalise(a) === norm)) {
      setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'informal', note: q.informal_feedback })
      addResult(q, true); setIsChecking(false); return
    }
    // 4. Fuzzy match (Levenshtein)
    const dist = levenshtein(norm, correctNorm)
    const fuzzyMain = dist === 1 || (dist === 2 && correctNorm.length >= 6)
    const fuzzyAlt  = alts.some(a => {
      const an = normalise(a)
      const d  = levenshtein(norm, an)
      return d === 1 || (d === 2 && an.length >= 6)
    })
    if (fuzzyMain || fuzzyAlt) {
      setFeedback({ isCorrect: true, correct: q.correct_answer, type: 'fuzzy', note: 'Watch your spelling!' })
      addResult(q, true); setIsChecking(false); return
    }
    // 5. AI marking
    try {
      const res = await fetch('/api/mark-gap-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          correctAnswer: q.correct_answer,
          studentAnswer: answer,
          acceptableAlternatives: alts,
          informalAccepted: informal,
        })
      })
      const data = await res.json()
      if (data.correct) {
        setFeedback({ isCorrect: true,  correct: q.correct_answer, type: 'ai', note: data.feedback })
        addResult(q, true)
      } else {
        setFeedback({ isCorrect: false, correct: q.correct_answer, type: 'ai', note: data.feedback })
        addResult(q, false)
      }
    } catch {
      setFeedback({ isCorrect: false, correct: q.correct_answer, type: 'fail' })
      addResult(q, false)
    }
    setIsChecking(false)
  }

  const addResult = (q, isCorrect) => {
    setResults(prev => [...prev, { question: q, isCorrect }])
  }

  // ── Next question ───────────────────────────────────────────────────────────
  const next = async () => {
    if (current + 1 >= questions.length) {
      await saveSession()
      setDone(true)
      return
    }
    setCurrent(c => c + 1)
    setFeedback(null)
    setUserAnswer('')
    setSelected(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // ── Save session ────────────────────────────────────────────────────────────
  const saveSession = async () => {
    if (sessionSaved) return
    setSessionSaved(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const score  = results.filter(r => r.isCorrect).length
    const total  = questions.length
    const passed = score >= passMark
    await supabase.from('topic_sessions').insert({
      student_id:   user.id,
      topic:        exercise.topic,
      score,
      total,
      passed,
    })
  }

  // ── Key handler ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (feedback) next()
      else checkAnswer()
    }
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const q           = questions[current]
  const score       = results.filter(r => r.isCorrect).length
  const passed      = score >= passMark
  const progressPct = questions.length > 0 ? ((current) / questions.length) * 100 : 0

  // ── Styles ──────────────────────────────────────────────────────────────────
  const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

  const outerStyle = {
    backgroundColor: '#f8f9fa', minHeight: '100vh',
  }
  const innerStyle = {
    maxWidth: '800px', margin: '0 auto', padding: '1rem',
  }
  const headerStyle = {
    background: GRADIENT, borderRadius: '12px',
    padding: '2.5rem 2rem 2rem', marginBottom: '1rem', color: 'white',
  }
  const cardStyle = {
    background: 'white', padding: '2rem', borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={outerStyle}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>
              ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', color: '#667eea', padding: '3rem' }}>
            Loading questions...
          </div>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (loadError || questions.length === 0) {
    return (
      <div style={outerStyle}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>
              ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
          </div>
          <div style={{ ...cardStyle, textAlign: 'center', color: '#718096', padding: '3rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚧</div>
            <p style={{ marginBottom: '1.5rem' }}>No questions available yet for your level. Check back soon!</p>
            <button onClick={onBack} style={{ background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontWeight: 700 }}>
              ← Back to exercises
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results screen ──────────────────────────────────────────────────────────
  if (done) {
    const finalScore = results.filter(r => r.isCorrect).length
    const finalPass  = finalScore >= passMark
    return (
      <div style={outerStyle}>
        <div style={innerStyle}>
          <div style={headerStyle}>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
            <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.95rem' }}>Results</p>
          </div>
          <div style={cardStyle}>
            {/* Score circle */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 1rem',
                background: finalPass ? '#f0fff4' : '#fff5f5',
                border: `4px solid ${finalPass ? '#48bb78' : '#fc8181'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: finalPass ? '#38a169' : '#e53e3e', lineHeight: 1 }}>
                  {finalScore}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#718096' }}>/ {questions.length}</div>
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: finalPass ? '#38a169' : '#e53e3e', marginBottom: '0.25rem' }}>
                {finalPass ? '🎉 Passed!' : '📚 Keep practising'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#718096' }}>
                {finalPass
                  ? `You scored ${finalScore}/${questions.length} — well done!`
                  : `You scored ${finalScore}/${questions.length}. You need ${passMark} to pass.`}
              </div>
            </div>

            {/* Question review */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                Review
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {results.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    padding: '10px 12px', borderRadius: '8px',
                    background: r.isCorrect ? '#f0fff4' : '#fff5f5',
                    border: `1px solid ${r.isCorrect ? '#c6f6d5' : '#fed7d7'}`,
                    fontSize: '0.84rem',
                  }}>
                    <span style={{ flexShrink: 0, fontSize: '1rem' }}>{r.isCorrect ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#4a5568', lineHeight: 1.4 }}>{r.question.question}</div>
                      {!r.isCorrect && (
                        <div style={{ color: '#38a169', marginTop: '3px', fontWeight: 600 }}>
                          Answer: {r.question.correct_answer}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setDone(false); setCurrent(0); setResults([]); setFeedback(null)
                  setUserAnswer(''); setSelected(null); setSessionSaved(false)
                  fetchQuestions()
                }}
                style={{ flex: 1, padding: '12px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                🔄 Try Again
              </button>
              <button
                onClick={onBack}
                style={{ flex: 1, padding: '12px', background: '#f0f0f5', color: '#4a5568', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}
              >
                ← Back to Exercises
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Question screen ─────────────────────────────────────────────────────────
  const isMC      = q.type === 'multiple_choice'
  const opts      = isMC ? (q.shuffledOptions || parseJsonb(q.options)) : []
  const optLabels = ['A', 'B', 'C', 'D']

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h1 style={{ margin: '0 0 0.25rem', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 700 }}>
                {exercise.title}
              </h1>
              <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem' }}>
                {levelGroup === 'A' ? 'Multiple choice' : levelGroup === 'C' ? 'Gap fill' : 'Mixed question types'}
              </p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '4px 14px', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {current + 1} / {questions.length}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.25)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'white', borderRadius: '4px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Question card */}
        <div style={cardStyle}>
          {/* Type badge */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{
              fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase',
              background: isMC ? '#ebf8ff' : '#faf5ff', color: isMC ? '#2b6cb0' : '#6b46c1',
              padding: '3px 10px', borderRadius: '8px',
            }}>
              {isMC ? '📝 Multiple Choice' : '✏️ Gap Fill'}
            </span>
          </div>

          {/* Question text */}
          <div style={{ fontSize: 'clamp(1rem,2.5vw,1.15rem)', color: '#2d3748', lineHeight: 1.6, marginBottom: '1.5rem', fontWeight: 500 }}>
            {isMC ? renderQuestion(q.question) : renderQuestion(q.question)}
          </div>

          {/* Gap fill hint */}
          {!isMC && !feedback && (
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', marginBottom: '0.75rem', marginTop: '-0.75rem' }}>
              👆 Type your answer and press Enter
            </p>
          )}

          {/* MC options */}
          {isMC && !feedback && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
              {opts.map((opt, i) => {
                const isSelected = selectedOption === opt
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(opt)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${isSelected ? '#667eea' : '#e2e8f0'}`,
                      background: isSelected ? '#f0f0ff' : 'white',
                      fontSize: '0.95rem', color: '#2d3748', transition: 'all 0.15s',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <span style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isSelected ? '#667eea' : '#f0f0f5',
                      color: isSelected ? 'white' : '#718096',
                      fontWeight: 700, fontSize: '0.8rem',
                    }}>
                      {optLabels[i]}
                    </span>
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {/* MC options — post-feedback (show correct/incorrect highlighting) */}
          {isMC && feedback && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
              {opts.map((opt, i) => {
                const isCorrectOpt = normalise(opt) === normalise(q.correct_answer) ||
                  parseJsonb(q.acceptable_alternatives).some(a => normalise(a) === normalise(opt))
                const wasSelected  = selectedOption === opt
                let bg = 'white', border = '#e2e8f0', color = '#2d3748'
                if (isCorrectOpt) { bg = '#f0fff4'; border = '#48bb78'; color = '#276749' }
                else if (wasSelected && !isCorrectOpt) { bg = '#fff5f5'; border = '#fc8181'; color = '#9b2c2c' }
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: `2px solid ${border}`, background: bg, fontSize: '0.95rem', color }}>
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCorrectOpt ? '#48bb78' : wasSelected ? '#fc8181' : '#f0f0f5', color: (isCorrectOpt || (wasSelected && !isCorrectOpt)) ? 'white' : '#718096', fontWeight: 700, fontSize: '0.8rem' }}>
                      {isCorrectOpt ? '✓' : wasSelected ? '✗' : optLabels[i]}
                    </span>
                    {opt}
                  </div>
                )
              })}
            </div>
          )}

          {/* Gap fill input */}
          {!isMC && (
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                ref={inputRef}
                type="text"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!!feedback || isChecking}
                placeholder="Type your answer here..."
                style={{
                  width: '100%', padding: '14px 16px', fontSize: '1rem',
                  borderRadius: '10px', border: `2px solid ${feedback ? (feedback.isCorrect ? '#48bb78' : '#fc8181') : '#e2e8f0'}`,
                  outline: 'none', boxSizing: 'border-box',
                  background: feedback ? (feedback.isCorrect ? '#f0fff4' : '#fff5f5') : 'white',
                  color: '#2d3748',
                }}
              />
            </div>
          )}

          {/* Feedback banner */}
          {feedback && (
            <div style={{
              padding: '12px 16px', borderRadius: '10px', marginBottom: '1.25rem',
              background: feedback.isCorrect ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${feedback.isCorrect ? '#c6f6d5' : '#fed7d7'}`,
            }}>
              <div style={{ fontWeight: 700, color: feedback.isCorrect ? '#276749' : '#9b2c2c', fontSize: '0.95rem', marginBottom: '2px' }}>
                {feedback.isCorrect ? '✅ Correct!' : `❌ Not quite — the answer is "${feedback.correct}"`}
              </div>
              {feedback.isCorrect && feedback.type === 'fuzzy' && (
                <div style={{ color: '#c05621', fontSize: '0.82rem' }}>⚠️ Watch your spelling!</div>
              )}
              {feedback.note && feedback.type !== 'fuzzy' && (
                <div style={{ color: '#4a5568', fontSize: '0.82rem', marginTop: '2px' }}>{feedback.note}</div>
              )}
            </div>
          )}

          {/* Action button */}
          {!feedback ? (
            <button
              onClick={checkAnswer}
              disabled={isChecking || (isMC ? !selectedOption : !userAnswer.trim())}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? '#e2e8f0' : GRADIENT,
                color: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? '#a0aec0' : 'white',
                fontWeight: 700, fontSize: '1rem', cursor: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {isChecking ? '⏳ Checking...' : 'Check Answer'}
            </button>
          ) : (
            <button
              onClick={next}
              style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: GRADIENT, color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}
            >
              {current + 1 >= questions.length ? '📊 See Results' : 'Next Question →'}
            </button>
          )}

          {/* Score tracker */}
          <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#a0aec0' }}>
            {score} correct so far · need {passMark} to pass
          </div>
        </div>
      </div>
    </div>
  )
}
