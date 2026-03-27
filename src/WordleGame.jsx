import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const WORD_LENGTH = 5
const MAX_GUESSES = 6
const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
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
  const [word, setWord]           = useState('')
  const [guesses, setGuesses]     = useState([])
  const [current, setCurrent]     = useState('')
  const [gameState, setGameState] = useState('loading')
  const [message, setMessage]     = useState('')
  const [shaking, setShaking]     = useState(false)

  // Ref so keyboard handler always reads fresh state without re-registering
  const stateRef = useRef({ word: '', guesses: [], current: '', gameState: 'loading' })
  useEffect(() => {
    stateRef.current = { word, guesses, current, gameState }
  })

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    init()
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function init() {
    const { data: wordRow } = await supabase
      .from('wordle_words').select('word').eq('play_date', today).single()

    if (!wordRow) { setGameState('noword'); return }

    const w = wordRow.word.toUpperCase()
    setWord(w)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: session } = await supabase
        .from('wordle_sessions').select('*')
        .eq('student_id', user.id).eq('play_date', today).single()

      if (session) {
        const g = session.guesses || []
        setGuesses(g)
        if (session.solved) {
          setGameState('won')
          setMessage(WIN_MESSAGES[g.length - 1] || 'Well done!')
        } else if (g.length >= MAX_GUESSES) {
          setGameState('lost')
          setMessage(`The word was ${w}`)
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
    if (key === 'ENTER')     submitGuess()
    else if (key === 'BACKSPACE') setCurrent(c => c.slice(0, -1))
    else if (/^[A-Z]$/.test(key)) setCurrent(c => c.length < WORD_LENGTH ? c + key : c)
  }

  function handleVirtualKey(key) {
    if (stateRef.current.gameState !== 'playing') return
    if (key === 'ENTER')  submitGuess()
    else if (key === '⌫') setCurrent(c => c.slice(0, -1))
    else                  setCurrent(c => c.length < WORD_LENGTH ? c + key : c)
  }

  async function submitGuess() {
    const { current, word, guesses, gameState } = stateRef.current
    if (gameState !== 'playing') return

    if (current.length < WORD_LENGTH) {
      setShaking(true)
      setMessage('Not enough letters')
      setTimeout(() => { setShaking(false); setMessage('') }, 800)
      return
    }

    const newGuesses = [...guesses, current]
    const won  = current === word
    const lost = !won && newGuesses.length >= MAX_GUESSES

    setGuesses(newGuesses)
    setCurrent('')

    if (won) {
      setMessage(WIN_MESSAGES[newGuesses.length - 1] || 'Well done!')
      setGameState('won')
    } else if (lost) {
      setMessage(`The word was ${word}`)
      setGameState('lost')
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('wordle_sessions').upsert({
        student_id: user.id, play_date: today,
        guesses: newGuesses, solved: won,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'student_id,play_date' })
    }
  }

  const letterStates   = computeLetterStates(guesses, word)
  const activeRowIndex = guesses.length

  // ── Loading ───────────────────────────────────────
  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      Loading today's puzzle...
    </div>
  )

  // ── No word for today ─────────────────────────────
  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🟩</div>
      <h2 style={{ color: '#2d3748' }}>No puzzle today</h2>
      <p style={{ color: '#718096' }}>Check back tomorrow!</p>
      {onBack && (
        <button onClick={onBack} style={{ padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
          ← Back
        </button>
      )}
    </div>
    </div>
  )

  // ── Main game ─────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 2rem' }}>

      {/* Header */}
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.5rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '6px', fontWeight: 800 }}>WORDLE</h1>
        <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '0.88rem' }}>
          Guess today's 5-letter word in 6 tries
        </p>
      </div>

      {/* Message bar */}
      {message && (
        <div style={{
          textAlign: 'center', marginBottom: '1rem', padding: '10px 20px',
          borderRadius: '8px', fontWeight: 700, fontSize: '1rem',
          background: gameState === 'won' ? '#f0fff4' : gameState === 'lost' ? '#fff5f5' : '#2d3748',
          color:      gameState === 'won' ? '#276749' : gameState === 'lost' ? '#c53030' : 'white',
          border:     gameState === 'won' ? '1px solid #c6f6d5' : gameState === 'lost' ? '1px solid #fed7d7' : 'none',
        }}>
          {message}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.25rem', alignItems: 'center' }}>
        {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
          const isRevealed = rowIdx < guesses.length
          const isActive   = rowIdx === activeRowIndex && gameState === 'playing'
          const guess      = guesses[rowIdx] || ''
          const letters    = isActive ? current : guess

          return (
            <div key={rowIdx} style={{
              display: 'flex', gap: '6px',
              animation: isActive && shaking ? 'shake 0.5s ease' : 'none',
            }}>
              {Array.from({ length: WORD_LENGTH }).map((_, colIdx) => {
                const letter = letters[colIdx] || ''
                let bg = 'white', border = '#d3d6da', color = '#2d3748'

                if (isRevealed && letter) {
                  const result = getTileResult(guess, word, colIdx)
                  bg = COLOURS[result]; border = COLOURS[result]; color = 'white'
                } else if (isActive && letter) {
                  border = '#878a8c'
                }

                return (
                  <div key={colIdx} style={{
                    width: '58px', height: '58px',
                    border: `2px solid ${border}`, borderRadius: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.6rem', fontWeight: 800, color, background: bg,
                    transition: isRevealed
                      ? `background 0.1s ease ${colIdx * 0.12}s, border-color 0.1s ease ${colIdx * 0.12}s, color 0.1s ease ${colIdx * 0.12}s`
                      : 'none',
                    userSelect: 'none',
                  }}>
                    {letter}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '1rem', fontSize: '0.72rem', color: '#718096', flexWrap: 'wrap' }}>
        {[['correct','Correct position'],['present','Wrong position'],['absent','Not in word']].map(([k, label]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ display: 'inline-block', width: '14px', height: '14px', background: COLOURS[k], borderRadius: '3px', flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>

      {/* Keyboard */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', marginBottom: '1.5rem' }}>
        {KEYBOARD_ROWS.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: '5px' }}>
            {row.map(key => {
              const state  = letterStates[key]
              const isWide = key === 'ENTER' || key === '⌫'
              let bg = '#d3d6da', color = '#2d3748'
              if (state === 'correct') { bg = COLOURS.correct; color = 'white' }
              else if (state === 'present') { bg = COLOURS.present; color = 'white' }
              else if (state === 'absent')  { bg = COLOURS.absent;  color = 'white' }
              return (
                <button key={key} onClick={() => handleVirtualKey(key)} style={{
                  width: isWide ? '64px' : '38px', height: '56px',
                  background: bg, color, border: 'none', borderRadius: '4px',
                  fontSize: isWide ? '0.68rem' : '0.95rem', fontWeight: 700,
                  cursor: 'pointer', userSelect: 'none',
                  transition: 'background 0.2s ease',
                }}>
                  {key}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      {onBack && (
        <div style={{ textAlign: 'center' }}>
          {gameState !== 'playing' && (
            <p style={{ color: '#718096', fontSize: '0.88rem', marginBottom: '12px' }}>
              Come back tomorrow for a new word! 🟩
            </p>
          )}
          <button onClick={onBack} style={{
            padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
            background: gameState !== 'playing' ? GRADIENT : 'transparent',
            color:      gameState !== 'playing' ? 'white' : '#718096',
            border:     gameState !== 'playing' ? 'none' : '1px solid #e2e8f0',
          }}>
            ← Back
          </button>
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
