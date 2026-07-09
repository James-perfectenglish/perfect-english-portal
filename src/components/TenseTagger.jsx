import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  makeGenerated, tenseName, functionAccepts,
  FUNCTION_OPTIONS, startLevel, LEVEL_GATES,
} from '../lib/tenseEngineEn.js';
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
  const [lockedTense, setLockedTense] = useState(() => initialTense || null);
  const [level, setLevel] = useState(() => initialTense ? tenseBand(initialTense) : startLevel(profile));
  const [item, setItem] = useState(() => initialTense
    ? (makeGenerated(tenseBand(initialTense), initialTense) || nextItem(startLevel(profile)))
    : nextItem(startLevel(profile)));
  const [phase, setPhase] = useState('tag'); // tag | function | produce | done
  const [picks, setPicks] = useState({});
  const [graded, setGraded] = useState(false);
  const [fnPick, setFnPick] = useState(null);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);

  // Specimen bank: a shuffled deck of pre-generated, AI-filtered rows for the
  // current level, refilled in the background. Falls back to the live engine
  // whenever the bank is empty or unreachable, so the exercise never blocks.
  const deckRef = useRef([]);
  const levelRef = useRef(level);
  levelRef.current = level;
  const lockedRef = useRef(lockedTense);
  lockedRef.current = lockedTense;

  const bankRowToItem = (row) => ({
    kind: 'generated', pre: row.pre, vp: row.vp, post: row.post,
    answer: row.answer, functionTime: row.answer.time, note: null, isMismatch: false,
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
          .eq('language', 'en').eq('level', lvl)
          .eq('answer->>time', lock.time)
          .eq('answer->>aspect', lock.aspect)
          .eq('answer->>voice', lock.voice)
          .limit(40);
        if (error || !Array.isArray(data) || lvl !== levelRef.current || lock !== lockedRef.current) return;
        rows = data.slice().sort(() => Math.random() - 0.5);
      } else {
        const { data, error } = await supabase.rpc('tense_specimen_deck',
          { p_language: 'en', p_level: lvl, p_limit: 40 });
        if (error || !Array.isArray(data) || lvl !== levelRef.current || lockedRef.current) return;
        rows = data;
      }
      deckRef.current = deckRef.current.concat(rows.map(bankRowToItem));
    } catch { /* offline — the live engine fallback covers it */ }
  }

  useEffect(() => { deckRef.current = []; loadDeck(level); }, [level, lockedTense]);

  function drawGenerated(lvl) {
    if (deckRef.current.length) {
      const it = deckRef.current.shift();
      if (deckRef.current.length < 8) loadDeck(lvl);   // refill in the background
      return it;
    }
    return makeGenerated(lvl, lockedTense) || makeCurated();  // bank empty/offline → live engine (on-tense when locked)
  }

  function nextFromBank(lvl) {
    if (!lockedTense && lvl === 'C1' && Math.random() < 0.45) return makeCurated();
    return drawGenerated(lvl);
  }

  const gate = LEVEL_GATES[level];
  const liveAxes = gate.axes;
  const name = tenseName(item);

  function reset(toLevel = level) {
    setItem(nextFromBank(toLevel)); setPhase('tag'); setPicks({});
    setGraded(false); setFnPick(null); setDraft(''); setProd(null); setShowCard(false);
  }
  function changeLevel(l) { deckRef.current = []; setLevel(l); reset(l); }

  function clearLock() {
    const lvl = startLevel(profile);
    lockedRef.current = null;
    deckRef.current = [];
    setLockedTense(null);
    setLevel(lvl);
    setItem(makeGenerated(lvl) || makeCurated());
    setPhase('tag'); setPicks({}); setGraded(false); setFnPick(null); setDraft(''); setProd(null); setShowCard(false);
  }

  const axisDef = {
    time: { label: 'Time', opts: ['past', 'present', 'future'] },
    aspect: { label: 'Type', opts: gate.aspect },
    voice: { label: 'Voice', opts: gate.voice },
  };

  const allPicked = liveAxes.every(ax => picks[ax]);
  const recognitionCorrect = graded && liveAxes.every(ax => picks[ax] === item.answer[ax]);

  async function logAttempt(functionAnswer, functionPicked) {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const picksLog = {}, ansLog = {};
      liveAxes.forEach(ax => { picksLog[ax] = picks[ax]; ansLog[ax] = item.answer[ax]; });
      const ok = liveAxes.every(ax => picks[ax] === item.answer[ax]);
      await supabase.from('tense_attempts').insert({
        student_id: user.id, language: 'en', level,
        sentence: (item.pre + item.vp + item.post), verb_phrase: item.vp,
        answer: ansLog, picks: picksLog, is_correct: ok, is_mismatch: item.isMismatch,
        function_answer: functionAnswer ?? null, function_picked: functionPicked ?? null,
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
    const ok = liveAxes.every(ax => picks[ax] === item.answer[ax]);
    if (ok) {
      setTagged(n => n + 1);
      if (gate.secondQ) { setPhase('function'); }   // attempt logged after the function answer
      else { logAttempt(); setPhase('produce'); }
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
  // (fail-and-close, backdrop dismiss) deals a fresh specimen — old Skip semantics.
  function handleSCClose() {
    if (prod?.ok) setPhase('done');
    else reset();
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

        {/* level pills (normal) OR locked-tense strip ("Practise this") */}
        {lockedTense ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: '999px', padding: '0.3rem 0.4rem 0.3rem 0.9rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: C.brandDark }}>
              Practising: {lockedTense.name || tenseName(item)}
            </span>
            <button onClick={clearLock} style={{
              padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', background: 'white', color: C.brandDark, border: '1px solid #C4B5FD',
            }}>← all tenses</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
            {['A2', 'B1', 'B2', 'C1'].map(l => (
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
                      if (opt === item.answer[ax]) state = picked ? 'correct' : 'answer';
                      else if (picked) state = 'wrong';
                    }
                    return (
                      <button key={opt} disabled={graded} onClick={() => setPicks(p => ({ ...p, [ax]: opt }))}
                        style={chipStyle(state)}>
                        {opt.replace(/_/g, ' ')}{state === 'correct' ? ' ✓' : state === 'wrong' ? ' ✕' : ''}
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
                <button onClick={() => reset()} style={{
                  width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none',
                  background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                }}>↻ New sentence</button>
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
                <button onClick={() => setPhase('produce')} style={{
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
            <button onClick={() => reset()} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>↻ New sentence</button>
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
