import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Map profile level to word_of_the_day level bucket
const levelBucket = (profileLevel) => {
  if (!profileLevel) return 'B1/B2'
  if (['A1', 'A2'].includes(profileLevel)) return 'A1/A2'
  if (['B1', 'B2'].includes(profileLevel)) return 'B1/B2'
  return 'C1/C2'
}

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

export default function WordOfTheDay({ profile }) {
  const [word, setWord]               = useState(null)
  const [submission, setSubmission]   = useState(null) // existing submission if any
  const [sentence, setSentence]       = useState('')
  const [feedback, setFeedback]       = useState(null)
  const [isMarking, setIsMarking]     = useState(false)
  const [loading, setLoading]         = useState(true)
  const [noWord, setNoWord]           = useState(false)

  const language = Array.isArray(profile?.tracks) && profile.tracks.includes('spanish') ? 'es' : 'en'
  const bucket   = levelBucket(profile?.level)
  const today    = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchWord() }, [profile])

  const fetchWord = async () => {
    setLoading(true)

    // 1. Try today's word for this level + language
    let { data: wordData } = await supabase
      .from('word_of_the_day')
      .select('*')
      .eq('date', today)
      .eq('level', bucket)
      .eq('language', language)
      .single()

    // 2. Fallback — same level, any language (catches null or non-en language rows)
    if (!wordData) {
      const { data: fallbackData } = await supabase
        .from('word_of_the_day')
        .select('*')
        .eq('date', today)
        .eq('level', bucket)
        .limit(1)
        .single()
      wordData = fallbackData
    }

    // 3. Fallback — today's date, any level, any language
    if (!wordData) {
      const { data: anyLevel } = await supabase
        .from('word_of_the_day')
        .select('*')
        .eq('date', today)
        .limit(1)
        .single()
      wordData = anyLevel
    }

    // 4. Last resort — random word from question bank vocabulary
    if (!wordData) {
      const { data: qbWord } = await supabase
        .from('question_bank')
        .select('question_number, question, correct_answers, explanation, level')
        .in('level', bucket === 'A1/A2' ? ['A1','A2'] : bucket === 'B1/B2' ? ['B1','B2'] : ['C1','C2'])
        .eq('type', 'multiple_choice')
        .limit(50)

      if (qbWord && qbWord.length > 0) {
        const picked = qbWord[Math.floor(Math.random() * qbWord.length)]
        const answers = Array.isArray(picked.correct_answers)
          ? picked.correct_answers
          : JSON.parse(picked.correct_answers || '[]')
        wordData = {
          id: `qb_${picked.question_number}`,
          date: today,
          level: bucket,
          language: 'en',
          word: answers[0] || '—',
          part_of_speech: 'vocabulary',
          definition: picked.explanation || picked.question,
          example_sentence: picked.question,
          from_question_bank: true
        }
      } else {
        setNoWord(true)
        setLoading(false)
        return
      }
    }

    setWord(wordData)

    // Check if student already submitted today
    if (wordData.id && !wordData.id?.toString().startsWith('qb_')) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: existing } = await supabase
          .from('word_of_the_day_submissions')
          .select('*')
          .eq('student_id', user.id)
          .eq('word_id', wordData.id)
          .single()

        if (existing) setSubmission(existing)
      }
    }

    setLoading(false)
  }

  const submitSentence = async () => {
    if (!sentence.trim() || isMarking || !word) return
    setIsMarking(true)

    try {
      const response = await fetch('/api/mark-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: word.word,
          partOfSpeech: word.part_of_speech,
          definition: word.definition,
          studentSentence: sentence.trim(),
          language: word.language
        })
      })

      const result = response.ok ? await response.json() : { valid: null, feedback: '' }
      const isCorrect = result.valid === true

      setFeedback({
        valid: result.valid,
        message: result.feedback || (isCorrect ? 'Great sentence!' : 'Try again — read the definition carefully.')
      })

      // Save to Supabase (only for real word_of_the_day entries, not qb fallbacks)
      if (word.id && !word.id?.toString().startsWith('qb_')) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: saved } = await supabase
            .from('word_of_the_day_submissions')
            .insert({
              student_id:  user.id,
              word_id:     word.id,
              sentence:    sentence.trim(),
              is_correct:  isCorrect,
              is_soft_pass: false,
              ai_feedback: result.feedback
            })
            .select()
            .single()

          if (saved) setSubmission(saved)
        }
      }

    } catch (e) {
      console.error('submitSentence error:', e)
      setFeedback({ valid: null, message: 'Could not check your sentence right now — try again in a moment.' })
    }

    setIsMarking(false)
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem', textAlign: 'center', color: '#718096', fontSize: '0.9rem' }}>
      Loading today's word...
    </div>
  )

  if (noWord) return null // silently hide if nothing available

  const alreadySubmitted = !!submission
  const feedbackToShow   = alreadySubmitted
    ? { valid: submission.is_correct, message: submission.ai_feedback }
    : feedback

  const levelColour = bucket === 'A1/A2' ? '#48bb78' : bucket === 'B1/B2' ? '#4299e1' : '#ed8936'

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: '1rem',
      overflow: 'hidden'
    }}>
      {/* Header bar */}
      <div style={{
        background: GRADIENT,
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📖</span>
          <span style={{ color: 'white', fontWeight: '700', fontSize: '0.95rem' }}>Word of the Day</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ background: levelColour, color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{bucket}</span>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600' }}>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* Word content */}
      <div style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: '800', color: '#2C3E50' }}>{word.word}</span>
          <span style={{ fontSize: '0.8rem', color: '#a0aec0', fontStyle: 'italic', fontWeight: '500' }}>{word.part_of_speech}</span>
        </div>

        <p style={{ fontSize: '0.92rem', color: '#4a5568', margin: '0 0 0.75rem', lineHeight: '1.5' }}>
          {word.definition}
        </p>

        {/* Example sentence */}
        <div style={{
          background: '#f7fafc',
          borderLeft: `3px solid ${levelColour}`,
          borderRadius: '0 8px 8px 0',
          padding: '0.6rem 0.9rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Example</span>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.88rem', color: '#4a5568', fontStyle: 'italic', lineHeight: '1.5' }}>"{word.example_sentence}"</p>
        </div>

        {/* Already submitted — show their sentence + feedback */}
        {alreadySubmitted && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>Your sentence</div>
            <div style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.92rem',
              color: '#2d3748',
              marginBottom: '0.75rem',
              fontStyle: 'italic'
            }}>"{submission.sentence}"</div>
            {feedbackToShow && (
              <div style={{
                background: feedbackToShow.valid ? '#f0fff4' : '#fff5f5',
                border: `1px solid ${feedbackToShow.valid ? '#c6f6d5' : '#fed7d7'}`,
                color: feedbackToShow.valid ? '#276749' : '#9b2c2c',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.88rem',
                lineHeight: '1.5'
              }}>
                {feedbackToShow.valid ? '✅ ' : '❌ '}{feedbackToShow.message}
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.75rem 0 0', textAlign: 'center' }}>
              Come back tomorrow for a new word 👋
            </p>
          </div>
        )}

        {/* Not yet submitted — show input */}
        {!alreadySubmitted && !feedback && (
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>
              Use it in a sentence
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={sentence}
                onChange={e => setSentence(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && submitSentence()}
                placeholder={`Write a sentence using "${word.word}"...`}
                disabled={isMarking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '0.92rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  outline: 'none',
                  color: '#2d3748',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#667eea'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              <button
                onClick={submitSentence}
                disabled={!sentence.trim() || isMarking}
                style={{
                  padding: '0 1.25rem',
                  background: sentence.trim() && !isMarking ? GRADIENT : '#cbd5e0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: sentence.trim() && !isMarking ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap'
                }}
              >
                {isMarking ? '🤖...' : 'Submit →'}
              </button>
            </div>
            {isMarking && (
              <p style={{ fontSize: '0.8rem', color: '#553C9A', margin: '0.5rem 0 0', textAlign: 'center' }}>🤖 Checking your sentence...</p>
            )}
          </div>
        )}

        {/* Feedback just received — not yet locked (qb fallback) */}
        {!alreadySubmitted && feedback && (
          <div>
            <div style={{
              background: feedback.valid ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${feedback.valid ? '#c6f6d5' : '#fed7d7'}`,
              color: feedback.valid ? '#276749' : '#9b2c2c',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              fontSize: '0.88rem',
              lineHeight: '1.5',
              marginBottom: '0.5rem'
            }}>
              {feedback.valid ? '✅ ' : '❌ '}{feedback.message}
            </div>
            {!feedback.valid && (
              <button
                onClick={() => { setFeedback(null); setSentence('') }}
                style={{ width: '100%', padding: '0.6rem', background: 'transparent', border: '2px solid #667eea', color: '#667eea', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}
              >
                Try again ↩
              </button>
            )}
            {feedback.valid && (
              <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '0.5rem 0 0', textAlign: 'center' }}>Come back tomorrow for a new word 👋</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
