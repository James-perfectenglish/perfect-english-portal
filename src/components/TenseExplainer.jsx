import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { tensesForLevel, levelBand, BAND_ORDER } from '../lib/tenseExplainEn.js';

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

const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
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
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* highlight any signal words found inside a curated example */
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

/* schematic past–now–future timeline, positioned by time and shaped by aspect */
function TenseTimeline({ time, aspect }) {
  const W = 260, H = 34, mid = 22, nowX = 150;
  const pos = { present: 150, past: 72, future: 214 }[time];
  let shape;
  if (aspect === 'simple') {
    shape = <circle cx={pos} cy={mid} r="5" fill={C.brand} />;
  } else if (aspect === 'continuous') {
    shape = <rect x={pos - 26} y={mid - 5} width="52" height="10" rx="5" fill={C.band} />;
  } else { /* perfect / perfect continuous: action completed by the reference point */
    shape = <g><rect x={pos - 52} y={mid - 5} width="52" height="10" rx="5" fill={C.band} /><circle cx={pos} cy={mid} r="5" fill={C.brand} /></g>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: 'block' }} aria-hidden="true">
      <line x1="8" y1={mid} x2={W - 8} y2={mid} stroke={C.line} strokeWidth="2" />
      <line x1={nowX} y1={mid - 9} x2={nowX} y2={mid + 9} stroke={C.faint} strokeWidth="1" strokeDasharray="2 2" />
      {shape}
      <text x="8" y="11" fontSize="9" fill={C.faint}>past</text>
      <text x={nowX - 9} y="11" fontSize="9" fill={C.brand} fontWeight="700">now</text>
      <text x={W - 32} y="11" fontSize="9" fill={C.faint}>future</text>
    </svg>
  );
}

function TenseCard({ tense, ahead, onPractise }) {
  const [ex, setEx] = useState({ rows: [], idx: -1, loading: false, done: false });

  async function showAnother() {
    // advance within the cached pool if we have one
    if (ex.rows.length && ex.idx + 1 < ex.rows.length) {
      setEx(e => ({ ...e, idx: e.idx + 1 }));
      return;
    }
    setEx(e => ({ ...e, loading: true }));
    const sLvl = levelBand(tense._studentLevel);
    const exLvl = BAND_ORDER.indexOf(sLvl) >= BAND_ORDER.indexOf(tense.band) ? sLvl : tense.band;
    try {
      const { data, error } = await supabase
        .from('tense_specimens')
        .select('sentence')
        .eq('language', 'en')
        .eq('level', exLvl)
        .eq('answer->>time', tense.time)
        .eq('answer->>aspect', tense.aspect)
        .eq('answer->>voice', tense.voice)
        .limit(30);
      if (error) throw error;
      const rows = shuffle((data || []).map(r => r.sentence));
      setEx({ rows, idx: rows.length ? 0 : -1, loading: false, done: rows.length === 0 });
    } catch {
      setEx({ rows: [], idx: -1, loading: false, done: true });
    }
  }

  const current = ex.idx >= 0 ? ex.rows[ex.idx] : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ background: PG, padding: '0.9rem 1.1rem', color: 'white' }}>
        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{tense.name}</div>
        <div style={{ marginTop: 7, background: 'rgba(255,255,255,0.16)', borderRadius: 9, padding: '0.45rem 0.65rem', fontSize: '0.85rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {tense.formula}
        </div>
      </div>

      <div style={{ padding: '1.1rem' }}>
        <div style={{ marginBottom: '1rem' }}><TenseTimeline time={tense.time} aspect={tense.aspect} /></div>

        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>When you use it</div>
        {tense.uses.map((u, i) => (
          <div key={i} style={{ marginBottom: i < tense.uses.length - 1 ? '0.9rem' : 0 }}>
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

        <div style={{ marginTop: '1rem', background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
          <span style={{ fontWeight: 700, color: C.warnInk, fontSize: '0.76rem' }}>👁️ Watch out · </span>
          <span style={{ color: C.warnInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{tense.watchOut}</span>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {current && (
            <div style={{ background: '#fff', border: `1px dashed ${C.line}`, borderRadius: 9, padding: '0.55rem 0.7rem', marginBottom: 8 }}>
              <div style={{ fontSize: '0.64rem', color: C.faint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>From the bank · at your level</div>
              <div style={{ color: C.ink, fontSize: '0.9rem' }}>{current}</div>
            </div>
          )}
          {ex.done && !current && (
            <div style={{ fontSize: '0.78rem', color: C.faint, marginBottom: 8 }}>No bank examples for this one yet.</div>
          )}
          {!ex.done && (
            <button onClick={showAnother} disabled={ex.loading}
              style={{ background: 'white', color: C.brandDark, border: `1.5px solid ${C.brand}`, borderRadius: 9, padding: '0.45rem 0.85rem', fontWeight: 600, fontSize: '0.8rem', cursor: ex.loading ? 'default' : 'pointer' }}>
              {ex.loading ? 'Finding one…' : current ? '🔄 Show another' : '🔄 Show me a real example'}
            </button>
          )}
        </div>

        {onPractise && (
          <div style={{ marginTop: '1rem', borderTop: `1px solid ${C.line}`, paddingTop: '0.9rem' }}>
            <button onClick={() => onPractise({ time: tense.time, aspect: tense.aspect, voice: tense.voice, name: tense.name })}
              style={{ background: PG, color: 'white', border: 'none', borderRadius: 10, padding: '0.7rem 1rem', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', width: '100%' }}>
              ✏️ Practise this in Tense Tagger →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
