import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import SentenceChallenge from './components/SentenceChallenge'

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

export default function PronunciationExercise({ profile }) {
  // Compute isSpanish before state so we can use it as initial values
  const isSpanish = profile?.level === 'Spanish' || (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish'))
  const profileLevelConfig = getLevelConfigForProfile(profile?.level)

  const SPANISH_LEVEL = { id: 'spanish', title: 'Spanish', subtitle: 'Español', levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], emoji: '🇪🇸', gradient: 'linear-gradient(135deg, #e53e3e, #c53030)' }

  const [showChallenge, setShowChallenge] = useState(false)
  const [challengeWord, setChallengeWord] = useState('')
  const challengeFiredRef = useRef(false)

  const [screen, setScreen]               = useState(isSpanish ? 'exercise' : 'level_select')
  const [selectedLevel, setSelectedLevel] = useState(isSpanish ? SPANISH_LEVEL : null)
  const [exercise, setExercise]           = useState(null)
  const [isPlaying, setIsPlaying]         = useState(false)
  const [isRecording, setIsRecording]     = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isMarking, setIsMarking]         = useState(false)
  const [transcript, setTranscript]       = useState('')
  const [feedback, setFeedback]           = useState(null)
  const [loadingExercise, setLoadingExercise] = useState(false)
  const [hasListened, setHasListened]     = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const audioRef       = useRef(null)
  const mediaRecRef    = useRef(null)
  const chunksRef      = useRef([])
  const timerRef       = useRef(null)
  const streamRef      = useRef(null)

  useEffect(() => {
    // Spanish track: fetch exercise immediately on mount
    if (isSpanish) {
      fetchExercise(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], 'es')
    }
    return () => {
      if (audioRef.current) audioRef.current.pause()
      stopRecordingCleanup()
    }
  }, [])

  function stopRecordingCleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  async function fetchExercise(levels, lang) {
    setLoadingExercise(true)
    setHasListened(false)
    setTranscript('')
    setFeedback(null)
    setShowChallenge(false)
    challengeFiredRef.current = false

    const language = lang || (isSpanish ? 'es' : 'en')

    let q = supabase
      .from('dictation_exercises')
      .select('id, title, answer, sentence_template, audio_url, level')
      .in('level', levels)
      .eq('language', language)
      .not('audio_url', 'is', null)
      .not('sentence_template', 'is', null)

    const { data } = await q

    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)]
      const fullSentence = random.sentence_template.replace(/_{3,}/g, random.answer)
      setExercise({ ...random, displayText: fullSentence })
    } else {
      // Fallback: without sentence_template filter
      const { data: all } = await supabase
        .from('dictation_exercises')
        .select('id, title, answer, sentence_template, audio_url, level')
        .in('level', levels)
        .eq('language', language)
        .not('audio_url', 'is', null)
      if (all && all.length > 0) {
        const random = all[Math.floor(Math.random() * all.length)]
        setExercise({ ...random, displayText: random.answer })
      }
    }
    setLoadingExercise(false)
  }

  function selectLevel(level) {
    setSelectedLevel(level)
    fetchExercise(level.levels, 'en')
    setScreen('exercise')
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

  async function startRecording() {
    if (isRecording || isTranscribing || isMarking || isPlaying) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // Prefer webm, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecRef.current = rec

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }

      rec.onstop = async () => {
        stopRecordingCleanup()
        setIsRecording(false)
        setRecordingSeconds(0)

        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        if (blob.size < 1000) {
          setFeedback({ valid: null, feedback: "We didn't catch anything — make sure your microphone is working and try again." })
          setScreen('feedback')
          return
        }

        setIsTranscribing(true)
        await transcribeAndMark(blob)
        setIsTranscribing(false)
      }

      rec.start(100) // collect data every 100ms
      setIsRecording(true)
      setRecordingSeconds(0)

      // Timer for visual feedback
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          // Auto-stop after 15 seconds
          if (s >= 14) {
            stopRecording()
            return 0
          }
          return s + 1
        })
      }, 1000)

    } catch (e) {
      console.error('Microphone error:', e)
      setFeedback({ valid: null, feedback: 'Could not access your microphone. Please check your browser permissions and try again.' })
      setScreen('feedback')
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') {
      mediaRecRef.current.stop()
    }
  }

  async function transcribeAndMark(blob) {
    const target = exercise?.displayText || exercise?.answer || ''
    const language = isSpanish ? 'es' : 'en'

    try {
      // Send to Whisper
      const mimeType = blob.type || 'audio/webm'
      console.log('Sending audio blob, type:', mimeType, 'size:', blob.size)
      const transcribeRes = await fetch(`/api/transcribe?language=${language}`, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: blob,
      })

      const transcribeData = transcribeRes.ok ? await transcribeRes.json() : null
      const spokenText = transcribeData?.transcript?.trim() || ''

      if (!spokenText) {
        setFeedback({ valid: null, feedback: "We couldn't make out what you said. Try speaking a little more clearly and closer to your microphone." })
        setScreen('feedback')
        return
      }

      setTranscript(spokenText)
      setIsMarking(true)

      // Send to Claude for marking
      const markRes = await fetch('/api/mark-pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, spoken: spokenText, language }),
      })

      const result = markRes.ok ? await markRes.json() : null
      const finalResult = result || { valid: null, feedback: 'Could not analyse your recording — try again.' }
      setFeedback(finalResult)
      setIsMarking(false)
      setScreen('feedback')

      // Record session in DB
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && exercise?.id) {
          await supabase.from('pronunciation_sessions').insert({
            student_id: user.id,
            exercise_id: exercise.id,
            spoken: spokenText,
            is_correct: finalResult.valid === true,
            ai_feedback: finalResult.feedback,
            language,
          })
        }
      } catch (dbErr) {
        console.warn('Could not save pronunciation session:', dbErr)
      }

    } catch (e) {
      console.error('transcribeAndMark error:', e)
      setIsMarking(false)
      setFeedback({ valid: null, feedback: 'Something went wrong — please try again.' })
      setScreen('feedback')
    }
  }

  function tryAgain() {
    setTranscript('')
    setFeedback(null)
    setHasListened(false)
    setScreen('exercise')
  }

  function handleNextPhrase() {
    if (!challengeFiredRef.current && feedback?.valid === true && exercise?.answer) {
      challengeFiredRef.current = true
      setChallengeWord(exercise.answer)
      setShowChallenge(true)
      return
    }
    nextSentence()
  }

  function nextSentence() {
    fetchExercise(selectedLevel.levels)
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {LEVEL_CONFIG.map(level => {
              const isYourLevel = !isSpanish && level.id === profileLevelConfig.id
              return (
                <button
                  key={level.id}
                  onClick={() => selectLevel(level)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 'clamp(0.75rem, 3vw, 1.25rem)',
                    padding: 'clamp(1rem, 3vw, 1.5rem)',
                    backgroundColor: 'white',
                    border: isYourLevel ? '2px solid #667eea' : '1px solid #e2e8f0',
                    borderRadius: '16px', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 0.2s',
                    boxShadow: isYourLevel ? '0 4px 16px rgba(102,126,234,0.25)' : `0 4px 12px ${level.shadow}`,
                    width: '100%', boxSizing: 'border-box', position: 'relative',
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

  // ── Exercise + Feedback ───────────────────────────────────────────────────
  const displayText = exercise?.displayText || exercise?.answer || ''
  const isProcessing = isTranscribing || isMarking

  return (
    <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: GRADIENT, borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1rem', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
            🎤 {selectedLevel?.title} — Say this phrase
          </div>
          <div style={{ fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', fontWeight: '700', lineHeight: 1.5 }}>
            {loadingExercise ? '...' : displayText}
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
                disabled={isPlaying || loadingExercise || isRecording}
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: isPlaying ? '#e2e8f0' : GRADIENT,
                  border: 'none', cursor: (isPlaying || loadingExercise || isRecording) ? 'default' : 'pointer',
                  fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', boxShadow: isPlaying ? 'none' : '0 4px 15px rgba(102,126,234,0.4)',
                  transition: 'all 0.2s',
                }}
              >
                {isPlaying ? '🔊' : '▶️'}
              </button>
              <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.6rem' }}>
                {isPlaying ? 'Playing...' : hasListened ? 'Tap to listen again' : 'Tap to hear the phrase'}
              </div>
              {hasListened && !isRecording && (
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
                disabled={isPlaying || loadingExercise || isProcessing}
                style={{
                  width: '100px', height: '100px', borderRadius: '50%',
                  background: isRecording
                    ? 'linear-gradient(135deg, #e53e3e, #c53030)'
                    : isProcessing
                    ? '#e2e8f0'
                    : 'linear-gradient(135deg, #48bb78, #38a169)',
                  border: 'none',
                  cursor: (isPlaying || loadingExercise || isProcessing) ? 'default' : 'pointer',
                  fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto', transition: 'all 0.2s',
                  boxShadow: isRecording
                    ? '0 0 0 14px rgba(229,62,62,0.2)'
                    : isProcessing ? 'none'
                    : '0 4px 15px rgba(72,187,120,0.4)',
                  opacity: (isPlaying || loadingExercise || isProcessing) ? 0.6 : 1,
                }}
              >
                {isProcessing ? '⏳' : isRecording ? '⏹️' : '🎤'}
              </button>
              {isRecording && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ width: '120px', height: '4px', background: '#edf2f7', borderRadius: '99px', margin: '0 auto 0.5rem' }}>
                    <div style={{ width: `${(recordingSeconds / 15) * 100}%`, height: '100%', background: '#e53e3e', borderRadius: '99px', transition: 'width 1s linear' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#e53e3e', fontWeight: '600' }}>Recording... tap to stop ({15 - recordingSeconds}s)</div>
                </div>
              )}
              {!isRecording && !isProcessing && (
                <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.75rem' }}>
                  Tap to start recording, tap again to stop
                </div>
              )}
              {isTranscribing && <div style={{ fontSize: '0.8rem', color: '#667eea', marginTop: '0.75rem', fontWeight: '600' }}>🎙 Transcribing your recording...</div>}
              {isMarking && <div style={{ fontSize: '0.8rem', color: '#667eea', marginTop: '0.75rem', fontWeight: '600' }}>🤖 Analysing your pronunciation...</div>}
            </div>

            <button
              onClick={nextSentence}
              disabled={loadingExercise || isRecording || isProcessing}
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
                <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>You said</div>
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
              {feedback.feedback}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={tryAgain} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: 'none', border: '2px solid #667eea', color: '#667eea', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
                Try again ↩
              </button>
              <button onClick={handleNextPhrase} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: GRADIENT, border: 'none', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
                Next phrase →
              </button>
            </div>
          </div>
        )}

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
