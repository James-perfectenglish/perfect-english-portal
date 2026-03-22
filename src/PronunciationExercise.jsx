import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const LEVEL_CONFIG = [
  { id: 'beginner',     title: 'Beginner',     subtitle: 'A1 / A2', levels: ['A1', 'A2'], emoji: '🌱', gradient: 'linear-gradient(135deg, #43b581, #2ecc71)', shadow: 'rgba(46, 204, 113, 0.3)' },
  { id: 'intermediate', title: 'Intermediate', subtitle: 'B1 / B2', levels: ['B1', 'B2'], emoji: '📚', gradient: 'linear-gradient(135deg, #3498DB, #667eea)', shadow: 'rgba(52, 152, 219, 0.3)' },
  { id: 'advanced',     title: 'Advanced',     subtitle: 'C1 / C2', levels: ['C1', 'C2'], emoji: '🎯', gradient: 'linear-gradient(135deg, #ed8936, #f6ad55)', shadow: 'rgba(237, 137, 54, 0.3)' },
]

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

function getLevelConfigForProfile(profileLevel) {
  if (!profileLevel) return LEVEL_CONFIG[1]
  const l = profileLevel.toUpperCase()
  if (l.startsWith('A')) return LEVEL_CONFIG[0]
  if (l.startsWith('C')) return LEVEL_CONFIG[2]
  return LEVEL_CONFIG[1]
}

export default function PronunciationExercise({ profile, onBack }) {
  const [screen, setScreen]               = useState('level_select')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [exercise, setExercise]           = useState(null)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [isRecording, setIsRecording]     = useState(false)
  const [transcript, setTranscript]       = useState('')
  const [feedback, setFeedback]           = useState(null)
  const [isMarking, setIsMarking]         = useState(false)
  const [loadingExercise, setLoadingExercise] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [hasListened, setHasListened]     = useState(false)

  const audioRef       = useRef(null)
  const recognitionRef = useRef(null)

  const profileLevelConfig = getLevelConfigForProfile(profile?.level)
  const isSpanish = profile?.level === 'Spanish' || (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish'))

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) setSpeechSupported(false)
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (audioRef.current) audioRef.current.pause()
    }
  }, [])

  async function fetchExercise(levels) {
    setLoadingExercise(true)
    setHasListened(false)
    const { data } = await supabase
      .from('dictation_exercises')
      .select('id, title, answer, sentence_template, audio_url, level')
      .in('level', levels)
      .not('audio_url', 'is', null)

    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)]
      setExercise(random)
    }
    setLoadingExercise(false)
  }

  function selectLevel(level) {
    setSelectedLevel(level)
    fetchExercise(level.levels)
    setScreen('exercise')
    setTranscript('')
    setFeedback(null)
  }

  function playAudio() {
    if (!exercise?.audio_url || isPlaying) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    const audio = new Audio(exercise.audio_url)
    audioRef.current = audio
    audio.onplay  = () => setIsPlaying(true)
    audio.onended = () => { setIsPlaying(false); setHasListened(true) }
    audio.onerror = () => setIsPlaying(false)
    audio.play()
  }

  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = isSpanish ? 'es-ES' : 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition

    let resultReceived = false

    recognition.onresult = (e) => {
      resultReceived = true
      const text = e.results[0][0].transcript
      setTranscript(text)
      setIsRecording(false)
      markPronunciation(text)
    }

    recognition.onerror = (e) => {
      console.warn('Speech recognition error:', e.error)
      setIsRecording(false)
    }

    // onend fires on iOS when stop() is called — if no result came through
    // it means the recognition ended without catching speech (too short, silence, etc.)
    recognition.onend = () => {
      setIsRecording(false)
      if (!resultReceived) {
        // Nothing was captured — show a helpful nudge rather than silently failing
        setFeedback({ valid: null, feedback: "We didn't catch that. Make sure you're speaking clearly and try again." })
        setScreen('feedback')
      }
    }

    setIsRecording(true)
    recognition.start()
  }

  function stopRecording() {
    if (recognitionRef.current) recognitionRef.current.stop()
  }

  async function markPronunciation(spokenText) {
    if (!exercise || !spokenText) return
    setIsMarking(true)
    const target = exercise.answer

    try {
      const response = await fetch('/api/mark-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, spoken: spokenText, language: isSpanish ? 'es' : 'en' }),
      })
      const result = response.ok ? await response.json() : null
      setFeedback(result || { valid: null, feedback: 'Could not analyse your recording — try again.' })
    } catch {
      setFeedback({ valid: null, feedback: 'Could not analyse your recording — try again.' })
    }

    setIsMarking(false)
    setScreen('feedback')
  }

  function tryAgain() {
    setTranscript('')
    setFeedback(null)
    setHasListened(false)
    setScreen('exercise')
  }

  function nextSentence() {
    fetchExercise(selectedLevel.levels)
    setTranscript('')
    setFeedback(null)
    setScreen('exercise')
  }

  // ── Level select ──────────────────────────────────────────────────────────
  if (screen === 'level_select') {
    return (
      <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.5rem)', color: '#2C3E50', margin: '0 0 0.5rem', fontWeight: '700' }}>
            🎤 Speak
          </h1>
          <p style={{ fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', color: '#666', marginBottom: '2rem', lineHeight: '1.5' }}>
            Listen to a phrase, then record yourself saying it. Get personalised feedback on your pronunciation.
          </p>

          {!speechSupported && (
            <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', color: '#c53030', fontSize: '0.9rem', lineHeight: '1.5' }}>
              🚫 Pronunciation drills need Chrome or Safari. Please switch browser to use this feature.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {LEVEL_CONFIG.map(level => {
              const isYourLevel = !isSpanish && level.id === profileLevelConfig.id
              return (
                <button
                  key={level.id}
                  onClick={() => speechSupported && selectLevel(level)}
                  disabled={!speechSupported}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 'clamp(0.75rem, 3vw, 1.25rem)',
                    padding: 'clamp(1rem, 3vw, 1.5rem)',
                    backgroundColor: 'white',
                    border: isYourLevel ? '2px solid #667eea' : '1px solid #e2e8f0',
                    borderRadius: '16px', cursor: speechSupported ? 'pointer' : 'not-allowed',
                    textAlign: 'left', transition: 'all 0.2s',
                    boxShadow: isYourLevel ? '0 4px 16px rgba(102,126,234,0.25)' : `0 4px 12px ${level.shadow}`,
                    width: '100%', boxSizing: 'border-box', position: 'relative',
                    opacity: speechSupported ? 1 : 0.5,
                  }}
                >
                  {isYourLevel && (
                    <div style={{ position: 'absolute', top: '-1px', right: '14px', background: GRADIENT, color: 'white', fontSize: '0.7rem', fontWeight: '700', padding: '3px 10px', borderRadius: '0 0 8px 8px' }}>
                      Your level
                    </div>
                  )}
                  <div style={{ background: level.gradient, borderRadius: '12px', width: 'clamp(55px, 15vw, 70px)', height: 'clamp(55px, 15vw, 70px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(1.5rem, 5vw, 2rem)', flexShrink: 0 }}>
                    {level.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: 'clamp(1.15rem, 4vw, 1.35rem)', fontWeight: '700', color: '#2C3E50' }}>{level.title}</span>
                      <span style={{ fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)', color: '#888', fontWeight: '500' }}>{level.subtitle}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.5rem', color: '#ccc', flexShrink: 0 }}>→</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Exercise + Feedback screens ───────────────────────────────────────────
  const target = exercise?.answer || ''

  return (
    <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header card */}
        <div style={{ background: GRADIENT, borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1rem', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
            🎤 {selectedLevel?.title} — Say this phrase
          </div>
          <div style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', fontWeight: '700', lineHeight: 1.4 }}>
            {loadingExercise ? '...' : target}
          </div>
        </div>

        {/* Exercise screen */}
        {screen === 'exercise' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>

            {/* Step 1 — Listen */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Step 1 — Listen
              </div>
              <button
                onClick={playAudio}
                disabled={isPlaying || loadingExercise}
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: isPlaying ? '#e2e8f0' : GRADIENT,
                  border: 'none', cursor: isPlaying ? 'default' : 'pointer',
                  fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', boxShadow: isPlaying ? 'none' : '0 4px 15px rgba(102,126,234,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {isPlaying ? '🔊' : '▶️'}
              </button>
              <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.6rem' }}>
                {isPlaying ? 'Playing...' : hasListened ? 'Tap to listen again' : 'Tap to hear the phrase'}
              </div>
              {hasListened && (
                <div style={{ fontSize: '0.75rem', color: '#48bb78', marginTop: '0.3rem', fontWeight: '600' }}>✓ Ready to record</div>
              )}
            </div>

            {/* Step 2 — Record */}
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                Step 2 — Say it
              </div>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isPlaying || loadingExercise || isMarking}
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: isRecording
                    ? 'linear-gradient(135deg, #e53e3e, #c53030)'
                    : 'linear-gradient(135deg, #48bb78, #38a169)',
                  border: 'none', cursor: (isPlaying || loadingExercise || isMarking) ? 'not-allowed' : 'pointer',
                  fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', transition: 'all 0.2s',
                  boxShadow: isRecording
                    ? '0 0 0 10px rgba(229,62,62,0.15)'
                    : '0 4px 15px rgba(72,187,120,0.4)',
                  opacity: (isPlaying || loadingExercise || isMarking) ? 0.6 : 1,
                }}
              >
                {isMarking ? '🤖' : isRecording ? '⏹️' : '🎤'}
              </button>
              <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.6rem' }}>
                {isMarking ? 'Analysing your pronunciation...' : isRecording ? 'Listening — tap to stop' : 'Tap to record yourself'}
              </div>
            </div>

            <button
              onClick={nextSentence}
              disabled={loadingExercise}
              style={{ marginTop: '2rem', background: 'none', border: 'none', color: '#cbd5e0', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Skip → try a different phrase
            </button>
          </div>
        )}

        {/* Feedback screen */}
        {screen === 'feedback' && feedback && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

            {transcript && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                  You said
                </div>
                <div style={{ background: '#f7fafc', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.95rem', color: '#2d3748', fontStyle: 'italic', border: '1px solid #e2e8f0' }}>
                  "{transcript}"
                </div>
              </div>
            )}

            <div style={{
              background: feedback.valid === true ? '#f0fff4' : feedback.valid === false ? '#fff5f5' : '#f7fafc',
              border: `1px solid ${feedback.valid === true ? '#c6f6d5' : feedback.valid === false ? '#fed7d7' : '#e2e8f0'}`,
              borderRadius: '12px', padding: '1rem 1.25rem',
              fontSize: '0.9rem', lineHeight: '1.65',
              color: feedback.valid === true ? '#276749' : feedback.valid === false ? '#9b2c2c' : '#4a5568',
              marginBottom: '1.5rem',
            }}>
              {feedback.valid === true && '✅ '}
              {feedback.valid === false && '💬 '}
              {feedback.feedback || 'No feedback available.'}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={tryAgain}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: 'none', border: '2px solid #667eea', color: '#667eea', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Try again ↩
              </button>
              <button
                onClick={nextSentence}
                style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: GRADIENT, border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Next phrase →
              </button>
            </div>
          </div>
        )}

        {/* Back to level select */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            onClick={() => { setScreen('level_select'); setExercise(null); setTranscript(''); setFeedback(null) }}
            style={{ background: 'none', border: 'none', color: '#a0aec0', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            ← Change level
          </button>
        </div>
      </div>
    </div>
  )
}
