import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'
import HelpSheet from './components/HelpSheet'

const GRADIENT     = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const MAX_MISTAKES = 4

const RANK_STYLE = {
  1: { bg: '#f9df6d', text: '#2d2000', border: '#e6c840' },
  2: { bg: '#a0c35a', text: '#1a2d00', border: '#7aaa2a' },
  3: { bg: '#b0c4ef', text: '#0a1f4d', border: '#7a9de0' },
  4: { bg: '#ba81c5', text: '#2d0040', border: '#9a55a8' },
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

export default function ConnectionsGame({ onBack, userProfile, classPuzzle = null }) {
  const location = useLocation()
  const teacherMode = !!classPuzzle  // Class Play: specific puzzle, no stars/session writes

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
  const [puzzleTitle, setPuzzleTitle] = useState('')
  const [language, setLanguage]       = useState('en')

  // Sentence challenge
  const [sentenceDone, setSentenceDone]         = useState(false)
  const [chosenWord, setChosenWord]             = useState(null)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [showChallenge, setShowChallenge]       = useState(false)

  // Stars
  const [solveStar, setSolveStar]       = useState(false)
  const [perfectStar, setPerfectStar]   = useState(false)  // 0 mistakes bonus
  const [sentenceStar, setSentenceStar] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { initDaily() }, [])

  function detectLanguage() {
    if (location.state?.isSpanish) return 'es'
    const tracks = userProfile?.tracks || []
    if (tracks.includes('spanish') || userProfile?.level === 'Spanish') return 'es'
    return 'en'
  }

  async function initDaily() {
    // Class Play: a specific puzzle (with its groups) is supplied; play it fresh, no session/stars.
    if (teacherMode) {
      setLanguage(classPuzzle.language || 'en')
      setPuzzleTitle(classPuzzle.title || '')
      const grps = (classPuzzle.groups || []).slice().sort((a, b) => a.colour_rank - b.colour_rank)
      if (grps.length === 0) { setGameState('noword'); return }
      setGroups(grps)
      const tilesArr = grps.flatMap(g => g.words.map(w => ({ word: w, rank: g.colour_rank })))
      setAllWords(tilesArr.map(t => t.word))
      setTiles(shuffleArray(tilesArr))
      setGameState('playing')
      return
    }

    const lang = detectLanguage()
    setLanguage(lang)

    const { data: puzzle } = await supabase
      .from('connections_puzzles')
      .select('id, title')
      .eq('play_date', today)
      .eq('language', lang)
      .maybeSingle()

    if (!puzzle) { setGameState('noword'); return }

    setPuzzleTitle(puzzle.title || '')

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
        .eq('student_id', user.id).eq('play_date', today).maybeSingle()

      if (session) {
        const solved = new Set(session.solved_groups || [])
        setSolvedRanks(solved)
        setMistakes(session.mistakes || 0)
        setSentenceDone(session.sentence_done || false)
        setSolveStar(session.solve_star || false)
        // Derive perfect-star from session: won with 0 mistakes earned the bonus.
        setPerfectStar(!!session.won && (session.mistakes || 0) === 0)
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
        if (!teacherMode) {
          setSolveStar(true)
          await insertStar('solve')
          if (mistakes === 0) {
            setPerfectStar(true)
            await insertStar('solve_perfect')
          }
        }
      }
      if (!teacherMode) await saveSession(newSolved, mistakes, won, won, won, false, false)
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

      if (!teacherMode) await saveSession(solvedRanks, newMistakes, newMistakes >= MAX_MISTAKES, false, false, false, false)
    }
  }

  async function saveSession(solved, mist, completed, won, solStar, sentDone, sentStar) {
    if (teacherMode) return
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

  async function insertStar(type) {
    if (type === 'sentence' || teacherMode) return  // handled by SentenceChallenge
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const dedupe_key = `${today}:${language}`
    // Anti-farming: ux_stars_dedupe partial unique index will reject re-awards.
    // We swallow 23505 (unique violation) silently so retries are no-ops.
    const { error } = await supabase.from('stars').insert({
      student_id: user.id,
      source:     'connections',
      subtype:    type,
      context:    { play_date: today, language, mistakes, dedupe_key },
    })
    if (error && error.code !== '23505') console.warn('Connections star insert failed:', error)
  }

  async function handleSentenceMarked({ sentence, inputMethod, result }) {
    // SentenceChallenge has already written to sentence_challenges. Game-level
    // bookkeeping only: set feedback, award local star, upsert session.
    const data = result || { valid: null }
    setSentenceFeedback(data)
    if (data.valid === true) {
      setSentenceStar(true)
      if (!teacherMode) await insertStar('sentence')
    }
    if (!teacherMode) {
      await saveSession(new Set([1,2,3,4]), mistakes, true, gameState === 'won', solveStar, true, data.valid === true)
    }
    setSentenceDone(true)
  }

  const solvedGroups = groups.filter(g => solvedRanks.has(g.colour_rank)).sort((a, b) => a.colour_rank - b.colour_rank)
  const activeTiles  = tiles.filter(t => !solvedRanks.has(t.rank))
  const gameOver     = gameState === 'won' || gameState === 'lost'
  const totalStars   = (solveStar ? 1 : 0) + (perfectStar ? 1 : 0) + (sentenceStar ? 1 : 0)

  // ── Loading ───────────────────────────────────────
  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      {language === 'es' ? 'Cargando el puzzle de hoy...' : 'Loading today\'s puzzle...'}
    </div>
  )

  // ── No puzzle ─────────────────────────────────────
  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
      <h2 style={{ color: '#2d3748' }}>{language === 'es' ? 'No hay puzzle hoy' : 'No puzzle today'}</h2>
      <p style={{ color: '#718096' }}>{language === 'es' ? '¡Vuelve mañana!' : 'Check back tomorrow!'}</p>
      {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>← Back</button>}
    </div>
    </div>
  )

  // ── Main game ─────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

      {/* Header */}
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.25rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1rem', position: 'relative' }}>
        <HelpSheet
          title="How to play"
          points={[
            'Find the four groups of four words that belong together.',
            'Select four words, then hit Submit.',
            'You get four mistakes. A fifth ends the puzzle.',
            <><strong>One away</strong> means three of your four are right.</>,
            "Words are put in more than one plausible group on purpose — that's the puzzle.",
            'Groups run easiest to hardest: yellow, green, blue, purple.',
          ]}
        />
        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, letterSpacing: '2px' }}>CONNECTIONS</h1>
        <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '0.82rem' }}>
          {puzzleTitle
            ? puzzleTitle
            : (language === 'es' ? 'Agrupa las 16 palabras en 4 categorías' : 'Group the 16 words into 4 categories')}
        </p>
      </div>

      {/* Mistakes */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.82rem', color: '#718096', fontWeight: 500 }}>
          {language === 'es' ? 'Errores restantes:' : 'Mistakes remaining:'}
        </span>
        {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
          <div key={i} style={{ width: '14px', height: '14px', borderRadius: '50%', background: i < (MAX_MISTAKES - mistakes) ? '#2d3748' : '#e2e8f0', transition: 'background 0.3s ease' }} />
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          textAlign: 'center', marginBottom: '0.75rem', padding: '8px 16px', borderRadius: '8px',
          fontWeight: 700, fontSize: '0.95rem',
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
                background: isSel ? '#2d3748' : 'white',
                color:      isSel ? 'white'   : '#2d3748',
                border:     `2px solid ${isSel ? '#2d3748' : '#e2e8f0'}`,
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
            {language === 'es' ? 'Deseleccionar' : 'Deselect all'}
          </button>
          <button onClick={submitGuess} disabled={selected.size !== 4 || locked}
            style={{ padding: '10px 24px', borderRadius: '999px', fontWeight: 700, fontSize: '0.88rem',
              cursor: selected.size === 4 ? 'pointer' : 'not-allowed', border: 'none',
              background: selected.size === 4 ? '#2d3748' : '#e2e8f0',
              color: selected.size === 4 ? 'white' : '#a0aec0',
              transition: 'all 0.15s' }}>
            {language === 'es' ? 'Enviar' : 'Submit'}
          </button>
        </div>
      )}

      {/* Sentence challenge — word picker */}
      {gameOver && !sentenceDone && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
            ✍️ {language === 'es' ? '¡Usa una de las palabras en una frase!' : 'Now use one of the words in a sentence!'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>
            {language === 'es'
              ? 'Elige cualquier palabra del puzzle de hoy. ¿No estás seguro del significado? ¡Inténtalo de todas formas!'
              : 'Pick any word from today\'s puzzle. Not sure what it means? Have a go anyway!'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {allWords.map(w => (
              <button
                key={w}
                onClick={() => { setChosenWord(w); setShowChallenge(true) }}
                style={{
                  padding: '6px 12px', borderRadius: '999px', fontWeight: 600, fontSize: '0.8rem',
                  background: 'white', border: '2px solid #534AB7', color: '#534AB7',
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2d3748'; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#534AB7' }}
              >
                {w}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '10px 0 0', textAlign: 'center' }}>
            {language === 'es' ? 'Escribe o graba — gana ⭐️ por una buena frase' : 'Type or speak — earn ⭐️ for a good sentence'}
          </p>
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
                {perfectStar && sentenceStar
                  ? (language === 'es' ? '¡Sin errores + frase perfecta!' : 'No mistakes + great sentence!')
                  : perfectStar
                  ? (language === 'es' ? '¡Resuelto sin errores!' : 'Solved with no mistakes!')
                  : solveStar && sentenceStar
                  ? (language === 'es' ? '¡Puzzle resuelto + frase perfecta!' : 'Puzzle solved + great sentence!')
                  : solveStar
                  ? (language === 'es' ? '¡Puzzle resuelto!' : 'Puzzle solved!')
                  : (language === 'es' ? '¡Frase estupenda!' : 'Great sentence!')}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {language === 'es' ? 'Sin estrellas esta vez — ¡sigue intentándolo! 💪' : 'No stars this time — keep going! 💪'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!teacherMode && (
              <p style={{ color: '#718096', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 4px' }}>
                {language === 'es' ? '¡Vuelve mañana para un nuevo puzzle! 🔗' : 'Come back tomorrow for a new puzzle! 🔗'}
              </p>
            )}
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
    {showChallenge && chosenWord && (
      <SentenceChallenge
        word={chosenWord.toLowerCase()}
        language={language}
        exercise="connections"
        apiContext="challenge"
        dedupeKey={`daily:${today}:${language}:sentence`}
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
