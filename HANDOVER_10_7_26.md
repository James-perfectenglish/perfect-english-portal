# Handover — 10 July 2026

## This session: Teacher sidebar rebuilt into three filter controls + Games/Learn tab bug fixed

All changes are **client-side only** (no DB, no API). Edited in the working tree, **not yet committed** — James is reviewing the diff and pushing everything at once. Desktop left rail only (the teacher sidebar is `display:none` below 768px, as the old cycle button was too — mobile teachers are unchanged).

---

## What changed

### 1. Games / Learn buttons "not always working" — root cause found and fixed
`ExerciseList` initialised its tab once via `useState(defaultTab || 'learn')`. Navigating between `/learn`, `/play`, `/listen` (all render `ExerciseList`) reuses the **same component instance** under `<Routes>` — same type/position — so the `useState` initialiser never re-ran and `activeTab` stayed stale. The existing `location.key` effect reset `activeExercise`/`taggerTense` but **not** `activeTab`. Symptom was intermittent because a full page load picks up `defaultTab` correctly; only in-app navigation between the three showed the stale tab.

**Fix** (`src/ExerciseList.jsx`): folded `setActiveTab(defaultTab || 'learn')` into the `location.key` effect and added `defaultTab` to its deps. In-page sub-tab clicks (Activities/Listen/Speak) don't navigate, so they don't get clobbered.

### 2. Single track-cycle button → three independent controls
Old: one sidebar button cycled `en → spanish → bathroom → hotels → business` via `teacherTrack` + `TRACK_CYCLE`. Replaced with three controls, each persisted to its own `localStorage` key:

- **🇬🇧/🇪🇸 language** — `teachLang` (`pep_teach_lang`). Toggles EN/ES. `pep_teach_lang` is still written, so `TeacherBrowse`'s `globalLang` prop keeps working.
- **🟩/🟦/🟧 level** — `teachLevel` (`pep_teach_level`). Bands A/B/C matching the app's own LevelBadge colours. **Tap to cycle sub-level**: 🟦 → B1 then B2; 🟧 → C1 then C2; 🟩 → A2. Active button shows the current level as a small badge. Defaults to the teacher's own level (C2) until tapped.
- **🛁/🏨/💼 track filters** — `teachTracks` (`pep_teach_tracks`, JSON array). Multi-select, **combinable**, off by default.

### 3. Teacher list filtering — track content kept off the normal lists
New `teacherListVisible(exercise, vocationalFilters, isEs)` in `ExerciseList`, used only when `isTeacher`:
- **No track filter** → general only (plus Spanish-specific when previewing in ES, mirroring a Spanish student).
- **Track filter(s) active** → **track-only**: only exercises whose `tracks` intersect the active vocational set (union when several are on).

Teachers render a **single flat list** (the For You / All split and the ⭐ For You badge are suppressed for teachers — `fy = !isTeacher && isForYouFn(...)`). Header subtitle is now teacher-aware ("Showing Hotels + Business tracks only" / "General content — track buttons add specialised sets" / "General Spanish content").

**Students are completely unaffected** — they still use `shouldShowExercise` / `isForYouFn` and see general + their track with ⭐ For You first.

---

## Files touched
- `src/components/teacherControls.js` — **new**. Shared constants + helpers: `LEVEL_BANDS`, `BAND_ORDER`, `LEVEL_BUTTONS`, `VOCATIONAL_TRACKS`, `bandOf(level)`, `nextLevelForBand(currentLevel, band)`.
- `src/components/TeacherSidebar.jsx` — rebuilt. New props: `teachLang`, `teachLevel`, `teachTracks`, `onToggleLang`, `onSetBand`, `onToggleTrack` (+ existing `onBrowseClick`/`onTeacherClick`/`onPresentMode`). Added a `badge` slot on `SbBtn` and `overflowY:auto` on the rail (it holds more buttons now).
- `src/App.jsx` — replaced `teacherTrack`/`cycleTrack`/`TRACK_CYCLE` with `teachLang`/`teachLevel`/`teachTracks` state + `toggleLang`/`setBand`/`toggleTrack` handlers. `buildEffectiveProfile(profile, {teachLang, teachLevel, teachTracks})` now composes `level` + `tracks` (adds `spanish` when ES). New `overrideActive(...)` → `hasOverride`, which drives the Blurt/WordSnake `profileOverride` (previously `teacherTrack !== 'en'`). `TeacherRoutes` signature updated accordingly.
- `src/ExerciseList.jsx` — tab-sync fix + `teacherListVisible` + teacher single-list rendering + teacher subtitle.

### Orphaned
- `src/components/TeacherToolbar.jsx` — now **dead** (its default component was never rendered; its `TRACK_*` constants are no longer imported anywhere). Left in place to keep the diff tight. Safe to delete whenever.

---

## Verification done this session
- **esbuild** parse-check passed on all four files (`App.jsx`, `ExerciseList.jsx`, `TeacherSidebar.jsx`, `teacherControls.js`). Note: the repo's own `node_modules/.bin/esbuild` is a macOS binary and won't run in a Linux sandbox — validated with a separately-installed Linux esbuild.
- **Filter logic simulated** against the live `exercises` table (title/category/tracks pulled fresh). Confirmed: EN-default = general only; ES-default = general + Spanish-specific; single track = track-only; multiple tracks = combined; catches the two mixed-track rows (`Irregular Verbs Flashcards` = general+spanish, `Listening Exercises` = general+hotels).
- **Level cycling** verified: A2 / B1↔B2 / C1↔C2 wrap correctly; `bandOf(null)` → C.

## Not done / worth an in-app eyeball before/after push
- Only verifiable in the running app (`npm run dev`): the sidebar's new button stack rendering at 768px+, the level badge legibility, and that ES rendering (TenseTaggerES etc.) still triggers off `userTracks.includes('spanish')` in the teacher list.
- **Games under a track/level/language override**: the list-tile routing is covered, but the `/wordle` teacher route still doesn't receive `effectiveProfile` (pre-existing; Connections/SpellingBee/Wordsearch/Crossword already do). Out of scope this session — flag if you want the language toggle to drive teacher Wordle too.
- Mobile teachers still have no track/level/language controls (sidebar is desktop-only). Pre-existing; raise if you want them surfaced on mobile.

---

## Standing state (unchanged this session)
- `question_bank` MAX(question_number) = **2369** last verified (per always-check-live rule, re-`SELECT MAX` before any insert). Note: root `CLAUDE.md` still says 2641 in one place and memory carries 2506/2048 — all stale; trust a live `SELECT MAX` over any stored figure.
- Teacher UUID `bedd04fd-71fe-40ef-a0c1-6390d02ab362` (level C2, `tracks=[]`). María demo student `1cee5fbd-41ce-4a00-aaf0-9c27eda448d0`.
- Vercel serverless functions: 8/12.

### Carried-forward backlog
- Content pass on `tenseExplainEn.js` / `tenseExplainEs.js` watch-outs (first drafts).
- Spanish GOTD B1/B2 + C1/C2; ES WOTD B1+.
- Flashcard rebuild (long-standing).
- Error Correction batch from Q2370 onward.
- Marker tuning (two known biases).
- Monthly content top-up to end of month across daily surfaces.
