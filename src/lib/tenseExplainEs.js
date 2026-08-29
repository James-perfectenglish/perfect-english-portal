/* ============================================================
   Tense Explainer — Spanish content + structure (shared, pure JS)
   ------------------------------------------------------------
   For native-English learners of Spanish. Read by:
     • src/components/TenseExplainerES.jsx  (the Learn reference)
     • src/components/TenseTaggerES.jsx     (can import formulaByTiempo)
   Nine tiempos — the full union with the Verb Conjugator. The core
   four (presente, presente_continuo, preterito, imperfecto) match
   the ES Tagger / engine and the bank's answer.tiempo field, so
   {tiempo} round-trips to a bank query and a Tagger filter. The
   other five carried `practisable: false` until the engine learned
   them. Four have now landed (perfecto, pluscuamperfecto, futuro,
   condicional). Only the SUBJUNTIVO still carries the flag: it is a
   mood, not a tense, and needs a trigger clause ("Espero que…") so
   the highlighted verb sits in a subordinate clause — a different
   generator shape, and a separate job. The flag gates both the
   bank-example fetch and the "Practise this" button in TenseCardES.
   English scaffolding + Spanish examples throughout.

   ⚠️ CONTENT NOTE FOR JAMES: the `uses` examples and `watchOut` lines
   are first drafts for your review — your Spanish-teacher turf. For
   the core four, formula + short `use` are lifted verbatim from the
   ES Tagger's FORMULAS_ES; for the five new tiempos they are also
   first drafts. The watch-outs target the classic English→Spanish
   traps (over-using the continuous; pretérito vs imperfecto).
   ============================================================ */

const TIEMPO_LABEL = {
  presente: 'Presente',
  presente_continuo: 'Presente continuo',
  preterito: 'Pretérito',
  imperfecto: 'Imperfecto',
  perfecto: 'Pretérito perfecto',
  pluscuamperfecto: 'Pluscuamperfecto',
  futuro: 'Futuro',
  condicional: 'Condicional',
  subjuntivo: 'Presente de subjuntivo',
};

/* ---------- the 9 ES tiempos, in reading order (present → past → future → subjunctive) ----------
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
  {
    id: 'perfecto', tiempo: 'perfecto', group: 'past',
    formula: 'he / has / ha… + participio  (he hablado, ha comido)', use: 'a past action connected to now',
    uses: [
      { label: 'Recent past, inside “today”', signals: ['hoy', 'esta mañana', 'esta semana', 'este mes'], example: 'Esta mañana he hablado con el recepcionista.' },
      { label: 'Life experience (ever / never)', signals: ['alguna vez', 'nunca', 'ya', 'todavía no'], example: '¿Has estado alguna vez en Menorca?' },
    ],
    watchOut: 'Good news — it works like English “I have done”. But Spain stretches it further: anything inside an unfinished period (hoy, esta semana) takes the perfecto, even where English would say “I did it this morning”.',
  },
  {
    id: 'pluscuamperfecto', tiempo: 'pluscuamperfecto', group: 'past',
    formula: 'había / habías… + participio  (había hablado)', use: 'a past action before another past action',
    uses: [
      { label: 'The past before the past', signals: ['ya', 'cuando', 'antes'], example: 'Cuando llegué al hotel, el cliente ya había salido.' },
    ],
    watchOut: 'Works exactly like English “had done” — if you would say “had” in English, you want the pluscuamperfecto. Only haber changes; the participle never does.',
  },
  /* ===== FUTURE & CONDITIONAL ===== */
  {
    id: 'futuro', tiempo: 'futuro', group: 'future',
    formula: 'infinitive + -é, -ás, -á…  (hablaré, comerás)', use: 'predictions and promises about the future',
    uses: [
      { label: 'Predictions & promises', signals: ['mañana', 'el año que viene', 'la próxima semana'], example: 'El año que viene abrirán un hotel nuevo en el puerto.' },
      { label: 'Guessing (“must be”)', signals: [], example: '¿Qué hora es? — Serán las tres.' },
    ],
    watchOut: 'For a plan you have already made, natives usually say ir a + infinitive — “voy a llamar mañana”, not “llamaré”. The futuro leans towards predictions, promises and guesses: “serán las tres” = “it must be about three”.',
  },
  {
    id: 'condicional', tiempo: 'condicional', group: 'future',
    formula: 'infinitive + -ía, -ías…  (hablaría, comería)', use: 'hypotheticals and polite requests (“would”)',
    uses: [
      { label: 'Hypotheticals (“would”)', signals: [], example: 'Con más tiempo, viajaría por toda España.' },
      { label: 'Polite requests', signals: [], example: '¿Podría traernos la cuenta, por favor?' },
    ],
    watchOut: '“Would” for a past habit (“every summer we would swim”) is NOT the conditional — that is the imperfecto. The conditional is the hypothetical “would”: what you would do if things were different.',
  },
  /* ===== SUBJUNCTIVE ===== */
  {
    id: 'subjuntivo', tiempo: 'subjuntivo', group: 'subjunctive', practisable: false,
    formula: 'yo present − o + “opposite” vowel  (hable, comas, vivan)', use: 'after triggers of wish, doubt and emotion',
    uses: [
      { label: 'Wishes & requests', signals: ['espero que', 'quiero que', 'ojalá'], example: 'Espero que tengas un buen turno.' },
      { label: 'Doubt & possibility', signals: ['no creo que', 'es posible que'], example: 'No creo que el jefe llegue antes de las diez.' },
      { label: 'Connectors pointing forward', signals: ['cuando', 'antes de que', 'para que'], example: 'Cuando termines, avísame.' },
    ],
    watchOut: 'Do not hunt for an English translation — there usually is not one. Anchor on the trigger: the phrase before “que” decides the mood, not the meaning of the verb itself.',
  },
];

/* ---------- derived structures + helpers ---------- */
export const TENSES_ES = DATA.map(t => ({ ...t, name: TIEMPO_LABEL[t.tiempo] }));
export { TIEMPO_LABEL };

// formula + short use note, keyed by tiempo — drop-in for the ES Tagger's FORMULAS_ES
export const formulaByTiempo = Object.fromEntries(
  TENSES_ES.map(t => [t.tiempo, { formula: t.formula, use: t.use }])
);

export const GROUP_ORDER = ['present', 'past', 'future', 'subjunctive'];
export const GROUP_LABEL = {
  present: 'Present',
  past: 'Past',
  future: 'Future & conditional',
  subjunctive: 'Subjunctive',
};

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
