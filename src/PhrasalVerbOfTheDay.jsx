import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'

// Phrasal Verb of the Day — English only. Mirrors GrammarOfTheDay's pool/rotation
// shape (one item per UTC day, picked by day-index from the student's level band).
// Three distinct level bands: A1/A2, B1/B2, C1/C2 — each student only ever sees
// their own band, so an A-level PV like "sit down" never shows for a C student.

const levelBucket = (profileLevel) => {
  if (!profileLevel) return 'B1/B2'
  if (['A1', 'A2'].includes(profileLevel)) return 'A1/A2'
  if (['B1', 'B2'].includes(profileLevel)) return 'B1/B2'
  return 'C1/C2'
}

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const levelColourMap = {
  'A1/A2': '#48bb78',
  'B1/B2': '#4299e1',
  'C1/C2': '#ed8936',
}

// Day index from epoch (UTC) — same for everyone on a given UTC day.
function daysSinceEpoch() {
  return Math.floor(Date.now() / (1000 * 60 * 60 * 24))
}

export default function PhrasalVerbOfTheDay({ profile, collapsible = true, classItem = null }) {
  const teacherMode = !!classItem  // Class Play: run a specific phrasal verb, no submission/stars
  const [item, setItem]                   = useState(null)
  const [submission, setSubmission]       = useState(null)
  const [loading, setLoading]             = useState(true)
  const [noItem, setNoItem]               = useState(false)
  const [expanded, setExpanded]           = useState(!collapsible)
  const [showChallenge, setShowChallenge] = useState(false)

  const bucket = teacherMode ? classItem.level : levelBucket(profile?.level)
  const level  = bucket

  useEffect(() => { fetchItem() }, [profile])

  const fetchItem = async () => {
    setLoading(true)

    // Class Play: a specific phrasal-verb row is supplied; show it directly, no submission lookup.
    if (teacherMode) {
      setItem(classItem)
      setLoading(false)
      return
    }

    // Count active rows at this level (English only), then pick by day index.
    const { data: pool, error } = await supabase
      .from('phrasal_verb_of_the_day')
      .select('*')
      .eq('language', 'en')
      .eq('level', level)
      .eq('active', true)
      .order('id', { ascending: true })

    if (error || !pool || pool.length === 0) {
      setNoItem(true); setLoading(false); return
    }

    const pick = pool[daysSinceEpoch() % pool.length]
    setItem(pick)

    // Existing submission for TODAY only (UTC-day boundary, matching daysSinceEpoch()).
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const startOfTodayUTC = new Date()
      startOfTodayUTC.setUTCHours(0, 0, 0, 0)
      const { data: existing } = await supabase
        .from('phrasal_verb_of_the_day_submissions')
        .select('*')
        .eq('student_id', user.id)
        .eq('pv_id', pick.id)
        .gte('submitted_at', startOfTodayUTC.toISOString())
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) setSubmission(existing)
    }

    setLoading(false)
  }

  const onMarked = async ({ sentence, inputMethod, result }) => {
    // SentenceChallenge has already logged the star. Our job: persist to
    // phrasal_verb_of_the_day_submissions so the card shows the answer on return.
    if (!item || teacherMode) return
    const isCorrect = result?.valid === true
    const feedbackText = result?.feedback || result?.reason || (isCorrect
      ? 'Great sentence!'
      : 'Try again — read the example carefully.')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: saved, error: saveErr } = await supabase
      .from('phrasal_verb_of_the_day_submissions')
      .insert({
        student_id:   user.id,
        pv_id:        item.id,
        sentence:     sentence.trim(),
        is_correct:   isCorrect,
        ai_feedback:  feedbackText,
        input_method: inputMethod || 'text',
      })
      .select().single()

    if (saveErr) console.warn('PVOTD: could not save submission:', saveErr)
    if (saved) setSubmission(saved)
  }

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
      Loading today's phrasal verb...
    </div>
  )

  if (noItem) return null

  const alreadySubmitted = !!submission
  const feedbackToShow   = alreadySubmitted ? { valid: submission.is_correct, message: submission.ai_feedback } : null
  const levelColour      = levelColourMap[bucket] || '#718096'
  const levelLabel       = bucket
  const sepLabel         = item.separable ? 'separable' : 'inseparable'
  const sepColour        = item.separable ? '#dd6b20' : '#3182ce'

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
            📚 Phrasal Verb of the Day
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>{item.phrasal_verb}</span>
          </div>
          {alreadySubmitted && (
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.8)', marginTop: '3px' }}>
              {submission.is_correct ? '✅ Submitted today' : '↩ Try again'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{ background: levelColour, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700 }}>{levelLabel}</span>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>tap to expand ↓</span>
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
          <span style={{ fontSize: '1.2rem' }}>📚</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>
            Phrasal Verb of the Day
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ background: levelColour, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{levelLabel}</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
          {collapsible && <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>↑</span>}
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <div style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.6rem)', fontWeight: '800', color: '#2C3E50' }}>
            {item.phrasal_verb}
          </span>
          <span style={{ background: `${sepColour}15`, color: sepColour, border: `1px solid ${sepColour}40`, padding: '2px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            {sepLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Meaning
            </span>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.92rem', color: '#2d3748', lineHeight: '1.5' }}>{item.meaning}</p>
          </div>

          <div style={{ background: '#f7fafc', borderLeft: `3px solid ${levelColour}`, borderRadius: '0 8px 8px 0', padding: '0.55rem 0.85rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Example
            </span>
            <p style={{ margin: '0.1rem 0 0', fontSize: '0.9rem', color: '#2d3748', fontStyle: 'italic', lineHeight: '1.5' }}>"{item.example}"</p>
          </div>

          {item.note && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.55rem 0.85rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                💡 Tip
              </span>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#78350f', lineHeight: '1.5' }}>{item.note}</p>
            </div>
          )}
        </div>

        {alreadySubmitted && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>
              Your sentence
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
              Come back tomorrow for a new phrasal verb 👋
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
              ⭐ Use it in a sentence →
            </button>
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.6rem 0 0', textAlign: 'center' }}>
              Write or speak a sentence using "{item.phrasal_verb}"
            </p>
          </div>
        )}
      </div>
    </div>
    {showChallenge && item && (
      <SentenceChallenge
        word={item.phrasal_verb}
        language="en"
        exercise="pvotd"
        apiContext="pvotd"
        apiExtraFields={{
          phrasalVerb: item.phrasal_verb,
          meaning:     item.meaning,
          example:     item.example,
          separable:   item.separable,
        }}
        dedupeKey={`pvotd:${item.id}:${new Date().toISOString().slice(0, 10)}`}
        noStars={teacherMode}
        headerLabel="📚 Phrasal Verb of the Day"
        promptText="Use it in a sentence:"
        onMarkResult={onMarked}
        onClose={() => setShowChallenge(false)}
      />
    )}
    </>
  )
}
