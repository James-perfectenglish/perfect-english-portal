import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'
import HelpSheet from './components/HelpSheet'
import Breadcrumb from './components/Breadcrumb'

// ── Word Bluff (Oct 2026) ───────────────────────────────────────────────────
// Five new words a day per level (A/B/C) from bluff_words. Each word appears in
// context (the target marked [[like this]]) with optional ElevenLabs audio, and
// three definitions, only one of them real.
//
// Answers save to bluff_sessions the moment they're given, so a refresh resumes
// where the student left off and an answer can't be changed.
// Stars: source 'bluff', subtypes complete / sharp_eye (4+ right) / sentence,
// dedupe_key 'bluff:<date>:<level>:<subtype>'.
// Teachers (is_teacher, including Present Mode) play without saving anything,
// can replay, and can step through every day's set to review content or use
// it in class.

export const GAME_TITLE = 'Word Bluff'

const GRADIENT      = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
const OPTION_KEYS   = ['a', 'b', 'c']
const SHARP_EYE_MIN = 4
const GREEN = { bg: '#f0fff4', border: '#68d391', text: '#276749' }
const RED   = { bg: '#fff5f5', border: '#fc8181', text: '#9b2c2c' }

const todayISO = () => new Date().toISOString().slice(0, 10)

function levelForProfile(profile) {
  const lvl = profile?.level || ''
  if (lvl.startsWith('A')) return 'A'
  if (lvl.startsWith('B')) return 'B'
  if (lvl.startsWith('C')) return 'C'
  return 'B'
}

function formatDate(iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts)
}

// "I was so [[embarrassed]] when…" → text with the target word highlighted.
function Highlighted({ text }) {
  const parts = (text || '').split(/\[\[(.+?)\]\]/)
  return parts.map((p, i) => (i % 2 === 1
    ? <strong key={i} style={{ color: '#553C9A', background: '#f3efff', padding: '0 3px', borderRadius: '4px' }}>{p}</strong>
    : <span key={i}>{p}</span>))
}

function SpeakButton({ url, playing, onPlay, label = 'Listen', size = 32 }) {
  if (!url) return null
  return (
    <button
      onClick={e => { e.stopPropagation(); onPlay(url) }}
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${playing ? '#667eea' : '#d6d9f5'}`,
        background: playing ? '#667eea' : 'white',
        color: playing ? 'white' : '#667eea',
        fontSize: size > 30 ? '0.95rem' : '0.8rem', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        transition: 'all 0.15s',
      }}>
      🔊
    </button>
  )
}

export default function BluffGame({ onBack, userProfile }) {
  const isTeacher = !!userProfile?.is_teacher
  const isSpanish = (Array.isArray(userProfile?.tracks) && userProfile.tracks.includes('spanish'))
    || userProfile?.level === 'Spanish'
  const today = todayISO()

  const [level, setLevel]       = useState(() => levelForProfile(userProfile))
  const [viewDate, setViewDate] = useState(null)       // the set on screen
  const [dates, setDates]       = useState([])         // teacher: every date with a set at this level
  const [nextDate, setNextDate] = useState(null)       // student: next set, for the "no set today" screen
  const [mode, setMode]         = useState(isSpanish ? 'english_only' : 'loading')  // + noset | playing | results
  const [words, setWords]       = useState([])
  const [answers, setAnswers]   = useState({})         // { [bluff_words.id]: 'a' | 'b' | 'c' }
  const [seenOn, setSeenOn]     = useState({})         // { [bluff_words.id]: date the returning word was first shown }
  const [index, setIndex]       = useState(0)

  const [sentenceDone, setSentenceDone]         = useState(false)
  const [sentenceStar, setSentenceStar]         = useState(false)
  const [sentenceFeedback, setSentenceFeedback] = useState(null)
  const [challengeWord, setChallengeWord]       = useState(null)

  const [playingUrl, setPlayingUrl] = useState(null)
  const audioRef   = useRef(null)
  const answerLock = useRef(false)   // stops a fast double tap answering twice

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause() }, [])

  // ── Audio ──────────────────────────────────────────────────────────────────
  function play(url) {
    if (!url) return
    try {
      if (audioRef.current) audioRef.current.pause()
      const a = new Audio(url)
      audioRef.current = a
      setPlayingUrl(url)
      const done = () => setPlayingUrl(p => (p === url ? null : p))
      a.onended = done
      a.onerror = done
      a.play().catch(done)
    } catch {
      setPlayingUrl(null)
    }
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  // Called from click handlers before switching level or date. (Kept out of
  // loadSet so the load effect only sets state after its first await.)
  function resetState() {
    setMode('loading')
    setWords([])
    setAnswers({})
    setSeenOn({})
    setIndex(0)
    setSentenceDone(false)
    setSentenceStar(false)
    setSentenceFeedback(null)
    setChallengeWord(null)
    answerLock.current = false
  }

  async function loadSet(lvl, requestedDate) {
    let target = today
    if (isTeacher) {
      const { data: ds } = await supabase
        .from('bluff_words').select('play_date')
        .eq('level', lvl).eq('position', 1).order('play_date')
      const list = (ds || []).map(r => r.play_date)
      setDates(list)
      if (requestedDate && list.includes(requestedDate)) target = requestedDate
      else if (list.includes(today)) target = today
      else target = list.find(d => d > today) || list[list.length - 1] || today
    }

    const { data: rows } = await supabase
      .from('bluff_words')
      .select('id, play_date, level, position, word, part_of_speech, contexts, options, correct_option, reveal_note, audio_word_url, audio_context_urls, returning_from')
      .eq('play_date', target).eq('level', lvl)
      .order('position')
    setViewDate(target)

    if (!rows || rows.length === 0) {
      if (!isTeacher) {
        const { data: nxt } = await supabase
          .from('bluff_words').select('play_date')
          .eq('level', lvl).gt('play_date', today)
          .order('play_date').limit(1).maybeSingle()
        setNextDate(nxt?.play_date || null)
      }
      setMode('noset')
      return
    }
    setWords(rows)

    // Returning words (returning_from set) come back 21 days after they were
    // introduced. A student sees "Seen on <date>" only if they answered the
    // original; anyone who started later or missed that day just gets it as a
    // new word. Teachers see every returning word labelled.
    const returning = rows.filter(w => w.returning_from)
    let firstShown = {}   // { [original id]: its play_date }
    if (returning.length) {
      const { data: orig } = await supabase
        .from('bluff_words').select('id, play_date')
        .in('id', returning.map(w => w.returning_from))
      firstShown = Object.fromEntries((orig || []).map(o => [o.id, o.play_date]))
    }
    const answeredBefore = new Set()

    let saved = {}
    let completed = false
    if (!isTeacher) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: s } = await supabase
          .from('bluff_sessions').select('*')
          .eq('student_id', user.id).eq('play_date', target).eq('level', lvl)
          .maybeSingle()
        if (s) {
          saved = s.answers || {}
          completed = !!s.completed
          if (s.sentence_done) setSentenceDone(true)
          if (s.sentence_star) setSentenceStar(true)
        }
        const origDates = [...new Set(Object.values(firstShown))]
        if (origDates.length) {
          const { data: past } = await supabase
            .from('bluff_sessions').select('answers')
            .eq('student_id', user.id).in('play_date', origDates)
          for (const p of past || []) {
            for (const id of Object.keys(p.answers || {})) answeredBefore.add(Number(id))
          }
        }
      }
    }
    const seen = {}
    for (const w of returning) {
      const first = firstShown[w.returning_from]
      if (first && (isTeacher || answeredBefore.has(Number(w.returning_from)))) seen[w.id] = first
    }
    setSeenOn(seen)
    setAnswers(saved)

    const firstOpen = rows.findIndex(w => !saved[w.id])
    if (firstOpen === -1) {
      setIndex(rows.length - 1)
      setMode('results')
      // Every word answered but the results screen never reached (app closed):
      // finish properly now so the session and stars are recorded.
      if (!completed && !isTeacher) await finalise(rows, saved, target, lvl)
    } else {
      setIndex(firstOpen)
      setMode('playing')
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const countCorrect = (rows, ans) => rows.filter(w => ans[w.id] === w.correct_option).length

  async function saveSession(rows, ans, completed, date = viewDate, lvl = level) {
    if (isTeacher) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('bluff_sessions').upsert({
      student_id:    user.id,
      play_date:     date,
      level:         lvl,
      answers:       ans,
      correct_count: countCorrect(rows, ans),
      completed,
      completed_at:  completed ? new Date().toISOString() : null,
    }, { onConflict: 'student_id,play_date,level' })
    if (error) console.warn('Word Bluff: could not save progress:', error)
  }

  async function writeStar(subtype, date, lvl, extras = {}) {
    if (isTeacher) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { error } = await supabase.from('stars').insert({
        student_id: user.id,
        source:     'bluff',
        subtype,
        context:    { play_date: date, level: lvl, dedupe_key: `bluff:${date}:${lvl}:${subtype}`, ...extras },
      })
      if (error && error.code !== '23505') console.warn('Word Bluff star insert failed:', error)
    } catch (e) {
      console.warn('Word Bluff star log failed:', e)
    }
  }

  async function finalise(rows, ans, date, lvl) {
    const correct = countCorrect(rows, ans)
    await saveSession(rows, ans, true, date, lvl)
    await writeStar('complete', date, lvl, { correct })
    if (correct >= SHARP_EYE_MIN) await writeStar('sharp_eye', date, lvl, { correct })
  }

  // ── Play ───────────────────────────────────────────────────────────────────
  function choose(key) {
    const w = words[index]
    if (mode !== 'playing' || !w || answers[w.id] || answerLock.current) return
    answerLock.current = true
    const next = { ...answers, [w.id]: key }
    setAnswers(next)
    saveSession(words, next, false)
  }

  function goNext() {
    answerLock.current = false
    if (audioRef.current) audioRef.current.pause()
    setPlayingUrl(null)
    if (index < words.length - 1) {
      setIndex(index + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setMode('results')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (!isTeacher) finalise(words, answers, viewDate, level)
    }
  }

  function replay() {
    setAnswers({})
    setIndex(0)
    setSentenceDone(false)
    setSentenceStar(false)
    setSentenceFeedback(null)
    answerLock.current = false
    setMode('playing')
  }

  function changeLevel(L) {
    if (L === level) return
    resetState()
    setLevel(L)   // the load effect picks up the new level
  }

  function stepDate(dir) {
    const i = dates.indexOf(viewDate)
    const target = dates[i + dir]
    if (!target) return
    resetState()
    loadSet(level, target)
  }

  async function handleSentenceMarked({ result }) {
    const data = result || { valid: null }
    const passed = data.valid === true
    setSentenceFeedback(data)
    setSentenceDone(true)
    if (passed) setSentenceStar(true)
    if (isTeacher) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('bluff_sessions')
      .update({ sentence_done: true, sentence_star: passed })
      .eq('student_id', user.id).eq('play_date', viewDate).eq('level', level)
    if (error) console.warn('Word Bluff: could not save sentence result:', error)
  }

  // Load on open and whenever the level changes. Fetching data is what this
  // effect is for (state is only set after the first await), the same pattern
  // as CrosswordGame's loadPuzzle effect, so the two lint rules are silenced.
  useEffect(() => {
    if (isSpanish) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSet(level, isTeacher ? viewDate : today)
  }, [level]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────
  const correctCount = countCorrect(words, answers)
  const finished     = mode === 'results'
  const stars = isTeacher ? 0
    : (finished ? 1 : 0) + (finished && correctCount >= SHARP_EYE_MIN ? 1 : 0) + (sentenceStar ? 1 : 0)
  const definitionOf = w => w.options[OPTION_KEYS.indexOf(w.correct_option)]
  const dateIdx      = dates.indexOf(viewDate)

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const shell = children => (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {onBack && <Breadcrumb section="Play" title={GAME_TITLE} onExit={onBack} />}
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '1rem 1rem 3rem' }}>
        {children}
      </div>
    </div>
  )

  const header = (
    <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.1rem 2.5rem', textAlign: 'center', color: 'white', marginBottom: '0.75rem', position: 'relative' }}>
      <HelpSheet
        title="How to play"
        points={[
          'Five words every day, at your level.',
          "Words come back about three weeks later with a new sentence, to check they've stuck. If you met one the first time, it's marked 🔁.",
          'Each word comes with an example sentence. Only one of the three definitions is real; the other two are bluffs.',
          'Read the sentence, or tap 🔊 to hear it, and use it for clues.',
          "Not sure? Have a guess. You'll see the real meaning straight away, and that's how the word sticks.",
          'Your answer is final once you tap it.',
          'Earn ⭐ for finishing, ⭐ for four or more right, and ⭐ for using one of the words in a sentence.',
        ]}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🃏</span>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '2px' }}>WORD BLUFF</h1>
      </div>
      <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: '0.88rem', fontWeight: 600 }}>
        {viewDate ? formatDate(viewDate) : 'Spot the real definition'}
      </p>
    </div>
  )

  const levelPills = (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', padding: '8px', background: 'white', borderRadius: '10px', marginBottom: '0.75rem' }}>
      <span style={{ fontSize: '0.72rem', color: '#a0aec0', fontWeight: 600, marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Level</span>
      {['A', 'B', 'C'].map(L => {
        const active = level === L
        return (
          <button key={L} onClick={() => changeLevel(L)} style={{
            padding: '6px 14px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', minWidth: '38px', cursor: 'pointer',
            border: '2px solid ' + (active ? '#667eea' : '#e2e8f0'),
            background: active ? '#667eea' : 'white', color: active ? 'white' : '#4a5568',
          }}>{L}</button>
        )
      })}
    </div>
  )

  const teacherBar = isTeacher && (
    <div style={{ background: '#faf5ff', border: '1px solid #e9d8fd', borderRadius: '10px', padding: '0.55rem 0.75rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <button onClick={() => stepDate(-1)} disabled={dateIdx <= 0} aria-label="Previous day"
        style={{ border: 'none', background: 'white', borderRadius: '8px', width: '32px', height: '32px', cursor: dateIdx > 0 ? 'pointer' : 'default', color: dateIdx > 0 ? '#553C9A' : '#d6bcfa', fontWeight: 700 }}>‹</button>
      <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#553C9A' }}>
          {viewDate === today ? 'Live today' : viewDate > today ? `Goes live ${formatDate(viewDate, { weekday: 'short', day: 'numeric', month: 'short' })}` : `Played ${formatDate(viewDate, { weekday: 'short', day: 'numeric', month: 'short' })}`}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#805ad5' }}>Teacher view · nothing is saved</div>
      </div>
      <button onClick={() => stepDate(1)} disabled={dateIdx === -1 || dateIdx >= dates.length - 1} aria-label="Next day"
        style={{ border: 'none', background: 'white', borderRadius: '8px', width: '32px', height: '32px', cursor: dateIdx < dates.length - 1 ? 'pointer' : 'default', color: dateIdx < dates.length - 1 ? '#553C9A' : '#d6bcfa', fontWeight: 700 }}>›</button>
    </div>
  )

  const progressDots = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '0 0 0.75rem' }}>
      {words.map((w, i) => {
        const a = answers[w.id]
        const bg = a ? (a === w.correct_option ? '#48bb78' : '#fc8181') : (i === index && !finished ? '#667eea' : '#e2e8f0')
        return <div key={w.id} style={{ width: i === index && !finished ? '22px' : '10px', height: '10px', borderRadius: '999px', background: bg, transition: 'all 0.2s' }} />
      })}
    </div>
  )

  const backButton = onBack && (
    <button onClick={onBack} style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem' }}>
      ← Back
    </button>
  )

  // ── Screens ────────────────────────────────────────────────────────────────
  if (mode === 'loading') return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>Loading today's words...</div>
  )

  if (mode === 'english_only') return shell(
    <>
      {header}
      <div style={{ background: 'white', borderRadius: '12px', padding: '2rem 1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🃏</div>
        <h2 style={{ color: '#2d3748', margin: '0 0 0.5rem' }}>English only for now</h2>
        <p style={{ color: '#718096', margin: '0 0 1.25rem' }}>Word Bluff is for English learners. There's no Spanish version yet.</p>
        {backButton}
      </div>
    </>
  )

  if (mode === 'noset') return shell(
    <>
      {header}
      {levelPills}
      {teacherBar}
      <div style={{ background: 'white', borderRadius: '12px', padding: '2rem 1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🃏</div>
        <h2 style={{ color: '#2d3748', margin: '0 0 0.5rem' }}>{nextDate ? 'New words on the way' : `No level ${level} words today`}</h2>
        <p style={{ color: '#718096', margin: '0 0 1.25rem' }}>
          {nextDate ? `The next set arrives on ${formatDate(nextDate)}.` : 'Try another level, or check back tomorrow.'}
        </p>
        {backButton}
      </div>
    </>
  )

  // ── Playing ────────────────────────────────────────────────────────────────
  if (mode === 'playing') {
    const w = words[index]
    const chosen = answers[w.id]
    const revealed = !!chosen
    const gotIt = chosen === w.correct_option
    const isLast = index === words.length - 1

    return shell(
      <>
        {header}
        {levelPills}
        {teacherBar}
        {progressDots}

        <div style={{ background: 'white', borderRadius: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '1rem' }}>
          {/* The word */}
          <div style={{ padding: '1.1rem 1.25rem 0.9rem', borderBottom: '1px solid #f0f0f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Word {index + 1} of {words.length}
              </span>
              {seenOn[w.id] && (
                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#2b6cb0', background: '#ebf8ff', padding: '2px 8px', borderRadius: '999px' }}>
                  🔁 {isTeacher ? 'Back from' : 'Seen on'} {formatDate(seenOn[w.id], { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(1.7rem, 7vw, 2.1rem)', fontWeight: 800, color: '#2C3E50', lineHeight: 1.15 }}>{w.word}</span>
              <SpeakButton url={w.audio_word_url} playing={playingUrl === w.audio_word_url} onPlay={play} label={`Hear "${w.word}"`} size={34} />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#a0aec0', fontStyle: 'italic', marginTop: '2px' }}>{w.part_of_speech}</div>
          </div>

          {/* In context */}
          <div style={{ padding: '0.9rem 1.25rem', background: '#fafaff' }}>
            {(w.contexts || []).map((c, i) => {
              const url = (w.audio_context_urls || [])[i]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: i ? '0.6rem' : 0 }}>
                  <p style={{ flex: 1, margin: 0, fontSize: '1rem', color: '#2d3748', lineHeight: 1.55 }}>
                    <Highlighted text={c} />
                  </p>
                  <SpeakButton url={url} playing={playingUrl === url} onPlay={play} label="Hear the sentence" size={30} />
                </div>
              )
            })}
          </div>

          {/* Definitions */}
          <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#4a5568', marginBottom: '0.6rem' }}>
              {revealed ? (gotIt ? '✅ Spot on! That one is real.' : '🃏 That one was a bluff. Here is the real meaning:') : 'Which definition is real?'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {w.options.map((opt, i) => {
                const key = OPTION_KEYS[i]
                const isReal = key === w.correct_option
                const isChosen = key === chosen
                let look = { bg: 'white', border: '#e2e8f0', text: '#2d3748', opacity: 1 }
                if (revealed && isReal) look = { ...GREEN, opacity: 1 }
                else if (revealed && isChosen) look = { ...RED, opacity: 1 }
                else if (revealed) look = { ...look, opacity: 0.45 }
                return (
                  <button key={key} onClick={() => choose(key)} disabled={revealed}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left',
                      width: '100%', padding: '0.8rem 0.9rem', borderRadius: '10px',
                      border: `2px solid ${look.border}`, background: look.bg, color: look.text, opacity: look.opacity,
                      fontSize: '0.95rem', lineHeight: 1.4, cursor: revealed ? 'default' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}>
                    <span style={{
                      flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', marginTop: '-1px',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800,
                      background: revealed && isReal ? '#48bb78' : revealed && isChosen ? '#fc8181' : '#edf2f7',
                      color: revealed && (isReal || isChosen) ? 'white' : '#4a5568',
                    }}>
                      {revealed && isReal ? '✓' : revealed && isChosen ? '✗' : key.toUpperCase()}
                    </span>
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>

            {revealed && w.reveal_note && (
              <div style={{ marginTop: '0.9rem', padding: '0.75rem 0.9rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '0.88rem', color: '#744210', lineHeight: 1.5 }}>
                💡 {w.reveal_note}
              </div>
            )}

            {revealed && (
              <button onClick={goNext} style={{
                marginTop: '1rem', width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: GRADIENT, color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
              }}>
                {isLast ? 'See your results →' : 'Next word →'}
              </button>
            )}
          </div>
        </div>

        {!revealed && backButton}
      </>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────
  const scoreLine = correctCount === words.length ? 'Perfect! You spotted every bluff.'
    : correctCount >= SHARP_EYE_MIN ? 'Sharp eyes! You spotted nearly every bluff.'
    : correctCount >= 2 ? 'Nice work. Five new words for your collection.'
    : "The bluffers won today, but now you know five new words."

  return shell(
    <>
      {header}
      {levelPills}
      {teacherBar}

      {/* Score */}
      <div style={{ background: 'white', borderRadius: '14px', padding: '1.25rem', textAlign: 'center', marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>You found</div>
        <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#2d3748', lineHeight: 1.1 }}>{correctCount}<span style={{ fontSize: '1.3rem', color: '#a0aec0' }}> / {words.length}</span></div>
        <div style={{ fontSize: '0.88rem', color: '#4a5568', margin: '0.3rem 0 0.75rem' }}>{scoreLine}</div>
        {progressDots}
        {isTeacher ? (
          <button onClick={replay} style={{ padding: '0.55rem 1.2rem', borderRadius: '999px', border: '2px solid #667eea', background: 'white', color: '#553C9A', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
            ↺ Play again
          </button>
        ) : stars > 0 && (
          <div style={{ padding: '0.65rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '1.6rem' }}>{Array(stars).fill('⭐️').join(' ')}</div>
            <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 600, marginTop: '2px' }}>
              {[
                'Set finished',
                correctCount >= SHARP_EYE_MIN && `${correctCount} right`,
                sentenceStar && 'great sentence',
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        )}
      </div>

      {/* Sentence challenge */}
      {!sentenceDone ? (
        <div style={{ background: 'white', borderRadius: '14px', padding: '1.1rem 1.25rem', marginBottom: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', marginBottom: '4px' }}>✍️ Now use one of today's words</div>
          <div style={{ fontSize: '0.82rem', color: '#718096', marginBottom: '12px' }}>Pick a word and write or say a sentence with it.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {words.map(w => (
              <button key={w.id} onClick={() => setChallengeWord(w)} style={{
                padding: '6px 12px', borderRadius: '999px', fontWeight: 600, fontSize: '0.85rem',
                background: 'white', border: '2px solid #534AB7', color: '#534AB7', cursor: 'pointer',
              }}>{w.word}</button>
            ))}
          </div>
          {!isTeacher && <p style={{ fontSize: '0.72rem', color: '#a0aec0', margin: '10px 0 0', textAlign: 'center' }}>Earn ⭐ for a good sentence</p>}
        </div>
      ) : sentenceFeedback ? (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '0.75rem', fontSize: '0.9rem', lineHeight: 1.5,
          background: sentenceFeedback.valid ? GREEN.bg : RED.bg,
          border: `1px solid ${sentenceFeedback.valid ? '#c6f6d5' : '#fed7d7'}`,
          color: sentenceFeedback.valid ? GREEN.text : RED.text,
        }}>
          {sentenceFeedback.valid ? '✅ ' : '❌ '}{sentenceFeedback.feedback || sentenceFeedback.reason}
        </div>
      ) : (
        // Coming back later the same day: the feedback text isn't stored, just the outcome.
        <div style={{ padding: '0.65rem 1rem', borderRadius: '10px', marginBottom: '0.75rem', fontSize: '0.85rem', background: 'white', color: '#718096', textAlign: 'center' }}>
          ✍️ Sentence challenge done{sentenceStar ? ' ⭐' : ''}
        </div>
      )}

      {/* Review */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '1rem 0 0.5rem 0.25rem' }}>
        Today's words
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
        {words.map(w => {
          const chosen = answers[w.id]
          const right = chosen === w.correct_option
          const chosenText = chosen && !right ? w.options[OPTION_KEYS.indexOf(chosen)] : null
          return (
            <div key={w.id} style={{ background: 'white', borderRadius: '12px', padding: '0.9rem 1rem', borderLeft: `4px solid ${right ? '#48bb78' : '#fc8181'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2C3E50' }}>{w.word}</span>
                <span style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>{w.part_of_speech}</span>
                <SpeakButton url={w.audio_word_url} playing={playingUrl === w.audio_word_url} onPlay={play} label={`Hear "${w.word}"`} size={26} />
                <span style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>{right ? '✅' : '🃏'}</span>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#2d3748', marginTop: '4px', lineHeight: 1.45 }}>{definitionOf(w)}</div>
              {chosenText && (
                <div style={{ fontSize: '0.78rem', color: '#a0aec0', marginTop: '3px' }}>
                  You chose: <span style={{ textDecoration: 'line-through' }}>{chosenText}</span>
                </div>
              )}
              {(w.contexts || []).map((c, i) => {
                const url = (w.audio_context_urls || [])[i]
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' }}>
                    <p style={{ flex: 1, margin: 0, fontSize: '0.84rem', color: '#4a5568', fontStyle: 'italic', lineHeight: 1.45 }}><Highlighted text={c} /></p>
                    <SpeakButton url={url} playing={playingUrl === url} onPlay={play} label="Hear the sentence" size={24} />
                  </div>
                )
              })}
              {w.reveal_note && <div style={{ fontSize: '0.8rem', color: '#744210', marginTop: '6px', lineHeight: 1.45 }}>💡 {w.reveal_note}</div>}
            </div>
          )
        })}
      </div>

      {!isTeacher && <p style={{ color: '#718096', fontSize: '0.82rem', textAlign: 'center', margin: '0 0 0.75rem' }}>Come back tomorrow for five new words 🃏</p>}
      {backButton}

      {challengeWord && (
        <SentenceChallenge
          word={challengeWord.word}
          language="en"
          exercise="bluff"
          apiContext="wotd"
          apiExtraFields={{ partOfSpeech: challengeWord.part_of_speech, definition: definitionOf(challengeWord) }}
          dedupeKey={`bluff:${viewDate}:${level}:sentence`}
          headerLabel="🃏 Word Bluff"
          promptText="Use it in a sentence:"
          noStars={isTeacher}
          onMarkResult={handleSentenceMarked}
          onClose={() => setChallengeWord(null)}
        />
      )}
    </>
  )
}
