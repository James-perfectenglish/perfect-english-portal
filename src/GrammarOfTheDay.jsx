import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'

const levelBucket = (profileLevel) => {
  if (!profileLevel) return 'B1/B2'
  if (['A1', 'A2'].includes(profileLevel)) return 'A1/A2'
  if (['B1', 'B2'].includes(profileLevel)) return 'B1/B2'
  return 'C1/C2'
}

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const levelColourMap = {
  A1: '#48bb78', A2: '#48bb78', 'A1/A2': '#48bb78',
  B1: '#4299e1', B2: '#4299e1', 'B1/B2': '#4299e1',
  C1: '#ed8936', C2: '#ed8936', 'C1/C2': '#ed8936',
}

function getLevelColour(level) {
  if (level === 'Spanish') return '#e53e3e'
  return levelColourMap[level] || '#718096'
}

// Day index from epoch (UTC) — same for everyone on a given UTC day.
function daysSinceEpoch() {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24))
}

export default function GrammarOfTheDay({ profile, collapsible = true, classItem = null }) {
  const teacherMode = !!classItem  // Class Play: run a specific grammar point, no submission/stars
  const [item, setItem]                   = useState(null)
  const [submission, setSubmission]       = useState(null)
  const [loading, setLoading]             = useState(true)
  const [noItem, setNoItem]               = useState(false)
  const [expanded, setExpanded]           = useState(!collapsible)
  const [showChallenge, setShowChallenge] = useState(false)

  const isSpanish = teacherMode
    ? classItem.language === 'es'
    : ((Array.isArray(profile?.tracks) && profile.tracks.includes('spanish')) || profile?.level === 'Spanish')
  const bucket    = teacherMode ? classItem.level : levelBucket(profile?.level)
  const language  = isSpanish ? 'es' : 'en'
  const level     = isSpanish ? (profile?.spanish_level || 'A1/A2') : bucket

  useEffect(() => { fetchItem() }, [profile])

  const fetchItem = async () => {
    setLoading(true)

    // Class Play: a specific grammar row is supplied; show it directly, no submission lookup.
    if (teacherMode) {
      setItem(classItem)
      setLoading(false)
      return
    }

    // Count active rows at this level + language, then pick by day index.
    const { data: pool, error } = await supabase
      .from('grammar_of_the_day')
      .select('*')
      .eq('language', language)
      .eq('level', level)
      .eq('active', true)
      .order('id', { ascending: true })

    if (error || !pool || pool.length === 0) {
      setNoItem(true); setLoading(false); return
    }

    const pick = pool[daysSinceEpoch() % pool.length]
    setItem(pick)

    // Existing submission for TODAY only?
    // We use the UTC-day boundary, matching `daysSinceEpoch()` above so the question
    // "did I already submit?" stays consistent with "which grammar item is today's?".
    // This means a student can submit again the next time the same grammar point comes round.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const startOfTodayUTC = new Date()
      startOfTodayUTC.setUTCHours(0, 0, 0, 0)
      const { data: existing } = await supabase
        .from('grammar_of_the_day_submissions')
        .select('*')
        .eq('student_id', user.id)
        .eq('grammar_id', pick.id)
        .gte('submitted_at', startOfTodayUTC.toISOString())
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) setSubmission(existing)
    }

    setLoading(false)
  }

  const onMarked = async ({ sentence, inputMethod, result }) => {
    // SentenceChallenge has already written to sentence_challenges (star logged).
    // Our job: persist to grammar_of_the_day_submissions so the card shows the
    // student's answer on return.
    if (!item || teacherMode) return
    const isCorrect = result?.valid === true
    const feedbackText = result?.feedback || result?.reason || (isCorrect
      ? (isSpanish ? '¡Buena frase!' : 'Great sentence!')
      : (isSpanish ? 'Inténtalo de nuevo.' : 'Try again — read the example carefully.'))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: saved, error: saveErr } = await supabase
      .from('grammar_of_the_day_submissions')
      .insert({
        student_id:  user.id,
        grammar_id:  item.id,
        sentence:    sentence.trim(),
        is_correct:  isCorrect,
        ai_feedback: feedbackText,
        input_method: inputMethod || 'text',
      })
      .select().single()

    if (saveErr) console.warn('GOTD: could not save submission:', saveErr)
    if (saved) setSubmission(saved)
  }

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
      {isSpanish ? 'Cargando la gramática del día...' : "Loading today's grammar..."}
    </div>
  )

  if (noItem) return null

  const alreadySubmitted = !!submission
  const feedbackToShow   = alreadySubmitted ? { valid: submission.is_correct, message: submission.ai_feedback } : null
  const levelColour      = isSpanish ? '#e53e3e' : getLevelColour(bucket)
  const levelLabel       = isSpanish ? 'ES' : bucket

  // ── COLLAPSED ────────────────────────────────────────────────────────────
  if (collapsible && !expanded) {
    return (
      <div onClick={() => setExpanded(true)} style={{
        background: GRADIENT, borderRadius: '16px', padding: '1rem 1.25rem',
        marginBottom: '1rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
            {isSpanish ? '📝 Gramática del día' : '📝 Grammar of the Day'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>{item.grammar_point}</span>
          </div>
          {alreadySubmitted && (
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>
              {submission.is_correct ? (isSpanish ? '✅ Enviado hoy' : '✅ Submitted today') : (isSpanish ? '↩ Inténtalo de nuevo' : '↩ Try again')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{ background: levelColour, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>{levelLabel}</span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>{isSpanish ? 'toca para abrir ↓' : 'tap to expand ↓'}</span>
        </div>
      </div>
    )
  }

  // ── EXPANDED ─────────────────────────────────────────────────────────────
  return (
    <>
    <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', overflow: 'hidden' }}>
      <div
        style={{ background: GRADIENT, padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', cursor: collapsible ? 'pointer' : 'default' }}
        onClick={collapsible ? () => setExpanded(false) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📝</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>
            {isSpanish ? 'Gramática del día' : 'Grammar of the Day'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ background: levelColour, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{levelLabel}</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
            {new Date().toLocaleDateString(isSpanish ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' })}
          </span>
          {collapsible && <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>↑</span>}
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <div style={{ marginBottom: '0.8rem' }}>
          <span style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.6rem)', fontWeight: '800', color: '#2C3E50' }}>
            {item.grammar_point}
          </span>
          {item.category && (
            <span style={{ marginLeft: '0.55rem', fontSize: '0.72rem', color: '#a0aec0', fontStyle: 'italic', fontWeight: '500', textTransform: 'lowercase' }}>
              {item.category}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {isSpanish ? 'Estructura' : 'Structure'}
            </span>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.92rem', color: '#2d3748', lineHeight: '1.5' }}>{item.structure}</p>
          </div>

          <div style={{ background: '#f7fafc', borderLeft: `3px solid ${levelColour}`, borderRadius: '0 8px 8px 0', padding: '0.55rem 0.85rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {isSpanish ? 'Ejemplo' : 'Example'}
            </span>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', color: '#2d3748', fontStyle: 'italic', lineHeight: '1.5' }}>"{item.example}"</p>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              {isSpanish ? 'Uso' : 'Usage'}
            </span>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: '1.5' }}>{item.usage}</p>
          </div>

          {item.common_mistake && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.55rem 0.85rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {isSpanish ? '⚠️ Error común' : '⚠️ Common mistake'}
              </span>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#78350f', lineHeight: '1.5' }}>{item.common_mistake}</p>
            </div>
          )}
        </div>

        {alreadySubmitted && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>
              {isSpanish ? 'Tu frase' : 'Your sentence'}
            </div>
            <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.92rem', color: '#2d3748', marginBottom: '0.75rem', fontStyle: 'italic' }}>
              "{submission.sentence}"
            </div>
            {feedbackToShow && (
              <div style={{ background: feedbackToShow.valid ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedbackToShow.valid ? '#c6f6d5' : '#fed7d7'}`, color: feedbackToShow.valid ? '#276749' : '#9b2c2c', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5' }}>
                {feedbackToShow.valid ? '✅ ' : '❌ '}{feedbackToShow.message}
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.75rem 0 0', textAlign: 'center' }}>
              {isSpanish ? 'Vuelve mañana para una nueva estructura 👋' : 'Come back tomorrow for a new structure 👋'}
            </p>
          </div>
        )}

        {!alreadySubmitted && (
          <div>
            <button
              onClick={() => setShowChallenge(true)}
              style={{
                width: '100%', padding: '0.85rem', background: GRADIENT, color: 'white',
                border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontWeight: '700', fontSize: '0.95rem', letterSpacing: '0.2px'
              }}>
              ⭐ {isSpanish ? 'Úsala en una frase →' : 'Use it in a sentence →'}
            </button>
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.6rem 0 0', textAlign: 'center' }}>
              {isSpanish
                ? `Escribe o graba una frase usando ${item.grammar_point}`
                : `Write or speak a sentence using ${item.grammar_point}`}
            </p>
          </div>
        )}
      </div>
    </div>
    {showChallenge && item && (
      <SentenceChallenge
        word={item.grammar_point}
        language={language}
        exercise="gotd"
        apiContext="gotd"
        apiExtraFields={{
          grammarPoint: item.grammar_point,
          structure:    item.structure,
          example:      item.example,
          usage:        item.usage,
        }}
        dedupeKey={`gotd:${item.id}:${new Date().toISOString().slice(0, 10)}`}
        noStars={teacherMode}
        headerLabel={isSpanish ? '📝 Gramática del día' : '📝 Grammar of the Day'}
        promptText={isSpanish ? 'Úsala en una frase:' : 'Use it in a sentence:'}
        onMarkResult={onMarked}
        onClose={() => setShowChallenge(false)}
      />
    )}
    </>
  )
}
