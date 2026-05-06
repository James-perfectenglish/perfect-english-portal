import { useState, useEffect, useCallback } from 'react'
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
  const [pending, setPending] = useState(null)   // the row currently being shown
  const [dismissing, setDismissing] = useState(false)
  const [visible, setVisible] = useState(false)  // for the slide-in animation
  const location = useLocation()

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
      // Most likely "no rows" or a transient network blip — fail silent.
      // (maybeSingle returns null+no error for 0 rows.)
      console.warn('TeacherStarBanner fetch failed:', error.message)
      return
    }
    if (data) {
      setPending(data)
      // Slide in on the next paint.
      requestAnimationFrame(() => setVisible(true))
    } else {
      setPending(null)
      setVisible(false)
    }
  }, [profile?.id])

  // Refetch on mount and on every route change. Cheap, indexed, and
  // catches stars awarded mid-session as soon as the student navigates.
  useEffect(() => {
    fetchNext()
  }, [fetchNext, location.pathname])

  async function dismiss() {
    if (!pending || dismissing) return
    setDismissing(true)
    setVisible(false)  // animate out

    const { error } = await supabase
      .from('stars')
      .update({ seen_at: new Date().toISOString() })
      .eq('id', pending.id)
      .eq('student_id', profile.id) // belt and braces; RLS already enforces

    if (error) {
      console.warn('Could not mark star as seen:', error)
      // Don't loop — let the user out. They'll see it again next session;
      // if it persists, the dismiss button still re-attempts via fetchNext.
    }

    // Wait for the slide-out animation, then look for the next one.
    setTimeout(() => {
      setPending(null)
      setDismissing(false)
      fetchNext()
    }, 320)
  }

  if (!pending) return null

  const note = pending.context?.note?.trim() || null
  const dateLabel = formatAwardedDate(pending.awarded_at, isSpanish)

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1500,
        // Smooth slide + fade. Kept short so it doesn't feel laggy.
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
            {isSpanish
              ? '\u00a1Tu profesor te ha dado una estrella!'
              : 'Your teacher gave you a star!'}
          </div>
          {note ? (
            <div style={{
              fontSize: '0.85rem',
              color: '#92400e',
              marginTop: '2px',
              lineHeight: 1.35,
              fontStyle: 'italic',
              // Wrap nicely on mobile but allow longer notes to flow.
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
