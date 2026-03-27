import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const GRADIENT   = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const MAX_MISTAKES = 4

const RANK_STYLE = {
  1: { bg: '#f9df6d', text: '#2d3748' },
  2: { bg: '#a0c35a', text: '#fff'    },
  3: { bg: '#b0c4ef', text: '#2d3748' },
  4: { bg: '#ba81c5', text: '#fff'    },
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ConnectionsGame({ onBack }) {
  const [groups, setGroups]           = useState([])
  const [tiles, setTiles]             = useState([])
  const [selected, setSelected]       = useState(new Set())
  const [solvedRanks, setSolvedRanks] = useState(new Set())
  const [mistakes, setMistakes]       = useState(0)
  const [gameState, setGameState]     = useState('loading')
  const [message, setMessage]         = useState('')
  const [shaking, setShaking]         = useState(false)
  const [locked, setLocked]           = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: puzzle } = await supabase
      .from('connections_puzzles').select('id').eq('play_date', today).single()

    if (!puzzle) { setGameState('noword'); return }

    const { data: grps } = await supabase
      .from('connections_groups').select('*').eq('puzzle_id', puzzle.id).order('colour_rank')

    if (!grps || grps.length === 0) { setGameState('noword'); return }

    setGroups(grps)
    const allTiles = grps.flatMap(g => g.words.map(w => ({ word: w, rank: g.colour_rank })))
    setTiles(shuffleArray(allTiles))

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: session } = await supabase
        .from('connections_sessions').select('*')
        .eq('student_id', user.id).eq('play_date', today).single()

      if (session) {
        const solved = new Set(session.solved_groups || [])
        setSolvedRanks(solved)
        setMistakes(session.mistakes || 0)
        if (session.won) {
          setSolvedRanks(new Set([1, 2, 3, 4]))
          setGameState('won')
          setMessage("You already solved today's puzzle! 🎉")
        } else if (session.completed) {
          setSolvedRanks(new Set([1, 2, 3, 4]))
          setGameState('lost')
          setMessage('Better luck tomorrow!')
        } else {
          setGameState('playing')
        }
        return
      }
    }
    setGameState('playing')
  }

  function toggleTile(word) {
    if (gameState !== 'playing' || locked) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(word)) next.delete(word)
      else if (next.size < 4) next.add(word)
      return next
    })
  }

  async function submitGuess() {
    if (selected.size !== 4 || gameState !== 'playing' || locked) return
    setLocked(true)

    const selectedWords = [...selected]
    const ranks = selectedWords.map(w => tiles.find(t => t.word === w)?.rank)
    const allSame = ranks.every(r => r === ranks[0])

    if (allSame) {
      const rank = ranks[0]
      const newSolved = new Set([...solvedRanks, rank])
      setSolvedRanks(newSolved)
      setSelected(new Set())
      setMessage('')

      const won = newSolved.size === 4
      if (won) {
        setGameState('won')
        setMessage('Brilliant! You got them all! 🎉')
      }

      await saveSession(newSolved, mistakes, won, won)
      setLocked(false)
    } else {
      // Check if one away
      const rankCounts = {}
      ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1 })
      const isOneAway = Math.max(...Object.values(rankCounts)) === 3

      const newMistakes = mistakes + 1
      setMistakes(newMistakes)
      setShaking(true)
      if (isOneAway) setMessage('One away! 👀')

      setTimeout(() => {
        setShaking(false)
        setSelected(new Set())
        if (isOneAway) setTimeout(() => setMessage(''), 1500)

        if (newMistakes >= MAX_MISTAKES) {
          setSolvedRanks(new Set([1, 2, 3, 4]))
          setGameState('lost')
          setMessage('Hard luck! Here are the answers.')
        }
        setLocked(false)
      }, 600)

      await saveSession(solvedRanks, newMistakes, newMistakes >= MAX_MISTAKES, false)
    }
  }

  async function saveSession(solved, mist, completed, won) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('connections_sessions').upsert({
      student_id: user.id, play_date: today,
      mistakes: mist, solved_groups: [...solved],
      completed, won,
      completed_at: completed ? new Date().toISOString() : null,
    }, { onConflict: 'student_id,play_date' })
  }

  const solvedGroups = groups
    .filter(g => solvedRanks.has(g.colour_rank))
    .sort((a, b) => a.colour_rank - b.colour_rank)

  const activeTiles = tiles.filter(t => !solvedRanks.has(t.rank))

  // ── Loading ───────────────────────────────────────
  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      Loading today's puzzle...
    </div>
  )

  // ── No puzzle ─────────────────────────────────────
  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
      <h2 style={{ color: '#2d3748' }}>No puzzle today</h2>
      <p style={{ color: '#718096' }}>Check back tomorrow!</p>
      {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>← Back</button>}
    </div>
    </div>
  )

  // ── Main game ─────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 2rem' }}>

      {/* Header */}
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.5rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, letterSpacing: '2px' }}>CONNECTIONS</h1>
        <p style={{ margin: '6px 0 0', opacity: 0.85, fontSize: '0.88rem' }}>Group the 16 words into 4 categories</p>
      </div>

      {/* Mistakes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#718096', fontWeight: 500 }}>Mistakes remaining:</span>
        {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
          <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', background: i < (MAX_MISTAKES - mistakes) ? '#2d3748' : '#e2e8f0', transition: 'background 0.3s ease' }} />
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          textAlign: 'center', marginBottom: '0.75rem', padding: '8px 16px',
          borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem',
          background: gameState === 'won' ? '#f0fff4' : gameState === 'lost' ? '#fff5f5' : '#fffbeb',
          color:      gameState === 'won' ? '#276749' : gameState === 'lost' ? '#c53030' : '#92400e',
          border:     gameState === 'won' ? '1px solid #c6f6d5' : gameState === 'lost' ? '1px solid #fed7d7' : '1px solid #fde68a',
        }}>
          {message}
        </div>
      )}

      {/* Solved groups */}
      {solvedGroups.map(g => {
        const s = RANK_STYLE[g.colour_rank]
        return (
          <div key={g.id} style={{ background: s.bg, borderRadius: '8px', padding: '14px 16px', marginBottom: '6px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: s.text, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              {g.category}
            </div>
            <div style={{ fontSize: '0.82rem', color: s.text, opacity: 0.92 }}>
              {g.words.join(' · ')}
            </div>
          </div>
        )
      })}

      {/* Tile grid */}
      {activeTiles.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
          marginBottom: '1rem',
          animation: shaking ? 'shake 0.5s ease' : 'none',
        }}>
          {activeTiles.map(({ word }) => {
            const isSel = selected.has(word)
            return (
              <div key={word} onClick={() => toggleTile(word)} style={{
                height: '64px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSel ? '#2d3748' : 'white',
                color:      isSel ? 'white'   : '#2d3748',
                border: `2px solid ${isSel ? '#2d3748' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: 'clamp(0.55rem, 2.2vw, 0.82rem)',
                cursor: 'pointer', userSelect: 'none',
                textAlign: 'center', padding: '4px 2px',
                lineHeight: 1.2, transition: 'all 0.12s ease',
                overflow: 'hidden',
              }}>
                {word}
              </div>
            )
          })}
        </div>
      )}

      {/* Buttons */}
      {gameState === 'playing' && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => setSelected(new Set())} disabled={selected.size === 0 || locked}
            style={{ padding: '10px 20px', borderRadius: '999px', fontWeight: 600, fontSize: '0.88rem',
              cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
              border: '2px solid #e2e8f0', background: 'white',
              color: selected.size > 0 ? '#2d3748' : '#a0aec0' }}>
            Deselect all
          </button>
          <button onClick={submitGuess} disabled={selected.size !== 4 || locked}
            style={{ padding: '10px 24px', borderRadius: '999px', fontWeight: 700, fontSize: '0.88rem',
              cursor: selected.size === 4 ? 'pointer' : 'not-allowed', border: 'none',
              background: selected.size === 4 ? '#2d3748' : '#e2e8f0',
              color: selected.size === 4 ? 'white' : '#a0aec0',
              transition: 'all 0.15s' }}>
            Submit
          </button>
        </div>
      )}

      {/* Back */}
      {onBack && (
        <div style={{ textAlign: 'center' }}>
          {gameState !== 'playing' && (
            <p style={{ color: '#718096', fontSize: '0.88rem', marginBottom: '12px' }}>
              Come back tomorrow for a new puzzle! 🔗
            </p>
          )}
          <button onClick={onBack} style={{
            padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
            background: gameState !== 'playing' ? GRADIENT : 'transparent',
            color:      gameState !== 'playing' ? 'white'   : '#718096',
            border:     gameState !== 'playing' ? 'none'    : '1px solid #e2e8f0',
          }}>← Back</button>
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
