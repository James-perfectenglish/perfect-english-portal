import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

const GRADIENT    = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const BEE_YELLOW  = '#f9df6d'
const CENTRE_TEXT = '#7c4d00'
const LETTER_GREY = '#e8e8e8'

const RANKS = [
  { label: 'Beginner',   pct: 0     },
  { label: 'Good Start', pct: 0.075 },
  { label: 'Moving Up',  pct: 0.15  },
  { label: 'Almost',     pct: 0.225 },
  { label: 'Nice',       pct: 0.30  },
  { label: 'Great',      pct: 0.375 },
  { label: 'Amazing',    pct: 0.50  },
  { label: 'Genius',     pct: 0.625 },
]

// 6 outer letter positions in 220×220 container, radius 70px, starting top
const OUTER_POS = Array.from({ length: 6 }, (_, i) => {
  const angle = (i * 60 - 90) * (Math.PI / 180)
  return {
    top:  Math.round(110 + 70 * Math.sin(angle) - 26),
    left: Math.round(110 + 70 * Math.cos(angle) - 26),
  }
})

function scoreWord(word, pangrams) {
  const base = word.length === 3 ? 1 : word.length
  return base + (pangrams.includes(word) ? 7 : 0)
}

function cMaxScore(validWords, pangrams) {
  return validWords
    .filter(w => w.length >= 4)
    .reduce((sum, w) => sum + scoreWord(w, pangrams), 0)
}

function getRankIdx(score, denom) {
  let idx = 0
  RANKS.forEach((r, i) => { if (score / denom >= r.pct) idx = i })
  return idx
}

function getStars(score, denom, isC) {
  const pct = score / denom
  if (pct >= 0.70) return 3
  if (!isC && pct >= 0.25) return 1
  if (isC  && pct >= 0.50) return 1
  return 0
}

export default function SpellingBeeGame({ onBack, userProfile }) {
  const location = useLocation()

  function detectLanguage() {
    if (location.state?.isSpanish) return 'es'
    const tracks = userProfile?.tracks || []
    if (tracks.includes('spanish') || userProfile?.level === 'Spanish') return 'es'
    return 'en'
  }

  const [language]    = useState(() => detectLanguage())
  const isSpanish     = language === 'es'
  const levelStr      = userProfile?.level || ''
  const isC           = !isSpanish && (levelStr === 'C1' || levelStr === 'C2')
  const minLen        = isC ? 4 : 3

  const [gameState, setGameState]       = useState('loading')
  const [puzzle, setPuzzle]             = useState(null)
  const [cMax, setCMax]                 = useState(1)
  const [letters, setLetters]           = useState([])
  const [input, setInput]               = useState('')
  const [message, setMessage]           = useState({ text: '', type: '' })
  const [foundWords, setFoundWords]     = useState([])
  const [score, setScore]               = useState(0)
  const [starsAwarded, setStarsAwarded] = useState(0)

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [challengeWord, setChallengeWord]       = useState(null)
  const [sentenceInput, setSentenceInput]       = useState('')
  const [sentenceChecking, setSentenceChecking] = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [sentenceStar, setSentenceStar]         = useState(false)

  const stateRef = useRef({})
  const today    = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    stateRef.current = { input, gameState, foundWords, score, puzzle, cMax }
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
      valid_words:   p.valid_words.map(w => w.toLowerCase()),
      pangrams:      p.pangrams.map(w => w.toLowerCase()),
      outer_letters: p.outer_letters.map(l => l.toLowerCase()),
    }
    setPuzzle(norm)
    setLetters([...norm.outer_letters])
    const cm = cMaxScore(norm.valid_words, norm.pangrams)
    setCMax(cm || 1)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: saved } = await supabase
        .from('spelling_bee_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('puzzle_id', p.id)
        .single()

      if (saved) {
        const fw = saved.found_words || []
        setFoundWords(fw)
        setScore(saved.score || 0)
        setStarsAwarded(saved.stars_awarded || 0)
        setSentenceStar(saved.sentence_challenge_passed || false)
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
    const { input: cur, gameState, foundWords, score, puzzle, cMax } = stateRef.current
    if (gameState !== 'playing' || !puzzle) return

    const word = cur.toLowerCase()
    setInput('')

    if (word.length < minLen) {
      showMsg(
        isSpanish ? `Mínimo ${minLen} letras` : `Need ${minLen}+ letters`,
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
    if (!puzzle.valid_words.includes(word)) {
      // Check bonus word — valid letters + centre letter + in word_lists
      const allLetters = [puzzle.centre_letter, ...puzzle.outer_letters]
      const validLetters = word.split('').every(c => allLetters.includes(c))
      if (validLetters) {
        const { data: bonus } = await supabase
          .from('word_lists')
          .select('word')
          .eq('word', word)
          .eq('language', language)
          .maybeSingle()
        if (bonus) {
          const newWords = [...foundWords, word]
          setFoundWords(newWords)
          setScore(s => s + 1)
          showMsg(isSpanish ? '✨ ¡Palabra extra! +1' : '✨ Bonus word! +1', 'success', 2500)
          await saveProgress(newWords, score + 1, RANKS[getRankIdx(score + 1, isC ? cMax : puzzle.max_score)].label, starsAwarded, null)
          return
        }
      }
      showMsg(isSpanish ? 'No está en la lista' : 'Not in our list', 'error')
      return
    }

    const pts       = scoreWord(word, puzzle.pangrams)
    const isPangram = puzzle.pangrams.includes(word)
    const newWords  = [...foundWords, word]
    const newScore  = score + pts
    const denom     = isC ? cMax : puzzle.max_score
    const prevIdx   = getRankIdx(score, denom)
    const newIdx    = getRankIdx(newScore, denom)
    const newStars  = getStars(newScore, denom, isC)

    setFoundWords(newWords)
    setScore(newScore)
    setStarsAwarded(newStars)

    if (isPangram) {
      showMsg(isSpanish ? `🐝 ¡Pangrama! +${pts}` : `🐝 Pangram! +${pts}`, 'success', 2500)
    } else if (newIdx > prevIdx) {
      showMsg(`${RANKS[newIdx].label}! +${pts}`, 'success')
    } else {
      showMsg(`+${pts}`, 'success')
    }

    await saveProgress(newWords, newScore, RANKS[newIdx].label, newStars, null)
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
    const word = foundWords[Math.floor(Math.random() * foundWords.length)]
    setChallengeWord(word)
    setGameState('finished')
  }

  async function submitSentence() {
    if (!sentenceInput.trim() || sentenceChecking || !challengeWord) return
    setSentenceChecking(true)
    try {
      const res = await fetch('/api/mark-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:     'sentence',
          word:     challengeWord,
          sentence: sentenceInput.trim(),
          language,
        }),
      })
      const data = await res.json()
      setSentenceFeedback(data)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('sentence_challenges').insert({
          student_id:  user.id,
          exercise:    'spelling_bee',
          word:        challengeWord,
          language,
          sentence:    sentenceInput.trim(),
          is_correct:  data.valid,
          ai_feedback: data.reason || data.feedback || '',
          is_practice: false,
        })
      }

      const passed = data.valid === true
      if (passed) setSentenceStar(true)

      const denom   = isC ? cMax : (puzzle?.max_score || 1)
      const rankIdx = getRankIdx(score, denom)
      await saveProgress(foundWords, score, RANKS[rankIdx].label, starsAwarded, passed)
    } catch {
      setSentenceFeedback({
        valid:  null,
        reason: isSpanish
          ? 'No se pudo comprobar tu frase — ¡inténtalo de nuevo!'
          : 'Could not check your sentence — try again.',
      })
    }
    setSentenceDone(true)
    setSentenceChecking(false)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const denom      = isC ? cMax : (puzzle?.max_score || 1)
  const rankIdx    = getRankIdx(score, denom)
  const rankLabel  = RANKS[rankIdx].label
  const rankPct    = Math.min(score / denom, 1)
  const totalStars = starsAwarded + (sentenceStar ? 1 : 0)

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
              ? `Forma palabras · la "${centre}" es obligatoria`
              : `Make words using the centre letter "${centre}"`}
          </p>
          <p style={{ margin: '4px 0 0', opacity: 0.75, fontSize: '0.75rem' }}>
            {isSpanish ? '¡Encuentra las 40 palabras de hoy!' : "Find today's 40 words!"}
          </p>
        </div>

        {/* Rank bar */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.9rem 1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#2d3748' }}>{rankLabel}</span>
            <span style={{ fontSize: '0.82rem', color: '#718096' }}>
              {score} pts
              {starsAwarded > 0 && <span style={{ marginLeft: '6px' }}>{Array(starsAwarded).fill('⭐️').join('')}</span>}
            </span>
          </div>
          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${rankPct * 100}%`, background: BEE_YELLOW, borderRadius: '4px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontSize: '0.65rem', color: '#a0aec0' }}>Beginner</span>
            <span style={{ fontSize: '0.65rem', color: '#a0aec0' }}>Genius</span>
          </div>
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

            {/* Letter circle */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative', width: '220px', height: '220px' }}>
                {/* Centre letter */}
                <button
                  onClick={() => handleLetterClick(puzzle.centre_letter)}
                  style={{
                    position: 'absolute', top: '84px', left: '84px',
                    width: '52px', height: '52px', borderRadius: '50%',
                    background: BEE_YELLOW, color: CENTRE_TEXT,
                    border: 'none', fontSize: '1.4rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 2,
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseDown={e  => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e    => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onTouchEnd={e   => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {centre}
                </button>
                {/* Outer letters */}
                {outerUpper.map((letter, i) => (
                  <button
                    key={i}
                    onClick={() => handleLetterClick(letters[i])}
                    style={{
                      position: 'absolute',
                      top:  `${OUTER_POS[i].top}px`,
                      left: `${OUTER_POS[i].left}px`,
                      width: '52px', height: '52px', borderRadius: '50%',
                      background: LETTER_GREY, color: '#2d3748',
                      border: 'none', fontSize: '1.3rem', fontWeight: 700,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      transition: 'transform 0.1s ease',
                    }}
                    onMouseDown={e  => e.currentTarget.style.transform = 'scale(0.92)'}
                    onMouseUp={e    => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.92)'}
                    onTouchEnd={e   => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {letter}
                  </button>
                ))}
              </div>
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
                      ? `${foundWords.length} palabras`
                      : `${foundWords.length} word${foundWords.length !== 1 ? 's' : ''} found`}
                  </span>
                  <button onClick={handleFinish}
                    style={{ padding: '6px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.8rem', background: GRADIENT, color: 'white', border: 'none', cursor: 'pointer' }}>
                    {isSpanish ? 'Terminar →' : 'Finish →'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {[...foundWords].sort().map(w => (
                    <span key={w} style={{
                      padding: '3px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                      background: puzzle.pangrams.includes(w) ? BEE_YELLOW : '#f0f0f0',
                      color:      puzzle.pangrams.includes(w) ? CENTRE_TEXT : '#2d3748',
                      border:     `1px solid ${puzzle.pangrams.includes(w) ? '#e6c840' : '#e2e8f0'}`,
                    }}>
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {foundWords.length === 0 && (
              <p style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.83rem', padding: '0.5rem' }}>
                {isSpanish
                  ? `Forma palabras de ${minLen}+ letras · la "${centre}" es obligatoria`
                  : `Form ${minLen}+ letter words · "${centre}" must be used in every word`}
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
                <div style={{ fontSize: '2rem', marginBottom: '4px' }}>🐝</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2d3748' }}>{rankLabel}</div>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '2px' }}>
                  {foundWords.length} {isSpanish ? 'palabras' : `word${foundWords.length !== 1 ? 's' : ''}`}
                  {' · '}{score} {isSpanish ? 'puntos' : 'pts'}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center' }}>
                {[...foundWords].sort().map(w => (
                  <span key={w} style={{
                    padding: '3px 10px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
                    background: puzzle.pangrams.includes(w) ? BEE_YELLOW : '#f0f0f0',
                    color:      puzzle.pangrams.includes(w) ? CENTRE_TEXT : '#2d3748',
                    border:     `1px solid ${puzzle.pangrams.includes(w) ? '#e6c840' : '#e2e8f0'}`,
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>

            {/* Sentence challenge */}
            {!sentenceDone && challengeWord && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
                  {isSpanish ? '✍️ ¡Ahora úsala en una frase!' : '✍️ Now use it in a sentence!'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '10px' }}>
                  {isSpanish
                    ? `Usa "${challengeWord}" en una frase. ¡Gana ⭐️ por una buena frase!`
                    : `Use "${challengeWord}" in a sentence. Earn ⭐️ for a correct sentence!`}
                </div>
                <textarea
                  value={sentenceInput}
                  onChange={e => setSentenceInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitSentence() } }}
                  placeholder={isSpanish ? 'Escribe tu frase aquí...' : 'Type your sentence here...'}
                  rows={2}
                  autoFocus
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', border: '2px solid #667eea', borderRadius: '8px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', backgroundColor: '#f7f7ff' }}
                />
                <div style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '4px 0 8px', textAlign: 'right' }}>
                  {isSpanish ? 'Gana ⭐️ por una buena frase' : 'Earn ⭐️ for a good sentence'}
                </div>
                <button
                  onClick={submitSentence}
                  disabled={!sentenceInput.trim() || sentenceChecking}
                  style={{
                    width: '100%', padding: '0.75rem',
                    background: sentenceInput.trim() && !sentenceChecking ? GRADIENT : '#cbd5e0',
                    color: 'white', border: 'none', borderRadius: '8px',
                    fontWeight: 700, fontSize: '0.95rem',
                    cursor: sentenceInput.trim() && !sentenceChecking ? 'pointer' : 'not-allowed',
                  }}>
                  {sentenceChecking
                    ? (isSpanish ? '🤖 Comprobando...' : '🤖 Checking...')
                    : (isSpanish ? 'Comprobar frase' : 'Check my sentence')}
                </button>
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
                    <div style={{ fontSize: '2rem', marginBottom: '2px' }}>{Array(totalStars).fill('⭐️').join(' ')}</div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                      {starsAwarded >= 3 && sentenceStar
                        ? (isSpanish ? '¡Genio + frase perfecta! 🐝' : 'Genius + great sentence! 🐝')
                        : starsAwarded >= 3
                        ? (isSpanish ? '¡Genio! 🐝' : 'Genius! 🐝')
                        : sentenceStar
                        ? (isSpanish ? '¡Frase correcta! 🐝' : 'Great sentence! 🐝')
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
    </div>
  )
}
