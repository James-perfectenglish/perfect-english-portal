/* ============================================================
   Tense Tagger — English generation + marking engine (shared)
   Extracted verbatim from TenseTagger.jsx so the live component
   (fallback path) and the bank generator share ONE source of truth.
   Pure JS, no React: importable by Vite and by Node scripts.
   ============================================================ */

import { axisAllows } from './tenseFocus.js';

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

/* Specs surviving a focus rule (see src/lib/tenseFocus.js). The component
   derives its CHIPS from the same rule via axisState(), so the pool and the
   answer options can never drift apart — which is exactly what leaked the
   answer in the old locked "Practise this" mode. Falls back to the unfocused
   set if a focus would empty the pool. */
function allowedSpecsFocused(level, focus = null) {
  const all = allowedSpecs(level);
  if (!focus) return all;
  const kept = all.filter(s =>
    axisAllows(s.answer.time, focus.time) &&
    axisAllows(s.answer.aspect, focus.aspect) &&
    axisAllows(s.answer.voice, focus.voice));
  return kept.length ? kept : all;
}

/* The options actually REACHABLE on each axis — the chip source.
   For each axis we drop that axis's own rule and keep the rest, so the chips
   are exactly the values that can still turn up as an answer given everything
   else the focus has fixed. Without this, "Future only" would offer a
   "perfect continuous" chip that the grid never generates for the future — a
   dead option a student can learn to rule out for free.
   NOTE for a future Custom-matrix UI: build its controls from THIS, so an
   unsatisfiable combination can never be assembled in the first place. */
function axisOptionsEn(level, focus = null) {
  const g = LEVEL_GATES[level];
  const AX = { time: ['past', 'present', 'future'], aspect: g.aspect, voice: g.voice };
  const out = {};
  for (const ax of ['time', 'aspect', 'voice']) {
    const others = focus ? { ...focus, [ax]: null } : null;
    const specs = allowedSpecsFocused(level, others);
    out[ax] = AX[ax].filter(v => specs.some(s => s.answer[ax] === v));
  }
  return out;
}

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

function makeGenerated(level, only = null, focus = null) {
  let specs = allowedSpecsFocused(level, focus);
  // legacy single-tense lock — kept for callers that still pin one exact tense
  if (only) specs = specs.filter(s => s.time === only.time && s.aspect === only.aspect && s.voice === only.voice);
  if (!specs.length) return null;
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

/* ---------- production structural check (client-side layer 1 / offline fallback) ---------- */
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

export {
  VERBS, LEVEL_GATES, allowedSpecs, allowedSpecsFocused, axisOptionsEn, buildVP,
  tenseName, ASPECT_NAME, makeGenerated, productionResult, functionAccepts,
  FUNCTION_OPTIONS, startLevel,
};
