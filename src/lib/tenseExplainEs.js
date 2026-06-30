/* ============================================================
   Tense Explainer — Spanish content + structure (shared, pure JS)
   ------------------------------------------------------------
   For native-English learners of Spanish. Read by:
     • src/components/TenseExplainerES.jsx  (the Learn reference)
     • src/components/TenseTaggerES.jsx     (can import formulaByTiempo)
   The four tenses match the ES Tagger / engine exactly (presente,
   presente_continuo, preterito, imperfecto) and the bank's
   answer.tiempo field, so {tiempo} round-trips to a bank query and a
   Tagger filter. English scaffolding + Spanish examples, mirroring
   the ES Tagger. All four exist at A2/B1, so there is no level ladder.

   ⚠️ CONTENT NOTE FOR JAMES: the `uses` examples and `watchOut` lines
   are first drafts for your review — your Spanish-teacher turf. The
   formula + short `use` are lifted verbatim from the ES Tagger's
   FORMULAS_ES. The watch-outs target the classic English→Spanish
   traps (over-using the continuous; pretérito vs imperfecto).
   ============================================================ */

const TIEMPO_LABEL = {
  presente: 'Presente',
  presente_continuo: 'Presente continuo',
  preterito: 'Pretérito',
  imperfecto: 'Imperfecto',
};

/* ---------- the 4 ES tenses, in reading order (present pair, past pair) ----------
   id / tiempo   the engine + bank key (answer.tiempo)
   group         'present' | 'past'  — for the two key contrasts
   formula / use  verbatim from the ES Tagger's FORMULAS_ES
   uses[]        {label (EN), signals (ES), example (ES)} — curated spine
   watchOut      one-line English-speaker trap
*/
const DATA = [
  /* ===== PRESENT ===== */
  {
    id: 'presente', tiempo: 'presente', group: 'present',
    formula: 'stem + -o, -as, -a, -amos, -áis, -an  (hablo, comes, vive)', use: 'habits and general facts',
    uses: [
      { label: 'Habits & routines', signals: ['siempre', 'normalmente', 'todos los días', 'cada día'], example: 'Trabajo en el hotel todos los días.' },
      { label: 'General facts', signals: [], example: 'El restaurante abre a las ocho.' },
      { label: 'A fixed future plan', signals: ['mañana', 'el lunes'], example: 'Mañana empiezo a las nueve.' },
    ],
    watchOut: 'English speakers reach for the continuous too often — Spanish uses the simple present for “I work” and “I am working” (as a habit). Save estar + gerundio for an action happening this very moment.',
  },
  {
    id: 'presente_continuo', tiempo: 'presente_continuo', group: 'present',
    formula: 'estar + gerundio  (estoy hablando, está comiendo)', use: 'an action happening right now',
    uses: [
      { label: 'Happening right now', signals: ['ahora', 'ahora mismo', 'en este momento'], example: 'Ahora mismo estoy limpiando la habitación.' },
    ],
    watchOut: 'Only for something in progress at this moment. For routines or the near future, use the simple present — “Mañana voy a Madrid”, not “estoy yendo”.',
  },
  /* ===== PAST ===== */
  {
    id: 'preterito', tiempo: 'preterito', group: 'past',
    formula: 'stem + -é, -aste, -ó…  (hablé, comió)', use: 'a completed, finished past action',
    uses: [
      { label: 'A finished past action', signals: ['ayer', 'anoche', 'la semana pasada', 'el lunes pasado'], example: 'Ayer preparé la cena.' },
      { label: 'A sequence of events', signals: ['luego', 'después', 'primero'], example: 'Llegué, hablé con el jefe y empecé el turno.' },
    ],
    watchOut: 'The hard contrast for English speakers is pretérito vs imperfecto. Use the pretérito for one finished action with a clear end. If you mean “was doing” or “used to do”, you need the imperfecto.',
  },
  {
    id: 'imperfecto', tiempo: 'imperfecto', group: 'past',
    formula: 'stem + -aba / -ía…  (hablaba, comía)', use: 'an ongoing or habitual past action',
    uses: [
      { label: 'Past habits (“used to”)', signals: ['antes', 'siempre', 'todos los días', 'de vez en cuando'], example: 'Antes trabajaba en un restaurante.' },
      { label: 'A scene or an action in progress', signals: ['mientras'], example: 'Mientras cocinaba, sonó el teléfono.' },
      { label: 'Time, age & description', signals: [], example: 'Eran las ocho y había mucha gente en el bar.' },
    ],
    watchOut: 'Use it for the background — what used to happen or was happening — not a single finished event. “De niño jugaba al fútbol” (used to), but “ayer jugué un partido” (one match → pretérito).',
  },
];

/* ---------- derived structures + helpers ---------- */
export const TENSES_ES = DATA.map(t => ({ ...t, name: TIEMPO_LABEL[t.tiempo] }));
export { TIEMPO_LABEL };

// formula + short use note, keyed by tiempo — drop-in for the ES Tagger's FORMULAS_ES
export const formulaByTiempo = Object.fromEntries(
  TENSES_ES.map(t => [t.tiempo, { formula: t.formula, use: t.use }])
);

export const GROUP_ORDER = ['present', 'past'];
export const GROUP_LABEL = { present: 'Present', past: 'Past' };

export function tensesByGroup() {
  return GROUP_ORDER
    .map(group => ({ group, items: TENSES_ES.filter(t => t.group === group) }))
    .filter(g => g.items.length);
}

// tiempo -> tense entry (for the "Practise this" bridge + bank query)
export function findByTiempo(tiempo) {
  return TENSES_ES.find(t => t.tiempo === tiempo) || null;
}

export const byId = Object.fromEntries(TENSES_ES.map(t => [t.id, t]));
