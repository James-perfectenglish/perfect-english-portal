/* ============================================================
   Verb Conjugator — Spanish content + structure (shared, pure JS)
   ------------------------------------------------------------
   For native-English learners of Spanish. Read by:
     • src/components/VerbConjugatorES.jsx  (the Learn reference)
     • src/components/VerbCardES.jsx         (one tense's card)
   Companion to tenseExplainEs.js — same audience, same visual
   language (the shared C palette / PG gradient), but this is a
   CONJUGATION reference: model regular tables (-ar/-er/-ir), a
   curated set of high-value irregulars per tense, and — the whole
   point — a plain-English gloss anchoring each Spanish tense to the
   English tense the learner already owns ("pluscuamperfecto = 'I
   had eaten'").

   ⚠️ CONTENT NOTE FOR JAMES: every form here is hand-authored and
   double-checked, Peninsular (tú + vosotros, no vos), but the
   conjugations + glosses + watch-outs are your Spanish-teacher turf
   and are first-draft-pending-review, exactly like the ES Tagger /
   Explainer content. A wrong form in a reference is worse than none,
   so please spot-check before we register the tile.

   STRUCTURE
   Each entry is one tense. `kind` drives the table renderer:
     'simple'   → three model columns: hablar / comer / vivir
     'compound' → one aux column (haber or estar) + an invariable
                  complement (participio or gerundio — `complement`
                  labels it; `irregularFormsLabel` titles the chips)
   `anchor` is the English hook shown on the collapsed row.
   `gloss`   is the 1–2 sentence "what the hell is this" for an
             English speaker (the differentiator).
   `irregulars[]` are small model tables; `irregularNote` carries a
             pattern (e.g. the future's shared stems) in markdown-lite
             (**bold** / *italic*, rendered by the card).
   ============================================================ */

export const PERSONS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / Uds.'];

const DATA = [
  /* ================= PRESENT ================= */
  {
    id: 'presente', name: 'Presente', enName: 'Present', group: 'present',
    anchor: 'I speak / I’m speaking',
    gloss: 'Your everyday present. One Spanish form does the work of two English ones — *hablo* is both “I speak” and “I’m speaking” (as a habit or a general truth). Save the *estar + -ndo* form for something happening this very second.',
    formation: 'Drop -ar / -er / -ir, add the present endings.',
    kind: 'simple',
    regular: {
      hablar: ['hablo', 'hablas', 'habla', 'hablamos', 'habláis', 'hablan'],
      comer:  ['como', 'comes', 'come', 'comemos', 'coméis', 'comen'],
      vivir:  ['vivo', 'vives', 'vive', 'vivimos', 'vivís', 'viven'],
    },
    irregulars: [
      { verb: 'ser',   forms: ['soy', 'eres', 'es', 'somos', 'sois', 'son'] },
      { verb: 'estar', forms: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'] },
      { verb: 'ir',    forms: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'] },
      { verb: 'tener', forms: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'] },
    ],
    irregularNote: '**Stem-changers** (“boot” verbs): the vowel changes in every form *except* nosotros / vosotros. **o→ue** *poder → puedo*, *acostar → me acuesto*. **e→ie** *querer → quiero*, *pensar → pienso*. **e→i** *pedir → pido*.',
    watchOut: 'Resist the continuous. “I work here” = *trabajo aquí*, not *estoy trabajando* — use *estar + -ndo* only for something in progress right now.',
  },
  {
    id: 'presente_continuo', name: 'Presente continuo', enName: 'Present continuous', group: 'present',
    anchor: 'I am speaking (right now)',
    gloss: 'English “I am —ing”, but narrower: only for something in progress at this very moment — *estoy limpiando la habitación* (I’m cleaning it now). For habits and arranged plans, Spanish sticks to the simple present.',
    formation: 'Present of estar + the gerund (-ando / -iendo).',
    kind: 'compound',
    aux: { verb: 'estar', forms: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'] },
    complement: 'gerundio',
    participle: 'hablando · comiendo · viviendo',
    participleNote: 'The gerund never changes for the subject — only estar moves.',
    irregularFormsLabel: 'Irregular gerunds',
    irregularParticiples: [
      ['decir', 'diciendo'], ['pedir', 'pidiendo'], ['venir', 'viniendo'], ['dormir', 'durmiendo'],
      ['morir', 'muriendo'], ['leer', 'leyendo'], ['oír', 'oyendo'], ['traer', 'trayendo'], ['ir', 'yendo'],
    ],
    irregularNote: '**-yendo** when the stem ends in a vowel: *leer → leyendo*, *oír → oyendo*, *traer → trayendo*. **e→i / o→u** in -ir stem-changers: *pedir → pidiendo*, *dormir → durmiendo*.',
    watchOut: 'Never for the future. English “I’m working tomorrow” = *trabajo mañana* or *voy a trabajar* — Spanish keeps *estar + -ndo* strictly for right now.',
  },

  /* ================= PAST ================= */
  {
    id: 'preterito', name: 'Pretérito indefinido', enName: 'Simple past (preterite)', group: 'past',
    anchor: 'I spoke / I ate',
    gloss: 'The finished past: “I ate”, “I spoke”, “I went”. One completed action with a clear endpoint — the tense you reach for to say what you *did*: *ayer comí paella*.',
    formation: 'Drop the ending, add the preterite endings. Watch the accents on yo and él.',
    kind: 'simple',
    regular: {
      hablar: ['hablé', 'hablaste', 'habló', 'hablamos', 'hablasteis', 'hablaron'],
      comer:  ['comí', 'comiste', 'comió', 'comimos', 'comisteis', 'comieron'],
      vivir:  ['viví', 'viviste', 'vivió', 'vivimos', 'vivisteis', 'vivieron'],
    },
    irregulars: [
      { verb: 'ser / ir', forms: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'] },
      { verb: 'tener',    forms: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'] },
      { verb: 'hacer',    forms: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'] },
    ],
    irregularNote: '**Strong preterites** — an irregular stem + these *unstressed* endings (no accents): **-e, -iste, -o, -imos, -isteis, -ieron**. *estar → estuv-*, *poder → pud-*, *poner → pus-*, *querer → quis-*, *venir → vin-*, *saber → sup-*, *decir → dij-* (→ *dijeron*, the i drops).',
    watchOut: 'The big one: **pretérito vs imperfecto**. Use the pretérito for one finished action with an endpoint. If you’d say “was —ing” or “used to”, you need the imperfecto instead.',
  },
  {
    id: 'imperfecto', name: 'Imperfecto', enName: 'Imperfect', group: 'past',
    anchor: 'I used to speak / I was speaking',
    gloss: 'The “used to” / “was —ing” past — background, habits and description rather than one finished event: *de niño jugaba* (I used to play), *llovía* (it was raining). English folds this and the pretérito into a single “past”; Spanish keeps them apart.',
    formation: '-ar → -aba; -er / -ir → -ía. Beautifully regular — only three verbs break it.',
    kind: 'simple',
    regular: {
      hablar: ['hablaba', 'hablabas', 'hablaba', 'hablábamos', 'hablabais', 'hablaban'],
      comer:  ['comía', 'comías', 'comía', 'comíamos', 'comíais', 'comían'],
      vivir:  ['vivía', 'vivías', 'vivía', 'vivíamos', 'vivíais', 'vivían'],
    },
    irregulars: [
      { verb: 'ser', forms: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'] },
      { verb: 'ir',  forms: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'] },
      { verb: 'ver', forms: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'] },
    ],
    irregularNote: 'That’s the lot — **ser, ir, ver** are the *only* irregular verbs in the imperfect. Every other verb, however irregular elsewhere, is regular here.',
    watchOut: 'Reach for it for the scene, not the event: what *used to* happen or *was* happening. *De niño jugaba al fútbol* (used to), but *ayer jugué un partido* (one match → pretérito).',
  },
  {
    id: 'perfecto', name: 'Pretérito perfecto', enName: 'Present perfect', group: 'past',
    anchor: 'I have spoken',
    gloss: 'Exactly English “I have —ed”: *he comido* = “I have eaten”. A past action still tied to now — often with *hoy, esta semana, ya, todavía no*. In Spain you’ll hear it constantly where Latin America might use the simple past.',
    formation: 'Present of haber + the past participle (-ado / -ido).',
    kind: 'compound',
    aux: { verb: 'haber', forms: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'] },
    participle: 'hablado · comido · vivido',
    participleNote: 'The participle never changes for the subject — always ends in -o.',
    irregularParticiples: [
      ['hacer', 'hecho'], ['decir', 'dicho'], ['ver', 'visto'], ['escribir', 'escrito'],
      ['poner', 'puesto'], ['volver', 'vuelto'], ['abrir', 'abierto'], ['romper', 'roto'], ['morir', 'muerto'],
    ],
    watchOut: 'Spain leans on this where you might expect the simple past — *esta mañana he desayunado tarde*. Only haber moves; the participle stays put.',
  },
  {
    id: 'pluscuamperfecto', name: 'Pluscuamperfecto', enName: 'Past perfect', group: 'past',
    anchor: 'I had spoken',
    gloss: 'The past-before-the-past: English “I had —ed”. *Cuando llegué, ya había comido* — “when I arrived, I had already eaten”. It places one past event *before* another.',
    formation: 'Imperfect of haber (había…) + the past participle.',
    kind: 'compound',
    aux: { verb: 'haber', forms: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'] },
    participle: 'hablado · comido · vivido',
    participleNote: 'Same participles as the perfect — and the same irregular ones.',
    irregularParticiples: [
      ['hacer', 'hecho'], ['decir', 'dicho'], ['ver', 'visto'], ['escribir', 'escrito'],
      ['poner', 'puesto'], ['volver', 'vuelto'], ['abrir', 'abierto'], ['romper', 'roto'], ['morir', 'muerto'],
    ],
    watchOut: 'Straightforward once you think “had done”. The participle is invariable; only haber changes.',
  },

  /* ================= FUTURE & CONDITIONAL ================= */
  {
    id: 'futuro', name: 'Futuro', enName: 'Simple future', group: 'future',
    anchor: 'I will speak',
    gloss: 'English “I will —”: *hablaré* = “I will speak”. Note that for plans, natives usually say *voy a hablar* (going to). The futuro also does predictions and “I wonder…” guesses.',
    formation: 'Whole infinitive + one set of endings — the same for -ar / -er / -ir.',
    kind: 'simple',
    regular: {
      hablar: ['hablaré', 'hablarás', 'hablará', 'hablaremos', 'hablaréis', 'hablarán'],
      comer:  ['comeré', 'comerás', 'comerá', 'comeremos', 'comeréis', 'comerán'],
      vivir:  ['viviré', 'vivirás', 'vivirá', 'viviremos', 'viviréis', 'vivirán'],
    },
    irregulars: [
      { verb: 'tener', forms: ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán'] },
      { verb: 'hacer', forms: ['haré', 'harás', 'hará', 'haremos', 'haréis', 'harán'] },
    ],
    irregularNote: 'A dozen verbs swap the infinitive for an **irregular stem**, then take the *same* endings: *tener → tendr-*, *poner → pondr-*, *salir → saldr-*, *venir → vendr-*, *poder → podr-*, *saber → sabr-*, *hacer → har-*, *decir → dir-*, *querer → querr-*, *haber → habr-*. (These are shared exactly with the conditional.)',
    watchOut: 'For plans, *voy a…* is far more common than the futuro. The futuro is also the “probability” form: *serán las tres* = “it must be about three”.',
  },
  {
    id: 'condicional', name: 'Condicional', enName: 'Conditional', group: 'future',
    anchor: 'I would speak',
    gloss: 'English “I would —”: *hablaría* = “I would speak”. For hypotheticals (*yo iría* — I would go), polite requests (*¿podría…?* — could you…?) and the future seen from the past.',
    formation: 'Whole infinitive + the -ía endings — same for all three verb types.',
    kind: 'simple',
    regular: {
      hablar: ['hablaría', 'hablarías', 'hablaría', 'hablaríamos', 'hablaríais', 'hablarían'],
      comer:  ['comería', 'comerías', 'comería', 'comeríamos', 'comeríais', 'comerían'],
      vivir:  ['viviría', 'vivirías', 'viviría', 'viviríamos', 'viviríais', 'vivirían'],
    },
    irregulars: [
      { verb: 'tener', forms: ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendríais', 'tendrían'] },
      { verb: 'hacer', forms: ['haría', 'harías', 'haría', 'haríamos', 'haríais', 'harían'] },
    ],
    irregularNote: 'Exactly the **same irregular stems as the future** — just with -ía endings: *tendr-, pondr-, saldr-, vendr-, podr-, sabr-, har-, dir-, querr-, habr-*.',
    watchOut: '“Would” as a *past habit* (“every summer we would swim”) is NOT this — that’s the imperfecto. The conditional is the *hypothetical* “would”.',
  },

  /* ================= SUBJUNCTIVE ================= */
  {
    id: 'subjuntivo', name: 'Presente de subjuntivo', enName: 'Present subjunctive', group: 'subjunctive',
    anchor: 'a mood, not a tense',
    gloss: 'Not really a tense — a *mood*, and English barely has one, so don’t hunt for a word-for-word match. It appears after doubt, wishes, emotion and set triggers: *espero que vengas*, *cuando llegues*, *quiero que lo hagas*. Learn the triggers, not a translation.',
    formation: 'Take the yo present, drop the -o, add the “opposite” vowel: -ar → e, -er / -ir → a.',
    kind: 'simple',
    regular: {
      hablar: ['hable', 'hables', 'hable', 'hablemos', 'habléis', 'hablen'],
      comer:  ['coma', 'comas', 'coma', 'comamos', 'comáis', 'coman'],
      vivir:  ['viva', 'vivas', 'viva', 'vivamos', 'viváis', 'vivan'],
    },
    irregulars: [
      { verb: 'ser',   forms: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'] },
      { verb: 'estar', forms: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'] },
      { verb: 'ir',    forms: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'] },
    ],
    irregularNote: 'Because it’s built from the **yo present**, an irregular yo carries straight over: *tener (tengo) → tenga*, *hacer (hago) → haga*, *salir (salgo) → salga*. The ones that don’t come from yo: *haber → haya*, *saber → sepa*, *dar → dé*, *ver → vea*.',
    watchOut: 'Don’t look for an English equivalent — there usually isn’t one. Anchor on the trigger (*espero que, cuando, para que, ojalá*) and the mood follows.',
  },
];

/* ---------- derived structures + helpers ---------- */
export const TENSES_CONJ_ES = DATA;

export const GROUP_ORDER = ['present', 'past', 'future', 'subjunctive'];
export const GROUP_LABEL = {
  present: 'Present',
  past: 'Past',
  future: 'Future & conditional',
  subjunctive: 'Subjunctive',
};

export function tensesByGroup() {
  return GROUP_ORDER
    .map(group => ({ group, items: DATA.filter(t => t.group === group) }))
    .filter(g => g.items.length);
}

export const byId = Object.fromEntries(DATA.map(t => [t.id, t]));
