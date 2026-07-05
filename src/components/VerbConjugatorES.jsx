import { useState } from 'react';
import { tensesByGroup, GROUP_LABEL } from '../lib/verbConjugatorEs.js';
import VerbCardES from './VerbCardES';

/* ============================================================
   Verb Conjugator 🇪🇸 — Learn reference (Spanish track)
   For native-English learners of Spanish. A conjugation cheat
   sheet: the regular -ar / -er / -ir tables, the key irregulars,
   and — the point — a plain-English gloss anchoring each Spanish
   tense to the English one the learner already knows. Content +
   structure come from src/lib/verbConjugatorEs.js. Sibling to the
   Spanish Tense Explainer (tables here, "when to use it" there);
   the two cross-link. Peninsular throughout (tú + vosotros).
   ============================================================ */

const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
};

export default function VerbConjugatorES({ onOpenExplainer }) {
  const [openId, setOpenId] = useState(null);
  const groups = tensesByGroup();

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink }}>🔤 Verb Conjugator 🇪🇸</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: 2 }}>The Spanish verb tables, with a plain-English note on what each tense means — tap one to open it.</div>
        </div>

        {groups.map(g => (
          <div key={g.group} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>{GROUP_LABEL[g.group]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {g.items.map(t => {
                const open = openId === t.id;
                return (
                  <div key={t.id}>
                    {open ? (
                      <VerbCardES tense={t} onOpenExplainer={onOpenExplainer} />
                    ) : (
                      <button onClick={() => setOpenId(t.id)}
                        style={{ width: '100%', textAlign: 'left', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.95rem' }}>{t.name}</span>
                            <span style={{ color: C.faint, fontSize: '0.75rem', fontWeight: 600 }}>{t.enName}</span>
                          </span>
                          <span style={{ display: 'block', color: C.muted, fontSize: '0.78rem', marginTop: 2, fontStyle: 'italic' }}>{t.anchor}</span>
                        </span>
                        <span style={{ color: C.faint, fontSize: '1.1rem', flexShrink: 0 }}>›</span>
                      </button>
                    )}
                    {open && (
                      <button onClick={() => setOpenId(null)}
                        style={{ display: 'block', margin: '0.4rem auto 0', background: 'transparent', border: 'none', color: C.faint, fontSize: '0.78rem', cursor: 'pointer' }}>
                        Close ⌃
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
