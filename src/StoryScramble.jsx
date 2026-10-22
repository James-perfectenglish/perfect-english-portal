import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import HelpSheet from './components/HelpSheet'

// ── Story Scramble (Oct 2026) ───────────────────────────────────────────────
// One jumbled story a week per level (EN A2/B1/B2/C1, ES A2) from
// scramble_texts. `sentences` holds the correct order with the cohesion clues
// marked [[like this]]; `start_order` is the jumble everyone starts from, and
// the letters A, B, C… follow it, so a class can talk about "sentence D".
//
// No feedback while arranging. Three checks per story; each one says how many
// LINKS are right (two sentences that belong next to each other), never which.
// Links, not positions: one sentence in the wrong place would otherwise make
// a nearly-right order score 0. Solved on check 1/2/3 → 3/2/1 stars (subtypes
// solved, sharp, first_try; dedupe scramble:<week>:<lang>-<level>:<subtype>).
// The hint locks the first sentence at the top and uses a check. Out of checks
// → "Show me the answer", no stars.
//
// Progress saves to scramble_sessions (order, checks used, hint) so closing the
// app doesn't hand back fresh checks. Not logged to student_answers.
// Teachers (isTeacher prop, or is_teacher on the profile, which covers Present
// Mode) play without saving, can start again, and see every week including
// the ones not live yet.

export const GAME_TITLE = 'Story Scramble'

const GRADIENT      = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const MAX_CHECKS    = 3
const LEVEL_ORDER   = ['A2', 'B1', 'B2', 'C1']
const STAR_SUBTYPES = ['solved', 'sharp', 'first_try']   // 1, 2, 3 stars
const GAP           = 8      // px between sentence cards
const LONG_PRESS_MS = 260
const TOUCH_SLOP    = 8
const MOUSE_SLOP    = 4
const EDGE_TOP      = 70     // auto-scroll zones while dragging
const EDGE_BOTTOM   = 110    // the student nav bar sits at the bottom
const CASCADE_MS    = 110    // delay between sentences turning green

const GREEN = { bg: '#f0fff4', border: '#68d391', badge: '#48bb78' }
const BLUE  = { bg: '#ebf8ff', border: '#90cdf4', badge: '#4299e1' }

const CSS = `
@keyframes ss-pop { 0% { opacity: 0; transform: scale(0.3) } 70% { opacity: 1; transform: scale(1.15) } 100% { opacity: 1; transform: scale(1) } }
@keyframes ss-rise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
`

// Monday of the current week (UTC, as the daily games use).
function currentWeekStart() {
  const d = new Date()
  const back = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10)
}

function defaultLevel(userLevel) {
  const l = (userLevel || '').toUpperCase()
  if (l.startsWith('A')) return 'A2'
  if (l === 'B1') return 'B1'
  if (l.startsWith('B')) return 'B2'
  if (l.startsWith('C')) return 'C1'
  return 'B1'
}

function formatWeek(iso, opts = { day: 'numeric', month: 'long' }) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts)
}

const plain     = s => (s || '').replace(/\[\[(.+?)\]\]/g, '$1')
const identity  = n => Array.from({ length: n }, (_, i) => i)
const letter    = i => String.fromCharCode(65 + i)
const starsFor  = checksUsed => Math.max(0, MAX_CHECKS - checksUsed + 1)
const levelsIn  = rows => LEVEL_ORDER.filter(l => rows.some(r => r.level === l))
const linksRight = order => order.reduce((n, v, i) => (i > 0 && v === order[i - 1] + 1 ? n + 1 : n), 0)

function isValidOrder(arr, n) {
  if (!Array.isArray(arr) || arr.length !== n) return false
  return new Set(arr).size === n && arr.every(v => Number.isInteger(v) && v >= 0 && v < n)
}

function arrayMove(arr, from, to) {
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// Newest first. Students: the latest live story. Teachers before launch: the
// first one that will go live.
function pickDefault(rows, lvl, thisWeek) {
  const atLevel = rows.filter(r => r.level === lvl)
  return atLevel.find(r => r.week_start <= thisWeek) || atLevel[atLevel.length - 1] || null
}

// "Anna opened [[it]] and…" → text with the clue words highlighted.
function Clues({ text }) {
  const parts = (text || '').split(/\[\[(.+?)\]\]/)
  return parts.map((p, i) => (i % 2 === 1
    ? <mark key={i} style={{ background: '#fef08a', color: 'inherit', padding: '0 2px', borderRadius: '3px' }}>{p}</mark>
    : <span key={i}>{p}</span>))
}

function Grip() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" aria-hidden="true">
      {[3, 8, 13].map(y => [2.5, 7.5].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />))}
    </svg>
  )
}

function LinkMeter({ right, total, colour = '#667eea' }) {
  return (
    <div style={{ display: 'flex', gap: '3px', marginTop: '6px' }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: '7px', borderRadius: '999px', background: i < right ? colour : '#e2e8f0' }} />
      ))}
    </div>
  )
}

export default function StoryScramble({ userLevel, userTracks = [], isTeacher: teacherProp = false, onBack }) {
  const isSpanish = userLevel === 'Spanish' || (userTracks || []).includes('spanish')
  const language  = isSpanish ? 'es' : 'en'
  const [thisWeek] = useState(currentWeekStart)

  const [teacher, setTeacher]       = useState(teacherProp)
  const [catalogue, setCatalogue]   = useState([])     // { id, week_start, level, title }, newest first
  const [sessions, setSessions]     = useState({})     // text_id → { solved, revealed, checks_used }
  const [level, setLevel]           = useState(null)
  const [nextWeek, setNextWeek]     = useState(null)
  const [text, setText]             = useState(null)
  const [mode, setMode]             = useState('loading')   // loading | empty | playing | solved | revealed
  const [order, setOrder]           = useState([])
  const [checksUsed, setChecksUsed] = useState(0)
  const [checkResults, setCheckResults] = useState([])
  const [hintUsed, setHintUsed]     = useState(false)
  const [checkedKey, setCheckedKey] = useState(null)   // the order at the last check
  const [celebrate, setCelebrate]   = useState(false)  // solved just now, not on reopening
  const [selected, setSelected]     = useState(null)   // position tapped for tap-to-move
  const [drag, setDrag]             = useState(null)   // { from, to, dy, h }
  const [confirm, setConfirm]       = useState(null)   // 'hint' | 'reveal'
  const [noteIdx, setNoteIdx]       = useState(null)
  const [allNotes, setAllNotes]     = useState(false)

  const teacherRef = useRef(teacherProp)
  const userRef    = useRef(null)
  const live       = useRef({})     // latest state, for saves and native listeners
  const handlers   = useRef({})
  const listRef    = useRef(null)
  const itemEls    = useRef({})     // sentence index → card element
  const dragRef    = useRef(null)
  const rafRef     = useRef(null)
  const flipFrom   = useRef(null)
  const saveTimer  = useRef(null)
  const checkLock  = useRef(false)

  // ── Load ───────────────────────────────────────────────────────────────────
  async function openText(id) {
    setMode('loading')
    setSelected(null); setDrag(null); setConfirm(null)
    setNoteIdx(null); setAllNotes(false); setCelebrate(false); setCheckedKey(null)
    checkLock.current = false
    const { data: t } = await supabase.from('scramble_texts').select('*').eq('id', id).maybeSingle()
    if (!t) { setMode('empty'); return }
    const n = t.sentences.length
    let s = null
    if (!teacherRef.current && userRef.current) {
      const { data } = await supabase.from('scramble_sessions').select('*')
        .eq('student_id', userRef.current).eq('text_id', id).maybeSingle()
      s = data
    }
    setText(t)
    setChecksUsed(s?.checks_used || 0)
    setCheckResults(s?.check_results || [])
    setHintUsed(!!s?.hint_used)
    if (s?.solved)        { setOrder(identity(n)); setMode('solved') }
    else if (s?.revealed) { setOrder(identity(n)); setMode('revealed') }
    else {
      let o = s && isValidOrder(s.current_order, n) ? s.current_order : t.start_order
      if (s?.hint_used && o[0] !== 0) o = [0, ...o.filter(v => v !== 0)]
      setOrder(o)
      setMode('playing')
    }
    window.scrollTo({ top: 0 })
  }

  // Load on open, and again if a teacher flips the preview language. Fetching
  // is what this effect is for (state is only set after the first await), the
  // same pattern as BluffGame and CrosswordGame.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      let isT = teacherProp
      if (user && !isT) {
        const { data: p } = await supabase.from('profiles').select('is_teacher').eq('id', user.id).maybeSingle()
        isT = !!p?.is_teacher
      }
      let q = supabase.from('scramble_texts').select('id, week_start, level, title')
        .eq('language', language).order('week_start', { ascending: false })
      if (!isT) q = q.lte('week_start', thisWeek)
      const { data: rows } = await q
      const list = rows || []
      const sess = {}
      if (!isT && user && list.length) {
        const { data: ss } = await supabase.from('scramble_sessions')
          .select('text_id, solved, revealed, checks_used')
          .eq('student_id', user.id).in('text_id', list.map(r => r.id))
        ;(ss || []).forEach(s => { sess[s.text_id] = s })
      }
      if (cancelled) return
      teacherRef.current = isT
      userRef.current = user?.id || null
      setTeacher(isT)
      setCatalogue(list)
      setSessions(sess)
      const levels = levelsIn(list)
      if (!levels.length) {
        const { data: nxt } = await supabase.from('scramble_texts').select('week_start')
          .eq('language', language).gt('week_start', thisWeek)
          .order('week_start').limit(1).maybeSingle()
        if (cancelled) return
        setNextWeek(nxt?.week_start || null)
        setMode('empty')
        return
      }
      const want = language === 'es' ? levels[0] : defaultLevel(userLevel)
      const lvl = levels.includes(want) ? want : levels[0]
      setLevel(lvl)
      const first = pickDefault(list, lvl, thisWeek)
      if (first) await openText(first.id)
    })()
    return () => { cancelled = true }
  }, [language]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    live.current = { text, order, checksUsed, checkResults, hintUsed, mode }
  })

  async function persist(patch = {}) {
    if (teacherRef.current || !userRef.current) return
    const s = { ...live.current, ...patch }
    if (!s.text) return
    const done = s.mode === 'solved' || s.mode === 'revealed'
    const row = {
      student_id:    userRef.current,
      text_id:       s.text.id,
      current_order: s.order,
      checks_used:   s.checksUsed,
      check_results: s.checkResults,
      hint_used:     s.hintUsed,
      solved:        s.mode === 'solved',
      revealed:      s.mode === 'revealed',
      updated_at:    new Date().toISOString(),
      completed_at:  done ? new Date().toISOString() : null,
    }
    const { error } = await supabase.from('scramble_sessions').upsert(row, { onConflict: 'student_id,text_id' })
    if (error) console.warn('Story Scramble: could not save progress:', error)
    setSessions(prev => ({ ...prev, [row.text_id]: { text_id: row.text_id, solved: row.solved, revealed: row.revealed, checks_used: row.checks_used } }))
  }

  // Moves save after a short pause, so a student can close the app mid-puzzle
  // and come back to the same order.
  function scheduleSave() {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveTimer.current = null; persist() }, 700)
  }
  useEffect(() => () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); persist() }
    cancelAnimationFrame(rafRef.current)
  }, [])

  async function awardStars(used, t, hint) {
    if (teacherRef.current || !userRef.current) return
    for (const subtype of STAR_SUBTYPES.slice(0, starsFor(used))) {
      try {
        const { error } = await supabase.from('stars').insert({
          student_id: userRef.current,
          source:     'scramble',
          subtype,
          context: {
            text_id: t.id, week_start: t.week_start, language: t.language, level: t.level,
            checks_used: used, hint_used: hint,
            dedupe_key: `scramble:${t.week_start}:${t.language}-${t.level}:${subtype}`,
          },
        })
        if (error && error.code !== '23505') console.warn('Story Scramble star insert failed:', error)
      } catch (e) {
        console.warn('Story Scramble star log failed:', e)
      }
    }
  }

  // ── Moving sentences ───────────────────────────────────────────────────────
  const isLocked = pos => hintUsed && pos === 0
  const minPos   = hintUsed ? 1 : 0

  // FLIP: remember where every card is, let React reorder them, then slide
  // each one from its old spot to its new one.
  function snapshot() {
    const m = {}
    Object.entries(itemEls.current).forEach(([k, el]) => { if (el) m[k] = el.getBoundingClientRect().top })
    flipFrom.current = m
  }
  useLayoutEffect(() => {
    const prev = flipFrom.current
    if (!prev || drag) return
    flipFrom.current = null
    Object.entries(itemEls.current).forEach(([k, el]) => {
      if (!el || prev[k] == null) return
      const delta = prev[k] - el.getBoundingClientRect().top
      if (Math.abs(delta) < 1) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${delta}px)`
      el.getBoundingClientRect()
      requestAnimationFrame(() => {
        el.style.transition = 'transform 220ms ease'
        el.style.transform = ''
      })
    })
  }, [order, drag])

  function commitMove(from, to) {
    if (from === to || isLocked(from) || to < minPos) return
    snapshot()
    setOrder(o => arrayMove(o, from, to))
    scheduleSave()
  }

  function tap(pos) {
    if (live.current.mode !== 'playing' || isLocked(pos)) return
    setConfirm(null)
    if (selected === null) setSelected(pos)
    else if (selected === pos) setSelected(null)
    else { commitMove(selected, pos); setSelected(null) }
  }

  function nudge(dir) {
    if (selected === null) return
    const to = selected + dir
    if (to < minPos || to >= order.length) return
    commitMove(selected, to)
    setSelected(to)
  }

  function beginDrag(pos, clientY) {
    if (live.current.mode !== 'playing' || isLocked(pos)) return false
    const els = order.map(k => itemEls.current[k])
    if (els.some(el => !el)) return false
    const sy = window.scrollY
    const rects = els.map(el => el.getBoundingClientRect())
    dragRef.current = {
      from: pos, to: pos, y: clientY, startDocY: clientY + sy, minTo: minPos,
      tops: rects.map(r => r.top + sy), heights: rects.map(r => r.height),
    }
    setSelected(null)
    setConfirm(null)
    setDrag({ from: pos, to: pos, dy: 0, h: rects[pos].height })
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(autoScroll)
    return true
  }

  function updateDrag() {
    const d = dragRef.current
    if (!d) return
    const dy = d.y + window.scrollY - d.startDocY
    const centre = d.tops[d.from] + d.heights[d.from] / 2 + dy
    let to = 0
    d.tops.forEach((t, i) => { if (i !== d.from && centre > t + d.heights[i] / 2) to++ })
    d.to = Math.max(d.minTo, to)
    setDrag({ from: d.from, to: d.to, dy, h: d.heights[d.from] })
  }

  function autoScroll() {
    const d = dragRef.current
    if (!d) return
    const h = window.innerHeight
    let v = 0
    if (d.y < EDGE_TOP) v = -Math.ceil((EDGE_TOP - d.y) / 5)
    else if (d.y > h - EDGE_BOTTOM) v = Math.ceil((d.y - (h - EDGE_BOTTOM)) / 5)
    if (v) {
      const before = window.scrollY
      window.scrollBy(0, v)
      if (window.scrollY !== before) updateDrag()
    }
    rafRef.current = requestAnimationFrame(autoScroll)
  }

  function moveDrag(clientY) {
    const d = dragRef.current
    if (!d) return
    d.y = clientY
    updateDrag()
  }

  function endDrag() {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    cancelAnimationFrame(rafRef.current)
    snapshot()
    setDrag(null)
    if (d.to !== d.from) {
      setOrder(o => arrayMove(o, d.from, d.to))
      scheduleSave()
    }
  }

  // Native listeners read the latest handlers through a ref (a mount-only
  // listener would otherwise see the first render's state).
  useEffect(() => {
    handlers.current = { beginDrag, moveDrag, endDrag, tap }
  })

  // Mouse: drag from anywhere on a card once it moves a few pixels; a click
  // without movement is a tap.
  function onPointerDown(e, pos) {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, dragging: false }
    const move = ev => {
      if (!start.dragging) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < MOUSE_SLOP) return
        start.dragging = handlers.current.beginDrag(pos, start.y)
        if (!start.dragging) return
      }
      handlers.current.moveDrag(ev.clientY)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (start.dragging) handlers.current.endDrag()
      else handlers.current.tap(pos)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Touch: the grip starts a drag straight away; press-and-hold anywhere else
  // on the card starts one too. A quick touch is a tap; a swipe scrolls the
  // page as normal. touchmove is non-passive so a drag can stop the page
  // scrolling (iOS Safari ignores HTML drag-and-drop altogether).
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    let t = null
    const onStart = e => {
      if (e.touches.length !== 1 || e.target.closest('button')) return
      const card = e.target.closest('[data-pos]')
      if (!card) return
      const touch = e.touches[0]
      t = { pos: Number(card.dataset.pos), x: touch.clientX, y: touch.clientY, dragging: false, moved: false, timer: null }
      if (e.target.closest('[data-grip]')) {
        t.dragging = handlers.current.beginDrag(t.pos, touch.clientY)
      } else {
        const mine = t
        mine.timer = setTimeout(() => {
          if (t === mine && !mine.moved) mine.dragging = handlers.current.beginDrag(mine.pos, mine.y)
        }, LONG_PRESS_MS)
      }
    }
    const onMove = e => {
      if (!t) return
      const touch = e.touches[0]
      if (t.dragging) {
        if (e.cancelable) e.preventDefault()
        handlers.current.moveDrag(touch.clientY)
        return
      }
      if (Math.hypot(touch.clientX - t.x, touch.clientY - t.y) > TOUCH_SLOP) {
        t.moved = true
        clearTimeout(t.timer)
      }
    }
    const onEnd = e => {
      if (!t) return
      clearTimeout(t.timer)
      if (t.dragging) {
        handlers.current.endDrag()
        if (e.cancelable) e.preventDefault()
      } else if (!t.moved && e.type === 'touchend') {
        handlers.current.tap(t.pos)
        if (e.cancelable) e.preventDefault()
      }
      t = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: false })
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      if (t) clearTimeout(t.timer)
    }
  }, [mode, text?.id])

  // ── Checks, hint, answer ───────────────────────────────────────────────────
  function check() {
    if (mode !== 'playing' || drag || checksUsed >= MAX_CHECKS || checkLock.current) return
    const key = order.join(',')
    if (key === checkedKey) return
    checkLock.current = true
    clearTimeout(saveTimer.current); saveTimer.current = null
    const right = linksRight(order)
    const used = checksUsed + 1
    const results = [...checkResults, right]
    setChecksUsed(used)
    setCheckResults(results)
    setCheckedKey(key)
    setSelected(null)
    setConfirm(null)
    if (right === order.length - 1) {
      setMode('solved')
      setCelebrate(true)
      persist({ checksUsed: used, checkResults: results, mode: 'solved' })
      awardStars(used, text, hintUsed)
    } else {
      persist({ checksUsed: used, checkResults: results })
      checkLock.current = false
    }
  }

  function takeHint() {
    if (mode !== 'playing' || hintUsed || MAX_CHECKS - checksUsed < 2) return
    clearTimeout(saveTimer.current); saveTimer.current = null
    snapshot()
    const next = [0, ...order.filter(v => v !== 0)]
    const used = checksUsed + 1
    setOrder(next)
    setHintUsed(true)
    setChecksUsed(used)
    setSelected(null)
    setConfirm(null)
    persist({ order: next, hintUsed: true, checksUsed: used })
  }

  function reveal() {
    if (mode !== 'playing') return
    clearTimeout(saveTimer.current); saveTimer.current = null
    snapshot()
    const next = identity(order.length)
    setOrder(next)
    setMode('revealed')
    setSelected(null)
    setConfirm(null)
    persist({ order: next, mode: 'revealed' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function restart() {   // teachers only
    snapshot()
    setOrder(text.start_order)
    setChecksUsed(0); setCheckResults([]); setHintUsed(false); setCheckedKey(null)
    setCelebrate(false); setSelected(null); setConfirm(null); setNoteIdx(null); setAllNotes(false)
    checkLock.current = false
    setMode('playing')
  }

  function changeLevel(L) {
    if (L === level) return
    setLevel(L)
    const t = pickDefault(catalogue, L, thisWeek)
    if (t) openText(t.id)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const n          = order.length
  const playing    = mode === 'playing'
  const finished   = mode === 'solved' || mode === 'revealed'
  const checksLeft = MAX_CHECKS - checksUsed
  const lastResult = checkResults.length ? checkResults[checkResults.length - 1] : null
  const unchanged  = checkedKey !== null && checkedKey === order.join(',')
  const canHint    = playing && !hintUsed && checksLeft >= 2
  const levels     = levelsIn(catalogue)
  const others     = catalogue.filter(r => r.level === level && r.id !== text?.id)
  const letterOf   = {}
  ;(text?.start_order || []).forEach((k, p) => { letterOf[k] = letter(p) })
  const earned     = mode === 'solved' ? starsFor(checksUsed) : 0

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const shell = children => (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <style>{CSS}</style>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1rem 1rem 6rem' }}>
        {children}
      </div>
    </div>
  )

  const header = (
    <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.1rem 2.5rem', textAlign: 'center', color: 'white', marginBottom: '0.75rem', position: 'relative' }}>
      <HelpSheet
        title="How to play"
        points={[
          'The sentences of a short story are mixed up. Put them back in order.',
          'Drag a sentence by its dotted handle, or press and hold it. Or tap one sentence, then tap the place where it should go.',
          "Tap Check when you think it's right. You have three checks. Each one tells you how many links are right (a link is two sentences that belong next to each other), but not which ones.",
          'Solve it on your first check for ⭐⭐⭐, your second for ⭐⭐ and your third for ⭐.',
          'Stuck? "Show me how it starts" puts the first sentence at the top and locks it there, but it uses a check.',
          'Look for the little words that point back: he, it, that, then, however…',
          'A new story every Monday. Earlier stories stay below, ready to play.',
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>📜</span>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, letterSpacing: '2px' }}>STORY SCRAMBLE</h1>
      </div>
      <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '0.88rem', fontWeight: 600 }}>
        {text ? `Week of ${formatWeek(text.week_start)}` : 'Put the story back together'}
      </p>
    </div>
  )

  const levelPills = levels.length > 1 && (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', padding: '8px', background: 'white', borderRadius: '10px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.72rem', color: '#a0aec0', fontWeight: 600, marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Level</span>
      {levels.map(L => {
        const active = level === L
        return (
          <button key={L} onClick={() => changeLevel(L)} style={{
            padding: '6px 12px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', minWidth: '44px', cursor: 'pointer',
            border: '2px solid ' + (active ? '#667eea' : '#e2e8f0'),
            background: active ? '#667eea' : 'white', color: active ? 'white' : '#4a5568',
          }}>{L}</button>
        )
      })}
    </div>
  )

  const liveLabel = t => {
    if (!t) return ''
    if (t.week_start === thisWeek) return 'Live this week'
    if (t.week_start > thisWeek) return `Goes live ${formatWeek(t.week_start, { weekday: 'short', day: 'numeric', month: 'short' })}`
    return `Week of ${formatWeek(t.week_start, { day: 'numeric', month: 'short' })}`
  }

  const teacherBar = teacher && text && (
    <div style={{ background: '#faf5ff', border: '1px solid #e9d8fd', borderRadius: '10px', padding: '0.55rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, lineHeight: 1.3 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#553C9A' }}>{liveLabel(text)}</div>
        <div style={{ fontSize: '0.68rem', color: '#805ad5' }}>Teacher view · nothing is saved</div>
      </div>
      <button onClick={restart} style={{ padding: '0.4rem 0.8rem', borderRadius: '999px', border: '2px solid #667eea', background: 'white', color: '#553C9A', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
        ↺ Start again
      </button>
    </div>
  )

  const backButton = onBack && (
    <button onClick={onBack} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
      ← Back
    </button>
  )

  const smallButton = (label, onClick, colour = '#553C9A') => (
    <button onClick={onClick} style={{ background: 'none', border: 'none', color: colour, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', padding: '4px 2px', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
      {label}
    </button>
  )

  const confirmBox = (message, yesLabel, onYes) => (
    <div style={{ marginTop: '0.75rem', padding: '0.75rem 0.85rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.85rem', color: '#744210', lineHeight: 1.45 }}>
      {message}
      <div style={{ display: 'flex', gap: '8px', marginTop: '0.6rem' }}>
        <button onClick={onYes} style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none', background: '#d97706', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>{yesLabel}</button>
        <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1px solid #fcd34d', background: 'white', color: '#92400e', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Keep trying</button>
      </div>
    </div>
  )

  // ── Screens ────────────────────────────────────────────────────────────────
  if (mode === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>Loading the story…</div>
  )

  if (mode === 'empty') return shell(
    <>
      {header}
      <div style={{ background: 'white', borderRadius: '12px', padding: '2rem 1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📜</div>
        <h2 style={{ color: '#2d3748', margin: '0 0 0.5rem' }}>No stories yet</h2>
        <p style={{ color: '#718096', margin: '0 0 1.25rem' }}>
          {nextWeek ? `The first story arrives on Monday ${formatWeek(nextWeek)}.` : 'Check back on Monday for the first story.'}
        </p>
        {backButton}
      </div>
    </>
  )

  const cards = (
    <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
      {order.map((k, pos) => {
        const isDragged = drag && drag.from === pos
        const locked    = playing && isLocked(pos)
        const isSel     = playing && selected === pos
        let shift = 0
        if (drag && !isDragged) {
          if (drag.from < drag.to && pos > drag.from && pos <= drag.to) shift = -(drag.h + GAP)
          if (drag.to < drag.from && pos >= drag.to && pos < drag.from) shift = drag.h + GAP
        }
        const look = mode === 'solved' ? GREEN : mode === 'revealed' ? BLUE : null
        const delay = celebrate ? pos * CASCADE_MS : 0
        const colourTransition = look && celebrate
          ? `background-color 350ms ease ${delay}ms, border-color 350ms ease ${delay}ms`
          : undefined
        return (
          <div
            key={k}
            ref={el => { itemEls.current[k] = el }}
            data-pos={pos}
            onPointerDown={playing ? e => onPointerDown(e, pos) : undefined}
            onContextMenu={playing ? e => e.preventDefault() : undefined}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: playing ? '10px 10px 10px 4px' : '10px 12px',
              borderRadius: '12px',
              background: look ? look.bg : locked ? '#f7fafc' : isSel ? '#f5f3ff' : 'white',
              border: `2px solid ${look ? look.border : isSel ? '#667eea' : '#e2e8f0'}`,
              boxShadow: isDragged ? '0 14px 30px rgba(0,0,0,0.18)' : '0 1px 3px rgba(0,0,0,0.05)',
              transform: drag ? (isDragged ? `translateY(${drag.dy}px) scale(1.02)` : `translateY(${shift}px)`) : undefined,
              transition: drag ? (isDragged ? 'box-shadow 150ms ease' : 'transform 160ms ease') : colourTransition,
              position: 'relative', zIndex: isDragged ? 20 : 1,
              userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
              cursor: playing && !locked ? (isDragged ? 'grabbing' : 'grab') : 'default',
            }}>
            {playing && (locked
              ? <span title="Locked by the hint" style={{ width: '24px', flexShrink: 0, textAlign: 'center', fontSize: '0.8rem', paddingTop: '4px' }}>🔒</span>
              : <span data-grip style={{ width: '24px', flexShrink: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0', touchAction: 'none' }}><Grip /></span>)}
            <span style={{
              flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', marginTop: '1px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.78rem', fontWeight: 800,
              background: look ? look.badge : isSel ? '#667eea' : '#edf2f7',
              color: look || isSel ? 'white' : '#4a5568',
              transition: look && celebrate ? `background-color 350ms ease ${delay}ms` : undefined,
            }}>
              {playing ? letterOf[k] : pos + 1}
            </span>
            <span style={{ flex: 1, fontSize: '0.95rem', lineHeight: 1.45, color: '#2d3748', paddingTop: '2px' }}>
              {plain(text.sentences[k])}
            </span>
            {isSel && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                {[[-1, '▲', 'Move up', pos <= minPos], [1, '▼', 'Move down', pos >= n - 1]].map(([dir, glyph, label, off]) => (
                  <button key={dir} aria-label={label} onClick={() => nudge(dir)} disabled={off}
                    style={{ width: '30px', height: '26px', borderRadius: '7px', border: '1.5px solid #c3b8f5', background: 'white', color: off ? '#d6d0f0' : '#553C9A', fontSize: '0.7rem', cursor: off ? 'default' : 'pointer', padding: 0 }}>
                    {glyph}
                  </button>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )

  const storyCard = text && (
    <div style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.15rem', marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2C3E50', flex: 1 }}>{text.title}</span>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: '#ebf8ff', color: '#2b6cb0' }}>{text.language === 'es' ? 'ES' : text.level}</span>
      </div>
      {text.blurb && <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '3px', fontStyle: 'italic' }}>{text.blurb}</div>}
      {playing && (
        <div style={{ fontSize: '0.8rem', color: '#4a5568', marginTop: '0.6rem', padding: '0.5rem 0.65rem', background: '#f7f8ff', borderRadius: '8px', lineHeight: 1.45 }}>
          {selected !== null
            ? <>Now tap where <strong>{letterOf[order[selected]]}</strong> should go, or use ▲ ▼.</>
            : 'Put the sentences in order. Drag them, or tap one and then tap where it should go.'}
        </div>
      )}
    </div>
  )

  const checkPanel = playing && (
    <div style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.15rem', marginTop: '0.9rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {lastResult !== null && (
        <div style={{ marginBottom: '0.85rem', padding: '0.7rem 0.8rem', borderRadius: '10px', background: '#f7f8ff', border: '1px solid #e0e4fb' }}>
          <div style={{ fontSize: '0.9rem', color: '#2d3748' }}>
            {checksLeft > 0 ? 'Last check: ' : 'No checks left. Last check: '}
            <strong>{lastResult} of {n - 1}</strong> links right
          </div>
          <LinkMeter right={lastResult} total={n - 1} />
          {checksLeft > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '6px' }}>
              A link is two sentences that belong next to each other. Which ones are right? That's for you to work out.
            </div>
          )}
        </div>
      )}

      {checksLeft > 0 ? (
        <>
          <button onClick={check} disabled={unchanged || !!drag}
            style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '0.98rem',
              background: unchanged ? '#e2e8f0' : GRADIENT, color: unchanged ? '#718096' : 'white', cursor: unchanged ? 'default' : 'pointer',
            }}>
            {unchanged ? 'Move a sentence first' : 'Check my order'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '0.55rem', fontSize: '0.78rem', color: '#718096', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', gap: '4px' }} aria-hidden="true">
              {Array.from({ length: MAX_CHECKS }, (_, i) => (
                <span key={i} style={{ width: '9px', height: '9px', borderRadius: '50%', background: i < checksLeft ? '#667eea' : '#e2e8f0' }} />
              ))}
            </span>
            <span>{checksLeft} check{checksLeft === 1 ? '' : 's'} left · solve it now for {'⭐'.repeat(starsFor(checksUsed + 1))}</span>
          </div>
        </>
      ) : (
        <button onClick={reveal} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', background: GRADIENT, color: 'white', fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer' }}>
          Show me the answer
        </button>
      )}

      {checksLeft > 0 && (canHint || checksUsed > 0) && confirm === null && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {canHint && smallButton('💡 Show me how it starts', () => setConfirm('hint'))}
          {checksUsed > 0 && smallButton('Show me the answer', () => setConfirm('reveal'), '#718096')}
        </div>
      )}
      {confirm === 'hint' && confirmBox(
        'This puts the first sentence at the top and locks it there. It uses one of your checks.',
        'Yes, show me', takeHint)}
      {confirm === 'reveal' && confirmBox(
        `You still have ${checksLeft} check${checksLeft === 1 ? '' : 's'}. If you see the answer now, there are no stars for this story.`,
        'Show me', reveal)}
    </div>
  )

  const resultPanel = finished && (
    mode === 'solved' ? (
      <div style={{
        background: 'white', borderRadius: '14px', padding: '1.1rem 1.15rem', marginTop: '0.9rem', textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: '2px solid #fde68a',
        animation: celebrate ? `ss-rise 400ms ease ${n * CASCADE_MS + 150}ms both` : undefined,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', fontSize: '2.6rem', lineHeight: 1.1 }}>
          {Array.from({ length: earned }, (_, i) => (
            <span key={i} style={{ display: 'inline-block', animation: celebrate ? `ss-pop 550ms cubic-bezier(.2,1.2,.4,1) ${n * CASCADE_MS + 350 + i * 220}ms both` : undefined }}>⭐</span>
          ))}
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2d3748', marginTop: '0.5rem' }}>
          {checksUsed === 1 ? 'Perfect! Solved on your first check.'
            : hintUsed && checksUsed === 2 ? 'Solved, with a little help from the hint.'
            : checksUsed === 2 ? 'Solved on your second check!'
            : 'Solved on your last check. Phew!'}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem' }}>
          {teacher ? 'Teacher view: no stars saved' : `${earned} star${earned === 1 ? '' : 's'} added to your collection`}
        </div>
      </div>
    ) : (
      <div style={{ background: 'white', borderRadius: '14px', padding: '1rem 1.15rem', marginTop: '0.9rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', border: `2px solid ${BLUE.border}` }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2b6cb0' }}>Here's how the story goes</div>
        <div style={{ fontSize: '0.85rem', color: '#4a5568', marginTop: '0.25rem', lineHeight: 1.5 }}>
          No stars this time, but read it through below: the highlighted words show how each sentence links to the others.
        </div>
      </div>
    )
  )

  const explained = finished && (
    <div style={{
      background: 'white', borderRadius: '14px', padding: '1.1rem 1.15rem', marginTop: '0.9rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      animation: celebrate ? `ss-rise 400ms ease ${n * CASCADE_MS + 600}ms both` : undefined,
    }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>How it fits together</div>
      <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', lineHeight: 1.8, color: '#2d3748' }}>
        {text.sentences.map((s, i) => (
          <span key={i} onClick={() => setNoteIdx(noteIdx === i ? null : i)}
            style={{ cursor: 'pointer', borderRadius: '4px', background: noteIdx === i ? '#ede9fe' : 'transparent', boxShadow: noteIdx === i ? '0 0 0 2px #ede9fe' : 'none' }}>
            <sup style={{ color: '#a0aec0', fontWeight: 700, fontSize: '0.62em', marginRight: '2px' }}>{i + 1}</sup>
            <Clues text={s} />
            {i < text.sentences.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
      {noteIdx !== null ? (
        <div style={{ marginTop: '0.75rem', padding: '0.7rem 0.85rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.88rem', color: '#744210', lineHeight: 1.5 }}>
          💡 <strong>Sentence {noteIdx + 1}.</strong> {text.notes[noteIdx]}
        </div>
      ) : (
        <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#718096' }}>
          Tap any sentence to see how it fits. The highlighted words are the clues.
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', gap: '8px', flexWrap: 'wrap' }}>
        {smallButton(allNotes ? 'Hide the clues' : 'Show all the clues', () => setAllNotes(v => !v))}
        <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>
          In letters: {identity(text.sentences.length).map(k => letterOf[k]).join(' ')}
        </span>
      </div>
      {allNotes && (
        <ol style={{ margin: '0.6rem 0 0', paddingLeft: '1.3rem', color: '#4a5568', fontSize: '0.85rem', lineHeight: 1.5 }}>
          {text.notes.map((note, i) => <li key={i} style={{ marginBottom: '0.45rem' }}>{note}</li>)}
        </ol>
      )}
    </div>
  )

  const statusOf = r => {
    if (teacher) return r.week_start > thisWeek ? liveLabel(r) : r.week_start === thisWeek ? 'This week' : ''
    const s = sessions[r.id]
    if (s?.solved) return '⭐'.repeat(starsFor(s.checks_used))
    if (s?.revealed) return 'Answer seen'
    if (s) return 'In progress'
    return r.week_start === thisWeek ? 'New' : ''
  }

  const moreStories = others.length > 0 && (
    <>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '1.4rem 0 0.5rem 0.25rem' }}>
        {language === 'es' ? 'More stories' : `More ${level} stories`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem' }}>
        {others.map(r => (
          <button key={r.id} onClick={() => openText(r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>{r.title}</span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: '#a0aec0', marginTop: '1px' }}>Week of {formatWeek(r.week_start)}</span>
            </span>
            <span style={{ fontSize: '0.75rem', color: '#718096', whiteSpace: 'nowrap' }}>{statusOf(r)}</span>
            <span style={{ color: '#cbd5e0' }}>→</span>
          </button>
        ))}
      </div>
    </>
  )

  return shell(
    <>
      {header}
      {levelPills}
      {teacherBar}
      {storyCard}
      {cards}
      {checkPanel}
      {resultPanel}
      {explained}
      {moreStories}
      <div style={{ marginTop: '1rem' }}>{backButton}</div>
    </>
  )
}
