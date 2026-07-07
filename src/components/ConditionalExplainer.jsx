import { useState } from 'react';
import { conditionalsForLevel, levelBand, BAND_ORDER, GROUP_ORDER, GROUP_LABEL } from '../lib/conditionalExplainEn.js';
import ConditionalCard from './ConditionalCard';

/* ============================================================
   Conditionals Explainer 📘 — standalone Learn reference (English)
   A cheat sheet, not a class: every conditional with its formula,
   when you use it (signal words + handcrafted examples), the
   negative woven into each card, and the watch-out traps. Content
   + structure come from the shared src/lib/conditionalExplainEn.js
   (the same source the Chooser's 📖 overlay reads). Default view =
   the student's band; a toggle reveals the full ladder. "Practise
   in Conditionals Chooser" hands off via the onPractise prop.
   ============================================================ */

const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
};

export default function ConditionalExplainer({ profile, onPractise }) {
  const studentLevel = profile?.level || 'B1';
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState(null);

  const myBand = levelBand(studentLevel);
  const list = conditionalsForLevel(studentLevel, showAll);

  const groups = GROUP_ORDER.map(g => ({
    group: g,
    items: list.filter(c => c.group === g),
  })).filter(g => g.items.length);

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink }}>📘 Conditionals Explainer</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: 2 }}>Real, unreal and mixed — tap a conditional to open it.</div>
        </div>

        {groups.map(g => (
          <div key={g.group} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>{GROUP_LABEL[g.group]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {g.items.map(c => {
                const ahead = BAND_ORDER.indexOf(c.band) > BAND_ORDER.indexOf(myBand);
                const open = openId === c.id;
                return (
                  <div key={c.id}>
                    {open ? (
                      <ConditionalCard card={c} onPractise={onPractise} />
                    ) : (
                      <button onClick={() => setOpenId(c.id)}
                        style={{ width: '100%', textAlign: 'left', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.95rem' }}>{c.name}</span>
                            {ahead && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#c05621', background: '#fffaf0', borderRadius: 8, padding: '1px 6px' }}>{c.band}</span>}
                          </span>
                          <span style={{ display: 'block', color: C.muted, fontSize: '0.78rem', marginTop: 2 }}>{c.use}</span>
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

        <button onClick={() => setShowAll(v => !v)}
          style={{ width: '100%', background: 'white', border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '0.75rem', color: C.brandDark, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.25rem' }}>
          {showAll ? 'Show only my level' : 'Show all conditionals ›'}
        </button>
        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.72rem', marginTop: '0.6rem' }}>
          {showAll ? 'Showing every conditional — those above your level are tagged.' : `Showing the conditionals for your level (${myBand}).`}
        </div>

      </div>
    </div>
  );
}
