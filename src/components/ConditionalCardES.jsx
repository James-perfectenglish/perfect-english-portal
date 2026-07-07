/* ============================================================
   ConditionalCardES — one Spanish conditional's reference card
   ------------------------------------------------------------
   Used by:
     • ConditionalExplainerES.jsx — accordion mode (with onPractise)
     • ConditionalChooser.jsx (language="es") — the 📖 overlay
   Sibling of ConditionalCard / TenseCardES. No bank fetch. The
   `formation` box teaches the subjunctive forms inline (agreed
   6 Jul: a structures reference, not a Conjugator expansion).
   ============================================================ */

const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  warnInk: '#92400e', warnBg: '#fffbeb', warnLine: '#f59e0b',
  chipBg: '#eef2ff', mark: '#fef3c7', band: '#c3dafe',
};

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderMd = (text) => String(text || '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
  if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
  if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
  return <span key={i}>{p}</span>;
});

function withSignals(text, signals) {
  if (!signals || !signals.length) return text;
  const re = new RegExp(`(${signals.map(esc).join('|')})`, 'gi');
  const parts = text.split(re);
  const lower = signals.map(s => s.toLowerCase());
  return parts.map((p, i) =>
    lower.includes(p.toLowerCase())
      ? <span key={i} style={{ background: C.mark, borderRadius: 4, padding: '0 3px', fontWeight: 700 }}>{p}</span>
      : <span key={i}>{p}</span>
  );
}

/* condición → resultado timeline — solid = real, dashed hollow = hypothetical.
   shape: 'tipo0' | 'tipo1' | 'tipo2' | 'tipo3' | 'mixto' | null */
export function CondTimelineES({ shape }) {
  if (!shape) return null;
  const W = 260, H = 40, mid = 26, nowX = 150;
  const solidDot = (x) => <circle cx={x} cy={mid} r="5" fill={C.brand} />;
  const hollowDot = (x) => <circle cx={x} cy={mid} r="5" fill="white" stroke={C.brand} strokeWidth="2" strokeDasharray="3 2" />;
  const arrow = (x1, x2, dashed) => (
    <g>
      <line x1={x1 + 8} y1={mid} x2={x2 - 9} y2={mid} stroke={C.brand} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} />
      <polygon points={`${x2 - 9},${mid - 4} ${x2 - 9},${mid + 4} ${x2 - 3},${mid}`} fill={C.brand} />
    </g>
  );
  const siLabel = (x) => <text x={x - 4} y={mid - 10} fontSize="8" fill={C.brandDark} fontWeight="700">si</text>;
  let shapes = null;
  if (shape === 'tipo0') {
    shapes = <rect x="14" y={mid - 5} width={W - 28} height="10" rx="5" fill={C.band} opacity="0.7" />;
  } else if (shape === 'tipo1') {
    shapes = <g>{siLabel(176)}{arrow(176, 226, false)}{solidDot(176)}{solidDot(226)}</g>;
  } else if (shape === 'tipo2') {
    shapes = <g>{siLabel(176)}{arrow(176, 226, true)}{hollowDot(176)}{hollowDot(226)}</g>;
  } else if (shape === 'tipo3') {
    shapes = <g>{siLabel(56)}{arrow(56, 108, true)}{hollowDot(56)}{hollowDot(108)}</g>;
  } else if (shape === 'mixto') {
    shapes = <g>{siLabel(62)}{arrow(62, nowX, true)}{hollowDot(62)}{hollowDot(nowX)}</g>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} aria-hidden="true">
      <line x1="8" y1={mid} x2={W - 8} y2={mid} stroke={C.line} strokeWidth="2" />
      <line x1={nowX} y1={mid - 9} x2={nowX} y2={mid + 9} stroke={C.faint} strokeWidth="1" strokeDasharray="2 2" />
      {shapes}
      <text x="8" y="11" fontSize="9" fill={C.faint}>pasado</text>
      <text x={nowX - 12} y="11" fontSize="9" fill={C.brand} fontWeight="700">ahora</text>
      <text x={W - 36} y="11" fontSize="9" fill={C.faint}>futuro</text>
    </svg>
  );
}

export default function ConditionalCardES({ card, onPractise }) {
  if (!card) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ background: PG, padding: '0.9rem 1.1rem', color: 'white' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{card.name}</div>
        <div style={{ marginTop: 7, background: 'rgba(255,255,255,0.16)', borderRadius: 9, padding: '0.45rem 0.65rem', fontSize: '0.85rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {card.formula}
        </div>
      </div>

      <div style={{ padding: '1.1rem' }}>
        {card.timeline && (
          <div style={{ marginBottom: '1rem' }}><CondTimelineES shape={card.timeline} /></div>
        )}

        {card.formation && (
          <div style={{ marginBottom: '1rem', background: C.chipBg, border: `1px solid ${C.line}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.brandDark, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>🔧 The form</div>
            <div style={{ color: C.slate, fontSize: '0.82rem', marginBottom: 6 }}>{renderMd(card.formation.intro)}</div>
            {card.formation.rows.map((r, i) => (
              <div key={i} style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.8rem', color: C.ink, padding: '2px 0' }}>{r}</div>
            ))}
            {card.formation.chips && card.formation.chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {card.formation.chips.map(ch => (
                  <span key={ch} style={{ background: 'white', color: C.brandDark, fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.band}` }}>{ch}</span>
                ))}
              </div>
            )}
            {card.formation.note && (
              <div style={{ color: C.muted, fontSize: '0.76rem', marginTop: 8, lineHeight: 1.45 }}>{renderMd(card.formation.note)}</div>
            )}
          </div>
        )}

        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>When you use it</div>
        {card.uses.map((u, i) => (
          <div key={i} style={{ marginBottom: i < card.uses.length - 1 ? '0.9rem' : 0 }}>
            <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
              <span style={{ color: C.slate, fontSize: '0.88rem', fontWeight: 600 }}>{u.label}</span>
              {u.signals.map(s => (
                <span key={s} style={{ background: C.chipBg, color: C.brandDark, fontSize: '0.66rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{s}</span>
              ))}
            </div>
            <div style={{ background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: 9, padding: '0.5rem 0.7rem', color: C.ink, fontSize: '0.9rem' }}>
              {withSignals(u.example, u.signals)}
            </div>
          </div>
        ))}

        {card.negative && (
          <div style={{ marginTop: '1.1rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>➖ The negative</div>
            <div style={{ background: C.chipBg, borderRadius: 8, padding: '0.4rem 0.65rem', fontSize: '0.8rem', color: C.brandDark, fontFamily: 'ui-monospace, SFMono-Regular, monospace', marginBottom: 8 }}>
              {renderMd(card.negative.formula)}
            </div>
            {card.negative.examples.map((ex, i) => (
              <div key={i} style={{ background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: 9, padding: '0.5rem 0.7rem', color: C.ink, fontSize: '0.9rem', marginBottom: i < card.negative.examples.length - 1 ? 8 : 0 }}>
                {ex}
              </div>
            ))}
          </div>
        )}

        {card.watchOuts && card.watchOuts.length > 0 && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {card.watchOuts.map((w, i) => (
              <div key={i} style={{ background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
                <span style={{ fontWeight: 700, color: C.warnInk, fontSize: '0.76rem' }}>👁️ Watch out · </span>
                <span style={{ color: C.warnInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{renderMd(w)}</span>
              </div>
            ))}
          </div>
        )}

        {onPractise && (
          <div style={{ marginTop: '1rem', borderTop: `1px solid ${C.line}`, paddingTop: '0.9rem' }}>
            <button onClick={() => onPractise(card)}
              style={{ background: PG, color: 'white', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', width: '100%' }}>
              ✏️ Practise in Conditionals Chooser →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
