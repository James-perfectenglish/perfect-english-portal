/* ============================================================
   Tense Tagger — focus model (shared, pure JS)
   ------------------------------------------------------------
   Read by:
     • src/lib/tenseEngineEn.js      (spec filtering)
     • src/lib/tenseEngineEs.js      (tiempo filtering)
     • src/components/TenseTagger.jsx / TenseTaggerES.jsx
     • scripts/generate_tense_specimens.mjs (indirectly, via the engines)

   THE POINT
   Narrowing what the exercise asks about, so a student practising one
   contrast is not also being marked on two axes nobody mentioned.

   ⚠️ RECTANGLES vs DIAGONALS. Per-axis rules can only describe a RECTANGLE:
   "Past: simple vs perfect" pins Time and offers two Types. Some real teaching
   contrasts are DIAGONAL — present perfect vs past simple pairs present with
   perfect and past with simple, and the nearest rectangle is four tenses, not
   two. Worse, restricting the pool to the diagonal without changing the UI
   would correlate Time and Type, so a student who spots that present always
   means perfect gets the second axis free — the very score inflation this
   file exists to prevent.
   Hence `combos`: a list of whole tense descriptions, asked as ONE decision on
   a single chip row rather than as separate axes. Axes named inside the combos
   stop being questions in their own right and their per-axis rules are ignored.
   Spanish never needs this — it has one axis, so every pair is expressible.

   Every axis is in one of three states:
     mix        — value is null/absent. All the level's options are live
                  and the axis IS asked.
     pinned     — value is a single string. The axis is NOT asked: it is
                  fixed, and shown as context above the sentence.
     restricted — value is an array of 2+. The axis IS asked, but only
                  those options appear as chips.

   ⚠️ THE RULE THAT MATTERS: filtering the specimen pool is not enough.
   If we serve only present-tense sentences but leave past/present/future
   live as chips, Time becomes a freebie the moment a student notices —
   the score inflates and tense_attempts stops meaning anything. A pinned
   axis must be REMOVED from the question, not merely biased. Hence the
   pinned/restricted split, and hence `liveAxes` driving both the chips
   and the scoring.

   (This is a real bug in the pre-focus "Practise this" lock, which
   generated one tense but still rendered every chip.)
   ============================================================ */

/* ---------- core: does a concrete value satisfy an axis rule? ---------- */
// rule: null | undefined → anything; string → exact; array → membership
export function axisAllows(value, rule) {
  if (rule == null) return true;
  if (Array.isArray(rule)) return rule.length ? rule.includes(value) : true;
  return value === rule;
}

/* ---------- combos: the diagonal case ---------- */
export const COMBO_AXIS = 'tense';

// stable identity for a combo, used as the chip value and in tense_attempts
export const comboKey = c => ['time', 'aspect', 'voice'].filter(k => c[k]).map(k => c[k]).join('|');

// which axes the combos have taken over — these stop being separate questions
export function comboKeys(focus) {
  if (!focus?.combos?.length) return [];
  const keys = new Set();
  for (const c of focus.combos) for (const k of Object.keys(c)) keys.add(k);
  return [...keys];
}

const matches = (answer, combo) => Object.entries(combo).every(([k, v]) => answer[k] === v);
export const comboAllows = (answer, combos) => !combos?.length || combos.some(c => matches(answer, c));

// the combo a concrete answer satisfies — the "correct chip" for scoring
export const answerComboKey = (answer, combos) => {
  const c = (combos || []).find(x => matches(answer, x));
  return c ? comboKey(c) : null;
};

/* Combos still reachable at this level, with a label. A preset written for B1
   may name a tense the level does not carry, and an unreachable chip is a free
   elimination, so it is dropped rather than shown. */
export function comboOptions(focus, specs) {
  if (!focus?.combos?.length) return [];
  return focus.combos
    .filter(c => specs.some(sp => matches(sp.answer, c)))
    .map(c => ({ combo: c, key: comboKey(c) }));
}

// a length-1 array is a pin, not a restriction — normalise so callers
// never have to check both shapes
export function normaliseFocus(focus) {
  if (!focus) return null;
  const out = {};
  let any = false;
  for (const [k, v] of Object.entries(focus)) {
    if (v == null) continue;
    if (k === 'combos') {                       // list of objects, never collapsed
      if (Array.isArray(v) && v.length) { out.combos = v.map(c => ({ ...c })); any = true; }
      continue;
    }
    const val = Array.isArray(v) ? (v.length === 1 ? v[0] : v.slice()) : v;
    if (Array.isArray(val) && !val.length) continue;
    out[k] = val; any = true;
  }
  return any ? out : null;
}

// 'mix' | 'pinned' | 'restricted' for one axis, plus the chips it should show
export function axisState(focus, axis, allOpts) {
  const rule = focus ? focus[axis] : null;
  if (rule == null) return { state: 'mix', opts: allOpts, pin: null };
  if (!Array.isArray(rule)) {
    return allOpts.includes(rule)
      ? { state: 'pinned', opts: [], pin: rule }
      : { state: 'mix', opts: allOpts, pin: null };   // pin unavailable at this level → ignore it
  }
  const opts = allOpts.filter(o => rule.includes(o));
  if (opts.length === 0) return { state: 'mix', opts: allOpts, pin: null };
  if (opts.length === 1) return { state: 'pinned', opts: [], pin: opts[0] };
  return { state: 'restricted', opts, pin: null };
}

/* Which axes the student is actually being asked about, given the level's
   axes and the focus. Never returns empty: if a focus would pin everything,
   the last axis is released, because an exercise with no question is not an
   exercise. */
export function liveAxesFor(focus, gateAxes, optsByAxis) {
  const covered = comboKeys(focus);
  const rest = gateAxes
    .filter(ax => !covered.includes(ax))
    .filter(ax => axisState(focus, ax, optsByAxis[ax]).state !== 'pinned');
  // the combo row IS the question for the axes it covers, so it counts as live
  if (covered.length) return [COMBO_AXIS, ...rest];
  return rest.length ? rest : [gateAxes[gateAxes.length - 1]];
}

/* ---------- what gets written to tense_attempts.focus ---------- */
// null when nothing is narrowed, so an unfocused attempt stays NULL in the
// column and the old rows remain directly comparable.
export function focusToJson(focus) {
  const f = normaliseFocus(focus);
  return f && Object.keys(f).length ? f : null;
}

/* ---------- English ---------- */
export const EN_AXIS_LABEL = { time: 'Time', aspect: 'Type', voice: 'Voice' };

// nearest teaching contrast for each aspect — used by the "Practise this" bridge
const EN_ASPECT_PARTNER = {
  simple: 'continuous', continuous: 'simple',
  perfect: 'perfect_continuous', perfect_continuous: 'perfect',
};

const BAND_ORDER = ['A2', 'B1', 'B2', 'C1'];
const bandAtLeast = (level, min) => BAND_ORDER.indexOf(level) >= BAND_ORDER.indexOf(min);

export const EN_PRESETS = [
  { id: 'all',         min: 'A2', label: 'All tenses',            focus: null },
  { id: 'time_only',   min: 'A2', label: 'Time only',             hint: 'past / present / future',        focus: { aspect: 'simple', voice: 'active' } },
  { id: 'simple_cont', min: 'A2', label: 'Simple vs continuous',  hint: 'across all three times',         focus: { voice: 'active', aspect: ['simple', 'continuous'] } },
  { id: 'present',     min: 'A2', label: 'Present only',          hint: 'active voice',                   focus: { time: 'present', voice: 'active' } },
  { id: 'past',        min: 'A2', label: 'Past only',             hint: 'active voice',                   focus: { time: 'past', voice: 'active' } },
  { id: 'future',      min: 'A2', label: 'Future only',           hint: 'active voice',                   focus: { time: 'future', voice: 'active' } },
  { id: 'past_perf',   min: 'B1', label: 'Past: simple vs perfect', hint: 'the classic mix-up',           focus: { time: 'past', voice: 'active', aspect: ['simple', 'perfect'] } },
  // DIAGONAL — see the combos note at the top. Present pairs with perfect and
  // past with simple, which no per-axis rule can express.
  { id: 'pp_vs_past',  min: 'B1', label: 'Present perfect vs past simple', hint: 'have done / did — the classic',
    focus: { voice: 'active', combos: [{ time: 'present', aspect: 'perfect' }, { time: 'past', aspect: 'simple' }] } },
  { id: 'voice_only',  min: 'B1', label: 'Active vs passive',     hint: 'past simple only — voice alone', focus: { time: 'past', aspect: 'simple' } },
  { id: 'perf_cont',   min: 'B2', label: 'Perfect vs perfect continuous', hint: 'present, active',        focus: { time: 'present', voice: 'active', aspect: ['perfect', 'perfect_continuous'] } },
];

export const presetsForLevelEn = level => EN_PRESETS.filter(p => bandAtLeast(level, p.min));

/* "Practise this" from the Tense Explainer.
   The old behaviour pinned all three axes, which left nothing to decide —
   a production drill wearing a recognition costume. Instead: pin time and
   voice, and put the chosen aspect up against its nearest contrast. Two
   chips, one real decision, still centred on the tense they clicked. */
export function focusForTenseEn(tense, aspectOpts) {
  if (!tense) return null;
  const partner = EN_ASPECT_PARTNER[tense.aspect];
  const pair = [tense.aspect, partner].filter(a => a && aspectOpts.includes(a));
  return normaliseFocus({
    time: tense.time,
    voice: tense.voice,
    aspect: pair.length >= 2 ? pair : null,
  });
}

/* ---------- Spanish ---------- */
// nearest teaching contrast for each tiempo
const ES_PARTNER = {
  presente: 'presente_continuo', presente_continuo: 'presente',
  preterito: 'imperfecto', imperfecto: 'preterito',
  perfecto: 'pluscuamperfecto', pluscuamperfecto: 'perfecto',
  futuro: 'condicional', condicional: 'futuro',
};

export const ES_PRESETS = [
  { id: 'all',         min: 'A2', label: 'All tenses',                     focus: null },
  { id: 'pret_imp',    min: 'A2', label: 'Pretérito vs imperfecto',        hint: 'the one that matters',      focus: { tiempo: ['preterito', 'imperfecto'] } },
  { id: 'pres_cont',   min: 'A2', label: 'Presente vs presente continuo',  hint: 'when -ndo is wrong',        focus: { tiempo: ['presente', 'presente_continuo'] } },
  { id: 'pret_perf',   min: 'A2', label: 'Pretérito vs perfecto',          hint: 'ayer comí / hoy he comido', focus: { tiempo: ['preterito', 'perfecto'] } },
  { id: 'past_all',    min: 'A2', label: 'Past tenses only',               hint: 'all four',                  focus: { tiempo: ['preterito', 'imperfecto', 'perfecto', 'pluscuamperfecto'] } },
  { id: 'present_all', min: 'A2', label: 'Present only',                   focus: { tiempo: ['presente', 'presente_continuo'] } },
  { id: 'perf_plus',   min: 'B1', label: 'Perfecto vs pluscuamperfecto',   hint: 'have vs had',               focus: { tiempo: ['perfecto', 'pluscuamperfecto'] } },
  { id: 'fut_cond',    min: 'B1', label: 'Futuro vs condicional',          hint: 'will vs would',             focus: { tiempo: ['futuro', 'condicional'] } },
];

export const presetsForLevelEs = level => ES_PRESETS.filter(p => bandAtLeast(level, p.min));

/* "Practise this" from the Spanish Tense Explainer — the contrast pair,
   for the same reason as the English bridge. `available` is the tiempo
   list for the student's level, so a pin whose partner is out of band
   (perfecto at A2) falls back to the whole group rather than to nothing. */
export function focusForTiempoEs(tiempo, available, groupOf) {
  if (!tiempo) return null;
  const partner = ES_PARTNER[tiempo];
  if (partner && available.includes(partner) && available.includes(tiempo)) {
    return { tiempo: [tiempo, partner] };
  }
  const group = available.filter(t => groupOf[t] === groupOf[tiempo]);
  return group.length >= 2 ? { tiempo: group } : null;
}

/* ---------- context strip ---------- */
// human-readable summary of the PINNED axes only — the things that have been
// taken out of the question and therefore need showing as context.
export function pinnedSummary(focus, axes, optsByAxis, labels) {
  if (!focus) return [];
  const covered = comboKeys(focus);   // asked on the combo row, so not context
  return axes
    .filter(ax => !covered.includes(ax))
    .map(ax => ({ ax, st: axisState(focus, ax, optsByAxis[ax]) }))
    .filter(x => x.st.state === 'pinned')
    .map(x => `${labels[x.ax]}: ${String(x.st.pin).replace(/_/g, ' ')}`);
}
