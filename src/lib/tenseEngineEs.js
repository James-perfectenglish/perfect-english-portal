/* ============================================================
   Tense Tagger — Spanish generation engine (shared)
   Extracted from TenseTaggerES.jsx so the live component (fallback
   path) and the bank generator share ONE source of truth.
   A conjugator, not an auxiliary chain. Pure JS, no React.

   EIGHT tiempos: the original four (presente, presente_continuo,
   preterito, imperfecto) plus perfecto, pluscuamperfecto, futuro
   and condicional. The subjuntivo is deliberately absent — it needs
   a trigger clause ("Espero que…"), so the highlighted verb sits in
   a subordinate clause and the template shape is different. It is a
   separate job.

   Two tiempos need a sentence FRAME to read naturally:
     • pluscuamperfecto — an anchor clause ("Cuando llegué, … ya
       había salido"), because the past-before-the-past needs a past
       to sit before.
     • condicional — an optional hypothetical opener ("Con más
       tiempo, …"), which keeps it out of plain-future territory.
   Frames prefix `pre`, so `vp` stays the highlighted span and the
   bank's pre/vp/post round-trip is unchanged.

   ⚠️ CONTENT NOTE FOR JAMES: every conjugated form here is checked
   against the hand-authored tables in src/lib/verbConjugatorEs.js
   (the reference students actually read), including the -ído accent
   rule and the shared future/conditional stems. The adverbial sets
   and the frames are first drafts on your turf.
   ============================================================ */

import { axisAllows } from './tenseFocus.js';

const END = {
  ar: { pres: ['o', 'as', 'a', 'amos', 'áis', 'an'], pret: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'], imp: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'], ger: 'ando' },
  er: { pres: ['o', 'es', 'e', 'emos', 'éis', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
  ir: { pres: ['o', 'es', 'e', 'imos', 'ís', 'en'], pret: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'], imp: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'], ger: 'iendo' },
};
const ESTAR_PRES = ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'];
const HABER_PRES = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];
const HABER_IMP  = ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'];
const FUT_END    = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const COND_END   = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];
const IMP_SPECIAL = {
  ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
  ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
  ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
};
const stemOf = inf => inf.slice(0, -2);
const reg = (inf, type, key) => END[type][key].map(e => stemOf(inf) + e);

// -ar → -ado; -er/-ir → -ido, but -ído when the stem ends in a vowel
// (leer → leído, traer → traído). `part` overrides the lot.
function participioOf(v) {
  if (v.part) return v.part;
  const stem = stemOf(v.inf);
  if (v.type === 'ar') return stem + 'ado';
  return stem + (/[aeou]$/.test(stem) ? 'ído' : 'ido');
}
// futuro and condicional share one stem: the whole infinitive, or an
// irregular stem (tener → tendr-, hacer → har-).
const futStemOf = v => v.futStem || v.inf;

function forms(v) {
  const t = v.type;
  return {
    presente: v.pres || reg(v.inf, t, 'pres'),
    preterito: v.pret || reg(v.inf, t, 'pret'),
    imperfecto: IMP_SPECIAL[v.inf] || reg(v.inf, t, 'imp'),
    gerundio: v.ger || (stemOf(v.inf) + END[t].ger),
    participio: participioOf(v),
  };
}
// p = person index 0..5 (yo, tú, él, nosotros, vosotros, ellos)
function vpFor(v, tense, p) {
  const f = forms(v);
  if (tense === 'presente') return f.presente[p];
  if (tense === 'preterito') return f.preterito[p];
  if (tense === 'imperfecto') return f.imperfecto[p];
  if (tense === 'presente_continuo') return ESTAR_PRES[p] + ' ' + f.gerundio;
  if (tense === 'perfecto') return HABER_PRES[p] + ' ' + f.participio;
  if (tense === 'pluscuamperfecto') return HABER_IMP[p] + ' ' + f.participio;
  if (tense === 'futuro') return futStemOf(v) + FUT_END[p];
  if (tense === 'condicional') return futStemOf(v) + COND_END[p];
  return '?';
}

/* ⚠️ SETTING — DOMAINS. Spanish learners here are English speakers living in
   or visiting Mallorca. They do NOT work in hotels; they stay in them. So the
   spine is EVERYDAY life (home, food, shopping, family, travel, free time),
   and the hotel is one situation among several, seen from the GUEST's side:
   checking in, asking for towels, breakfast times, paying the bill. Hotel
   staff appear only as third parties ("el camarero trae la cuenta"), never as
   the voice of the learner.

   Verbs live in a domain list; DOMAIN_MIX sets the weighting per level. To
   shift the balance, change the numbers — not the lexicon.

   ROLE COHERENCE (hotel domain only). In everyday content roles do not apply:
   anyone can eat, travel or buy something. Inside the hotel they do, so a
   guest never serves the breakfast. `role` on a verb applies to all its
   objects; a `#s` / `#g` suffix on one object overrides it.
     s = staff only   g = guest only   (absent = anyone)

   `skip` — tiempos a verb reads badly in, whatever the filter says. ser + a
   fixed complement is the clear case: "he sido de Inglaterra" is not a
   sentence a teacher would show. */

/* ---------- EVERYDAY: the spine ---------- */
const VERBS_DAY = [
  { inf: 'hablar', type: 'ar', min: 'A2', cont: true, objs: ['con mi hermana', 'con mis amigos', 'por teléfono'] },
  { inf: 'trabajar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], objs: ['en la oficina', 'desde casa'] },
  { inf: 'estudiar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], objs: ['español', 'para el examen'] },
  { inf: 'comprar', type: 'ar', min: 'A2', cont: true, objs: ['el pan', 'fruta', 'un regalo'] },
  { inf: 'cocinar', type: 'ar', min: 'A2', cont: true, objs: ['la cena', 'una tortilla', 'pasta'], routine: true },
  { inf: 'limpiar', type: 'ar', min: 'A2', cont: true, routine: true, objs: ['la cocina', 'el piso'] },
  { inf: 'escuchar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], objs: ['música', 'la radio'], routine: true },
  { inf: 'llamar', type: 'ar', min: 'A2', cont: true, objs: ['a mi hermana', 'al médico'] },
  { inf: 'esperar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], routine: true, objs: ['el autobús', 'a mis amigos'] },
  { inf: 'ayudar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], objs: ['a mis padres', 'en casa'] },
  { inf: 'desayunar', type: 'ar', min: 'A2', cont: true, objs: ['en casa', 'con mi familia'], routine: true },
  { inf: 'comer', type: 'er', min: 'A2', cont: true, objs: ['en casa', 'una tostada', 'con mi familia'], routine: true },
  { inf: 'beber', type: 'er', min: 'A2', cont: true, objs: ['agua', 'un café', 'una cerveza'], routine: true },
  { inf: 'vivir', type: 'ir', min: 'A2', cont: false, stative: true, objs: ['en Palma', 'cerca del mar'], skip: ['preterito', 'pluscuamperfecto'] },
  { inf: 'escribir', type: 'ir', min: 'A2', cont: true, objs: ['un correo', 'una postal'], part: 'escrito' },
  { inf: 'ser', type: 'er', min: 'A2', cont: false, stative: true, objs: ['de Inglaterra', 'de Londres', 'de aquí'], pres: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'siendo', part: 'sido', skip: ['preterito', 'imperfecto', 'perfecto', 'pluscuamperfecto', 'futuro', 'condicional'] },
  { inf: 'estar', type: 'ar', min: 'A2', cont: false, skip: ['pluscuamperfecto'], routine: true, objs: ['en casa', 'en el centro', 'en el trabajo'], pres: ESTAR_PRES, pret: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'], ger: 'estando' },
  { inf: 'ir', type: 'ir', min: 'A2', cont: false, routine: true, objs: ['al mercado', 'a la playa', 'al cine', 'a casa'], pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'yendo' },
  { inf: 'tener', type: 'er', min: 'A2', cont: false, stative: true, routine: true, skip: ['preterito', 'perfecto', 'pluscuamperfecto'], objs: ['hambre', 'sed', 'prisa'], pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], pret: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'], futStem: 'tendr' },
  { inf: 'hacer', type: 'er', min: 'A2', cont: true, objs: ['la compra', 'deporte', 'la cena'], pres: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], pret: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'], part: 'hecho', futStem: 'har' },
  { inf: 'ver', type: 'er', min: 'A2', cont: false, objs: ['una película', 'a mis amigos'], pres: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], pret: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'], part: 'visto' },
  { inf: 'dar', type: 'ar', min: 'A2', cont: true, objs: ['un paseo', 'las gracias'], pres: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], pret: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'] },
  { inf: 'llegar', type: 'ar', min: 'B1', cont: false, objs: ['tarde', 'a tiempo', 'a casa'], pret: ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegasteis', 'llegaron'] },
  { inf: 'pagar', type: 'ar', min: 'B1', cont: true, objs: ['con tarjeta', 'en efectivo'], pret: ['pagué', 'pagaste', 'pagó', 'pagamos', 'pagasteis', 'pagaron'] },
  { inf: 'buscar', type: 'ar', min: 'B1', cont: true, skip: ['pluscuamperfecto'], objs: ['las llaves', 'trabajo'], pret: ['busqué', 'buscaste', 'buscó', 'buscamos', 'buscasteis', 'buscaron'] },
  { inf: 'leer', type: 'er', min: 'B1', cont: true, objs: ['el periódico', 'una novela'], pret: ['leí', 'leíste', 'leyó', 'leímos', 'leísteis', 'leyeron'], ger: 'leyendo' },
  { inf: 'decir', type: 'ir', min: 'B1', cont: true, objs: ['la verdad', 'que sí'], pres: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'], pret: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'], ger: 'diciendo', part: 'dicho', futStem: 'dir' },
  { inf: 'venir', type: 'ir', min: 'B1', cont: false, objs: ['a casa', 'conmigo'], pres: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'], pret: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'], ger: 'viniendo', futStem: 'vendr' },
  { inf: 'poner', type: 'er', min: 'B1', cont: true, objs: ['la mesa', 'música'], pres: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'], pret: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'], part: 'puesto', futStem: 'pondr' },
  { inf: 'salir', type: 'ir', min: 'B1', cont: false, objs: ['con mis amigos', 'a cenar'], pres: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'], futStem: 'saldr' },
  { inf: 'dormir', type: 'ir', min: 'B1', cont: true, objs: [], pres: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'], pret: ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron'], ger: 'durmiendo' },
  { inf: 'pedir', type: 'ir', min: 'B1', cont: true, objs: ['un café', 'ayuda'], pres: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'], pret: ['pedí', 'pediste', 'pidió', 'pedimos', 'pedisteis', 'pidieron'], ger: 'pidiendo' },
];

/* ---------- HOTEL: from the guest's side ---------- */
const VERBS_HOTEL = [
  { inf: 'reservar', type: 'ar', min: 'A2', cont: true, objs: ['una habitación', 'una mesa'] },
  { inf: 'hablar', type: 'ar', min: 'A2', cont: true, objs: ['con la recepcionista', 'con el camarero'] },
  { inf: 'esperar', type: 'ar', min: 'A2', cont: true, skip: ['pluscuamperfecto'], routine: true, objs: ['en recepción', 'el taxi'] },
  { inf: 'desayunar', type: 'ar', min: 'A2', cont: true, objs: ['en el hotel', 'en la terraza'], routine: true },
  { inf: 'limpiar', type: 'ar', min: 'A2', cont: true, role: 's', routine: true, objs: ['la habitación'] },
  { inf: 'comer', type: 'er', min: 'A2', cont: true, objs: ['en el hotel', 'en la terraza'], routine: true },
  { inf: 'ver', type: 'er', min: 'A2', cont: false, routine: true, objs: ['la piscina', 'a la recepcionista'], pres: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'], pret: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'], part: 'visto' },
  { inf: 'tener', type: 'er', min: 'A2', cont: false, stative: true, routine: true, skip: ['preterito', 'perfecto', 'pluscuamperfecto'], objs: ['una reserva', 'la llave'], pres: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], pret: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'], futStem: 'tendr' },
  { inf: 'ir', type: 'ir', min: 'A2', cont: false, routine: true, objs: ['a la piscina', 'a recepción', 'a la habitación'], pres: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'], pret: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'], ger: 'yendo' },
  { inf: 'estar', type: 'ar', min: 'A2', cont: false, skip: ['pluscuamperfecto'], routine: true, objs: ['en la habitación', 'en la piscina', 'en recepción'], pres: ESTAR_PRES, pret: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'], ger: 'estando' },
  { inf: 'llegar', type: 'ar', min: 'B1', cont: false, objs: ['al hotel', 'tarde'], pret: ['llegué', 'llegaste', 'llegó', 'llegamos', 'llegasteis', 'llegaron'] },
  { inf: 'pagar', type: 'ar', min: 'B1', cont: true, objs: ['la habitación', 'la cuenta'], pret: ['pagué', 'pagaste', 'pagó', 'pagamos', 'pagasteis', 'pagaron'] },
  { inf: 'buscar', type: 'ar', min: 'B1', cont: true, skip: ['pluscuamperfecto'], objs: ['el ascensor', 'la llave'], pret: ['busqué', 'buscaste', 'buscó', 'buscamos', 'buscasteis', 'buscaron'] },
  { inf: 'subir', type: 'ir', min: 'B1', cont: true, objs: ['a la habitación'] },
  { inf: 'pedir', type: 'ir', min: 'B1', cont: true, objs: ['la cuenta', 'más toallas', 'el desayuno'], pres: ['pido', 'pides', 'pide', 'pedimos', 'pedís', 'piden'], pret: ['pedí', 'pediste', 'pidió', 'pedimos', 'pedisteis', 'pidieron'], ger: 'pidiendo' },
  { inf: 'traer', type: 'er', min: 'B1', cont: true, role: 's', objs: ['la cuenta', 'más pan'], pres: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'], pret: ['traje', 'trajiste', 'trajo', 'trajimos', 'trajisteis', 'trajeron'], ger: 'trayendo' },
  { inf: 'servir', type: 'ir', min: 'B1', cont: true, role: 's', objs: ['el desayuno', 'la cena'], pres: ['sirvo', 'sirves', 'sirve', 'servimos', 'servís', 'sirven'], pret: ['serví', 'serviste', 'sirvió', 'servimos', 'servisteis', 'sirvieron'], ger: 'sirviendo' },
  { inf: 'dormir', type: 'ir', min: 'B1', cont: true, objs: [], pres: ['duermo', 'duermes', 'duerme', 'dormimos', 'dormís', 'duermen'], pret: ['dormí', 'dormiste', 'durmió', 'dormimos', 'dormisteis', 'durmieron'], ger: 'durmiendo' },
];

/* Weighting per level. Change these numbers to shift the balance — the
   lexicon does not need touching. */
const DOMAIN_MIX = {
  A2: [['day', 70], ['hotel', 30]],
  B1: [['day', 70], ['hotel', 30]],
};
const DOMAIN_VERBS = { day: VERBS_DAY, hotel: VERBS_HOTEL };

// `r` is the role, and it only bites in the hotel domain: 's' staff, 'g' guest.
// In everyday content nobody carries one, so every subject is available.
const SUBJECTS_DAY = [
  { text: 'yo', p: 0 }, { text: 'tú', p: 1 }, { text: 'él', p: 2 }, { text: 'ella', p: 2 },
  { text: 'nosotros', p: 3 }, { text: 'vosotros', p: 4 }, { text: 'ellos', p: 5 }, { text: 'ellas', p: 5 },
  { text: 'mi hermana', p: 2 }, { text: 'mi marido', p: 2 }, { text: 'mi vecino', p: 2 },
  { text: 'mis amigos', p: 5 }, { text: 'mis padres', p: 5 }, { text: 'los niños', p: 5 },
];
// In the hotel the learner is the GUEST, so the pronouns carry the guest role
// and staff appear only as named third parties.
const SUBJECTS_HOTEL = [
  { text: 'yo', p: 0, r: 'g' }, { text: 'tú', p: 1, r: 'g' }, { text: 'él', p: 2, r: 'g' }, { text: 'ella', p: 2, r: 'g' },
  { text: 'nosotros', p: 3, r: 'g' }, { text: 'vosotros', p: 4, r: 'g' }, { text: 'ellos', p: 5, r: 'g' },
  { text: 'mis amigos', p: 5, r: 'g' }, { text: 'los huéspedes', p: 5, r: 'g' },
  { text: 'el camarero', p: 2, r: 's' }, { text: 'la recepcionista', p: 2, r: 's' },
];
const DOMAIN_SUBJECTS = { day: SUBJECTS_DAY, hotel: SUBJECTS_HOTEL };

// adverbials are all invariant for person/number, so they read naturally with any subject
const ADVERBS = {
  presente: ['', '', 'normalmente', 'siempre', 'a veces', 'todos los días', 'cada día'],
  presente_continuo: ['ahora mismo', 'en este momento', 'ahora'],
  preterito: ['', 'ayer', 'anoche', 'el lunes pasado', 'la semana pasada'],
  imperfecto: ['antes', 'siempre', 'todos los días', 'normalmente', 'en aquella época', 'de vez en cuando'],
  // the perfecto lives inside an unfinished period — that is the whole point of it in Spain.
  // ("ya" belongs before the auxiliary, not in final position, so it is not here.)
  perfecto: ['hoy', 'esta mañana', 'esta semana', 'este mes'],
  // the anchor frame carries the time reference, so no trailing adverbial
  pluscuamperfecto: [''],
  futuro: ['', 'mañana', 'esta noche', 'pronto', 'la semana que viene', 'el mes que viene'],
  condicional: ['', '', 'sin problema', 'con mucho gusto'],
};

/* Sentence frames — prefix `pre`, so `vp` stays the highlighted span.
   `avoidP` keeps the frame's own subject from clashing with the main one
   ("Cuando llegué, yo ya había…" reads as a stutter); `avoidV` keeps the
   frame's own verb from clashing ("Cuando llegamos, … había llegado tarde").
   Anchors are kept purely temporal: a scene-setting one like "cuando abrió el
   restaurante" implies a whole situation, and most verbs then contradict it. */
const FRAMES = {
  pluscuamperfecto: [
    { text: 'Cuando llegué, ', avoidP: [0], avoidV: ['llegar', 'venir', 'ir'] },
    { text: 'Cuando llegamos, ', avoidP: [0, 3], avoidV: ['llegar', 'venir', 'ir'] },
    { text: 'Antes de las ocho, ', avoidP: [], avoidV: ['llegar'] },
    { text: 'Para las diez, ', avoidP: [], avoidV: ['llegar'] },
    { text: 'Antes de salir, ', avoidP: [], avoidV: ['salir', 'venir', 'ir', 'llegar'] },
    { text: 'Cuando volvimos, ', avoidP: [0, 3], avoidV: [] },
  ],
  condicional: [
    { text: '', avoidP: [], avoidV: [] },
    { text: '', avoidP: [], avoidV: [] },
    // "Con más tiempo, yo llegaría tarde" — the opener says the extra time
    // ENABLES the action, so anything it would prevent is incoherent.
    { text: 'Con más tiempo, ', avoidP: [], avoidV: ['llegar', 'tener', 'dormir', 'esperar', 'buscar'] },
    { text: 'Con más ayuda, ', avoidP: [], avoidV: ['llegar', 'tener', 'dormir', 'esperar', 'buscar'] },
  ],
};

const TENSES = ['presente', 'presente_continuo', 'preterito', 'imperfecto', 'perfecto', 'pluscuamperfecto', 'futuro', 'condicional'];

// which tiempos are in play at each level. The subjuntivo lands at B2 when
// the trigger-clause generator exists; until then B1 is the ceiling.
const LEVEL_TENSES = {
  A2: ['presente', 'presente_continuo', 'preterito', 'imperfecto', 'perfecto'],
  B1: TENSES,
};

const TIEMPO_LABEL = {
  presente: 'Presente', presente_continuo: 'Presente continuo',
  preterito: 'Pretérito', imperfecto: 'Imperfecto',
  perfecto: 'Pretérito perfecto', pluscuamperfecto: 'Pluscuamperfecto',
  futuro: 'Futuro', condicional: 'Condicional',
};
// lowercase, for the mark-free.js prompt and the star/harvest rows
const TIEMPO_ES = {
  presente: 'presente', presente_continuo: 'presente continuo',
  preterito: 'pretérito', imperfecto: 'imperfecto',
  perfecto: 'pretérito perfecto', pluscuamperfecto: 'pluscuamperfecto',
  futuro: 'futuro', condicional: 'condicional',
};
// matches the groups in tenseExplainEs.js, so the chip rows and the
// Explainer's accordion sections stay in step
const TIEMPO_GROUP = {
  presente: 'present', presente_continuo: 'present',
  preterito: 'past', imperfecto: 'past', perfecto: 'past', pluscuamperfecto: 'past',
  futuro: 'future', condicional: 'future',
};

const rand = a => a[Math.floor(Math.random() * a.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* Adverbials that assert a repeating schedule. A state does not recur on one,
   so `stative` verbs never take them — "vive cerca del hotel todos los días". */
const FREQ_ADVERBS = new Set(['normalmente', 'siempre', 'a veces', 'todos los días', 'cada día', 'de vez en cuando', 'en aquella época']);
/* Short unfinished windows — wrong for a long-running state in the perfecto
   ("ha vivido cerca del hotel esta semana"). */
const SHORT_WINDOW = new Set(['hoy', 'esta mañana', 'esta semana']);
/* ⚠️ The mirror image, and the opposite failure. A `routine` verb is one you
   do constantly, so a SINGLE instance of it framed over a week or a month is
   a pointless thing to report: "ha bebido un café esta semana", "ha cocinado
   una tortilla este mes", "tendrán hambre la semana que viene". The A2 pool is
   almost entirely routine vocabulary, which is why this bit hardest there.
   Note the two flags do opposite jobs: `stative` loses the SHORT windows,
   `routine` loses the WIDE ones. Most entries carry neither, and `tener`
   carries BOTH: hunger is a state, so it takes no frequency phrase, and it
   is also an everyday one, so it cannot be predicted a month out.
   It is per-ENTRY, not per-verb: `ver la piscina` in the hotel is routine,
   `ver una película` is not, and "hemos visto una película este mes" is fine. */
const WIDE_WINDOW = new Set(['esta semana', 'este mes', 'la semana que viene', 'el mes que viene']);

/* ⚠️ THE NOSOTROS TRAP. For -ar and -ir verbs the nosotros form is IDENTICAL in
   the presente and the pretérito: "limpiamos" is both "we clean" and "we
   cleaned". With no time cue the sentence has two correct answers while the
   answer key holds only one — the worst possible specimen, because the student
   is marked wrong for being right. -er verbs are safe (comemos / comimos).
   Every such sentence therefore carries a disambiguating adverbial; stative
   verbs, which cannot take one, lose the nosotros subject instead. */
const DISAMBIG = {
  presente: ['normalmente', 'siempre', 'a veces', 'todos los días', 'cada día'],
  preterito: ['ayer', 'anoche', 'el lunes pasado', 'la semana pasada'],
};
const nosotrosAmbiguous = (v, tense) => v.type !== 'er' && !!DISAMBIG[tense];

/* Raw intersection of a focus rule with the level's tiempos. May be length 1.
   This is the GENERATION resolver — callers pass an explicit list. */
function tiemposIn(level, allow = null) {
  const base = LEVEL_TENSES[level] || LEVEL_TENSES.B1;
  if (allow == null) return base;
  const narrowed = base.filter(t => axisAllows(t, allow));
  return narrowed.length ? narrowed : base;
}

/* The CHIP resolver. Tiempo is Spanish's only axis, so narrowing to a single
   option leaves no question at all — that falls back to the full level set
   rather than shipping a tap-the-only-button exercise.
   The component feeds THIS list back into makeES, so the pool and the chips
   are the same list by construction and cannot drift. */
function tensesFor(level, allow = null) {
  const narrowed = tiemposIn(level, allow);
  return narrowed.length >= 2 ? narrowed : (LEVEL_TENSES[level] || LEVEL_TENSES.B1);
}

function makeES(level, allow = null) {
  const tense = rand(tiemposIn(level, allow));

  // Domain first: the weighting decides whether this is everyday life or the
  // hotel, and that choice carries the verb list, the subject list and the
  // role rules with it.
  const mix = DOMAIN_MIX[level] || DOMAIN_MIX.B1;
  const total = mix.reduce((n, [, w]) => n + w, 0);
  let roll = Math.random() * total, domain = mix[0][0];
  for (const [d, w] of mix) { if (roll < w) { domain = d; break; } roll -= w; }

  const pool = DOMAIN_VERBS[domain].filter(v => (level === 'A2' ? v.min === 'A2' : true));
  const SUBJECTS = DOMAIN_SUBJECTS[domain];

  let p = pool.filter(v => !(v.skip || []).includes(tense));
  if (tense === 'presente_continuo') p = p.filter(v => v.cont);
  // A framed tiempo with no object strands the verb: the anchor promises a
  // completed task and "el jefe había dormido" does not deliver one.
  if (tense === 'pluscuamperfecto') p = p.filter(v => v.objs.length);
  if (!p.length) p = pool;
  const v = rand(p);

  const frameSet = (FRAMES[tense] || null) && FRAMES[tense].filter(f => !(f.avoidV || []).includes(v.inf));
  const frame = (frameSet && frameSet.length) ? rand(frameSet)
    : (FRAMES[tense] ? rand(FRAMES[tense]) : { text: '', avoidP: [] });

  // Object first: its role decides who can plausibly be the subject. A `#s` /
  // `#g` suffix overrides the verb-level role. Inside the hotel the learner is
  // the GUEST, so anything not explicitly marked staff defaults to guest —
  // otherwise the receptionist ends up sleeping in a guest room.
  const objRaw = v.objs.length ? rand(v.objs) : '';
  const role = (objRaw.match(/#([sg])$/) || [])[1] || v.role || (domain === 'hotel' ? 'g' : null);
  const objText = objRaw.replace(/#[sg]$/, '');

  // a stative verb cannot carry a disambiguating adverbial, so it drops the
  // ambiguous nosotros subject rather than producing a two-answer sentence
  const banNosotros = nosotrosAmbiguous(v, tense) && v.stative;
  // A subject cannot be its own object ("los huéspedes están recibiendo a los
  // huéspedes"). Match on the bare head noun, so "el cliente" also rules out
  // "a los clientes".
  const headOf = t => t.replace(/^(el|la|los|las|mi)\s+/, '').replace(/s$/, '');
  const subjPool = SUBJECTS.filter(s =>
    !frame.avoidP.includes(s.p) &&
    !(banNosotros && s.p === 3) &&
    (!role || !s.r || s.r === role) &&
    !(objText && objText.includes(headOf(s.text))));
  const subj = rand(subjPool.length ? subjPool : SUBJECTS);

  const vp = vpFor(v, tense, subj.p);
  const obj = objText.includes(headOf(subj.text)) ? '' : objText;

  let advPool = ADVERBS[tense];
  if (v.stative) advPool = advPool.filter(a => !FREQ_ADVERBS.has(a) && !SHORT_WINDOW.has(a));
  if (v.routine) advPool = advPool.filter(a => !WIDE_WINDOW.has(a));
  let adv = frame.text ? '' : rand(advPool.length ? advPool : ['']);
  // the nosotros time cue is compulsory, not a preference
  if (subj.p === 3 && nosotrosAmbiguous(v, tense)) adv = rand(DISAMBIG[tense]);
  if (!obj && !adv && !frame.text) {
    const nonEmpty = advPool.filter(a => a);
    if (nonEmpty.length) adv = rand(nonEmpty);   // never a bare one-word predicate
  }

  // "ya" is the pluscuamperfecto's natural companion, but not compulsory
  const ya = (tense === 'pluscuamperfecto' && Math.random() < 0.7) ? 'ya ' : '';
  const subjText = frame.text ? subj.text : cap(subj.text);
  const pre = frame.text + subjText + ' ' + ya;
  const post = (obj ? ' ' + obj : '') + (adv ? ' ' + adv : '') + '.';
  return { sentence: pre + vp + post, pre, vp, post, tense, verb: v.inf };
}

function startLevel(profile) {
  const l = (profile?.level || '').toUpperCase();
  return l.startsWith('A') ? 'A2' : 'B1'; // A2/B1 only; higher levels get the B1 pool
}

export {
  makeES, vpFor, TENSES, LEVEL_TENSES, TIEMPO_LABEL, TIEMPO_ES, TIEMPO_GROUP,
  tensesFor, tiemposIn, startLevel,
};
