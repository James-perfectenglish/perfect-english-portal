# Handover — 30 June 2026

**Arc:** Tense Tagger — the full build, now live on `app.perfect-english.org`.

This session completed and shipped the Tense Tagger exercise end to end: AI production marking, a Spanish track, a classroom UX pass, and an AI-filtered specimen bank backed by a shared engine. Everything below is verified against the live database and filesystem at time of writing.

---

## 1. What Tense Tagger is

An Activities exercise. The student is shown a sentence with a highlighted verb phrase, tags its tense (recognition), then writes their own sentence in that tense (production) to earn a star. Recognition is grammar composed from tags, so the answer key is free. Recognition attempts log to `tense_attempts`; the teacher views `tense_axis_accuracy` and `tense_confusion`; production stars go to `stars`; every harvested production sentence goes to `sc_sentences`.

Two components:
- `src/components/TenseTagger.jsx` — English. Axes: Time / Type / Voice, gated A2→C1. C1 adds a "function" phase (form ≠ meaning) using a small curated set served live.
- `src/components/TenseTaggerES.jsx` — Spanish track, for native-English learners of Spanish. A single **Tiempo** axis across four tenses (presente, presente continuo, pretérito, imperfecto), A2/B1 only. Routed in `src/ExerciseList.jsx` by `isSpanishTrack` (`userTracks.includes('spanish')`).

---

## 2. The specimen bank (the headline of this session)

**Problem it solves:** the live generator occasionally produced grammatically perfect but odd-sounding sentences ("We will have brought the menu by next year"). Rather than hand-curate, we pre-generate a large pool, pass each sentence through a one-time AI naturalness filter, and store the survivors. The component serves from that bank, with the live engine as a fallback.

### Database (all live)
- **Table `public.tense_specimens`** — columns: `id, language, level, pre, vp, post, sentence, answer, created_at`. `answer` is jsonb (`{time,aspect,voice,modality}` for EN, `{tiempo}` for ES). RLS **enabled**, one SELECT policy for `authenticated`. Unique index `tense_specimens_dedup_idx` on `(language, level, sentence)` for dedup; index on `(language, level)`.
- **RPC `public.tense_specimen_deck(p_language text, p_level text, p_limit int default 40)`** — returns `SETOF tense_specimens` ordered by `random()`, capped at 200. **SECURITY INVOKER** (respects RLS), granted to `authenticated`. This is how the component pulls a shuffled deck.

### Current contents (verified — all AI-filtered)
`9,061` specimens: en A2 1516 · en B1 1505 · en B2 1502 · en C1 1508 · es A2 1516 · es B1 1514.

### Shared engine — single source of truth
The generation/marking logic was extracted out of the components into:
- `src/lib/tenseEngineEn.js` — exports `makeGenerated, tenseName, productionResult, functionAccepts, FUNCTION_OPTIONS, startLevel, LEVEL_GATES` (plus internals).
- `src/lib/tenseEngineEs.js` — exports `makeES, vpFor, TENSES, TIEMPO_LABEL, TIEMPO_ES, startLevel`.

Both the components (fallback path) **and** the generator script import these, so the bank can never drift from what the live engine would produce. Pure JS, no React — importable by Vite and by Node.

### How the components read the bank
On mount and on every level change, each component fetches a deck of ~40 rows via the RPC into a `useRef`, clearing it on level change (guarded against in-flight fetches with a `levelRef`). It deals one specimen per item and refills in the background when the deck drops below 8. **If the bank is empty or the fetch fails, it falls back to the live engine** (`makeGenerated`/`makeES`), so the exercise never blocks — exactly mirroring the AI-arbiter/structural-fallback pattern used for production marking. The C1 curated form≠function items are still served live from the component (not banked).

---

## 3. The generator — and the keys workaround (READ THIS before re-running)

### The script
`scripts/generate_tense_specimens.mjs` (ESM). It imports the shared engines, generates per bucket, batches 20 sentences per call to Haiku (`claude-haiku-4-5-20251001`, same model the app marks with) for a keep/drop naturalness verdict, and inserts survivors into `tense_specimens` via **`pg`** using the `SUPABASE_DB` connection string (`ON CONFLICT (language,level,sentence) DO NOTHING`). Default target 1,500 survivors per bucket. Flags: `--dry` (generate + filter + print, no writes), `--lang=en|es`, `--level=A2|B1|B2|C1`, `--target=N`.

Requires one npm dep: **`pg`** (already installed). Reads two env vars: `ANTHROPIC_API_KEY` and `SUPABASE_DB`.

### ⭐ The keys workaround — no more terminal-quote hell
Pasting `export KEY='…'` into the terminal repeatedly broke (the editor turned straight quotes into curly ones, and long pastes carried hidden line breaks). The fix, now permanent:

- **`.env.local`** at the repo root holds both secrets, one per line, no quotes:
  ```
  ANTHROPIC_API_KEY=...
  SUPABASE_DB=...
  ```
  It is **gitignored** (covered by the `*.local` rule), so it never gets committed and the keys stay local.
- **`scripts/run-generator.sh`** is a tiny wrapper that loads `.env.local` and runs the generator:
  ```sh
  cd "$(dirname "$0")/.." || exit 1
  set -a; . ./.env.local; set +a
  node scripts/generate_tense_specimens.mjs "$@"
  ```

So every run is **one plain command — no exports, no quotes, no pasting secrets**:
```
sh scripts/run-generator.sh --dry --target=60     # preview
sh scripts/run-generator.sh                        # full run
sh scripts/run-generator.sh --lang=es              # one language, etc.
```

**General rule for any future key-needing script:** put the secrets in a gitignored `.env.local` and source them from a wrapper. Don't paste keys into the terminal. The only time `.env.local` needs recreating is on a fresh machine (it's deliberately not in git).

### Hardening (added after the credit incident)
On the first full run the Anthropic **credit balance ran out partway through**, returning `HTTP 400`. The old script default-kept on any error, so it quietly filled the C1 and both Spanish buckets with *unfiltered* engine output. Those 4,516 rows were deleted and regenerated cleanly once credits were topped up (visible in the healthy reject counts: C1 732, es A2 604, es B1 546).

The script now **aborts on a hard API error** (anything that isn't 429/529) and prints the real response body — so an out-of-credits or bad-key situation stops immediately with a clear message instead of silently degrading. Transient 429/529 still back off and retry; a one-off parse hiccup still keeps that single batch.

### When to re-run
Essentially never on a schedule — the bank is effectively infinite per student and specimens don't expire. Re-run a bucket only when you **expand the engine** (new verbs/subjects, the Spanish `futuro`, a new level). Re-runs are additive (dedup index skips duplicates); for a clean rebuild of a bucket, `DELETE` it first, then run with `--lang/--level`.

---

## 4. Already shipped earlier in the arc (for completeness)

- **AI production marking (`api/mark-free.js`, `type:'tense'`).** Additive branch `handleTense`, no new Vercel function (stays 8/12). The AI is the arbiter; the client-side structural regex (`productionResult`) is the offline fallback so a star is never lost to an outage. Has a `language:'es'` branch (feedback in English, tildes never fail). Every production submission (pass and fail) is harvested to `sc_sentences` (`source='tense_tagger'`). A 🤖 status pill uses the app's AI-purple convention.
- **Spanish track.** A conjugator (not an auxiliary chain). On an AI outage the ES production **soft-passes** (Spanish endings are too irregular to regex safely, so we never wrongly deny a star) — unlike EN which falls back to the structural check.
- **View migration.** `tense_confusion` and `tense_axis_accuracy` had `'tiempo'` appended to their axis VALUES lists so the Spanish single-axis data surfaces. English rows unaffected (disjoint keys).
- **Phase A classroom UX** (both components): "Specimen"→"Sentence"; "Aspect"→"Type" (EN only); a **form scaffold** box in produce mode (formula + one-line use note — `FORMULAS` 19 entries EN, `FORMULAS_ES` 4 entries ES; uses "infinitive", never "base verb"); `autoFocus` on the produce textarea; and the C1 curated items 3 & 4 rewritten with explicit future anchors so each has one unambiguous answer.

---

## 5. Architecture notes / gotchas

- DB changes via MCP go live immediately; code requires git push + Vercel deploy + PWA hard-refresh.
- The marking system is two layers: client-side deterministic checks first, then server-side AI. Fixing only the API misses client-side short-circuits.
- New Supabase functions/views use `security_invoker`; RLS enabled with an explicit policy at creation (enabled-with-no-policy returns silent nulls).
- `pg` is imported only by the Node script, never by app code, so it has no effect on the Vercel build.
- The components were rewritten wholesale this session; each change was verified by diffing against the pre-edit snapshot (only intended lines changed) and by bundling against the real engine modules (all imports resolve).

---

## 6. On the horizon (unchanged backlog)

- Teacher dashboard overhaul — surface `tense_confusion`; was deferred until real student data accrues.
- Spanish `futuro` tense (fast-follow) and an RPE slot for Tense Tagger.
- Form scaffold wording — cast an eye over `FORMULAS` / `FORMULAS_ES` and reword to taste.
- Spanish GOTD B1/B2 + C1/C2 gaps; ES Word of the Day B1+; flashcard rebuild; Error Correction batch from Q2370; marker tuning session.
- Question bank: next batch starts from **2049** (always re-check `SELECT MAX(question_number)` at session start).
