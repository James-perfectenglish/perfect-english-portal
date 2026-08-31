import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  makeGenerated, tenseName, functionAccepts, allowedSpecsFocused,
  FUNCTION_OPTIONS, startLevel, LEVEL_GATES, axisOptionsEn,
} from '../lib/tenseEngineEn.js';
import {
  presetsForLevelEn, focusForTenseEn, axisState, liveAxesFor,
  focusToJson, normaliseFocus, pinnedSummary, EN_AXIS_LABEL,
  COMBO_AXIS, comboOptions, comboKeys, comboAllows, answerComboKey,
} from '../lib/tenseFocus.js';
import { findTense } from '../lib/tenseExplainEn.js';
import SentenceChallenge from './SentenceChallenge';
import ExplainerOverlay from './ExplainerOverlay';
import TenseCard from './TenseCard';

/* ============================================================
   Tense Tagger 🏷️  — standalone Activities exercise (English)
   Recognition is generated grammar (the answer key is free).
   Specimens are served from the tense_specimens bank (pre-generated
   and AI-filtered for naturalness) via the tense_specimen_deck RPC,
   with the live engine as the offline fallback so the exercise never
   blocks. Production runs through the shared SentenceChallenge sheet
   (type or 🎙️ voice input), marked by the AI arbiter (mark-free.js,
   type:'tense'); on an AI outage nothing is persisted and the student
   simply retries. Recognition attempts write to tense_attempts; every
   production submission is harvested to sc_sentences (with the real
   input method); a passed production writes a star — this component
   owns the star row (SC runs noStars).

   The generation + marking engine lives in src/lib/tenseEngineEn.js,
   shared with scripts/generate_tense_specimens.mjs (the bank builder),
   so the bank can never drift from the live fallback.
   ============================================================ */

/* ---------- palette (matches the app) ---------- */
const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  good: '#276749', goodBg: '#f0fff4', goodLine: '#38a169',
  bad: '#c53030', badBg: '#fff5f5', badLine: '#e53e3e',
  mark: '#fef3c7',
};

/* ---------- curated form ≠ function bank (served live at C1) ---------- */
const CURATED = [
  { sentence: 'We are meeting the new supplier next Tuesday.', vp: 'are meeting',
    answer: { time: 'present', aspect: 'continuous', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present continuous for a fixed future arrangement.' },
  { sentence: 'The train leaves at six tomorrow morning.', vp: 'leaves',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present simple for a timetabled future event.' },
  { sentence: 'The conference starts next Thursday.', vp: 'starts',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present simple for a scheduled future event.' },
  { sentence: 'If I had more time, I would help.', vp: 'had',
    answer: { time: 'past', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'present', note: 'Past form for an unreal present situation (2nd conditional).' },
  { sentence: 'I wish I knew the answer.', vp: 'knew',
    answer: { time: 'past', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'present', note: 'Past form after \u201Cwish\u201D for a present regret.' },
  { sentence: 'Water boils at one hundred degrees.', vp: 'boils',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'general', note: 'Present simple for a timeless general truth.' },
  { sentence: 'Hotels usually charge a deposit.', vp: 'charge',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'general', note: 'Present simple for a general truth.' },
];

const rand = a => a[Math.floor(Math.random() * a.length)];

function makeCurated() {
  const it = rand(CURATED);
  const idx = it.sentence.toLowerCase().indexOf(it.vp.toLowerCase());
  return {
    kind: 'curated',
    pre: it.sentence.slice(0, idx),
    vp: it.sentence.slice(idx, idx + it.vp.length),
    post: it.sentence.slice(idx + it.vp.length),
    answer: it.answer, functionTime: it.functionTime, note: it.note,
    isMismatch: it.functionTime !== it.answer.time,
  };
}

// Initial specimen only (synchronous at mount, before the bank deck has loaded).
// Subsequent specimens come from the bank via the component's nextFromBank().
function nextItem(level) {
  if (level === 'C1' && Math.random() < 0.45) return makeCurated();
  return makeGenerated(level) || makeCurated();
}

/* ---------- small UI bits ---------- */
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
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
    cursor: 'pointer', transition: 'all 0.12s',
  };
}
const cardStyle = { background: C.card, border: `1px solid ${C.line}`, borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem' };
const labelStyle = { fontSize: '0.7rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px' };

// human-readable time reference for the production instruction on form≠function items
const FN_LABEL = { past: 'the past', present: 'the present', future: 'the future', general: 'a general truth' };

// production scaffold: the form of each tense + a one-line use note (shown in produce mode)
const FORMULAS = {
  'present simple':             { formula: 'subject + infinitive (add -s for he/she/it)', use: 'habits, routines and general facts' },
  'present continuous':         { formula: 'subject + am/is/are + verb-ing', use: 'actions happening now (or a fixed future arrangement)' },
  'present perfect':            { formula: 'subject + have/has + past participle', use: 'past actions with present relevance or a present result' },
  'present perfect continuous': { formula: 'subject + have/has + been + verb-ing', use: 'an action continuing up to now' },
  'past simple':                { formula: 'subject + past verb (-ed or irregular)', use: 'finished actions at a definite past time' },
  'past continuous':            { formula: 'subject + was/were + verb-ing', use: 'an action in progress at a past moment' },
  'past perfect':               { formula: 'subject + had + past participle', use: 'an action completed before another past action' },
  'past perfect continuous':    { formula: 'subject + had + been + verb-ing', use: 'an action continuing up to a point in the past' },
  'future simple':              { formula: 'subject + will + infinitive', use: 'predictions, offers and decisions made now' },
  'future continuous':          { formula: 'subject + will be + verb-ing', use: 'an action in progress at a future moment' },
  'future perfect':             { formula: 'subject + will have + past participle', use: 'an action completed before a point in the future' },
  'past simple passive':        { formula: 'subject + was/were + past participle', use: 'a finished past action — focus on what was done' },
  'past continuous passive':    { formula: 'subject + was/were + being + past participle', use: 'an action in progress in the past — passive' },
  'past perfect passive':       { formula: 'subject + had been + past participle', use: 'an action completed before another past action — passive' },
  'present simple passive':     { formula: 'subject + am/is/are + past participle', use: 'a habit or fact — focus on what is done' },
  'present continuous passive': { formula: 'subject + am/is/are + being + past participle', use: 'an action happening now — passive' },
  'present perfect passive':    { formula: 'subject + have/has + been + past participle', use: 'a past action with present relevance — passive' },
  'future simple passive':      { formula: 'subject + will be + past participle', use: 'a future action — passive' },
  'future perfect passive':     { formula: 'subject + will have been + past participle', use: 'an action completed before a future point — passive' },
};

// status pill for the AI marking layer (matches the app's AI purple convention)
function StatusPill({ tone, children }) {
  const t = {
    ai:   { bg: '#EDE9FE', fg: '#553C9A', bd: '#C4B5FD' },
    good: { bg: C.goodBg,  fg: C.good,    bd: C.goodLine },
    bad:  { bg: C.badBg,   fg: C.bad,     bd: C.badLine },
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

/* ---------- band of a single tense (locked "Practise this" mode) ---------- */
function tenseBand({ aspect, voice }) {
  if (aspect === 'perfect_continuous') return 'B2';
  if (voice === 'passive' || aspect === 'perfect') return 'B1';
  return 'A2';
}

/* ---------- component ---------- */
export default function TenseTagger({ profile, initialTense = null, classMode = false }) {
  const startLvl = initialTense ? tenseBand(initialTense) : startLevel(profile);
  // "Practise this" from the Explainer used to pin all three axes, which left
  // nothing to decide. It now pins time + voice and puts the chosen aspect up
  // against its nearest contrast — two chips, one real decision, still centred
  // on the tense they clicked.
  const [level, setLevel] = useState(startLvl);
  const [focus, setFocus] = useState(() => initialTense
    ? focusForTenseEn(initialTense,
        axisOptionsEn(startLvl, { time: initialTense.time, voice: initialTense.voice }).aspect)
    : null);
  const [showPresets, setShowPresets] = useState(false);
  const [item, setItem] = useState(() => initialTense
    ? (makeGenerated(startLvl, null,
        focusForTenseEn(initialTense,
          axisOptionsEn(startLvl, { time: initialTense.time, voice: initialTense.voice }).aspect))
       || nextItem(startLvl))
    : nextItem(startLvl));
  const [phase, setPhase] = useState('tag'); // tag | function | produce | done | finished
  const [picks, setPicks] = useState({});
  const [graded, setGraded] = useState(false);
  const [fnPick, setFnPick] = useState(null);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);
  // Set-of-10 state — consistent with Modal Match / Conditionals Chooser.
  const [qNum, setQNum] = useState(1);   // 1-based specimen counter
  const [score, setScore] = useState(0); // correct recognitions this set
  // One production (Sentence Challenge) per TENSE per visit: tenses already
  // produced this visit skip the produce step. Survives Try Again and level
  // switches; resets on leaving the exercise.
  const seenTensesRef = useRef(new Set());

  // Specimen bank: a shuffled deck of pre-generated, AI-filtered rows for the
  // current level, refilled in the background. Falls back to the live engine
  // whenever the bank is empty or unreachable, so the exercise never blocks.
  const deckRef = useRef([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const focusRef = useRef(focus);
  focusRef.current = focus;

  const bankRowToItem = (row) => ({
    kind: 'generated', pre: row.pre, vp: row.vp, post: row.post,
    answer: row.answer, functionTime: row.answer.time, note: null, isMismatch: false,
  });

  async function loadDeck(lvl, fcs) {
    try {
      let rows;
      if (fcs) {
        // focused deck: a pinned axis is an eq, a restricted axis an in
        let q = supabase.from('tense_specimens')
          .select('pre,vp,post,answer')
          .eq('language', 'en').eq('level', lvl);
        // A combo focus is a DIAGONAL, which no combination of per-axis filters
        // can express. Narrow to the surrounding rectangle in SQL, then sieve
        // the diagonal out client-side — and over-fetch to cover what the sieve
        // drops. An axis is only narrowed if EVERY combo names it.
        const covered = comboKeys(fcs);
        for (const ax of ['time', 'aspect', 'voice']) {
          if (covered.includes(ax)) {
            const vals = fcs.combos.every(c => c[ax]) ? [...new Set(fcs.combos.map(c => c[ax]))] : null;
            if (vals) q = q.in(`answer->>${ax}`, vals);
            continue;
          }
          const rule = fcs[ax];
          if (rule == null) continue;
          q = Array.isArray(rule) ? q.in(`answer->>${ax}`, rule) : q.eq(`answer->>${ax}`, rule);
        }
        const { data, error } = await q.limit(covered.length ? 120 : 60);
        if (error || !Array.isArray(data) || lvl !== levelRef.current || fcs !== focusRef.current) return;
        rows = data.filter(r => comboAllows(r.answer, fcs.combos)).sort(() => Math.random() - 0.5);
      } else {
        const { data, error } = await supabase.rpc('tense_specimen_deck',
          { p_language: 'en', p_level: lvl, p_limit: 40 });
        if (error || !Array.isArray(data) || lvl !== levelRef.current || focusRef.current) return;
        rows = data;
      }
      deckRef.current = deckRef.current.concat(rows.map(bankRowToItem));
    } catch { /* offline — the live engine fallback covers it */ }
  }

  useEffect(() => { deckRef.current = []; loadDeck(level, focus); }, [level, focus]);

  function drawGenerated(lvl) {
    if (deckRef.current.length) {
      const it = deckRef.current.shift();
      if (deckRef.current.length < 8) loadDeck(lvl, focusRef.current);   // refill in the background
      return it;
    }
    return makeGenerated(lvl, null, focusRef.current) || makeCurated();  // bank empty/offline → live engine
  }

  function nextFromBank(lvl) {
    // curated items are hand-picked form≠function specials and carry fixed tags,
    // so they can't honour a focus rule — they only run in unfocused C1 sets
    if (!focusRef.current && lvl === 'C1' && Math.random() < 0.45) return makeCurated();
    return drawGenerated(lvl);
  }

  const gate = LEVEL_GATES[level];
  // options reachable on each axis given everything the focus has fixed, and
  // the axes still being ASKED. Both the chips and the scoring read these, so
  // a pinned axis is removed from the question rather than merely biased.
  const axisOpts = axisOptionsEn(level, focus);
  const liveAxes = liveAxesFor(focus, gate.axes, axisOpts);
  const pins = pinnedSummary(focus, gate.axes, axisOpts, EN_AXIS_LABEL);
  const presets = presetsForLevelEn(level);
  const activePreset = presets.find(p =>
    JSON.stringify(normaliseFocus(p.focus)) === JSON.stringify(normaliseFocus(focus)));
  const name = tenseName(item);

  function reset(toLevel = level) {
    setItem(nextFromBank(toLevel)); setPhase('tag'); setPicks({});
    setGraded(false); setFnPick(null); setDraft(''); setProd(null); setShowCard(false);
  }
  // Advance the set: next specimen, or the completion screen after 10.
  function advance() {
    if (qNum >= 10) {
      setPhase('finished');
      setGraded(false); setPicks({}); setFnPick(null); setProd(null); setShowCard(false);
      return;
    }
    setQNum(n => n + 1);
    reset();
  }
  // Recognition done (tags, plus the C1 function step when it runs): produce
  // only the first time this tense is met this visit — otherwise straight on.
  function proceedAfterRecognition() {
    if (!seenTensesRef.current.has(name)) {
      seenTensesRef.current.add(name);
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
    deckRef.current = []; levelRef.current = l;
    setLevel(l); setQNum(1); setScore(0); reset(l);
  }

  function applyFocus(f) {
    const nf = normaliseFocus(f);
    deckRef.current = []; focusRef.current = nf;
    setFocus(nf); setShowPresets(false);
    setQNum(1); setScore(0);
    setItem(nextFromBank(level));
    setPhase('tag'); setPicks({}); setGraded(false); setFnPick(null); setDraft(''); setProd(null); setShowCard(false);
  }

  // chips per axis come from the focus rule applied to the reachable options
  const axisDef = {
    time: { label: EN_AXIS_LABEL.time, opts: axisState(focus, 'time', axisOpts.time).opts },
    aspect: { label: EN_AXIS_LABEL.aspect, opts: axisState(focus, 'aspect', axisOpts.aspect).opts },
    voice: { label: EN_AXIS_LABEL.voice, opts: axisState(focus, 'voice', axisOpts.voice).opts },
    // whole tenses on one row — see the combos note in tenseFocus.js. Asking
    // a diagonal as two axes would let one answer give away the other.
    [COMBO_AXIS]: { label: 'Tense', opts: comboOptions(focus, allowedSpecsFocused(level, focus)).map(c => c.key) },
  };

  // the correct chip for an axis — for the combo row that is whichever whole
  // tense the answer satisfies, not a single axis value
  const axisAnswer = ax => (ax === COMBO_AXIS ? answerComboKey(item.answer, focus?.combos) : item.answer[ax]);
  const tagsCorrect = () => liveAxes.every(ax => picks[ax] === axisAnswer(ax));

  const allPicked = liveAxes.every(ax => picks[ax]);
  const recognitionCorrect = graded && tagsCorrect();

  async function logAttempt(functionAnswer, functionPicked) {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const picksLog = {}, ansLog = {};
      liveAxes.forEach(ax => { picksLog[ax] = picks[ax]; ansLog[ax] = axisAnswer(ax); });
      const ok = tagsCorrect();
      await supabase.from('tense_attempts').insert({
        student_id: user.id, language: 'en', level,
        sentence: (item.pre + item.vp + item.post), verb_phrase: item.vp,
        answer: ansLog, picks: picksLog, is_correct: ok, is_mismatch: item.isMismatch,
        function_answer: functionAnswer ?? null, function_picked: functionPicked ?? null,
        focus: focusToJson(focus),   // NULL when unfocused — keeps old rows comparable
      });
    } catch (e) { console.warn('TenseTagger: tense_attempts insert failed', e); }
  }

  async function awardStar(sentence, aiFeedback, inputMethod = 'text') {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('stars').insert({
        student_id: user.id, source: 'tense_tagger', subtype: 'production',
        context: { tense: name, sentence, language: 'en', level, input_method: inputMethod, ai_feedback: aiFeedback || '' },
      });
      if (error && error.code !== '23505') console.warn('TenseTagger: could not save star:', error);
    } catch (e) { console.warn('TenseTagger: could not save star:', e); }
  }

  // Harvest every production submission (pass AND fail) into sc_sentences, so the
  // tagging classifier sees Tense Tagger like every other "record" surface.
  // target = the tense name; is_correct = the final verdict; ai_feedback when the AI ran.
  async function harvestSentence(sentence, isCorrect, aiFeedback, inputMethod = 'text') {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'tense_tagger', target: name, sentence,
        is_correct: isCorrect, ai_feedback: aiFeedback || null,
        input_method: inputMethod, language: 'en', level,
      });
      if (error) console.warn('TenseTagger: sc_sentences insert failed', error);
    } catch (e) { console.warn('TenseTagger: sc_sentences insert failed', e); }
  }

  function checkTags() {
    setGraded(true);
    const ok = tagsCorrect();
    if (ok) {
      setTagged(n => n + 1);
      setScore(s => s + 1);
      if (gate.secondQ) { setPhase('function'); }   // attempt logged after the function answer
      else { logAttempt(); proceedAfterRecognition(); }
    } else {
      logAttempt();   // log the mistake — this is the teaching signal
    }
  }

  function answerFunction(opt) {
    setFnPick(opt);
    logAttempt(item.functionTime, opt);
  }

  // Production now runs through the shared SentenceChallenge sheet (type or
  // 🎙️ voice input; AI marking via mark-free.js type:'tense'). SC persists no
  // star itself (noStars) — this component keeps ownership of the star row
  // (source 'tense_tagger', subtype 'production') and the sc_sentences harvest,
  // now with the student's real input method.
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
  // (fail-and-close, backdrop dismiss) advances the set — the item was already
  // scored at the tag step.
  function handleSCClose() {
    if (prod?.ok) setPhase('done');
    else advance();
  }

  const accepts = functionAccepts(item);

  return (
    <div style={{ width: '100%', minHeight: '80vh', background: C.page, padding: '1rem', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ ...labelStyle, color: C.muted, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            Tense Tagger 🏷️
          </div>
          <div style={{ color: C.brandDark, fontWeight: 700, fontSize: '0.95rem' }}>⭐️ {stars}</div>
        </div>

        {/* level pills */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {['A2', 'B1', 'B2', 'C1'].map(l => (
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
                {activePreset ? activePreset.label
                  : focus ? liveAxes.map(ax => axisDef[ax].label).join(' + ') + ' only'
                  : 'All tenses'}
              </span>
            </span>
            <span style={{ color: C.faint, fontSize: '0.8rem', flexShrink: 0 }}>{showPresets ? 'Close ⌃' : 'Change ⌄'}</span>
          </button>

          {showPresets && (
            <div style={{ ...cardStyle, marginTop: '0.5rem', marginBottom: 0, padding: '0.9rem' }}>
              <div style={{ color: C.muted, fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                Narrow what you're being asked. Anything fixed still appears in the sentences — you just aren't being marked on it.
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

        {/* set progress — consistent with Modal Match / Conditionals Chooser */}
        {phase !== 'finished' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.line}`, padding: '10px 16px', borderRadius: '12px', marginBottom: '1rem', fontSize: '0.85rem', color: C.slate, fontWeight: 600 }}>
            <span>Progress: {qNum}/10</span>
            <span>Score: {score}/10</span>
          </div>
        )}

        {/* specimen */}
        {phase !== 'finished' && (
        <div style={{ ...cardStyle, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div style={labelStyle}>Sentence</div>
            {/* pinned axes are NOT being asked, so they are shown rather than guessed */}
            {pins.length > 0 && (
              <div style={{ fontSize: '0.72rem', color: C.brandDark, background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                {pins.join(' · ')}
              </div>
            )}
          </div>
          <p style={{ fontSize: '1.4rem', lineHeight: 1.45, color: C.ink, margin: 0, fontWeight: 400 }}>
            {item.pre}
            <span style={{ background: C.mark, padding: '1px 5px', borderRadius: '5px', fontWeight: 700 }}>{item.vp}</span>
            {item.post}
          </p>
        </div>
        )}

        {/* TAG phase */}
        {(phase === 'tag' || (graded && !recognitionCorrect)) && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '1rem' }}>🏷️ Attach the tags</div>
            {liveAxes.map(ax => (
              <div key={ax} style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.82rem', color: C.muted, marginBottom: '0.5rem' }}>{axisDef[ax].label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {axisDef[ax].opts.map(opt => {
                    const picked = picks[ax] === opt;
                    let state = picked ? 'selected' : 'idle';
                    if (graded) {
                      if (opt === axisAnswer(ax)) state = picked ? 'correct' : 'answer';
                      else if (picked) state = 'wrong';
                    }
                    return (
                      <button key={opt} disabled={graded} onClick={() => setPicks(p => ({ ...p, [ax]: opt }))}
                        style={chipStyle(state)}>
                        {opt.replace(/[_|]/g, ' ')}{state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✕' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {!graded && (
              <button onClick={checkTags} disabled={!allPicked} style={{
                width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.25rem',
                background: allPicked ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: allPicked ? 'pointer' : 'not-allowed',
              }}>Check tags</button>
            )}

            {graded && !recognitionCorrect && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ color: C.bad, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                  Not quite — the correct tags are shown in green. This one is the <b>{name}</b>.
                </div>
                {findTense(item.answer) && (
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
        {recognitionCorrect && (
          <div style={{
            background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: '12px',
            color: C.good, fontSize: '0.9rem', padding: '0.75rem 1rem', marginBottom: '1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap',
          }}>
            <span>✅ Tagged correctly — <b>{name}</b>.</span>
            {findTense(item.answer) && (
              <button onClick={() => setShowCard(true)} style={{
                background: 'white', color: C.brandDark, border: '1px solid #C4B5FD', borderRadius: 8,
                padding: '0.35rem 0.7rem', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0,
              }}>📖 See the full card</button>
            )}
          </div>
        )}

        {/* FUNCTION phase (C1) */}
        {phase === 'function' && (
          <div style={cardStyle}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: C.ink, marginBottom: '0.25rem' }}>
              And what time does it actually refer to?
            </div>
            <div style={{ color: C.muted, fontSize: '0.82rem', marginBottom: '1rem' }}>
              The form isn’t always the meaning. Choose the real time reference.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {FUNCTION_OPTIONS.map(opt => {
                let state = fnPick === opt ? 'selected' : 'idle';
                if (fnPick) {
                  if (accepts.includes(opt)) state = 'correct';
                  else if (opt === fnPick) state = 'wrong';
                }
                return (
                  <button key={opt} disabled={!!fnPick} onClick={() => answerFunction(opt)} style={chipStyle(state)}>
                    {opt}
                  </button>
                );
              })}
            </div>

            {fnPick && (
              <div style={{ marginTop: '1rem' }}>
                {item.note && (
                  <div style={{
                    background: '#ebf4ff', borderRadius: '10px', color: C.ink, fontSize: '0.9rem',
                    padding: '0.75rem 0.9rem', marginBottom: '0.75rem', lineHeight: 1.5,
                  }}>💡 {item.note}</div>
                )}
                {!item.note && accepts.includes(fnPick) && (
                  <div style={{ color: C.good, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    {item.answer.time === 'present' && item.answer.aspect === 'simple'
                      ? 'Right — a habitual present like this sits between ‘present’ and ‘general’, so both count.'
                      : 'Right — here the form and the meaning line up.'}
                  </div>
                )}
                <button onClick={proceedAfterRecognition} style={{
                  width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                  background: PG, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                }}>Continue →</button>
              </div>
            )}
          </div>
        )}

        {/* PRODUCE phase — the shared Sentence Challenge sheet (type / 🎙️ voice) */}
        {phase === 'produce' && (
          <SentenceChallenge
            word={name}
            language="en"
            exercise="tense_tagger"
            apiType="tense"
            apiExtraFields={{
              tenseName: name, isMismatch: item.isMismatch,
              functionTime: item.functionTime, note: item.note || null, level,
            }}
            noStars
            headerLabel="✏️ YOUR TURN — EARN THE STAR"
            promptText={
              <span style={{ color: '#2d3748' }}>
                {item.isMismatch
                  ? <>Write your own <b>{name}</b> sentence that refers to <b>{FN_LABEL[item.functionTime] || item.functionTime}</b>:</>
                  : <>Write your own sentence in the:</>}
                {item.isMismatch && item.note && (
                  <span style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.85rem' }}>💡 {item.note}</span>
                )}
                {!item.isMismatch && FORMULAS[name] && (
                  <span style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.82rem', color: '#718096', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{FORMULAS[name].formula}</span>
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
              You recognised <i>and</i> produced the {name}.
            </div>
            {draft && (
              <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: 8, padding: '0.5rem 0.7rem', margin: '0.5rem 0 0.75rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.25rem' }}>Your sentence</div>
                <div style={{ fontSize: '0.9rem', color: C.ink, fontStyle: 'italic', lineHeight: 1.4 }}>“{draft}”</div>
              </div>
            )}
            {prod?.layer === 'ai' && (
              <div style={{ marginBottom: '0.6rem' }}>
                <StatusPill tone="ai">🤖 AI checked</StatusPill>
              </div>
            )}
            {prod?.layer === 'ai' && prod.feedback && (
              <div style={{ color: C.good, fontSize: '0.88rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>{prod.feedback}</div>
            )}
            {prod?.layer === 'structure' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <StatusPill tone="warn">⚠️ AI unavailable — structure verified</StatusPill>
              </div>
            )}
            <button onClick={advance} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>Next →</button>
          </div>
        )}

        {/* FINISHED — set complete (mirrors Modal Match / Conditionals Chooser) */}
        {phase === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{score}/10</div>
            <p style={{ color: '#4a5568' }}>{score >= 9 ? 'Outstanding — you can spot any tense on sight!' : score >= 7 ? 'Great work — your tense recognition is strong.' : score >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartSet} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
            </div>
          </div>
        )}

        {showCard && (() => {
          const tense = findTense(item.answer);
          return tense ? (
            <ExplainerOverlay open onClose={() => setShowCard(false)}>
              <TenseCard tense={{ ...tense, _studentLevel: profile?.level || 'B1' }} ahead={false} />
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
