import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'

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

function getTileResult(guess, word, col) {
  const letter = guess[col]
  if (letter === word[col]) return 'correct'
  if (word.includes(letter)) return 'present'
  return 'absent'
}

function computeLetterStates(guesses, word) {
  const priority = { correct: 3, present: 2, absent: 1 }
  const states = {}
  guesses.forEach(guess => {
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = guess[i]
      const result = getTileResult(guess, word, i)
      if (!states[letter] || priority[result] > priority[states[letter]]) {
        states[letter] = result
      }
    }
  })
  return states
}

export default function WordleGame({ onBack }) {
  const location  = useLocation()
  const [isSpanish, setIsSpanish] = useState(location.state?.isSpanish || false)
  const language = isSpanish ? 'es' : 'en'

  const [mode, setMode]           = useState('daily')
  const [word, setWord]           = useState('')
  const [guesses, setGuesses]     = useState([])
  const [current, setCurrent]     = useState('')
  const [gameState, setGameState] = useState('loading')
  const [message, setMessage]     = useState('')
  const [shaking, setShaking]     = useState(false)
  const [locked, setLocked]       = useState(false)

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [sentenceInput, setSentenceInput]       = useState('')
  const [sentenceChecking, setSentenceChecking] = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)

  const [solveStar, setSolveStar]     = useState(false)
  const [sentenceStar, setSentenceStar] = useState(false)

  const [showHelp, setShowHelp] = useState(false)
  const today    = new Date().toISOString().slice(0, 10)
  const stateRef = useRef({ word: '', guesses: [], current: '', gameState: 'loading' })
  const inputRef = useRef(null)

  useEffect(() => { stateRef.current = { word, guesses, current, gameState } })

  useEffect(() => {
    initDaily()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if ((gameState === 'won' || gameState === 'lost') && !sentenceDone) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [gameState, sentenceDone])

  async function initDaily() {
    setMode('daily')

    // language: use location.state if set (teacher track simulation),
    // otherwise detect from real profile tracks
    const { data: { user } } = await supabase.auth.getUser()
    let lang = location.state?.isSpanish ? 'es' : 'en'
    if (lang === 'en' && user) {
      const { data: prof } = await supabase.from('profiles').select('tracks').eq('id', user.id).single()
      if ((prof?.tracks || []).includes('spanish')) { setIsSpanish(true); lang = 'es' }
    }

    const { data: wordRow } = await supabase
      .from('wordle_words').select('word')
      .eq('play_date', today).eq('language', lang).single()

    if (!wordRow) { setGameState('noword'); return }
    const w = wordRow.word.toUpperCase()
    setWord(w)

    if (user) {
      const { data: session } = await supabase
        .from('wordle_sessions').select('*')
        .eq('student_id', user.id).eq('play_date', today).single()

      if (session) {
        const g = session.guesses || []
        setGuesses(g)
        setSentenceDone(session.sentence_done || false)
        setSolveStar(session.solve_star || false)
        setSentenceStar(session.sentence_star || false)
        if (session.solved) {
          setGameState('won')
          setMessage(WIN_MESSAGES[g.length - 1] || 'Well done!')
        } else if (g.length >= MAX_GUESSES) {
          setGameState('lost')
          setMessage(isSpanish ? `La palabra era ${w}` : `The word was ${w}`)
        } else {
          setGameState('playing')
        }
        return
      }
    }
    setGameState('playing')
  }

  async function startPractice() {
    setGameState('loading')
    setGuesses([]); setCurrent(''); setMessage('')
    setSentenceDone(false); setSentenceInput(''); setSentenceFeedback(null)
    setSolveStar(false); setSentenceStar(false)
    setMode('practice')

    const { data } = await supabase
      .from('wordle_words').select('word')
      .eq('language', language)
      .or(`play_date.is.null,play_date.lt.${today}`)

    if (!data || data.length === 0) { setGameState('noword'); return }
    const pool = data.map(r => r.word.toUpperCase())
    setWord(pool[Math.floor(Math.random() * pool.length)])
    setGameState('playing')
  }

  function handleKeyDown(e) {
    const { gameState } = stateRef.current
    if (gameState !== 'playing') return
    const key = e.key.toUpperCase()
    if (key === 'ENTER')           submitGuess()
    else if (key === 'BACKSPACE')  setCurrent(c => c.slice(0, -1))
    else if (/^[A-ZÑÁÉÍÓÚ]$/.test(key) || key === 'Ñ') setCurrent(c => c.length < WORD_LENGTH ? c + key : c)
  }

  function handleVirtualKey(key) {
    if (stateRef.current.gameState !== 'playing') return
    if (key === 'ENTER')  submitGuess()
    else if (key === '⌫') setCurrent(c => c.slice(0, -1))
    else if (/^[A-ZÑÁÉÍÓÚ]$/.test(key) || key === 'Ñ') setCurrent(c => c.length < WORD_LENGTH ? c + key : c)
  }

  async function submitGuess() {
    const { current, word, guesses, gameState } = stateRef.current
    if (gameState !== 'playing' || locked) return

    if (current.length < WORD_LENGTH) {
      setShaking(true)
      setMessage(isSpanish ? 'Faltan letras' : 'Not enough letters')
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
      const earnedSolve = newGuesses.length <= 5
      setMessage(WIN_MESSAGES[newGuesses.length - 1] || 'Well done!')
      setGameState('won')
      if (earnedSolve) setSolveStar(true)
      await saveSession(newGuesses, true, false, false, earnedSolve, false)
      if (earnedSolve) await insertStar('solve', word, mode === 'practice')
    } else if (lost) {
      setMessage(isSpanish ? `La palabra era ${word}` : `The word was ${word}`)
      setGameState('lost')
      await saveSession(newGuesses, false, false, false, false, false)
    }
    setLocked(false)
  }

  async function saveSession(g, solved, sentDone, sentStar, solStar) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || mode === 'practice') return
    await supabase.from('wordle_sessions').upsert({
      student_id: user.id, play_date: today,
      guesses: g, solved,
      sentence_done: sentDone, solve_star: solStar, sentence_star: sentStar,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'student_id,play_date' })
  }

  async function insertStar(type, w, isPractice) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('wordle_stars').insert({
      student_id: user.id, type, word: w.toLowerCase(), language, is_practice: isPractice,
    })
  }

  async function submitSentence() {
    if (!sentenceInput.trim() || sentenceChecking) return
    setSentenceChecking(true)
    try {
      const res = await fetch('/api/mark-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sentence', word: word.toLowerCase(), sentence: sentenceInput.trim(), language }),
      })
      const data = await res.json()
      setSentenceFeedback(data)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('sentence_challenges').insert({
          student_id: user.id, exercise: 'wordle', word: word.toLowerCase(), language,
          sentence: sentenceInput.trim(), is_correct: data.valid,
          ai_feedback: data.reason, is_practice: mode === 'practice',
        })
      }
      if (data.valid) {
        setSentenceStar(true)
        await insertStar('sentence', word, mode === 'practice')
      }
      await saveSession(guesses, gameState === 'won', true, data.valid, solveStar)
    } catch {
      setSentenceFeedback({ valid: true, reason: isSpanish ? '¡Bien hecho!' : 'Good effort!' })
      setSentenceStar(true)
      await saveSession(guesses, gameState === 'won', true, true, solveStar)
    }
    setSentenceDone(true)
    setSentenceChecking(false)
  }

  const letterStates = computeLetterStates(guesses, word)
  const gameOver     = gameState === 'won' || gameState === 'lost'
  const totalStars   = (solveStar ? 1 : 0) + (sentenceStar ? 1 : 0)

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '1.7rem', letterSpacing: '6px', fontWeight: 800 }}>WORDLE</h1>
          {isSpanish && <span style={{ fontSize: '1.2rem' }}>🇪🇸</span>}
        </div>
        <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
          {mode === 'practice'
            ? (isSpanish ? 'Modo práctica' : 'Practice mode')
            : (isSpanish ? 'Adivina la palabra de hoy en 6 intentos' : 'Guess today\'s 5-letter word in 6 tries')}
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
          return (
            <div key={rowIdx} style={{ display: 'flex', gap: '5px', animation: isActive && shaking ? 'shake 0.5s ease' : 'none' }}>
              {Array.from({ length: WORD_LENGTH }).map((_, colIdx) => {
                const letter = letters[colIdx] || ''
                let bg = 'white', border = '#d3d6da', color = '#2d3748'
                if (isRevealed && letter) {
                  const result = getTileResult(guess, word, colIdx)
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
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '10px' }}>
            {isSpanish
              ? `Usa la palabra "${word.toLowerCase()}" en una frase. Si no sabes lo que significa, ¡inténtalo igualmente!`
              : `Use the word "${word.toLowerCase()}" in a sentence. Not sure what it means? Have a go anyway!`}
          </div>
          <textarea
            ref={inputRef}
            value={sentenceInput}
            onChange={e => setSentenceInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitSentence() } }}
            placeholder={isSpanish ? 'Escribe tu frase aquí...' : 'Type your sentence here...'}
            rows={2}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', border: '2px solid #667eea', borderRadius: '8px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', backgroundColor: '#f7f7ff' }}
          />
          <div style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '4px 0 8px', textAlign: 'right' }}>
            {isSpanish ? 'Gana ⭐️ por una buena frase' : 'Earn ⭐️ for a good sentence'}
          </div>
          <button onClick={submitSentence} disabled={!sentenceInput.trim() || sentenceChecking}
            style={{
              width: '100%', padding: '0.75rem',
              background: sentenceInput.trim() && !sentenceChecking ? GRADIENT : '#cbd5e0',
              color: 'white', border: 'none', borderRadius: '8px',
              fontWeight: 700, fontSize: '0.95rem',
              cursor: sentenceInput.trim() && !sentenceChecking ? 'pointer' : 'not-allowed',
            }}>
            {sentenceChecking ? (isSpanish ? '🤖 Comprobando...' : '🤖 Checking...') : (isSpanish ? 'Comprobar frase' : 'Check my sentence')}
          </button>
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
                {solveStar && sentenceStar
                  ? (isSpanish ? '¡Palabra encontrada + frase correcta!' : 'Word found + great sentence!')
                  : solveStar
                  ? (isSpanish ? '¡Palabra encontrada en ≤5 intentos!' : 'Word found in 5 or fewer guesses!')
                  : (isSpanish ? '¡Frase correcta!' : 'Great sentence!')}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {isSpanish ? 'Sin estrellas esta vez — ¡sigue intentando! 💪' : 'No stars this time — keep going! 💪'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={startPractice} style={{ padding: '0.75rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              🎮 {isSpanish ? 'Jugar otra vez (práctica)' : 'Play again (practice)'}
            </button>
            {onBack && (
              <button onClick={onBack} style={{ padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
                ← {isSpanish ? 'Volver' : 'Back'}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
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
