import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { makeES, TENSES, TIEMPO_LABEL, TIEMPO_ES, startLevel } from '../lib/tenseEngineEs.js';
import { findByTiempo } from '../lib/tenseExplainEs.js';
import SentenceChallenge from './SentenceChallenge';
import ExplainerOverlay from './ExplainerOverlay';
import TenseCardES from './TenseCardES';

/* ============================================================
   Tense Tagger 🏷️ — Spanish track (native-English learners of Spanish)
   A different engine from the English version: a conjugator, not an
   auxiliary chain. Single axis (Tiempo) across four tenses — the
   pretérito/imperfecto and presente/presente-continuo contrasts.
   Specimens are served from the tense_specimens bank (pre-generated
   and AI-filtered) via the tense_specimen_deck RPC, with the live
   conjugator as the offline fallback. Recognition attempts write to
   tense_attempts (language='es', axis 'tiempo'); production runs
   through the shared SentenceChallenge sheet (type or 🎙️ voice input),
   marked by the AI (mark-free.js, type:'tense', language:'es') and
   harvested to sc_sentences with the real input method. On an AI
   outage nothing is persisted and the student simply retries (SC's
   app-wide convention). This component owns the star row (SC runs
   noStars). A2/B1 only; futuro is a fast-follow.

   The conjugation engine lives in src/lib/tenseEngineEs.js, shared
   with scripts/generate_tense_specimens.mjs (the bank builder).
   ============================================================ */

/* ---------- palette (matches the app / English Tense Tagger) ---------- */
const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  bad: '#c53030', badBg: '#fff5f5', badLine: '#e53e3e',
  mark: '#fef3c7',
};

// production scaffold: the form of each tense + a one-line use note (shown in produce mode)
const FORMULAS_ES = {
  presente:          { formula: 'stem + -o, -as, -a, -amos, -áis, -an  (hablo, comes, vive)', use: 'habits and general facts' },
  presente_continuo: { formula: 'estar + gerundio  (estoy hablando, está comiendo)', use: 'an action happening right now' },
  preterito:         { formula: 'stem + -é, -aste, -ó…  (hablé, comió)', use: 'a completed, finished past action' },
  imperfecto:        { formula: 'stem + -aba / -ía…  (hablaba, comía)', use: 'an ongoing or habitual past action' },
};

/* ---------- small UI bits (shared look with the English tagger) ---------- */
function chipStyle(state) {
  const map = {
    idle: { background: 'white', color: C.slate, border: `1.5px solid ${C.line}` },
    selected: { background: C.brand, color: 'white', border: `1.5px solid ${C.brand}` },
    correct: { background: C.goodBg, color: C.good, border: `1.5px solid ${C.goodLine}` },
    wrong: { background: C.badBg, color: C.bad, border: `1.5px solid ${C.badLine}` },
    answer: { background: 'white', color: C.good, border: `1.5px solid ${C.goodLine}` },
  }[state];
  return {
    ...map, padding: '0.5rem 0.85rem', borderRadius: '9px', fontSize: '0.78rem',
    fontWeight: 600, letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 0.12s',
  };
}
const cardStyle = { background: C.card, border: `1px solid ${C.line}`, borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' };
const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px' };

function StatusPill({ tone, children }) {
  const t = {
    ai: { bg: '#EDE9FE', fg: '#553C9A', bd: '#C4B5FD' },
    good: { bg: C.goodBg, fg: C.good, bd: C.goodLine },
    bad: { bg: C.badBg, fg: C.bad, bd: C.badLine },
    warn: { bg: '#fffaf0', fg: '#b7791f', bd: '#f6e05e' },
  }[tone] || { bg: '#edf2f7', fg: C.slate, bd: C.line };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '4px 12px',
      borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
      background: t.bg, color: t.fg, border: `1px solid ${t.bd}`,
    }}>{children}</span>
  );
}

/* ---------- component ---------- */
export default function TenseTaggerES({ profile, initialTense = null }) {
  const lockedInit = initialTense?.tiempo || null;
  const [lockedTiempo, setLockedTiempo] = useState(() => lockedInit);
  const [level, setLevel] = useState(() => startLevel(profile));
  const [item, setItem] = useState(() => makeES(startLevel(profile), lockedInit));
  const [phase, setPhase] = useState('tag'); // tag | produce | done
  const [pick, setPick] = useState(null);
  const [graded, setGraded] = useState(false);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);

  // Specimen bank: a shuffled deck of pre-generated, AI-filtered rows for the
  // current level, refilled in the background. Falls back to the live conjugator
  // whenever the bank is empty or unreachable, so the exercise never blocks.
  const deckRef = useRef([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const lockedRef = useRef(lockedTiempo);
  lockedRef.current = lockedTiempo;

  const bankRowToItem = (row) => ({
    sentence: row.pre + row.vp + row.post,
    pre: row.pre, vp: row.vp, post: row.post, tense: row.answer.tiempo,
  });

  async function loadDeck(lvl) {
    try {
      const lock = lockedRef.current;
      let rows;
      if (lock) {
        // locked "Practise this" mode — a tense-filtered deck straight from the bank
        const { data, error } = await supabase
          .from('tense_specimens')
          .select('pre,vp,post,answer')
          .eq('language', 'es').eq('level', lvl)
          .eq('answer->>tiempo', lock)
          .limit(40);
        if (error || !Array.isArray(data) || lvl !== levelRef.current || lock !== lockedRef.current) return;
        rows = data.slice().sort(() => Math.random() - 0.5);
      } else {
        const { data, error } = await supabase.rpc('tense_specimen_deck',
          { p_language: 'es', p_level: lvl, p_limit: 40 });
        if (error || !Array.isArray(data) || lvl !== levelRef.current || lockedRef.current) return;
        rows = data;
      }
      deckRef.current = deckRef.current.concat(rows.map(bankRowToItem));
    } catch { /* offline — the live conjugator fallback covers it */ }
  }

  useEffect(() => { deckRef.current = []; loadDeck(level); }, [level, lockedTiempo]);

  function drawES(lvl) {
    if (deckRef.current.length) {
      const it = deckRef.current.shift();
      if (deckRef.current.length < 8) loadDeck(lvl);   // refill in the background
      return it;
    }
    return makeES(lvl, lockedTiempo);                   // bank empty/offline → live engine (on-tense when locked)
  }

  const label = TIEMPO_LABEL[item.tense];
  const correct = graded && pick === item.tense;

  function reset(toLevel = level) {
    setItem(drawES(toLevel)); setPhase('tag'); setPick(null);
    setGraded(false); setDraft(''); setProd(null); setShowCard(false);
  }
  function changeLevel(l) { deckRef.current = []; setLevel(l); reset(l); }

  function clearLock() {
    const lvl = startLevel(profile);
    lockedRef.current = null;
    deckRef.current = [];
    setLockedTiempo(null);
    setLevel(lvl);
    setItem(makeES(lvl));
    setPhase('tag'); setPick(null); setGraded(false); setDraft(''); setProd(null); setShowCard(false);
  }

  async function logAttempt() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ok = pick === item.tense;
      await supabase.from('tense_attempts').insert({
        student_id: user.id, language: 'es', level,
        sentence: item.sentence, verb_phrase: item.vp,
        answer: { tiempo: item.tense }, picks: { tiempo: pick },
        is_correct: ok, is_mismatch: false,
        function_answer: null, function_picked: null,
      });
    } catch (e) { console.warn('TenseTaggerES: tense_attempts insert failed', e); }
  }

  async function awardStar(sentence, aiFeedback, inputMethod = 'text') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('stars').insert({
        student_id: user.id, source: 'tense_tagger', subtype: 'production',
        context: { tense: TIEMPO_ES[item.tense], sentence, language: 'es', level, input_method: inputMethod, ai_feedback: aiFeedback || '' },
      });
      if (error && error.code !== '23505') console.warn('TenseTaggerES: could not save star:', error);
    } catch (e) { console.warn('TenseTaggerES: could not save star:', e); }
  }

  // Harvest every production submission (pass AND fail), like every other record surface.
  async function harvestSentence(sentence, isCorrect, aiFeedback, inputMethod = 'text') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'tense_tagger', target: TIEMPO_ES[item.tense], sentence,
        is_correct: isCorrect, ai_feedback: aiFeedback || null,
        input_method: inputMethod, language: 'es', level,
      });
      if (error) console.warn('TenseTaggerES: sc_sentences insert failed', error);
    } catch (e) { console.warn('TenseTaggerES: sc_sentences insert failed', e); }
  }

  function checkTag() {
    if (!pick) return;
    setGraded(true);
    const ok = pick === item.tense;
    logAttempt();
    if (ok) { setTagged(n => n + 1); setPhase('produce'); }
  }

  // Production now runs through the shared SentenceChallenge sheet (type or
  // 🎙️ voice input; AI marking via mark-free.js type:'tense', language:'es').
  // SC persists no star itself (noStars) — this component keeps ownership of
  // the star row and the sc_sentences harvest, now with the real input method.
  async function handleSCResult({ sentence, inputMethod, result }) {
    const ok = result?.valid === true;
    const feedback = result?.feedback || result?.reason || '';
    setDraft(sentence);
    setProd({ ok, layer: 'ai', feedback });
    await harvestSentence(sentence, ok, feedback, inputMethod);
    if (ok) {
      await awardStar(sentence, feedback, inputMethod);
      setStars(s => s + 1);
    }
  }

  // Sheet closed: a passed sentence advances to the star screen; anything else
  // (fail-and-close, backdrop dismiss) deals a fresh specimen — old Skip semantics.
  function handleSCClose() {
    if (prod?.ok) setPhase('done');
    else reset();
  }

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ ...labelStyle, color: C.muted, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Tense Tagger 🏷️ 🇪🇸
          </div>
          <div style={{ color: C.brandDark, fontWeight: 700, fontSize: '0.95rem' }}>⭐️ {stars}</div>
        </div>

        {/* level pills (normal) OR locked-tense strip ("Practise this") */}
        {lockedTiempo ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: '999px', padding: '0.3rem 0.4rem 0.3rem 0.9rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.brandDark }}>
              Practising: {TIEMPO_LABEL[lockedTiempo]}
            </span>
            <button onClick={clearLock} style={{
              padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', background: 'white', color: C.brandDark, border: '1px solid #C4B5FD',
            }}>← all tenses</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            {['A2', 'B1'].map(l => (
              <button key={l} onClick={() => changeLevel(l)} style={{
                padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
                letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.12s',
                background: level === l ? C.ink : 'transparent', color: level === l ? 'white' : C.muted,
                border: `1px solid ${level === l ? C.ink : C.line}`,
              }}>{l}</button>
            ))}
          </div>
        )}

        {/* specimen */}
        <div style={{ ...cardStyle, padding: '1.5rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>Sentence</div>
          <p style={{ fontSize: '1.4rem', lineHeight: 1.45, color: C.ink, margin: 0, fontWeight: 400 }}>
            {item.pre}
            <span style={{ background: C.mark, padding: '1px 5px', borderRadius: '5px', fontWeight: 700 }}>{item.vp}</span>
            {item.post}
          </p>
        </div>

        {/* TAG phase */}
        {phase === 'tag' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>🏷️ Which tense is the verb?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: graded ? '0.75rem' : '1rem' }}>
              {TENSES.map(t => {
                const picked = pick === t;
                let state = picked ? 'selected' : 'idle';
                if (graded) {
                  if (t === item.tense) state = picked ? 'correct' : 'answer';
                  else if (picked) state = 'wrong';
                }
                return (
                  <button key={t} disabled={graded} onClick={() => setPick(t)} style={chipStyle(state)}>
                    {TIEMPO_LABEL[t]}{state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✕' : ''}
                  </button>
                );
              })}
            </div>

            {!graded && (
              <button onClick={checkTag} disabled={!pick} style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: pick ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: pick ? 'pointer' : 'not-allowed',
              }}>Check</button>
            )}

            {graded && !correct && (
              <div>
                <div style={{ color: C.bad, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  Not quite — the answer is in green. This one is the <b>{label}</b>.
                </div>
                {findByTiempo(item.tense) && (
                  <button onClick={() => setShowCard(true)} style={{
                    width: '100%', padding: '0.7rem', borderRadius: '10px', marginBottom: '0.5rem',
                    background: 'white', color: C.brandDark, border: '1px solid #C4B5FD',
                    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  }}>📖 See the full card</button>
                )}
                <button onClick={() => reset()} style={{
                  width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                  background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                }}>↻ New sentence</button>
              </div>
            )}
          </div>
        )}

        {/* recognition success banner */}
        {correct && phase !== 'tag' && (
          <div style={{
            background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: '12px',
            color: C.good, fontSize: '0.9rem', padding: '0.75rem 1rem', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap',
          }}>
            <span>✅ Tagged correctly — <b>{label}</b>.</span>
            {findByTiempo(item.tense) && (
              <button onClick={() => setShowCard(true)} style={{
                background: 'white', color: C.brandDark, border: '1px solid #C4B5FD', borderRadius: 8,
                padding: '0.35rem 0.7rem', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0,
              }}>📖 See the full card</button>
            )}
          </div>
        )}

        {/* PRODUCE phase — the shared Sentence Challenge sheet (type / 🎙️ voice) */}
        {phase === 'produce' && (
          <SentenceChallenge
            word={label}
            language="es"
            exercise="tense_tagger"
            apiType="tense"
            apiExtraFields={{ tenseName: TIEMPO_ES[item.tense], level }}
            noStars
            headerLabel="✏️ YOUR TURN — EARN THE STAR"
            promptText={
              <span style={{ color: '#2d3748' }}>
                Write your own Spanish sentence in the:
                {FORMULAS_ES[item.tense] && (
                  <span style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.82rem', color: '#718096', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{FORMULAS_ES[item.tense].formula}</span>
                )}
              </span>
            }
            onMarkResult={handleSCResult}
            onClose={handleSCClose}
          />
        )}

        {/* DONE phase */}
        {phase === 'done' && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>⭐️</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: C.ink, marginBottom: '0.25rem' }}>Star earnt</div>
            <div style={{ color: C.muted, fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              You recognised <i>and</i> produced the {label}.
            </div>
            {prod?.layer === 'ai' && (
              <div style={{ marginBottom: '0.6rem' }}><StatusPill tone="ai">🤖 AI checked</StatusPill></div>
            )}
            {prod?.layer === 'ai' && prod.feedback && (
              <div style={{ color: C.good, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>{prod.feedback}</div>
            )}
            {prod?.layer === 'soft' && (
              <div style={{ marginBottom: '0.75rem' }}><StatusPill tone="warn">⚠️ AI unavailable — star awarded</StatusPill></div>
            )}
            <button onClick={() => reset()} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>↻ New sentence</button>
          </div>
        )}

        {showCard && (() => {
          const tense = findByTiempo(item.tense);
          return tense ? (
            <ExplainerOverlay open onClose={() => setShowCard(false)}>
              <TenseCardES tense={{ ...tense, _studentLevel: profile?.level || 'B1' }} />
            </ExplainerOverlay>
          ) : null;
        })()}

        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {tagged} tagged · {stars} star{stars === 1 ? '' : 's'} earnt
        </div>
      </div>
    </div>
  );
}
