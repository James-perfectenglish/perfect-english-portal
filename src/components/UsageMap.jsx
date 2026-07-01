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

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr), now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  if (diff < 60) return `${Math.floor(diff / 7)}w ago`
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
}

export default function UsageMap() {
  const [open, setOpen] = useState(true)
  const [metric, setMetric] = useState('all') // 'all' | '30d' — what the bar is sized by
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: allRows }, { data: recent }] = await Promise.all([
        supabase.rpc('usage_map', { p_days: null }),
        supabase.rpc('usage_map', { p_days: 30 }),
      ])
      if (!alive) return
      const recMap = {}
      ;(recent || []).forEach(r => { recMap[r.surface] = r })
      const merged = (allRows || []).map(r => ({
        ...r,
        events30:   recMap[r.surface]?.events || 0,
        students30: recMap[r.surface]?.students || 0,
      }))
      setData(merged)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [])

  const rows = data || []
  const val = r => (metric === '30d' ? r.events30 : r.events)
  const maxVal = Math.max(1, ...rows.map(val))

  return (
    <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderBottom: open ? '1px solid #f0f0f0' : 'none' }}>
        <span style={{ fontSize: '1.1rem' }}>🗺️</span>
        <span style={{ fontWeight: 700, color: '#2C3E50' }}>Usage map</span>
        <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>what students actually use</span>
        <span style={{ marginLeft: 'auto', color: '#a0aec0' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          {/* metric toggle */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            {[['all', 'All time'], ['30d', 'Last 30 days']].map(([v, label]) => (
              <button key={v} onClick={() => setMetric(v)}
                style={{ padding: '4px 12px', borderRadius: '99px', border: '1px solid', borderColor: metric === v ? '#667eea' : '#e2e8f0', background: metric === v ? '#667eea' : 'white', color: metric === v ? 'white' : '#718096', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                {label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#a0aec0', alignSelf: 'center' }}>
              bar = {metric === '30d' ? 'plays in last 30 days' : 'lifetime plays'}
            </span>
          </div>

          {loading && <p style={{ textAlign: 'center', color: '#a0aec0', padding: '1.5rem 0' }}>Loading usage…</p>}

          {!loading && CATS.map(cat => {
            const catRows = rows.filter(r => r.category === cat.key).sort((a, b) => val(b) - val(a))
            if (catRows.length === 0) return null
            return (
              <div key={cat.key} style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2C3E50', marginBottom: '0.5rem' }}>
                  {cat.emoji} {cat.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {catRows.map(r => {
                    const dormant = r.events30 === 0
                    const barPct = Math.round(100 * val(r) / maxVal)
                    return (
                      <div key={r.surface} style={{ opacity: dormant && metric === 'all' ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '2px' }}>
                          <span style={{ fontSize: '0.83rem', color: '#2d3748', fontWeight: 500 }}>{r.surface}</span>
                          {dormant && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#a0aec0', background: '#edf2f7', padding: '1px 6px', borderRadius: '99px' }}>dormant</span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#a0aec0' }}>
                            {r.students} {r.students === 1 ? 'student' : 'students'}
                          </span>
                          {r.success_pct != null && (
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, minWidth: '34px', textAlign: 'right', color: r.success_pct >= 70 ? '#38a169' : r.success_pct >= 50 ? '#dd6b20' : '#e53e3e' }}>{r.success_pct}%</span>
                          )}
                          {r.success_pct == null && r.scored_avg != null && (
                            <span style={{ fontSize: '0.74rem', color: '#718096', minWidth: '34px', textAlign: 'right' }}>~{r.scored_avg}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ flex: 1, height: '7px', borderRadius: '99px', background: '#f0f0f0', overflow: 'hidden' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: CAT_COLOUR[cat.key], borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#4a5568', minWidth: '48px', textAlign: 'right' }}>
                            {val(r).toLocaleString()}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#a0aec0', minWidth: '58px', textAlign: 'right' }}>
                            {fmtDate(r.last_active)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {!loading && rows.length === 0 && (
            <p style={{ textAlign: 'center', color: '#a0aec0', padding: '1.5rem 0' }}>No activity recorded yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
