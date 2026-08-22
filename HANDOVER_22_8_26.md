# Handover — 22 August 2026

**Session type:** strategic review, then a Spanish levelling fix and the GOTD / PVOTD build that
came out of it. Mixed DB and code. **Everything is pushed, deployed and verified in-app** (§7).

---

## 0. Corrections to carried state

Three things in the 21 August handover were already wrong by the time this session opened.

- **`question_bank` MAX was 3113, not 3050.** There was a *third* session on 21 August (matching /
  error correction / sentence building, rows 3050–3113) that never made it into the handover file,
  because it was DB-only and wrote no handover. The numbering rule held; the documentation did not.
- **"Nothing is committed"** — it had been. Vercel shows the Wordle validation work deployed on
  21 August under *"Wordle guess validation, duplicate-letter fix, scaled stars, shared help sheet"*.
- **It is 14 daily streams that cliff on 30 September, not 6.** Crossword (en A/B/C + es A) and
  wordsearch (en/es) are stocked to the same date.

**Lesson: a DB-only session still needs a handover line.** Two of the three drifts above are the
same failure — work happened, nothing recorded it.

---

## 1. Strategic review — and the reframe that came out of it

Every handover since June measures output. None measured uptake. It was measured this session:

| Month | Events | Distinct students |
|---|---|---|
| Mar | 10,587 | 27 |
| Apr | 4,174 | 23 |
| May | 3,555 | 21 |
| Jun | 4,220 | 15 |
| Jul | 2,578 | 12 |
| Aug | 2,175 | 9 |

Of August's nine, two are James and the María demo account. **Seven real students.** Belinda alone
is 1,018 of 2,175 (47%); the top three are 82%. Sixteen students with 50+ lifetime events have not
returned in 30 days. Last registration of any kind: **14 July**. 24 of 62 accounts signed in once,
within two days of registering, and never came back.

### James's reframe — important context for any future session

The initial read ("demand is the constraint, stop making content") was **wrong**, and was withdrawn.
The app's **primary user is James, in classes**. It is materials preparation, a teaching USP, and
added value for his students. That alone justifies it, and it means:

- **Content generation continues.** Regular users deserve new material and James needs it for class.
- **Churn is mostly not product failure.** It decomposes into seasonal pauses (August, and the
  wind-down before it), students who prefer other homework (UofE tests, writing), students with low
  tech confidence, and students who simply do not do out-of-class work — the last group being served
  by using the app *as class material* instead.
- **Signups will not be pushed.** James's position: if someone has seen it in class and not signed
  up, that is a clear answer. Pushing would only manufacture more of the sign-up-once-never-return
  pattern, which the 24/62 figure already shows is real.
- **GET21 will not be chased.** Hotels are in survival mode in August and are not thinking about
  training. Plan: a short no-ask touch in mid-September, press properly in late October.
- **Website + LinkedIn** is James's own work for the coming quiet week; the video assets from 2 August
  are ready.

### Still open from the review (Claude's queue, agreed)

1. Retention panel — built as a **teaching** tool, not a growth dashboard: *what they got wrong*
   (clustered by topic/type, per student and per group) first, class-prep view second, *who's
   slipping* third.
2. `HelpSheet` "how am I marked?" on Sentence Building, Dictation, RPE, Sentence Challenge.
3. **Marker regression fixtures** — `tests/marker-fixtures.json` + a Node script POSTing to the
   deployed endpoint. Must run **both directions** every time (the 11 July see-saw lesson). Seed it
   from real `student_answers` free text, ~40 cases, adjudicated by James in one sitting.
4. EN Spelling Bee thresholds (see §5 — needs a recount first).
5. October **and November** content in one pass.

---

## 2. `profiles.spanish_level` — new column

Migration **`add_profiles_spanish_level`**. `text NOT NULL DEFAULT 'A1/A2'`, CHECK constrained to
`A1/A2` / `B1/B2` / `C1/C2`, with a column comment.

**Why it was needed.** All four Spanish students (Abbie, Tony, Karl, Robyn) have
`profiles.level = 'Spanish'` — a *track marker*, not a CEFR band. There was nothing for the
of-the-day components to filter on, which is exactly why `GrammarOfTheDay` hard-coded A1/A2 for
Spanish. That was correct at the time, not sloppy.

`level = 'Spanish'` is deliberately left alone so `isSpanish` detection and the red ES badge keep
working. `App.jsx` loads the profile with `select('*')`, so the new column reaches every component
with no further change.

**No teacher UI yet.** Set by SQL for now. A picker in the student panel is a small job.

---

## 3. Bugs found and fixed

### 3a. Word of the Day — a live bug, three weeks old

`WordOfTheDay.jsx` line 61 fetched the Spanish word by date and language with **no level filter**,
then `.limit(1).single()`. Until 1 August only ES A1/A2 existed, so this was always right. Once the
B1/B2 and C1/C2 tracks were revived, all three levels existed for every date and it returned an
**arbitrary one**. Spanish students had been getting a randomly-levelled word every day since
1 August. Nothing looked broken, which is why it was never reported.

Fixed: filters on `spanish_level`, with a deterministic fallback to A1/A2.

### 3b. Grammar of the Day — the A1/A2 pin

Line 44 was `const level = isSpanish ? 'A1/A2' : bucket`. Now reads `spanish_level`. This is what
made the 40 new ES B1+/C1+ rows reachable.

### 3c. Phrasal Verb of the Day — English only

Hard-wired `.eq('language','en')` plus the title in three places. Now fully bilingual (§4).

### 3d. `api/mark-free.js` — the `isPvotd` prompt is English-only

Found before wiring up the Spanish side. The prompt tells the student to write an **English**
sentence and judges it on **separability**, which does not exist in Spanish. A new
`isPvotd && isSpanish` branch was added **before** the English one, which is byte-identical to
before. It marks on the two things that matter — is the expression used with the right meaning, and
is its governed preposition or fixed form respected — accepts any correct inflection, explicitly
forbids applying English phrasal-verb rules, and returns **feedback in English**, following the
precedent already set in the ES tense-tagger branch.

### 3e. Word of the Day headers

Spotted from a screenshot: **WORD OF THE DAY** in English sitting directly above **GRAMÁTICA DEL
DÍA** in Spanish. WOTD switched only its Sentence Challenge header; the card itself was hard-coded
at lines 176 and 206. Now switches like GOTD does.

### 3f. The dashboard gate — the one that actually blocked it

`StudentDashboard.jsx` line 122 read `{!isSpanish && <PhrasalVerbOfTheDay ... />}`. The card was
never mounted for Spanish students at all. That gate was **correct** while the component was
English-only, and became the sole blocker the moment it stopped being so.

Found only after James reported the card still missing post-deploy and reasonably assumed caching.
**Claude had verified `App.jsx` carried `spanish_level` through, then declared the feature done
without checking the call site that decides whether the component renders at all.** Same class of
error as the Queen Bee one in §5: verifying the part being worked on and asserting the rest.

Removing the gate is safe — the component sets `noItem` and returns `null` on an empty pool, so it
self-hides. `isSpanish` is still used eight times in that file, so nothing is left dangling.

---

## 4. Content added

### Grammar of the Day — 120 new rows, 20 converted

| | before | after |
|---|---|---|
| EN A1/A2 · B1/B2 · C1/C2 | 20 each | **40 each** |
| ES A1/A2 | 20 | **40** |
| ES B1/B2 | 0 | **20** |
| ES C1/C2 | 0 | **20** |

**200 rows total.** Rotation stretches from 20 days to 40 (ES B1+/C1+ are on 20 for now — say the
word to take them to 40 and make all six bands match).

**ES scaffolding convention settled and applied retroactively:** `grammar_point`, `structure` and
`example` in Spanish; **`usage` and `common_mistake` in English**. The 20 legacy ES A1/A2 rows were
converted in the same pass, so the Spanish stream is internally consistent rather than split old
from new. Rationale: these students are English speakers, and the explanation is the part that
should not need decoding. Section *labels* stay Spanish (Uso, Ejemplo, ⚠️ Error común) — Spanish
chrome, Spanish target language, English explanation.

Categories reuse the existing vocabulary with four additions: `question`, `conjunction`, `time`,
`number`.

### Phrasal Verb of the Day / Expresión del día — 145 new rows + repairs

| | before | after |
|---|---|---|
| EN A1/A2 | 40 | **60** |
| EN B1/B2 | 60 | **80** |
| EN C1/C2 | 45 | **60** |
| ES A1/A2 · B1/B2 · C1/C2 | 0 | **30 each** |

**290 rows total.** Also repaired: **16 A1/A2 rows had no `note`** (the level that needs scaffolding
most was the one without it), and **`category` was NULL on all 145 existing rows**.

`category` now does two jobs: **topical grouping** on the English side (invisible to students, for
James's browsing — `daily routine`, `home`, `technology`, `travel`, `work`, `problem solving`,
`relationships`, `communication`, `analysis`, `change`, `money`, and so on), and the **visible family
label** on the Spanish side.

**Spanish naming: *Expresión del día*.** Spanish has no phrasal verbs, so forcing the label would
teach a category that does not exist. The card carries three families, named per day in `category`:

| ES level | verbo con preposición | perífrasis verbal | expresión idiomática |
|---|---|---|---|
| A1/A2 | 14 | 12 | 4 |
| B1/B2 | 10 | 10 | 10 |
| C1/C2 | 6 | 9 | 15 |

Weighted deliberately: prepositions are a genuine A2 problem (*soñar con*, *acordarse de*), idioms
belong at B1+. A-level content clusters the traps English speakers actually hit, and teaches the
*empezar **a*** / *dejar **de*** contrast side by side so the arbitrariness is visible rather than
merely annoying. On the ES side the separable/inseparable badge is replaced by the family;
`separable` is `false` throughout and carries no meaning.

---

## 5. Spelling Bee — Queen Bee, and a data bug

**Claude asserted that Queen Bee had never been awarded and that `queen_bee_alerts` had never fired.
Both were wrong.** The second was worse: it was inferred from a code comment and never queried.

Carolina has reached Queen Bee **twice** — 12 May (121 words, 492 pts) and **20 August (150 words,
723 pts)**. Both alerts logged correctly. The 20 August one sat with `seen_by_teacher = false` until
James opened it during this session.

**The data bug:** `rank_label` can never contain `'Queen Bee'`. `saveProgress` writes
`RANKS[newRankIdx].label`, and `RANKS` tops out at Genius — `'Queen Bee'` exists only as a
render-time label in the component. So both of Carolina's Queen Bees are stored as `Genius`.
**Anything teacher-facing that reads `rank_label` under-reports the best achievement the app can
produce.** Fix: write the true display label, and backfill the two rows. Not yet done.

**Threshold work is deferred.** Tiers key on **word count**, not points: Genius = 50 words,
Queen Bee = 100. The distortion is real (on the handover's figures, Genius is 43% of an average
English day and 8% of a Spanish one), but the "nobody ever reaches it" premise is dead. The proposal
on the table is `min(fixed, pct × available)` — Genius `min(50, 45%)`, Queen Bee `min(100, 75%)` —
which keeps normal days unchanged, makes thin days winnable, and leaves ES untouched. James wants
Queen Bee attainable but south of 100%, which this delivers.

**Before building it:** recompute the actual valid-word count for every September EN day against
`word_lists`. Carolina found 150 words on 20 August, which sits oddly against the claim that EN days
average 117, so that figure needs re-verifying. Requires storing `word_count` / `max_score` per
puzzle at generation time — numbers only, no answers leaked.

**Also noted:** the Queen Bee alert is a row that must be clicked. James did not know that. Two
Queen Bees in six months is the rarest event in the app and should be a self-clearing banner.

---

## 6. Gotchas learned

- **`Filesystem:write_file` exists and creates new files.** The long-carried note that the Filesystem
  MCP cannot create files from scratch is **stale** — the `move_file`-from-`_deprecated_api`
  workaround is no longer needed, and `_deprecated_api/` (2 files left) does not need cannibalising.
- **Display labels and stored labels drift.** Querying `rank_label` for `'Queen Bee'` returns nothing
  because the DB never stores it. When a component computes a label at render time, the DB column is
  not a reliable place to query for it.
- **`profiles.level = 'Spanish'` is a track marker, not a CEFR band.** Anything that needs a Spanish
  student's level must read `spanish_level`.
- **ES WOTD B1/B2 and C1/C2 only cover 1 Aug – 30 Sept** (66 rows each). Outside that window a B1+
  student silently falls back to the A1/A2 word. **These two bands must be in the October batch** or
  the fallback becomes permanent.
- `phrasal_verb_of_the_day.id` and `grammar_of_the_day.id` are identity / sequence columns — omit
  from inserts.
- `"usage"` is worth quoting as a column name.

---

## 7. Deploy state

**Pushed and live** (James, during the session): `src/WordOfTheDay.jsx`, `src/GrammarOfTheDay.jsx`,
`src/PhrasalVerbOfTheDay.jsx`, `src/StudentDashboard.jsx`, `api/mark-free.js`. All esbuild-clean,
all diffs dry-run and byte-confirmed after applying.

**Verified in-app on the demo account:**

- WOTD served *conseguir* at B1/B2 — not the A1/A2 or C1/C2 word available for the same date.
- GOTD served *Pronombres dobles* from the ES B1/B2 pool that did not exist that morning.
- *Expresión del día* rendered with the ES badge, the `es-ES` date chip, and the Spanish Sentence
  Challenge header and prompt.
- **The ES marker branch fired correctly on its first real use.** Submitted
  *"...consiste **de** entrenar todos los días..."*; it rejected on the governed preposition, named
  the correct form, replied in English, and did **not** penalise the conjugated `consiste` against
  the infinitive headword — rules 1, 2 and 4 all behaving.

**Still worth one canary:** an English PVOTD submission. That prompt is byte-identical to before, so
any change in its behaviour is a regression.

**Watch, do not fix yet:** the ES marker's model answer silently corrected more than the error it
rejected on — it supplied a missing subject and dropped a stray `y` alongside the preposition fix.
Defensible as a model sentence, but it means the student sees a suggestion differing in three ways
from what they wrote. If it recurs, add a line telling it to change only what it rejected.

**All content is DB-only and live.**

---

## 8. ⚠️ María Rodríguez is currently a Spanish-track account

Changed for testing this session:

```
tracks:        ['general','business'] → ['general','business','spanish']
spanish_level: 'A1/A2' → 'B1/B2'
level:         B2 (unchanged)
```

`level` was deliberately not touched, so `bucket` is preserved and she remains usable as an English
demo account — but she is **not** a perfect mirror of a real Spanish student, who has
`level = 'Spanish'`. Irrelevant to the of-the-day components (`bucket` is never read in the Spanish
branch), but it may show up in ES Tense Explainer or matching routing.

To restore her:

```sql
UPDATE profiles SET tracks = ARRAY['general','business']::text[], spanish_level = 'A1/A2'
WHERE id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
```

---

## 9. Standing open decisions

1. **October + November content** — all 14 streams end 30 September. Must include ES WOTD B1/B2 and
   C1/C2 (see §6). Target: ~22 September.
2. **Spelling Bee thresholds** — pending the September word-count recount (§5).
3. **`rank_label` Queen Bee fix** + backfill of the two existing rows.
4. **Teacher UI for `spanish_level`.**
5. **ES GOTD B1/B2 and C1/C2 at 20 rows** vs 40 everywhere else — top up?
6. **ES `part_of_speech` cleanup** — legacy A1/A2 WOTD rows still mixed `sustantivo` / `noun`.
   Carried since 23 July.
7. **ES Connections 15 Sept** — off-brief ("En la peluquería"); swap or leave.
8. **Queen Bee alert as a banner** rather than a clickable row.
9. **Audit for sibling `!isSpanish` gates.** §3f was one of a class: guards written while a component
   was English-only, now obsolete and silently suppressing Spanish features. `ExerciseList.jsx` is
   the likeliest place to look next, since its EN/ES routing was extended rather than designed
   bilingual. Cheap to check, and the failure mode is invisible — nothing errors, the feature simply
   never appears.

---

## 10. Verified live state (queried this session)

| Metric | Value |
|---|---|
| `question_bank` MAX(question_number) | **3113** (3113 rows, no gaps) |
| `grammar_of_the_day` | **200** rows — EN 40/40/40, ES 40/20/20 |
| `phrasal_verb_of_the_day` | **290** rows — EN 60/80/60, ES 30/30/30 |
| Rows with NULL `category` or `note` | **0** in both tables |
| All 14 daily streams | last date **2026-09-30** |
| Profiles | 62 · Spanish-track 4 (+ María, temporarily) |
| Vercel serverless functions | 8/12 (unchanged — no new API routes) |
| New column | `profiles.spanish_level` |
| New migration | `add_profiles_spanish_level` |

Always re-`SELECT MAX(question_number)` before inserting. It has drifted in every recent session.
