import { useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { LevelBadge, TypeBadge, AiMarkedBadge, TagBadges } from './components/BadgePill'
import SentenceChallenge from './components/SentenceChallenge'
import FlagQuestion from './components/FlagQuestion'

function shuffleArray(arr) {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

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

function parseJsonb(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return [] }
}

// ── Hint masking helpers (for staged gap fill hints) ──
// L3 only: first letter of every word + last letter + one extra random middle letter
// from the longest word (only if longest word ≥ 7 letters).
// e.g. "overexpansion" → "O _ _ _ _ _ _ _ _ _ _ _ N" or with middle "O _ _ _ X _ _ _ _ _ _ _ N".
function maskRevealStage3(answer, randomIndex) {
  if (!answer) return ''
  const words = answer.split(' ')
  let longestIdx = 0
  for (let i = 1; i < words.length; i++) {
    if (words[i].length > words[longestIdx].length) longestIdx = i
  }
  const longestLen = words[longestIdx].length
  const showMiddle = longestLen >= 7
  return words.map((word, wIdx) => {
    // Find first and last letter positions (skipping non-letters at edges).
    let firstLetterIdx = -1, lastLetterIdx = -1
    for (let i = 0; i < word.length; i++) {
      if (/[a-zA-ZÀ-ÿ]/.test(word[i])) { firstLetterIdx = i; break }
    }
    for (let i = word.length - 1; i >= 0; i--) {
      if (/[a-zA-ZÀ-ÿ]/.test(word[i])) { lastLetterIdx = i; break }
    }
    return word.split('').map((ch, cIdx) => {
      const isLetter = /[a-zA-ZÀ-ÿ]/.test(ch)
      if (!isLetter) return ch
      if (cIdx === firstLetterIdx) return ch
      if (cIdx === lastLetterIdx)  return ch
      if (showMiddle && wIdx === longestIdx && cIdx === randomIndex) return ch
      return '_'
    }).join(' ')
  }).join('   ')
}

// L2 plain-text shape clue: letter count + first letter of the longest word.
// e.g. "overexpansion" → "13 letters, starts with O"
// e.g. "cost benefit" → "two words; longest 7 letters, starts with B"
function shapeClue(answer) {
  if (!answer) return ''
  const words = answer.split(' ').filter(Boolean)
  if (words.length === 0) return ''
  const longest = words.reduce((a, b) => b.length > a.length ? b : a)
  // First actual letter (skip leading non-letters)
  const firstLetter = (longest.match(/[a-zA-ZÀ-ÿ]/) || [''])[0].toUpperCase()
  if (words.length === 1) {
    return `${longest.length} letters, starts with ${firstLetter}.`
  }
  return `${words.length} words; longest is ${longest.length} letters, starts with ${firstLetter}.`
}

function formatTitle(title) {
  // Match trailing emoji including flags (regional indicators), variation selectors, and standard emoji ranges
  const match = title.match(/^(.*?)\s*([\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]+)$/u)
  if (match) return match[2] + ' ' + match[1].trim()
  return title
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
            <span style={{ display: 'inline-block', width: '80px', borderBottom: '2px solid #a0aec0', margin: '0 4px', verticalAlign: 'bottom' }} />
          )}
        </span>
      ))}
    </span>
  )
}

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

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

function getSuggestedLevel(userLevel) {
  const l = (userLevel || 'B1').toUpperCase()
  if (l.startsWith('A') || l === 'SPANISH') return 'beginner'
  if (l.startsWith('C')) return 'advanced'
  return 'intermediate'
}

// ── Sentence challenge helpers ──
const STOP_WORDS_TP = new Set([
  'a','an','the','in','on','at','to','for','of','and','or','but','is','are','was','were',
  'be','been','have','has','had','do','does','did','will','would','could','should','may',
  'might','must','can','it','he','she','they','we','i','you','my','his','her','their',
  'our','your','its','this','that','these','those','not','no','so','as','by','up','out',
  'off','if','than','then','with','from','into','about','over','after','before','just',
  'very','too','also','back','more','some','all','one','two','got',
])

// Spanish stop words — avoid picking metalanguage about the exercise
const STOP_WORDS_ES = new Set([
  'cuál','cuáles','qué','cómo','dónde','cuándo','una','uno','los','las','del',
  'para','con','esta','este','estos','estas','elige','frase','frases','correcta',
  'correcto','correctas','correctos','significa','elige','entre','opción',
  'opciones','cuál','cual','estas','estos','verbo','frase','palabra','oración',
  'uso','ejemplo','respuesta','forma','diferencia','orden','expresión',
])

function getChallengeWordTP(question) {
  if (!question) return null
  const sourceText = question.correct_answer || ''
  if (!sourceText) return null
  const rawWords = sourceText.split(/\s+/).map(w => w.replace(/[.,!?;:'"()]/g, '')).filter(Boolean)
  const words = rawWords.map(w => w.toLowerCase())
  const candidates = rawWords.filter((w, i) => words[i].length > 3 && !STOP_WORDS_TP.has(words[i]))
  if (candidates.length === 0) return rawWords.find((w, i) => words[i].length > 2) || null
  return candidates.sort((a, b) => b.length - a.length)[0] || null
}

// For Spanish TP MC questions: extract the key Spanish word from the question text.
// MC correct_answers may be in English (translation questions), so we look at the question text.
function getChallengeWordSpanishMC(question) {
  if (!question) return null
  const text = question.question || ''

  // 1. Try quoted text (e.g. "el desayuno", 'estar', "Ayer _____ mucho calor")
  const quotedMatches = [...text.matchAll(/["'\u201c\u201d\u00ab\u00bb]([^"'\u201c\u201d\u00ab\u00bb]+)["'\u201c\u201d\u00ab\u00bb]/g)]
  for (const m of quotedMatches) {
    const words = m[1].split(/\s+/).map(w => w.replace(/[.,!?;:_¿¡]/g, '')).filter(Boolean)
    // Pick the longest word that isn't a stop word or blank placeholder
    const candidates = words.filter(w => w.length > 3 && !STOP_WORDS_ES.has(w.toLowerCase()) && !STOP_WORDS_TP.has(w.toLowerCase()) && !/^_+$/.test(w))
    if (candidates.length > 0) return candidates.sort((a, b) => b.length - a.length)[0]
  }

  // 2. Fall back: pick longest meaningful word from question text
  const rawWords = text.split(/\s+/).map(w => w.replace(/[.,!?;:'"()¿¡_]/g, '')).filter(Boolean)
  const candidates = rawWords.filter(w => w.length > 4 && !STOP_WORDS_ES.has(w.toLowerCase()) && !STOP_WORDS_TP.has(w.toLowerCase()))
  if (candidates.length > 0) return candidates.sort((a, b) => b.length - a.length)[0]

  return null
}

export default function TopicPracticeExercise({ exercise, userLevel, onBack, onComplete }) {
  const [stage, setStage]               = useState('level-select')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [questionCounts, setQuestionCounts] = useState({})
  const [questions, setQuestions]       = useState([])
  const [currentQ, setCurrentQ]         = useState(0)
  const [score, setScore]               = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [userAnswer, setUserAnswer]     = useState('')
  const [feedback, setFeedback]         = useState(null)
  const [isChecking, setIsChecking]     = useState(false)
  const [results, setResults]           = useState([])
  const [sessionSaved, setSessionSaved] = useState(false)
  const inputRef = useRef(null)

  // ── Hint state ──
  // hintLevel: 0 = none shown, 1 = L1 text hint, 2 = L2 (hint2 OR word class) + letter pattern, 3 = first letter + random letter
  // hintRandomIdx: position within the longest word to reveal at L3 (set when L3 is triggered)
  // autoHintShown: true if hint auto-revealed after a wrong answer (not counted as "used")
  const [hintLevel, setHintLevel]           = useState(0)
  const [hintRandomIdx, setHintRandomIdx]   = useState(null)
  const [autoHintShown, setAutoHintShown]   = useState(false)

  // ── Sentence challenge ──
  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeWord, setChallengeWord] = useState('')
  const challengePositionsRef = useRef([])
  const challengeFiredRef = useRef(false)

  const passMark    = exercise.passing_score || 7
  const totalTarget = 10
  const suggested   = getSuggestedLevel(userLevel)

  const isSpanishTP = exercise.topic === 'spanish'

  useState(() => {
    if (isSpanishTP) {
      // Spanish TP: skip level select, go straight to loading
      setStage('loading')
      fetchQuestionsSpanish()
    } else {
      fetchCounts()
    }
  }, [])

  async function fetchCounts() {
    let query = supabase.from('question_bank').select('level').eq('topic', exercise.topic).is('sequence_group', null)
    query = query.in('language', ['en', 'both'])
    const { data } = await query
    if (data) {
      const counts = {}
      LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length })
      setQuestionCounts(counts)
    }
  }

  async function fetchQuestionsSpanish() {
    setCurrentQ(0); setScore(0); setResults([]); setFeedback(null)
    setUserAnswer(''); setSelectedOption(null); setSessionSaved(false)
    setHintLevel(0); setHintRandomIdx(null); setAutoHintShown(false)

    const { data, error } = await supabase
      .from('question_bank')
      .select('*')
      .eq('topic', 'spanish')
      .eq('language', 'es')
      .in('type', ['multiple_choice', 'gap_fill'])
      .is('sequence_group', null)

    if (error || !data || data.length === 0) { setStage('playing'); setQuestions([]); return }

    const mc = shuffleArray(data.filter(q => q.type === 'multiple_choice'))
    const gf = shuffleArray(data.filter(q => q.type === 'gap_fill'))
    // Aim for 5+5; if either type is short, fill from the other
    let mcSlice = mc.slice(0, 5)
    let gfSlice = gf.slice(0, 5)
    if (mcSlice.length + gfSlice.length < totalTarget) {
      const used = new Set([...mcSlice, ...gfSlice])
      const spare = shuffleArray(data.filter(q => !used.has(q)))
      const needed = totalTarget - mcSlice.length - gfSlice.length
      gfSlice = [...gfSlice, ...spare.slice(0, needed)]
    }
    const selected = shuffleArray([...mcSlice, ...gfSlice])
    const prepared = selected.map(q => q.type === 'multiple_choice' ? { ...q, shuffledOptions: shuffleArray(parseJsonb(q.options)) } : q)
    setQuestions(prepared)
    const eligibleIdx = prepared.map((q, i) => i).filter(i => i > 0 && i < prepared.length - 1)
    challengePositionsRef.current = eligibleIdx.length > 0 ? [eligibleIdx[Math.floor(Math.random() * eligibleIdx.length)]] : []
    challengeFiredRef.current = false
    setShowChallenge(false)
    setStage('playing')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return
    setSelectedLevel(level)
    setStage('loading')
    fetchQuestions(level)
  }

  async function fetchQuestions(level) {
    setCurrentQ(0); setScore(0); setResults([]); setFeedback(null)
    setUserAnswer(''); setSelectedOption(null); setSessionSaved(false)
    setHintLevel(0); setHintRandomIdx(null); setAutoHintShown(false)

    let query = supabase.from('question_bank').select('*').eq('topic', exercise.topic).in('level', level.dbLevels).is('sequence_group', null)
    query = query.in('language', ['en', 'both'])
    const { data, error } = await query

    if (error || !data || data.length === 0) { setStage('playing'); setQuestions([]); return }

    const g = level.group
    let selected = []
    if (g === 'A') {
      const mc = shuffleArray(data.filter(q => q.type === 'multiple_choice'))
      selected = mc.slice(0, totalTarget)
      if (selected.length < totalTarget) selected = [...selected, ...shuffleArray(data.filter(q => !selected.includes(q)))].slice(0, totalTarget)
    } else if (g === 'C') {
      const gf = shuffleArray(data.filter(q => q.type === 'gap_fill'))
      selected = gf.slice(0, totalTarget)
      if (selected.length < totalTarget) selected = [...selected, ...shuffleArray(data.filter(q => !selected.includes(q)))].slice(0, totalTarget)
    } else {
      const mc = shuffleArray(data.filter(q => q.type === 'multiple_choice'))
      const gf = shuffleArray(data.filter(q => q.type === 'gap_fill'))
      let mcSlice = mc.slice(0, 5), gfSlice = gf.slice(0, 5)
      if (mcSlice.length + gfSlice.length < totalTarget) {
        const used = new Set([...mcSlice, ...gfSlice])
        mcSlice = [...mcSlice, ...shuffleArray(data.filter(q => !used.has(q))).slice(0, totalTarget - mcSlice.length - gfSlice.length)]
      }
      selected = shuffleArray([...mcSlice, ...gfSlice])
    }

    const prepared = selected.map(q => q.type === 'multiple_choice' ? { ...q, shuffledOptions: shuffleArray(parseJsonb(q.options)) } : q)
    setQuestions(prepared)
    // Pick 1 random challenge position (skip first and last, skip matching type)
    const eligibleIdx = prepared
      .map((q, i) => i)
      .filter(i => prepared[i]?.type !== 'matching' && i > 0 && i < prepared.length - 1)
    challengePositionsRef.current = eligibleIdx.length > 0
      ? [eligibleIdx[Math.floor(Math.random() * eligibleIdx.length)]]
      : []
    challengeFiredRef.current = false
    setShowChallenge(false)
    setStage('playing')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setSelectedLevel(null); setQuestions([]); setCurrentQ(0); setScore(0)
    setFeedback(null); setUserAnswer(''); setSelectedOption(null)
    setHintLevel(0); setHintRandomIdx(null); setAutoHintShown(false)
    setShowChallenge(false); challengeFiredRef.current = false; challengePositionsRef.current = []
    if (isSpanishTP) { setStage('loading'); fetchQuestionsSpanish() }
    else { setStage('level-select'); fetchCounts() }
  }

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    setStage('loading')
    if (isSpanishTP) fetchQuestionsSpanish()
    else fetchQuestions(selectedLevel)
  }

  const checkAnswer = async () => {
    const q = questions[currentQ]
    if (!q || isChecking) return
    if (q.type === 'multiple_choice') { if (!selectedOption) return; checkMC(q, selectedOption) }
    else { if (!userAnswer.trim()) return; await checkGapFill(q, userAnswer.trim()) }
  }

  const checkMC = (q, sel) => {
    const norm = normalise(sel)
    const alts = parseJsonb(q.acceptable_alternatives)
    const altNorms = alts.map(a => normalise(typeof a === 'object' ? a.answer : a))
    const isCorrect = normalise(q.correct_answer) === norm || altNorms.includes(norm)
    const usedHint = hintLevel > 0
    const pointAwarded = isCorrect && hintLevel < 3
    // Auto-reveal hint after wrong answer (only if not already revealed)
    if (!isCorrect && hintLevel === 0 && q.hint) setAutoHintShown(true)
    setFeedback({ isCorrect, correct: q.correct_answer, type: 'mc', usedHint, pointAwarded })
    setResults(prev => [...prev, { question: q, isCorrect: pointAwarded }])
    if (pointAwarded) setScore(s => s + 1)
  }

  const checkGapFill = async (q, answer) => {
    setIsChecking(true)
    const norm = normalise(answer), correctNorm = normalise(q.correct_answer)
    const alts = parseJsonb(q.acceptable_alternatives), informal = parseJsonb(q.informal_accepted)
    // acceptable_alternatives can be [{answer, feedback}] objects or plain strings
    const altNorms = alts.map(a => normalise(typeof a === 'object' ? a.answer : a))
    const altFeedback = (norm) => { const match = alts.find(a => normalise(typeof a === 'object' ? a.answer : a) === norm); return match?.feedback || null }
    const usedHint = hintLevel > 0
    const finish = (isCorrect, fb) => {
      const pointAwarded = isCorrect && hintLevel < 3
      // Auto-reveal hint after wrong answer (only if not already revealed)
      if (!isCorrect && hintLevel === 0 && q.hint) setAutoHintShown(true)
      setFeedback({ ...fb, isCorrect, usedHint, pointAwarded })
      setResults(prev => [...prev, { question: q, isCorrect: pointAwarded }])
      if (pointAwarded) setScore(s => s + 1)
      setIsChecking(false)
    }

    if (norm === correctNorm) { finish(true, { correct: q.correct_answer, type: 'exact' }); return }
    if (altNorms.includes(norm)) { finish(true, { correct: q.correct_answer, type: 'alternative', note: altFeedback(norm) }); return }
    if (informal.some(a => normalise(a) === norm)) { finish(true, { correct: q.correct_answer, type: 'informal', note: q.informal_feedback }); return }
    const dist = levenshtein(norm, correctNorm)
    const fuzzy = (correctNorm.length > 3 && dist === 1) || (dist === 2 && correctNorm.length >= 6) || altNorms.some(an => { const d = levenshtein(norm, an); return (an.length > 3 && d === 1) || (d === 2 && an.length >= 6) })
    if (fuzzy) { finish(true, { correct: q.correct_answer, type: 'fuzzy' }); return }
    try {
      const res = await fetch('/api/mark-gap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'gap_fill', question: q.question, correctAnswer: q.correct_answer, studentAnswer: answer, acceptableAlternatives: alts, informalAccepted: informal }) })
      const data = await res.json()
      finish(data.valid, { correct: q.correct_answer, type: 'ai', note: data.reason })
    } catch {
      finish(false, { correct: q.correct_answer, type: 'fail' })
    }
  }

  const doAdvance = async () => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (currentQ + 1 >= questions.length) {
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
    setCurrentQ(c => c + 1); setFeedback(null); setUserAnswer(''); setSelectedOption(null)
    setHintLevel(0); setHintRandomIdx(null); setAutoHintShown(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const nextQuestion = async () => {
    if (
      !challengeFiredRef.current &&
      challengePositionsRef.current.includes(currentQ)
    ) {
      // For Spanish TP: use question-text extraction for MC (avoids English correct_answers).
      // For gap_fill the correct_answer is always Spanish so use the standard picker.
      const word = (isSpanishTP && questions[currentQ]?.type === 'multiple_choice')
        ? getChallengeWordSpanishMC(questions[currentQ])
        : getChallengeWordTP(questions[currentQ])
      if (word) {
        challengeFiredRef.current = true
        setChallengeWord(word)
        setShowChallenge(true)
        return
      }
    }
    doAdvance()
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter') { if (feedback) nextQuestion(); else checkAnswer() } }

  const q = questions[currentQ]

  // ── LEVEL SELECT — copied exactly from ErrorCorrection.jsx ───────────────────
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{formatTitle(exercise.title)}</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{exercise.description}</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start practising</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0
              const available = count > 0
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)} style={{
                  border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem',
                  cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb',
                  opacity: available ? 1 : 0.55, transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  
                }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30` } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                      <span style={{ background: available ? level.colour : '#a0aec0', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{level.sublabel}</span>
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

  // ── EXERCISE — copied exactly from ErrorCorrection.jsx ───────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{formatTitle(exercise.title)}</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{exercise.description}</p>
        {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading questions...</div>}

        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Questions for this level are being added. Check back soon!</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Choose Another Level</button>
          </div>
        )}

        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Progress: {currentQ + 1}/{questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>

            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              {/* badges + stuck? button */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                  <LevelBadge level={q.level} />
                  <TypeBadge type={q.type} />
                  {q.type === 'gap_fill' && <AiMarkedBadge />}
                  <TagBadges tags={q.tags} />
                </div>
                {q.hint && !feedback && (() => {
                  // MC: single stage hint. Gap fill: 3 stages.
                  const maxLevel = q.type === 'multiple_choice' ? 1 : 3
                  const canPress = hintLevel < maxLevel
                  const label = q.type === 'multiple_choice'
                    ? (hintLevel === 0 ? '🤔?' : '🤔')
                    : `🤔? ${hintLevel}/${maxLevel}`
                  const advanceHint = () => {
                    if (!canPress) return
                    const newLevel = hintLevel + 1
                    setHintLevel(newLevel)
                    // When reaching L3, pick a random *middle* letter index from the longest word
                    // (skipping the first and last letters — those are revealed unconditionally).
                    if (newLevel === 3 && q.correct_answer) {
                      const words = q.correct_answer.split(' ')
                      let longest = words[0]
                      for (const w of words) if (w.length > longest.length) longest = w
                      // Find first/last letter positions to exclude.
                      let first = -1, last = -1
                      for (let i = 0; i < longest.length; i++) {
                        if (/[a-zA-ZÀ-ÿ]/.test(longest[i])) { first = i; break }
                      }
                      for (let i = longest.length - 1; i >= 0; i--) {
                        if (/[a-zA-ZÀ-ÿ]/.test(longest[i])) { last = i; break }
                      }
                      // Eligible middle letters — only matters for words ≥ 7 letters.
                      const middlePositions = []
                      for (let i = first + 1; i < last; i++) {
                        if (/[a-zA-ZÀ-ÿ]/.test(longest[i])) middlePositions.push(i)
                      }
                      if (middlePositions.length > 0 && longest.length >= 7) {
                        setHintRandomIdx(middlePositions[Math.floor(Math.random() * middlePositions.length)])
                      } else {
                        setHintRandomIdx(null)
                      }
                    }
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                      <button
                        onClick={advanceHint}
                        disabled={!canPress}
                        title={canPress ? 'Stuck?' : 'No more hints'}
                        style={{
                          background: canPress ? '#EDE9FE' : '#f7fafc',
                          color: canPress ? '#553C9A' : '#a0aec0',
                          border: `1px solid ${canPress ? '#c4b5fd' : '#e2e8f0'}`,
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: canPress ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                        }}
                      >{label}</button>
                      {/* Cost warning: about to commit the costly L3 reveal */}
                      {q.type === 'gap_fill' && hintLevel === 2 && (
                        <span style={{ fontSize: '0.7rem', color: '#a0aec0', fontStyle: 'italic' }}>
                          next hint costs the point
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* Hint reveal box (shown if any hint level revealed and question not yet answered) */}
              {q.hint && hintLevel > 0 && !feedback && (
                <div style={{ background: '#EDE9FE', border: '1px solid #c4b5fd', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#553C9A', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <div>💡 {q.hint}</div>
                  {/* L2: a second text hint OR word-class note, plus a plain-text shape clue. */}
                  {hintLevel >= 2 && (
                    <>
                      {q.hint2 && (
                        <div style={{ marginTop: '0.5rem' }}>💡 {q.hint2}</div>
                      )}
                      <div style={{ marginTop: '0.5rem' }}>
                        💡 {q.hint_word_class && !q.hint2
                          ? `It's ${/^[aeiou]/i.test(q.hint_word_class) ? 'an' : 'a'} ${q.hint_word_class}. `
                          : ''}{shapeClue(q.correct_answer)}
                      </div>
                    </>
                  )}
                  {/* L3: dashed pattern with first + last + middle letter — the costly reveal. */}
                  {hintLevel >= 3 && (
                    <div style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.1em' }}>
                      {maskRevealStage3(q.correct_answer, hintRandomIdx)}
                    </div>
                  )}
                  {hintLevel === 3 && (
                    <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', opacity: 0.8 }}>
                      (This one's a freebie — the answer's almost there for you.)
                    </div>
                  )}
                </div>
              )}

              {/* question text */}
              <div style={{ fontSize: 'clamp(1rem, 2.5vw, 1.15rem)', color: '#2d3748', lineHeight: 1.6, marginBottom: '1.25rem', fontWeight: 500 }}>
                {renderQuestion(q.question)}
              </div>

              {/* MC options */}
              {q.type === 'multiple_choice' && !feedback && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
                  {(q.shuffledOptions || parseJsonb(q.options)).map((opt, i) => {
                    const isSel = selectedOption === opt
                    return (
                      <div key={i} onClick={() => setSelectedOption(opt)} style={{
                        padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                        border: `2px solid ${isSel ? '#667eea' : '#e2e8f0'}`,
                        background: isSel ? '#EDE9FE' : 'white',
                        fontSize: '0.95rem', color: isSel ? '#553C9A' : '#2d3748',
                        fontWeight: isSel ? 600 : 400, transition: 'all 0.15s ease'
                      }}
                        onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.background = '#f7f7ff' } }}
                        onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white' } }}
                      >{opt}</div>
                    )
                  })}
                </div>
              )}

              {/* MC options post-feedback */}
              {q.type === 'multiple_choice' && feedback && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1rem' }}>
                  {(q.shuffledOptions || parseJsonb(q.options)).map((opt, i) => {
                    const isOk  = normalise(opt) === normalise(q.correct_answer) || parseJsonb(q.acceptable_alternatives).some(a => normalise(a) === normalise(opt))
                    const wasSel = selectedOption === opt
                    let bg = 'white', border = '#e2e8f0', color = '#2d3748'
                    if (isOk) { bg = '#f0fff4'; border = '#48bb78'; color = '#276749' }
                    else if (wasSel) { bg = '#fff5f5'; border = '#f56565'; color = '#c53030' }
                    return (
                      <div key={i} style={{ padding: '12px 16px', borderRadius: '8px', border: `2px solid ${border}`, background: bg, fontSize: '0.95rem', color, fontWeight: isOk || wasSel ? 600 : 400 }}>
                        {opt}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Gap fill input */}
              {q.type === 'gap_fill' && !feedback && !isChecking && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'stretch' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: '#718096', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your answer:</div>
                    <input ref={inputRef} type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder="Type the missing word(s)..." autoFocus
                      autoCorrect="off" autoCapitalize="off" spellCheck={false}
                      style={{ width: '100%', padding: '0.9rem 1rem', fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', borderRadius: '8px', border: '2px solid #667eea', boxSizing: 'border-box', color: '#2d3748', fontWeight: 500, backgroundColor: '#EDE9FE', WebkitTextFillColor: '#2d3748' }}
                    />
                  </div>
                  <button onClick={checkAnswer} disabled={!userAnswer.trim()}
                    style={{ padding: '0 1.5rem', background: userAnswer.trim() ? GRADIENT : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: userAnswer.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '1rem', alignSelf: 'flex-end', minHeight: '48px' }}>
                    Check
                  </button>
                </div>
              )}

              {isChecking && (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#553C9A', fontSize: '0.95rem', border: '2px dashed #EDE9FE', borderRadius: '8px', marginBottom: '1rem' }}>
                  🤖 Checking your answer...
                </div>
              )}

              {/* Feedback */}
              {feedback && (() => {
                let style = { bg: '#fff5f5', border: '#fed7d7', color: '#9b2c2c' }
                if (feedback.isCorrect && feedback.pointAwarded && !feedback.usedHint) {
                  style = { bg: '#f0fff4', border: '#c6f6d5', color: '#276749' }  // green
                } else if (feedback.isCorrect) {
                  style = { bg: '#ebf8ff', border: '#bee3f8', color: '#2c5282' }  // blue (hint used, with or without point)
                }
                const studentAns = q.type === 'multiple_choice' ? (selectedOption || '') : userAnswer
                const modelDiffers = normalise(feedback.correct) !== normalise(studentAns)
                // Header line
                let header
                if (feedback.isCorrect && !feedback.usedHint) {
                  header = modelDiffers ? `✅ Correct! (or: "${feedback.correct}")` : '✅ Correct!'
                } else if (feedback.isCorrect && feedback.pointAwarded) {
                  header = '💡 Correct with a hint'
                } else if (feedback.isCorrect) {
                  header = '💡 Correct with a hint (no point this time)'
                } else {
                  header = `❌ Not quite — the answer is "${feedback.correct}"`
                }
                return (
                  <div style={{ backgroundColor: style.bg, border: `1px solid ${style.border}`, color: style.color, padding: '1rem 1.25rem', borderRadius: '10px', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
                    {/* Result line */}
                    <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>{header}</div>
                    {/* Show what they typed for gap fill */}
                    {q.type === 'gap_fill' && studentAns && (
                      <div style={{ fontSize: '0.88rem', marginBottom: '0.3rem', opacity: 0.85 }}>
                        Your answer: <strong>{studentAns}</strong>
                      </div>
                    )}
                    {/* Spelling warning */}
                    {feedback.isCorrect && feedback.type === 'fuzzy' && (
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', color: '#c05621' }}>⚠️ Watch your spelling!</div>
                    )}
                    {/* AI reason or alternative feedback */}
                    {feedback.note && feedback.type !== 'fuzzy' && (
                      <div style={{ fontSize: '0.85rem', marginTop: '0.25rem', opacity: 0.85 }}>{feedback.note}</div>
                    )}
                    {/* Auto-revealed hint after wrong answer */}
                    {!feedback.isCorrect && autoHintShown && q.hint && (
                      <div style={{ fontSize: '0.88rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${style.border}`, opacity: 0.95 }}>
                        🤔 The hint was: {q.hint}
                      </div>
                    )}
                    {/* Explanation from question bank */}
                    {q.explanation && (
                      <div style={{ fontSize: '0.88rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: `1px solid ${style.border}`, opacity: 0.9 }}>
                        💡 {q.explanation}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Check button for MC */}
              {q.type === 'multiple_choice' && !feedback && (
                <button onClick={checkAnswer} disabled={!selectedOption}
                  style={{ width: '100%', padding: '1rem', fontSize: '1rem', background: selectedOption ? GRADIENT : '#cbd5e0', color: 'white', border: 'none', borderRadius: '10px', cursor: selectedOption ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
                  Check Answer
                </button>
              )}

              {feedback && q && (
                <FlagQuestion questionNumber={q.question_number} language={isSpanishTP ? 'es' : 'en'} />
              )}

              {feedback && (
                <button onClick={nextQuestion} style={{ width: '100%', padding: '1rem', marginTop: '0.5rem', fontSize: '1rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                  {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              )}
            </div>


          </>
        )}

        {stage === 'finished' && (() => {
          const finalScore = results.filter(r => r.isCorrect).length
          const finalPass  = finalScore >= passMark
          return (
            <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{finalScore >= 9 ? '🏆' : finalScore >= 7 ? '⭐' : finalScore >= 5 ? '👍' : '💪'}</div>
              <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
              <div style={{ fontSize: '3rem', fontWeight: 700, margin: '12px 0', color: finalPass ? '#48bb78' : finalScore >= 5 ? '#ed8936' : '#f56565' }}>{finalScore}/{questions.length}</div>
              <p style={{ color: '#4a5568' }}>{finalScore >= 9 ? 'Outstanding! Excellent work.' : finalPass ? 'Great work! You passed.' : finalScore >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
                <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>
                {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
              </div>
            </div>
          )
        })()}

      {showChallenge && (
        <SentenceChallenge
          word={challengeWord}
          language={exercise?.topic === 'spanish' ? 'es' : 'en'}
          exercise="topic_practice"
          onClose={() => { setShowChallenge(false); doAdvance() }}
        />
      )}

      </div>
    </div>
    </div>
  )
}
