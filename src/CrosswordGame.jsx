import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'
import Breadcrumb from './components/Breadcrumb'

// ── Crossword v1 (27 May 2026) ──────────────────────────────────────────────
// Daily puzzle, one per (date, language, level). Tap to select, virtual keyboard
// to type. Tap an already-active cell to toggle across/down direction.
// Correct words lock in green. Star word fires SC on completion.
// Stars: dedupe_key='crossword:<date>:<lang>:<level>:<subtype>'.

const GRADIENT          = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

// Cell backgrounds
const COLOR_ACTIVE_CELL  = '#fde68a'   // amber, the single active cell
const COLOR_ACTIVE_WORD  = '#fef3c7'   // pale amber, the active word's other cells
const COLOR_LOCKED       = '#d1fae5'   // light green, correctly completed word
const COLOR_STAR_LOCKED  = '#ffe4e6'   // coral, the star word once locked
const COLOR_BLOCKED      = '#1f2937'   // dark, blocked squares
const COLOR_CELL_DEFAULT = '#ffffff'
const COLOR_HINT_RING    = '#f59e0b'

const KEYBOARD_EN = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
]
const KEYBOARD_ES = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L','Ñ'],
  ['Z','X','C','V','B','N','M','⌫'],
]

// ── Pure helpers ────────────────────────────────────────────────────────────

const cellKey = (r, c) => `${r},${c}`

function cellInClue(clue, r, c) {
  if (clue.dir === 'across') return clue.row === r && c >= clue.col && c < clue.col + clue.length
  return clue.col === c && r >= clue.row && r < clue.row + clue.length
}

function getClueCells(clue) {
  const cells = []
  for (let i = 0; i < clue.length; i++) {
    if (clue.dir === 'across') cells.push([clue.row, clue.col + i])
    else cells.push([clue.row + i, clue.col])
  }
  return cells
}

function findClueAt(clues, r, c, preferredDir) {
  const preferred = clues.find(cl => cl.dir === preferredDir && cellInClue(cl, r, c))
  if (preferred) return preferred
  const other = preferredDir === 'across' ? 'down' : 'across'
  return clues.find(cl => cl.dir === other && cellInClue(cl, r, c))
}

function isClueCorrect(clue, cellLetters, grid) {
  for (const [r, c] of getClueCells(clue)) {
    const cell = grid[r]?.[c]
    if (!cell || cell.blocked) return false
    const typed = cellLetters[cellKey(r, c)]
    if (!typed || typed.toUpperCase() !== (cell.letter || '').toUpperCase()) return false
  }
  return true
}

function levelForProfile(profile) {
  const tracks = profile?.tracks || []
  if (tracks.includes('spanish') || profile?.level === 'Spanish') return 'A'
  const lvl = profile?.level || ''
  if (lvl.startsWith('A')) return 'A'
  if (lvl.startsWith('B')) return 'B'
  if (lvl.startsWith('C')) return 'C'
  return 'A'
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CrosswordGame({ onBack, userProfile }) {
  const location = useLocation()

  function detectLanguage() {
    if (location.state?.isSpanish) return 'es'
    const tracks = userProfile?.tracks || []
    if (tracks.includes('spanish') || userProfile?.level === 'Spanish') return 'es'
    return 'en'
  }

  const [language] = useState(() => detectLanguage())
  const isSpanish  = language === 'es'

  const [level, setLevel] = useState(() => levelForProfile(userProfile))
  const [gameState, setGameState]         = useState('loading')
  const [puzzle, setPuzzle]               = useState(null)
  const [cellLetters, setCellLetters]     = useState({})
  const [revealedCells, setRevealedCells] = useState([])
  const [hintsUsed, setHintsUsed]         = useState(0)
  const [starWordFound, setStarWordFound] = useState(false)

  const [activeCell, setActiveCell] = useState(null)
  const [activeDir, setActiveDir]   = useState('across')

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [sentenceStar, setSentenceStar]         = useState(false)
  const [showChallenge, setShowChallenge]       = useState(false)

  const [message, setMessage] = useState({ text: '', type: '' })

  const stateRef     = useRef({})
  const saveTimerRef = useRef(null)
  const today        = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    stateRef.current = { gameState, puzzle, cellLetters, revealedCells, hintsUsed, starWordFound, activeCell, activeDir }
  })

  useEffect(() => { loadPuzzle() /* eslint-disable-line */ }, [level, language])

  // ── Load / save ──────────────────────────────────────────────────────────

  async function loadPuzzle() {
    setGameState('loading')
    setCellLetters({})
    setRevealedCells([])
    setHintsUsed(0)
    setStarWordFound(false)
    setActiveCell(null)
    setActiveDir('across')
    setSentenceDone(false)
    setSentenceFeedback(null)
    setSentenceStar(false)

    const { data: p } = await supabase
      .from('crossword_puzzles')
      .select('*')
      .eq('play_date', today)
      .eq('language', language)
      .eq('level', level)
      .maybeSingle()

    if (!p) { setPuzzle(null); setGameState('noword'); return }
    setPuzzle(p)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: saved } = await supabase
        .from('crossword_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('puzzle_id', p.id)
        .maybeSingle()

      if (saved) {
        setCellLetters(saved.cell_letters || {})
        setRevealedCells(saved.revealed_cells || [])
        setHintsUsed(saved.hints_used || 0)
        setStarWordFound(saved.star_word_found || false)
        if (saved.sentence_challenge_passed !== null && saved.sentence_challenge_passed !== undefined) {
          setSentenceDone(true)
          setSentenceStar(saved.sentence_challenge_passed === true)
        }
        if (saved.completed) {
          setInitialActiveCell(p)
          setGameState('finished')
          return
        }
      }
    }

    setInitialActiveCell(p)
    setGameState('playing')
  }

  function setInitialActiveCell(p) {
    const clues = p.clues || []
    const acrossClues = clues.filter(c => c.dir === 'across').sort((a,b) => a.num - b.num)
    const first = acrossClues[0] || clues[0]
    if (first) {
      setActiveCell([first.row, first.col])
      setActiveDir(first.dir)
    }
  }

  function scheduleSave(extras = {}) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => saveProgress(extras), 600)
  }

  async function saveProgress(extras = {}) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puzzle) return
    const { cellLetters, revealedCells, hintsUsed, starWordFound } = stateRef.current
    await supabase.from('crossword_scores').upsert({
      user_id:           user.id,
      puzzle_id:         puzzle.id,
      cell_letters:      cellLetters,
      revealed_cells:    revealedCells,
      hints_used:        hintsUsed,
      star_word_found:   starWordFound,
      updated_at:        new Date().toISOString(),
      ...extras,
    }, { onConflict: 'user_id,puzzle_id' })
  }

  async function writeStar(subtype, contextExtras = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !puzzle) return
      const context = {
        puzzle_id:  puzzle.id,
        play_date:  puzzle.play_date,
        language,
        level:      puzzle.level,
        dedupe_key: `crossword:${puzzle.play_date}:${language}:${puzzle.level}:${subtype}`,
        ...contextExtras,
      }
      const { error } = await supabase.from('stars').insert({
        student_id: user.id,
        source:     'crossword',
        subtype,
        context,
      })
      if (error && error.code !== '23505') {
        console.warn('Crossword star insert failed:', error)
      }
    } catch (e) {
      console.warn('Crossword star log failed:', e)
    }
  }

  function showMsg(text, type, ms = 1800) {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), ms)
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const grid  = puzzle?.grid || []
  const clues = puzzle?.clues || []

  const activeClue = useMemo(() => {
    if (!activeCell || !puzzle) return null
    return findClueAt(clues, activeCell[0], activeCell[1], activeDir)
  }, [activeCell, activeDir, clues, puzzle])

  const activeWordCellSet = useMemo(() => {
    if (!activeClue) return new Set()
    return new Set(getClueCells(activeClue).map(([r,c]) => cellKey(r,c)))
  }, [activeClue])

  // A cell is locked if any clue it belongs to is fully and correctly filled.
  const { lockedCellSet, starWordCellSet } = useMemo(() => {
    const locked = new Set()
    const starCells = new Set()
    if (!puzzle) return { lockedCellSet: locked, starWordCellSet: starCells }
    const star = (puzzle.star_word || '').toUpperCase()
    for (const cl of clues) {
      if (isClueCorrect(cl, cellLetters, grid)) {
        const cells = getClueCells(cl)
        for (const [r, c] of cells) locked.add(cellKey(r, c))
        if (cl.answer && cl.answer.toUpperCase() === star) {
          for (const [r, c] of cells) starCells.add(cellKey(r, c))
        }
      }
    }
    return { lockedCellSet: locked, starWordCellSet: starCells }
  }, [clues, cellLetters, grid, puzzle])

  const revealedSet = useMemo(() => new Set(revealedCells), [revealedCells])

  const totalLetterCells = useMemo(() => {
    let n = 0
    for (const row of grid) for (const c of row) if (c && !c.blocked) n++
    return n
  }, [grid])

  const filledCorrectCount = useMemo(() => {
    let n = 0
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c]
        if (!cell || cell.blocked) continue
        const typed = cellLetters[cellKey(r, c)]
        if (typed && typed.toUpperCase() === (cell.letter || '').toUpperCase()) n++
      }
    }
    return n
  }, [grid, cellLetters])

  const allCorrect = totalLetterCells > 0 && filledCorrectCount === totalLetterCells

  // Star count for display
  const baseStars = (allCorrect ? 1 : 0) + (starWordFound ? 1 : 0)
  const totalStars = baseStars + (sentenceStar ? 1 : 0)

  // Build a quick map: cellKey -> number badge from the grid's "num" markers
  const cellNumbers = useMemo(() => {
    const out = {}
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c]
        if (cell && !cell.blocked && cell.num) out[cellKey(r, c)] = cell.num
      }
    }
    return out
  }, [grid])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleCellTap(r, c) {
    if (gameState !== 'playing' || !grid[r] || !grid[r][c] || grid[r][c].blocked) return
    if (activeCell && activeCell[0] === r && activeCell[1] === c) {
      // Same cell — toggle direction if both available
      const ac = findClueAt(clues, r, c, 'across')
      const dn = findClueAt(clues, r, c, 'down')
      if (ac && dn) setActiveDir(d => d === 'across' ? 'down' : 'across')
    } else {
      setActiveCell([r, c])
      // Keep current direction if cell supports it, else switch
      const sameDir = clues.find(cl => cl.dir === activeDir && cellInClue(cl, r, c))
      if (!sameDir) setActiveDir(activeDir === 'across' ? 'down' : 'across')
    }
  }

  function advanceWithinWord(r, c, dir) {
    const clue = findClueAt(clues, r, c, dir)
    if (!clue) return null
    const cells = getClueCells(clue)
    const idx = cells.findIndex(([cr, cc]) => cr === r && cc === c)
    if (idx === -1 || idx === cells.length - 1) return null
    return cells[idx + 1]
  }

  function retreatWithinWord(r, c, dir) {
    const clue = findClueAt(clues, r, c, dir)
    if (!clue) return null
    const cells = getClueCells(clue)
    const idx = cells.findIndex(([cr, cc]) => cr === r && cc === c)
    if (idx <= 0) return null
    return cells[idx - 1]
  }

  function checkAndAwardCompletion(newLetters) {
    if (!puzzle) return false
    // Star word
    if (!starWordFound) {
      const starClue = clues.find(cl => (cl.answer || '').toUpperCase() === (puzzle.star_word || '').toUpperCase())
      if (starClue && isClueCorrect(starClue, newLetters, grid)) {
        setStarWordFound(true)
        writeStar('star_word', { word: puzzle.star_word })
        showMsg(isSpanish ? '🌟 ¡Palabra estrella!' : '🌟 Star word!', 'success', 1800)
      }
    }
    // All correct?
    let ok = true
    for (let r = 0; r < grid.length && ok; r++) {
      for (let c = 0; c < grid[r].length && ok; c++) {
        const cell = grid[r][c]
        if (!cell || cell.blocked) continue
        const typed = newLetters[cellKey(r, c)]
        if (!typed || typed.toUpperCase() !== (cell.letter || '').toUpperCase()) ok = false
      }
    }
    if (ok) {
      writeStar('completion', { hints_used: hintsUsed })
      scheduleSave({ completed: true, completed_at: new Date().toISOString() })
      showMsg(isSpanish ? '🎉 ¡Lo lograste!' : '🎉 You did it!', 'success', 2400)
      return true
    }
    return false
  }

  function handleKeyTap(letter) {
    if (!activeCell || gameState !== 'playing') return
    const [r, c] = activeCell
    const k = cellKey(r, c)
    if (lockedCellSet.has(k)) {
      const next = advanceWithinWord(r, c, activeDir)
      if (next) setActiveCell(next)
      return
    }
    const newLetters = { ...cellLetters, [k]: letter.toUpperCase() }
    setCellLetters(newLetters)
    const wasCompletion = checkAndAwardCompletion(newLetters)
    if (!wasCompletion) scheduleSave()

    const next = advanceWithinWord(r, c, activeDir)
    if (next) setActiveCell(next)
  }

  function handleBackspace() {
    if (!activeCell || gameState !== 'playing') return
    const [r, c] = activeCell
    const k = cellKey(r, c)
    if (lockedCellSet.has(k)) {
      const prev = retreatWithinWord(r, c, activeDir)
      if (prev) setActiveCell(prev)
      return
    }
    if (cellLetters[k]) {
      const { [k]: _drop, ...rest } = cellLetters
      setCellLetters(rest)
      scheduleSave()
    } else {
      const prev = retreatWithinWord(r, c, activeDir)
      if (prev) {
        const pk = cellKey(prev[0], prev[1])
        let next = cellLetters
        if (!lockedCellSet.has(pk) && cellLetters[pk]) {
          const { [pk]: _drop, ...rest } = cellLetters
          next = rest
          setCellLetters(rest)
        }
        setActiveCell(prev)
        if (next !== cellLetters) scheduleSave()
      }
    }
  }

  function handleHint() {
    if (!puzzle || hintsUsed >= 3 || gameState !== 'playing' || allCorrect) return
    let target = null
    // Prefer active cell if it's not already correct
    if (activeCell) {
      const [r, c] = activeCell
      const cell = grid[r]?.[c]
      if (cell && !cell.blocked) {
        const typed = cellLetters[cellKey(r, c)]
        if (!typed || typed.toUpperCase() !== (cell.letter || '').toUpperCase()) {
          target = [r, c]
        }
      }
    }
    if (!target) {
      const unfilled = []
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const cell = grid[r][c]
          if (!cell || cell.blocked) continue
          const typed = cellLetters[cellKey(r, c)]
          if (!typed || typed.toUpperCase() !== (cell.letter || '').toUpperCase()) {
            unfilled.push([r, c])
          }
        }
      }
      if (unfilled.length === 0) return
      target = unfilled[Math.floor(Math.random() * unfilled.length)]
    }

    const [tr, tc] = target
    const correctLetter = (grid[tr][tc].letter || '').toUpperCase()
    const k = cellKey(tr, tc)
    const newLetters  = { ...cellLetters, [k]: correctLetter }
    const newRevealed = revealedCells.includes(k) ? revealedCells : [...revealedCells, k]
    setCellLetters(newLetters)
    setRevealedCells(newRevealed)
    setHintsUsed(h => h + 1)
    setActiveCell([tr, tc])
    showMsg(isSpanish ? `🔎 ${correctLetter}` : `🔎 ${correctLetter}`, 'info', 1200)

    const wasCompletion = checkAndAwardCompletion(newLetters)
    if (!wasCompletion) scheduleSave()
  }

  function handleLevelSwitch(newLevel) {
    if (newLevel === level) return
    setLevel(newLevel)
  }

  function handleContinue() {
    setGameState('finished')
  }

  async function handleSentenceMarked({ result }) {
    const data = result || { valid: null }
    setSentenceFeedback(data)
    const passed = data.valid === true
    if (passed) setSentenceStar(true)
    setSentenceDone(true)
    await saveProgress({ sentence_challenge_passed: passed })
  }

  function handleClueTap(clue) {
    setActiveCell([clue.row, clue.col])
    setActiveDir(clue.dir)
  }

  // ── Renders ──────────────────────────────────────────────────────────────

  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      {isSpanish ? 'Cargando...' : "Loading today's puzzle..."}
    </div>
  )

  // Level pill — used in both noword and main render
  const LevelPills = (
    <div style={{
      display: 'flex', gap: '6px', justifyContent: 'center',
      padding: '8px', background: 'white', borderRadius: '10px',
      marginBottom: '0.75rem',
    }}>
      <span style={{ fontSize: '0.72rem', color: '#a0aec0', fontWeight: 600, alignSelf: 'center', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {isSpanish ? 'Nivel' : 'Level'}
      </span>
      {['A', 'B', 'C'].map(L => {
        const isActive = level === L
        return (
          <button
            key={L}
            onClick={() => handleLevelSwitch(L)}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: '2px solid ' + (isActive ? '#667eea' : '#e2e8f0'),
              background: isActive ? '#667eea' : 'white',
              color: isActive ? 'white' : '#4a5568',
              cursor: 'pointer',
              minWidth: '38px',
            }}
          >
            {L}
          </button>
        )
      })}
    </div>
  )

  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {onBack && <Breadcrumb section={isSpanish ? 'Jugar' : 'Play'} title={isSpanish ? 'Crucigrama' : 'Crossword'} onExit={onBack} />}
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem 1rem' }}>
        {LevelPills}
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
          <h2 style={{ color: '#2d3748' }}>
            {isSpanish ? `Sin crucigrama de nivel ${level} hoy` : `No level ${level} crossword today`}
          </h2>
          <p style={{ color: '#718096' }}>
            {isSpanish ? 'Prueba otro nivel o vuelve mañana.' : 'Try another level or check back tomorrow.'}
          </p>
          {onBack && (
            <button onClick={onBack} style={{ marginTop: '1rem', padding: '10px 24px', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              ← {isSpanish ? 'Volver' : 'Back'}
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const cols = puzzle.grid_cols
  const rows = puzzle.grid_rows
  const cellFontSize = cols >= 13 ? '0.78rem' : cols >= 9 ? '0.95rem' : '1.4rem'
  const numFontSize  = cols >= 13 ? '0.5rem'  : cols >= 9 ? '0.55rem' : '0.65rem'

  const acrossClues = clues.filter(c => c.dir === 'across').sort((a,b) => a.num - b.num)
  const downClues   = clues.filter(c => c.dir === 'down').sort((a,b) => a.num - b.num)

  const titleText = puzzle.title || new Date(puzzle.play_date + 'T00:00:00').toLocaleDateString(
    isSpanish ? 'es-ES' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long' }
  )

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {onBack && <Breadcrumb section={isSpanish ? 'Jugar' : 'Play'} title={isSpanish ? 'Crucigrama' : 'Crossword'} onExit={onBack} />}
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

        {/* Header */}
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.1rem 1.5rem', textAlign: 'center', color: 'white', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>📝</span>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '2px' }}>
              {isSpanish ? 'CRUCIGRAMA' : 'CROSSWORD'}
            </h1>
            {isSpanish && <span style={{ fontSize: '1.1rem' }}>🇪🇸</span>}
          </div>
          <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '0.9rem', fontWeight: 600 }}>
            {titleText}
          </p>
        </div>

        {LevelPills}

        {/* Status bar */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.7rem', color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isSpanish ? 'Casillas' : 'Cells'}
            </span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2d3748' }}>
              {filledCorrectCount}/{totalLetterCells}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isSpanish ? 'Estrellas' : 'Stars'}
            </span>
            <span style={{ fontSize: '1.05rem', height: '24px' }}>
              {totalStars > 0 ? Array(totalStars).fill('⭐').join('') : <span style={{ color: '#cbd5e0', fontSize: '0.9rem' }}>—</span>}
            </span>
          </div>
          {gameState === 'playing' && (
            <button
              onClick={handleHint}
              disabled={hintsUsed >= 3 || allCorrect}
              style={{
                padding: '0.6rem 0.95rem', borderRadius: '999px',
                background: (hintsUsed >= 3 || allCorrect) ? '#f0f0f0' : '#fef3c7',
                border: '2px solid ' + ((hintsUsed >= 3 || allCorrect) ? '#e2e8f0' : '#f59e0b'),
                fontWeight: 700, fontSize: '0.85rem',
                color: (hintsUsed >= 3 || allCorrect) ? '#a0aec0' : '#92400e',
                cursor: (hintsUsed >= 3 || allCorrect) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
              title={isSpanish ? 'Pista' : 'Hint'}
            >
              🔎 {hintsUsed > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{hintsUsed}/3</span>}
            </button>
          )}
        </div>

        {/* Active clue banner */}
        {activeClue && gameState === 'playing' && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
            padding: '0.6rem 0.85rem', marginBottom: '0.6rem',
            fontSize: '0.9rem', color: '#92400e', fontWeight: 600,
            display: 'flex', alignItems: 'baseline', gap: '8px',
          }}>
            <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
              {activeClue.num}{activeClue.dir === 'across' ? (isSpanish ? 'H' : 'A') : (isSpanish ? 'V' : 'D')}
            </span>
            <span style={{ fontWeight: 500 }}>{activeClue.clue_text}</span>
          </div>
        )}

        {/* Flash message */}
        {message.text && (
          <div style={{
            textAlign: 'center', marginBottom: '0.6rem', padding: '6px 14px', borderRadius: '8px',
            fontWeight: 600, fontSize: '0.88rem',
            background: message.type === 'success' ? '#f0fff4' : message.type === 'error' ? '#fff5f5' : '#fffbeb',
            color:      message.type === 'success' ? '#276749' : message.type === 'error' ? '#c53030' : '#92400e',
            border:     `1px solid ${message.type === 'success' ? '#c6f6d5' : message.type === 'error' ? '#fed7d7' : '#fde68a'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Grid */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '8px', marginBottom: '0.75rem' }}>
          <div style={{
            position: 'relative',
            aspectRatio: `${cols} / ${rows}`,
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: '2px',
            background: '#1f2937',
            padding: '2px',
            borderRadius: '6px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}>
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const cell = grid[r]?.[c]
                const k = cellKey(r, c)
                if (!cell || cell.blocked) {
                  return <div key={k} style={{ background: COLOR_BLOCKED }} />
                }
                const isActive  = activeCell && activeCell[0] === r && activeCell[1] === c
                const inActiveWord = activeWordCellSet.has(k)
                const isStarLocked = starWordCellSet.has(k)
                const isLocked  = lockedCellSet.has(k)
                const isRevealed = revealedSet.has(k)
                const typed = cellLetters[k] || ''
                let bg = COLOR_CELL_DEFAULT
                if (isStarLocked) bg = COLOR_STAR_LOCKED
                else if (isLocked) bg = COLOR_LOCKED
                if (inActiveWord && !isActive) bg = isLocked || isStarLocked ? bg : COLOR_ACTIVE_WORD
                if (isActive) bg = COLOR_ACTIVE_CELL
                const num = cellNumbers[k]
                return (
                  <div
                    key={k}
                    onClick={() => handleCellTap(r, c)}
                    style={{
                      position: 'relative',
                      background: bg,
                      color: '#1a202c',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: cellFontSize,
                      boxShadow: isRevealed ? `inset 0 0 0 2px ${COLOR_HINT_RING}` : 'none',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    {num && (
                      <span style={{
                        position: 'absolute', top: '2px', left: '3px',
                        fontSize: numFontSize, color: '#4a5568', fontWeight: 600,
                        lineHeight: 1, pointerEvents: 'none',
                      }}>
                        {num}
                      </span>
                    )}
                    {typed}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Virtual keyboard */}
        {gameState === 'playing' && (
          <div style={{
            background: 'white', borderRadius: '12px', padding: '8px',
            marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '5px',
          }}>
            {(isSpanish ? KEYBOARD_ES : KEYBOARD_EN).map((row, ri) => (
              <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                {row.map(key => {
                  const isBackspace = key === '⌫'
                  return (
                    <button
                      key={key}
                      onClick={() => isBackspace ? handleBackspace() : handleKeyTap(key)}
                      style={{
                        flex: isBackspace ? 1.6 : 1,
                        minWidth: 0,
                        padding: '11px 0',
                        background: isBackspace ? '#e2e8f0' : '#f7fafc',
                        border: '1px solid #cbd5e0',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: '#2d3748',
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                      }}
                    >
                      {key}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Clues list (collapsible per direction) */}
        {gameState === 'playing' && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '0.75rem' }}>
            <ClueList
              title={isSpanish ? 'Horizontales' : 'Across'}
              clues={acrossClues}
              activeClue={activeClue}
              cellLetters={cellLetters}
              grid={grid}
              onTap={handleClueTap}
            />
            <div style={{ height: '0.75rem' }} />
            <ClueList
              title={isSpanish ? 'Verticales' : 'Down'}
              clues={downClues}
              activeClue={activeClue}
              cellLetters={cellLetters}
              grid={grid}
              onTap={handleClueTap}
            />
          </div>
        )}

        {/* Continue → SC */}
        {gameState === 'playing' && allCorrect && (
          <button
            onClick={handleContinue}
            style={{
              width: '100%', padding: '0.95rem', borderRadius: '10px',
              background: GRADIENT, color: 'white', border: 'none',
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            {isSpanish ? '¡Continuar! →' : 'Continue! →'}
          </button>
        )}

        {/* Finished view */}
        {gameState === 'finished' && (
          <>
            {!sentenceDone && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>
                  {isSpanish ? '✍️ ¡Ahora úsala en una frase!' : '✍️ Now use it in a sentence!'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>
                  {isSpanish
                    ? `Usa "${puzzle.star_word}" en una frase. ¡Gana ⭐ por una buena frase!`
                    : `Use "${puzzle.star_word}" in a sentence. Earn ⭐ for a correct sentence!`}
                </div>
                <button
                  onClick={() => setShowChallenge(true)}
                  style={{
                    width: '100%', padding: '0.85rem', background: GRADIENT, color: 'white',
                    border: 'none', borderRadius: '10px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.95rem',
                  }}>
                  ⭐ {isSpanish ? 'Úsala en una frase →' : 'Use it in a sentence →'}
                </button>
              </div>
            )}

            {sentenceDone && (
              <div style={{ background: 'white', borderRadius: '12px', padding: '1.1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: '0.75rem' }}>
                {sentenceFeedback && (
                  <div style={{
                    padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '0.85rem',
                    background: sentenceFeedback.valid ? '#f0fff4' : '#fff5f5',
                    border:     `1px solid ${sentenceFeedback.valid ? '#c6f6d5' : '#fed7d7'}`,
                    color:      sentenceFeedback.valid ? '#276749' : '#9b2c2c',
                    fontSize: '0.88rem', lineHeight: 1.5,
                  }}>
                    {sentenceFeedback.valid ? '✅ ' : '❌ '}{sentenceFeedback.reason || sentenceFeedback.feedback}
                  </div>
                )}
                {totalStars > 0 ? (
                  <div style={{ textAlign: 'center', marginBottom: '0.85rem', padding: '0.7rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ fontSize: '1.6rem' }}>{Array(totalStars).fill('⭐').join('')}</div>
                    <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                      {isSpanish ? '¡Bien hecho!' : 'Well done!'}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#a0aec0', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
                    {isSpanish ? 'Sin estrellas esta vez — ¡sigue intentando! 💪' : 'No stars this time — keep going! 💪'}
                  </div>
                )}
                <p style={{ color: '#718096', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 10px' }}>
                  {isSpanish ? '¡Vuelve mañana para un nuevo crucigrama! 📝' : 'Come back tomorrow for a new crossword! 📝'}
                </p>
                {onBack && (
                  <button onClick={onBack} style={{ width: '100%', padding: '0.7rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
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

        {/* Back during play */}
        {gameState === 'playing' && onBack && (
          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <button onClick={onBack} style={{ padding: '10px 24px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0' }}>
              ← {isSpanish ? 'Volver' : 'Back'}
            </button>
          </div>
        )}

      </div>

      {showChallenge && puzzle?.star_word && (
        <SentenceChallenge
          word={puzzle.star_word}
          language={language}
          exercise="crossword"
          apiContext="challenge"
          dedupeKey={`crossword:${puzzle.play_date}:${language}:${puzzle.level}:sentence`}
          onMarkResult={handleSentenceMarked}
          onClose={() => setShowChallenge(false)}
        />
      )}
    </div>
  )
}

// ── Subcomponent: clue list ────────────────────────────────────────────────

function ClueList({ title, clues, activeClue, cellLetters, grid, onTap }) {
  return (
    <div>
      <div style={{ fontSize: '0.78rem', color: '#a0aec0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {clues.map(cl => {
          const isActive = activeClue && activeClue.num === cl.num && activeClue.dir === cl.dir
          const correct = isClueCorrect(cl, cellLetters, grid)
          return (
            <button
              key={`${cl.num}-${cl.dir}`}
              onClick={() => onTap(cl)}
              style={{
                display: 'flex', gap: '6px', alignItems: 'baseline',
                textAlign: 'left',
                padding: '6px 8px',
                background: isActive ? '#fef3c7' : 'transparent',
                border: '1px solid ' + (isActive ? '#fde68a' : 'transparent'),
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: correct ? '#276749' : '#2d3748',
                textDecoration: correct ? 'line-through' : 'none',
                opacity: correct ? 0.65 : 1,
              }}
            >
              <span style={{ fontWeight: 800, minWidth: '20px' }}>{cl.num}</span>
              <span style={{ fontWeight: 500, flex: 1 }}>{cl.clue_text}</span>
              {correct && <span style={{ fontSize: '0.78rem' }}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
