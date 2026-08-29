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

// a length-1 array is a pin, not a restriction — normalise so callers
// never have to check both shapes
export function normaliseFocus(focus) {
  if (!focus) return null;
  const out = {};
  let any = false;
  for (const [k, v] of Object.entries(focus)) {
    if (v == null) continue;
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
  const live = gateAxes.filter(ax => axisState(focus, ax, optsByAxis[ax]).state !== 'pinned');
  return live.length ? live : [gateAxes[gateAxes.length - 1]];
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
  return axes
    .map(ax => ({ ax, st: axisState(focus, ax, optsByAxis[ax]) }))
    .filter(x => x.st.state === 'pinned')
    .map(x => `${labels[x.ax]}: ${String(x.st.pin).replace(/_/g, ' ')}`);
}
