import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

function getLevelLabel(level) {
  if (!level) return '?'
  if (level === 'Spanish') return 'ES'
  return level
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function WordOfTheDay({ profile, collapsible = false }) {
  const [word, setWord]             = useState(null)
  const [submission, setSubmission] = useState(null)
  const [sentence, setSentence]     = useState('')
  const [feedback, setFeedback]     = useState(null)
  const [isMarking, setIsMarking]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [noWord, setNoWord]         = useState(false)
  const [community, setCommunity]   = useState([])
  const [expanded, setExpanded]     = useState(!collapsible)

  const isSpanish = (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish')) || profile?.level === 'Spanish'
  const bucket    = levelBucket(profile?.level)
  const today     = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchWord() }, [profile])

  const fetchWord = async () => {
    setLoading(true)
    let wordData = null

    if (isSpanish) {
      const { data } = await supabase
        .from('word_of_the_day').select('*').eq('date', today).eq('language', 'es').limit(1).single()
      wordData = data
    } else {
      const { data: d1 } = await supabase
        .from('word_of_the_day').select('*').eq('date', today).eq('level', bucket).eq('language', 'en').single()
      wordData = d1
      if (!wordData) {
        const { data: d2 } = await supabase
          .from('word_of_the_day').select('*').eq('date', today).eq('language', 'en').limit(1).single()
        wordData = d2
      }
      if (!wordData) {
        const { data: d3 } = await supabase
          .from('word_of_the_day').select('*').eq('date', today).limit(1).single()
        wordData = d3
      }
    }

    if (!wordData) {
      const { data: qbWord } = await supabase
        .from('question_bank').select('question_number, question, correct_answer, explanation, level')
        .in('level', bucket === 'A1/A2' ? ['A1', 'A2'] : bucket === 'B1/B2' ? ['B1', 'B2'] : ['C1', 'C2'])
        .eq('type', 'multiple_choice').eq('language', 'en').limit(50)
      if (qbWord && qbWord.length > 0) {
        const picked = qbWord[Math.floor(Math.random() * qbWord.length)]
        wordData = {
          id: `qb_${picked.question_number}`, date: today, level: bucket, language: 'en',
          word: picked.correct_answer || '—', part_of_speech: 'vocabulary',
          definition: picked.explanation || picked.question,
          example_sentence: picked.question, from_question_bank: true
        }
      } else { setNoWord(true); setLoading(false); return }
    }

    setWord(wordData)

    if (wordData.id && !wordData.id?.toString().startsWith('qb_')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('word_of_the_day_submissions').select('*')
          .eq('student_id', user.id).eq('word_id', wordData.id).single()
        if (existing) { setSubmission(existing); fetchCommunity(wordData.id) }
      }
    }
    setLoading(false)
  }

  const fetchCommunity = async (wordId) => {
    if (!wordId || wordId?.toString().startsWith('qb_')) return
    const { data } = await supabase
      .from('wotd_community_sentences').select('sentence, level').eq('word_date', today)
    if (data && data.length >= 1) setCommunity(shuffleArray(data).slice(0, 8))
  }

  const submitSentence = async () => {
    if (!sentence.trim() || isMarking || !word) return
    setIsMarking(true)
    try {
      const response = await fetch('/api/mark-free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sentence', word: word.word, partOfSpeech: word.part_of_speech,
          definition: word.definition, studentSentence: sentence.trim(), language: word.language
        })
      })
      const result = response.ok ? await response.json() : { valid: null, feedback: '' }
      const isCorrect = result.valid === true
      setFeedback({ valid: result.valid, message: result.feedback || (isCorrect ? 'Great sentence!' : 'Try again — read the definition carefully.') })
      if (word.id && !word.id?.toString().startsWith('qb_')) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: saved } = await supabase
            .from('word_of_the_day_submissions')
            .insert({ student_id: user.id, word_id: word.id, sentence: sentence.trim(), is_correct: isCorrect, is_soft_pass: false, ai_feedback: result.feedback })
            .select().single()
          if (saved) { setSubmission(saved); fetchCommunity(word.id) }
        }
      }
    } catch (e) {
      console.error('submitSentence error:', e)
      setFeedback({ valid: null, message: 'Could not check your sentence right now — try again in a moment.' })
    }
    setIsMarking(false)
  }

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
      Loading today's word...
    </div>
  )

  if (noWord) return null

  const alreadySubmitted = !!submission
  const feedbackToShow   = alreadySubmitted ? { valid: submission.is_correct, message: submission.ai_feedback } : feedback
  const levelColour      = isSpanish ? '#e53e3e' : getLevelColour(bucket)
  const levelLabel       = isSpanish ? 'ES' : bucket
  const showCommunity    = community.length > 0 && (alreadySubmitted || feedback != null)

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
            📖 Word of the Day
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>{word.word}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>{word.part_of_speech}</span>
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
    <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', overflow: 'hidden' }}>
      <div
        style={{ background: GRADIENT, padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', cursor: collapsible ? 'pointer' : 'default' }}
        onClick={collapsible ? () => setExpanded(false) : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📖</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>Word of the Day</span>
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: '800', color: '#2C3E50' }}>{word.word}</span>
          <span style={{ fontSize: '0.8rem', color: '#a0aec0', fontStyle: 'italic', fontWeight: '500' }}>{word.part_of_speech}</span>
        </div>
        <p style={{ fontSize: '0.92rem', color: '#4a5568', margin: '0 0 0.75rem', lineHeight: '1.5' }}>{word.definition}</p>
        <div style={{ background: '#f7fafc', borderLeft: `3px solid ${levelColour}`, borderRadius: '0 8px 8px 0', padding: '0.6rem 0.9rem', marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Example</span>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.88rem', color: '#4a5568', fontStyle: 'italic', lineHeight: '1.5' }}>"{word.example_sentence}"</p>
        </div>

        {alreadySubmitted && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>Your sentence</div>
            <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.92rem', color: '#2d3748', marginBottom: '0.75rem', fontStyle: 'italic' }}>
              "{submission.sentence}"
            </div>
            {feedbackToShow && (
              <div style={{ background: feedbackToShow.valid ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedbackToShow.valid ? '#c6f6d5' : '#fed7d7'}`, color: feedbackToShow.valid ? '#276749' : '#9b2c2c', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5' }}>
                {feedbackToShow.valid ? '✅ ' : '❌ '}{feedbackToShow.message}
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.75rem 0 0', textAlign: 'center' }}>Come back tomorrow for a new word 👋</p>
          </div>
        )}

        {!alreadySubmitted && !feedback && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>Use it in a sentence</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={sentence} onChange={e => setSentence(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && submitSentence()}
                placeholder={`Write a sentence using "${word.word}"...`} disabled={isMarking}
                style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.92rem', borderRadius: '8px', border: '2px solid #e2e8f0', outline: 'none', color: '#2d3748', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#667eea'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button onClick={submitSentence} disabled={!sentence.trim() || isMarking}
                style={{ padding: '0 1.25rem', background: sentence.trim() && !isMarking ? GRADIENT : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', cursor: sentence.trim() && !isMarking ? 'pointer' : 'not-allowed', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                {isMarking ? '🤖...' : 'Submit →'}
              </button>
            </div>
            {isMarking && <p style={{ fontSize: '0.8rem', color: '#553C9A', margin: '0.5rem 0 0', textAlign: 'center' }}>🤖 Checking your sentence...</p>}
          </div>
        )}

        {!alreadySubmitted && feedback && (
          <div>
            <div style={{ background: feedback.valid ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.valid ? '#c6f6d5' : '#fed7d7'}`, color: feedback.valid ? '#276749' : '#9b2c2c', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '0.5rem' }}>
              {feedback.valid ? '✅ ' : '❌ '}{feedback.message}
            </div>
            {!feedback.valid && (
              <button onClick={() => { setFeedback(null); setSentence('') }}
                style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: '2px solid #667eea', color: '#667eea', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}>
                Try again ↩
              </button>
            )}
            {feedback.valid && <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.5rem 0 0', textAlign: 'center' }}>Come back tomorrow for a new word 👋</p>}
          </div>
        )}
      </div>

      {showCommunity && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '1rem 1.25rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '1rem' }}>💬</span>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px' }}>What people have written today</span>
            <span style={{ fontSize: '0.75rem', color: '#a0aec0', marginLeft: 'auto' }}>{community.length} sentence{community.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {community.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                <span style={{ flexShrink: 0, background: getLevelColour(item.level), color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: '700', marginTop: '2px', lineHeight: '1.6' }}>{getLevelLabel(item.level)}</span>
                <span style={{ fontSize: '0.88rem', color: '#4a5568', lineHeight: '1.5', fontStyle: 'italic' }}>"{item.sentence}"</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
