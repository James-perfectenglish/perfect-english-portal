import { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';

// Recording logic mirrors PronunciationExercise.jsx — cross-browser/iOS compatible.
// Do not refactor the recording section without testing on both Chrome and Safari/iOS.

export default function SentenceChallenge({
  word,
  language = 'en',
  exercise = 'challenge',
  headerLabel,       // optional override for the small uppercase label at top
  promptText,        // optional override for the "Write a sentence using:" subtitle
  apiContext = 'challenge', // 'challenge' | 'wotd' | 'gotd' — routes the mark-free.js prompt
  apiExtraFields = {},      // spread into the mark-free.js request body (e.g. partOfSpeech, definition)
  dedupeKey,         // optional: when set, opts in to ux_stars_dedupe anti-farming.
  onMarkResult,      // optional async callback: ({ sentence, inputMethod, result }) => {}
  onClose
}) {
  const isSpanish = language === 'es';

  const [mode, setMode]                         = useState('type');
  const [textInput, setTextInput]               = useState('');
  const [phase, setPhase]                       = useState('input'); // 'input' | 'transcript' | 'result'
  const [isRecording, setIsRecording]           = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [isMarking, setIsMarking]               = useState(false);
  const [aiUnavailable, setAiUnavailable]       = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [submittedSentence, setSubmittedSentence] = useState('');
  const [result, setResult]                     = useState(null);

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);

  function stopRecordingCleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') mediaRecRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  async function startRecording() {
    if (isRecording || isTranscribing || isMarking) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stopRecordingCleanup();
        setIsRecording(false);
        setRecordingSeconds(0);
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size < 1000) return;
        setIsTranscribing(true);
        await transcribeAudio(blob, mimeType);
        setIsTranscribing(false);
      };
      rec.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => { if (s >= 14) { stopRecording(); return 0; } return s + 1; });
      }, 1000);
    } catch (e) { console.error('Microphone error:', e); }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecRef.current && mediaRecRef.current.state === 'recording') mediaRecRef.current.stop();
  }

  async function transcribeAudio(blob, mimeType) {
    try {
      const res = await fetch(`/api/transcribe?language=${language}`, {
        method: 'POST', headers: { 'Content-Type': mimeType || 'audio/webm' }, body: blob,
      });
      const data = res.ok ? await res.json() : null;
      const spokenText = data?.transcript?.trim() || '';
      if (spokenText) { setEditedTranscript(spokenText); setPhase('transcript'); }
      else { setPhase('input'); }
    } catch (e) { console.error('Transcribe error:', e); setPhase('input'); }
  }

  async function markSentence(sentence, inputMethod = 'text') {
    setSubmittedSentence(sentence);
    setIsMarking(true);
    setAiUnavailable(false);
    try {
      const res = await fetch('/api/mark-free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sentence', context: apiContext, word, sentence, language, ...apiExtraFields }),
      });
      // 529 (overload) or other non-2xx → stay in input phase so the student can retry without burning today's attempt.
      // Nothing is persisted (no submission row, no star), so WOTD/GOTD don't see a fake "failed" answer.
      if (!res.ok) {
        setAiUnavailable(true);
        setIsMarking(false);
        return;
      }
      const data = await res.json();
      // valid:null with no feedback also means the AI didn't return a usable result — treat as overloaded.
      if (!data || (data.valid !== true && data.valid !== false)) {
        setAiUnavailable(true);
        setIsMarking(false);
        return;
      }
      const result = data;
      setResult(result);
      setPhase('result');
      // Star log — only write on pass. source = exercise (wotd/gotd/wordle/spelling_bee/etc).
      if (result.valid === true) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const context = {
              word,
              sentence,
              language,
              input_method: inputMethod,
              ai_feedback:  result.feedback || result.reason || '',
            };
            // Opt-in anti-farming: callers that pass dedupeKey get ux_stars_dedupe protection.
            if (dedupeKey) context.dedupe_key = dedupeKey;
            const { error } = await supabase.from('stars').insert({
              student_id: user.id,
              source:     exercise,
              subtype:    'sentence',
              context,
            });
            if (error && error.code !== '23505') {
              console.warn('SentenceChallenge: could not save star:', error);
            }
          }
        } catch (dbErr) {
          console.warn('SentenceChallenge: could not save star:', dbErr);
        }
      }
      // Fire parent callback so WOTD/GOTD can do their own submissions-table write
      if (typeof onMarkResult === 'function') {
        try {
          await onMarkResult({ sentence, inputMethod, result });
        } catch (cbErr) {
          console.warn('SentenceChallenge: onMarkResult callback error:', cbErr);
        }
      }
    } catch (e) {
      // Network blip, JSON parse failure, etc. — same UX as overload: stay in input phase, let them retry.
      setAiUnavailable(true);
    }
    setIsMarking(false);
  }

  const earnedStar = result?.valid === true;
  const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

  return (
    <>
      {/* Backdrop */}
      <div onClick={() => { stopRecordingCleanup(); onClose(false); }}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'white',
        borderRadius: '20px 20px 0 0', padding: '1.5rem', zIndex: 1001,
        boxShadow: '0 -4px 24px rgba(0,0,0,0.18)', maxHeight: '88vh', overflowY: 'auto',
      }}>
        {/* Drag handle */}
        <div style={{ width: '40px', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', margin: '0 auto 1.25rem' }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>
            {headerLabel || `⚡ ${isSpanish ? 'Reto rápido' : 'Quick challenge!'}`}
          </div>
          <div style={{ fontSize: '0.95rem', color: '#4a5568', marginBottom: '0.6rem' }}>
            {promptText || (isSpanish ? 'Escribe una frase con:' : 'Write a sentence using:')}
          </div>
          <div style={{ display: 'inline-block', background: PG, color: 'white', padding: '6px 22px', borderRadius: '20px', fontSize: '1.15rem', fontWeight: '700' }}>
            "{word}"
          </div>
        </div>

        {/* Transient AI failure banner (Anthropic 529 overload, network blip, etc.) — we stay in input phase so the student can retry. */}
        {aiUnavailable && phase !== 'result' && (
          <div style={{
            background: '#fef5e7', border: '1px solid #f6ad55', color: '#7b341e',
            borderRadius: '10px', padding: '0.7rem 0.9rem', marginBottom: '1rem',
            fontSize: '0.88rem', lineHeight: 1.5,
          }}>
            ⏳ {isSpanish
              ? 'Nuestro corrector de IA está ocupado ahora mismo. Tu respuesta no se ha guardado — inténtalo de nuevo en un momento.'
              : "Our AI checker is busy right now. Your answer hasn't been saved — try again in a moment."}
          </div>
        )}

        {/* ── INPUT PHASE ── */}
        {phase === 'input' && (
          <>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1.25rem', background: '#f7fafc', borderRadius: '10px', padding: '4px' }}>
              {['type', 'voice'].map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: '0.55rem', borderRadius: '8px', border: 'none',
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? '#553C9A' : '#718096',
                  fontWeight: mode === m ? '700' : '500',
                  fontSize: '0.88rem', cursor: 'pointer',
                  boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s',
                }}>
                  {m === 'type' ? '✏️ Type' : '🎙️ Speak'}
                </button>
              ))}
            </div>

            {/* Type mode */}
            {mode === 'type' && (
              <>
                <textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && textInput.trim()) { e.preventDefault(); markSentence(textInput.trim()); } }}
                  placeholder={isSpanish ? `Escribe una frase usando "${word}"...` : `Write a sentence using "${word}"...`}
                  rows={3}
                  disabled={isMarking}
                  style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', border: '2px solid #667eea', borderRadius: '10px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', backgroundColor: '#f7f7ff', marginBottom: '0.75rem' }}
                  autoFocus
                />
                <button
                  onClick={() => markSentence(textInput.trim())}
                  disabled={!textInput.trim() || isMarking}
                  style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: textInput.trim() && !isMarking ? PG : '#cbd5e0', color: 'white', border: 'none', fontSize: '1rem', cursor: textInput.trim() && !isMarking ? 'pointer' : 'not-allowed', fontWeight: '700', marginBottom: '0.6rem' }}>
                  {isMarking ? '🤖 ' + (isSpanish ? 'Comprobando...' : 'Checking...') : (isSpanish ? 'Comprobar mi frase →' : 'Check my sentence →')}
                </button>
              </>
            )}

            {/* Voice mode */}
            {mode === 'voice' && (
              <div style={{ textAlign: 'center' }}>
                {!isRecording && !isTranscribing && (
                  <button onClick={startRecording}
                    style={{ width: '80px', height: '80px', borderRadius: '50%', background: PG, color: 'white', border: 'none', fontSize: '2rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(102,126,234,0.4)', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    🎙️
                  </button>
                )}
                {isRecording && (
                  <>
                    <button onClick={stopRecording}
                      style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f56565', color: 'white', border: 'none', fontSize: '2rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(245,101,101,0.4)', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      ⏹
                    </button>
                    <div style={{ color: '#f56565', fontWeight: '600', fontSize: '0.9rem' }}>
                      {isSpanish ? 'Grabando' : 'Recording'} — {recordingSeconds}s
                    </div>
                  </>
                )}
                {isTranscribing && (
                  <div style={{ color: '#553C9A', fontSize: '0.95rem', padding: '1.5rem 0' }}>
                    🤖 {isSpanish ? 'Transcribiendo...' : 'Transcribing...'}
                  </div>
                )}
                {!isRecording && !isTranscribing && (
                  <div style={{ color: '#a0aec0', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                    {isSpanish ? 'Toca para grabar tu frase (máx 15s)' : 'Tap to record your sentence (max 15s)'}
                  </div>
                )}
              </div>
            )}

            {/* Skip */}
            <button onClick={() => { stopRecordingCleanup(); onClose(false); }}
              style={{ width: '100%', padding: '0.7rem', marginTop: '0.75rem', background: 'transparent', color: '#a0aec0', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              {isSpanish ? 'Saltar este reto' : 'Skip this challenge'}
            </button>
          </>
        )}

        {/* ── TRANSCRIPT PHASE ── */}
        {phase === 'transcript' && (
          <>
            <div style={{ fontSize: '0.78rem', fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.5rem' }}>
              {isSpanish ? 'Lo que dijiste (edita si hace falta):' : 'What you said (edit if needed):'}
            </div>
            <textarea
              value={editedTranscript}
              onChange={e => setEditedTranscript(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', border: '2px solid #667eea', borderRadius: '10px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', backgroundColor: '#f7f7ff', marginBottom: '0.75rem' }}
              autoFocus
            />
            <button onClick={() => markSentence(editedTranscript.trim(), 'voice')} disabled={!editedTranscript.trim() || isMarking}
              style={{ width: '100%', padding: '0.9rem', borderRadius: '10px', background: editedTranscript.trim() && !isMarking ? PG : '#cbd5e0', color: 'white', border: 'none', fontSize: '1rem', cursor: editedTranscript.trim() ? 'pointer' : 'not-allowed', fontWeight: '700', marginBottom: '0.6rem' }}>
              {isMarking ? '🤖 ' + (isSpanish ? 'Comprobando...' : 'Checking...') : (isSpanish ? 'Comprobar →' : 'Check →')}
            </button>
            <button onClick={() => { setPhase('input'); setEditedTranscript(''); }}
              style={{ width: '100%', padding: '0.7rem', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
              {isSpanish ? '← Grabar de nuevo' : '← Record again'}
            </button>
          </>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === 'result' && result && (
          <>
            {/* Echo the student's sentence back so they can see what they wrote */}
            {submittedSentence && (
              <div style={{
                padding: '0.75rem 0.9rem', borderRadius: '8px', marginBottom: '0.75rem',
                background: '#f7fafc', border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '600', color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.3rem' }}>
                  {isSpanish ? 'Tu frase:' : 'Your sentence:'}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568', fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{submittedSentence}"
                </div>
              </div>
            )}
            {earnedStar && (
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '2.5rem' }}>⭐️</div>
              </div>
            )}
            <div style={{
              padding: '1rem', borderRadius: '10px', marginBottom: '1rem',
              background: earnedStar ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${earnedStar ? '#c6f6d5' : '#fed7d7'}`,
              color: earnedStar ? '#276749' : '#c53030',
              fontSize: '0.95rem', lineHeight: 1.6, fontWeight: '500',
            }}>
              {earnedStar ? '✅ ' : '❌ '}{result.feedback || result.reason || (earnedStar ? (isSpanish ? '¡Bien hecho!' : 'Well done!') : (isSpanish ? '¡Inténtalo de nuevo!' : 'Try again!'))}
            </div>
            <button onClick={() => { stopRecordingCleanup(); onClose(earnedStar); }}
              style={{ width: '100%', padding: '1rem', borderRadius: '10px', background: PG, color: 'white', border: 'none', fontSize: '1rem', cursor: 'pointer', fontWeight: '700' }}>
              {earnedStar
                ? (isSpanish ? '⭐️ ¡Estrella ganada! Continuar →' : '⭐️ Star earned! Continue →')
                : (isSpanish ? 'Continuar →' : 'Continue →')}
            </button>
          </>
        )}
      </div>
    </>
  );
}
