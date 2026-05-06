import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

/**
 * Banner that surfaces unseen teacher-awarded stars to a student.
 *
 * On every route change (and on mount), looks up the oldest unseen
 * `teacher_awarded` star for the current user and shows it as a yellow
 * ribbon at the top of the screen. "Got it" sets seen_at and looks for
 * the next unseen one — if none, the banner disappears.
 *
 * Mounted high in the student layout in App.jsx so it renders across
 * every page transition. Renders nothing for teachers / when there's
 * nothing pending.
 */
export default function TeacherStarBanner({ profile, isSpanish = false }) {
  const [pending, setPending] = useState(null)         // current row being shown
  const [awarderName, setAwarderName] = useState(null) // first name of the teacher who awarded it
  const [dismissing, setDismissing] = useState(false)
  const [visible, setVisible] = useState(false)        // for slide-in animation
  const location = useLocation()

  // Cache awarder names for the session — usually only one teacher anyway.
  const nameCacheRef = useRef({})

  async function lookupAwarderName(awarderId) {
    if (!awarderId) return null
    if (nameCacheRef.current[awarderId] !== undefined) {
      return nameCacheRef.current[awarderId]
    }
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', awarderId)
      .maybeSingle()
    const firstName = data?.full_name?.trim().split(/\s+/)[0] || null
    nameCacheRef.current[awarderId] = firstName
    return firstName
  }

  const fetchNext = useCallback(async () => {
    if (!profile?.id) return
    const { data, error } = await supabase
      .from('stars')
      .select('id, awarded_at, context')
      .eq('student_id', profile.id)
      .eq('source', 'teacher_awarded')
      .is('seen_at', null)
      .order('awarded_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.warn('TeacherStarBanner fetch failed:', error.message)
      return
    }
    if (data) {
      // Look up awarder name BEFORE showing the banner so it doesn't flicker.
      const awarderId = data.context?.awarded_by || null
      const name = await lookupAwarderName(awarderId)
      setAwarderName(name)
      setPending(data)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setPending(null)
      setAwarderName(null)
      setVisible(false)
    }
  }, [profile?.id])

  // Refetch on mount and on every route change.
  useEffect(() => {
    fetchNext()
  }, [fetchNext, location.pathname])

  async function dismiss() {
    if (!pending || dismissing) return
    setDismissing(true)
    setVisible(false)

    const { error } = await supabase
      .from('stars')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', pending.id)
      .eq('student_id', profile.id) // belt and braces; RLS already enforces

    if (error) {
      console.warn('Could not mark star as seen:', error)
    }

    setTimeout(() => {
      setPending(null)
      setAwarderName(null)
      setDismissing(false)
      fetchNext()
    }, 320)
  }

  if (!pending) return null

  const note = pending.context?.note?.trim() || null
  const dateLabel = formatAwardedDate(pending.awarded_at, isSpanish)

  // Headline — uses awarder's first name if known, else falls back to "Your teacher".
  const headline = awarderName
    ? (isSpanish
        ? `\u00a1${awarderName} te ha dado una estrella!`
        : `${awarderName} gave you a star!`)
    : (isSpanish
        ? '\u00a1Tu profesor te ha dado una estrella!'
        : 'Your teacher gave you a star!')

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1500,
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 280ms ease-out, opacity 280ms ease-out',
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
        borderBottom: '2px solid #f59e0b',
        boxShadow: '0 6px 16px rgba(245, 158, 11, 0.18)',
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
      }}>
        <div style={{ fontSize: '1.6rem', flexShrink: 0, lineHeight: 1 }} aria-hidden="true">⭐</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: '#78350f', fontSize: '0.92rem', lineHeight: 1.3 }}>
            {headline}
          </div>
          {note ? (
            <div style={{
              fontSize: '0.85rem',
              color: '#92400e',
              marginTop: '2px',
              lineHeight: 1.35,
              fontStyle: 'italic',
              wordBreak: 'break-word',
            }}>
              &ldquo;{note}&rdquo;
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#a16207', marginTop: '2px' }}>
              {isSpanish ? 'Sigue as\u00ed.' : 'Keep it up.'}
            </div>
          )}
          <div style={{ fontSize: '0.7rem', color: '#a16207', marginTop: '3px' }}>
            {dateLabel}
          </div>
        </div>

        <button
          onClick={dismiss}
          disabled={dismissing}
          style={{
            flexShrink: 0,
            padding: '0.55rem 0.95rem',
            borderRadius: '999px',
            border: 'none',
            background: dismissing ? '#cbd5e0' : 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: dismissing ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
          }}
        >
          {isSpanish ? '\u00a1Genial!' : 'Got it'}
        </button>
      </div>
    </div>
  )
}

function formatAwardedDate(iso, isSpanish) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr  = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1)  return isSpanish ? 'Justo ahora' : 'Just now'
  if (diffMin < 60) return isSpanish ? `Hace ${diffMin} min` : `${diffMin} min ago`
  if (diffHr  < 24) return isSpanish ? `Hace ${diffHr} h`    : `${diffHr} h ago`
  if (diffDay === 1) return isSpanish ? 'Ayer' : 'Yesterday'
  if (diffDay < 7)  return isSpanish ? `Hace ${diffDay} d\u00edas` : `${diffDay} days ago`

  return d.toLocaleDateString(isSpanish ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
