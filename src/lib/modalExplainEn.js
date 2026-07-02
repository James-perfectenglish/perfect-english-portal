/* ============================================================
   Modal Explainer — English content + structure (shared, pure JS)
   ------------------------------------------------------------
   Single source of truth for the modal cheat-sheet content. Read by:
     • src/components/ModalExplainer.jsx  (the Learn reference)
   Card-per-modal. Each card lists that modal's main uses; every use
   is tagged with a FUNCTION that matches a Modal Chooser pill, so the
   reference and the practice drill teach the same names.

   ⚠️ CONTENT NOTE FOR JAMES: the `gloss`, `contrast` and especially the
   `watchOut` lines are first drafts for your review — the teacherly layer.
   `watchOut` targets Spanish-L1 traps (no "to" after core modals, must vs
   have to, mustn't vs don't have to, etc.). British spellings throughout;
   "infinitive" (never "base form"); hospitality flavour where natural.
   Function names in `fn` must stay aligned with the Chooser's 14 pills.
   ============================================================ */

/* Function-pill palette — kept identical to ModalChooser.jsx PILL_STYLES so a
   pill looks the same in the reference and the drill. (If these ever move into
   BadgePill.jsx, both should import from there.) */
export const FUNCTION_STYLES = {
  'ability':               { bg: '#EBF8FF', fg: '#2B6CB0', bd: '#63B3ED' },
  'permission':            { bg: '#F0FFF4', fg: '#276749', bd: '#68D391' },
  'possibility':           { bg: '#E0F2FE', fg: '#0369A1', bd: '#7DD3FC' },
  'deduction':             { bg: '#FAF5FF', fg: '#6B21A8', bd: '#D6BCFA' },
  'deduction — negative':  { bg: '#F3E8FF', fg: '#553C9A', bd: '#C4B5FD' },
  'obligation':            { bg: '#FFFAF0', fg: '#C05621', bd: '#F6AD55' },
  'prohibition':           { bg: '#FEE2E2', fg: '#C53030', bd: '#FC8181' },
  'absence of obligation': { bg: '#E6FFFA', fg: '#2C7A7B', bd: '#4FD1C5' },
  'advice':                { bg: '#EEF2FF', fg: '#3730A3', bd: '#A5B4FC' },
  'warning':               { bg: '#FFFBEB', fg: '#92400E', bd: '#FBBF24' },
  'request':               { bg: '#FFF1F2', fg: '#BE123C', bd: '#FDA4AF' },
  'offer':                 { bg: '#FDF2F8', fg: '#9D174D', bd: '#F9A8D4' },
  'annoying habit':        { bg: '#F1F5F9', fg: '#334155', bd: '#CBD5E1' },
  'hypothetical wish':     { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' },
  'expectation':           { bg: '#FAF5FF', fg: '#6B21A8', bd: '#D6BCFA' },
  'suggestion':            { bg: '#FDF2F8', fg: '#9D174D', bd: '#F9A8D4' },
};

/* ---------- the modal cards ----------
   id        stable key (snake_case)
   modal     display name
   band      lowest CEFR level the modal commonly appears at (a badge only)
   forms     positive / negative shown in the header
   uses[]    {fn, form, gloss, example}  — fn matches a Chooser pill
   contrast  optional one-line key contrast (the classic confusions)
   watchOut  L1-interference / common-error note  (James's turf)
*/
const DATA = [
  /* ===== ABILITY, PERMISSION & POSSIBILITY ===== */
  {
    id: 'can', modal: 'can', band: 'A2', forms: 'can · can’t (cannot)',
    uses: [
      { fn: 'ability', form: 'can', gloss: 'what you are able to do now', example: 'She can speak four languages.' },
      { fn: 'permission', form: 'can', gloss: 'saying something is allowed (everyday)', example: 'You can park here after six.' },
      { fn: 'possibility', form: 'can', gloss: 'what is generally or typically possible', example: 'It can get very busy at weekends.' },
      { fn: 'request', form: 'can', gloss: 'asking someone to do something (informal)', example: 'Can you pass me the keys?' },
      { fn: 'prohibition', form: "can't", gloss: 'saying something is not allowed', example: "Guests can't use the staff lift." },
      { fn: 'deduction — negative', form: "can't", gloss: 'concluding something is impossible', example: "That can't be right — he left hours ago." },
    ],
    contrast: '“can’t” does two very different jobs: forbidding (You can’t park here) and concluding something is impossible (That can’t be true).',
    watchOut: 'No “to” and no “-s” after can: “She can help”, not “She can to help” or “She cans help”. For future ability, use “will be able to”: “I’ll be able to help tomorrow”, not “I can help tomorrow”.',
  },
  {
    id: 'could', modal: 'could', band: 'A2', forms: 'could · couldn’t',
    uses: [
      { fn: 'ability', form: 'could', gloss: 'past ability — something you were able to do over a period', example: 'When I was younger, I could run for hours.' },
      { fn: 'possibility', form: 'could', gloss: 'a possible situation (a little less certain)', example: 'The parcel could be in the back office.' },
      { fn: 'permission', form: 'could', gloss: 'asking permission politely', example: 'Could I use the phone for a moment?' },
      { fn: 'request', form: 'could', gloss: 'a polite request', example: 'Could you pass me the room keys?' },
      { fn: 'hypothetical wish', form: 'could', gloss: 'wishing for an ability you don’t have (if only + could)', example: 'If only you could speak a little Spanish.' },
      { fn: 'deduction — negative', form: "couldn't", gloss: 'concluding something was impossible', example: "She couldn't have gone far — she was here a minute ago." },
    ],
    contrast: '“could” is not always past — it also softens requests and permission in the present (Could you…?, Could I…?).',
    watchOut: 'For a single past achievement, use “was able to / managed to”, not “could”: “I managed to book a table”, not “I could book a table”. “Could” is for general past ability.',
  },
  {
    id: 'may', modal: 'may', band: 'B1', forms: 'may · may not',
    uses: [
      { fn: 'permission', form: 'may', gloss: 'formal permission — allowing or being allowed', example: 'Guests may use the pool until ten.' },
      { fn: 'possibility', form: 'may', gloss: 'saying something is possible', example: 'It may rain before lunch.' },
      { fn: 'advice', form: 'may want to', gloss: 'soft, indirect advice', example: 'You may want to book early.' },
    ],
    contrast: '“may” is the formal cousin of “can” for permission — notices and rules use it (Guests may…).',
    watchOut: '“may” for permission is formal; in everyday speech English speakers say “can”. Don’t overuse “may” — it sounds stiff in casual conversation.',
  },
  {
    id: 'might', modal: 'might', band: 'B1', forms: 'might · might not',
    uses: [
      { fn: 'possibility', form: 'might', gloss: 'saying something is possible but uncertain', example: 'She might be in the garden.' },
      { fn: 'advice', form: 'might want to', gloss: 'soft, indirect advice', example: 'You might want to double-check the address.' },
    ],
    contrast: '“might” and “may” are almost interchangeable for possibility; “might” feels a touch less certain.',
    watchOut: '“might” is not the past of “may” here — both talk about the present or future. And no “to”: “It might rain”, not “It might to rain”.',
  },

  /* ===== OBLIGATION, PROHIBITION & NECESSITY ===== */
  {
    id: 'must', modal: 'must', band: 'A2', forms: 'must · mustn’t',
    uses: [
      { fn: 'obligation', form: 'must', gloss: 'a strong obligation — often the speaker’s own rule, or a written rule', example: 'All guests must show ID at check-in.' },
      { fn: 'deduction', form: 'must', gloss: 'a confident conclusion from evidence', example: 'The lights are off — they must be away.' },
      { fn: 'prohibition', form: "mustn't", gloss: 'forbidding something', example: "You mustn't smoke inside." },
    ],
    contrast: '“mustn’t” (forbidden) is NOT the opposite of “must” (obligation). The “no obligation” opposite is “don’t have to”. Compare: You mustn’t tip (forbidden) vs You don’t have to tip (optional).',
    watchOut: 'No “to” after must: “You must show ID”, not “You must to show ID”. For past deduction, use “must have + past participle”: “He must have left already.”',
  },
  {
    id: 'have_to', modal: 'have to', band: 'A2', forms: 'have to · don’t have to',
    uses: [
      { fn: 'obligation', form: 'have to', gloss: 'an obligation from outside — rules, circumstances, other people', example: 'I have to finish this report before Friday.' },
      { fn: 'absence of obligation', form: "don't have to", gloss: 'there’s no obligation — it’s optional', example: "You don't have to tip; service is included." },
    ],
    contrast: '“must” often carries the speaker’s own urgency; “have to” points to an outside requirement. In the negative they split completely: “mustn’t” forbids, “don’t have to” frees.',
    watchOut: '“have to” behaves like an ordinary verb — it takes do/does/did: “Do I have to sign?”, “She doesn’t have to come.” That’s different from “must”, which never uses “do”.',
  },
  {
    id: 'neednt', modal: 'needn’t', band: 'B1', forms: 'needn’t · need to',
    uses: [
      { fn: 'absence of obligation', form: "needn't", gloss: 'there’s no need to do something', example: "You needn't bring anything — it's all sorted." },
    ],
    contrast: '“needn’t” = “don’t have to” (no need). Don’t confuse it with “mustn’t”, which forbids.',
    watchOut: '“needn’t” + infinitive without “to”: “You needn’t worry.” But “need” as an ordinary verb takes “to”: “You don’t need to worry.” Both are fine — just don’t mix them (“You needn’t to worry” ✗).',
  },

  /* ===== ADVICE & WARNINGS ===== */
  {
    id: 'should', modal: 'should', band: 'B1', forms: 'should · shouldn’t',
    uses: [
      { fn: 'advice', form: 'should', gloss: 'recommending — the good idea, not a rule', example: 'You should book early if you’re travelling in August.' },
      { fn: 'expectation', form: 'should', gloss: 'what you reasonably expect to be true', example: 'They left at six, so they should be here by now.' },
      { fn: 'advice', form: "shouldn't", gloss: 'recommending against something', example: "You shouldn't leave it so late." },
    ],
    contrast: '“should” is advice, not obligation — weaker than “must / have to”. Booking early is wise, not required.',
    watchOut: 'No “to” after should: “You should rest”, not “You should to rest”. For a firm rule, use “must / have to” instead.',
  },
  {
    id: 'ought_to', modal: 'ought to', band: 'B1', forms: 'ought to · oughtn’t to (rare)',
    uses: [
      { fn: 'advice', form: 'ought to', gloss: 'recommending — a little more formal than “should”', example: 'You ought to check the address before you set off.' },
    ],
    contrast: '“ought to” means the same as “should” — slightly more formal, and one of the few modals that keeps “to”.',
    watchOut: 'Unlike most modals, “ought” keeps “to”: “You ought to rest”, not “You ought rest”. The negative “oughtn’t to” is rare — most speakers just say “shouldn’t”.',
  },
  {
    id: 'had_better', modal: 'had better', band: 'B2', forms: '’d better · ’d better not',
    uses: [
      { fn: 'warning', form: 'had better', gloss: 'strong advice with a consequence — do this, or something bad happens', example: 'You’d better leave now, or you’ll miss the last bus.' },
      { fn: 'warning', form: 'had better not', gloss: 'a warning not to do something', example: 'You’d better not be late again.' },
    ],
    contrast: '“had better” is not just strong advice — it carries a threat. If a native speaker uses it, there’s a bad outcome implied if you don’t act.',
    watchOut: 'It’s always “had better” (usually “’d better”) + infinitive — never “have better” or “had better to”: “You’d better go”, not “You’d better to go”. The negative is “had better not”, with “not” after “better”.',
  },

  /* ===== REQUESTS, OFFERS, WISHES & THE FUTURE ===== */
  {
    id: 'will', modal: 'will', band: 'A2', forms: 'will (’ll) · won’t',
    uses: [
      { fn: 'offer', form: 'will', gloss: 'offering or promising to do something', example: 'I’ll carry that upstairs for you.' },
      { fn: 'deduction', form: 'will', gloss: 'a confident guess about now or the future', example: 'That’ll be the postman at the door.' },
    ],
    contrast: '“Will you…?” as a request can sound abrupt or impatient — for polite requests prefer “Could / Would you…?”.',
    watchOut: 'For requests, avoid “Will you…?” — it can come across as a command. Keep “will” for offers and promises: “I’ll help you.”',
  },
  {
    id: 'would', modal: 'would', band: 'A2', forms: 'would (’d) · wouldn’t',
    uses: [
      { fn: 'request', form: 'would', gloss: 'a polite request', example: 'Would you pass me the keys?' },
      { fn: 'offer', form: 'would', gloss: 'offering (Would you like…?)', example: 'Would you like a coffee?' },
      { fn: 'annoying habit', form: "wouldn't", gloss: 'complaining about a repeated, irritating habit (wish + wouldn’t)', example: 'I wish you wouldn’t keep leaving the door unlocked.' },
      { fn: 'hypothetical wish', form: 'would', gloss: 'talking about unreal or imagined situations', example: 'I would help if I had the time.' },
    ],
    contrast: '“I wish you wouldn’t…” isn’t about the future — it’s a complaint about a habit you want stopped.',
    watchOut: 'For the annoying-habit wish, use “wouldn’t”, not “didn’t”: “I wish you wouldn’t interrupt.” “Would” never takes “-s” or “to”: “She would help”, not “She would to help”.',
  },
  {
    id: 'shall', modal: 'shall', band: 'B1', forms: 'shall (questions with I / we)',
    uses: [
      { fn: 'offer', form: 'shall', gloss: 'offering to do something (Shall I…?)', example: 'Shall I carry that upstairs for you?' },
      { fn: 'suggestion', form: 'shall', gloss: 'suggesting doing something together (Shall we…?)', example: 'Shall we book a table?' },
    ],
    contrast: '“Shall I…?” offers your help; “Shall we…?” suggests doing something together. Both are questions with I / we.',
    watchOut: '“shall” for offers and suggestions is used mainly with “I” and “we” in questions. Elsewhere it sounds old-fashioned — for the future, use “will”.',
  },
];

/* ---------- groups (accordion order) ---------- */
const GROUPS = [
  { id: 'ability',   title: 'Ability, permission & possibility',      ids: ['can', 'could', 'may', 'might'] },
  { id: 'obligation', title: 'Obligation, prohibition & necessity',   ids: ['must', 'have_to', 'neednt'] },
  { id: 'advice',    title: 'Advice & warnings',                      ids: ['should', 'ought_to', 'had_better'] },
  { id: 'requests',  title: 'Requests, offers, wishes & the future',  ids: ['will', 'would', 'shall'] },
];

/* ---------- derived structures + helpers ---------- */
export const MODALS = DATA;
export const byId = Object.fromEntries(DATA.map(m => [m.id, m]));
export const BAND_ORDER = ['A2', 'B1', 'B2', 'C1'];

// groups with their card objects resolved, in reading order
export function modalGroups() {
  return GROUPS.map(g => ({ ...g, cards: g.ids.map(id => byId[id]).filter(Boolean) }));
}
