# HANDOVER — 6 July 2026

**Session focus:** (A) Irregular Verbs page polish — infinitive terminology, BrE spelling, two new verb-pattern groups. (B) Spanish tense parity Phase 1 — the ES Tense Explainer and ES Verb Conjugator now carry the same nine tiempos.

All code changes esbuild-validated + Node smoke-tested. Nothing committed — James pushes.

---

## 1. Design decision confirmed: the nine-tiempo union

James's rule, agreed this session: **if a tiempo is worthy of one of the three Spanish surfaces (Explainer / Tagger+bank / Conjugator), it belongs in all of them.** Target end-state, all nine ids canonical from today:

`presente · presente_continuo · preterito · imperfecto · perfecto · pluscuamperfecto · futuro · condicional · subjuntivo`

These id/tiempo strings are now THE keys — the engine and bank (`answer.tiempo`) must adopt them exactly as Tagger support lands in Phases 2–4. Ground truth before this session: Explainer + Tagger + bank had the first four; the Conjugator had eight (all except presente_continuo).

**Subjuntivo ruling (James, this session):** a long way off for most ss, *not* a priority — but build it **properly** so it's there in wait. That means Phase 4 uses **trigger-framed specimens** (*Espero que **vengas** mañana*), not bare forms: a naked *hable* is indistinguishable from a command (or misread as *hablé*), and recognising the trigger IS the skill. No shortcut Explainer-only variant.

## 2. Task A — Irregular Verbs page (DONE, in this push)

Files: `src/lib/irregularVerbsEn.js`, `src/components/IrregularVerbsEN.jsx`

- **"Base form" → "Infinitive"** everywhere student-facing: FORMS label, table header, group title ("Infinitive = past participle"), blurb, *beat* note, header comments. Explainer/Taggers grepped clean beforehand — this page was the last "base form" holdout, so the app is now consistent. (Internal JS destructuring var `base` deliberately untouched.)
- **BrE:** *read* footnote "Spelled the same" → "Spelt the same".
- **Two new groups** split out (order/membership easily tweakable):
  - `ought_aught` **-ought / -aught** (7): buy, bring, think, fight, seek, catch, teach — from past_eq_pp.
  - `ew_own` **-ew → -own** (6): know, grow, fly, throw, blow, draw — from three_diff. *draw* included (drew/drawn — -wn participle). *show* kept in three_diff (regular past *showed*, doesn't fit -ew).
- Final 8 groups: no_change 15 · infinitive=pp 3 · ought_aught 7 · past_eq_pp 36 · brit_t 5 · i_a_u 6 · ew_own 6 · three_diff 27 = **105 verbs, zero duplicates** (Node-verified).

### ✅ DONE — title rename (executed this session)
Old title `Irregular Verbs Past ⏳` → **`Irregular Verbs: Past Forms ⏳`** across all four byte-identical sites plus the page H1:
1. Supabase `exercises.title`, id `adfe0153-e40e-4856-b4ed-12cf1671fa5b` — **updated live + read-back byte-verified** (matches_target = true)
2. `ACTIVE_EXERCISES` in `src/ExerciseList.jsx` — done (in this push)
3. `EXERCISE_ICONS` key in `src/ExerciseList.jsx` — done (in this push)
4. Routing branch `if (t === …)` in `src/ExerciseList.jsx` — done (in this push)
Plus the page H1 in `IrregularVerbsEN.jsx` (`⏳ Irregular Verbs: Past Forms`) — done. Both files esbuild-clean; grep confirms 3 new occurrences in ExerciseList, 0 of the old string, H1 updated. **Note the DB is already live**, so until the push lands, the deployed code still routes on the old string — the tile will show but clicking it won't open until `ExerciseList.jsx` ships. Push promptly.

## 3. Task B — Spanish tense parity, Phase 1 (DONE, in this push)

### `src/lib/tenseExplainEs.js` — 4 → 9 tiempos
Five new cards: **perfecto, pluscuamperfecto, futuro, condicional, subjuntivo** — formula, `use`, signal-word chips, examples, watch-outs. All ⚠️ **first-draft for James's review** (Spanish-teacher turf), incl. the new formulas (only the core four's are lifted from the Tagger's FORMULAS_ES). New groups `future` ("Future & conditional") and `subjunctive` ("Subjunctive"), labels mirroring the Conjugator. `formulaByTiempo` now has 9 keys (harmless to the Tagger — it only looks up tiempos it knows).

**`practisable: false`** on all five new entries. The flag gates BOTH "Show me a real example" (bank fetch) AND "Practise this in Tense Tagger" in TenseCardES — no dead bank queries, no filters the engine can't honour. **Flip per tiempo as Tagger support lands** (Phases 2–4). Core four untouched (no flag = practisable).

### `src/components/TenseCardES.jsx`
- New ESTimeline shapes: **perfecto** = past dot + band reaching *ahora*; **pluscuamperfecto** = earlier of two past dots (second hollow/faint); **futuro** = solid dot beyond *ahora*; **condicional** = dashed hollow dot beyond *ahora* (hypothetical).
- **subjuntivo renders NO timeline** (ESTimeline returns null + wrapper skipped) — a mood has no position on a timeline; drawing one would teach the wrong idea.
- Both action buttons gated on `tense.practisable !== false`.

### `src/lib/verbConjugatorEs.js` — 8 → 9 tenses
New **presente_continuo** entry in the present group: kind `compound`, aux **estar** (estoy…están), gerund line *hablando · comiendo · viviendo*, 9 irregular-gerund chips (diciendo, pidiendo, viniendo, durmiendo, muriendo, leyendo, oyendo, trayendo, yendo), pattern note (-yendo / e→i / o→u), "never for the future" watch-out. Content first-draft for review.

### `src/components/VerbCardES.jsx` — compound renderer generalised
- SubHead now reads `tense.aux.verb` ("The auxiliary — estar/haber")
- Green box label reads `tense.complement` (fallback `'participio'`)
- Chips heading reads `tense.irregularFormsLabel` (fallback `'Irregular participles'`)
Existing haber tenses render byte-identically via the fallbacks.

### Verified (Node smoke test)
Both libs export the **identical nine ids**, same four groups (present 2 · past 4 · future 2 · subjunctive 1), no duplicate ids, PC aux has 6 forms, core four carry no `practisable` flag. TenseTaggerES builds its chips from the **engine's** `TENSES` (tenseEngineEs.js), not the Explainer lib — confirmed new entries cannot leak into the game. `src/components/TenseExplainerES.jsx` header comment updated (comment-only).

## 4. NEXT SESSION — the staged plan (Phases 2–4)

Specimens are **engine-generated**, not hand-authored: `scripts/generate_tense_specimens.mjs` imports the shared engine, generates, Haiku-filters for naturalness, inserts (~350/tiempo/level). So each phase = teach `src/lib/tenseEngineEs.js` the conjugations → add the tiempo to its `TENSES` → flip `practisable` in tenseExplainEs.js → **James runs the generator locally** (it needs `.env.local` keys).

- **Phase 2 — futuro + condicional** (do as a pair): synthetic, whole-infinitive + endings, sharing the same ~12 irregular stems (tendr-, pondr-, saldr-, vendr-, podr-, sabr-, har-, dir-, querr-, habr-…). Cleanest engine add.
- **Phase 3 — perfecto + pluscuamperfecto** (pair): compound — the engine is currently a conjugator, not an auxiliary chain, so it needs a haber + participio composition path incl. irregular participles (hecho, dicho, visto, puesto, escrito, abierto, vuelto, roto, muerto).
- **Phase 4 — subjuntivo** (low priority, build properly): trigger-framed specimens — the frame carries the trigger clause (*espero que…*, *no creo que…*, *cuando* [future-referring], *para que*, *ojalá*) so the subjunctive form is legitimately identifiable. Needs a new frame shape in the engine/generator; James's steer: fine to sit last, but no half-measures when built.
- **Also next session (James, this session): standardise "helper verb" → "auxiliary verb" across the codebase.** Not yet audited — grep the repo (student-facing copy, hints/explanations in the question bank too: check `question_bank` hint/explanation text in Supabase, not just source files) and sweep in one pass.

## 5. Also pending (unchanged from previous handovers)
- Spanish Modal Explainer (EN version exists)
- GET21 B2B organisational data structures / progress reporting
- Flashcard rebuild
- Spanish GOTD B1/B2 + C1/C2 content
- Question bank last used number: **2048** (next batch 2049 — but always `SELECT MAX(question_number)` live first)

## 6. Conventions in force
Propose → confirm → execute for anything live/risky · James does ALL git · dryRun before edit_file · esbuild-validate JSX (`npx esbuild file.jsx --format=esm --loader:.jsx=jsx --outfile=/dev/null`) · "infinitive" not "base form" · **"auxiliary verb" not "helper verb" (new)** · BrE spellings · dollar-quoting for SQL strings with apostrophes/accents · handovers live only in repo root.
