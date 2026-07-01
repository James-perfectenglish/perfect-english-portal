import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const CATS = [
  { key: 'exercises',          label: 'Exercises',                 emoji: '✏️' },
  { key: 'speaking_listening', label: 'Speaking & Listening',      emoji: '🎧' },
  { key: 'games',              label: 'Daily Games',               emoji: '🎮' },
  { key: 'daily_prompt',       label: 'Word / Grammar of the Day', emoji: '📖' },
  { key: 'flashcards',         label: 'Flashcards',                emoji: '🎴' },
]

const CAT_COLOUR = {
  exercises:          '#667eea',
  speaking_listening: '#9f7aea',
  games:              '#48bb78',
  daily_prompt:       '#ed8936',
  flashcards:         '#4299e1',
}

const PROMPT_BADGE = {
  word:    { label: 'word',    bg: '#EDE9FE', fg: '#553C9A' },
  grammar: { label: 'grammar', bg: '#bee3f8', fg: '#2a69ac' },
  phrasal: { label: 'phrasal', bg: '#c6f6d5', fg: '#276749' },
}

function initials(name) {
  if (!name) return '??'
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr), now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function pctColour(v) {
  return v >= 70 ? '#38a169' : v >= 50 ? '#dd6b20' : '#e53e3e'
}

function rowMetric(r) {
  if (r.graded_count > 0) {
    const v = Math.round(100 * r.success_count / r.graded_count)
    return { text: `${v}%`, colour: pctColour(v) }
  }
  if (r.scored_count > 0) return { text: `avg ${r.avg_score}`, colour: '#718096' }
  return { text: null, colour: '#a0aec0' }
}

function levelStyle(level) {
  const es = level === 'Spanish'
  return {
    background: es ? '#fff0f0' : level?.startsWith('A') ? '#c6f6d5' : level?.startsWith('B') ? '#bee3f8' : '#fbd38d',
    color:      es ? '#e53e3e' : level?.startsWith('A') ? '#276749' : level?.startsWith('B') ? '#2a69ac' : '#744210',
  }
}

export default function StudentPanel({ student, onClose }) {
  const [rows, setRows] = useState(null)
  const [sentences, setSentences] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const [{ data: sumData }, { data: sentData }] = await Promise.all([
        supabase.from('student_activity_summary').select('*').eq('student_id', student.id),
        supabase.from('daily_sentence_feed').select('*').eq('student_id', student.id)
          .order('submitted_at', { ascending: false }).limit(12),
      ])
      if (!alive) return
      setRows(sumData || [])
      setSentences(sentData || [])
      setLoading(false)
    })()
    return () => { alive = false }
  }, [student.id])

  const all = rows || []
  const totalEvents = all.reduce((s, r) => s + r.events, 0)
  const gradedSum   = all.reduce((s, r) => s + (r.graded_count || 0), 0)
  const successSum  = all.reduce((s, r) => s + (r.success_count || 0), 0)
  const overallPct  = gradedSum > 0 ? Math.round(100 * successSum / gradedSum) : null
  const lastActive  = all.reduce((best, r) =>
    (!best || new Date(r.last_active) > new Date(best)) ? r.last_active : best, null)

  const byCat = {}
  all.forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + r.events })
  const mix = CATS.map(c => ({ ...c, events: byCat[c.key] || 0 })).filter(c => c.events > 0)
  const mixCaption = [...mix].sort((a, b) => b.events - a.events).slice(0, 3)
    .map(c => `${c.label.replace(' & ', '/').replace('Word / Grammar of the Day', 'Daily words')} ${Math.round(100 * c.events / totalEvents)}%`)
    .join('  ·  ')

  const name = (student.full_name || student.name || 'Student').trim()

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: '16px', width: 'min(680px, 94vw)',
        maxHeight: '90vh', overflowY: 'auto', zIndex: 1001,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
      }}>
        {/* HEADER */}
        <div style={{ position: 'sticky', top: 0, background: 'white', borderBottom: '1px solid #edf2f7', padding: '1.25rem 1.25rem 1rem', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
              {initials(name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2C3E50' }}>{name}</span>
                {student.level && (
                  <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700, ...levelStyle(student.level) }}>
                    {student.level === 'Spanish' ? 'ES' : student.level}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#718096', marginTop: '2px' }}>
                {loading ? 'Loading…' : (
                  <>Last active {fmtDate(lastActive)} · {totalEvents.toLocaleString()} activities
                  {overallPct != null && <> · {overallPct}% correct overall</>}</>
                )}
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#718096', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>✕</button>
          </div>

          {/* CATEGORY MIX BAR */}
          {!loading && mix.length > 0 && (
            <div style={{ marginTop: '0.9rem' }}>
              <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', background: '#edf2f7' }}>
                {mix.map(c => (
                  <div key={c.key} title={`${c.label}: ${c.events.toLocaleString()}`}
                    style={{ flexGrow: c.events, background: CAT_COLOUR[c.key] }} />
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#a0aec0', marginTop: '5px' }}>{mixCaption}</div>
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: '1rem 1.25rem 1.5rem' }}>
          {loading && <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem 0' }}>Loading activity…</p>}

          {!loading && all.length === 0 && (
            <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem 0' }}>No recorded activity yet.</p>
          )}

          {!loading && CATS.map(cat => {
            const catRows = all.filter(r => r.category === cat.key).sort((a, b) => b.events - a.events)
            if (catRows.length === 0) return null
            const catTotal = catRows.reduce((s, r) => s + r.events, 0)
            return (
              <div key={cat.key} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '99px', background: CAT_COLOUR[cat.key] }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2C3E50' }}>{cat.emoji} {cat.label}</span>
                  <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>{catTotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {catRows.map(r => {
                    const m = rowMetric(r)
                    return (
                      <div key={r.surface} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.6rem', borderRadius: '8px', background: '#fafafa' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.surface}</span>
                        <span style={{ fontSize: '0.78rem', color: '#4a5568', minWidth: '52px', textAlign: 'right' }}>{r.events.toLocaleString()}×</span>
                        <span style={{ fontSize: '0.72rem', color: '#a0aec0', minWidth: '62px', textAlign: 'right' }}>{fmtDate(r.last_active)}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: m.colour, minWidth: '48px', textAlign: 'right' }}>{m.text || ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* RECENT SENTENCES */}
          {!loading && sentences.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2C3E50', marginBottom: '0.6rem' }}>
                ✍️ Recent sentences <span style={{ fontSize: '0.72rem', color: '#a0aec0', fontWeight: 400 }}>({sentences.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sentences.map((s, i) => {
                  const badge = PROMPT_BADGE[s.prompt_type] || PROMPT_BADGE.word
                  return (
                    <div key={i} style={{ background: s.is_correct ? '#f0fff4' : '#fff5f5', border: `1px solid ${s.is_correct ? '#c6f6d5' : '#fed7d7'}`, borderRadius: '10px', padding: '0.7rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                        <span style={{ padding: '1px 7px', borderRadius: '99px', fontSize: '0.66rem', fontWeight: 700, background: badge.bg, color: badge.fg }}>{badge.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2C3E50' }}>{s.prompt}</span>
                        {s.prompt_detail && <span style={{ fontSize: '0.72rem', color: '#a0aec0', fontStyle: 'italic' }}>{s.prompt_detail}</span>}
                        {s.level && <span style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '0.64rem', fontWeight: 700, ...levelStyle(s.level) }}>{s.level}</span>}
                        {s.language === 'es' && <span style={{ fontSize: '0.66rem' }}>🇪🇸</span>}
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#a0aec0' }}>{fmtDate(s.submitted_at)}</span>
                        {s.is_soft_pass && <span style={{ fontSize: '0.64rem', background: '#fbd38d', color: '#744210', padding: '1px 6px', borderRadius: '99px', fontWeight: 600 }}>soft pass</span>}
                      </div>
                      <p style={{ margin: '0 0 0.3rem', fontSize: '0.88rem', color: '#2d3748', fontStyle: 'italic' }}>"{s.sentence}"</p>
                      {s.ai_feedback && (
                        <p style={{ margin: 0, fontSize: '0.76rem', lineHeight: 1.4, color: s.is_correct ? '#276749' : '#9b2c2c' }}>
                          {s.is_correct ? '✅ ' : '❌ '}{s.ai_feedback}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
