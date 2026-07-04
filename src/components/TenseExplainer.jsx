import { useState } from 'react';
import { tensesForLevel, levelBand, BAND_ORDER } from '../lib/tenseExplainEn.js';
import TenseCard from './TenseCard';

/* ============================================================
   Tense Explainer 📖 — standalone Learn reference (English)
   A cheat sheet, not a class: every tense with its formula, when
   you use it (with signal words + a handcrafted example), and one
   "watch out" line. Content + structure come from the shared
   src/lib/tenseExplainEn.js (same source the Tagger can read).
   Default view = the student's band; a toggle reveals the full
   ladder. "Show another" streams a real, level-matched sentence
   from the tense_specimens bank; "Practise this" hands off to the
   Tagger filtered to the tense (via the onPractise prop).
   ============================================================ */

const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  warnInk: '#92400e', warnBg: '#fffbeb', warnLine: '#f59e0b',
  chipBg: '#eef2ff', mark: '#fef3c7', band: '#c3dafe',
};

const TIME_ORDER = ['present', 'past', 'future'];
const TIME_LABEL = { present: 'Present', past: 'Past', future: 'Future' };
const ASPECT_RANK = { simple: 0, continuous: 1, perfect: 2, perfect_continuous: 3 };

/* TenseCard (+ the timeline and signal-word helpers) lives in ./TenseCard.jsx —
   shared with the "📖 See the full card" overlay in Tense Tagger. */

export default function TenseExplainer({ profile, onPractise }) {
  const studentLevel = profile?.level || 'B1';
  const [showAll, setShowAll] = useState(false);
  const [openKey, setOpenKey] = useState(null);

  const myBand = levelBand(studentLevel);
  const list = tensesForLevel(studentLevel, showAll).map(t => ({ ...t, _studentLevel: studentLevel }));

  const groups = TIME_ORDER.map(time => ({
    time,
    items: list
      .filter(t => t.time === time)
      .sort((a, b) => (a.voice === b.voice ? ASPECT_RANK[a.aspect] - ASPECT_RANK[b.aspect] : (a.voice === 'active' ? -1 : 1))),
  })).filter(g => g.items.length);

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: C.ink }}>📖 Tense Explainer</div>
          <div style={{ color: C.muted, fontSize: '0.85rem', marginTop: 2 }}>Your quick reference for every tense — tap one to open it.</div>
        </div>

        {groups.map(g => (
          <div key={g.time} style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '0 4px 8px' }}>{TIME_LABEL[g.time]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {g.items.map(t => {
                const ahead = BAND_ORDER.indexOf(t.band) > BAND_ORDER.indexOf(myBand);
                const open = openKey === t.key;
                return (
                  <div key={t.key}>
                    {open ? (
                      <TenseCard tense={t} ahead={ahead} onPractise={onPractise} />
                    ) : (
                      <button onClick={() => setOpenKey(t.key)}
                        style={{ width: '100%', textAlign: 'left', background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 10 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: C.ink, fontSize: '0.95rem' }}>{t.name}</span>
                            {ahead && <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#c05621', background: '#fffaf0', borderRadius: 8, padding: '1px 6px' }}>{t.band}</span>}
                          </span>
                          <span style={{ display: 'block', color: C.muted, fontSize: '0.78rem', marginTop: 2 }}>{t.use}</span>
                        </span>
                        <span style={{ color: C.faint, fontSize: '1.1rem', flexShrink: 0 }}>›</span>
                      </button>
                    )}
                    {open && (
                      <button onClick={() => setOpenKey(null)}
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
          {showAll ? 'Show only my level' : 'Show all tenses ›'}
        </button>
        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.72rem', marginTop: '0.6rem' }}>
          {showAll ? 'Showing every tense — those above your level are tagged.' : `Showing the tenses for your level (${myBand}).`}
        </div>

      </div>
    </div>
  );
}
