import { useState, useEffect, useRef } from 'react'
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
function getSuggestedLevelGroup(userLevel) {
  const l = (userLevel || 'B1').toUpperCase()
  if (l.startsWith('A') || l === 'SPANISH') return 'A'
  if (l.startsWith('C')) return 'C'
  return 'B'
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

const GRADIENT   = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const outerStyle = { backgroundColor: '#f8f9fa', minHeight: '100vh' }
const innerStyle = { maxWidth: '800px', margin: '0 auto', padding: '1rem' }
const headerStyle = { background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', marginBottom: '1rem', color: 'white' }
const cardStyle  = { background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }

const LEVELS = [
  { group: 'A', label: 'A1 / A2', sublabel: 'Beginner',      description: 'Multiple choice questions', color: '#276749', bg: '#f0fff4', border: '#68d391' },
  { group: 'B', label: 'B1 / B2', sublabel: 'Intermediate',  description: 'Mixed question types',      color: '#2a69ac', bg: '#ebf8ff', border: '#63b3ed' },
  { group: 'C', label: 'C1 / C2', sublabel: 'Advanced',      description: 'Gap fill questions',        color: '#744210', bg: '#fffaf0', border: '#f6ad55' },
]

function LevelSelect({ exercise, userLevel, onSelect, onBack }) {
  const suggested = getSuggestedLevelGroup(userLevel)
  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        <div style={headerStyle}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>
            ← Back
          </button>
          <h1 style={{ margin: '0 0 0.3rem', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 700 }}>{exercise.title}</h1>
          <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem' }}>Choose your level to begin</p>
        </div>
        <div style={cardStyle}>
          <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
            👆 Tap a level to start your 10-question round
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {LEVELS.map(({ group, label, sublabel, description, color, bg, border }) => {
              const isMyLevel = group === suggested
              return (
                <button key={group} onClick={() => onSelect(group)} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', border: `2px solid ${isMyLevel ? color : border}`, background: isMyLevel ? bg : 'white', boxShadow: isMyLevel ? `0 0 0 2px ${border}` : 'none', transition: 'all 0.15s' }}>
                  <div style={{ minWidth: '64px', height: '48px', borderRadius: '10px', background: isMyLevel ? color : '#f0f0f5', color: isMyLevel ? 'white' : '#718096', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                    {label}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: isMyLevel ? color : '#2d3748', fontSize: '1rem' }}>{sublabel}</div>
                    <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '2px' }}>{description}</div>
                  </div>
                  {isMyLevel && (
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, background: color, color: 'white', padding: '2px 8px', borderRadius: '8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      My level
                    </span>
                  )}
                  <span style={{ color: isMyLevel ? color : '#cbd5e0', fontSize: '1.1rem', flexShrink: 0 }}>→</span>
                </button>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.78rem', margin: '1.25rem 0 0' }}>
            Score 7/10 or more to record a pass
          </p>
        </div>
      </div>
    </div>
  )
}

export default function TopicPracticeExercise({ exercise, userLevel, onBack, onComplete }) {
  const [chosenLevelGroup, setChosenLevelGroup] = useState(null)
  const [questions, setQuestions]       = useState([])
  const [loading, setLoading]           = useState(false)
  const [loadError, setLoadError]       = useState(false)
  const [current, setCurrent]           = useState(0)
  const [userAnswer, setUserAnswer]     = useState('')
  const [selectedOption, setSelected]   = useState(null)
  const [feedback, setFeedback]         = useState(null)
  const [isChecking, setIsChecking]     = useState(false)
  const [results, setResults]           = useState([])
  const [done, setDone]                 = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const inputRef = useRef(null)

  const passMark    = exercise.passing_score || 7
  const totalTarget = 10

  if (!chosenLevelGroup) {
    return <LevelSelect exercise={exercise} userLevel={userLevel} onSelect={(g) => { setChosenLevelGroup(g); fetchQuestions(g) }} onBack={onBack} />
  }

  async function fetchQuestions(levelGroup) {
    setLoading(true); setLoadError(false); setQuestions([]); setCurrent(0)
    setResults([]); setFeedback(null); setUserAnswer(''); setSelected(null)
    setDone(false); setSessionSaved(false)

    const levels = levelGroup === 'A' ? ['A1', 'A2'] : levelGroup === 'C' ? ['C1', 'C2'] : ['B1', 'B2']
    let query = supabase.from('question_bank').select('*').eq('topic', exercise.topic).in('level', levels).is('sequence_group', null)
    if (exercise.topic === 'spanish') query = query.eq('language', 'es')
    else query = query.in('language', ['en', 'both'])
    const { data, error } = await query

    if (error || !data || data.length === 0) { setLoadError(true); setLoading(false); return }

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
        const extra = fisherYates(data.filter(q => !used.has(q)))
        mcSlice = [...mcSlice, ...extra.slice(0, totalTarget - mcSlice.length - gfSlice.length)]
      }
      selected = fisherYates([...mcSlice, ...gfSlice])
    }

    const prepared = selected.map(q => q.type === 'multiple_choice' ? { ...q, shuffledOptions: fisherYates(parseJsonb(q.options)) } : q)
    setQuestions(prepared)
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const resetToLevelSelect = () => {
    setChosenLevelGroup(null); setQuestions([]); setDone(false); setResults([])
    setFeedback(null); setUserAnswer(''); setSelected(null); setSessionSaved(false)
    setCurrent(0); setLoadError(false)
  }

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
      setFeedback({ isCorrect: false, correct: q.correct_answer, type: 'fail' })
      addR(false)
    }
    setIsChecking(false)
  }

  const next = async () => {
    if (current + 1 >= questions.length) {
      if (!sessionSaved) {
        setSessionSaved(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const sc = results.filter(r => r.isCorrect).length
          await supabase.from('topic_sessions').insert({ student_id: user.id, topic: exercise.topic, score: sc, total: questions.length, passed: sc >= passMark })
        }
      }
      setDone(true); return
    }
    setCurrent(c => c + 1); setFeedback(null); setUserAnswer(''); setSelected(null)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') { if (feedback) next(); else checkAnswer() } }

  const q           = questions[current]
  const score       = results.filter(r => r.isCorrect).length
  const progressPct = questions.length > 0 ? (current / questions.length) * 100 : 0
  const levelLabel  = chosenLevelGroup === 'A' ? 'A1 / A2 · Multiple choice' : chosenLevelGroup === 'C' ? 'C1 / C2 · Gap fill' : 'B1 / B2 · Mixed'

  // Loading
  if (loading) return (
    <div style={outerStyle}><div style={innerStyle}>
      <div style={headerStyle}>
        <button onClick={resetToLevelSelect} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>← Back</button>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
      </div>
      <div style={{ ...cardStyle, textAlign: 'center', color: '#667eea', padding: '3rem' }}>Loading questions...</div>
    </div></div>
  )

  // Error
  if (loadError || questions.length === 0) return (
    <div style={outerStyle}><div style={innerStyle}>
      <div style={headerStyle}>
        <button onClick={resetToLevelSelect} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>← Back</button>
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
      </div>
      <div style={{ ...cardStyle, textAlign: 'center', color: '#718096', padding: '3rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚧</div>
        <p style={{ marginBottom: '1.5rem' }}>No questions available for this level yet. Check back soon!</p>
        <button onClick={resetToLevelSelect} style={{ background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer', fontWeight: 700 }}>← Choose level</button>
      </div>
    </div></div>
  )

  // Results
  if (done) {
    const finalScore = results.filter(r => r.isCorrect).length
    const finalPass  = finalScore >= passMark
    return (
      <div style={outerStyle}><div style={innerStyle}>
        <div style={headerStyle}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 700 }}>{exercise.title}</h1>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.9rem' }}>{levelLabel}</p>
        </div>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '50%', margin: '0 auto 1rem', background: finalPass ? '#f0fff4' : '#fff5f5', border: `4px solid ${finalPass ? '#48bb78' : '#fc8181'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: finalPass ? '#38a169' : '#e53e3e', lineHeight: 1 }}>{finalScore}</div>
              <div style={{ fontSize: '0.85rem', color: '#718096' }}>/ {questions.length}</div>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: finalPass ? '#38a169' : '#e53e3e', marginBottom: '0.25rem' }}>{finalPass ? '🎉 Passed!' : '📚 Keep practising'}</div>
            <div style={{ fontSize: '0.9rem', color: '#718096' }}>{finalPass ? `You scored ${finalScore}/${questions.length} — well done!` : `You scored ${finalScore}/${questions.length}. You need ${passMark} to pass.`}</div>
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => fetchQuestions(chosenLevelGroup)} style={{ flex: 1, padding: '12px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>🔄 Try Again</button>
            <button onClick={resetToLevelSelect} style={{ flex: 1, padding: '12px', background: '#f0f0f5', color: '#4a5568', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>⬆ Change Level</button>
            <button onClick={onBack} style={{ flex: 1, padding: '12px', background: '#f0f0f5', color: '#4a5568', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>← Exercises</button>
          </div>
        </div>
      </div></div>
    )
  }

  // Question screen
  const isMC      = q.type === 'multiple_choice'
  const opts      = isMC ? (q.shuffledOptions || parseJsonb(q.options)) : []
  const optLabels = ['A', 'B', 'C', 'D']

  return (
    <div style={outerStyle}><div style={innerStyle}>
      <div style={headerStyle}>
        <button onClick={resetToLevelSelect} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', marginBottom: '1rem', fontSize: '0.85rem' }}>← Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.25rem', fontSize: 'clamp(1.3rem,4vw,1.8rem)', fontWeight: 700 }}>{exercise.title}</h1>
            <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem' }}>{levelLabel}</p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '20px', padding: '4px 14px', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{current + 1} / {questions.length}</div>
        </div>
        <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.25)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: 'white', borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', background: isMC ? '#ebf8ff' : '#faf5ff', color: isMC ? '#2b6cb0' : '#6b46c1', padding: '3px 10px', borderRadius: '8px' }}>
            {isMC ? '📝 Multiple Choice' : '✏️ Gap Fill'}
          </span>
        </div>

        <div style={{ fontSize: 'clamp(1rem,2.5vw,1.15rem)', color: '#2d3748', lineHeight: 1.7, marginBottom: '1.5rem', fontWeight: 500, textAlign: 'center' }}>
          {renderQuestion(q.question)}
        </div>

        {!isMC && !feedback && (
          <p style={{ fontSize: '0.78rem', color: '#a0aec0', marginBottom: '0.75rem', marginTop: '-0.75rem', textAlign: 'center' }}>👆 Type your answer and press Enter</p>
        )}

        {isMC && !feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
            {opts.map((opt, i) => {
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

        {isMC && feedback && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
            {opts.map((opt, i) => {
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

        {!isMC && (
          <div style={{ marginBottom: '1.25rem' }}>
            <input ref={inputRef} type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={handleKeyDown} disabled={!!feedback || isChecking} placeholder="Type your answer here..."
              style={{ width: '100%', padding: '14px 16px', fontSize: '1rem', borderRadius: '10px', border: `2px solid ${feedback ? (feedback.isCorrect ? '#48bb78' : '#fc8181') : '#e2e8f0'}`, outline: 'none', boxSizing: 'border-box', background: feedback ? (feedback.isCorrect ? '#f0fff4' : '#fff5f5') : 'white', color: '#2d3748', textAlign: 'center' }}
            />
          </div>
        )}

        {feedback && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', marginBottom: '1.25rem', background: feedback.isCorrect ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.isCorrect ? '#c6f6d5' : '#fed7d7'}`, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: feedback.isCorrect ? '#276749' : '#9b2c2c', fontSize: '0.95rem', marginBottom: '2px' }}>
              {feedback.isCorrect ? '✅ Correct!' : `❌ Not quite — the answer is "${feedback.correct}"`}
            </div>
            {feedback.isCorrect && feedback.type === 'fuzzy' && <div style={{ color: '#c05621', fontSize: '0.82rem' }}>⚠️ Watch your spelling!</div>}
            {feedback.note && feedback.type !== 'fuzzy' && <div style={{ color: '#4a5568', fontSize: '0.82rem', marginTop: '2px' }}>{feedback.note}</div>}
          </div>
        )}

        {!feedback ? (
          <button onClick={checkAnswer} disabled={isChecking || (isMC ? !selectedOption : !userAnswer.trim())}
            style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? '#e2e8f0' : GRADIENT, color: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? '#a0aec0' : 'white', fontWeight: 700, fontSize: '1rem', cursor: (isMC ? !selectedOption : !userAnswer.trim()) || isChecking ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
            {isChecking ? '⏳ Checking...' : 'Check Answer'}
          </button>
        ) : (
          <button onClick={next} style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: GRADIENT, color: 'white', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>
            {current + 1 >= questions.length ? '📊 See Results' : 'Next Question →'}
          </button>
        )}

        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#a0aec0' }}>
          {score} correct so far · need {passMark} to pass
        </div>
      </div>
    </div></div>
  )
}
