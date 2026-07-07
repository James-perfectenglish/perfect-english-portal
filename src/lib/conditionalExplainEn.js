/* ============================================================
   Conditionals Explainer — English content + structure (pure JS)
   ------------------------------------------------------------
   Single source of truth for the conditionals reference. Read by:
     • src/components/ConditionalExplainer.jsx (the Learn reference)
     • src/ConditionalChooser.jsx  (the 📖 "See the full card" overlay —
        card ids are stored in the bank as tags[1] on conditional_chooser
        questions, so a question can always open its own card)

   Card ids are THE keys: zero · first · second · third · mixed ·
   unless · inversion. The bank's tags[1] must use them exactly.

   ⚠️ CONTENT NOTE FOR JAMES: every gloss, example, negative row and
   watch-out is a first draft for your review — the teacherly layer.
   British spellings throughout; "infinitive" (never "base form");
   "auxiliary verb" (never "helper verb"); hospitality flavour where
   natural. Negatives are woven into every card (your ruling, 6 Jul).
   ============================================================ */

/* ---------- the 7 EN conditionals, in reading order ----------
   id        stable key (snake-free, also the bank's tags[1] value)
   band      lowest CEFR level the structure appears at (drives the ladder)
   group     'real' | 'unreal' | 'beyond' — the page sections
   short     compact name (the Sentence Challenge produce pill)
   timeline  shape key for ConditionalTimeline (null = no timeline)
   formula / use   the header line + collapsed-row gloss
   uses[]    {label, signals[], example} — the curated spine
   negative  {formula, examples[]} — first-class, on every card
   watchOuts[]  short L1-interference / common-error notes
*/
const DATA = [
  /* ===== REAL ===== */
  {
    id: 'zero', band: 'A2', group: 'real',
    name: 'Zero conditional', short: 'zero conditional', timeline: 'zero',
    formula: 'If + present simple, … present simple',
    use: 'things that are always true',
    uses: [
      { label: 'General truths & facts', signals: ['if', 'when'], example: 'If you heat ice, it melts.' },
      { label: 'Habits & routines', signals: ['when', 'whenever'], example: 'When the restaurant is full, we open the terrace.' },
      { label: 'Rules & instructions', signals: ['if'], example: 'If a guest asks for a late checkout, call reception first.' },
    ],
    negative: {
      formula: "If + don't / doesn't …, … present simple",
      examples: [
        "If you don't water the plants, they die.",
        "If guests don't confirm by six, we release the room.",
      ],
    },
    watchOuts: [
      'Both halves stay in the present simple — no *will*: "If you heat ice, it melts", not "it will melt".',
      'In the zero conditional, *if* and *when* mean the same thing — it happens every time.',
    ],
  },
  {
    id: 'first', band: 'A2', group: 'real',
    name: 'First conditional', short: 'first conditional', timeline: 'first',
    formula: 'If + present simple, will + infinitive',
    use: 'a real possibility in the future',
    uses: [
      { label: 'A real future possibility', signals: ['if', 'tomorrow', 'tonight'], example: "If it rains tomorrow, we'll move the tables inside." },
      { label: 'Promises, offers & warnings', signals: [], example: "If you help me close the bar, I'll give you a lift home." },
      { label: 'With an imperative or a modal', signals: [], example: 'If you see Mr Romero, tell him his taxi has arrived.' },
    ],
    negative: {
      formula: "If + don't / doesn't …, won't + infinitive",
      examples: [
        "If you don't hurry, you'll miss the flight.",
        "We won't get the booking if we don't reply today.",
      ],
    },
    watchOuts: [
      'The *if* half stays in the present — never "If I will see him". Good news for Spanish speakers: it works exactly like *si* + presente.',
      'The result half is flexible: *will*, an imperative ("…tell him"), or a modal ("…we might cancel") all work.',
    ],
  },
  /* ===== UNREAL ===== */
  {
    id: 'second', band: 'B1', group: 'unreal',
    name: 'Second conditional', short: 'second conditional', timeline: 'second',
    formula: 'If + past simple, would + infinitive',
    use: 'an imaginary or unlikely present / future',
    uses: [
      { label: 'An imaginary present or future', signals: ['if'], example: 'If I had more time, I would learn German.' },
      { label: 'Unlikely or impossible situations', signals: [], example: 'If we owned the building, we would renovate the whole ground floor.' },
      { label: 'Advice with "If I were you"', signals: ['If I were you'], example: "If I were you, I'd ask for a pay rise." },
    ],
    negative: {
      formula: "If + didn't …, wouldn't + infinitive",
      examples: [
        "If I didn't work here, I wouldn't know any of you.",
        "She wouldn't stay if she didn't love the job.",
      ],
    },
    watchOuts: [
      '*Would* never goes in the *if* half: "If I had time", not "If I would have time" — the *si tendría* trap, wrong in Spanish and in English.',
      'Past form, present meaning — "If I had time" is about NOW, not the past.',
      'In "If I / he / she were", *were* is the safe choice in writing; you will hear *was* in speech.',
    ],
  },
  {
    id: 'third', band: 'B2', group: 'unreal',
    name: 'Third conditional', short: 'third conditional', timeline: 'third',
    formula: 'If + past perfect, would have + past participle',
    use: 'an imagined different past — regret and criticism',
    uses: [
      { label: 'An imagined different past', signals: ['if'], example: 'If I had known about the meeting, I would have come.' },
      { label: 'Regret', signals: [], example: 'If we had booked earlier, we would have got the sea-view room.' },
      { label: 'Criticism', signals: [], example: 'If you had checked the rota, you would have seen the change.' },
    ],
    negative: {
      formula: "If + hadn't …, wouldn't have + past participle",
      examples: [
        "If you hadn't helped me, I wouldn't have finished on time.",
        "We wouldn't have lost the client if the email hadn't gone to spam.",
      ],
    },
    watchOuts: [
      'Write *would have* (or *would\'ve*) — never "would of".',
      '*Would* still never enters the *if* half: "If I had known", not "If I would have known".',
    ],
  },
  {
    id: 'mixed', band: 'C1', group: 'unreal',
    name: 'Mixed conditionals', short: 'mixed conditional', timeline: 'mixed',
    formula: 'If + past perfect, would + infinitive  ·  If + past simple, would have + past participle',
    use: 'condition and result in different times',
    uses: [
      { label: 'Past condition → present result', signals: ['now', 'today'], example: 'If I had studied medicine, I would be a doctor now.' },
      { label: 'Present condition → past result', signals: [], example: "If I weren't so disorganised, I wouldn't have lost the tickets." },
    ],
    negative: {
      formula: 'The negative works in either half, in either direction',
      examples: [
        "If we hadn't missed that flight, we would be in Rome now.",
        "If he didn't talk so much, the meeting would have finished an hour ago.",
      ],
    },
    watchOuts: [
      'Ask two questions: WHEN is the condition, and WHEN is the result? Then match each half to its own time.',
      'A time word like *now* or *yesterday* in one half is usually the clue that the times are mixed.',
    ],
  },
  /* ===== BEYOND "IF" ===== */
  {
    id: 'unless', band: 'B1', group: 'beyond',
    name: 'Unless, as long as & in case', short: 'unless', timeline: null,
    formula: 'unless = if … not',
    use: 'other words that start a condition',
    uses: [
      { label: 'unless = if not', signals: ['unless'], example: "Unless we leave now, we'll miss the train. (= If we don't leave now…)" },
      { label: 'as long as / provided that = only if', signals: ['as long as', 'provided that'], example: "You can borrow the car as long as you're back by ten." },
      { label: 'in case = preparation, not condition', signals: ['in case'], example: 'Take an umbrella in case it rains.' },
    ],
    negative: {
      formula: "unless already contains the *not* — don't add another",
      examples: [
        "Unless you book, you won't get a table. (never \u201cUnless you don't book…\u201d)",
      ],
    },
    watchOuts: [
      '*In case* is not *if*: "Take an umbrella in case it rains" (you prepare BEFORE) vs "Open it if it rains" (you act AFTER).',
      '*Unless* pairs naturally with the first and second conditionals; with the third it sounds heavy — prefer *if … not*.',
    ],
  },
  {
    id: 'inversion', band: 'C1', group: 'beyond',
    name: 'Formal inversion', short: 'formal inversion', timeline: null,
    formula: 'Had I known…  ·  Should you need…  ·  Were I to…',
    use: 'formal conditionals without "if"',
    uses: [
      { label: 'Had + subject + past participle (= third conditional)', signals: ['Had'], example: 'Had we received the invoice, we would have paid it immediately.' },
      { label: 'Should + subject + infinitive (= first conditional, extra polite)', signals: ['Should'], example: 'Should you need anything else, please contact reception.' },
      { label: 'Were + subject + to + infinitive (= second conditional)', signals: ['Were'], example: 'Were the client to cancel, we would lose the deposit.' },
    ],
    negative: {
      formula: '*not* stays after the subject — it never contracts onto the verb',
      examples: [
        'Had I not seen it myself, I would never have believed it. (never \u201cHadn\u2019t I seen…\u201d)',
        'Should you not receive the code, call this number.',
      ],
    },
    watchOuts: [
      'This is the register of formal emails, contracts and hotel signage — in speech, plain *if* is more natural.',
      'Only *had*, *should* and *were* invert like this.',
    ],
  },
];

/* ---------- derived structures + helpers ---------- */
export const CONDITIONALS = DATA;
export const byId = Object.fromEntries(DATA.map(c => [c.id, c]));

export const GROUP_ORDER = ['real', 'unreal', 'beyond'];
export const GROUP_LABEL = { real: 'Real', unreal: 'Unreal — imagined', beyond: 'Beyond \u201cif\u201d' };

export const BAND_ORDER = ['A2', 'B1', 'B2', 'C1'];
const bandRank = b => BAND_ORDER.indexOf(b);

// student CEFR level -> their band cap (same grouping as tenseExplainEn)
export function levelBand(level) {
  const l = (level || '').toUpperCase();
  if (l.startsWith('A')) return 'A2';
  if (l === 'B1') return 'B1';
  if (l === 'B2') return 'B2';
  if (l.startsWith('C')) return 'C1';
  return 'B1';
}

// the list the student sees: their band by default, the full ladder when showAll
export function conditionalsForLevel(level, showAll = false) {
  if (showAll) return DATA;
  const cap = bandRank(levelBand(level));
  return DATA.filter(c => bandRank(c.band) <= cap);
}
