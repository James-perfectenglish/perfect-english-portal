import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const GRADIENT     = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const MAX_MISTAKES = 4

const RANK_STYLE = {
  1: { bg: '#EEEDFE', text: '#3C3489', border: '#CECBF6' },
  2: { bg: '#AFA9EC', text: '#26215C', border: '#7F77DD' },
  3: { bg: '#7F77DD', text: '#fff',    border: '#534AB7' },
  4: { bg: '#534AB7', text: '#fff',    border: '#3C3489' },
}

const DIFFICULTY = ['Easiest', 'Medium', 'Tricky', 'Hardest']

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
  const [allWords, setAllWords]       = useState([])
  const [mode, setMode]               = useState('daily')
  const [practiceTitle, setPracticeTitle] = useState('')

  // Sentence challenge
  const [sentenceDone, setSentenceDone]         = useState(false)
  const [chosenWord, setChosenWord]             = useState(null)
  const [sentenceInput, setSentenceInput]       = useState('')
  const [sentenceChecking, setSentenceChecking] = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)

  // Stars
  const [solveStar, setSolveStar]       = useState(false)
  const [sentenceStar, setSentenceStar] = useState(false)

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
    setAllWords(allTiles.map(t => t.word))
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
        setSentenceDone(session.sentence_done || false)
        setSolveStar(session.solve_star || false)
        setSentenceStar(session.sentence_star || false)
        if (session.won) {
          setSolvedRanks(new Set([1, 2, 3, 4]))
          setGameState('won')
          setMessage("You already solved today's puzzle! 🎉")
        } else if (session.completed) {
          setSolvedRanks(new Set([1, 2, 3, 4]))
          setGameState('lost')
          setMessage('Hard luck! Here are the answers.')
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
        if (mode === 'daily') { setSolveStar(true); await insertStar('solve') }
      }
      if (mode === 'daily') await saveSession(newSolved, mistakes, won, won, won, false, false)
      setLocked(false)
    } else {
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

      if (mode === 'daily') await saveSession(solvedRanks, newMistakes, newMistakes >= MAX_MISTAKES, false, false, false, false)
    }
  }

  async function saveSession(solved, mist, completed, won, solStar, sentDone, sentStar) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('connections_sessions').upsert({
      student_id:    user.id,
      play_date:     today,
      mistakes:      mist,
      solved_groups: [...solved],
      completed,
      won,
      solve_star:    solStar,
      sentence_done: sentDone,
      sentence_star: sentStar,
      completed_at:  completed ? new Date().toISOString() : null,
    }, { onConflict: 'student_id,play_date' })
  }

  async function startPractice() {
    setGameState('loading')
    setGroups([]); setTiles([]); setSelected(new Set())
    setSolvedRanks(new Set()); setMistakes(0)
    setMessage(''); setAllWords([])
    setSentenceDone(false); setChosenWord(null)
    setSentenceInput(''); setSentenceFeedback(null)
    setSolveStar(false); setSentenceStar(false)
    setMode('practice')

    const { data: puzzles } = await supabase
      .from('connections_puzzles').select('id, title, play_date')
      .lt('play_date', today)

    if (!puzzles || puzzles.length === 0) { setGameState('noword'); return }

    const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)]
    setPracticeTitle(puzzle.title || puzzle.play_date)

    const { data: grps } = await supabase
      .from('connections_groups').select('*').eq('puzzle_id', puzzle.id).order('colour_rank')

    if (!grps || grps.length === 0) { setGameState('noword'); return }

    setGroups(grps)
    const allTiles = grps.flatMap(g => g.words.map(w => ({ word: w, rank: g.colour_rank })))
    setAllWords(allTiles.map(t => t.word))
    setTiles(shuffleArray(allTiles))
    setGameState('playing')
  }

  async function insertStar(type) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('wordle_stars').insert({
      student_id: user.id, type, word: today, language: 'en', is_practice: false,
    })
  }

  async function submitSentence() {
    if (!sentenceInput.trim() || sentenceChecking || !chosenWord) return
    setSentenceChecking(true)
    try {
      const res = await fetch('/api/mark-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: chosenWord.toLowerCase(), sentence: sentenceInput.trim(), language: 'en' }),
      })
      const data = await res.json()
      setSentenceFeedback(data)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('wordle_sentences').insert({
          student_id:  user.id,
          word:        chosenWord.toLowerCase(),
          language:    'en',
          sentence:    sentenceInput.trim(),
          is_correct:  data.valid,
          ai_feedback: data.reason || data.feedback,
          is_practice: false,
        })
      }
      if (data.valid) {
        setSentenceStar(true)
        if (mode === 'daily') await insertStar('sentence')
      }
      if (mode === 'daily') await saveSession(new Set([1,2,3,4]), mistakes, true, gameState === 'won', solveStar, true, data.valid)
    } catch {
      setSentenceFeedback({ valid: true, reason: 'Good effort!' })
      setSentenceStar(true)
      if (mode === 'daily') await saveSession(new Set([1,2,3,4]), mistakes, true, gameState === 'won', solveStar, true, true)
    }
    setSentenceDone(true)
    setSentenceChecking(false)
  }

  const solvedGroups = groups.filter(g => solvedRanks.has(g.colour_rank)).sort((a, b) => a.colour_rank - b.colour_rank)
  const activeTiles  = tiles.filter(t => !solvedRanks.has(t.rank))
  const gameOver     = gameState === 'won' || gameState === 'lost'
  const totalStars   = (solveStar ? 1 : 0) + (sentenceStar ? 1 : 0)

  // ── Loading ───────────────────────────────────────
  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>Loading today's puzzle...</div>
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
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

      {/* Header */}
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.25rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, letterSpacing: '2px' }}>CONNECTIONS</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
          {mode === 'practice' ? `Practice: ${practiceTitle}` : 'Group the 16 words into 4 categories'}
        </p>
      </div>

      {/* Mistakes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#718096', fontWeight: 500 }}>Mistakes remaining:</span>
        {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
          <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', background: i < (MAX_MISTAKES - mistakes) ? '#534AB7' : '#e2e8f0', transition: 'background 0.3s ease' }} />
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          textAlign: 'center', marginBottom: '0.75rem', padding: '8px 16px', borderRadius: '8px',
          fontWeight: 700, fontSize: '0.95rem',
          background: gameState === 'won' ? '#EEEDFE' : gameState === 'lost' ? '#fff5f5' : '#fffbeb',
          color:      gameState === 'won' ? '#3C3489' : gameState === 'lost' ? '#c53030' : '#92400e',
          border:     gameState === 'won' ? '1px solid #CECBF6' : gameState === 'lost' ? '1px solid #fed7d7' : '1px solid #fde68a',
        }}>
          {message}
        </div>
      )}

      {/* Solved groups */}
      {solvedGroups.map(g => {
        const s = RANK_STYLE[g.colour_rank]
        return (
          <div key={g.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '6px', textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.72rem', color: s.text, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px', opacity: 0.7 }}>
              {DIFFICULTY[g.colour_rank - 1]}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: s.text, marginBottom: '3px' }}>
              {g.category}
            </div>
            <div style={{ fontSize: '0.78rem', color: s.text, opacity: 0.85 }}>
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
                background: isSel ? '#534AB7' : 'white',
                color:      isSel ? 'white'   : '#2d3748',
                border:     `2px solid ${isSel ? '#534AB7' : '#e2e8f0'}`,
                borderRadius: '8px', fontWeight: 700,
                fontSize: 'clamp(0.55rem, 2.2vw, 0.82rem)',
                cursor: 'pointer', userSelect: 'none',
                textAlign: 'center', padding: '4px 2px',
                lineHeight: 1.2, transition: 'all 0.12s ease',
              }}>
                {word}
              </div>
            )
          })}
        </div>
      )}

      {/* Play buttons */}
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
              background: selected.size === 4 ? '#534AB7' : '#e2e8f0',
              color: selected.size === 4 ? 'white' : '#a0aec0',
              transition: 'all 0.15s' }}>
            Submit
          </button>
        </div>
      )}

      {/* Sentence challenge — word picker */}
      {gameOver && !sentenceDone && !chosenWord && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
            ✍️ Now use one of the words in a sentence!
          </div>
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>
            Pick any word from today's puzzle. Not sure what it means? Have a go anyway!
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {allWords.map(w => (
              <button key={w} onClick={() => setChosenWord(w)} style={{
                padding: '6px 12px', borderRadius: '999px', fontWeight: 600, fontSize: '0.8rem',
                background: 'white', border: '2px solid #534AB7', color: '#534AB7',
                cursor: 'pointer', transition: 'all 0.12s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#534AB7'; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#534AB7' }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sentence challenge — input */}
      {gameOver && !sentenceDone && chosenWord && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
            ✍️ Use <span style={{ color: '#534AB7' }}>{chosenWord}</span> in a sentence
          </div>
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '10px' }}>
            Not sure what it means? Have a go — the feedback will tell you!
          </div>
          <textarea
            value={sentenceInput}
            onChange={e => setSentenceInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitSentence() } }}
            placeholder={`Write your sentence using "${chosenWord.toLowerCase()}"...`}
            rows={2}
            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', border: '2px solid #667eea', borderRadius: '8px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', backgroundColor: '#f7f7ff' }}
            autoFocus
          />
          <div style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '4px 0 8px', textAlign: 'right' }}>
            Earn ⭐️ for a good sentence
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setChosenWord(null); setSentenceInput('') }}
              style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.88rem' }}>
              ← Change word
            </button>
            <button onClick={submitSentence} disabled={!sentenceInput.trim() || sentenceChecking}
              style={{ flex: 1, padding: '0.75rem',
                background: sentenceInput.trim() && !sentenceChecking ? GRADIENT : '#cbd5e0',
                color: 'white', border: 'none', borderRadius: '8px',
                fontWeight: 700, fontSize: '0.95rem',
                cursor: sentenceInput.trim() && !sentenceChecking ? 'pointer' : 'not-allowed' }}>
              {sentenceChecking ? '🤖 Checking...' : 'Check my sentence'}
            </button>
          </div>
        </div>
      )}

      {/* Sentence feedback + stars + back */}
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
              {sentenceFeedback.valid ? '✅ ' : '❌ '}{sentenceFeedback.reason || sentenceFeedback.feedback}
            </div>
          )}

          {totalStars > 0 ? (
            <div style={{ textAlign: 'center', marginBottom: '1rem', padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '2rem', marginBottom: '2px' }}>{Array(totalStars).fill('⭐️').join(' ')}</div>
              <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                {solveStar && sentenceStar ? 'Puzzle solved + great sentence!' : solveStar ? 'Puzzle solved!' : 'Great sentence!'}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '1rem' }}>
              No stars this time — keep going! 💪
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {mode === 'daily' && <p style={{ color: '#718096', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 4px' }}>Come back tomorrow for a new puzzle! 🔗</p>}
            <button onClick={startPractice} style={{ padding: '0.75rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
              🎮 Play again (practice)
            </button>
            {onBack && (
              <button onClick={onBack} style={{ padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
                ← Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Back button while playing */}
      {!gameOver && onBack && (
        <div style={{ textAlign: 'center' }}>
          <button onClick={onBack} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0' }}>
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
