import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'

const GRADIENT    = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const BEE_YELLOW  = '#f9df6d'
const PANGRAM_BG  = '#ffd23f'
const CENTRE_TEXT = '#7c4d00'
const LETTER_GREY = '#e8e8e8'

// ── Spelling Bee v2 (29 Apr 2026) ─────────────────────────────────────────
// Target: 50 words = Genius. Fixed thresholds, NYT style.
// Min length: 4 for everyone (no level split).
// Scoring: 4 letters = 1, 5 letters = 5, 6+ letters = length.
//          Pangram = length + 7.
// Stars: ⭐ Solid (22), ⭐ Genius (50), ⭐ first pangram,
//        ⭐ each milestone past 50 (60, 70, 80, 90), 👑 Queen Bee (100).
// Pangram = any word using all 7 unique letters (computed at runtime).
// Words validated via word_lists table, no per-puzzle valid_words.

const RANKS = [
  { label: 'Beginner',   words: 0   },
  { label: 'Good Start', words: 5   },
  { label: 'Moving Up',  words: 10  },
  { label: 'Good',       words: 15  },
  { label: 'Solid',      words: 22  },
  { label: 'Nice',       words: 30  },
  { label: 'Great',      words: 38  },
  { label: 'Amazing',    words: 45  },
  { label: 'Genius',     words: 50  },
]
const QUEEN_BEE = 100
const TARGET    = 50
const MIN_LEN   = 4

function scoreWord(word, isPangram) {
  let base
  if (word.length === 4)      base = 1
  else if (word.length === 5) base = 5
  else                        base = word.length
  return base + (isPangram ? 7 : 0)
}

function isPangramWord(word, allowedSet) {
  // word uses every letter in allowedSet (size 7)
  const used = new Set(word)
  if (used.size !== allowedSet.size) return false
  for (const c of allowedSet) if (!used.has(c)) return false
  return true
}

function getRankIdx(wordCount) {
  let idx = 0
  RANKS.forEach((r, i) => { if (wordCount >= r.words) idx = i })
  return idx
}

// Compute total stars based on session state.
// Solid (22), Genius (50), first pangram = 1 each.
// Each +10 past 50 = +1 (so 60, 70, 80, 90).
// Queen Bee at 100 = special crown star.
// Plus sentence challenge star (added separately at finish).
function computeStars(wordCount, pangramCount) {
  let stars = 0
  if (wordCount >= 22)  stars++          // Solid
  if (wordCount >= 50)  stars++          // Genius
  if (pangramCount >= 1) stars++         // First pangram
  // +10 milestones past 50
  if (wordCount >= 60)  stars++
  if (wordCount >= 70)  stars++
  if (wordCount >= 80)  stars++
  if (wordCount >= 90)  stars++
  // Queen Bee separately tracked but counts as a star too
  if (wordCount >= QUEEN_BEE) stars++
  return stars
}

// Hexagon SVG path for pointy-top hex with given centre and "size" (radius)
function hexPath(cx, cy, size) {
  // Pointy-top: vertex up. Angle 0 = top.
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 - 90) * (Math.PI / 180)
    const x = cx + size * Math.cos(angle)
    const y = cy + size * Math.sin(angle)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

// Layout: pointy-top hexagons in honeycomb
// Centre at (110, 110). 6 outer hexes at angles 30, 90, 150, 210, 270, 330 (gap-top arrangement)
// Hex size: 32 (vertex-to-vertex / 2 = "circumradius")
// Distance centre-to-outer-centre: 2 * size * cos(30°) ≈ 55.4
const HEX_SIZE = 32
const CENTRE_X = 110
const CENTRE_Y = 110
const OUTER_DIST = HEX_SIZE * Math.sqrt(3)  // ≈ 55.4 — touching honeycomb spacing

const OUTER_HEX_POS = Array.from({ length: 6 }, (_, i) => {
  // start at top-left and go clockwise: angles -120, -60, 0, 60, 120, 180
  // Actually for pointy-top honeycomb the 6 surrounding cells sit at 30°, 90°, 150°, 210°, 270°, 330°
  const angle = (i * 60 + 30) * (Math.PI / 180)
  return {
    cx: CENTRE_X + OUTER_DIST * Math.cos(angle),
    cy: CENTRE_Y + OUTER_DIST * Math.sin(angle),
  }
})

export default function SpellingBeeGame({ onBack, userProfile }) {
  const location = useLocation()

  function detectLanguage() {
    if (location.state?.isSpanish) return 'es'
    const tracks = userProfile?.tracks || []
    if (tracks.includes('spanish') || userProfile?.level === 'Spanish') return 'es'
    return 'en'
  }

  const [language] = useState(() => detectLanguage())
  const isSpanish  = language === 'es'

  const [gameState, setGameState]     = useState('loading')
  const [puzzle, setPuzzle]           = useState(null)
  const [letters, setLetters]         = useState([])
  const [input, setInput]             = useState('')
  const [message, setMessage]         = useState({ text: '', type: '' })
  const [foundWords, setFoundWords]   = useState([])
  const [pangramsFound, setPangramsFound] = useState([])
  const [score, setScore]             = useState(0)
  const [personalBest, setPersonalBest] = useState(null)  // { words, score } or null
  const [previousRankIdx, setPreviousRankIdx] = useState(0)
  const [queenBeeReached, setQueenBeeReached] = useState(false)

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [challengeWord, setChallengeWord]       = useState(null)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [sentenceStar, setSentenceStar]         = useState(false)
  const [showChallenge, setShowChallenge]       = useState(false)

  const stateRef = useRef({})
  const today    = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    stateRef.current = { input, gameState, foundWords, pangramsFound, score, puzzle }
  })

  useEffect(() => {
    loadPuzzle()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleKeyDown(e) {
    const { gameState } = stateRef.current
    if (gameState !== 'playing') return
    if (e.key === 'Enter')     { handleEnter(); return }
    if (e.key === 'Backspace') { setInput(i => i.slice(0, -1)); return }
    const key = e.key.toLowerCase()
    if (/^[a-záéíóúñü]$/.test(key)) handleLetterClick(key)
  }

  async function loadPuzzle() {
    const { data: p } = await supabase
      .from('spelling_bee_puzzles')
      .select('*')
      .eq('play_date', today)
      .eq('language', language)
      .single()

    if (!p) { setGameState('noword'); return }

    const norm = {
      ...p,
      centre_letter: p.centre_letter.toLowerCase(),
      outer_letters: p.outer_letters.map(l => l.toLowerCase()),
    }
    setPuzzle(norm)
    setLetters([...norm.outer_letters])

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Load saved progress for today
      const { data: saved } = await supabase
        .from('spelling_bee_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('puzzle_id', p.id)
        .eq('version', 2)
        .maybeSingle()

      // Load personal best across all v2 puzzles for this language
      const { data: bestRows } = await supabase
        .from('spelling_bee_scores')
        .select('found_words, score, puzzle_id, spelling_bee_puzzles!inner(language)')
        .eq('user_id', user.id)
        .eq('version', 2)
        .eq('spelling_bee_puzzles.language', language)
        .order('score', { ascending: false })
        .limit(1)

      if (bestRows && bestRows.length > 0) {
        const b = bestRows[0]
        setPersonalBest({
          words: (b.found_words || []).length,
          score: b.score || 0,
        })
      }

      if (saved) {
        const fw = saved.found_words || []
        const allowedSet = new Set([norm.centre_letter, ...norm.outer_letters])
        const pgs = fw.filter(w => isPangramWord(w, allowedSet))
        setFoundWords(fw)
        setPangramsFound(pgs)
        setScore(saved.score || 0)
        setQueenBeeReached(fw.length >= QUEEN_BEE)
        setPreviousRankIdx(getRankIdx(fw.length))
        setSentenceStar(saved.sentence_challenge_passed === true)
        if (saved.sentence_challenge_passed !== null) {
          setSentenceDone(true)
          if (fw.length > 0) setChallengeWord(fw[Math.floor(Math.random() * fw.length)])
          setGameState('finished')
        } else {
          setGameState('playing')
        }
        return
      }
    }
    setGameState('playing')
  }

  function handleLetterClick(letter) {
    if (stateRef.current.gameState !== 'playing') return
    setInput(i => i + letter.toLowerCase())
  }

  function handleDelete() {
    if (stateRef.current.gameState !== 'playing') return
    setInput(i => i.slice(0, -1))
  }

  function handleShuffle() {
    setLetters(ls => {
      const a = [...ls]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
      }
      return a
    })
  }

  function showMsg(text, type, ms = 1800) {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), ms)
  }

  async function handleEnter() {
    const { input: cur, gameState, foundWords, pangramsFound, score, puzzle } = stateRef.current
    if (gameState !== 'playing' || !puzzle) return

    const word = cur.toLowerCase()
    setInput('')

    if (word.length < MIN_LEN) {
      showMsg(
        isSpanish ? `Mínimo ${MIN_LEN} letras` : `Need ${MIN_LEN}+ letters`,
        'error'
      )
      return
    }
    if (!word.includes(puzzle.centre_letter)) {
      showMsg(
        isSpanish
          ? `Debe incluir la "${puzzle.centre_letter.toUpperCase()}"`
          : `Must contain "${puzzle.centre_letter.toUpperCase()}"`,
        'error'
      )
      return
    }
    if (foundWords.includes(word)) {
      showMsg(isSpanish ? 'Ya encontrada' : 'Already found', 'warning')
      return
    }
    // Letter validity (only allowed letters, reusable)
    const allowed = new Set([puzzle.centre_letter, ...puzzle.outer_letters])
    for (const c of word) {
      if (!allowed.has(c)) {
        showMsg(isSpanish ? 'Letras no válidas' : 'Invalid letters', 'error')
        return
      }
    }

    // Lookup in word_lists
    const { data: dictHit } = await supabase
      .from('word_lists')
      .select('word')
      .eq('word', word)
      .eq('language', language)
      .maybeSingle()

    if (!dictHit) {
      showMsg(isSpanish ? 'No es una palabra' : 'Not a word', 'error')
      return
    }

    const isPangram = isPangramWord(word, allowed)
    const pts       = scoreWord(word, isPangram)
    const newWords  = [...foundWords, word]
    const newPangs  = isPangram ? [...pangramsFound, word] : pangramsFound
    const newScore  = score + pts

    setFoundWords(newWords)
    setPangramsFound(newPangs)
    setScore(newScore)

    // Determine message
    const newRankIdx = getRankIdx(newWords.length)
    const oldRankIdx = getRankIdx(foundWords.length)

    if (newWords.length === QUEEN_BEE && !queenBeeReached) {
      setQueenBeeReached(true)
      showMsg(isSpanish ? `👑 ¡QUEEN BEE! +${pts}` : `👑 QUEEN BEE! +${pts}`, 'success', 4000)
      logQueenBeeAlert(newWords.length, newScore)
    } else if (isPangram && newPangs.length === 1) {
      showMsg(isSpanish ? `🐝 ¡PANGRAMA! +${pts}` : `🐝 PANGRAM! +${pts}`, 'success', 2800)
    } else if (isPangram) {
      showMsg(isSpanish ? `🐝 ¡Otro pangrama! +${pts}` : `🐝 Another pangram! +${pts}`, 'success', 2500)
    } else if (newRankIdx > oldRankIdx) {
      showMsg(`${RANKS[newRankIdx].label}! +${pts}`, 'success', 2200)
    } else {
      showMsg(`+${pts}`, 'success')
    }

    setPreviousRankIdx(newRankIdx)

    // Milestone star transitions — emit a star each time a threshold is crossed.
    const milestones = []
    if (pangramsFound.length === 0 && newPangs.length >= 1)            milestones.push('pangram')
    if (foundWords.length < 22  && newWords.length >= 22)              milestones.push('milestone_solid')
    if (foundWords.length < 50  && newWords.length >= 50)              milestones.push('milestone_genius')
    if (foundWords.length < 60  && newWords.length >= 60)              milestones.push('milestone_60')
    if (foundWords.length < 70  && newWords.length >= 70)              milestones.push('milestone_70')
    if (foundWords.length < 80  && newWords.length >= 80)              milestones.push('milestone_80')
    if (foundWords.length < 90  && newWords.length >= 90)              milestones.push('milestone_90')
    if (foundWords.length < QUEEN_BEE && newWords.length >= QUEEN_BEE) milestones.push('queen_bee')
    if (milestones.length > 0) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const rows = milestones.map(subtype => ({
            student_id: user.id,
            source:     'spelling_bee',
            subtype,
            // dedupe_key: one milestone star per puzzle per subtype, ever.
            context:    { puzzle_id: puzzle.id, language, word_count: newWords.length, score: newScore, dedupe_key: `${puzzle.id}:${subtype}` },
          }))
          const { error } = await supabase.from('stars').insert(rows)
          if (error && error.code !== '23505') console.warn('Spelling Bee milestone star insert failed:', error)
        }
      } catch (e) { console.warn('Milestone star log failed:', e) }
    }

    await saveProgress(newWords, newScore, RANKS[newRankIdx].label,
      computeStars(newWords.length, newPangs.length), null)
  }

  async function logQueenBeeAlert(wordCount, scoreVal) {
    // Log to a table the teacher dashboard can pick up.
    // queen_bee_alerts table to be created on first attempt.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puzzle) return
    try {
      await supabase.from('queen_bee_alerts').insert({
        user_id: user.id,
        puzzle_id: puzzle.id,
        word_count: wordCount,
        score: scoreVal,
        achieved_at: new Date().toISOString(),
        seen_by_teacher: false,
      })
    } catch (e) {
      // Silently ignore if table doesn't exist yet — non-critical
      console.warn('Queen Bee alert log failed:', e)
    }
  }

  async function saveProgress(words, sc, rankLabel, stars, sentChallengePassed) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puzzle) return
    await supabase.from('spelling_bee_scores').upsert({
      user_id:                   user.id,
      puzzle_id:                 puzzle.id,
      found_words:               words,
      score:                     sc,
      rank_label:                rankLabel,
      stars_awarded:             stars,
      sentence_challenge_passed: sentChallengePassed,
      completed_at:              new Date().toISOString(),
      version:                   2,
    }, { onConflict: 'user_id,puzzle_id' })
  }

  function handleFinish() {
    if (foundWords.length === 0) {
      showMsg(
        isSpanish ? '¡Encuentra al menos una palabra!' : 'Find at least one word first!',
        'error'
      )
      return
    }
    // Pick a challenge word — prefer pangrams if any found
    let word
    if (pangramsFound.length > 0) {
      word = pangramsFound[Math.floor(Math.random() * pangramsFound.length)]
    } else {
      word = foundWords[Math.floor(Math.random() * foundWords.length)]
    }
    setChallengeWord(word)
    setGameState('finished')
  }

  async function handleSentenceMarked({ sentence, inputMethod, result }) {
    const data = result || { valid: null }
    setSentenceFeedback(data)
    const passed = data.valid === true
    if (passed) setSentenceStar(true)

    const stars = computeStars(foundWords.length, pangramsFound.length)
    const rankIdx = getRankIdx(foundWords.length)
    await saveProgress(foundWords, score, RANKS[rankIdx].label, stars, passed)
    setSentenceDone(true)
    // Sentence-pass star is written by SentenceChallenge directly to `stars`.
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const wordCount  = foundWords.length
  const rankIdx    = getRankIdx(wordCount)
  const rankLabel  = wordCount >= QUEEN_BEE
    ? 'Queen Bee'
    : wordCount > TARGET
      ? `Genius +${wordCount - TARGET}`
      : RANKS[rankIdx].label
  const baseStars  = computeStars(wordCount, pangramsFound.length)
  const totalStars = baseStars + (sentenceStar ? 1 : 0)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      {isSpanish ? 'Cargando...' : "Loading today's puzzle..."}
    </div>
  )

  // ── No puzzle ──────────────────────────────────────────────────────────────
  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐝</div>
        <h2 style={{ color: '#2d3748' }}>{isSpanish ? 'Sin puzzle hoy' : 'No puzzle today'}</h2>
        <p style={{ color: '#718096' }}>{isSpanish ? '¡Vuelve mañana!' : 'Check back tomorrow!'}</p>
        {onBack && (
          <button onClick={onBack} style={{ padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  )

  const centre     = puzzle?.centre_letter?.toUpperCase() || ''
  const outerUpper = letters.map(l => l.toUpperCase())
  const allowedSet = puzzle ? new Set([puzzle.centre_letter, ...puzzle.outer_letters]) : new Set()

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

        {/* Header */}
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.25rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🐝</span>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '3px' }}>SPELLING BEE</h1>
            {isSpanish && <span style={{ fontSize: '1.2rem' }}>🇪🇸</span>}
          </div>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
            {isSpanish
              ? `La "${centre}" es obligatoria · 4+ letras`
              : `Centre letter "${centre}" required · 4+ letters`}
          </p>
          <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: '0.75rem' }}>
            {isSpanish ? `Objetivo: ${TARGET} palabras = Genio` : `Target: ${TARGET} words = Genius`}
          </p>
        </div>

        {/* NYT-style rank bar with 9 dots */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.9rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#2d3748' }}>
              {wordCount >= QUEEN_BEE && '👑 '}
              {rankLabel}
            </span>
            <span style={{ fontSize: '0.82rem', color: '#718096' }}>
              {wordCount} {isSpanish ? 'palabras' : 'words'} · {score} pts
            </span>
          </div>
          {/* Dots progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between', padding: '4px 0' }}>
            <div style={{ flex: 1, height: '2px', background: '#e2e8f0', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${Math.min(rankIdx / (RANKS.length - 1), 1) * 100}%`,
                background: BEE_YELLOW, transition: 'width 0.4s ease',
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', position: 'absolute', top: '-7px', left: 0, right: 0 }}>
                {RANKS.map((r, i) => (
                  <div key={i} style={{
                    width: i === rankIdx ? '20px' : '12px',
                    height: i === rankIdx ? '20px' : '12px',
                    borderRadius: '50%',
                    background: i <= rankIdx ? BEE_YELLOW : '#e2e8f0',
                    border: i === rankIdx ? '2px solid #d4a017' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 700, color: CENTRE_TEXT,
                    transition: 'all 0.3s ease',
                    flexShrink: 0,
                  }}>
                    {i === rankIdx && wordCount > 0 ? wordCount : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Stars + personal best row */}
          {(baseStars > 0 || personalBest) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: '0.78rem' }}>
              <div>
                {baseStars > 0 && (
                  <span style={{ fontSize: '0.95rem' }}>
                    {Array(baseStars).fill('⭐').join('')}
                  </span>
                )}
              </div>
              {personalBest && (
                <div style={{ color: '#a0aec0' }}>
                  {isSpanish ? 'Mejor:' : 'Best:'} {personalBest.words} {isSpanish ? 'pal.' : 'wds'} · {personalBest.score} pts
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message */}
        {message.text && (
          <div style={{
            textAlign: 'center', marginBottom: '0.75rem', padding: '8px 16px', borderRadius: '8px',
            fontWeight: 700, fontSize: '0.95rem',
            background: message.type === 'success' ? '#f0fff4' : message.type === 'error' ? '#fff5f5' : '#fffbeb',
            color:      message.type === 'success' ? '#276749' : message.type === 'error' ? '#c53030' : '#92400e',
            border:     `1px solid ${message.type === 'success' ? '#c6f6d5' : message.type === 'error' ? '#fed7d7' : '#fde68a'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* ── Playing ── */}
        {gameState === 'playing' && (
          <>
            {/* Input display */}
            <div style={{ textAlign: 'center', marginBottom: '1rem', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {input.length > 0 ? (
                <span style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '4px' }}>
                  {input.toUpperCase().split('').map((ch, i) => (
                    <span key={i} style={{ color: ch.toLowerCase() === puzzle?.centre_letter ? '#b09200' : '#2d3748' }}>
                      {ch}
                    </span>
                  ))}
                </span>
              ) : (
                <span style={{ color: '#cbd5e0', fontSize: '0.9rem' }}>
                  {isSpanish ? 'Escribe o pulsa las letras...' : 'Type or click the letters...'}
                </span>
              )}
            </div>

            {/* Hexagonal letter grid */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <svg width="220" height="220" viewBox="0 0 220 220" style={{ overflow: 'visible' }}>
                {/* Outer hexagons */}
                {OUTER_HEX_POS.map((pos, i) => (
                  <g key={`outer-${i}`} style={{ cursor: 'pointer' }}
                     onClick={() => handleLetterClick(letters[i])}>
                    <polygon
                      points={hexPath(pos.cx, pos.cy, HEX_SIZE)}
                      fill={LETTER_GREY}
                      stroke="#d4d4d4"
                      strokeWidth="1"
                      style={{ transition: 'transform 0.1s ease', transformOrigin: `${pos.cx}px ${pos.cy}px` }}
                      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                      onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                      onTouchEnd={e   => e.currentTarget.style.transform = 'scale(1)'}
                    />
                    <text x={pos.cx} y={pos.cy + 8} textAnchor="middle"
                      style={{ fontSize: '1.4rem', fontWeight: 700, fill: '#2d3748', userSelect: 'none', pointerEvents: 'none' }}>
                      {outerUpper[i]}
                    </text>
                  </g>
                ))}
                {/* Centre hexagon */}
                <g style={{ cursor: 'pointer' }}
                   onClick={() => handleLetterClick(puzzle.centre_letter)}>
                  <polygon
                    points={hexPath(CENTRE_X, CENTRE_Y, HEX_SIZE)}
                    fill={BEE_YELLOW}
                    stroke="#d4a017"
                    strokeWidth="1.5"
                    style={{ transition: 'transform 0.1s ease', transformOrigin: `${CENTRE_X}px ${CENTRE_Y}px` }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onTouchEnd={e   => e.currentTarget.style.transform = 'scale(1)'}
                  />
                  <text x={CENTRE_X} y={CENTRE_Y + 9} textAnchor="middle"
                    style={{ fontSize: '1.5rem', fontWeight: 800, fill: CENTRE_TEXT, userSelect: 'none', pointerEvents: 'none' }}>
                    {centre}
                  </text>
                </g>
              </svg>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <button onClick={handleDelete}
                style={{ padding: '10px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '0.88rem', background: 'white', border: '2px solid #e2e8f0', color: '#2d3748', cursor: 'pointer' }}>
                {isSpanish ? 'Borrar' : 'Delete'}
              </button>
              <button onClick={handleShuffle}
                style={{ padding: '10px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '0.88rem', background: 'white', border: '2px solid #e2e8f0', color: '#2d3748', cursor: 'pointer' }}>
                ↻ {isSpanish ? 'Mezclar' : 'Shuffle'}
              </button>
              <button onClick={handleEnter}
                style={{ padding: '10px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '0.88rem', background: '#2d3748', border: 'none', color: 'white', cursor: 'pointer' }}>
                {isSpanish ? 'Enviar' : 'Enter'}
              </button>
            </div>

            {/* Found words */}
            {foundWords.length > 0 && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isSpanish
                      ? `${foundWords.length} palabras${pangramsFound.length > 0 ? ` · ${pangramsFound.length} 🐝` : ''}`
                      : `${foundWords.length} word${foundWords.length !== 1 ? 's' : ''}${pangramsFound.length > 0 ? ` · ${pangramsFound.length} pangram${pangramsFound.length !== 1 ? 's' : ''} 🐝` : ''}`}
                  </span>
                  <button onClick={handleFinish}
                    style={{ padding: '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.8rem', background: GRADIENT, color: 'white', border: 'none', cursor: 'pointer' }}>
                    {isSpanish ? 'Terminar →' : 'Finish →'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {[...foundWords].sort().map(w => {
                    const isPg = isPangramWord(w, allowedSet)
                    return (
                      <span key={w} style={{
                        padding: '3px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                        background: isPg ? PANGRAM_BG : '#f0f0f0',
                        color:      isPg ? CENTRE_TEXT : '#2d3748',
                        border:     `1px solid ${isPg ? '#d4a017' : '#e2e8f0'}`,
                      }}>
                        {w}{isPg ? ' 🐝' : ''}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {foundWords.length === 0 && (
              <p style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.83rem', padding: '0.5rem' }}>
                {isSpanish
                  ? `Forma palabras de ${MIN_LEN}+ letras · la "${centre}" es obligatoria`
                  : `Form ${MIN_LEN}+ letter words · "${centre}" must be used in every word`}
              </p>
            )}

            {/* Back while playing */}
            {onBack && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button onClick={onBack} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0' }}>
                  ← Back
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Finished ── */}
        {gameState === 'finished' && (
          <>
            {/* Summary */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>
                  {wordCount >= QUEEN_BEE ? '👑' : '🐝'}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2d3748' }}>{rankLabel}</div>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '2px' }}>
                  {wordCount} {isSpanish ? 'palabras' : `word${wordCount !== 1 ? 's' : ''}`}
                  {' · '}{score} {isSpanish ? 'puntos' : 'pts'}
                  {pangramsFound.length > 0 && ` · ${pangramsFound.length} 🐝`}
                </div>
                {wordCount >= QUEEN_BEE && (
                  <div style={{ marginTop: '8px', padding: '8px 16px', background: '#fffbeb', borderRadius: '8px', border: '2px solid #fde68a', display: 'inline-block' }}>
                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
                      {isSpanish ? '¡QUEEN BEE! Has encontrado todas.' : 'QUEEN BEE! You found them all.'}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                {[...foundWords].sort().map(w => {
                  const isPg = isPangramWord(w, allowedSet)
                  return (
                    <span key={w} style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                      background: isPg ? PANGRAM_BG : '#f0f0f0',
                      color:      isPg ? CENTRE_TEXT : '#2d3748',
                      border:     `1px solid ${isPg ? '#d4a017' : '#e2e8f0'}`,
                    }}>
                      {w}{isPg ? ' 🐝' : ''}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Sentence challenge */}
            {!sentenceDone && challengeWord && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
                  {isSpanish ? '✍️ ¡Ahora úsala en una frase!' : '✍️ Now use it in a sentence!'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>
                  {isSpanish
                    ? `Usa "${challengeWord}" en una frase. ¡Gana ⭐️ por una buena frase!`
                    : `Use "${challengeWord}" in a sentence. Earn ⭐️ for a correct sentence!`}
                </div>
                <button
                  onClick={() => setShowChallenge(true)}
                  style={{
                    width: '100%', padding: '0.85rem', background: GRADIENT, color: 'white',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.2px'
                  }}>
                  ⭐ {isSpanish ? 'Úsala en una frase →' : 'Use it in a sentence →'}
                </button>
                <p style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '8px 0 0', textAlign: 'center' }}>
                  {isSpanish ? 'Escribe o graba — gana ⭐️ por una buena frase' : 'Type or speak — earn ⭐️ for a good sentence'}
                </p>
              </div>
            )}

            {/* Sentence result + stars + back */}
            {sentenceDone && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
                {sentenceFeedback && (
                  <div style={{
                    padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
                    background: sentenceFeedback.valid ? '#f0fff4' : '#fff5f5',
                    border:     `1px solid ${sentenceFeedback.valid ? '#c6f6d5' : '#fed7d7'}`,
                    color:      sentenceFeedback.valid ? '#276749' : '#9b2c2c',
                    fontSize: '0.9rem', lineHeight: 1.5,
                  }}>
                    {sentenceFeedback.valid ? '✅ ' : '❌ '}{sentenceFeedback.reason || sentenceFeedback.feedback}
                  </div>
                )}

                {totalStars > 0 ? (
                  <div style={{ textAlign: 'center', marginBottom: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '1.7rem', marginBottom: '2px' }}>
                      {wordCount >= QUEEN_BEE && '👑 '}
                      {Array(totalStars).fill('⭐').join('')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                      {wordCount >= QUEEN_BEE
                        ? (isSpanish ? '¡Queen Bee! 👑' : 'Queen Bee! 👑')
                        : wordCount >= TARGET
                        ? (isSpanish ? '¡Genio! 🐝' : 'Genius! 🐝')
                        : (isSpanish ? '¡Bien hecho! 🐝' : 'Well done! 🐝')}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {isSpanish ? 'Sin estrellas esta vez — ¡sigue intentando! 💪' : 'No stars this time — keep going! 💪'}
                  </div>
                )}

                <p style={{ color: '#718096', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 12px' }}>
                  {isSpanish ? '¡Vuelve mañana para un nuevo puzzle! 🐝' : 'Come back tomorrow for a new puzzle! 🐝'}
                </p>
                {onBack && (
                  <button onClick={onBack} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
                    ← {isSpanish ? 'Volver' : 'Back'}
                  </button>
                )}
              </div>
            )}

            {!sentenceDone && onBack && (
              <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <button onClick={onBack} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0' }}>
                  ← {isSpanish ? 'Volver' : 'Back'}
                </button>
              </div>
            )}
          </>
        )}

      </div>
      {showChallenge && challengeWord && (
        <SentenceChallenge
          word={challengeWord}
          language={language}
          exercise="spelling_bee"
          apiContext="challenge"
          dedupeKey={puzzle ? `${puzzle.id}:sentence` : undefined}
          onMarkResult={handleSentenceMarked}
          onClose={() => setShowChallenge(false)}
        />
      )}
    </div>
  )
}
