/* ============================================================
   Conditionals Explainer — Spanish content + structure (pure JS)
   ------------------------------------------------------------
   For native-English learners of Spanish. Read by:
     • src/components/ConditionalExplainerES.jsx (the Learn reference)
     • src/ConditionalChooser.jsx (language="es" — the 📖 overlay;
        card ids live in the bank as tags[1] on conditional_chooser rows)

   Card ids are THE keys: tipo0 · tipo1 · tipo2 · tipo3 · mixto ·
   amenosque · deinf. The bank's tags[1] must use them exactly.

   Design note (agreed 6 Jul): tipo 2/3 use forms OUTSIDE the nine
   canonical tiempos (imperfecto de subjuntivo, condicional compuesto).
   This is a STRUCTURES reference like the Modal Explainer, so those
   forms are taught inline here via each card's `formation` box — no
   Conjugator expansion required (parked on the horizon instead).

   ⚠️ CONTENT NOTE FOR JAMES: every gloss, example, negative row,
   formation box and watch-out is a first draft for your review —
   your Spanish-teacher turf. Peninsular conventions (tú/vosotros);
   English scaffolding + Spanish examples, matching the ES tense lib.
   Negatives are woven into every card (your ruling, 6 Jul).
   ============================================================ */

/* Card shape = the EN lib's, plus optional `formation`:
   { intro, rows[] (mono lines), chips[] (key irregulars), note } */
const DATA = [
  /* ===== REAL ===== */
  {
    id: 'tipo0', band: 'A2', group: 'real',
    name: 'Tipo 0 — always true', short: 'tipo 0', timeline: 'tipo0',
    formula: 'Si + presente, … presente',
    use: 'things that are always true',
    uses: [
      { label: 'General truths & facts', signals: ['si'], example: 'Si calientas el agua, hierve.' },
      { label: 'Habits & routines', signals: ['si'], example: 'Si trabajo de noche, duermo por la mañana.' },
      { label: 'Rules & instructions', signals: ['si'], example: 'Si un cliente pide la carta en inglés, se la llevamos enseguida.' },
    ],
    negative: {
      formula: 'Si no + presente, … presente',
      examples: [
        'Si no duermo bien, estoy de mal humor todo el día.',
      ],
    },
    watchOuts: [
      'Both halves stay in the present — exactly like the English zero conditional.',
      '*si* (if) has no accent — *sí* with an accent means \u201cyes\u201d.',
    ],
  },
  {
    id: 'tipo1', band: 'A2', group: 'real',
    name: 'Tipo 1 — real future', short: 'tipo 1', timeline: 'tipo1',
    formula: 'Si + presente, … futuro / presente / imperativo',
    use: 'a real possibility in the future',
    uses: [
      { label: 'A real future possibility', signals: ['si', 'mañana'], example: 'Si llueve mañana, no saldremos.' },
      { label: 'With an imperative', signals: ['si'], example: 'Si ves a Marta, dile que me llame.' },
      { label: 'With the present as a future', signals: ['si'], example: 'Si terminas pronto, vamos al cine.' },
    ],
    negative: {
      formula: 'Si no + presente, … no + futuro',
      examples: [
        'Si no estudias, no aprobarás el examen.',
        'No iremos a la playa si no hace sol.',
      ],
    },
    watchOuts: [
      'Never a future after *si*: \u201csi llueve\u201d, not \u201csi lloverá\u201d — English *if it rains* works exactly the same way.',
      'And never the present subjunctive after *si*: \u201csi llueve\u201d, not \u201csi llueva\u201d. (After *cuando* it IS the subjunctive — *cuando llegues* — which is why *si* catches everyone.)',
    ],
  },
  /* ===== HYPOTHETICAL ===== */
  {
    id: 'tipo2', band: 'B1', group: 'unreal',
    name: 'Tipo 2 — hypothetical now', short: 'tipo 2', timeline: 'tipo2',
    formula: 'Si + imperfecto de subjuntivo, … condicional',
    use: 'an imaginary or unlikely present / future',
    formation: {
      intro: 'The imperfecto de subjuntivo — take the ellos form of the pretérito, drop -ron, add -ra endings:',
      rows: ['hablar → hablara  (o hablase)', 'comer → comiera  (o comiese)', 'vivir → viviera  (o viviese)'],
      chips: ['tuviera', 'hiciera', 'fuera', 'estuviera', 'pudiera', 'supiera', 'quisiera', 'viniera', 'dijera', 'hubiera'],
      note: 'Irregular in the pretérito → irregular here too (*tuvieron → tuviera*). The -ra and -se forms are equal.',
    },
    uses: [
      { label: 'An imaginary present or future', signals: ['si'], example: 'Si tuviera más dinero, viajaría por toda Sudamérica.' },
      { label: 'Advice with "si yo fuera tú"', signals: ['si yo fuera tú'], example: 'Si yo fuera tú, hablaría con el jefe.' },
    ],
    negative: {
      formula: 'Si no + imperfecto de subjuntivo, … no + condicional',
      examples: [
        'Si no trabajara aquí, no te conocería.',
        'No vendría si no fuera importante.',
      ],
    },
    watchOuts: [
      'Never a conditional after *si*: \u201csi tuviera\u201d, not \u201csi tendría\u201d — you will even hear natives slip on this one; in standard Spanish it is always wrong.',
      'The -ra and -se forms are equal: *tuviera* = *tuviese*. Pick one and be consistent — most of Spain says -ra.',
    ],
  },
  {
    id: 'tipo3', band: 'B2', group: 'unreal',
    name: 'Tipo 3 — imagined past', short: 'tipo 3', timeline: 'tipo3',
    formula: 'Si + pluscuamperfecto de subjuntivo, … condicional compuesto',
    use: 'an imagined different past — regret and criticism',
    formation: {
      intro: 'Two auxiliary chains, one participle each:',
      rows: ['si-half:  hubiera + participio   (si hubiera hablado)', 'result:   habría + participio    (habría venido)'],
      chips: ['hecho', 'dicho', 'visto', 'puesto', 'escrito', 'abierto', 'vuelto', 'roto', 'muerto'],
      note: 'The chips are the key irregular participles — the same nine that power the perfecto.',
    },
    uses: [
      { label: 'An imagined different past / regret', signals: ['si'], example: 'Si hubiera sabido que venías, habría preparado algo.' },
      { label: 'Criticism', signals: ['si'], example: 'Si hubieras leído el correo, habrías visto el cambio de hora.' },
    ],
    negative: {
      formula: 'Si no + hubiera + participio, … no + habría + participio',
      examples: [
        'Si no me hubieras ayudado, no habría terminado a tiempo.',
      ],
    },
    watchOuts: [
      'In the result half, *hubiera* is also accepted: \u201c…hubiera venido\u201d = \u201c…habría venido\u201d — you will hear both everywhere.',
      'The equation is one-to-one with English: *si hubiera sabido* = \u201cif I had known\u201d; *habría venido* = \u201cI would have come\u201d.',
    ],
  },
  {
    id: 'mixto', band: 'C1', group: 'unreal',
    name: 'Mixto — two times', short: 'mixto', timeline: 'mixto',
    formula: 'Si + pluscuamperfecto de subjuntivo, … condicional simple',
    use: 'a past condition with a present result',
    uses: [
      { label: 'Past condition → present result', signals: ['ahora', 'hoy'], example: 'Si hubiera estudiado medicina, ahora sería médica.' },
    ],
    negative: {
      formula: 'Si no + hubiera + participio, … condicional simple',
      examples: [
        'Si no hubiéramos perdido aquel vuelo, ahora estaríamos en Roma.',
      ],
    },
    watchOuts: [
      'Ask when each half happens: the *si* half in the past (*hubiera* + participio), the result in the present (condicional simple).',
      'A time word like *ahora* or *hoy* in the result half is the usual clue.',
    ],
  },
  /* ===== BEYOND "SI" ===== */
  {
    id: 'amenosque', band: 'B1', group: 'beyond',
    name: 'A menos que & friends', short: 'a menos que', timeline: null,
    formula: 'a menos que + subjuntivo  =  unless',
    use: 'other ways to start a condition',
    uses: [
      { label: 'a menos que / a no ser que = unless', signals: ['a menos que', 'a no ser que'], example: 'No saldremos a menos que deje de llover.' },
      { label: 'siempre que / con tal de que = as long as', signals: ['siempre que', 'con tal de que'], example: 'Puedes usar mi coche siempre que vuelvas antes de las diez.' },
      { label: 'por si = in case', signals: ['por si'], example: 'Llévate el paraguas por si llueve.' },
    ],
    negative: {
      formula: '*a menos que* already carries the \u201cnot\u201d — the verb after it stays positive',
      examples: [
        'A menos que reserves, no conseguirás mesa. (never \u201cA menos que no reserves…\u201d for this meaning)',
      ],
    },
    watchOuts: [
      'Unlike *si*, these connectors DO take the subjunctive: *a menos que llueva*, *siempre que vuelvas*.',
      '*Por si* takes the plain indicative: *por si llueve*, not *por si llueva*.',
    ],
  },
  {
    id: 'deinf', band: 'C1', group: 'beyond',
    name: 'De + infinitivo — the formal shortcut', short: 'de + infinitivo', timeline: null,
    formula: 'De + infinitivo (compuesto), … condicional',
    use: 'formal conditionals without "si" — and "yo que tú"',
    uses: [
      { label: 'De + infinitivo compuesto (= tipo 3)', signals: ['De'], example: 'De haberlo sabido, habría venido antes.' },
      { label: 'De + infinitivo (= tipo 2)', signals: ['De'], example: 'De tener más tiempo, te ayudaría.' },
      { label: '"Yo que tú" — colloquial advice', signals: ['yo que tú'], example: 'Yo que tú, no firmaría ese contrato.' },
    ],
    negative: {
      formula: 'the *no* goes straight before the infinitive',
      examples: [
        'De no haber sido por tu ayuda, no habríamos terminado nunca.',
      ],
    },
    watchOuts: [
      'This is the register of formal writing — the everyday version is always *si* + subjuntivo.',
      'It mirrors formal English inversion: *De haberlo sabido…* = \u201cHad I known…\u201d.',
    ],
  },
];

/* ---------- derived structures + helpers ---------- */
export const CONDITIONALS = DATA;
export const byId = Object.fromEntries(DATA.map(c => [c.id, c]));

export const GROUP_ORDER = ['real', 'unreal', 'beyond'];
export const GROUP_LABEL = { real: 'Real', unreal: 'Hypothetical', beyond: 'Beyond \u201csi\u201d' };

export const BAND_ORDER = ['A2', 'B1', 'B2', 'C1'];
const bandRank = b => BAND_ORDER.indexOf(b);

export function levelBand(level) {
  const l = (level || '').toUpperCase();
  if (l.startsWith('A')) return 'A2';
  if (l === 'B1') return 'B1';
  if (l === 'B2') return 'B2';
  if (l.startsWith('C')) return 'C1';
  return 'B1';
}

export function conditionalsForLevel(level, showAll = false) {
  if (showAll) return DATA;
  const cap = bandRank(levelBand(level));
  return DATA.filter(c => bandRank(c.band) <= cap);
}
