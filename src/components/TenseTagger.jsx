import { useState } from 'react';
import { supabase } from '../supabaseClient';

/* ============================================================
   Tense Tagger 🏷️  — standalone Activities exercise (English, ship 1)
   Recognition is fully generated client-side (grammar composed
   from the tags, so the answer key is free). Production is checked
   by an AI arbiter (mark-free.js, type:'tense') with the client-side
   structural rule as the offline fallback. Recognition attempts write
   to tense_attempts; every production submission is harvested to
   sc_sentences; a passed production writes a star.
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

// Semantic gates (keep generated sentences natural):
//  ACTIVITY        — sustained activities that read well in the perfect continuous
//  PROCESS_PASSIVE — things naturally described as a process "being done" (continuous passive)
//  PUNCTUAL        — instantaneous verbs that read oddly in any continuous ("is finding")
const ACTIVITY = new Set(['clean','cook','serve','prepare','build','paint','fix','deliver','drive','watch','read','write','teach','work','wait','stay','run','sing']);
const PROCESS_PASSIVE = new Set(['clean','cook','serve','prepare','build','paint','fix','deliver']);
const PUNCTUAL = new Set(['find','lose']);

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
  if (aspect === 'perfect_continuous') return ['duration'];      // always a duration phrase
  if (time === 'present' && aspect === 'simple') return ['habitual', 'present_simple'];
  if (time === 'present' && aspect === 'continuous') return ['now'];
  if (aspect === 'perfect') {
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
        if (perfect && progressive && voice === 'passive') continue;             // "has been being cleaned" — excluded
        if (time === 'future' && perfect && progressive) continue;              // future perfect continuous — too awkward to generate naturally
        if (time === 'future' && progressive && voice === 'passive') continue;  // "will be being driven" — never used
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
  for (let tries = 0; tries < 50; tries++) {
    const spec = rand(specs);
    const passive = spec.voice === 'passive';
    const continuous = spec.progressive;
    const perfCont = spec.perfect && spec.progressive;

    let pool = VERBS;
    if (passive) pool = pool.filter(v => v.transitive);
    if (continuous) pool = pool.filter(v => !v.stative && !PUNCTUAL.has(v.base));
    if (perfCont) pool = pool.filter(v => ACTIVITY.has(v.base));            // sustained activities only
    if (continuous && passive) pool = pool.filter(v => PROCESS_PASSIVE.has(v.base)); // natural "being done" verbs
    if (!pool.length) continue;
    const verb = rand(pool);

    let person, number, subjectText, objectText = '';
    if (passive) {
      subjectText = rand(verb.objects);
      person = 3; number = isPlural(subjectText) ? 'pl' : 'sg';
    } else {
      const subj = rand(SUBJECTS);
      subjectText = subj.text; person = subj.person; number = subj.number;
      // perfect continuous reads best with no object ("I have been working for ages")
      if (verb.transitive && verb.objects.length && !perfCont) objectText = rand(verb.objects);
    }

    const vp = buildVP(verb, spec, person, number);
    const tags = adverbTagsFor(spec.time, spec.aspect);
    const advChoices = ADVERBIALS.filter(a => a.tags.some(t => tags.includes(t)));
    let adv = '';
    if (perfCont) adv = advChoices.length ? rand(advChoices).text : 'for ages';   // always a duration phrase
    else if (advChoices.length && Math.random() < 0.7) adv = rand(advChoices).text;

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
  // a perfect verb phrase may legitimately use "been" as a main-verb participle
  // ("will have been there"); only exclude "been + V-ing" (that is the continuous).
  const NOT_CONT = '(?!been\\s+[a-z]+ing)';
  let re = null;
  if (voice === 'active') {
    if (aspect === 'perfect_continuous')
      re = time === 'present' ? `${HVp}\\s+been\\s+${ING}` : time === 'past' ? `${HVq}\\s+been\\s+${ING}` : `${WL}\\s+have\\s+been\\s+${ING}`;
    else if (aspect === 'continuous')
      re = time === 'present' ? `${BEp}\\s+${ING}` : time === 'past' ? `${BEq}\\s+${ING}` : `${WL}\\s+be\\s+${ING}`;
    else if (aspect === 'perfect')
      re = time === 'present' ? `${HVp}\\s+${NOT_CONT}[a-z]+` : time === 'past' ? `${HVq}\\s+[a-z]+` : `${WL}\\s+have\\s+${NOT_CONT}[a-z]+`;
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
  const [checking, setChecking] = useState(false);
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
    aspect: { label: 'Type', opts: gate.aspect },
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

  async function awardStar(sentence, aiFeedback) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('stars').insert({
        student_id: user.id, source: 'tense_tagger', subtype: 'production',
        context: { tense: name, sentence, language: 'en', level, input_method: 'text', ai_feedback: aiFeedback || '' },
      });
      if (error && error.code !== '23505') console.warn('TenseTagger: could not save star:', error);
    } catch (e) { console.warn('TenseTagger: could not save star:', e); }
  }

  // Harvest every production submission (pass AND fail) into sc_sentences, so the
  // tagging classifier sees Tense Tagger like every other "record" surface.
  // target = the tense name; is_correct = the final verdict; ai_feedback when the AI ran.
  async function harvestSentence(sentence, isCorrect, aiFeedback) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'tense_tagger', target: name, sentence,
        is_correct: isCorrect, ai_feedback: aiFeedback || null,
        input_method: 'text', language: 'en', level,
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

  // Production marking: AI is the arbiter (mark-free.js, type:'tense'); the
  // client-side structural regex is the offline fallback so a star is never lost
  // to an AI outage. Every submission (pass or fail) is harvested to sc_sentences.
  async function checkProduction() {
    const sentence = draft.trim();
    if (!sentence || checking) return;

    const structural = productionResult(sentence, item);  // layer 1 + fallback verdict

    const useStructuralFallback = () => {
      if (structural.ok) {
        setProd({ ok: true, layer: 'structure', soft: structural.soft });
        harvestSentence(sentence, true, null);
        awardStar(sentence, null); setStars(s => s + 1); setPhase('done');
      } else {
        setProd({ ok: false, layer: 'structure', hint: structural.hint });
        harvestSentence(sentence, false, null);
      }
    };

    setChecking(true); setProd(null);
    try {
      const res = await fetch('/api/mark-free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'tense', sentence, tenseName: name,
          time: item.answer.time, aspect: item.answer.aspect, voice: item.answer.voice,
          isMismatch: item.isMismatch, functionTime: item.functionTime,
          note: item.note || null, level, language: 'en',
        }),
      });
      const data = res.ok ? await res.json() : null;
      // valid must be an explicit boolean; valid:null (timeout / 529 overload) → fallback
      if (data && (data.valid === true || data.valid === false)) {
        const ok = data.valid === true;
        const feedback = data.feedback || data.reason || '';
        setProd({ ok, layer: 'ai', feedback });
        harvestSentence(sentence, ok, feedback);
        if (ok) { awardStar(sentence, feedback); setStars(s => s + 1); setPhase('done'); }
      } else {
        useStructuralFallback();
      }
    } catch (e) {
      useStructuralFallback();
    } finally {
      setChecking(false);
    }
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
            <div style={{ fontSize: '1rem', color: C.ink, marginBottom: item.isMismatch ? '0.5rem' : '0.75rem' }}>
              {item.isMismatch
                ? <>Now write your own <b>{name}</b> sentence that refers to <b>{FN_LABEL[item.functionTime] || item.functionTime}</b>.</>
                : <>Now write your own sentence in the <b>{name}</b>.</>}
            </div>
            {item.isMismatch && item.note && (
              <div style={{ background: '#ebf4ff', borderRadius: '10px', color: C.ink, fontSize: '0.85rem',
                padding: '0.6rem 0.8rem', marginBottom: '0.75rem', lineHeight: 1.5 }}>💡 {item.note}</div>
            )}
            {FORMULAS[name] && (
              <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: '10px', padding: '0.6rem 0.8rem', marginBottom: '0.75rem' }}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: '0.82rem', fontWeight: 600, color: C.ink }}>{FORMULAS[name].formula}</span>
                <span style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.8rem', color: C.muted, lineHeight: 1.4 }}>{FORMULAS[name].use}</span>
              </div>
            )}
            <textarea value={draft} onChange={e => { setDraft(e.target.value); setProd(null); }} rows={2} autoFocus
              placeholder="Type a sentence…" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={checking}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && draft.trim()) { e.preventDefault(); checkProduction(); } }}
              style={{
                width: '100%', padding: '0.85rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'none',
                fontFamily: 'inherit', borderRadius: '10px', backgroundColor: '#f7f7ff',
                border: `2px solid ${prod && !prod.ok ? C.badLine : C.brand}`, color: '#2d3748', WebkitTextFillColor: '#2d3748',
              }} />

            {/* AI marking pill + feedback (layer 2) */}
            {checking && (
              <div style={{ marginTop: '0.6rem' }}>
                <StatusPill tone="ai">🤖 AI is checking…</StatusPill>
              </div>
            )}
            {!checking && prod && !prod.ok && (
              <div style={{ marginTop: '0.6rem' }}>
                {prod.layer === 'ai'
                  ? <StatusPill tone="bad">🤖 Not yet</StatusPill>
                  : <StatusPill tone="warn">⚠️ AI busy — checked structure only</StatusPill>}
                <div style={{ color: C.bad, fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  {prod.layer === 'ai' ? prod.feedback : prod.hint}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button onClick={checkProduction} disabled={!draft.trim() || checking} style={{
                flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none',
                background: draft.trim() && !checking ? PG : '#cbd5e0', color: 'white', fontSize: '0.95rem', fontWeight: 700,
                cursor: draft.trim() && !checking ? 'pointer' : 'not-allowed',
              }}>{checking ? '🤖 Checking…' : '⭐️ Submit for a star'}</button>
              <button onClick={() => reset()} disabled={checking} style={{
                padding: '0.85rem 1rem', borderRadius: '10px', background: 'transparent', color: C.muted,
                border: `1px solid ${C.line}`, fontSize: '0.9rem', cursor: checking ? 'not-allowed' : 'pointer',
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

        <div style={{ textAlign: 'center', color: C.faint, fontSize: '0.75rem', marginTop: '0.5rem' }}>
          {tagged} tagged · {stars} star{stars === 1 ? '' : 's'} earnt
        </div>
      </div>
    </div>
  );
}
