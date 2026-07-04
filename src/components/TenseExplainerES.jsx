import { useState } from 'react';
import { tensesByGroup, GROUP_LABEL } from '../lib/tenseExplainEs.js';
import TenseCardES from './TenseCardES';

/* ============================================================
   Tense Explainer 📖 🇪🇸 — Learn reference (Spanish track)
   For native-English learners of Spanish. A cheat sheet, not a
   class: the four tenses with their formula, when to use them
   (Spanish signal words + a handcrafted example), and one English-
   speaker "watch out" line. Content + structure come from the shared
   src/lib/tenseExplainEs.js. "Show another" streams a real, level-
   matched sentence from the tense_specimens bank (language='es');
   "Practise this" hands off to TenseTaggerES filtered to the tense.
   ============================================================ */

const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  warnInk: '#92400e', warnBg: '#fffbeb', warnLine: '#f59e0b',
  chipBg: '#eef2ff', mark: '#fef3c7', band: '#c3dafe',
};

/* TenseCardES (+ the timeline and signal-word helpers) lives in ./TenseCardES.jsx —
   shared with the "📖 See the full card" overlay in the Spanish Tense Tagger. */

export default function TenseExplainerES({ profile, onPractise }) {
  const studentLevel = profile?.level || 'B1';
  const [openId, setOpenId] = useState(null);
  const groups = tensesByGroup();

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink }}>📖 Tense Explainer 🇪🇸</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: 2 }}>Your quick reference for the Spanish tenses — tap one to open it.</div>
        </div>

        {groups.map(g => (
          <div key={g.group} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>{GROUP_LABEL[g.group]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {g.items.map(t => {
                const tense = { ...t, _studentLevel: studentLevel };
                const open = openId === t.id;
                return (
                  <div key={t.id}>
                    {open ? (
                      <TenseCardES tense={tense} onPractise={onPractise} />
                    ) : (
                      <button onClick={() => setOpenId(t.id)}
                        style={{ width: '100%', textAlign: 'left', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.95rem' }}>{t.name}</span>
                          <span style={{ display: 'block', color: C.muted, fontSize: '0.78rem', marginTop: 2 }}>{t.use}</span>
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
