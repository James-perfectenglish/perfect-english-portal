/* ============================================================
   Tense Tagger — English generation + marking engine (shared)
   The live component (fallback path) and the bank generator share
   ONE source of truth. Pure JS, no React: importable by Vite and by
   Node scripts.

   ⚠️ SETTING — DOMAINS. Three content domains, weighted by DOMAIN_MIX:
     day    — everyday life: home, food, family, travel, free time.
     hotel  — the workplace. English learners here WORK in hotels;
              this is the mirror image of the Spanish engine, where
              they stay in them.
     biz    — hotel management and office work, with a legal seam at
              B2/C1 (sign, negotiate, draft, amend). The higher-level
              students manage rather than serve, so this is the slice
              that grows with level, not the hotel.

   To shift the balance, change DOMAIN_MIX — not the lexicon.

   ROLE COHERENCE (hotel domain only). NEITHER role is the default:
   an unmarked object is open to anyone, and only NAMED subjects carry a
   role. Bare pronouns carry none, so "I" can both clean the rooms and pay
   the bill — correct per sentence, which is all a tense specimen needs.
     #g  guest      #s  any staff      #r  reception desk      #a  adults only
   `#a` runs the other way: it exists to keep `the children` out of "go to
   work" and "pay the rent". A subject with NO role passes everything, so the
   child is the one that carries a role ('c'), and never matches `#a`.
   `#r` exists because "staff" was too coarse: handing over keys is a
   reception job, and `#s` let the waiter do it. A subject's `r` is a STRING
   OF LETTERS, not one letter, so the receptionist and the manager are 'sr'
   — both staff and reception — while the waiter is 's' alone.
   (Spanish differs: there the learner is always the guest, so guest is
   the default there and staff the exception. Do not copy one to the other.)

   PASSIVE_ONLY — verbs kept for the passive machinery whose active
   voice would put the wrong person in the hotel ("I painted the lobby"
   makes the learner a decorator). Drop a base from that Set to restore
   its active forms.
   ============================================================ */

import { axisAllows } from './tenseFocus.js';

/* ---------- lexicon ----------
   base, s, past, pp, ing, transitive, stative, objects, min

   `transitive` means PASSIVISABLE, and nothing else. `objects` is the
   complement list: a direct object for transitives, a prepositional
   phrase for intransitives ("walk to work"). Splitting the two is what
   stops intransitives generating bare predicates like "We go."
   Only transitive verbs draw their passive subject from `objects`, so
   a PP can never end up fronted as one.

   The semantic Sets below are keyed on `base`, and a base appears in
   more than one domain. INVARIANT: if a base is in ACTIVITY,
   PROCESS_PASSIVE, PUNCTUAL or PASSIVE_ONLY it must behave that way in
   EVERY domain it appears in. Transitivity and level are per-entry and
   may differ freely. */

/* ---------- EVERYDAY: the spine ---------- */
const VERBS_DAY = [
  ['clean','cleans','cleaned','cleaned','cleaning',1,0,['the kitchen','the flat'],'A2'],
  ['cook','cooks','cooked','cooked','cooking',1,0,['dinner','the pasta'],'A2'],
  ['make','makes','made','made','making',1,0,['dinner','a cake'],'A2'],
  ['eat','eats','ate','eaten','eating',1,0,['the cake','the sandwiches'],'A2'],
  ['drink','drinks','drank','drunk','drinking',0,0,['coffee','the water'],'A2'],
  ['buy','buys','bought','bought','buying',1,0,['the food','a present!','the tickets'],'A2'],
  ['watch','watches','watched','watched','watching',0,0,['the film','the news'],'A2'],
  ['read','reads','read','read','reading',0,0,['the newspaper','a book'],'A2'],
  ['call','calls','called','called','calling',0,0,['my sister','the doctor'],'A2'],
  ['meet','meets','met','met','meeting',0,0,['my friends','the neighbours'],'A2'],
  ['visit','visits','visited','visited','visiting',0,0,['my parents','the museum'],'A2'],
  ['help','helps','helped','helped','helping',1,0,['my parents','the neighbours'],'A2'],
  ['study','studies','studied','studied','studying',0,0,['Spanish','the grammar'],'A2'],
  ['play','plays','played','played','playing',0,0,['football','the guitar'],'A2'],
  ['walk','walks','walked','walked','walking',0,0,['to work#a','in the park'],'A2'],
  ['wait','waits','waited','waited','waiting',0,0,['for the bus','at the station'],'A2'],
  ['work','works','worked','worked','working',0,0,['from home#a','in an office#a'],'A2'],
  ['stay','stays','stayed','stayed','staying',0,0,['at home','with friends'],'A2'],
  ['run','runs','ran','run','running',0,0,['in the park','by the sea'],'A2'],
  ['go','goes','went','gone','going',0,0,['to the market','to the beach','to work#a'],'A2'],
  ['take','takes','took','taken','taking',0,0,['the bus','a photo'],'A2'],
  ['arrive','arrives','arrived','arrived','arriving',0,0,['at the station','at the airport'],'A2'],
  ['need','needs','needed','needed','needing',0,1,['more time','a new phone'],'A2'],
  ['write','writes','wrote','written','writing',1,0,['a postcard','an email'],'B1'],
  ['pay','pays','paid','paid','paying',1,0,['the rent#a!','the bills#a!'],'B1'],
  ['fix','fixes','fixed','fixed','fixing',1,0,['the car!','the tap!'],'B1'],
  ['lose','loses','lost','lost','losing',1,0,['my keys','my phone'],'B1'],
  ['find','finds','found','found','finding',1,0,['my keys','a solution'],'B1'],
  ['drive','drives','drove','driven','driving',0,0,['the car','to work#a'],'B1'],
  ['know','knows','knew','known','knowing',0,1,['the answer','the area'],'B1'],
  ['understand','understands','understood','understood','understanding',0,1,['the problem','the rules'],'B1'],
];

/* ---------- HOTEL: the workplace, both roles live ---------- */
const VERBS_HOTEL = [
  ['clean','cleans','cleaned','cleaned','cleaning',1,0,['the rooms#s','the pool#s'],'A2'],
  ['book','books','booked','booked','booking',1,0,['a room#g','a table#g'],'A2'],
  ['serve','serves','served','served','serving',1,0,['breakfast#s','the guests#s'],'A2'],
  ['cook','cooks','cooked','cooked','cooking',1,0,['the meal#s','dinner#s'],'A2'],
  ['pay','pays','paid','paid','paying',1,0,['the bill#g!','the deposit#g!'],'A2'],
  ['take','takes','took','taken','taking',1,0,['the order#s','a message#s'],'A2'],
  ['make','makes','made','made','making',1,0,['a reservation#g','the beds#s'],'A2'],
  ['give','gives','gave','given','giving',1,0,['the keys#r','directions#r'],'A2'],
  ['wait','waits','waited','waited','waiting',0,0,['in reception','at the bar'],'A2'],
  ['stay','stays','stayed','stayed','staying',0,0,['at the hotel','in the suite#g'],'A2'],
  ['work','works','worked','worked','working',0,0,['in the kitchen#s','at the hotel#s'],'A2'],
  ['arrive','arrives','arrived','arrived','arriving',0,0,['at the hotel','at reception'],'A2'],
  ['prepare','prepares','prepared','prepared','preparing',1,0,['the room#s','the bill#s'],'B1'],
  ['deliver','delivers','delivered','delivered','delivering',1,0,['the luggage#s','the order#s'],'B1'],
  ['greet','greets','greeted','greeted','greeting',1,0,['the guests#s','the customers#s'],'B1'],
  ['bring','brings','brought','brought','bringing',1,0,['the menu#s','more towels#s'],'B1'],
  ['cancel','cancels','cancelled','cancelled','cancelling',1,0,['the booking','the reservation'],'B1'],
  ['delay','delays','delayed','delayed','delaying',1,0,['the transfer','the airport pick-up'],'B1'],
  ['show','shows','showed','shown','showing',1,0,['the room#s','some ID#g'],'B1'],
  ['fix','fixes','fixed','fixed','fixing',1,0,['the shower#s!','the lift#s!'],'B1'],
  ['find','finds','found','found','finding',1,0,['the room#g','a solution'],'B1'],
  ['lose','loses','lost','lost','losing',1,0,['the booking#s','the key#g'],'B1'],
  ['complain','complains','complained','complained','complaining',0,0,['about the noise#g','to the manager#g'],'B1'],
  // PASSIVE_ONLY — refurbishment, agent unstated. See the header note.
  ['build','builds','built','built','building',1,0,['the extension','the new terrace'],'B1'],
  ['paint','paints','painted','painted','painting',1,0,['the rooms','the lobby'],'B1'],
];

/* ---------- BUSINESS: hotel management, with a legal seam at B2/C1 ---------- */
const VERBS_BIZ = [
  ['email','emails','emailed','emailed','emailing',1,0,['the team','the supplier'],'A2'],
  ['send','sends','sent','sent','sending',1,0,['the report','the invoice'],'A2'],
  ['check','checks','checked','checked','checking',1,0,['the figures','the rota'],'A2'],
  ['book','books','booked','booked','booking',1,0,['the meeting room','the flights'],'A2'],
  ['help','helps','helped','helped','helping',1,0,['a colleague','the new starter'],'A2'],
  ['write','writes','wrote','written','writing',1,0,['the report','a proposal'],'A2'],
  ['call','calls','called','called','calling',0,0,['the supplier','the client'],'A2'],
  ['work','works','worked','worked','working',0,0,['on the budget','from the office'],'A2'],
  ['prepare','prepares','prepared','prepared','preparing',1,0,['the report','the budget'],'B1'],
  ['discuss','discusses','discussed','discussed','discussing',1,0,['the targets','the budget'],'B1'],
  ['forward','forwards','forwarded','forwarded','forwarding',1,0,['the invoice','the complaint'],'B1'],
  ['hire','hires','hired','hired','hiring',1,0,['a new receptionist','the new manager'],'B1'],
  ['manage','manages','managed','managed','managing',1,0,['the team','the department'],'B1'],
  ['run','runs','ran','run','running',0,0,['the department','the training day'],'B1'],
  ['attend','attends','attended','attended','attending',0,0,['the meeting','the training'],'B1'],
  ['meet','meets','met','met','meeting',0,0,['the client','the supplier'],'B1'],
  ['approve','approves','approved','approved','approving',1,0,['the budget','the invoice'],'B2'],
  ['review','reviews','reviewed','reviewed','reviewing',1,0,['the figures','the contract'],'B2'],
  ['present','presents','presented','presented','presenting',1,0,['the results','the proposal'],'B2'],
  ['sign','signs','signed','signed','signing',1,0,['the contract','the agreement'],'B2'],
  ['negotiate','negotiates','negotiated','negotiated','negotiating',1,0,['the contract','the terms'],'B2'],
  ['draft','drafts','drafted','drafted','drafting',1,0,['the agreement','the clause'],'C1'],
  ['amend','amends','amended','amended','amending',1,0,['the contract','the terms'],'C1'],
];

const toVerb = domain => ([base, s, past, pp, ing, transitive, stative, objects, min]) =>
  ({ base, s, past, pp, ing, transitive: !!transitive, stative: !!stative, objects, min, domain });

const DOMAIN_VERBS = {
  day: VERBS_DAY.map(toVerb('day')),
  hotel: VERBS_HOTEL.map(toVerb('hotel')),
  biz: VERBS_BIZ.map(toVerb('biz')),
};
// flat view, kept for any consumer that wants the whole lexicon
const VERBS = [...DOMAIN_VERBS.day, ...DOMAIN_VERBS.hotel, ...DOMAIN_VERBS.biz];

/* Weighting per level. Change these numbers to shift the balance — the
   lexicon does not need touching. A domain with no verb for the chosen
   spec is dropped and the remaining weights renormalised, so the mix is
   honoured as closely as the grammar allows. */
const DOMAIN_MIX = {
  A2: [['day', 50], ['hotel', 25], ['biz', 25]],
  B1: [['day', 50], ['hotel', 25], ['biz', 25]],
  B2: [['day', 50], ['hotel', 25], ['biz', 25]],
  C1: [['day', 50], ['hotel', 25], ['biz', 25]],
};

// Semantic gates (keep generated sentences natural):
//  ACTIVITY        — sustained activities that read well in the perfect continuous
//  PROCESS_PASSIVE — things naturally described as a process "being done" (continuous passive)
//  PUNCTUAL        — instantaneous verbs that read oddly in any continuous ("is finding")
//  PASSIVE_ONLY    — generated in the passive only (see the header note)
const ACTIVITY = new Set(['clean','cook','serve','prepare','fix','deliver','drive','watch','read',
  'write','work','wait','stay','run','study','play','walk','help','manage','review','negotiate','draft']);
const PROCESS_PASSIVE = new Set(['clean','cook','serve','prepare','build','paint','fix','deliver','write','review','draft','send']);
const PUNCTUAL = new Set(['find','lose']);
const PASSIVE_ONLY = new Set(['build','paint']);

/* ⚠️ THE ONE-OFF AXIS. The lexicon knew whether a verb was transitive,
   stative, punctual and durative — not whether its event REPEATS. Without
   that, the present simple (the habitual tense) happily produced "My sister
   buys a present every morning", "My parents lose my phone each week" and
   "The agreement is signed every morning". A one-off event is therefore kept
   out of the present simple altogether, in both voices.

   Some objects carry it rather than the verb: you can buy the shopping every
   week but not a present, so `!` marks a one-off OBJECT and those are dropped
   from the choice list for the same specs. Suffix order is `#s!` / `#g!`.

   NOT_FUTURE is narrower and separate: `lose` is INVOLUNTARY, so predicting
   it is odd whatever the aspect ("I will lose the key", "My phone will have
   been lost by Friday"). Being a one-off is not the same as being unwilled. */
const ONE_OFF = new Set(['lose','find','sign','hire','cancel','amend','draft','build','paint']);

/* ⚠️ ROUTINE — the opposite failure to ONE_OFF, and the same one the Spanish
   engine calls `routine`. These happen constantly, so reporting a SINGLE
   instance over a week or a month is pointless: "breakfast has been served
   this month", "the customers have been greeted this month". Base-keyed, so
   the INVARIANT is the usual one — a base listed here must be routine in
   every domain it appears in. `make` is deliberately absent: making dinner is
   routine, making a reservation is not. */
const ROUTINE = new Set(['serve','greet','arrive','eat','drink','cook','clean',
  'wait','go','walk','read','watch','email','check']);
const WIDE_WINDOW = new Set(['this week','this month']);
const NOT_FUTURE = new Set(['lose']);
const isHabitualSpec = spec => spec.aspect === 'simple' && spec.time === 'present';

const LEVEL_RANK = { A2: 0, B1: 1, B2: 2, C1: 3 };

/* Subjects are per-domain. `r` is the hotel role — 's' staff, 'g' guest —
   and only NAMED subjects carry one. Bare pronouns are role-free by
   design, so every hotel verb stays reachable from the learner's own voice. */
const SUBJECTS_DAY = [
  ['I',1,'sg'], ['you',2,'pl'], ['he',3,'sg'], ['she',3,'sg'], ['we',1,'pl'], ['they',3,'pl'],
  ['my friend',3,'sg'], ['my sister',3,'sg'], ['my neighbour',3,'sg'],
  ['my parents',3,'pl'], ['the children',3,'pl','c'],
];
const SUBJECTS_HOTEL = [
  ['I',1,'sg'], ['you',2,'pl'], ['he',3,'sg'], ['she',3,'sg'], ['we',1,'pl'], ['they',3,'pl'],
  ['the manager',3,'sg','sr'], ['the receptionist',3,'sg','sr'],
  ['the waiter',3,'sg','s'], ['the housekeeper',3,'sg','s'],
  ['the guests',3,'pl','g'], ['the customers',3,'pl','g'], ['the new guest',3,'sg','g'],
];
const SUBJECTS_BIZ = [
  ['I',1,'sg'], ['you',2,'pl'], ['he',3,'sg'], ['she',3,'sg'], ['we',1,'pl'], ['they',3,'pl'],
  ['the manager',3,'sg'], ['the team',3,'sg'], ['my colleague',3,'sg'],
  ['the director',3,'sg'], ['the client',3,'sg'],
];
const toSubject = ([text, person, number, r]) => ({ text, person, number, r: r || null });
const DOMAIN_SUBJECTS = {
  day: SUBJECTS_DAY.map(toSubject),
  hotel: SUBJECTS_HOTEL.map(toSubject),
  biz: SUBJECTS_BIZ.map(toSubject),
};

/* Adverbials, all final-position and invariant for person and number.
   Thin sets show badly at bank scale: dedup is on the whole sentence
   string, so a tense with one adverbial can only produce as many
   distinct sentences as it has subject × verb × object combinations.
   `past_perfect` carries its own anchor clause ("before we left") —
   English lets that sit at the end, so the past-before-the-past needs
   no sentence frame and the pre/vp/post round-trip is untouched.
   (Spanish needs a prefix frame for the same job.) */
const ADVERBIALS = [
  ['every day', ['habitual']],
  ['each week', ['habitual']],
  ['every morning', ['habitual']],
  ['twice a week', ['habitual']],
  ['on Mondays', ['habitual']],
  ['yesterday', ['past_simple']],
  ['last night', ['past_simple']],
  ['last week', ['past_simple']],
  ['on Friday', ['past_simple']],
  ['an hour ago', ['past_simple']],
  ['at eight o\u2019clock', ['past_continuous']],
  ['all morning', ['past_continuous','duration']],
  ['at the time', ['past_continuous']],
  // ⚠️ NOTHING that can read as a future arrangement belongs on `now`.
  // "She is taking a message this afternoon" is the present continuous used
  // for a FUTURE plan, while the generated key says the time is present —
  // the exact form≠function contrast the curated C1 bank exists to teach,
  // produced here with a wrong answer key. Bare present continuous is fine.
  ['right now', ['now']],
  ['at the moment', ['now']],
  ['this week', ['present_perfect']],
  ['this morning', ['present_perfect']],
  ['this afternoon', ['present_perfect']],
  ['today', ['present_perfect']],
  ['this month', ['present_perfect']],
  ['for ages', ['duration']],
  ['for two hours', ['duration']],
  ['since Monday', ['duration','since']],
  ['since March', ['duration','since']],
  ['all week', ['duration']],
  ['before then', ['past_perfect']],
  ['earlier that day', ['past_perfect']],
  ['before we left', ['past_perfect']],
  ['by the time we got there', ['past_perfect']],
  ['tomorrow', ['future']],
  ['next week', ['future']],
  ['on Monday', ['future']],
  ['later today', ['future']],
  ['by Friday', ['future_perfect']],
  ['by six o\u2019clock', ['future_perfect']],
  ['by the end of the day', ['future_perfect']],
  ['by then', ['future_perfect']],
].map(([text, tags]) => ({ text, tags }));

function adverbTagsFor(time, aspect) {
  if (aspect === 'perfect_continuous') return ['duration'];      // always a duration phrase
  if (aspect === 'perfect') {
    if (time === 'future') return ['future_perfect'];
    if (time === 'past') return ['past_perfect'];
    // The present perfect SIMPLE takes a window, never a stretch. "Has
    // studied the grammar all morning" wants the continuous, and that is
    // exactly what the continuous is for. States are the exception and get
    // `since` back in adverbialsForVerb ("has known the answer since March").
    return ['present_perfect'];
  }
  if (time === 'present') return aspect === 'continuous' ? ['now'] : ['habitual'];
  if (time === 'past') return aspect === 'continuous' ? ['past_continuous'] : ['past_simple'];
  return ['future'];
}
const adverbialsFor = tags => ADVERBIALS.filter(a => a.tags.some(t => tags.includes(t)));

/* A state does not recur on a schedule, and it is not measured out in hours:
   "I know the answer every morning" and "She has understood the problem all
   morning" are both wrong for the same reason. Statives keep the `since`-type
   and window adverbials, which they take perfectly well ("known since March").
   (The Spanish engine calls this FREQ_ADVERBS; this adds the `for` half.) */
const STATIVE_BANNED = new Set(['every day','each week','every morning','twice a week','on Mondays',
  'for ages','for two hours','all morning','all week']);
const adverbialsForVerb = (tags, verb) => {
  const t = verb.stative && tags.includes('present_perfect') ? [...tags, 'since'] : tags;
  let list = adverbialsFor(t);
  if (ROUTINE.has(verb.base)) list = list.filter(a => !WIDE_WINDOW.has(a.text));
  if (verb.stative) list = list.filter(a => !STATIVE_BANNED.has(a.text));
  return list;
};

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
const isPlural = s => /s\s*$/.test(s.trim()) &&
  !/\b(news|breakfast|bus|class|gas|lens|address|business|process)$/.test(s.trim());
const ASPECT_NAME = { simple: 'simple', continuous: 'continuous', perfect: 'perfect', perfect_continuous: 'perfect continuous' };

function tenseName(item) {
  const a = item.answer;
  let n = `${a.time} ${ASPECT_NAME[a.aspect]}`;
  if (a.voice === 'passive') n += ' passive';
  return n;
}

/* ⚠️ THE BASE = PAST TRAP. For a handful of English verbs the base form
   and the past form are the same string — `read` is the one in this
   lexicon, and `cut`, `put`, `set`, `cost`, `hit`, `let` would join it if
   they were ever added. Outside the third person singular ("he reads" /
   "he read" disambiguate on their own), "They read the report." is BOTH
   present simple and past simple, while the answer key holds one. That is
   the worst kind of specimen: the student is marked wrong for being right.
   Such sentences therefore carry a compulsory time adverbial. Perfect,
   continuous and future forms are safe — the auxiliary carries the tense.
   (This is the English twin of the Spanish nosotros trap, and it is almost
   certainly sitting in the existing bank.) */
const baseEqualsPast = v => v.past === v.base;
const ambiguousWithoutAdverb = (verb, spec, person, number) =>
  baseEqualsPast(verb) &&
  spec.voice === 'active' && spec.aspect === 'simple' &&
  (spec.time === 'past' || spec.time === 'present') &&
  !(person === 3 && number === 'sg');

// a subject cannot be its own object ("The guests greeted the guests").
// match on the bare head noun, so "the client" also rules out "the clients".
const headOf = t => t.trim().replace(/^(the|a|an|my|our)\s+/, '').replace(/s$/, '');

/* Verbs that can carry a given spec, before any domain choice. Domain is
   decided AFTER this filter, from what survives: a domain with no verb for
   the spec is dropped and the remaining DOMAIN_MIX weights renormalised.
   Rolling the domain first instead would hit an empty pool, silently retry,
   and bias the mix away from that domain without saying so. */
function poolFor(spec, level) {
  const passive = spec.voice === 'passive';
  const continuous = spec.progressive;
  const perfCont = spec.perfect && spec.progressive;
  let pool = VERBS.filter(v => LEVEL_RANK[v.min] <= LEVEL_RANK[level]);
  if (passive) pool = pool.filter(v => v.transitive && v.objects.length);
  else pool = pool.filter(v => !PASSIVE_ONLY.has(v.base));
  if (continuous) pool = pool.filter(v => !v.stative && !PUNCTUAL.has(v.base));
  if (perfCont) pool = pool.filter(v => ACTIVITY.has(v.base));            // sustained activities only
  if (continuous && passive) pool = pool.filter(v => PROCESS_PASSIVE.has(v.base)); // natural "being done" verbs
  if (isHabitualSpec(spec)) pool = pool.filter(v => !ONE_OFF.has(v.base));  // the habitual tense needs a repeatable event
  if (spec.time === 'future') pool = pool.filter(v => !NOT_FUTURE.has(v.base));
  return pool;
}

function pickDomain(pool, level) {
  const byDomain = {};
  for (const v of pool) (byDomain[v.domain] = byDomain[v.domain] || []).push(v);
  const mix = (DOMAIN_MIX[level] || DOMAIN_MIX.B1).filter(([d]) => byDomain[d]?.length);
  if (!mix.length) return null;
  const total = mix.reduce((n, [, w]) => n + w, 0);
  let roll = Math.random() * total, domain = mix[0][0];
  for (const [d, w] of mix) { if (roll < w) { domain = d; break; } roll -= w; }
  return byDomain[domain];
}

function makeGenerated(level, only = null, focus = null) {
  let specs = allowedSpecsFocused(level, focus);
  // legacy single-tense lock — kept for callers that still pin one exact tense
  if (only) specs = specs.filter(s => s.time === only.time && s.aspect === only.aspect && s.voice === only.voice);
  if (!specs.length) return null;
  for (let tries = 0; tries < 50; tries++) {
    const spec = rand(specs);
    const passive = spec.voice === 'passive';
    const perfCont = spec.perfect && spec.progressive;

    const pool = poolFor(spec, level);
    if (!pool.length) continue;
    const domainPool = pickDomain(pool, level);
    if (!domainPool) continue;
    const verb = rand(domainPool);

    // the object's role decides who can plausibly be the subject: `#s` staff,
    // `#g` guest, unmarked open to either. Only the hotel domain marks any.
    const objChoices = isHabitualSpec(spec)
      ? verb.objects.filter(o => !o.endsWith('!'))   // a one-off object is not a habit either
      : verb.objects;
    if (verb.objects.length && !objChoices.length) continue;
    const objRaw = objChoices.length ? rand(objChoices) : '';
    const role = (objRaw.match(/#([sgra])!?$/) || [])[1] || null;
    const objText = objRaw.replace(/!$/, '').replace(/#[sgra]$/, '');

    let person, number, subjectText, objectText = '';
    if (passive) {
      if (!objText) continue;
      subjectText = objText;
      person = 3; number = isPlural(subjectText) ? 'pl' : 'sg';
    } else {
      const subjects = DOMAIN_SUBJECTS[verb.domain];
      const ok = subjects.filter(s =>
        (!role || !s.r || s.r.includes(role)) &&
        !(objText && headOf(objText) === headOf(s.text)));
      if (!ok.length) continue;
      const subj = rand(ok);
      subjectText = subj.text; person = subj.person; number = subj.number;
      // The complement is KEPT in the perfect continuous. Dropping it read well
      // for "I have been working for ages" but stranded every transitive:
      // "The manager has been fixing for two hours" delivers no object. No
      // ACTIVITY verb carries a time phrase as its complement, so it cannot
      // collide with the compulsory duration adverbial.
      if (objText) objectText = objText;
    }

    const vp = buildVP(verb, spec, person, number);
    const advChoices = adverbialsForVerb(adverbTagsFor(spec.time, spec.aspect), verb);
    // Four cases where an adverbial is not optional: a duration phrase is the
    // whole point of the perfect continuous; the past and future perfect need
    // a reference point to sit before or by ("The children had understood the
    // rules." floats); a base=past verb is ambiguous without a time cue; and a
    // bare intransitive predicate ("We go.") is not worth showing.
    const perfectAnchor = spec.perfect && !spec.progressive && spec.time !== 'present';
    // A bare present simple reads as a single event ("My parents buy a
    // present."), which is the one thing the habitual tense must not say. In
    // the passive it reads as an adjective instead — "Dinner is cooked."
    // describes the dinner, not the cooking. Statives are exempt: they take
    // no frequency phrase and need none.
    const habitualCue = isHabitualSpec(spec) && !verb.stative;
    const forced = perfCont || perfectAnchor || habitualCue
      || ambiguousWithoutAdverb(verb, spec, person, number)
      || (!objectText && !passive);
    let adv = '';
    if (forced) {
      if (!advChoices.length) continue;
      adv = rand(advChoices).text;
    } else if (advChoices.length && Math.random() < 0.7) {
      adv = rand(advChoices).text;
    }

    const pre = cap(subjectText) + ' ';
    const post = (objectText ? ' ' + objectText : '') + (adv ? ' ' + adv : '') + '.';
    return { kind: 'generated', pre, vp, post, answer: spec.answer,
      functionTime: spec.answer.time, note: null, isMismatch: false,
      domain: verb.domain, verb: verb.base };
  }
  return null;
}

/* ---------- production structural check (client-side layer 1 / offline fallback) ----------
   The participle alternation is built FROM the lexicon rather than guessed at
   with a suffix pattern. The old pattern missed `paid`, `made`, `read`, `found`
   and `understood`, so a student typing a correct passive with one of those
   verbs was told the structure was wrong before the AI marker ever saw it. */
const PP_LIST = [...new Set(VERBS.map(v => v.pp))].sort((a, b) => b.length - a.length).join('|');

function productionResult(text, item) {
  const s = ' ' + text.toLowerCase().trim().replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[.!?,]/g, '') + ' ';
  const { time, aspect, voice } = item.answer;
  const ING = '[a-z]+ing';
  const PP = `(?:${PP_LIST}|[a-z]+ed|[a-z]+en)`;
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
  VERBS, DOMAIN_VERBS, DOMAIN_SUBJECTS, DOMAIN_MIX, LEVEL_RANK,
  LEVEL_GATES, allowedSpecs, allowedSpecsFocused, axisOptionsEn, buildVP,
  tenseName, ASPECT_NAME, makeGenerated, productionResult, functionAccepts,
  FUNCTION_OPTIONS, startLevel,
};
