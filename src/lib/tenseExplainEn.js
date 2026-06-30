/* ============================================================
   Tense Explainer — English content + structure (shared, pure JS)
   ------------------------------------------------------------
   Single source of truth for the cheat-sheet content. Read by:
     • src/components/TenseExplainer.jsx  (the Learn reference)
     • src/components/TenseTagger.jsx     (can import `formulaByName`
        to replace its inline FORMULAS — same formula + short use note)
   Tense NAME keys are computed from (time, aspect, voice) the same
   way the engine's tenseName() does, so the two never drift, and so
   {time,aspect,voice} round-trips to a bank query / a Tagger filter.

   ⚠️ CONTENT NOTE FOR JAMES: the `uses` examples and especially the
   `watchOut` lines are first drafts for your review — that's the
   teacherly layer. Formulas + short `use` are lifted verbatim from
   the Tagger's existing FORMULAS map. British spellings throughout;
   "infinitive" (never "base form"); hospitality flavour where natural.
   ============================================================ */

const ASPECT_NAME = { simple: 'simple', continuous: 'continuous', perfect: 'perfect', perfect_continuous: 'perfect continuous' };

// Canonical display name from the grammar tuple — matches tenseEngineEn.tenseName()
export function tenseKeyName({ time, aspect, voice }) {
  let n = `${time} ${ASPECT_NAME[aspect]}`;
  if (voice === 'passive') n += ' passive';
  return n;
}

/* ---------- the 19 EN tenses, in reading order ----------
   id        stable key (snake_case)
   band      lowest CEFR level the tense appears at (drives the ladder)
   time/aspect/voice   the grammar tuple → name, bank query, Tagger filter
   formula / use        verbatim from the Tagger's FORMULAS
   uses[]    {label, signals[], example}  — the curated spine (handcrafted)
   watchOut  one-line L1-interference / common-error note
*/
const DATA = [
  /* ===== PRESENT ===== */
  {
    id: 'present_simple', band: 'A2', time: 'present', aspect: 'simple', voice: 'active',
    formula: 'subject + infinitive (add -s for he/she/it)', use: 'habits, routines and general facts',
    uses: [
      { label: 'Habits & routines', signals: ['every day', 'usually', 'always', 'never'], example: 'The kitchen opens at seven every morning.' },
      { label: 'General facts & truths', signals: [], example: 'Water boils at one hundred degrees.' },
      { label: 'Timetables (a fixed future)', signals: ['at', 'on', 'tomorrow'], example: 'The train leaves at six tomorrow.' },
    ],
    watchOut: 'For something happening right now, use the present continuous: “I am cleaning the room now”, not “I clean the room now”.',
  },
  {
    id: 'present_continuous', band: 'A2', time: 'present', aspect: 'continuous', voice: 'active',
    formula: 'subject + am/is/are + verb-ing', use: 'actions happening now (or a fixed future arrangement)',
    uses: [
      { label: 'Happening right now', signals: ['now', 'right now', 'at the moment'], example: 'She is serving the guests at the moment.' },
      { label: 'A temporary situation', signals: ['this week', 'these days', 'currently'], example: "I'm working the late shift this week." },
      { label: 'A fixed future arrangement', signals: ['tonight', 'tomorrow', 'on Tuesday'], example: "We're meeting the supplier on Tuesday." },
    ],
    watchOut: 'State verbs (know, want, like, need) are not used in the -ing form: “I know the answer”, not “I am knowing the answer”.',
  },
  {
    id: 'present_perfect', band: 'B1', time: 'present', aspect: 'perfect', voice: 'active',
    formula: 'subject + have/has + past participle', use: 'past actions with present relevance or a present result',
    uses: [
      { label: 'A past action with a present result', signals: ['just', 'already', 'yet'], example: "We've already prepared the conference room." },
      { label: 'Life experience — time not stated', signals: ['ever', 'never', 'before'], example: 'Have you ever worked in a hotel abroad?' },
      { label: 'Something continuing up to now', signals: ['for', 'since', 'so far'], example: "I've worked here for five years." },
    ],
    watchOut: 'Used a finished-time word (yesterday, last week, in 2019)? Switch to past simple — “I saw him yesterday”, not “I have seen him yesterday”.',
  },
  {
    id: 'present_perfect_continuous', band: 'B2', time: 'present', aspect: 'perfect_continuous', voice: 'active',
    formula: 'subject + have/has + been + verb-ing', use: 'an action continuing up to now',
    uses: [
      { label: 'An activity continuing up to now', signals: ['for', 'since', 'all day', 'lately'], example: "I've been working since seven this morning." },
      { label: 'A recent activity behind a present result', signals: [], example: "She's tired because she's been cleaning all day." },
    ],
    watchOut: 'Use the plain present perfect for state verbs and finished results: “I’ve known her for years”, not “I’ve been knowing her”.',
  },
  /* ===== PAST ===== */
  {
    id: 'past_simple', band: 'A2', time: 'past', aspect: 'simple', voice: 'active',
    formula: 'subject + past verb (-ed or irregular)', use: 'finished actions at a definite past time',
    uses: [
      { label: 'A finished action at a known time', signals: ['yesterday', 'last week', 'in 2019', 'ago'], example: 'We cancelled the booking yesterday.' },
      { label: 'A sequence of past events', signals: ['then', 'after that', 'first'], example: 'He took the order, then brought the menu.' },
    ],
    watchOut: 'With a finished-time word, use the past simple, not the present perfect: “I finished it last night”, not “I have finished it last night”.',
  },
  {
    id: 'past_continuous', band: 'A2', time: 'past', aspect: 'continuous', voice: 'active',
    formula: 'subject + was/were + verb-ing', use: 'an action in progress at a past moment',
    uses: [
      { label: 'In progress at a past moment', signals: ['at eight', 'while', 'when'], example: 'At eight o’clock we were serving dinner.' },
      { label: 'A long action interrupted by a short one', signals: ['when', 'while'], example: 'I was cleaning the room when the phone rang.' },
    ],
    watchOut: 'The interruption takes the past simple, not the continuous: “…when she arrived”, not “…when she was arriving”.',
  },
  {
    id: 'past_perfect', band: 'B1', time: 'past', aspect: 'perfect', voice: 'active',
    formula: 'subject + had + past participle', use: 'an action completed before another past action',
    uses: [
      { label: 'The earlier of two past actions', signals: ['already', 'before', 'by the time'], example: 'By the time we arrived, the guests had checked out.' },
      { label: 'After realising or discovering something', signals: ['realised', 'found', 'knew'], example: 'She realised she had left the keys inside.' },
    ],
    watchOut: 'You only need it when the order of two past events matters. For a story told in order, the past simple is enough.',
  },
  {
    id: 'past_perfect_continuous', band: 'B2', time: 'past', aspect: 'perfect_continuous', voice: 'active',
    formula: 'subject + had + been + verb-ing', use: 'an action continuing up to a point in the past',
    uses: [
      { label: 'An activity going on up to a past moment', signals: ['for', 'since', 'before'], example: 'We had been waiting for an hour before the manager came.' },
    ],
    watchOut: 'Like the past perfect, reach for it only when you’re already in the past and want to step further back.',
  },
  /* ===== FUTURE ===== */
  {
    id: 'future_simple', band: 'A2', time: 'future', aspect: 'simple', voice: 'active',
    formula: 'subject + will + infinitive', use: 'predictions, offers and decisions made now',
    uses: [
      { label: 'A prediction', signals: ['I think', 'probably', 'maybe'], example: 'I think the guests will enjoy the view.' },
      { label: 'A decision made right now', signals: [], example: "It's heavy — I'll carry it for you." },
      { label: 'An offer or promise', signals: [], example: "I'll send the confirmation today." },
    ],
    watchOut: 'For plans already made, English prefers “going to” or the present continuous: “We’re meeting at six”, not “We will meet at six”.',
  },
  {
    id: 'future_continuous', band: 'A2', time: 'future', aspect: 'continuous', voice: 'active',
    formula: 'subject + will be + verb-ing', use: 'an action in progress at a future moment',
    uses: [
      { label: 'In progress at a future moment', signals: ['at noon tomorrow', 'this time next week'], example: "At noon tomorrow I'll be checking guests in." },
    ],
    watchOut: 'It means the action is already underway at that time: “I’ll be working at nine” (mid-task), vs “I’ll start at nine” (it begins then).',
  },
  {
    id: 'future_perfect', band: 'B1', time: 'future', aspect: 'perfect', voice: 'active',
    formula: 'subject + will have + past participle', use: 'an action completed before a point in the future',
    uses: [
      { label: 'Finished before a future deadline', signals: ['by', 'by the time', 'before'], example: "By Friday we'll have finished the renovation." },
    ],
    watchOut: 'It needs a future reference point (by Friday, by then). Without one, use the future simple.',
  },
  /* ===== PASSIVES (band B1) ===== */
  {
    id: 'present_simple_passive', band: 'B1', time: 'present', aspect: 'simple', voice: 'passive',
    formula: 'subject + am/is/are + past participle', use: 'a habit or fact — focus on what is done',
    uses: [
      { label: 'Focus on the action, not who does it', signals: ['every day', 'always'], example: 'The rooms are cleaned every morning.' },
    ],
    watchOut: 'Only add “by …” if the doer matters. “Breakfast is served at seven” — the staff are obvious, so no “by” is needed.',
  },
  {
    id: 'present_continuous_passive', band: 'B1', time: 'present', aspect: 'continuous', voice: 'passive',
    formula: 'subject + am/is/are + being + past participle', use: 'an action happening now — passive',
    uses: [
      { label: 'In progress now, doer unimportant', signals: ['now', 'at the moment'], example: 'The room is being cleaned at the moment.' },
    ],
    watchOut: 'Don’t drop “being”: “is being prepared”, not “is prepared” (that would be the simple passive).',
  },
  {
    id: 'present_perfect_passive', band: 'B1', time: 'present', aspect: 'perfect', voice: 'passive',
    formula: 'subject + have/has + been + past participle', use: 'a past action with present relevance — passive',
    uses: [
      { label: 'Just completed, with a present result', signals: ['just', 'already', 'yet'], example: 'The deposit has already been paid.' },
    ],
    watchOut: '“been + past participle” is the passive; “been + -ing” is the active continuous — keep them apart.',
  },
  {
    id: 'past_simple_passive', band: 'B1', time: 'past', aspect: 'simple', voice: 'passive',
    formula: 'subject + was/were + past participle', use: 'a finished past action — focus on what was done',
    uses: [
      { label: 'Completed, doer unknown or unimportant', signals: [], example: 'The booking was cancelled last night.' },
    ],
    watchOut: '“be” carries the tense; the main verb stays a past participle: “was taken”, not “was took”.',
  },
  {
    id: 'past_continuous_passive', band: 'B1', time: 'past', aspect: 'continuous', voice: 'passive',
    formula: 'subject + was/were + being + past participle', use: 'an action in progress in the past — passive',
    uses: [
      { label: 'In progress at a past moment, doer unimportant', signals: ['while', 'when', 'at eight'], example: 'The meal was being prepared when the power went off.' },
    ],
    watchOut: 'Two helpers stack here — “was being” — and both are needed before the participle.',
  },
  {
    id: 'past_perfect_passive', band: 'B1', time: 'past', aspect: 'perfect', voice: 'passive',
    formula: 'subject + had been + past participle', use: 'an action completed before another past action — passive',
    uses: [
      { label: 'An earlier past action, doer unimportant', signals: ['already', 'by the time', 'before'], example: 'By the time we checked, the table had already been booked.' },
    ],
    watchOut: 'Use it only to show one past action happened before another.',
  },
  {
    id: 'future_simple_passive', band: 'B1', time: 'future', aspect: 'simple', voice: 'passive',
    formula: 'subject + will be + past participle', use: 'a future action — passive',
    uses: [
      { label: 'A future action, focus on what is done', signals: [], example: 'Your luggage will be delivered to the room.' },
    ],
    watchOut: 'Keep “be” after “will”: “will be cleaned”, never “will cleaned”.',
  },
  {
    id: 'future_perfect_passive', band: 'B1', time: 'future', aspect: 'perfect', voice: 'passive',
    formula: 'subject + will have been + past participle', use: 'an action completed before a future point — passive',
    uses: [
      { label: 'Finished before a future point, doer unimportant', signals: ['by', 'by the time'], example: 'By next week the pool will have been repaired.' },
    ],
    watchOut: 'Three words build it — “will have been” — all three are needed before the participle.',
  },
];

/* ---------- derived structures + helpers ---------- */
export const TENSES = DATA.map(t => ({ ...t, name: titleCase(tenseKeyName(t)), key: tenseKeyName(t) }));

function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

// formula + short use note, keyed by canonical name — drop-in for the Tagger's FORMULAS
export const formulaByName = Object.fromEntries(
  TENSES.map(t => [t.key, { formula: t.formula, use: t.use }])
);

export const BAND_ORDER = ['A2', 'B1', 'B2', 'C1'];
const bandRank = b => BAND_ORDER.indexOf(b);

// student CEFR level -> their band cap (mirrors engine startLevel grouping)
export function levelBand(level) {
  const l = (level || '').toUpperCase();
  if (l.startsWith('A')) return 'A2';
  if (l === 'B1') return 'B1';
  if (l === 'B2') return 'B2';
  if (l.startsWith('C')) return 'C1';
  return 'B1';
}

// the list the student sees: their band by default, the full ladder when showAll
export function tensesForLevel(level, showAll = false) {
  if (showAll) return TENSES;
  const cap = bandRank(levelBand(level));
  return TENSES.filter(t => bandRank(t.band) <= cap);
}

// {time,aspect,voice} -> tense entry (for the "Practise this" bridge + bank query)
export function findTense({ time, aspect, voice }) {
  const key = tenseKeyName({ time, aspect, voice });
  return TENSES.find(t => t.key === key) || null;
}

export const byId = Object.fromEntries(TENSES.map(t => [t.id, t]));
