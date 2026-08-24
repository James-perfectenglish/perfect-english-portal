import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'
import Breadcrumb from './components/Breadcrumb'

// ── Wordsearch v1 (8 May 2026) ──────────────────────────────────────────────
// Daily puzzle, 10 themed words to find in a grid (varying sizes, see DB).
// Bonus words: any 4+ letter word in word_lists (besides the 10 theme words)
// counts toward score for vocabulary discovery. No gameplay gating.
// Hint mechanic: reveals the first letter of an unfound theme word at random
// (Star word held back until last). Unlimited but tracked in hints_used.
// Star events: solve (10/10), star_word (when found), sentence (SC pass).
// Stars use dedupe_key='daily:<date>:<lang>:<subtype>'.
// Grid display: full discovery — no theme word list shown to player.
// Drag-to-select with pointer events; touch-action:none on the grid.

const GRADIENT          = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

// ── Palette B — Calm (slate / coral / faint lime) ────────────────────────
// SVG capsule colours — persistent overlay (drawn on top of cells)
const CAPSULE_THEME = 'rgba(100, 116, 139, 0.32)'  // slate, theme words
const CAPSULE_KEY   = 'rgba(251, 113, 133, 0.45)'  // coral, star word
const CAPSULE_BONUS = 'rgba(132, 204, 22, 0.18)'   // faint lime, bonus words

// Cell flash backgrounds — brief, on discovery
const COLOR_FOUND_BG    = '#e2e8f0'  // slate flash — theme word found
const COLOR_KEY_BG      = '#ffe4e6'  // coral flash — star word found
const COLOR_BONUS_BG    = '#d9f99d'  // lime flash — bonus word found
const COLOR_DRAG_BG     = '#bfdbfe'  // blue — current drag preview
const COLOR_DRAG_TEXT   = '#1e40af'
const COLOR_HINT_RING   = '#f59e0b'  // amber ring on revealed hint cells
const COLOR_SHADOW_BG   = '#fbbf24'  // amber flash for shadow words
const COLOR_INVALID_BG  = '#fca5a5'  // red flash for invalid

const THEME_WORD_PTS = 5
const FLASH_MS       = 700
const SHADOW_FLASH_MS = 1400

// Build a straight 8-direction path from start to end. Returns null if not on
// a valid straight line. Inclusive of both endpoints.
function straightPath(start, end) {
  if (!start || !end) return null
  const [r0, c0] = start
  const [r1, c1] = end
  const dr = r1 - r0
  const dc = c1 - c0
  if (dr === 0 && dc === 0) return [[r0, c0]]
  // Must be horizontal, vertical, or 45° diagonal
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1
  const sr = dr === 0 ? 0 : Math.sign(dr)
  const sc = dc === 0 ? 0 : Math.sign(dc)
  const cells = []
  for (let i = 0; i < length; i++) cells.push([r0 + sr * i, c0 + sc * i])
  return cells
}

function wordFromPath(grid, path) {
  return path.map(([r, c]) => grid[r][c]).join('').toUpperCase()
}

function cellsEqualAsSet(a, b) {
  if (a.length !== b.length) return false
  const setA = new Set(a.map(([r, c]) => `${r},${c}`))
  for (const [r, c] of b) if (!setA.has(`${r},${c}`)) return false
  return true
}

function reverse(s) { return s.split('').reverse().join('') }

// Find which theme placement (if any) matches the traced path.
// Match means: word matches forward or backward AND cells are the same set
// as the placement's cells.
function matchThemePlacement(path, themeWord, placements) {
  // First find the placement for this themeWord
  const placement = placements.find(p => p.word === themeWord)
  if (!placement) return null
  const pCells = straightPath(placement.start, placement.end)
  if (!pCells) return null
  return cellsEqualAsSet(path, pCells) ? placement : null
}

// Whether a path's cells are entirely contained in any theme placement's path.
function isShadowPath(path, placements) {
  const pathStrs = new Set(path.map(([r, c]) => `${r},${c}`))
  for (const pl of placements) {
    const cells = straightPath(pl.start, pl.end)
    if (!cells) continue
    const cellStrs = new Set(cells.map(([r, c]) => `${r},${c}`))
    let allContained = true
    for (const s of pathStrs) {
      if (!cellStrs.has(s)) { allContained = false; break }
    }
    if (allContained) return true
  }
  return false
}

export default function WordSearchGame({ onBack, userProfile, classPuzzle = null }) {
  const location = useLocation()
  const teacherMode = !!classPuzzle  // Class Play: specific puzzle, no stars/session writes

  function detectLanguage() {
    if (location.state?.isSpanish) return 'es'
    const tracks = userProfile?.tracks || []
    if (tracks.includes('spanish') || userProfile?.level === 'Spanish') return 'es'
    return 'en'
  }

  const [language] = useState(() => classPuzzle ? classPuzzle.language : detectLanguage())
  const isSpanish  = language === 'es'

  const [gameState, setGameState]           = useState('loading')
  const [puzzle, setPuzzle]                 = useState(null)

  const [themeWordsFound, setThemeWordsFound] = useState([])  // uppercase strings
  const [bonusWordsFound, setBonusWordsFound] = useState([])  // uppercase strings
  const [bonusWordPaths, setBonusWordPaths] = useState([])    // [{word, start:[r,c], end:[r,c]}, ...] — for persistent capsule rendering
  const [hintsUsed, setHintsUsed]           = useState(0)
  const [revealedHintCells, setRevealedHintCells] = useState({})  // 'r,c' -> themeWord
  const [score, setScore]                   = useState(0)
  const [starWordAwarded, setStarWordAwarded] = useState(false)

  const [dragging, setDragging]   = useState(false)
  const [dragStart, setDragStart] = useState(null)  // [r, c]
  const [dragPath, setDragPath]   = useState([])    // array of [r, c]

  const [flash, setFlash]   = useState(null)   // { cells, bg, ts }
  const [message, setMessage] = useState({ text: '', type: '' })
  const [bonusOpen, setBonusOpen] = useState(false)

  const [sentenceDone, setSentenceDone]       = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [sentenceStar, setSentenceStar]       = useState(false)
  const [showChallenge, setShowChallenge]     = useState(false)

  const stateRef = useRef({})
  const today    = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    stateRef.current = {
      gameState, puzzle, themeWordsFound, bonusWordsFound, bonusWordPaths,
      dragging, dragStart, dragPath, hintsUsed, score, revealedHintCells,
      starWordAwarded,
    }
  })

  useEffect(() => { loadPuzzle() }, [])

  async function loadPuzzle() {
    // Class Play: a specific puzzle is supplied; play it fresh, no saved progress.
    if (teacherMode) { setPuzzle(classPuzzle); setGameState('playing'); return }

    const { data: p } = await supabase
      .from('wordsearch_puzzles')
      .select('*')
      .eq('play_date', today)
      .eq('language', language)
      .maybeSingle()

    if (!p) { setGameState('noword'); return }
    setPuzzle(p)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: saved } = await supabase
        .from('wordsearch_scores')
        .select('*')
        .eq('user_id', user.id)
        .eq('puzzle_id', p.id)
        .maybeSingle()

      if (saved) {
        const tw = saved.theme_words_found || []
        const bw = saved.bonus_words_found || []
        const bp = saved.bonus_word_paths || []
        setThemeWordsFound(tw)
        setBonusWordsFound(bw)
        setBonusWordPaths(bp)
        setHintsUsed(saved.hints_used || 0)
        setScore(saved.score || 0)
        setStarWordAwarded(tw.includes(p.star_word))
        if (saved.sentence_challenge_passed !== null && saved.sentence_challenge_passed !== undefined) {
          setSentenceDone(true)
          setSentenceStar(saved.sentence_challenge_passed === true)
          setGameState('finished')
          return
        }
        if (tw.length >= 10) {
          setGameState('finished')
          return
        }
      }
    }
    setGameState('playing')
  }

  async function saveProgress(extras = {}) {
    if (teacherMode) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !puzzle) return
    const { themeWordsFound, bonusWordsFound, bonusWordPaths, hintsUsed, score } = stateRef.current
    await supabase.from('wordsearch_scores').upsert({
      user_id:                   user.id,
      puzzle_id:                 puzzle.id,
      theme_words_found:         themeWordsFound,
      bonus_words_found:         bonusWordsFound,
      bonus_word_paths:          bonusWordPaths,
      hints_used:                hintsUsed,
      score,
      completed:                 themeWordsFound.length >= 10,
      completed_at:              themeWordsFound.length >= 10 ? new Date().toISOString() : null,
      version:                   1,
      ...extras,
    }, { onConflict: 'user_id,puzzle_id' })
  }

  function showMsg(text, type, ms = 1500) {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), ms)
  }

  function triggerFlash(cells, bg, ms = FLASH_MS) {
    const ts = Date.now()
    setFlash({ cells, bg, ts })
    setTimeout(() => {
      setFlash(f => (f && f.ts === ts) ? null : f)
    }, ms)
  }

  // ── Pointer drag handlers ─────────────────────────────────────────────────

  function getCellFromPoint(clientX, clientY) {
    const elem = document.elementFromPoint(clientX, clientY)
    if (!elem) return null
    const cellEl = elem.closest('[data-cell]')
    if (!cellEl) return null
    const r = parseInt(cellEl.dataset.row, 10)
    const c = parseInt(cellEl.dataset.col, 10)
    if (Number.isNaN(r) || Number.isNaN(c)) return null
    return [r, c]
  }

  function handlePointerDown(e, r, c) {
    if (stateRef.current.gameState !== 'playing') return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    setDragging(true)
    setDragStart([r, c])
    setDragPath([[r, c]])
  }

  function handlePointerMove(e) {
    const { dragging, dragStart, puzzle } = stateRef.current
    if (!dragging || !puzzle) return
    e.preventDefault()
    const cell = getCellFromPoint(e.clientX, e.clientY)
    if (!cell) return
    if (cell[0] < 0 || cell[1] < 0 || cell[0] >= puzzle.grid_rows || cell[1] >= puzzle.grid_cols) return
    const path = straightPath(dragStart, cell)
    if (path) setDragPath(path)
  }

  function handlePointerUp(e) {
    const { dragging, dragPath } = stateRef.current
    if (!dragging) return
    e?.preventDefault?.()
    setDragging(false)
    if (dragPath && dragPath.length >= 2) {
      processPath(dragPath)
    }
    setDragStart(null)
    setDragPath([])
  }

  function handlePointerCancel() {
    setDragging(false)
    setDragStart(null)
    setDragPath([])
  }

  // ── Word validation ───────────────────────────────────────────────────────

  async function processPath(path) {
    const { puzzle, themeWordsFound, bonusWordsFound, score, starWordAwarded } = stateRef.current
    if (!puzzle) return
    const word = wordFromPath(puzzle.grid, path)
    const wordRev = reverse(word)

    // 1) Theme word match — try both word and reversed
    const themeWords = puzzle.theme_words || []
    let matchedTheme = null
    for (const tw of themeWords) {
      if (tw !== word && tw !== wordRev) continue
      if (matchThemePlacement(path, tw, puzzle.word_placements)) { matchedTheme = tw; break }
    }
    if (matchedTheme) {
      if (themeWordsFound.includes(matchedTheme)) {
        // Already found — silent
        return
      }
      const isStar = matchedTheme === puzzle.star_word
      const newFound = [...themeWordsFound, matchedTheme]
      const newScore = score + THEME_WORD_PTS
      setThemeWordsFound(newFound)
      setScore(newScore)
      // Clear hint marker if this word had one
      setRevealedHintCells(prev => {
        const next = { ...prev }
        for (const k of Object.keys(next)) if (next[k] === matchedTheme) delete next[k]
        return next
      })
      triggerFlash(path, isStar ? COLOR_KEY_BG : COLOR_FOUND_BG, FLASH_MS)
      if (isStar) {
        showMsg(isSpanish ? `🌟 ¡Palabra estrella! +${THEME_WORD_PTS} ⭐` : `🌟 Star word! +${THEME_WORD_PTS} ⭐`, 'success', 2200)
        if (!starWordAwarded) {
          await writeStar('star_word', { word: matchedTheme })
          setStarWordAwarded(true)
        }
      } else {
        showMsg(`+${THEME_WORD_PTS}`, 'success')
      }
      // Save (and award solve star if completed)
      await saveProgress()
      if (newFound.length === 10) {
        await writeStar('solve', { theme: puzzle.theme })
        showMsg(isSpanish ? '🎉 ¡Las has encontrado todas!' : '🎉 You found them all!', 'success', 2400)
      }
      return
    }

    // 2) Bonus word? Look up in word_lists. Any 4+ letter word.
    if (word.length < 4) {
      // Silent — too short
      return
    }
    if (bonusWordsFound.includes(word) || bonusWordsFound.includes(wordRev)) {
      // Already found bonus, silent
      return
    }
    // Quick optimisation: don't run the lookup if it's obviously not letters
    if (!/^[A-ZÑ]+$/.test(word)) return

    const { data: hits } = await supabase
      .from('word_lists')
      .select('word')
      .eq('language', language)
      .in('word', [word.toLowerCase(), wordRev.toLowerCase()])
      .limit(1)

    if (!hits || hits.length === 0) {
      // Not a word at all — silent
      return
    }
    const matchedWord = hits[0].word.toUpperCase()

    // 3) Shadow check: if the path is fully inside a theme word's path, flash amber
    if (isShadowPath(path, puzzle.word_placements)) {
      triggerFlash(path, COLOR_SHADOW_BG, SHADOW_FLASH_MS)
      showMsg(
        isSpanish
          ? `${matchedWord} se esconde en una palabra del tema...`
          : `${matchedWord} is hiding inside a theme word...`,
        'info',
        2200
      )
      return
    }

    // 4) Real bonus word
    const { bonusWordPaths } = stateRef.current
    const bonusPts = matchedWord.length
    const newBonus = [...bonusWordsFound, matchedWord]
    const newPath = {
      word: matchedWord,
      start: [path[0][0], path[0][1]],
      end:   [path[path.length - 1][0], path[path.length - 1][1]],
    }
    const newPaths = [...bonusWordPaths, newPath]
    const newScore = score + bonusPts
    setBonusWordsFound(newBonus)
    setBonusWordPaths(newPaths)
    setScore(newScore)
    triggerFlash(path, COLOR_BONUS_BG, FLASH_MS)
    showMsg(`+${bonusPts}`, 'success')
    await saveProgress()
  }

  async function writeStar(subtype, contextExtras = {}) {
    if (teacherMode) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !puzzle) return
      const context = {
        puzzle_id: puzzle.id,
        play_date: puzzle.play_date,
        language,
        dedupe_key: `daily:${puzzle.play_date}:${language}:${subtype}`,
        ...contextExtras,
      }
      const { error } = await supabase.from('stars').insert({
        student_id: user.id,
        source:     'wordsearch',
        subtype,
        context,
      })
      if (error && error.code !== '23505') {
        console.warn('Wordsearch star insert failed:', error)
      }
    } catch (e) {
      console.warn('Wordsearch star log failed:', e)
    }
  }

  // ── Hint ──────────────────────────────────────────────────────────────────

  async function handleHint() {
    const { puzzle, themeWordsFound, hintsUsed, revealedHintCells } = stateRef.current
    if (!puzzle) return
    if (hintsUsed >= 3) return
    const themeWords  = puzzle.theme_words || []
    const placements  = puzzle.word_placements || []
    const starWord    = puzzle.star_word
    const unfound     = themeWords.filter(w => !themeWordsFound.includes(w))
    if (unfound.length === 0) return
    // Hold Star word back unless it's the only unfound one
    let candidates = unfound.filter(w => w !== starWord)
    if (candidates.length === 0) candidates = unfound
    // Filter out words that already have a revealed hint
    const alreadyRevealed = new Set(Object.values(revealedHintCells))
    const stillNeeded = candidates.filter(w => !alreadyRevealed.has(w))
    const pool = stillNeeded.length > 0 ? stillNeeded : candidates
    const word = pool[Math.floor(Math.random() * pool.length)]
    const placement = placements.find(p => p.word === word)
    if (!placement) return
    const [r, c] = placement.start
    setRevealedHintCells(prev => ({ ...prev, [`${r},${c}`]: word }))
    setHintsUsed(h => h + 1)
    showMsg(
      isSpanish ? `🔎 Pista: empieza por ${puzzle.grid[r][c]}` : `🔎 Hint: starts with ${puzzle.grid[r][c]}`,
      'info',
      1800
    )
    // Persist hint count
    setTimeout(() => saveProgress(), 0)
  }

  // ── Finish & sentence challenge ───────────────────────────────────────────

  function handleContinue() {
    setGameState('finished')
  }

  async function handleSentenceMarked({ sentence, inputMethod, result }) {
    const data = result || { valid: null }
    setSentenceFeedback(data)
    const passed = data.valid === true
    if (passed) setSentenceStar(true)
    setSentenceDone(true)
    await saveProgress({ sentence_challenge_passed: passed })
    // SC star is written by SentenceChallenge to the stars table directly.
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const themeCount = themeWordsFound.length
  const allFound   = themeCount >= 10
  const baseStars  = (allFound ? 1 : 0) + (starWordAwarded ? 1 : 0)
  const totalStars = baseStars + (sentenceStar ? 1 : 0)

  // For grid render: which cells are "found" (theme word path) and what colour.
  // Iterate through found theme words, mark their cells.
  const foundCellMap = (() => {
    if (!puzzle) return {}
    const map = {}
    for (const w of themeWordsFound) {
      const pl = (puzzle.word_placements || []).find(p => p.word === w)
      if (!pl) continue
      const cells = straightPath(pl.start, pl.end) || []
      const isStar = w === puzzle.star_word
      for (const [r, c] of cells) map[`${r},${c}`] = isStar ? 'star' : 'theme'
    }
    return map
  })()

  const dragCellSet = new Set((dragPath || []).map(([r, c]) => `${r},${c}`))
  const flashCellSet = flash ? new Set(flash.cells.map(([r, c]) => `${r},${c}`)) : null

  // ── Render: loading / no puzzle ───────────────────────────────────────────

  if (gameState === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
      {isSpanish ? 'Cargando...' : "Loading today's puzzle..."}
    </div>
  )

  if (gameState === 'noword') return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {onBack && <Breadcrumb section={isSpanish ? 'Jugar' : 'Play'} title={isSpanish ? 'Sopa de letras' : 'Wordsearch'} onExit={onBack} />}
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔎</div>
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

  // ── Render: main ─────────────────────────────────────────────────────────

  const cols = puzzle.grid_cols
  const rows = puzzle.grid_rows

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {onBack && <Breadcrumb section={isSpanish ? 'Jugar' : 'Play'} title={isSpanish ? 'Sopa de letras' : 'Wordsearch'} onExit={onBack} />}
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>

        {/* Header */}
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.1rem 1.5rem', textAlign: 'center', color: 'white', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🔎</span>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '2px' }}>
              {isSpanish ? 'SOPA DE LETRAS' : 'WORDSEARCH'}
            </h1>
            {isSpanish && <span style={{ fontSize: '1.1rem' }}>🇪🇸</span>}
          </div>
          <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '0.95rem', fontWeight: 600 }}>
            {puzzle.theme}
          </p>
          <p style={{ margin: '2px 0 0', opacity: 0.75, fontSize: '0.75rem' }}>
            {isSpanish ? 'Encuentra 10 palabras' : 'Find 10 words'}
          </p>
        </div>

        {/* Status bar */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.7rem', color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isSpanish ? 'Encontradas' : 'Found'}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2d3748' }}>
              {themeCount}/10
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#a0aec0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isSpanish ? 'Puntos' : 'Score'}
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2d3748' }}>{score}</span>
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
              disabled={hintsUsed >= 3 || allFound}
              style={{
                padding: '0.6rem 0.95rem', borderRadius: '999px',
                background: (hintsUsed >= 3 || allFound) ? '#f0f0f0' : '#fef3c7',
                border: '2px solid ' + ((hintsUsed >= 3 || allFound) ? '#e2e8f0' : '#f59e0b'),
                fontWeight: 700, fontSize: '0.9rem',
                color: (hintsUsed >= 3 || allFound) ? '#a0aec0' : '#92400e',
                cursor: (hintsUsed >= 3 || allFound) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
              title={isSpanish ? 'Pista' : 'Hint'}
            >
              🔎 {hintsUsed > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{hintsUsed}/3</span>}
            </button>
          )}
        </div>

        {/* Message */}
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

        {/* Grid — outer wrapper holds padding + bg; inner wrapper has
            aspectRatio cols/rows so cells stay perfectly square and the SVG
            overlay aligns 1:1 with cells regardless of viewport width. */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '8px',
          marginBottom: '0.75rem',
        }}>
          <div
            style={{
              position: 'relative',
              aspectRatio: `${cols} / ${rows}`,
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gap: 0,
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerUp}
          >
            {/* SVG overlay — bonus capsules drawn first (sit underneath),
                theme + star capsules drawn on top. inset:0 + preserveAspect
                Ratio="none" gives pixel-perfect alignment with grid cells. */}
            <svg
              viewBox={`0 0 ${cols} ${rows}`}
              preserveAspectRatio="none"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 2,
                overflow: 'visible',
              }}
            >
              {/* Bonus capsules (faint, persistent) */}
              {bonusWordPaths.map((b, i) => (
                <line
                  key={`bonus-${i}`}
                  x1={b.start[1] + 0.5}
                  y1={b.start[0] + 0.5}
                  x2={b.end[1] + 0.5}
                  y2={b.end[0] + 0.5}
                  stroke={CAPSULE_BONUS}
                  strokeWidth={0.78}
                  strokeLinecap="round"
                />
              ))}
              {/* Theme + star capsules */}
              {themeWordsFound.map(word => {
                const pl = (puzzle.word_placements || []).find(p => p.word === word)
                if (!pl) return null
                const isStar = word === puzzle.star_word
                const [r0, c0] = pl.start
                const [r1, c1] = pl.end
                return (
                  <line
                    key={word}
                    x1={c0 + 0.5}
                    y1={r0 + 0.5}
                    x2={c1 + 0.5}
                    y2={r1 + 0.5}
                    stroke={isStar ? CAPSULE_KEY : CAPSULE_THEME}
                    strokeWidth={0.78}
                    strokeLinecap="round"
                  />
                )
              })}
            </svg>
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const key = `${r},${c}`
                const found = foundCellMap[key]   // 'theme' | 'star' | undefined
                const inDrag = dragCellSet.has(key)
                const flashThis = flashCellSet?.has(key)
                const hintWord = revealedHintCells[key]
                let bg = 'white'
                let color = '#2d3748'
                // Found theme/star words shown via SVG capsule overlay — cell stays white
                if (inDrag && !found) { bg = COLOR_DRAG_BG; color = COLOR_DRAG_TEXT }
                if (flashThis && flash) { bg = flash.bg; color = '#1a202c' }
                const showHintRing = !!hintWord && !found
                return (
                  <div
                    key={key}
                    data-cell="1"
                    data-row={r}
                    data-col={c}
                    onPointerDown={e => handlePointerDown(e, r, c)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: bg,
                      color,
                      fontWeight: 700,
                      fontSize: cols >= 13 ? '0.75rem' : cols >= 11 ? '0.85rem' : '0.95rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, color 0.15s ease',
                      boxShadow: showHintRing ? `inset 0 0 0 2px ${COLOR_HINT_RING}` : 'none',
                      touchAction: 'none',
                    }}
                  >
                    {puzzle.grid[r][c]}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Bonus words */}
        {gameState === 'playing' && (
          <div style={{ background: 'white', borderRadius: '12px', marginBottom: '0.75rem', overflow: 'hidden' }}>
            <button
              onClick={() => setBonusOpen(o => !o)}
              style={{
                width: '100%', padding: '0.7rem 1rem', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem', color: '#2d3748',
              }}
            >
              <span>
                ✨ {isSpanish ? 'Palabras extra' : 'Bonus words'} · {bonusWordsFound.length}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                {bonusOpen ? '▲' : '▼'}
              </span>
            </button>
            {bonusOpen && bonusWordsFound.length > 0 && (
              <div style={{ padding: '0 1rem 0.85rem', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {[...bonusWordsFound].sort().map(w => (
                  <span key={w} style={{
                    padding: '3px 9px', borderRadius: '999px', fontSize: '0.78rem',
                    fontWeight: 600, background: '#f0fff4', color: '#276749',
                    border: '1px solid #c6f6d5',
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            )}
            {bonusOpen && bonusWordsFound.length === 0 && (
              <div style={{ padding: '0 1rem 0.85rem', fontSize: '0.78rem', color: '#a0aec0' }}>
                {isSpanish
                  ? 'Encuentra palabras extra de 4+ letras escondidas en la cuadrícula'
                  : 'Find bonus words of 4+ letters hidden in the grid'}
              </div>
            )}
          </div>
        )}

        {/* Finish CTA when all 10 found and SC not yet attempted */}
        {gameState === 'playing' && allFound && (
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

        {/* ── Finished ── */}
        {gameState === 'finished' && (
          <>
            {/* Sentence challenge invite */}
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

            {/* Sentence result */}
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
                  {isSpanish ? '¡Vuelve mañana para un nuevo puzzle! 🔎' : 'Come back tomorrow for a new puzzle! 🔎'}
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

        {/* Back from playing */}
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
          exercise="wordsearch"
          apiContext="challenge"
          dedupeKey={puzzle ? `daily:${puzzle.play_date}:${language}:sentence` : undefined}
          onMarkResult={handleSentenceMarked}
          noStars={teacherMode}
          onClose={() => setShowChallenge(false)}
        />
      )}
    </div>
  )
}
