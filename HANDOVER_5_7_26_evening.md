# HANDOVER — 5 Jul 2026 (evening)

**Session: Verb reference pages × 2 — Spanish Verb Conjugator + English Irregular Verbs. Both built, registered, live in the Learn tab (track-gated).**

(Follows this morning's `HANDOVER_5_7_26.md` — Modal Match / SC-overlay session. Unrelated code paths; no overlap.)

---

## 0. TL;DR

Two new Learn **reference** pages, siblings to the Tense/Modal Explainers, same visual language (shared `C` palette + `PG` gradient), same content-module-in-`lib` pattern:

- **Verb Conjugator 🇪🇸** — Spanish conjugation tables for the native-English Spanish learners. 8 tenses, regular -ar/-er/-ir tables, curated irregulars, and a plain-English gloss anchoring each Spanish tense to the English one ("pluscuamperfecto = *I had eaten*"). Track-gated `['spanish']`.
- **Irregular Verbs Past ⏳** — the three principal parts of ≈105 core English irregular verbs, grouped by pattern, with a forms-explainer on when each form fires. Track `['general']` (ESL audience).

Both cross-link to their **own-language** Tense Explainer (James's rule). DB rows are live; **code needs James's push** → until then both tiles show as *Soon* on the deployed build.

---

## 1. Database (live — no deploy needed)

Two `exercises` rows inserted (both `category='learn'`, `type='reference'`, `level='A1-C2'`):

| title | id | tracks | order |
|---|---|---|---|
| `Verb Conjugator 🇪🇸` | `57184139-e8f4-4c05-b17f-a350615e367f` | `['spanish']` | 2 |
| `Irregular Verbs Past ⏳` | `adfe0153-e40e-4856-b4ed-12cf1671fa5b` | `['general']` | 3 |

- Ordered to sit the grammar references together: Tense Explainer (0) · Modal Explainer (1) · Verb Conjugator (2) · Irregular Verbs (3).
- **Interim state**: rows are live but the deployed bundle doesn't yet have the titles in `ACTIVE_EXERCISES`, so on the current build the tiles render as *Soon* / not clickable. Resolves on push → Vercel deploy → PWA refresh. Harmless teaser.
- Track note: `Irregular Verbs Past ⏳` is `['general']` to match how Tense/Modal Explainer already appear for everyone — so Spanish-track students see it too. Cleanly hiding a general tile from `spanish` isn't expressible in the current track filter (no `english` track; empty-tracks users see everything). Parked as a possible "exclude tracks" enhancement if the Spanish Learn tab feels cluttered.

## 2. New files — Spanish Verb Conjugator (3)

- **`src/lib/verbConjugatorEs.js`** — content module. `PERSONS` (yo/tú/él/nosotros/**vosotros**/ellos — Peninsular, no vos), `DATA[]` of 8 tenses, derived `tensesByGroup()` / `GROUP_LABEL` / `byId`. Each tense: `kind` (`simple` → hablar/comer/vivir columns; `compound` → haber column + invariable participle), `anchor` (English hook for the collapsed row), `gloss` (the English anchor), `formation`, `irregulars[]`, `irregularNote` (markdown-lite), `watchOut`.
  - Tenses: presente · pretérito indefinido · imperfecto · pretérito perfecto · pluscuamperfecto · futuro · condicional · presente de subjuntivo. Grouped Present / Past / Future & conditional / Subjunctive.
- **`src/components/VerbCardES.jsx`** — one tense's card. Gradient header (Spanish + English name + formation) → English gloss box → conjugation table (`ConjTable`, person × verb columns) → irregular participles chips (compound) or "Key irregulars" table (simple) → pattern note → amber "watch out" → optional `onOpenExplainer` foot link. Has its own `renderMd` (**bold**/*italic*).
- **`src/components/VerbConjugatorES.jsx`** — the accordion page (one tense open at a time), grouped. Props: `onOpenExplainer`.

## 3. New files — English Irregular Verbs (2)

- **`src/lib/irregularVerbsEn.js`** — content module. `FORMS[]` (base / past simple / past participle, each with a plain "used for" gloss — the participle gloss carries the money point: needs a helper, perfect + passive, *"I have gone" not "I have went"*). `GROUPS_EN[]` = 6 pattern groups (No change · Base=participle · Past=participle · British -t · the i–a–u set · All three different). Each verb `[base, past, pp]` or `[base, past, pp, note]`. `VERB_COUNT` computed (≈105). **British English throughout** (got not gotten; learnt/burnt/spelt/dreamt/smelt; hang/hung vs hanged; etc.).
- **`src/components/IrregularVerbsEN.jsx`** — page: three always-visible forms cards, then the 6 pattern groups as an accordion of tables (`VerbTable`, base/past/participle columns, per-verb footnotes via keyed `<Fragment>`), "All three different" open by default. Own `renderMd`. Props: `onOpenExplainer`.

## 4. `src/ExerciseList.jsx` — registration (the one modified file)

Both tiles registered at the standard three points (+ import). Title strings **byte-identical** across `ACTIVE_EXERCISES`, `EXERCISE_ICONS`, the routing `if (t === …)`, and the DB (the drift trap — checked):

- Imports: `VerbConjugatorES`, `IrregularVerbsEN`.
- `ACTIVE_EXERCISES`: `'Verb Conjugator 🇪🇸'`, `'Irregular Verbs Past ⏳'`.
- `EXERCISE_ICONS`: `'Verb Conjugator 🇪🇸' → '🔤'`, `'Irregular Verbs Past ⏳' → '⏳'` (⏳ chosen partly to differ from the flashcards' 📚 and avoid a twin).
- Routing branches: each renders its component with `onOpenExplainer` wired to open the **Tense Explainer** exercise. Because Tense Explainer is itself track-routed (`isSpanishTrack ? TenseExplainerES : TenseExplainer`), a Spanish student lands on the ES Explainer and an English student on the EN Explainer — the own-language cross-link, for free.

## 5. Content — pending James's review

Same status as new ES Tagger/Explainer content: forms are hand-authored + double-checked, but glosses/groupings/watch-outs are the teacher's turf. Flagged in-file at the top of both content modules.
- **ES**: especially the pretérito-vs-imperfecto framing and the subjunctive "a mood, not a tense — learn the triggers" line; sanity-check the strong-preterite and shared future/conditional stem lists.
- **EN (BrE calls)**: `got/got` (+ AmE *gotten* note); the -t group (also regular -ed); `hang/hung` vs *hanged*; `lie/lay/lain` (vs *lay/laid* and *lie/lied*); `show/showed/shown`; `beat/beat/beaten`; `read` pronunciation; `be` as special.

## 6. ⚠️ Open item — ES Tense Explainer coverage gap

The **Spanish** cross-link ("📖 When do I use each tense?") lands on `TenseExplainerES`, which only has **4** tenses (presente, presente continuo, pretérito, imperfecto). The conjugator has **8**, so **5 have no matching Explainer card**: pretérito perfecto, pluscuamperfecto, futuro, condicional, presente de subjuntivo. The link isn't broken (opens a useful page) but under-delivers for those 5 cards.

**This is a proper ship, not a content top-up.** `tenseExplainEs.js`'s `tiempo` keys round-trip to the ES **Tagger + engine + `tense_specimens` bank** and the "Practise this" handoff — so adding futuro/condicional/subjuntivo cards needs either Tagger/engine/bank support for those tiempos, or an Explainer-only card variant with no "Practise this" button. Natural next ship whenever James wants it.

(The **English** cross-link has no such gap — the EN Tense Explainer already covers all its tenses.)

## 7. Validation

- All new files esbuild-validated on container (`--loader:.jsx=jsx`), plus the edited `ExerciseList.jsx` (25.8 KB, clean).
- Both `exercises` rows re-queried live post-insert; fields as tabled in §1.
- All five new files confirmed present on disk (`src/lib/verbConjugatorEs.js`, `src/lib/irregularVerbsEn.js`, `src/components/VerbCardES.jsx`, `src/components/VerbConjugatorES.jsx`, `src/components/IrregularVerbsEN.jsx`).

## Files changed this session (for the push)

New: `src/lib/verbConjugatorEs.js` · `src/components/VerbCardES.jsx` · `src/components/VerbConjugatorES.jsx` · `src/lib/irregularVerbsEn.js` · `src/components/IrregularVerbsEN.jsx`
Modified: `src/ExerciseList.jsx`

DB rows already live; code goes live on push → Vercel deploy → PWA hard-refresh.

## Testing checklist (after deploy)

- **Verb Conjugator 🇪🇸** (Spanish track / teacher Spanish track): tile after the Explainers; accordion of 8 tenses grouped Present/Past/Future & conditional/Subjunctive; a compound tense (perfecto/pluscuamperfecto) shows the haber column + participle line, not three columns; irregular participle chips render; foot link opens the Spanish Tense Explainer.
- **Irregular Verbs Past ⏳** (English track): three forms cards up top; "All three different" expanded by default; tapping pattern headers toggles tables; footnotes render (read, get, hang, lie, show, beat, be); foot link opens the English Tense Explainer. (Also visible to Spanish-track — expected.)
- Confirm neither tile shows a mis-icon/"Soon" after deploy (title-key drift check).

## Horizon deltas

- **NEW next-ship candidate**: expand `TenseExplainerES` to the full 8 tenses to close the conjugator cross-link loop (see §6) — interacts with the ES Tagger/engine/bank.
- **Content review** of both new reference pages pending (see §5).
- Everything else on the horizon unchanged from `HANDOVER_5_7_26.md` (Spanish Modal Explainer still doesn't exist; GOTD/WOTD Spanish gaps; GET21; etc.).
