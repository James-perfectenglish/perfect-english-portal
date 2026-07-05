import { useState, Fragment } from 'react';
import { FORMS, GROUPS_EN, VERB_COUNT } from '../lib/irregularVerbsEn.js';

/* ============================================================
   Irregular Verbs 📚 — Learn reference (English track)
   For English (ESL) learners. The three principal parts of the core
   ~100 irregular verbs, grouped by pattern (easy → hard), with a
   forms-explainer up top on WHEN each form fires — the key point
   being that the past participle never stands alone (perfect +
   passive), which is why "I have went" is wrong. Content + structure
   come from src/lib/irregularVerbsEn.js. Sibling to the English
   Tense Explainer (the forms here, "when to use each tense" there);
   the two cross-link. British English throughout.
   ============================================================ */

const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  chipBg: '#eef2ff',
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

function VerbTable({ verbs }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
      <thead>
        <tr>
          {['base', 'past simple', 'past participle'].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '2px 10px 8px 0', fontSize: '0.62rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {verbs.map(([base, past, pp, note], i) => (
          <Fragment key={base}>
            <tr style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
              <td style={{ padding: note ? '7px 10px 2px 0' : '7px 10px 7px 0', color: C.ink, fontFamily: MONO, fontWeight: 700 }}>{base}</td>
              <td style={{ padding: note ? '7px 10px 2px' : '7px 10px', color: C.ink, fontFamily: MONO }}>{past}</td>
              <td style={{ padding: note ? '7px 10px 2px' : '7px 10px', color: C.brandDark, fontFamily: MONO, fontWeight: 600 }}>{pp}</td>
            </tr>
            {note && (
              <tr>
                <td colSpan={3} style={{ padding: '0 0 8px', color: C.muted, fontSize: '0.74rem', lineHeight: 1.45 }}>
                  <span style={{ color: C.faint }}>ⓘ </span>{renderMd(note)}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export default function IrregularVerbsEN({ onOpenExplainer }) {
  const [openId, setOpenId] = useState('three_diff'); // open the important group by default

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink }}>⏳ Irregular Verbs Past</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: 2 }}>The {VERB_COUNT} essential irregular verbs, grouped by pattern — and what each of the three forms is for.</div>
        </div>

        {/* forms explainer — the three principal parts, always visible */}
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>The three forms</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {FORMS.map(f => (
            <div key={f.key} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ background: PG, padding: '0.55rem 0.9rem', color: 'white', display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{f.label}</span>
                <span style={{ fontFamily: MONO, fontSize: '0.82rem', color: 'rgba(255,255,255,0.85)' }}>({f.example})</span>
              </div>
              <div style={{ padding: '0.7rem 0.9rem', color: C.ink, fontSize: '0.86rem', lineHeight: 1.55 }}>
                {renderMd(f.usedFor)}
              </div>
            </div>
          ))}
        </div>

        {/* pattern groups — accordion of tables */}
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>By pattern</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {GROUPS_EN.map(g => {
            const open = openId === g.id;
            return (
              <div key={g.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setOpenId(open ? null : g.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.95rem' }}>{g.title}</span>
                      <span style={{ color: C.faint, fontSize: '0.72rem', fontWeight: 600 }}>{g.verbs.length}</span>
                    </span>
                  </span>
                  <span style={{ color: C.faint, fontSize: '1.1rem', flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                </button>
                {open && (
                  <div style={{ padding: '0 1rem 1rem' }}>
                    <div style={{ color: C.slate, fontSize: '0.83rem', lineHeight: 1.5, marginBottom: 12 }}>{renderMd(g.blurb)}</div>
                    <VerbTable verbs={g.verbs} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* cross-link to the English Tense Explainer */}
        {onOpenExplainer && (
          <div style={{ marginTop: '1.25rem' }}>
            <button onClick={onOpenExplainer}
              style={{ background: 'white', color: C.brandDark, border: `1.5px solid ${C.brand}`, borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}>
              📖 See these forms in tenses → Tense Explainer
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
