import { useState } from 'react'

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

/**
 * A "?" button that opens a short rules sheet.
 *
 * Help text is deliberately English everywhere, including the Spanish side of
 * the app: those students are English speakers learning Spanish, so rules given
 * in Spanish would be one more thing to decode.
 *
 * Use it sparingly. The "?" is worth more where it appears if its presence
 * means there is genuinely something here you wouldn't guess.
 *
 *   <HelpSheet
 *     title="How to play"
 *     points={[
 *       'Guess the 5-letter word in 6 tries.',
 *       <>Type <strong>facil</strong> and it counts as <strong>fácil</strong>.</>,
 *     ]}
 *   />
 *
 * Drop it inside a header that has `position: 'relative'`, or pass
 * `inline` to render the button in normal flow instead.
 */
export default function HelpSheet({ title = 'How to play', points = [], inline = false }) {
  const [open, setOpen] = useState(false)

  const buttonStyle = inline
    ? {
        width: '22px', height: '22px', borderRadius: '50%',
        background: '#e2e8f0', color: '#4a5568', border: 'none',
        fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, verticalAlign: 'middle',
      }
    : {
        position: 'absolute', top: '10px', right: '12px',
        width: '28px', height: '28px', borderRadius: '50%',
        background: 'rgba(255,255,255,0.2)', color: 'white',
        border: '1px solid rgba(255,255,255,0.45)',
        fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={title} style={buttonStyle}>?</button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', zIndex: 1000,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '12px', padding: '1.5rem',
              maxWidth: '380px', width: '100%', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#2d3748' }}>
              {title}
            </h2>
            <ul style={{
              margin: 0, paddingLeft: '1.1rem', color: '#4a5568',
              fontSize: '0.88rem', lineHeight: 1.6,
            }}>
              {points.map((p, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{p}</li>)}
            </ul>
            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: '1.25rem', width: '100%', padding: '0.7rem',
                background: GRADIENT, color: 'white', border: 'none',
                borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
              }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
