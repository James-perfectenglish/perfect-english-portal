import { useState } from 'react';
import { supabase } from '../supabaseClient';

/* ============================================================
   Tense Tagger 🏷️  — standalone Practise activity (English, ship 1)
   Recognition is fully generated client-side (grammar composed
   from the tags, so the answer key is free). Production is checked
   by a client-side structural rule (the AI-naturalness layer and
   the sc_sentences harvest are a later ship). Recognition attempts
   write to tense_attempts; a passed production writes a star.
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

/* ---------- lexicon ---------- */
// base, s, past, pp, ing, transitive, stative, objects, min
const VERBS = [
  ['clean','cleans','cleaned','cleaned','cleaning',1,0,['the rooms','the windows'],'A2'],
  ['book','books','booked','booked','booking',1,0,['a table','a room'],'A2'],
  ['serve','serves','served','served','serving',1,0,['breakfast','the guests'],'A2'],
  ['cook','cooks','cooked','cooked','cooking',1,0,['the meal','dinner'],'A2'],
  ['pay','pays','paid','paid','paying',1,0,['the bill','the deposit'],'A2'],
  ['take','takes','took','taken','taking',1,0,['the order','a message'],'A2'],
  ['make','makes','made','made','making',1,0,['a reservation','the beds'],'A2'],
  ['give','gives','gave','given','giving',1,0,['the keys','directions'],'A2'],
  ['eat','eats','ate','eaten','eating',1,0,['lunch','the cake'],'A2'],
  ['watch','watches','watched','watched','watching',1,0,['the film','the news'],'A2'],
  ['buy','buys','bought','bought','buying',1,0,['the tickets','a gift'],'A2'],
  ['read','reads','read','read','reading',1,0,['the book','the report'],'A2'],
  ['need','needs','needed','needed','needing',1,1,['more time','a receipt'],'A2'],
  ['arrive','arrives','arrived','arrived','arriving',0,0,[],'A2'],
  ['wait','waits','waited','waited','waiting',0,0,[],'A2'],
  ['work','works','worked','worked','working',0,0,[],'A2'],
  ['stay','stays','stayed','stayed','staying',0,0,[],'A2'],
  ['go','goes','went','gone','going',0,0,[],'A2'],
  ['sing','sings','sang','sung','singing',0,0,[],'A2'],
  ['run','runs','ran','run','running',0,0,[],'A2'],
  ['prepare','prepares','prepared','prepared','preparing',1,0,['the room','the bill'],'B1'],
  ['deliver','delivers','delivered','delivered','delivering',1,0,['the luggage','the order'],'B1'],
  ['greet','greets','greeted','greeted','greeting',1,0,['the guests','the customers'],'B1'],
  ['cancel','cancels','cancelled','cancelled','cancelling',1,0,['the booking','the reservation'],'B1'],
  ['delay','delays','delayed','delayed','delaying',1,0,['the train','the flight'],'B1'],
  ['bring','brings','brought','brought','bringing',1,0,['the menu','more towels'],'B1'],
  ['find','finds','found','found','finding',1,0,['the room','a solution'],'B1'],
  ['send','sends','sent','sent','sending',1,0,['the confirmation','an email'],'B1'],
  ['write','writes','wrote','written','writing',1,0,['the report','a review'],'B1'],
  ['build','builds','built','built','building',1,0,['a house','the wall'],'B1'],
  ['drive','drives','drove','driven','driving',1,0,['the car','the bus'],'B1'],
  ['teach','teaches','taught','taught','teaching',1,0,['English','the class'],'B1'],
  ['fix','fixes','fixed','fixed','fixing',1,0,['the problem','the door'],'B1'],
  ['paint','paints','painted','painted','painting',1,0,['the wall','a picture'],'B1'],
  ['lose','loses','lost','lost','losing',1,0,['the booking','the keys'],'B1'],
  ['show','shows','showed','shown','showing',1,0,['the room','some ID'],'B1'],
  ['understand','understands','understood','understood','understanding',1,1,['the problem','the rules'],'B1'],
  ['know','knows','knew','known','knowing',1,1,['the answer','the area'],'B1'],
].map(([base, s, past, pp, ing, transitive, stative, objects, min]) =>
  ({ base, s, past, pp, ing, transitive: !!transitive, stative: !!stative, objects, min }));

const SUBJECTS = [
  ['I', 1, 'sg'], ['you', 2, 'pl'], ['he', 3, 'sg'], ['she', 3, 'sg'], ['we', 1, 'pl'],
  ['they', 3, 'pl'], ['the manager', 3, 'sg'], ['the guests', 3, 'pl'], ['the team', 3, 'sg'], ['my friend', 3, 'sg'],
].map(([text, person, number]) => ({ text, person, number }));

const ADVERBIALS = [
  ['each week', ['habitual', 'present_simple', 'past_simple']],
  ['every day', ['habitual', 'present_simple']],
  ['for ages', ['duration']],
  ['since Monday', ['duration']],
  ['right now', ['now']],
  ['yesterday', ['past_simple']],
  ['last night', ['past_simple']],
  ['by next year', ['future_perfect']],
  ['next week', ['future']],
].map(([text, tags]) => ({ text, tags }));

function adverbTagsFor(time, aspect) {
  if (time === 'present' && aspect === 'simple') return ['habitual', 'present_simple'];
  if (time === 'present' && aspect === 'continuous') return ['now'];
  if (aspect === 'perfect' || aspect === 'perfect_continuous') {
    if (time === 'future') return ['future_perfect'];
    return ['duration'];
  }
  if (time === 'past' && aspect === 'simple') return ['past_simple'];
  if (time === 'past' && aspect === 'continuous') return ['past_simple'];
  if (time === 'future') return ['future'];
  return [];
}

/* ---------- grammar engine (composes the verb phrase from the tags) ---------- */
const BE = {
  finite: { present: { '1sg': 'am', '3sg': 'is', default: 'are' },
            past: { '1sg': 'was', '3sg': 'was', default: 'were' } },
  bare: 'be', pp: 'been', ing: 'being',
};
const HAVE = {
  finite: { present: { '3sg': 'has', default: 'have' }, past: { default: 'had' } },
  bare: 'have', pp: 'had', ing: 'having',
};
const pnKey = (p, n) => (p === 1 && n === 'sg') ? '1sg' : (p === 3 && n === 'sg') ? '3sg' : 'default';
const finiteBe = (t, p, n) => BE.finite[t][pnKey(p, n)] ?? BE.finite[t].default;
const finiteHave = (t, p, n) => HAVE.finite[t][pnKey(p, n)] ?? HAVE.finite[t].default;

function buildVP(verb, spec, person, number) {
  const passive = spec.voice === 'passive';
  const modalWord = spec.modal?.word ?? (spec.time === 'future' ? 'will' : null);
  const heads = [];
  if (modalWord) heads.push('MODAL');
  if (spec.perfect) heads.push('HAVE');
  if (spec.progressive) heads.push('BE_PROG');
  if (passive) heads.push('BE_PASS');
  heads.push('LEX');

  const out = [];
  let imposed = null;
  heads.forEach((h, i) => {
    const finite = i === 0;
    let word;
    if (h === 'MODAL') word = modalWord;
    else if (h === 'HAVE')
      word = finite ? finiteHave(spec.time, person, number)
        : imposed === 'pp' ? HAVE.pp : imposed === 'ing' ? HAVE.ing : HAVE.bare;
    else if (h === 'BE_PROG' || h === 'BE_PASS')
      word = finite ? finiteBe(spec.time, person, number)
        : imposed === 'pp' ? BE.pp : imposed === 'ing' ? BE.ing : BE.bare;
    else
      word = finite ? (spec.time === 'past' ? verb.past : (person === 3 && number === 'sg') ? verb.s : verb.base)
        : imposed === 'pp' ? verb.pp : imposed === 'ing' ? verb.ing : verb.base;
    out.push(word);
    imposed = h === 'MODAL' ? 'bare' : h === 'HAVE' ? 'pp' : h === 'BE_PROG' ? 'ing' : h === 'BE_PASS' ? 'pp' : null;
  });
  return out.join(' ');
}

/* ---------- target grid + level gates ---------- */
const ASPECTS = [
  ['simple', false, false], ['continuous', false, true],
  ['perfect', true, false], ['perfect_continuous', true, true],
];
const TIMES = ['past', 'present', 'future'];

const LEVEL_GATES = {
  A2: { axes: ['time', 'aspect'], aspect: ['simple', 'continuous'], voice: ['active'], secondQ: false },
  B1: { axes: ['time', 'aspect', 'voice'], aspect: ['simple', 'continuous', 'perfect'], voice: ['active', 'passive'], secondQ: false },
  B2: { axes: ['time', 'aspect', 'voice'], aspect: ['simple', 'continuous', 'perfect', 'perfect_continuous'], voice: ['active', 'passive'], secondQ: false },
  C1: { axes: ['time', 'aspect', 'voice'], aspect: ['simple', 'continuous', 'perfect', 'perfect_continuous'], voice: ['active', 'passive'], secondQ: true },
};

function gridSpecs() {
  const out = [];
  for (const time of TIMES)
    for (const [aspect, perfect, progressive] of ASPECTS)
      for (const voice of ['active', 'passive']) {
        if (perfect && progressive && voice === 'passive') continue; // "has been being cleaned" — excluded
        out.push({ time, aspect, perfect, progressive, voice, modal: null,
          answer: { time, aspect, voice, modality: 'none' } });
      }
  return out;
}
const GRID = gridSpecs();

function allowedSpecs(level) {
  const g = LEVEL_GATES[level];
  // modality is a future, separate item type (not a forced axis), so it is not generated here
  return GRID.filter(s => g.aspect.includes(s.aspect) && g.voice.includes(s.voice));
}

/* ---------- curated form ≠ function bank (served at C1) ---------- */
const CURATED = [
  { sentence: 'We are going to Scotland on the train.', vp: 'are going',
    answer: { time: 'present', aspect: 'continuous', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present continuous for a fixed future arrangement.' },
  { sentence: 'The train leaves at six.', vp: 'leaves',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present simple for timetables and schedules.' },
  { sentence: 'When the guests arrive, we greet them at the door.', vp: 'arrive',
    answer: { time: 'present', aspect: 'simple', voice: 'active', modality: 'none' },
    functionTime: 'future', note: 'Present simple in a time clause that refers to the future.' },
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

/* ---------- helpers ---------- */
const rand = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const isPlural = s => /s\s*$/.test(s.trim()) && !/\b(news|breakfast|bus|class|gas|lens)$/.test(s.trim());
const ASPECT_NAME = { simple: 'simple', continuous: 'continuous', perfect: 'perfect', perfect_continuous: 'perfect continuous' };

function tenseName(item) {
  const a = item.answer;
  let n = `${a.time} ${ASPECT_NAME[a.aspect]}`;
  if (a.voice === 'passive') n += ' passive';
  return n;
}

function makeGenerated(level) {
  const specs = allowedSpecs(level);
  for (let tries = 0; tries < 40; tries++) {
    const spec = rand(specs);
    const passive = spec.voice === 'passive';
    const continuous = spec.progressive;
    let pool = VERBS;
    if (passive) pool = pool.filter(v => v.transitive);
    if (continuous) pool = pool.filter(v => !v.stative);
    if (!pool.length) continue;
    const verb = rand(pool);

    let person, number, subjectText, objectText = '';
    if (passive) {
      subjectText = rand(verb.objects);
      person = 3; number = isPlural(subjectText) ? 'pl' : 'sg';
    } else {
      const subj = rand(SUBJECTS);
      subjectText = subj.text; person = subj.person; number = subj.number;
      if (verb.transitive && verb.objects.length) objectText = rand(verb.objects);
    }

    const vp = buildVP(verb, spec, person, number);
    const tags = adverbTagsFor(spec.time, spec.aspect);
    const advChoices = ADVERBIALS.filter(a => a.tags.some(t => tags.includes(t)));
    const adv = advChoices.length && Math.random() < 0.7 ? rand(advChoices).text : '';

    const pre = cap(subjectText) + ' ';
    const post = (objectText ? ' ' + objectText : '') + (adv ? ' ' + adv : '') + '.';
    return { kind: 'generated', pre, vp, post, answer: spec.answer,
      functionTime: spec.answer.time, note: null, isMismatch: false };
  }
  return null;
}

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

function nextItem(level) {
  if (level === 'C1' && Math.random() < 0.45) return makeCurated();
  return makeGenerated(level) || makeCurated();
}

/* ---------- production structural check (client-side layer 1) ---------- */
function productionResult(text, item) {
  const s = ' ' + text.toLowerCase().trim().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[.!?,]/g, '') + ' ';
  const { time, aspect, voice } = item.answer;
  const ING = '[a-z]+ing', PP = "[a-z]+(?:ed|en|n|t|ne|wn|ought|aught|ung|ang)";
  const BEp = "(?:am|is|are|'m|'re|'s)", BEq = '(?:was|were)';
  const HVp = "(?:have|has|'ve|'s)", HVq = "(?:had|'d)", WL = "(?:will|'ll)";
  let re = null;
  if (voice === 'active') {
    if (aspect === 'perfect_continuous')
      re = time === 'present' ? `${HVp}\\s+been\\s+${ING}` : time === 'past' ? `${HVq}\\s+been\\s+${ING}` : `${WL}\\s+have\\s+been\\s+${ING}`;
    else if (aspect === 'continuous')
      re = time === 'present' ? `${BEp}\\s+${ING}` : time === 'past' ? `${BEq}\\s+${ING}` : `${WL}\\s+be\\s+${ING}`;
    else if (aspect === 'perfect')
      re = time === 'present' ? `${HVp}\\s+(?!been\\s)[a-z]+` : time === 'past' ? `${HVq}\\s+[a-z]+` : `${WL}\\s+have\\s+(?!been)[a-z]+`;
    else if (time === 'future') re = `${WL}\\s+(?!be\\b|have\\b)[a-z]+`;
  } else {
    if (aspect === 'continuous')
      re = time === 'present' ? `${BEp}\\s+being\\s+${PP}` : time === 'past' ? `${BEq}\\s+being\\s+${PP}` : `${WL}\\s+be\\s+being\\s+${PP}`;
    else if (aspect === 'perfect')
      re = time === 'present' ? `${HVp}\\s+been\\s+${PP}` : time === 'past' ? `${HVq}\\s+been\\s+${PP}` : `${WL}\\s+have\\s+been\\s+${PP}`;
    else
      re = time === 'present' ? `${BEp}\\s+${PP}` : time === 'past' ? `${BEq}\\s+${PP}` : `${WL}\\s+be\\s+${PP}`;
  }
  if (!re) return { ok: true, soft: true };
  return new RegExp(re).test(s)
    ? { ok: true } : { ok: false, hint: `I can\u2019t see the ${tenseName(item)} structure \u2014 check your verb form.` };
}

// which time-reference answers count as correct (a set, because some genuinely blur)
function functionAccepts(item) {
  if (item.kind === 'curated') return [item.functionTime];
  if (item.answer.time === 'present' && item.answer.aspect === 'simple') return ['present', 'general'];
  return [item.functionTime];
}

const FUNCTION_OPTIONS = ['past', 'present', 'future', 'general'];

function startLevel(profile) {
  const l = (profile?.level || '').toUpperCase();
  if (l.startsWith('A')) return 'A2';
  if (l === 'B2') return 'B2';
  if (l.startsWith('C')) return 'C1';
  return 'B1';
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

/* ---------- component ---------- */
export default function TenseTagger({ profile }) {
  const [level, setLevel] = useState(() => startLevel(profile));
  const [item, setItem] = useState(() => nextItem(startLevel(profile)));
  const [phase, setPhase] = useState('tag'); // tag | function | produce | done
  const [picks, setPicks] = useState({});
  const [graded, setGraded] = useState(false);
  const [fnPick, setFnPick] = useState(null);
  const [draft, setDraft] = useState('');
  const [prod, setProd] = useState(null);
  const [stars, setStars] = useState(0);
  const [tagged, setTagged] = useState(0);

  const gate = LEVEL_GATES[level];
  const liveAxes = gate.axes;
  const name = tenseName(item);

  function reset(toLevel = level) {
    setItem(nextItem(toLevel)); setPhase('tag'); setPicks({});
    setGraded(false); setFnPick(null); setDraft(''); setProd(null);
  }
  function changeLevel(l) { setLevel(l); reset(l); }

  const axisDef = {
    time: { label: 'Time', opts: ['past', 'present', 'future'] },
    aspect: { label: 'Aspect', opts: gate.aspect },
    voice: { label: 'Voice', opts: gate.voice },
  };

  const allPicked = liveAxes.every(ax => picks[ax]);
  const recognitionCorrect = graded && liveAxes.every(ax => picks[ax] === item.answer[ax]);

  async function logAttempt(functionAnswer, functionPicked) {
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

  async function awardStar(sentence) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('stars').insert({
        student_id: user.id, source: 'tense_tagger', subtype: 'production',
        context: { tense: name, sentence, language: 'en', level, input_method: 'text' },
      });
      if (error && error.code !== '23505') console.warn('TenseTagger: could not save star:', error);
    } catch (e) { console.warn('TenseTagger: could not save star:', e); }
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

  function checkProduction() {
    const r = productionResult(draft, item);
    setProd(r);
    if (r.ok) { awardStar(draft.trim()); setStars(s => s + 1); setPhase('done'); }
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

        {/* specimen */}
        <div style={{ ...cardStyle, padding: '1.5rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>Specimen</div>
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
          }}>✅ Tagged correctly — <b>{name}</b>.</div>
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

        {/* PRODUCE phase */}
        {phase === 'produce' && (
          <div style={cardStyle}>
            <div style={{ ...labelStyle, marginBottom: '0.6rem' }}>✏️ Your turn — earn the star</div>
            <div style={{ fontSize: '1rem', color: C.ink, marginBottom: '0.75rem' }}>
              Now write your own sentence in the <b>{name}</b>.
            </div>
            <textarea value={draft} onChange={e => { setDraft(e.target.value); setProd(null); }} rows={2}
              placeholder="Type a sentence…" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              style={{
                width: '100%', padding: '0.85rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'none',
                fontFamily: 'inherit', borderRadius: '10px', backgroundColor: '#f7f7ff',
                border: `2px solid ${prod && !prod.ok ? C.badLine : C.brand}`, color: '#2d3748', WebkitTextFillColor: '#2d3748',
              }} />
            {prod && !prod.ok && (
              <div style={{ color: C.bad, fontSize: '0.85rem', marginTop: '0.5rem' }}>{prod.hint}</div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button onClick={checkProduction} disabled={!draft.trim()} style={{
                flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: draft.trim() ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}>⭐️ Submit for a star</button>
              <button onClick={() => reset()} style={{
                padding: '0.85rem 1rem', borderRadius: '10px', background: 'transparent', color: C.muted,
                border: `1px solid ${C.line}`, fontSize: '0.9rem', cursor: 'pointer',
              }}>Skip</button>
            </div>
          </div>
        )}

        {/* DONE phase */}
        {phase === 'done' && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>⭐️</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: C.ink, marginBottom: '0.25rem' }}>Star earnt</div>
            <div style={{ color: C.muted, fontSize: '0.88rem', marginBottom: '0.25rem' }}>
              You recognised <i>and</i> produced the {name}.
            </div>
            {prod?.soft && (
              <div style={{ color: C.faint, fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                (Structure looks right — the AI naturalness check comes in a later update.)
              </div>
            )}
            <button onClick={() => reset()} style={{
              width: '100%', padding: '0.85rem', borderRadius: '10px', border: 'none', marginTop: '0.5rem',
              background: C.ink, color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}>↻ New sentence</button>
          </div>
        )}

        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {tagged} tagged · {stars} star{stars === 1 ? '' : 's'} earnt
        </div>
      </div>
    </div>
  );
}
