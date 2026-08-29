import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  makeES, TIEMPO_LABEL, TIEMPO_ES, TIEMPO_GROUP, tensesFor, startLevel,
} from '../lib/tenseEngineEs.js';
import {
  presetsForLevelEs, focusForTiempoEs, axisState, focusToJson, normaliseFocus,
} from '../lib/tenseFocus.js';
import { findByTiempo, GROUP_ORDER, GROUP_LABEL } from '../lib/tenseExplainEs.js';
import SentenceChallenge from './SentenceChallenge';
import ExplainerOverlay from './ExplainerOverlay';
import TenseCardES from './TenseCardES';

/* ============================================================
   Tense Tagger 🏷️ 🇪🇸 — Spanish track (native-English learners)
   A different engine from the English version: a conjugator, not an
   auxiliary chain. ONE axis (Tiempo), now across EIGHT tiempos —
   presente, presente continuo, pretérito, imperfecto, pretérito
   perfecto, pluscuamperfecto, futuro and condicional. (The subjuntivo
   is a mood, needs a trigger clause, and is a separate job.)

   Runs the same set-of-10 scaffold as the English tagger: progress
   strip, running score, completion screen, "Next →" on a miss, and
   one production per TIEMPO per visit rather than one per item.

   FOCUS MODE (src/lib/tenseFocus.js) narrows what is being asked, so a
   student drilling pretérito vs imperfecto is not also fielding six
   other tiempos. The chips come from tensesFor(level, focus) — the very
   function that filters the specimen pool — so the options and the pool
   can never disagree. That mattered: the old locked "Practise this"
   mode generated one tiempo but still rendered every chip, which handed
   over the answer.

   ⚠️ DEPLOY ORDER: the tense_specimens bank has rows for the ORIGINAL
   FOUR tiempos only until scripts/generate_tense_specimens.mjs is re-run
   for Spanish. Ship this code FIRST, then rebuild the bank — new bank
   rows would break the previously deployed component, which only knows
   four tiempos. In the meantime missingRef keeps the four newer tiempos
   in rotation from the live conjugator.

   Specimens are served from the bank (pre-generated and AI-filtered)
   with the live conjugator as the offline fallback, so the exercise
   never blocks. Recognition attempts write to tense_attempts
   (language='es', axis 'tiempo', plus the focus rule); production runs
   through the shared SentenceChallenge sheet (type or 🎙️ voice), marked
   by the AI (mark-free.js, type:'tense', language:'es') and harvested to
   sc_sentences. This component owns the star row (SC runs noStars).

   The conjugation engine lives in src/lib/tenseEngineEs.js, shared with
   scripts/generate_tense_specimens.mjs (the bank builder).
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

// production scaffold: the form of each tiempo + a one-line use note.
// Kept in step with formulaByTiempo in src/lib/tenseExplainEs.js.
const FORMULAS_ES = {
  presente:          { formula: 'stem + -o, -as, -a, -amos, -áis, -an  (hablo, comes, vive)', use: 'habits and general facts' },
  presente_continuo: { formula: 'estar + gerundio  (estoy hablando, está comiendo)', use: 'an action happening right now' },
  preterito:         { formula: 'stem + -é, -aste, -ó…  (hablé, comió)', use: 'a completed, finished past action' },
  imperfecto:        { formula: 'stem + -aba / -ía…  (hablaba, comía)', use: 'an ongoing or habitual past action' },
  perfecto:          { formula: 'he / has / ha… + participio  (he hablado, ha comido)', use: 'a past action connected to now' },
  pluscuamperfecto:  { formula: 'había / habías… + participio  (había hablado)', use: 'a past action before another past action' },
  futuro:            { formula: 'infinitive + -é, -ás, -á…  (hablaré, comerás)', use: 'predictions and promises about the future' },
  condicional:       { formula: 'infinitive + -ía, -ías…  (hablaría, comería)', use: 'hypotheticals and polite requests ("would")' },
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
export default function TenseTaggerES({ profile, initialTense = null, classMode = false }) {
  const startLvl = startLevel(profile);

  // "Practise this" from the Explainer arrives as a single tiempo. It becomes a
  // CONTRAST PAIR rather than a lock: pinning the only axis would leave nothing
  // to decide, which is a production drill wearing a recognition costume.
  const [level, setLevel] = useState(startLvl);
  const [focus, setFocus] = useState(() =>
    initialTense?.tiempo
      ? focusForTiempoEs(initialTense.tiempo, tensesFor(startLvl), TIEMPO_GROUP)
      : null);
  const [showPresets, setShowPresets] = useState(false);

  const allowed = tensesFor(level, focus?.tiempo ?? null);

  const [item, setItem] = useState(() => makeES(startLvl,
    tensesFor(startLvl, initialTense?.tiempo
      ? focusForTiempoEs(initialTense.tiempo, tensesFor(startLvl), TIEMPO_GROUP)?.tiempo
      : null)));
  const [phase, setPhase] = useState('tag'); // tag | produce | done | finished
  const [pick, setPick] = useState(null);
  const [graded, setGraded] = useState(false);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);
  // Set-of-10 state — consistent with the English tagger / Modal Match.
  const [qNum, setQNum] = useState(1);
  const [score, setScore] = useState(0);
  // One production per TIEMPO per visit: tiempos already produced this visit
  // skip the produce step. Survives Try Again, level and focus switches;
  // resets on leaving the exercise.
  const seenTensesRef = useRef(new Set());

  // Specimen bank: a shuffled deck of pre-generated, AI-filtered rows for the
  // current level and focus, refilled in the background. Falls back to the live
  // conjugator whenever the bank is empty or unreachable.
  const deckRef = useRef([]);
  const missingRef = useRef([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const bankRowToItem = (row) => ({
    sentence: row.pre + row.vp + row.post,
    pre: row.pre, vp: row.vp, post: row.post, tense: row.answer.tiempo,
  });

  async function loadDeck(lvl, fcs) {
    try {
      const want = tensesFor(lvl, fcs?.tiempo ?? null);
      let rows;
      if (fcs?.tiempo) {
        // focused: a tiempo-filtered deck straight from the bank
        const { data, error } = await supabase
          .from('tense_specimens')
          .select('pre,vp,post,answer')
          .eq('language', 'es').eq('level', lvl)
          .in('answer->>tiempo', want)
          .limit(60);
        if (error || !Array.isArray(data)) return;
        if (lvl !== levelRef.current || fcs !== focusRef.current) return;
        rows = data.slice().sort(() => Math.random() - 0.5);
      } else {
        const { data, error } = await supabase.rpc('tense_specimen_deck',
          { p_language: 'es', p_level: lvl, p_limit: 40 });
        if (error || !Array.isArray(data)) return;
        if (lvl !== levelRef.current || focusRef.current) return;
        rows = data;
      }
      // a bank row for a tiempo the current focus excludes must never appear
      const fresh = rows.map(bankRowToItem).filter(it => want.includes(it.tense));
      // Which tiempos this draw found nothing for. Until the ES bank is rebuilt
      // for the four newer tiempos it will find none of them, and an unfocused
      // set would otherwise serve the original four almost exclusively.
      const present = new Set(fresh.map(it => it.tense));
      missingRef.current = want.filter(t => !present.has(t));
      deckRef.current = deckRef.current.concat(fresh);
    } catch { /* offline — the live conjugator fallback covers it */ }
  }

  useEffect(() => { deckRef.current = []; missingRef.current = []; loadDeck(level, focus); }, [level, focus]);

  /* `want` is the SAME list the chips are built from, so the pool and the
     options are one list by construction. Tiempos the bank has no rows for are
     generated live, in proportion to how many are missing — that keeps the four
     newer tiempos in rotation until the bank is rebuilt, and costs nothing once
     it has been (missingRef empties). */
  function drawES(lvl, fcs, want) {
    const missing = missingRef.current;
    if (missing.length && Math.random() < missing.length / Math.max(want.length, 1)) {
      return makeES(lvl, missing);
    }
    if (deckRef.current.length) {
      const it = deckRef.current.shift();
      if (deckRef.current.length < 8) loadDeck(lvl, fcs);   // refill in the background
      return it;
    }
    return makeES(lvl, want);                               // bank empty/offline → live engine
  }

  const label = TIEMPO_LABEL[item.tense];
  const correct = graded && pick === item.tense;
  const presets = presetsForLevelEs(level);
  const activePreset = presets.find(p =>
    JSON.stringify(normaliseFocus(p.focus)) === JSON.stringify(normaliseFocus(focus)));

  function reset(toLevel = level, toFocus = focus) {
    const want = tensesFor(toLevel, toFocus?.tiempo ?? null);
    setItem(drawES(toLevel, toFocus, want)); setPhase('tag'); setPick(null);
    setGraded(false); setDraft(''); setProd(null); setShowCard(false);
  }
  // Advance the set: next specimen, or the completion screen after 10.
  function advance() {
    if (qNum >= 10) {
      setPhase('finished');
      setGraded(false); setPick(null); setProd(null); setShowCard(false);
      return;
    }
    setQNum(n => n + 1);
    reset();
  }
  // Recognition done: produce only the first time this tiempo is met this
  // visit — otherwise straight on to the next specimen.
  function proceedAfterRecognition() {
    if (!seenTensesRef.current.has(item.tense)) {
      seenTensesRef.current.add(item.tense);
      setPhase('produce');
    } else {
      advance();
    }
  }
  function restartSet() {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setQNum(1); setScore(0); reset();
  }
  function changeLevel(l) {
    deckRef.current = []; missingRef.current = []; levelRef.current = l;
    setLevel(l); setQNum(1); setScore(0); reset(l, focus);
  }
  function applyFocus(f) {
    const nf = normaliseFocus(f);
    deckRef.current = []; missingRef.current = []; focusRef.current = nf;
    setFocus(nf); setShowPresets(false);
    setQNum(1); setScore(0); reset(level, nf);
  }

  async function logAttempt() {
    if (classMode) return; // Class Play: teacher preview writes nothing
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
        focus: focusToJson(focus),   // NULL when unfocused — keeps old rows comparable
      });
    } catch (e) { console.warn('TenseTaggerES: tense_attempts insert failed', e); }
  }

  async function awardStar(sentence, aiFeedback, inputMethod = 'text') {
    if (classMode) return;
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
    if (classMode) return;
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
    if (ok) { setTagged(n => n + 1); setScore(s => s + 1); proceedAfterRecognition(); }
  }

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

  // Sheet closed: a passed sentence goes to the star screen; anything else
  // advances the set — the item was already scored at the tag step.
  function handleSCClose() {
    if (prod?.ok) setPhase('done');
    else advance();
  }

  // chips, grouped when there are enough tiempos in play to warrant it.
  // Groups mirror the Tense Explainer's accordion sections.
  const chipState = axisState(focus, 'tiempo', allowed);
  const chipOpts = chipState.state === 'pinned' ? allowed : chipState.opts;
  const grouped = chipOpts.length > 4;
  const chipGroups = grouped
    ? GROUP_ORDER.map(g => ({ g, items: chipOpts.filter(t => TIEMPO_GROUP[t] === g) })).filter(x => x.items.length)
    : [{ g: null, items: chipOpts }];

  function renderChip(t) {
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

        {/* level pills */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {['A2', 'B1'].map(l => (
            <button key={l} onClick={() => changeLevel(l)} style={{
              padding: '0.35rem 0.9rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600,
              letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.12s',
              background: level === l ? C.ink : 'transparent', color: level === l ? 'white' : C.muted,
              border: `1px solid ${level === l ? C.ink : C.line}`,
            }}>{l}</button>
          ))}
        </div>

        {/* focus strip — what this set is asking about */}
        <div style={{ marginBottom: '1rem' }}>
          <button onClick={() => setShowPresets(v => !v)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            background: focus ? '#EDE9FE' : C.card, border: `1px solid ${focus ? '#C4B5FD' : C.line}`,
            borderRadius: '12px', padding: '0.55rem 0.9rem', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ ...labelStyle, color: C.faint, display: 'block' }}>Focus</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: focus ? C.brandDark : C.ink }}>
                {activePreset ? activePreset.label : focus ? chipOpts.map(t => TIEMPO_LABEL[t]).join(' vs ') : 'All tenses'}
              </span>
            </span>
            <span style={{ color: C.faint, fontSize: '0.8rem', flexShrink: 0 }}>{showPresets ? 'Close ⌃' : 'Change ⌄'}</span>
          </button>

          {showPresets && (
            <div style={{ ...cardStyle, marginTop: '0.5rem', marginBottom: 0, padding: '0.9rem' }}>
              <div style={{ color: C.muted, fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Narrow what you're being asked. The other tenses stay out of the way until you switch back.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {presets.map(p => {
                  const on = (activePreset?.id === p.id);
                  return (
                    <button key={p.id} onClick={() => applyFocus(p.focus)} style={{
                      display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap',
                      padding: '0.6rem 0.8rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                      background: on ? C.brand : 'white', color: on ? 'white' : C.ink,
                      border: `1.5px solid ${on ? C.brand : C.line}`, fontSize: '0.85rem', fontWeight: 600,
                    }}>
                      <span>{p.label}</span>
                      {p.hint && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: on ? 'rgba(255,255,255,0.85)' : C.faint }}>
                          {p.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* set progress */}
        {phase !== 'finished' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.line}`, padding: '10px 16px', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', color: C.slate, fontWeight: 600 }}>
            <span>Progress: {qNum}/10</span>
            <span>Score: {score}/10</span>
          </div>
        )}

        {/* specimen */}
        {phase !== 'finished' && (
          <div style={{ ...cardStyle, padding: '1.5rem' }}>
            <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>Sentence</div>
            <p style={{ fontSize: '1.4rem', lineHeight: 1.45, color: C.ink, margin: 0, fontWeight: 400 }}>
              {item.pre}
              <span style={{ background: C.mark, padding: '1px 5px', borderRadius: '5px', fontWeight: 700 }}>{item.vp}</span>
              {item.post}
            </p>
          </div>
        )}

        {/* TAG phase */}
        {(phase === 'tag' || (graded && !correct)) && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>🏷️ Which tense is the verb?</div>
            {chipGroups.map(({ g, items }) => (
              <div key={g || 'all'} style={{ marginBottom: '0.75rem' }}>
                {g && (
                  <div style={{ fontSize: '0.72rem', color: C.muted, marginBottom: '0.4rem' }}>{GROUP_LABEL[g]}</div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {items.map(renderChip)}
                </div>
              </div>
            ))}

            {!graded && (
              <button onClick={checkTag} disabled={!pick} style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.25rem',
                background: pick ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: pick ? 'pointer' : 'not-allowed',
              }}>Check</button>
            )}

            {graded && !correct && (
              <div style={{ marginTop: '0.5rem' }}>
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
                <button onClick={advance} style={{
                  width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                  background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                }}>Next →</button>
              </div>
            )}
          </div>
        )}

        {/* recognition success banner */}
        {correct && (
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
            {draft && (
              <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: 8, padding: '0.5rem 0.7rem', margin: '0.5rem 0 0.75rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.25rem' }}>Your sentence</div>
                <div style={{ fontSize: '0.9rem', color: C.ink, fontStyle: 'italic', lineHeight: 1.4 }}>“{draft}”</div>
              </div>
            )}
            {prod?.layer === 'ai' && (
              <div style={{ marginBottom: '0.6rem' }}><StatusPill tone="ai">🤖 AI checked</StatusPill></div>
            )}
            {prod?.layer === 'ai' && prod.feedback && (
              <div style={{ color: C.good, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>{prod.feedback}</div>
            )}
            <button onClick={advance} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>Next →</button>
          </div>
        )}

        {/* FINISHED — set complete (mirrors the English tagger / Modal Match) */}
        {phase === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{score}/10</div>
            <p style={{ color: '#4a5568' }}>{score >= 9 ? 'Outstanding — you can spot any tense on sight!' : score >= 7 ? 'Great work — your tense recognition is strong.' : score >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartSet} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
              {focus && (
                <button onClick={() => applyFocus(null)} style={{ padding: '10px 24px', background: 'white', color: C.brandDark, border: `1.5px solid ${C.brand}`, borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>All tenses</button>
              )}
            </div>
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
