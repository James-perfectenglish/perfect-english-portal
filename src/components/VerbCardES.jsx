import { PERSONS } from '../lib/verbConjugatorEs.js';

/* ============================================================
   VerbCardES — one Spanish tense's conjugation card (shared)
   ------------------------------------------------------------
   Used by VerbConjugatorES.jsx (accordion). Pure reference — no
   bank fetch. Mirrors the TenseCardES visual language (the C
   palette, the PG gradient header, the amber "watch out" box) but
   the body is a CONJUGATION TABLE, not signal words:

     • gradient header  — Spanish name + English name + formation
     • English gloss     — the "what the hell is this" anchor
     • the table         — simple: hablar / comer / vivir columns
                           compound: haber column + participle line
     • irregulars        — same table shape, key verbs as columns
     • a pattern note     — markdown-lite (**bold** / *italic*)
     • watch out          — the English-speaker trap

   `onOpenExplainer` (optional) renders a foot link across to the
   Spanish Tense Explainer (James: each page links its OWN language).
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
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/* tiny markdown-lite: **bold** and *italic*, non-nested (all we author) */
function renderMd(text) {
  const nodes = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0, m, key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] != null) nodes.push(<strong key={key++} style={{ color: C.slate }}>{m[1]}</strong>);
    else nodes.push(<em key={key++} style={{ color: C.brandDark, fontStyle: 'italic' }}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* a person × verb(s) conjugation grid. cols: [{ head, forms[6] }] */
function ConjTable({ cols }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.86rem', minWidth: cols.length > 2 ? 340 : undefined }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px 8px 0', fontSize: '0.62rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.4px' }}></th>
            {cols.map(c => (
              <th key={c.head} style={{ textAlign: 'left', padding: '4px 10px 8px', fontWeight: 700, color: C.brandDark, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{c.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERSONS.map((p, i) => (
            <tr key={p} style={{ borderTop: `1px solid ${C.line}` }}>
              <td style={{ padding: '6px 8px 6px 0', color: C.muted, fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{p}</td>
              {cols.map(c => (
                <td key={c.head} style={{ padding: '6px 10px', color: C.ink, fontFamily: MONO, whiteSpace: 'nowrap' }}>{c.forms[i]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const SubHead = ({ children }) => (
  <div style={{ fontSize: '0.66rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '1.1rem 0 8px' }}>{children}</div>
);

export default function VerbCardES({ tense, onOpenExplainer }) {
  const simpleCols = tense.kind === 'simple'
    ? [
        { head: 'hablar', forms: tense.regular.hablar },
        { head: 'comer', forms: tense.regular.comer },
        { head: 'vivir', forms: tense.regular.vivir },
      ]
    : [{ head: tense.aux.verb, forms: tense.aux.forms }];

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      {/* header */}
      <div style={{ background: PG, padding: '0.9rem 1.1rem', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{tense.name}</span>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', fontWeight: 600 }}>· {tense.enName}</span>
        </div>
        <div style={{ marginTop: 7, background: 'rgba(255,255,255,0.16)', borderRadius: 9, padding: '0.45rem 0.65rem', fontSize: '0.78rem' }}>
          {tense.formation}
        </div>
      </div>

      <div style={{ padding: '1.1rem' }}>

        {/* the English gloss — the whole point */}
        <div style={{ background: C.chipBg, border: `1px solid #d6ddfb`, borderRadius: 10, padding: '0.7rem 0.85rem', color: C.ink, fontSize: '0.88rem', lineHeight: 1.55 }}>
          {renderMd(tense.gloss)}
        </div>

        {/* regular / aux table */}
        <SubHead>{tense.kind === 'compound' ? `The auxiliary — ${tense.aux.verb}` : 'Regular verbs'}</SubHead>
        <ConjTable cols={simpleCols} />

        {tense.kind === 'compound' && (
          <div style={{ marginTop: 10, background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: 9, padding: '0.55rem 0.7rem' }}>
            <span style={{ color: C.good, fontWeight: 700, fontSize: '0.8rem' }}>+ {tense.complement || 'participio'}&nbsp;&nbsp;</span>
            <span style={{ color: C.ink, fontFamily: MONO, fontSize: '0.86rem' }}>{tense.participle}</span>
            {tense.participleNote && (
              <div style={{ color: C.slate, fontSize: '0.78rem', marginTop: 5 }}>{tense.participleNote}</div>
            )}
          </div>
        )}

        {/* irregular participles / gerunds (compound tenses) */}
        {tense.irregularParticiples && (
          <>
            <SubHead>{tense.irregularFormsLabel || 'Irregular participles'}</SubHead>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tense.irregularParticiples.map(([inf, part]) => (
                <span key={inf} style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '3px 9px', fontSize: '0.78rem' }}>
                  <span style={{ color: C.muted }}>{inf} → </span>
                  <span style={{ color: C.ink, fontFamily: MONO, fontWeight: 600 }}>{part}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {/* irregular verb tables (simple tenses) */}
        {tense.irregulars && tense.irregulars.length > 0 && (
          <>
            <SubHead>Key irregulars</SubHead>
            <ConjTable cols={tense.irregulars.map(v => ({ head: v.verb, forms: v.forms }))} />
          </>
        )}

        {/* pattern note */}
        {tense.irregularNote && (
          <div style={{ marginTop: 12, background: '#fbfbfd', border: `1px solid ${C.line}`, borderRadius: 9, padding: '0.6rem 0.8rem', color: C.slate, fontSize: '0.83rem', lineHeight: 1.55 }}>
            {renderMd(tense.irregularNote)}
          </div>
        )}

        {/* watch out */}
        <div style={{ marginTop: '1rem', background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
          <span style={{ fontWeight: 700, color: C.warnInk, fontSize: '0.76rem' }}>👁️ Watch out · </span>
          <span style={{ color: C.warnInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{renderMd(tense.watchOut)}</span>
        </div>

        {/* cross-link to the Spanish Tense Explainer */}
        {onOpenExplainer && (
          <div style={{ marginTop: '1rem', borderTop: `1px solid ${C.line}`, paddingTop: '0.9rem' }}>
            <button onClick={onOpenExplainer}
              style={{ background: 'white', color: C.brandDark, border: `1.5px solid ${C.brand}`, borderRadius: 10, padding: '0.6rem 1rem', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', width: '100%' }}>
              📖 When do I use each tense? → Tense Explainer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
