# HANDOVER — 5 Jul 2026

**Session: Modal Match advanced build-out · SC/overlay unification across Modal Match + both Tense Taggers**

---

## 1. Database (live — no deploy needed)

- **38 new `modal_chooser` questions, 2409–2446.** Bank now 77 questions, 2370–2446, zero gaps: beginner 12 / intermediate 42 / advanced 23 (verified live post-insert). The advanced band (C1/C2) went from empty to 23; beginner finally fills a full 10-round.
- **Five new function pills** with questions: `regret & criticism`, `hypothetical past`, `refusal`, `past habit`, `concession`. First questions for the previously orphaned `expectation` and `suggestion` pills.
- **Q2400 repaired**: "not" absorbed into the blank; answer now `had better not`; alternatives cleared (frame previously worked around the unbuildable form).
- **Q2398**: legacy `'d better` alternative removed (tiles can never build it; would have shown as a phantom "Equally correct" chip).
- **Next batch starts from 2447** — but as always, verify `SELECT MAX(question_number) FROM question_bank` live first.

## 2. ModalChooser.jsx

- **Lexical toggle fix**: `LEX_NEG` (had better → *had better not*), `LEX_HAVE` (*needn't have*, *ought to have*). `have to` / `don't have to` stay toggle-proof ("must have to" guard intact). *Oughtn't to have* deliberately not constructible.
- **7 new `PILL_STYLES`** (5 new pills + expectation + suggestion, colours mirrored in modalExplainEn) and **5 new `FUNCTION_PHRASE`** entries for the SC produce prompt.
- **Green-only marking**: amber "soft" state removed — any accepted form gets the same green "✅ Correct!" and the same point. New **"Equally correct: …"** line lists every other accepted form on every answer (and the alternatives on wrong answers). When a student builds an alternative, `feedback.answer` is now *their* form, so the SC produce loop and 📖 card follow what they actually built.
- **Markdown renderer** (`renderMd`): `**bold**` / `*italic*` in explanations and register notes now render properly in the feedback box (James's screenshot caught the literal asterisks).
- **Per-band tile greying**: live-tile set computed from the FULL band data pre-slice (`tileForAnswer` reverse-maps n't/have/lexical forms back to tiles). Active at beginner + intermediate only; advanced shows all. Ghost tiles: 0.35 opacity, disabled, tooltip "Not used at this level". Per-band, never per-question — greying can't telegraph answers.
- **Balanced palette rows**: `can could may might must` / `shall should will would` (fixed, no more lonely *would*).
- Advanced band description updated; the "· soon" label cleared itself (it was count-driven).
- **📖 See the full card** button post-answer → `ExplainerOverlay` + `ModalCard` with the question's function pill use-row highlighted. `cardIdForAnswer` maps any answer (incl. perfect/negative/lexical forms) to its Explainer card.

## 3. modalExplainEn.js

- 5 new `FUNCTION_STYLES`; ~26 new use rows across existing cards (no new cards): *must have* deduction; past possibility on might/may/could; regret & criticism + past expectation (*should have*) on should; *ought to have*; past habit / refusal / hypothetical past on would; refusal (*won't*) + stressed *will* on will; concession on may + might; contractual *shall*; *needn't have*; plus the six the mapping check flagged (can/offer, *may not*/prohibition, might/concession, might have/hypothetical past, ought to/expectation, *Should we…?*/suggestion).
- `needn't` card contrast extended: *needn't have done* vs *didn't have to do*.
- **Verified by node script: every (answer, tag) pair live in the bank maps to a card AND a highlightable use row.**
- ⚠️ **All new glosses/examples are first drafts pending James's content review** — same status as the 38 question texts.

## 4. New shared components

- `src/components/ModalCard.jsx` — extracted from ModalExplainer. Props: `card`, `open`, `onToggle` (optional — static gradient header when absent, for overlays), `highlightFn`, `onPractise` (optional — button only renders when provided).
- `src/components/ExplainerOverlay.jsx` — generic scrim + centred panel (✕ / tap-scrim to close). Used by Modal Match and both Taggers.
- `src/components/TenseCard.jsx` — EN tense card + `TenseTimeline` + signal-word helpers extracted from TenseExplainer. Caller stitches `_studentLevel` in.
- `src/components/TenseCardES.jsx` — ES equivalent (`ESTimeline`, `esLevelFor`, tiempo-keyed bank query).

## 5. ModalExplainer.jsx

- Loads **fully collapsed** (`openGroup` starts null).
- Top-level practise button removed; per-card **"✏️ Practise in Modal Match →"** at the card foot behind a separator (Tense Explainer pattern), via ModalCard's `onPractise`. Absent in the Modal Match overlay.

## 6. SentenceChallenge.jsx

- New **`apiType`** prop (default `'sentence'`), used as `type` in the mark-free body. Backwards compatible; enables `type:'tense'` marking through SC. That's the only change.

## 7. TenseTagger.jsx (EN)

- **Produce phase = shared SC sheet** (✏️ Type / 🎙️ Speak). `apiType="tense"`, `apiExtraFields` carries tenseName / isMismatch / functionTime / note / level (exactly what `handleTense` reads). `promptText` carries the formula (regular items) or the 💡 mismatch note.
- **`noStars`** — the Tagger keeps ownership of the star row (`source 'tense_tagger', subtype 'production'`, tense in context) and the sc_sentences harvest. **Both writes now record the student's REAL `input_method`** (was hardcoded `'text'`) — Jon's voice sentences will show as voice.
- **Structural fallback removed** (`productionResult` import dropped): AI outage now = nothing persisted, student retries (SC's app-wide convention).
- Close semantics: pass → `done` star screen; fail-and-close / backdrop → `reset()` (old Skip).
- **📖 See the full card** in the green "Tagged correctly" banner AND the wrong-tag block (guarded by `findTense(item.answer)`); overlay renders TenseCard with `_studentLevel` stitched. Practise button intentionally absent in the overlay.
- `checking` state removed; done card unchanged (its "structure" branch is dead code, harmless).

## 8. TenseTaggerES.jsx

- Same pass. `language="es"` means **Whisper transcribes in Spanish** — voice production of conjugations is arguably the headline win.
- Card lookup via `findByTiempo(item.tense)`; overlay renders `TenseCardES`.
- ⚠️ **Behavioural change**: the old **soft-pass on AI outage** (star auto-awarded because Spanish endings can't be regexed safely) is **gone** — replaced by SC's retry-on-outage, nothing persisted. The original rationale (unsafe regex fallback verdict) no longer applies since there is no fallback verdict at all. Done card's "AI unavailable — star awarded" pill is dead code.

## 9. TenseExplainer.jsx / TenseExplainerES.jsx

- Slimmed to import the shared cards; moved helpers (supabase import, PG, shuffle, esc, withSignals, timelines) removed with them. Rendering unchanged.

## Validation

- All 9 touched JSX files + modalExplainEn.js esbuild-validated on container; no orphaned references (`checking` / `checkProduction` / `productionResult` / `softPass` all gone); pill-style coverage check and answer→card mapping check both pass with zero gaps.

## Files changed this session (for the push)

`src/ModalChooser.jsx` · `src/lib/modalExplainEn.js` · `src/components/ModalCard.jsx` (new) · `src/components/ExplainerOverlay.jsx` (new) · `src/components/ModalExplainer.jsx` · `src/components/SentenceChallenge.jsx` · `src/components/TenseCard.jsx` (new) · `src/components/TenseExplainer.jsx` · `src/components/TenseTagger.jsx` · `src/components/TenseCardES.jsx` (new) · `src/components/TenseExplainerES.jsx` · `src/components/TenseTaggerES.jsx`

DB changes are already live; code goes live on push → Vercel deploy → PWA hard-refresh.

## Testing checklist

- **Modal Match**: advanced band live (no "· soon"); beginner deals full 10-rounds; alternative answers (e.g. *ought to* for *should*) mark green with "Equally correct"; markdown renders in feedback; ghost tiles at beginner/intermediate with tooltip; two balanced rows; toggles light correctly on needn't/ought to (+ have) and had better (+ n't); 📖 overlay opens the right card with the right use highlighted; Q2400 accepts *had better not*.
- **Tense Tagger EN + ES**: SC sheet appears on produce, voice input works (Spanish transcription on ES); star + harvest rows carry the real input_method; 📖 in both spots; Skip semantics via sheet-close.
- **Modal Explainer**: loads collapsed; practise button per-card at the foot.
- **Content review (James)**: 38 question texts (2409–2446) + all new Explainer use rows/glosses/examples + the extended needn't contrast.

## Horizon deltas

- **Spanish Modal Explainer** still doesn't exist ("yet" — James, 4 Jul). When built, it drops straight into the ModalCard/ExplainerOverlay pattern, and Modal Match ES content would follow the same pill conventions.
- Everything else on the horizon unchanged from HANDOVER_30_6_26.
