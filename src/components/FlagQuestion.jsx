import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

// Subtle "report a problem" control, shown only after an answer is revealed.
// Logs a flag against a question_bank item so the teacher can review broken/
// confusing questions. Deliberately low-key — a prominent button invites
// reflexive flagging from students who are simply wrong.
//
// Props:
//   questionNumber  (required) — question_bank.question_number
//   language        'en' | 'es' (default 'en')
export default function FlagQuestion({ questionNumber, language = 'en' }) {
  const isSpanish = language === 'es'
  const [mode, setMode] = useState('idle')   // 'idle' | 'open' | 'done'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Reset whenever we move to a different question (component may stay mounted).
  useEffect(() => {
    setMode('idle'); setReason(''); setBusy(false)
  }, [questionNumber])

  if (questionNumber === null || questionNumber === undefined) return null

  const t = isSpanish
    ? {
        trigger: '🚩 Informar de un problema',
        prompt: '¿Qué pasa con esta pregunta? (opcional)',
        placeholder: 'p. ej. la respuesta parece incorrecta, una errata, confuso…',
        report: 'Enviar',
        cancel: 'Cancelar',
        sending: 'Enviando…',
        done: '✓ Informado — ¡gracias!',
      }
    : {
        trigger: '🚩 Report a problem',
        prompt: "What's wrong with this question? (optional)",
        placeholder: 'e.g. the answer looks wrong, a typo, confusing…',
        report: 'Report',
        cancel: 'Cancel',
        sending: 'Sending…',
        done: '✓ Reported — thanks!',
      }

  const submit = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error } = await supabase.from('question_flags').insert({
          user_id: user.id,
          question_number: questionNumber,
          reason: reason.trim() || null,
        })
        // 23505 = an open flag from this student already exists → treat as success.
        if (error && error.code !== '23505') console.error('Flag insert error:', error)
      }
    } catch (e) {
      console.error('Flag submit error:', e)
    } finally {
      setMode('done')
      setBusy(false)
    }
  }

  if (mode === 'done') {
    return (
      <div style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: '10px', fontSize: '0.8rem', color: '#718096' }}>
        {t.done}
      </div>
    )
  }

  if (mode === 'idle') {
    return (
      <div style={{ textAlign: 'center', marginTop: '0.5rem', marginBottom: '10px' }}>
        <button
          onClick={() => setMode('open')}
          style={{
            background: 'none', border: 'none', padding: '2px 6px',
            color: '#a0aec0', fontSize: '0.78rem', cursor: 'pointer',
            textDecoration: 'underline', textUnderlineOffset: '2px',
          }}
        >{t.trigger}</button>
      </div>
    )
  }

  // mode === 'open'
  return (
    <div style={{
      marginTop: '0.5rem', marginBottom: '10px', padding: '0.75rem', borderRadius: '8px',
      background: '#f7fafc', border: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: '0.82rem', color: '#4a5568', marginBottom: '0.4rem' }}>{t.prompt}</div>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder={t.placeholder}
        rows={2}
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem',
          fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #cbd5e0',
          resize: 'vertical', color: '#2d3748', WebkitTextFillColor: '#2d3748',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          onClick={() => { setMode('idle'); setReason('') }}
          disabled={busy}
          style={{
            padding: '6px 14px', borderRadius: '6px', border: '1px solid #e2e8f0',
            background: 'white', color: '#718096', fontSize: '0.82rem', fontWeight: 500,
            cursor: busy ? 'default' : 'pointer',
          }}
        >{t.cancel}</button>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: '#e53e3e', color: 'white', fontSize: '0.82rem', fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
          }}
        >{busy ? t.sending : t.report}</button>
      </div>
    </div>
  )
}
