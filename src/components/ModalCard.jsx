import { FUNCTION_STYLES } from '../lib/modalExplainEn.js';

/* ============================================================
   ModalCard — one modal's reference card (shared)
   ------------------------------------------------------------
   Used by:
     • ModalExplainer.jsx  — accordion mode (open/onToggle)
     • ModalChooser.jsx    — overlay mode  (open, no onToggle,
                             highlightFn marks the relevant use)
   When onToggle is absent the header is static (no +/− control).
   ============================================================ */

const C = {
  card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', muted: '#718096', faint: '#a0aec0',
  brandDark: '#553C9A',
  goodBg: '#f0fff4', goodLine: '#38a169',
  warnInk: '#92400e', warnBg: '#fffbeb', warnLine: '#f59e0b',
  contrastBg: '#eef2ff', contrastInk: '#3730A3', contrastLine: '#c7d2fe',
  hlBg: '#f5f3ff', hlLine: '#c7d2fe',
};
const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const PILL_DEFAULT = { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' };

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function FunctionPill({ fn }) {
  const st = FUNCTION_STYLES[fn] || PILL_DEFAULT;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, backgroundColor: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}>
      {capFirst(fn)}
    </span>
  );
}

export default function ModalCard({ card, open, onToggle, highlightFn = null }) {
  const interactive = typeof onToggle === 'function';

  const Header = (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{card.modal}</span>
      <span style={{ background: open ? 'rgba(255,255,255,0.22)' : '#f1f5f9', color: open ? 'white' : C.muted, borderRadius: 8, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700 }}>{card.band}+</span>
    </span>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: open ? '0 4px 14px rgba(102,126,234,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Collapsed/expanded header — a toggle in the Explainer, static in the overlay */}
      {interactive ? (
        <button onClick={onToggle} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: open ? PG : 'white', color: open ? 'white' : C.ink,
          border: 'none', padding: '0.75rem 1rem', cursor: 'pointer', textAlign: 'left',
        }}>
          {Header}
          <span style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.8 }}>{open ? '−' : '+'}</span>
        </button>
      ) : (
        <div style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: PG, color: 'white', padding: '0.75rem 1rem', textAlign: 'left', boxSizing: 'border-box',
        }}>
          {Header}
        </div>
      )}

      {open && (
        <div style={{ padding: '1rem 1.1rem 1.1rem' }}>
          <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: 9, padding: '0.4rem 0.65rem', fontSize: '0.82rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: C.brandDark, marginBottom: '1rem' }}>
            {card.forms}
          </div>

          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>When you use it</div>
          {card.uses.map((u, i) => {
            const hl = !!highlightFn && u.fn === highlightFn;
            return (
              <div key={i} style={{
                marginBottom: i < card.uses.length - 1 ? '0.9rem' : 0,
                ...(hl ? { background: C.hlBg, border: `1px solid ${C.hlLine}`, borderRadius: 10, padding: '0.55rem 0.6rem' } : {}),
              }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
                  <FunctionPill fn={u.fn} />
                  <span style={{ color: C.brandDark, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{u.form}</span>
                  <span style={{ color: C.muted, fontSize: '0.82rem' }}>— {u.gloss}</span>
                </div>
                <div style={{ background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: 9, padding: '0.5rem 0.7rem', color: C.ink, fontSize: '0.9rem' }}>
                  {u.example}
                </div>
              </div>
            );
          })}

          {card.contrast && (
            <div style={{ marginTop: '1rem', background: C.contrastBg, border: `1px solid ${C.contrastLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
              <span style={{ fontWeight: 700, color: C.contrastInk, fontSize: '0.76rem' }}>↔ Don’t mix up · </span>
              <span style={{ color: C.contrastInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{card.contrast}</span>
            </div>
          )}

          <div style={{ marginTop: '0.75rem', background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
            <span style={{ fontWeight: 700, color: C.warnInk, fontSize: '0.76rem' }}>👁️ Watch out · </span>
            <span style={{ color: C.warnInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{card.watchOut}</span>
          </div>
        </div>
      )}
    </div>
  );
}
