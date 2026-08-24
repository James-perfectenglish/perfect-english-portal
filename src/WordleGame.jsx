import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'
import HelpSheet from './components/HelpSheet'

const WORD_LENGTH  = 5
const MAX_GUESSES  = 6
const GRADIENT     = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const EN_KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

const ES_KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['ENTER','Z','X','C','V','B','N','M','⌫'],
]

const COLOURS = {
  correct: '#538d4e',
  present: '#b59f3b',
  absent:  '#787c7e',
}

const WIN_MESSAGES = [
  'Genius! 🧠', 'Magnificent! ✨', 'Impressive! 🌟',
  'Splendid! 👏', 'Great! 🎉', 'Phew! 😅',
]

// Two-pass scoring so repeated letters behave like real Wordle: greens are
// claimed first, then ambers only while unmatched instances of that letter
// remain. The old single-pass version marked every occurrence amber, which
// taught students inferences that don't hold.
function evaluateGuess(guess, word) {
  const result = Array(WORD_LENGTH).fill('absent')
  const pool   = {}

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === word[i]) result[i] = 'correct'
    else pool[word[i]] = (pool[word[i]] || 0) + 1
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue
    const letter = guess[i]
    if (pool[letter] > 0) { result[i] = 'present'; pool[letter]-- }
  }
  return result
}

function computeLetterStates(guesses, word) {
  const priority = { correct: 3, present: 2, absent: 1 }
  const states = {}
  guesses.forEach(guess => {
    const results = evaluateGuess(guess, word)
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = guess[i]
      const result = results[i]
      if (!states[letter] || priority[result] > priority[states[letter]]) {
        states[letter] = result
      }
    }
  })
  return states
}

// Stars scale with how few guesses it took: 6 guesses = 1⭐, 1 guess = 6⭐.
// Emitted as one star per tier crossed, mirroring Spelling Bee's milestones —
// ux_stars_dedupe is unique on subtype, so they coexist under one daily key.
function starTiers(guessCount) {
  const tiers = []
  for (let n = MAX_GUESSES; n >= guessCount; n--) tiers.push(`solve_${n}`)
  return tiers
}

// Students type plain letters; ES answers are stored accent-stripped.
const ACCENTED = 'ÁÉÍÓÚÜ'
const PLAIN    = 'AEIOUU'
function stripAccents(w) {
  return w.replace(/[ÁÉÍÓÚÜ]/g, c => PLAIN[ACCENTED.indexOf(c)])
}

export default function WordleGame({ onBack, classPuzzle = null }) {
  const location  = useLocation()
  const teacherMode = !!classPuzzle  // Class Play: specific word, no stars/session writes
  const [isSpanish, setIsSpanish] = useState(classPuzzle ? classPuzzle.language === 'es' : (location.state?.isSpanish || false))
  const language = isSpanish ? 'es' : 'en'

  const [word, setWord]           = useState('')
  // Tiles always show the accent-stripped form (the keyboard has no accent
  // keys); displayWord carries the correct spelling for the reveal and the
  // sentence challenge, so BUZON is revealed as BUZÓN.
  const [displayWord, setDisplayWord] = useState('')
  const [guesses, setGuesses]     = useState([])
  const [current, setCurrent]     = useState('')
  const [gameState, setGameState] = useState('loading')
  const [message, setMessage]     = useState('')
  const [shaking, setShaking]     = useState(false)
  const [locked, setLocked]       = useState(false)

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [showChallenge, setShowChallenge]       = useState(false)

  const [solveStars, setSolveStars]   = useState(0)
  const [sentenceStar, setSentenceStar] = useState(false)

  // Guess dictionary: the 5-letter subset, loaded as its own chunk when the
  // game opens. null = not loaded yet or failed, in which case we accept any
  // five letters rather than lock a student out on a bad connection.
  const [dictionary, setDictionary] = useState(null)
  // Set when the dictionary chunk can't be fetched, so the game can say so
  // rather than silently accepting anything.
  const [dictionaryFailed, setDictionaryFailed] = useState(false)

  const today    = new Date().toISOString().slice(0, 10)
  const stateRef = useRef({ word: '', guesses: [], current: '', gameState: 'loading' })
  const inputRef = useRef(null)

  // `dictionary` is mirrored here too: the keydown listener is bound once on
  // mount, so anything it reads from the closure is frozen at first render
  // (when the dictionary is still null) and validation would never run for
  // people typing on a physical keyboard.
  useEffect(() => { stateRef.current = { word, displayWord, guesses, current, gameState, dictionary } })

  useEffect(() => {
    initDaily()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Class Play can waive validation per puzzle; a teacher word is always
  // accepted even when it sits outside the dictionary.
  const validationOn = teacherMode ? classPuzzle.validateGuesses !== false : true

  useEffect(() => {
    if (!validationOn) return
    let cancelled = false
    ;(async () => {
      try {
        const mod = isSpanish
          ? await import('./data/wordleWords.es.js')
          : await import('./data/wordleWords.en.js')
        if (!cancelled) { setDictionary(new Set(mod.WORDS)); setDictionaryFailed(false) }
      } catch (e) {
        console.warn('Wordle dictionary failed to load, validation off:', e)
        if (!cancelled) setDictionaryFailed(true)
      }
    })()
    return () => { cancelled = true }
  }, [isSpanish, validationOn])

  useEffect(() => {
    if ((gameState === 'won' || gameState === 'lost') && !sentenceDone) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [gameState, sentenceDone])

  async function initDaily() {
    // Class Play: a specific word is supplied; play it fresh, no session/stars.
    if (teacherMode) {
      setWord((classPuzzle.word || '').toUpperCase())
      setDisplayWord((classPuzzle.display_word || classPuzzle.word || '').toUpperCase())
      setGameState('playing')
      return
    }

    // language: use location.state if set (teacher track simulation),
    // otherwise detect from real profile tracks
    const { data: { user } } = await supabase.auth.getUser()
    let lang = location.state?.isSpanish ? 'es' : 'en'
    if (lang === 'en' && user) {
      const { data: prof } = await supabase.from('profiles').select('tracks, level').eq('id', user.id).single()
      const isSpanishProfile = (prof?.tracks || []).map(t => t.toLowerCase()).includes('spanish') || prof?.level === 'Spanish'
      if (isSpanishProfile) { setIsSpanish(true); lang = 'es' }
    }

    const { data: wordRow } = await supabase
      .from('wordle_words').select('word, display_word')
      .eq('play_date', today).eq('language', lang).single()

    if (!wordRow) { setGameState('noword'); return }
    const w = wordRow.word.toUpperCase()
    const shown = (wordRow.display_word || wordRow.word).toUpperCase()
    setWord(w)
    setDisplayWord(shown)

    if (user) {
      const { data: session } = await supabase
        .from('wordle_sessions').select('*')
        .eq('student_id', user.id).eq('play_date', today).single()

      if (session) {
        const g = session.guesses || []
        setGuesses(g)
        setSentenceDone(session.sentence_done || false)
        // `||` not `??`: solve_stars is NOT NULL DEFAULT 0, so a session written by the
        // pre-tiered-stars build has 0 here rather than null. `??` would keep that 0 and
        // the solve_star fallback would never run — zeroing a solved game's stars on reload.
        setSolveStars(session.solve_stars || (session.solve_star ? 1 : 0))
        setSentenceStar(session.sentence_star || false)
        if (session.solved) {
          setGameState('won')
          setMessage(WIN_MESSAGES[g.length - 1] || 'Well done!')
        } else if (g.length >= MAX_GUESSES) {
          setGameState('lost')
          setMessage(isSpanish ? `La palabra era ${shown}` : `The word was ${shown}`)
        } else {
          setGameState('playing')
        }
        return
      }
    }
    setGameState('playing')
  }

  function handleKeyDown(e) {
    const { gameState } = stateRef.current
    if (gameState !== 'playing') return
    const key = e.key.toUpperCase()
    if (key === 'ENTER')           submitGuess()
    else if (key === 'BACKSPACE')  setCurrent(c => c.slice(0, -1))
    else if (/^[A-ZÑÁÉÍÓÚ]$/.test(key) || key === 'Ñ') setCurrent(c => c.length < WORD_LENGTH ? c + stripAccents(key) : c)
  }

  function handleVirtualKey(key) {
    if (stateRef.current.gameState !== 'playing') return
    if (key === 'ENTER')  submitGuess()
    else if (key === '⌫') setCurrent(c => c.slice(0, -1))
    else if (/^[A-ZÑÁÉÍÓÚ]$/.test(key) || key === 'Ñ') setCurrent(c => c.length < WORD_LENGTH ? c + stripAccents(key) : c)
  }

  async function submitGuess() {
    const { current, word, displayWord, guesses, gameState, dictionary } = stateRef.current
    if (gameState !== 'playing' || locked) return

    if (current.length < WORD_LENGTH) {
      setShaking(true)
      setMessage(isSpanish ? 'Faltan letras' : 'Not enough letters')
      setTimeout(() => { setShaking(false); setMessage('') }, 800)
      return
    }

    // Real words only. The guess is not consumed on a rejection, and the answer
    // itself always passes even if it somehow isn't in the guess list.
    if (dictionary && current !== word && !dictionary.has(current.toLowerCase())) {
      setShaking(true)
      setMessage(isSpanish ? 'No está en la lista' : 'Not in word list')
      setTimeout(() => { setShaking(false); setMessage('') }, 800)
      return
    }

    setLocked(true)
    const newGuesses = [...guesses, current]
    const won  = current === word
    const lost = !won && newGuesses.length >= MAX_GUESSES

    setGuesses(newGuesses)
    setCurrent('')

    if (won) {
      const tiers = starTiers(newGuesses.length)
      setMessage(WIN_MESSAGES[newGuesses.length - 1] || 'Well done!')
      setGameState('won')
      setSolveStars(tiers.length)
      await saveSession(newGuesses, true, false, false, tiers.length, false)
      await insertSolveStars(tiers, word)
    } else if (lost) {
      setMessage(isSpanish
        ? `La palabra era ${displayWord || word}`
        : `The word was ${displayWord || word}`)
      setGameState('lost')
      await saveSession(newGuesses, false, false, false, 0, false)
    }
    setLocked(false)
  }

  async function saveSession(g, solved, sentDone, sentStar, solStars) {
    if (teacherMode) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('wordle_sessions').upsert({
      student_id: user.id, play_date: today,
      guesses: g, solved,
      sentence_done: sentDone, solve_star: solStars > 0, solve_stars: solStars,
      sentence_star: sentStar,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,play_date' })
  }

  // One row per tier crossed. supabase-js can't target the expression-based
  // partial index, so insert plainly and swallow 23505.
  async function insertSolveStars(tiers, w) {
    if (teacherMode) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dedupe_key = `daily:${today}:${language}`
    const rows = tiers.map(subtype => ({
      student_id: user.id,
      source:     'wordle',
      subtype,
      context:    { word: w.toLowerCase(), language, play_date: today, dedupe_key },
    }))
    const { error } = await supabase.from('stars').insert(rows)
    if (error && error.code !== '23505') console.warn('Wordle star insert failed:', error)
  }

  async function insertStar(type, w) {
    // 'sentence' is now handled by SentenceChallenge directly — skip.
    if (type === 'sentence' || teacherMode) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Anti-farming via ux_stars_dedupe partial unique index.
    // Daily: one star per day per language (regardless of which word).
    const dedupe_key = `daily:${today}:${language}`
    const { error } = await supabase.from('stars').insert({
      student_id: user.id,
      source:     'wordle',
      subtype:    type,
      context:    { word: w.toLowerCase(), language, play_date: today, dedupe_key },
    })
    if (error && error.code !== '23505') console.warn('Wordle star insert failed:', error)
  }

  async function handleSentenceMarked({ sentence, inputMethod, result }) {
    // SentenceChallenge has already written to sentence_challenges. Our job here:
    // game-level bookkeeping (star + session upsert + feedback display).
    const data = result || { valid: null }
    setSentenceFeedback(data)
    if (data.valid) {
      setSentenceStar(true)
      await insertStar('sentence', word)
    }
    await saveSession(guesses, gameState === 'won', true, data.valid, solveStars)
    setSentenceDone(true)
  }

  const letterStates = computeLetterStates(guesses, word)
  const gameOver     = gameState === 'won' || gameState === 'lost'
  const totalStars   = solveStars + (sentenceStar ? 1 : 0)

  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      {isSpanish ? 'Cargando...' : 'Loading today\'s puzzle...'}
    </div>
  )

  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🟩</div>
      <h2 style={{ color: '#2d3748' }}>{isSpanish ? 'Sin puzzle hoy' : 'No puzzle today'}</h2>
      <p style={{ color: '#718096' }}>{isSpanish ? '¡Vuelve mañana!' : 'Check back tomorrow!'}</p>
      {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>← Back</button>}
    </div>
    </div>
  )

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

      {/* Header */}
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.25rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1rem', position: 'relative' }}>
        <HelpSheet
          title="How to play"
          points={[
            'Guess the 5-letter word in 6 tries.',
            'Green: right letter, right place. Amber: right letter, wrong place. Grey: not in the word.',
            "Every guess must be a real word. Names, places and abbreviations don't count.",
            ...(isSpanish
              ? [<>Accents aren't needed — type <strong>facil</strong> and it counts as <strong>fácil</strong>.</>]
              : []),
            'Stars: solved in 6 = 1⭐, 5 = 2⭐, 4 = 3⭐… 1 guess = 6⭐. Plus one more for a good sentence.',
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '1.7rem', letterSpacing: '6px', fontWeight: 800 }}>WORDLE</h1>
          {isSpanish && <span style={{ fontSize: '1.2rem' }}>🇪🇸</span>}
        </div>
        <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
          {isSpanish ? 'Adivina la palabra de hoy en 6 intentos' : 'Guess today\'s 5-letter word in 6 tries'}
        </p>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          textAlign: 'center', marginBottom: '0.75rem', padding: '9px 16px', borderRadius: '8px',
          fontWeight: 700, fontSize: '0.95rem',
          background: gameState === 'won' ? '#f0fff4' : gameState === 'lost' ? '#fff5f5' : '#2d3748',
          color:      gameState === 'won' ? '#276749' : gameState === 'lost' ? '#c53030' : 'white',
          border:     gameState === 'won' ? '1px solid #c6f6d5' : gameState === 'lost' ? '1px solid #fed7d7' : 'none',
        }}>
          {message}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '1rem', alignItems: 'center' }}>
        {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
          const isRevealed = rowIdx < guesses.length
          const isActive   = rowIdx === guesses.length && gameState === 'playing'
          const guess      = guesses[rowIdx] || ''
          const letters    = isActive ? current : guess
          const rowResults = isRevealed ? evaluateGuess(guess, word) : null
          return (
            <div key={rowIdx} style={{ display: 'flex', gap: '5px', animation: isActive && shaking ? 'shake 0.5s ease' : 'none' }}>
              {Array.from({ length: WORD_LENGTH }).map((_, colIdx) => {
                const letter = letters[colIdx] || ''
                let bg = 'white', border = '#d3d6da', color = '#2d3748'
                if (isRevealed && letter) {
                  const result = rowResults[colIdx]
                  bg = COLOURS[result]; border = COLOURS[result]; color = 'white'
                } else if (isActive && letter) { border = '#878a8c' }
                return (
                  <div key={colIdx} style={{
                    width: '56px', height: '56px', border: `2px solid ${border}`, borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', fontWeight: 800, color, background: bg, userSelect: 'none',
                    transition: isRevealed ? `background 0.1s ease ${colIdx * 0.12}s, border-color 0.1s ease ${colIdx * 0.12}s, color 0.1s ease ${colIdx * 0.12}s` : 'none',
                  }}>
                    {letter}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Keyboard */}
      {gameState === 'playing' && (
        <>
          {dictionaryFailed && (
            <div style={{
              maxWidth: '340px', margin: '0 auto 0.6rem', padding: '8px 12px',
              background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: '10px',
              fontSize: '0.72rem', color: '#92400e', textAlign: 'center', lineHeight: 1.4,
            }}>
              {isSpanish
                ? 'No se pudo cargar la lista de palabras, así que hoy no se comprueban las palabras. Recarga la página para intentarlo de nuevo.'
                : "Couldn't load the word list, so guesses aren't being checked. Reload the page to try again."}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
            {[['#538d4e','Correct'], ['#b59f3b','Wrong position'], ['#787c7e','Not in word']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#718096' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: c, borderRadius: '2px' }} />{l}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', marginBottom: '1rem' }}>
            {(isSpanish ? ES_KEYBOARD_ROWS : EN_KEYBOARD_ROWS).map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: '4px' }}>
                {row.map(key => {
                  const state = letterStates[key]
                  const isWide = key === 'ENTER' || key === '⌫'
                  let bg = '#d3d6da', color = '#2d3748'
                  if (state === 'correct') { bg = COLOURS.correct; color = 'white' }
                  else if (state === 'present') { bg = COLOURS.present; color = 'white' }
                  else if (state === 'absent')  { bg = COLOURS.absent;  color = 'white' }
                  return (
                    <button key={key} onClick={() => handleVirtualKey(key)} style={{
                      width: isWide ? '60px' : key === 'Ñ' ? '30px' : '34px', height: '52px',
                      background: bg, color, border: 'none', borderRadius: '4px',
                      fontSize: isWide ? '0.62rem' : '0.9rem', fontWeight: 700,
                      cursor: 'pointer', userSelect: 'none', transition: 'background 0.2s ease',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, padding: 0,
                    }}>
                      {key}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sentence challenge */}
      {gameOver && !sentenceDone && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
            {isSpanish ? '✍️ ¡Ahora úsala en una frase!' : '✍️ Now use it in a sentence!'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>
            {isSpanish
              ? `Usa la palabra "${(displayWord || word).toLowerCase()}" en una frase. Si no sabes lo que significa, ¡inténtalo igualmente!`
              : `Use the word "${(displayWord || word).toLowerCase()}" in a sentence. Not sure what it means? Have a go anyway!`}
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

      {/* Sentence feedback + stars + buttons */}
      {gameOver && sentenceDone && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          {sentenceFeedback && (
            <div style={{
              padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
              background: sentenceFeedback.valid ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${sentenceFeedback.valid ? '#c6f6d5' : '#fed7d7'}`,
              color: sentenceFeedback.valid ? '#276749' : '#9b2c2c',
              fontSize: '0.9rem', lineHeight: 1.5,
            }}>
              {sentenceFeedback.valid ? '✅ ' : '❌ '}{sentenceFeedback.reason}
            </div>
          )}

          {totalStars > 0 ? (
            <div style={{ textAlign: 'center', marginBottom: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '2rem', marginBottom: '2px' }}>{Array(totalStars).fill('⭐️').join(' ')}</div>
              <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                {solveStars > 0 && sentenceStar
                  ? (isSpanish
                      ? `¡Resuelto en ${guesses.length} + frase correcta!`
                      : `Solved in ${guesses.length} + great sentence!`)
                  : solveStars > 0
                  ? (isSpanish
                      ? `¡Resuelto en ${guesses.length} ${guesses.length === 1 ? 'intento' : 'intentos'}!`
                      : `Solved in ${guesses.length} ${guesses.length === 1 ? 'guess' : 'guesses'}!`)
                  : (isSpanish ? '¡Frase correcta!' : 'Great sentence!')}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {isSpanish ? 'Sin estrellas esta vez — ¡sigue intentando! 💪' : 'No stars this time — keep going! 💪'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {onBack && (
              <button onClick={onBack} style={{ padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
                ← {isSpanish ? 'Volver' : 'Back'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
    {showChallenge && word && (
      <SentenceChallenge
        word={(displayWord || word).toLowerCase()}
        language={language}
        exercise="wordle"
        apiContext="challenge"
        dedupeKey={`daily:${today}:${language}`}
        onMarkResult={handleSentenceMarked}
        noStars={teacherMode}
        onClose={() => setShowChallenge(false)}
      />
    )}
    <style>{`
      @keyframes shake {
        0%,100% { transform: translateX(0) }
        20%      { transform: translateX(-8px) }
        40%      { transform: translateX(8px) }
        60%      { transform: translateX(-4px) }
        80%      { transform: translateX(4px) }
      }
    `}</style>
    </div>
  )
}
