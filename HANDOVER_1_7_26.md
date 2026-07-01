# Handover — 1 July 2026

## This session: Modal Chooser — designed + first content batch built & live

A new practice exercise, **Modal Chooser**, to reuse the modal-verb work that was stripped out of the Tense Tagger. It's the practice half of a planned pair, mirroring the Tense Explainer → Tense Tagger bridge:

- **Modal Explainer** (a Learn reference, card per modal — *not built yet*) → links to
- **Modal Chooser** (this session): a sentence with a blank where the modal goes; the student assembles a modal from a fixed on-screen palette; each item is tagged with a **function pill** (advice / prohibition / deduction …) shown as a badge.

The reframe that shapes everything: because the pill is shown, the task is **"use the appropriate modal for function X"**, not "intuit the function from a short sentence." The pill *is* the boundary that keeps every accept-set defensible.

**This session delivered the design + the first content batch (39 items, live in `question_bank`).** The frontend component and the Modal Explainer cards are **not built yet** — that's tomorrow.

---

## What shipped

### Database (live)

- **39 rows inserted into `question_bank`, `question_number` 2370–2408**, contiguous, verified (39/39, 0 missing explanation, 0 missing answer, 14 distinct pills). English only.
- New exercise `type` value: **`modal_chooser`**.
- Per row: `topic = 'modals'`, `language = 'en'`, `is_idiomatic = false`, `options = '[]'` (unused — palette is a frontend constant), `hint = NULL` (the pill is the scaffold — decided this session), function pill in **`tags[0]`**.
- `correct_answer` = the primary form; `acceptable_alternatives` (JSONB `[{"answer":…,"feedback":…}]`) carries (a) true synonyms within the same function and (b) register notes. Example: prohibition items have `correct_answer = 'mustn't'` with `can't` in alternatives + feedback "…though *mustn't* is more typical for written rules and notices."

### Schema migration (live — needs local sync)

- Migration **`add_modal_chooser_to_question_bank_type_check`** applied. The `question_bank_type_check` CHECK constraint whitelists allowed `type` values and rejected `modal_chooser` on first insert. Dropped and recreated it with all seven existing types **plus** `modal_chooser`.
- **This is live on the DB but not in your local migration history** — do a `supabase db pull` (or your usual sync) so the constraint change is captured in the repo.
- To reverse the whole session: `DELETE FROM question_bank WHERE type = 'modal_chooser';` (and revert the constraint if desired). Nothing else references these yet.

---

## The taxonomy (14 pills)

Each item keys to exactly one function; the Modal Explainer cards should teach these same names.

| Pill | Core forms |
|---|---|
| ability | can / could |
| permission | can / could / may |
| possibility | may / might / could |
| deduction | must (+ must have) |
| deduction — negative | can't / couldn't (+ can't have) |
| obligation | must / have to |
| prohibition | **mustn't** (primary) / can't *(register note)* |
| absence of obligation | don't have to / needn't |
| advice | should / ought to / might want to / may want to |
| warning | had better / 'd better |
| request | could / can / would |
| offer | shall / can |
| annoying habit (wish) | wouldn't |
| hypothetical wish | could |

Level spread across the 39: A2 ≈ ability/permission/obligation/request basics; B1 ≈ most present functions; B2 ≈ deduction (both), warning, wish frames, hedged advice.

---

## Design decisions & principles (established this session)

- **Accept-set rule (the core one):** *same function → accept all true synonyms* (flag register differences via feedback); *different function → reject, however natural it sounds.* e.g. "You ___ drink and drive" tagged **prohibition** accepts mustn't/can't but **not** shouldn't — shouldn't is advice, a different pill. Accepting cross-function "reasonable" answers would stop the item teaching anything.
- **Deduction frames must earn the pill.** Each deduction/neg-deduction item supplies evidence that points one way ("lights off and the car's gone → they must be away"), so *must* is the only reasonable conclusion and a student trying *might* has no fair grievance. Weak-evidence frames were rejected for this reason (see 2389 note below).
- **Fixed global palette, not per-item tiles.** Same "keyboard" every item; the other modals on the board are automatically fair distractors (no defensibility problem), and discrimination *is* the skill. **Level gates which toggles are live**, not which tiles show.
- **Contraction assembly is a lookup, not string concat** — will→won't, shall→shan't, can→can't. And **`have to` / `needn't` / `had better` / `ought to` are lexical tiles**, kept separate from the perfect **have** toggle (B2+), or you get "must have to" nonsense.
- **`had better` is its own pill ("warning"), taught *with* its consequence meaning** — per James: "an outright threat, English people playing at being polite." Explanations spell out the "…or [bad thing]" implication rather than treating it as strong advice.
- **`deduction — negative` is its own pill** (can't / couldn't, + can't have). Shares the `can't` tile with prohibition but does a different job — this *concludes*, prohibition *forbids*. The explanations lean into that contrast (2383 is the sharpest teaching moment in the batch).
- **Marking is client-side deterministic** against `correct_answer` + `acceptable_alternatives[].answer` (compare the assembled tile string, case-insensitive). **No new Vercel endpoint** — function count stays at 8/12.

### Two edits from James's review (both applied before insert)

- **2389 frame swapped.** Original "Passengers ___ lean out of the window" let `can't` read as *ability* (unable to) rather than prohibition. Replaced with **"Visitors ___ take photographs inside the gallery"** — photographing is obviously possible, so `can't` there can only mean "not permitted." Explanation nudges that distinction.
- **`will` dropped from the request pill.** On 2401/2402, "Will you…?" reads abrupt/commanding (and frustrated with "please"). Request accept-set is now **could / can / would**. **Carry this into the Modal Explainer request card** so card and Chooser agree.

---

## Outstanding / next

1. **Build the frontend (tomorrow's main job).**
   - **Modal Chooser component.** Contract: `type = 'modal_chooser'`; `tags[0]` = function pill (badge); `question` has the `___`; fixed palette = global constant with **level-gated toggles** (A2/B1 base modals; B2+ unlocks the perfect **have** toggle); lexical tiles for have to / needn't / had better / ought to / don't have to; contraction lookup for n't. Marking client-side deterministic vs `correct_answer` + `acceptable_alternatives`. If these ever share a fetch path with topic practice, apply the usual `sequence_group IS NULL` awareness (though as a dedicated type routed to its own component, likely N/A).
   - **Register these as an exercise** (new `exercises` row) once the component exists — not done yet.
   - **Modal Explainer cards** (the Learn half): one card per modal, most important uses incl. negatives (mustn't vs don't have to, needn't vs mustn't). Card function names must match the 14 pills; `watchOut` lines are **teacherly turf** — James drafts/reviews.
2. **`watchOut` review on the Tense Explainer** — still open from 30 June (`tenseExplainEn.js` / `tenseExplainEs.js`). Unchanged this session.
3. **Local migration sync** for the `type` constraint change (see above).

### Parked — Spanish modals (revisit during Tense Explainer expansion)

Decided **not** to build a Spanish Modal Chooser now. Spanish has a thinner true-modal set (poder, deber/deber de, tener que, hay que, saber, soler) and routes most "modal" meaning through the **subjunctive / conditional / future-of-probability** — the wish frames become subjunctive ("ojalá hablaras español"), not a modal slot at all. A Spanish version now would be thin *and* would collide with the subjunctive/conditional/future work already scoped into the Tense Explainer expansion.

Where the real Spanish value sits — a small focused module of error-prone contrasts, to build **after** that scaffolding lands, not beside English v1:
- **deber vs deber de** (obligation vs deduction)
- **tener que vs hay que** (personal vs impersonal obligation)
- **saber vs poder** (know-how vs circumstantial ability)

---

### Standing state (verified this session)

- **`question_bank` MAX(question_number) = 2408** → next content batch starts at **2409**. (This session consumed 2370–2408. The 30 June figure of 2370 is now superseded.)
- **Heads-up on a prior note:** the carried backlog item "Error Correction batch from Q2370 onward" must now start from **2409** — 2370–2408 are taken by Modal Chooser.
- Legacy markers unchanged: 888–907 = A2 Spanish MC; 908–910 = A2 Spanish sentence_auction.
- `question_bank_type_check` now allows: gap_fill, multiple_choice, sentence_building, odd_one_out, error_correction, matching, sentence_auction, **modal_chooser**.
- Vercel serverless functions: still **8/12** (Modal Chooser adds none — client-side marking).

### Carried-forward backlog (from prior handovers)

- Spanish GOTD: B1/B2 and C1/C2 tracks still empty (only A1/A2 exists).
- ES Word of the Day: B1+ tracks still A-level only.
- Flashcard rebuild (long-standing).
- Error Correction batch from **Q2409** onward (leading-word deletions now permitted).
- Marker tuning: two known biases (over-strict on correct concise answers; under-strict on errors outside the target word).
- Monthly content top-up cadence: all surfaces should end on the last day of the month.
