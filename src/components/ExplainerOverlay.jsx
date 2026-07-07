/* ============================================================
   ExplainerOverlay — generic scrim + panel for reference cards
   ------------------------------------------------------------
   Shows any child content in a centred overlay above the current
   exercise. Closes on the ✕ or a tap on the scrim. Built for the
   "📖 See the full card" bridge in Modal Match; the Tense Tagger
   will reuse the same shell.
   ============================================================ */

export default function ExplainerOverlay({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(26, 32, 44, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 640,
          maxHeight: '85vh', overflowY: 'auto',
          borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          background: 'white',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 2,
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.25)', color: 'white',
            fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
