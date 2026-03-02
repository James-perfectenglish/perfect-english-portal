# Perfect English Portal — Handover Document
## Date: 2 March 2026

---

## Project Overview
- **Live app**: https://app.perfect-english.org/
- **GitHub**: https://github.com/James-perfectenglish/perfect-english-portal
- **Supabase project**: dyxmgicedabvmsbuvxny
- **Deployment**: Vercel (auto-deploys from GitHub main branch)
- **Dev workflow**: James edits in VSCode, commits to GitHub, Vercel deploys

---

## ⚠️ UNRESOLVED ISSUE: Duplicate correct_answer columns

Both `question_bank` and `listening_questions` have TWO answer columns:
- `correct_answer` — text (singular)
- `correct_answers` — jsonb (plural)

This causes null results when the app reads from the wrong column. The goal is to consolidate to ONE column that can hold single or multiple answers. This has NOT been fixed yet. When addressing this, decide which column wins and migrate all data before dropping the other.

---

## Database Schema (public schema, key tables)

### auction_scores
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| student_id | uuid | YES |
| initials | text | NO |
| student_level | text | NO |
| auction_tier | text | NO |
| final_budget | integer | NO |
| auctions_completed | integer | NO (default 0) |
| created_at | timestamptz | YES |

### exercise_opens
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| student_id | uuid | NO |
| exercise_title | text | NO |
| opened_at | timestamptz | YES |

### exercises
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| created_at | timestamptz | NO |
| title | text | YES |
| description | text | YES |
| type | text | YES |
| level | text | YES |
| topic | text | YES |
| content | jsonb | YES |
| passing_score | integer | YES |
| question_pool_size | integer | YES |
| questions_per_attempt | integer | YES |
| recommended_order | integer | YES |
| prerequisite_id | uuid | YES |
| tracks | ARRAY | YES (default {general}) |
| category | text | YES (default 'practice') |

### flashcard_sessions
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| student_id | uuid | YES |
| set_name | text | NO |
| round_name | text | YES |
| cards_seen | integer | YES (default 0) |
| known_count | integer | YES (default 0) |
| learning_count | integer | YES (default 0) |
| completed_at | timestamptz | YES |

### flashcard_sets
| column | type | nullable |
|--------|------|----------|
| id | integer | NO |
| title | text | NO |
| description | text | YES |
| level | text | YES |
| card_data | jsonb | NO |
| created_at | timestamp | YES |

### listening_exercises
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| title | text | NO |
| description | text | YES |
| intro_text | text | YES |
| level | text | NO |
| topic | text | YES (default 'Listening') |
| audio_url | text | NO |
| image_url | text | YES |
| transcript | text | YES |
| duration_seconds | integer | YES |
| created_at | timestamptz | YES |
| tracks | ARRAY | YES (default {general}) |

### listening_questions ⚠️ HAS DUPLICATE ANSWER COLUMNS
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| listening_exercise_id | uuid | NO |
| question_number | integer | NO |
| stage | text | NO (default 'detail') |
| type | text | NO |
| question | text | NO |
| options | jsonb | YES |
| correct_answer | text | YES | ← TEXT, singular
| correct_answers | jsonb | YES | ← JSONB, plural — DUPLICATE, unresolved
| explanation | text | YES |
| created_at | timestamptz | YES |

### listening_sessions
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| student_id | uuid | YES |
| exercise_id | uuid | YES |
| stage_reached | text | NO |
| gist_correct | integer | YES (default 0) |
| gist_total | integer | YES (default 0) |
| detail_correct | integer | YES (default 0) |
| detail_total | integer | YES (default 0) |
| completed_at | timestamptz | YES |

### memory_sessions
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| student_id | uuid | YES |
| game_name | text | NO |
| round_name | text | YES |
| moves | integer | NO |
| completed_at | timestamptz | YES |

### profiles
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| created_at | timestamptz | NO |
| email | text | YES |
| full_name | text | YES |
| approved | boolean | YES (default false) |
| updated_at | timestamp | YES |
| level | text | YES |
| tracks | ARRAY | YES (default {}) |
| is_teacher | boolean | YES (default false) |

### question_bank ⚠️ HAS DUPLICATE ANSWER COLUMNS
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| question_number | integer | YES |
| type | text | NO |
| level | text | NO |
| topic | text | NO |
| question | text | YES |
| correct_answers | jsonb | YES | ← JSONB, plural
| correct_answer | text | YES | ← TEXT, singular — DUPLICATE, unresolved
| options | jsonb | YES |
| informal_accepted | jsonb | YES |
| informal_feedback | text | YES |
| acceptable_alternatives | jsonb | YES |

### word_of_the_day
| column | type | nullable |
|--------|------|----------|
| id | uuid | NO |
| date | date | — |
| level | text | — | ← MUST use slash format: 'A1/A2', 'B1/B2', 'C1/C2'
| language | text | — | ← 'en' or 'es'
| word | text | — |
| part_of_speech | text | — |
| definition | text | — |
| example_sentence | text | — |

### word_of_the_day_submissions
(RLS enabled — check policies if submissions stop saving)

---

## File Structure
```
src/
├── App.jsx                    — Main router + header nav + teacher route guard
├── ExerciseList.jsx           — Exercise listing (tabs, grid/list, For You, NEW badges)
├── PhrasalVerbs.jsx           — Business Phrasal Verbs exercise
├── OfficeVocabulary.jsx       — Office Vocabulary exercise
├── Prepositions.jsx           — Prepositions Practice (NEEDS REBUILD — no tracking)
├── SpanishVocabulary.jsx      — Spanish Vocabulary exercise
├── SentenceBuilding.jsx       — Sentence Building exercise (drag & drop)
├── OddOneOut.jsx              — Odd One Out exercise
├── ErrorCorrection.jsx        — Error Correction exercise
├── ListeningExercise.jsx      — Listening (3-stage: gist/detail/review) + tracking + ✅ done
├── FlashcardTemplate.jsx      — Unified flashcard component
├── MemoryGame.jsx             — Unified memory game + tracking
├── WordOfTheDay.jsx           — Word of the Day widget
├── StudentDashboard.jsx       — Student progress dashboard
├── TeacherDashboard.jsx       — Teacher dashboard (public/private modes)
├── Admin.jsx                  — Admin panel
├── Login.jsx / Signup.jsx     — Auth + Cloudflare Turnstile
├── supabaseClient.js          — DB connection
├── data/
│   ├── BorrasCards.js         — 39 cards, 7 rounds
│   └── HotelCards.js          — 40 cards, 7 rounds
└── components/
    ├── PracticePage.jsx           — Test Yourself landing
    ├── RandomPracticeExercise.jsx — Random question engine
    └── SentenceBuildingInput.jsx  — Shared drag & drop
```

---

## Authentication & Security

**Signup flow:** Turnstile → email confirm → James sets profiles.approved = true → student logs in
**Turnstile site key:** 0x4AAAAAAChUFyqzDKDJIHBT

**RLS Policies:**
- Students: read/insert own data only
- Teachers: read all student data, CANNOT insert into tracking tables
- Teacher identified by `profiles.is_teacher = true`
- Teacher UUID: `bedd04fd-71fe-40ef-a0c1-6390d02ab362`

---

## Header Nav

Three links: **Home · Test · Exercises**
- "Test" routes to `/practice`; page heading reads "Test Yourself"

---

## Teacher Button

Purple gradient square (42×42px). Visible when `is_teacher = true`. Present in three places:
- Exercises page — next to List/Grid toggle
- Home (StudentDashboard) — top-right of greeting row
- Test page (PracticePage) — next to "Test Yourself" heading

`App.jsx` passes `isTeacher` and `onTeacherClick` to PracticePage via `PracticePageWrapper`.

---

## Exercise List UI

**Tabs** (exercises.category field):
- **Learn** — Flashcards, vocabulary, sentence building
- **Practice** — Gap fill, MC, odd one out, error correction, matching, prepositions
- **Listen** — Listening Exercises
- **Play** — Memory games, sentence auction

**NEW badge** — gradient outline, white fill, gradient text (purple theme, never green):
- Non-listening: exercise_opens table, clears after first open
- Listening: shows NEW if any listening has no session record. Does NOT clear on tab click

**✅ Done indicators** — listening cards show ✅ if any listening_sessions record exists for that student

---

## Word of the Day

- `level` MUST use slash format: `'A1/A2'`, `'B1/B2'`, `'C1/C2'`
- `language`: `'en'` or `'es'` — six rows per day (3 levels × 2 languages)

**Fallback chain:**
1. Today + correct level + correct language
2. Today + correct level + any language
3. Today + any level
4. Random question bank vocab (last resort — no submission saved)

**word_of_the_day RLS** — policy must exist or widget falls back silently to vocab pick:
```sql
CREATE POLICY "Students can read word_of_the_day"
ON word_of_the_day FOR SELECT TO authenticated USING (true);
```

---

## Tracks System
```
general:  shown to everyone, no For You badge
business: topicFilter 'business', For You badge
hotels:   topicFilter 'hotels', For You badge
bathroom: topicFilter 'borras', For You badge
spanish:  topicFilter 'spanish', For You badge
law:      For You badge (no content yet)
sports:   For You badge (no content yet)
exam:     designed, no content yet
```

**Current assignments (47 students):**
hotels: 19 | business: 28 | sports: 18 | bathroom: 8 | law: 6 | spanish: 1 (Tony Williams)
Everyone also gets `general`.

**exercises.tracks:**
- `general` — all
- `{bathroom, spanish}` — Borrás Flashcards, Borrás Memory Game
- `{hotels}` — Hotel Flashcards, Hotel Memory Game
- `{general, business}` — Business Phrasal Verbs, Office Vocabulary
- `{general, spanish}` — Irregular Verbs Flashcards
- `{spanish}` — Spanish Vocabulary
- `{general, hotels}` — Listening Exercises

**listening_exercises.tracks:**
- Some Friends of Mine → `{general}`
- Problems at Work → `{general, business}`

---

## Listening Exercise System

- Three stages: Gist → Detail → Review (transcript + replay)
- Audio: Eleven Labs 128kbps MP3, Supabase Storage
- Speed: Slower (0.9x) / Normal (1.0x) / Faster (1.1x)
- Characters: Dave, Marco, Katie
- File naming: `Katie1.mp3`, `Katie1.png`
- Track filtering: `applyTrackFilter()` uses `.overlaps('tracks', userTracks)`

---

## Random Practice
```js
const QUESTION_MIX = {
  gap_fill: 3, multiple_choice: 6, sentence_building: 3,
  odd_one_out: 3, error_correction: 3, matching: 2  // Total: 20
}
```
Fisher-Yates shuffle, background DB save. Complete screen: This Attempt / Best / Average

---

## Teacher Dashboard

- Route: `/teacher`
- Public mode (screen-share safe) / Private mode (CSV export)
- `lastActive` = most recent of: `student_answers.answered_at`, `listening_sessions.completed_at`, `student_attempts.completed_at`

---

## Student Dashboard

- Route: `/` when logged in
- `daysStudied` = distinct calendar days from `student_attempts.completed_at` + `student_answers.answered_at`

---

## Drag & Drop (SentenceBuildingInput.jsx)

Multi-line fix (28 Feb): `calcDropIndex()` checks Y first (identifies row), then X within that row. Fixes wrong insertions when answer zone wraps to multiple lines on mobile.

---

## Views (all security_invoker = true ✅)

- student_answers_with_names
- student_attempts_with_names
- listening_sessions_with_names
- flashcard_sessions_with_names
- memory_sessions_with_names
- student_soft_pass_stats
- word_of_the_day_teacher_view

**Rule for new objects:**
- New table → `ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;`
- New view → `ALTER VIEW your_view SET (security_invoker = true);`

---

## Known Issues / Pending Work

### High Priority
1. **Duplicate answer columns** — both `question_bank` and `listening_questions` have `correct_answer` (text) AND `correct_answers` (jsonb). Goal: consolidate to one column. Not yet fixed.
2. **Prepositions exercise** — no tracking to student_answers, needs full rebuild
3. **Track filtering in PracticePage** — `?track=` URL param not yet wired up

### Content
4. More listening exercises (highest engagement)
5. More question bank content (hotels, business)
6. **Next question bank batch starts at ID 888**

### Future
7. Teacher data cleanup — UUID `bedd04fd...` accumulates test data
8. Student Tracks page
9. Survival Mode — SurvivalMode.jsx exists, deployment status unknown
10. Flashcard/memory/listening stats on dashboards

---

## Key Technical Notes

- `question_bank.correct_answers` = jsonb array (plural) — but see duplicate column issue above
- New questions start at ID 888
- Always use count queries for student_answers — Supabase silently caps row fetches at 1,000
- Mobile-first — many students on phones
- Firefox CSS grid: use `box-shadow: inset` not `border` for grid tiles
- Use "infinitive" not "base-verb" in grammar explanations
- James works in VSCode; prefers complete file replacements not patches
- Hidden newlines in DB fields have caused deployment bugs
- Views need `security_invoker = true` | Tables need `ENABLE ROW LEVEL SECURITY`
- Cloudflare console warnings are harmless
- `word_of_the_day.level` must use slash format (`B1/B2` not `B1`)

---

## Accounts

- **Test Student** — UUID: `1cee5fbd-41ce-4a00-aaf0-9c27eda448d0`
- **Teacher (James)** — UUID: `bedd04fd-71fe-40ef-a0c1-6390d02ab362`
```sql
-- Clean up test student data:
DELETE FROM student_answers    WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
DELETE FROM student_attempts   WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
DELETE FROM listening_sessions WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
DELETE FROM exercise_opens     WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
DELETE FROM flashcard_sessions WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
DELETE FROM memory_sessions    WHERE student_id = '1cee5fbd-41ce-4a00-aaf0-9c27eda448d0';
```