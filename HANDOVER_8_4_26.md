# Perfect English Portal — Claude Reference
## Updated: 8 April 2026

## Stack
React + Supabase (dyxmgicedabvmsbuvxny) + Vercel
James uses VSCode, prefers complete file replacements. Deploys via git push → GitHub → Vercel.

## Accounts
- Teacher (James): bedd04fd-71fe-40ef-a0c1-6390d02ab362 (is_teacher = true)
- Demo Student: 1cee5fbd-41ce-4a00-aaf0-9c27eda448d0
  - Name: María Rodríguez, Level: B2, tracks: ['general']
  - 61 answers, 57 correct — good demo history
  - Use this account for all demos and video recording

## Vercel
- Team ID: team_ZUyw0jbbwPRBVGNrDHcLQxym
- Project ID: prj_rdYUdZRnTH6ziNsv43In8LBoaDAD
- Team slug: james-projects-70aa004d

## API Keys in Vercel
- ANTHROPIC_API_KEY — Claude (all AI marking endpoints)
- OPENAI_API_KEY — Whisper (pronunciation transcription only)

---

## MCP TOOLS — ACTIVE

### Filesystem MCP
- Connected to /Users/james on James's Mac
- Use Filesystem:edit_file for surgical changes
- CRITICAL: Never use Filesystem:move_file on any src/ file without explicit permission
- CRITICAL: Filesystem MCP cannot create new files from scratch
- Workaround for new files: write as artifact, James downloads and pastes into VSCode
- James still does git push — Claude cannot push to GitHub

### Supabase MCP
- Claude can run SQL queries directly
- Use Supabase:execute_sql for reads and data updates
- Use Supabase:apply_migration for DDL (schema changes)
- Project ID: dyxmgicedabvmsbuvxny

### Vercel MCP
- Claude can check deployment status and history
- Reconnect if OAuth token expires

### What stays the same
- James runs git push (Claude cannot)
- James approves all DB schema changes
- Large file rewrites: write as artifact, James downloads and pastes

---

## THE MOST IMPORTANT RULE
When James says "do it the same as X", look up the exact code in the existing file and copy it.

## THE SECOND MOST IMPORTANT RULE
When James suggests a solution, implement it immediately. Do not try alternatives first.

## THE THIRD MOST IMPORTANT RULE
Propose before acting. Never run off and make changes without agreement.

## THE FOURTH MOST IMPORTANT RULE
Talk to James before fixing things. When an error appears, describe what you see and ask what he wants before touching any code.

## THE FIFTH MOST IMPORTANT RULE
When creating new files via the move_file + edit_file workaround, the old JS content remains appended after the edit. Use a node one-liner or artifact download instead — it's cleaner and faster.

---

## PWA — COMPLETED 6 April ✅

### What was done
- vite-plugin-pwa configured (autoUpdate, manifest, workbox caching)
- Icons: icon-192x192.png, icon-512x512.png, apple-touch-icon.png (180×180)
- Icon colours: P=#2C3E50 (dark navy), E=#3b96d9 (brand blue), background=white
- Cache strategy: App shell=CacheFirst, Supabase=NetworkFirst 1hr, Audio=CacheFirst 30d

### InstallApp page ✅
- Route: /install (public, no login required)
- File: src/InstallApp.jsx
- Detects device (iOS/Android) and language (ES/EN) automatically
- Flag toggle button to switch language manually

### Login install banner ✅
- Dismissible banner at top of login page, links to /install
- Stored in localStorage (pe_install_banner_dismissed) — shows once only
- Auto-hides if already running as installed PWA

---

## API — Current State (7 functions, Vercel hobby limit = 12)

| File | Handles |
|---|---|
| `mark-gap.js` | type: 'gap_fill' \| 'listening' \| 'dictation' |
| `mark-free.js` | type: 'sentence' \| 'word_order' \| 'correction' |
| `mark-game.js` | type: 'blurt' \| 'word_snake' |
| `mark-pronunciation.js` | pronunciation scoring |
| `transcribe.js` | Whisper (OpenAI key) |
| `approve-student.js` | student approval |
| `notify-new-signup.js` | signup notifications |

Old files archived to `_deprecated_api/`. All frontend callers pass `type` field. 12s AbortController timeout. gap_fill max_tokens: 300.

---

## AI Marking — Philosophy

James's principle: **if a student produces something accurate and grammatically correct, they should not be punished.**

Three tiers:
- ✅ Green — correct, full marks
- 🟡 Amber — valid alternative or near-miss, full marks, note explaining the model answer or issue
- ❌ Red — incorrect

**Context matters:**
- Game/fun context (Wordle, Connections sentence challenge): warm, generous
- Exercise/RPE context: positive but tighter — correct English required for a star
- Level-aware: A1/A2 = 1 sentence max, B1/B2 = 1-2 sentences, C1/C2 = detailed

**Key marking principles:**
- Multiple verbs/answers can be correct — don't over-restrict to the model answer
- Collocations with wrong dependent preposition = amber with explanation
- Typo of the correct answer = amber, not red
- Gender errors only (el/la) in Spanish = amber, not red
- Sentence building: omitting one optional word = amber, not red
- No grammar labels in feedback ever (no SVOC, SVO etc.) — plain English only
- Spanish conjunctions: be generous — "pero" is often as valid as "aunque"
- Parts of speech: many English words function as multiple parts of speech — never penalise correct usage in a different grammatical role from the one presented

---

## Schema

### question_bank
Next batch starts at **1897**.
correct_answer (text) is single source of truth.
language: 'en' (default), 'es', 'both'
- English filter: .in('language', ['en', 'both']).neq('topic', 'spanish')
- Spanish filter: .in('language', ['es', 'both'])
⚠️ student_answers.question_id is int4 (question_number, not uuid)
⚠️ 1896 rows as of 8 April (sentence_auction batch added 1857–1896)

### question_bank tags column
- Type is text[] — NOT jsonb
- Always use ARRAY syntax: ARRAY['Tag One','Tag Two']

### word_of_the_day
- WOTD covered to 30 April 2026 ✅
- level must be slash format: 'A1/A2', 'B1/B2', 'C1/C2'
- 4 rows per day: A1/A2 en · B1/B2 en · C1/C2 en · Spanish (language='es', level='A1/A2')
- id: integer auto-increment — OMIT from INSERT

### connections_puzzles
- UNIQUE constraint is now on (play_date, language) — changed 8 April
  ⚠️ Previously UNIQUE on play_date alone — that constraint was dropped
- English puzzles covered to 30 April 2026 ✅
- Spanish puzzles covered to 30 April 2026 ✅ (added 8 April, 24 daily + 10 practice)
- Spanish practice bank: 17 puzzles total (Mar 15–31)
- Colour ranks: 1=easiest, 4=hardest
- CRITICAL: Never repeat a word across groups — breaks the game

### wordle_words
- English daily words covered to 4 July 2026
- Spanish daily words covered to 25 May 2026

### connections_groups
Columns: id, puzzle_id, category, colour_rank, words (text[])

### student_answers
- input_method column: text, nullable, CHECK IN ('text','voice') — added 3 April

### blurt_categories
- 54 categories total as of 8 April (was 34)
- New English (10): Emotions · Colours · Animals · Excuses for being late 😅 · Things always broken in a hotel 😂 · Things you'd never say to a guest 😱 · Things in a bag or pocket · Words that go with "take" (has "give" penalty) · Compound nouns · Things people secretly do on their phones during meetings 📱
- New Spanish (10): Adjetivos de personalidad · Colores · Animales · Comida española 🥘 · Excusas para llegar tarde 😅 · Cosas que harías con un millón de euros 🤑 · Cosas que no se deben decir en una entrevista 😂 · Expresiones y frases hechas · Palabras que vienen del árabe · Cosas típicas de los turistas en España 😂
- Schema: id (uuid), name, description, tracks (text[]), has_penalty (bool), penalty_category_name, scoring_instructions (NOT NULL), sort_order, created_at

### word_snake_categories
- 43 categories total as of 8 April (was 23)
- New English (10 — chosen for easy/rich vocabulary): Colours · Animals · Emotions · Foods and drinks · Countries · Jobs · Things in a kitchen · Things that make you happy · Compound nouns · Verbs
- New Spanish (10): Colores · Animales · Emociones · Alimentos y bebidas · Partes del cuerpo · Ropa · Adjetivos · Profesiones · Vocabulario del hotel · Países de habla hispana
- Schema: id (uuid), name, description, ai_prompt, tracks (text[]), sort_order

### sentence_auction — new categories added 8 April (1857–1896)
English 10 per band (A1+A2, B1+B2, C1+C2): 4 grammar, 4 vocabulary, 2 fun per band.
Spanish 10 at A2: 4 grammar, 4 vocabulary, 2 fun.
See content notes below for topic details.

---

## Spanish Track

### isSpanish detection pattern (use everywhere)
```js
const isSpanish = (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish'))
               || profile?.level === 'Spanish'
```
⚠️ tracks must be lowercase 'spanish' — never 'Spanish'
⚠️ All Spanish A2 learners (hotel staff) — keep content simple

### Known Spanish track users
- Abbie Knight (abbielknight@gmail.com) — tracks: ['spanish'] ✅ fixed 1 April
- Test/Demo Student (1cee5fbd...) — tracks: ['general'] (reset for demos 6 April)

---

## Sentence Challenge — LIVE EVERYWHERE ✅
- RPE: 2 random positions per round
- TopicPracticeExercise: 1 random mid-session
- MatchingExercise: 1 random set (perfect match only)
- ListeningExercise: once between detail stage and review
- Dictation: on "More Exercises →" after correct answer
- PronunciationExercise: on "Next phrase →" after valid=true
- WordleGame: after game ends
- ConnectionsGame: after puzzle solved

---

## Matching Leniency — LIVE in RPE ✅
- 0 wrong attempts = perfect (star)
- 1–2 wrong = soft pass with note
- 3+ wrong = fail
- Not yet in TeacherBrowse standalone matching (pending)

---

## Teacher Layout

### Architecture
Teachers: fixed left sidebar (desktop) + sticky header + routes.
Students: NavBar (bottom mobile, top desktop) + student routes.

### TeacherSidebar
- position:fixed, height:100vh, width:48px, left:0, top:0
- Hidden on mobile (<768px)
- CSS class teacher-main-content adds margin-left:48px at ≥768px
- Do NOT use flex layout for teacher wrapper div in App.jsx

### buildEffectiveProfile (App.jsx)
- teacherTrack 'spanish' → { ...profile, level: 'Spanish', tracks: ['spanish'] }

### TeacherBrowse WOTD fix (6 April)
- WOTD query now defaults to current month when no date range set
- Prevents 200-row limit cutting off recent entries

---

## Tracks System
'general', 'hotels', 'bathroom', 'spanish', 'business', 'law', 'sports'
- Empty/null userTracks = ['general']
- ALL track values lowercase in DB
- isSpanish: tracks.includes('spanish') || profile?.level === 'Spanish'

---

## Question Bank — Content Rules

### Error Correction — CRITICAL
- Error must be fixable by changing exactly ONE tile
- After writing, verify: can it be solved by changing just one word?

### Sentence Building tiles
- Lowercase at insertion (except I and proper nouns)

### Phrasal verb gap fills
- Blank must contain COMPLETE phrasal verb (verb + particle)

### Topic Practice — Level Rules
- A level: multiple_choice only
- B level: 5 multiple_choice + 5 gap_fill
- C level: gap_fill only

### Sentence Auction — content reference (added 8 April)
**English A band (1857–1866):**
- Grammar: Past simple -ed verbs · Comparative adjectives · Possessives · How much/many
- Vocabulary: Food & drink · Getting around · Numbers/days/months · Describing people
- Fun: Animals (true/false/silly) · The classroom

**English B band (1867–1876):**
- Grammar: Present perfect just/already/yet/ever · Verb patterns suggest/recommend · Phrasal verb word order · Wish/if only
- Vocabulary: Travel & holidays · Make or do · Feelings & emotions · Work & career
- Fun: Holiday disasters · Hotel English — what would a receptionist say?

**English C band (1877–1886):**
- Grammar: The subjunctive · Ellipsis · Nominalisation · Hedging language
- Vocabulary: Formal synonyms · Register · Collocations · Idioms in context
- Fun: Famous quotations · Newspaper headlines

**Spanish A2 (1887–1896):**
- Grammar: Pretérito indefinido · Verbos reflexivos · Presente irregular · Hay que/tener que/deber · ¿Tú o usted?
- Vocabulary: En el hotel · La comida y la bebida · La ropa y los colores · De compras
- Fun: Los falsos amigos · ¿Tú o usted? (counted as grammar AND fun — covers both angles)

---

## UI Conventions
- Level badges: <LevelBadge level={x} /> from './components/BadgePill'
- Purple gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
- Page layout: outer #f8f9fa → maxWidth 800px → gradient header → white content card
- flexShrink:0 on label spans in feedback boxes — prevents overlap with long answers
- Auto-scroll: never add to any exercise
- RPE finished screen grid: repeat(3, minmax(0, 1fr)) — prevents iPhone overflow

---

## Gotchas
- Supabase SQL: apostrophes → '', level values individual ('B1' not 'B1/B2')
- student_answers.question_id is int4 (question_number)
- word_of_the_day.id: integer auto-increment — OMIT from INSERT
- question_bank.tags: text[] — use ARRAY['tag1','tag2']
- dictation_exercises.acceptable_alternatives: text[] — use ARRAY['alt1','alt2']
- Both TeacherBrowse AND RPE must pass excerptType + acceptable_alternatives to mark-gap (type:'dictation')
- EC questions: error must be fixable by ONE tile only
- Connections puzzles: NEVER repeat a word across groups
- connections_puzzles UNIQUE is now (play_date, language) — not play_date alone
- TeacherToolbar.jsx: do NOT delete
- git pull --rebase on Mondays after Sunday backup
- All API calls use consolidated endpoints with type field
- Spanish tracks: ALWAYS store as lowercase 'spanish'
- Filesystem MCP cannot create new files — use artifact download instead
- Browser caching: hard refresh (Cmd+Shift+R) when testing JS changes
- blurt_categories.scoring_instructions is NOT NULL — always include it on INSERT
- _deprecated_api/ now only contains: mark-correction.js (has InstallApp content prepended — ignore), mark-listening-gap.js

---

## Content Status (as of 8 April 2026)
- WOTD: covered to 30 April ✅
- Connections English: covered to 30 April ✅
- Connections Spanish: covered to 30 April ✅ (daily) + 17 practice puzzles
- Wordle English: to 4 July 2026
- Wordle Spanish: to 25 May 2026
- Sentence auction: 1897 is next question number
- Blurt: 54 categories (34 en, 20 es)
- Word Snake: 43 categories (23 en, 20 es)

---

## Business / Commercial

### GET21 meeting — Friday (11 April)
- GET21 (get21.es) — Mallorca HR/training consultancy, 200+ hotel clients
- Proposal: act as sales agents on commission
- Model: B2B SaaS, per-user monthly subscription
- Price point: €8–10/user/month, minimum ~15–20 users per company
- Commission: 20% ongoing for life of each contract
- Key demo features: Real Talk, Wordle/Connections, install page

### Legal/tax (Spain) — not yet actioned
- Need gestor familiar with digital businesses
- Add SaaS IAE epígrafe
- IVA 21% on B2B SaaS
- GDPR/AEPD registration + DPA template required before taking money

### Native app decision
- Decided against native app — PWA is sufficient
- Reasons: no App Store 30% cut, fast deploy cycle, B2B IT policy friendly

---

## Videos (in progress)
- Using Screen Studio (one-month subscription)
- Recording setup: Chrome DevTools device mode → iPhone 15 Pro
- Demo account: María Rodríguez (test student, B2, general)
- Videos planned: Wordle, Connections, Real Talk, Pronunciation, onboarding/install

---

## Priority List (as of 8 April 2026)

### ✅ Completed today (8 April)
- Spanish Connections: fixed UNIQUE constraint (play_date, language) replacing (play_date) only
- Spanish Connections: 24 daily puzzles added Apr 7–30 (A2 level, hotel/hospitality themes)
- Spanish Connections: 10 practice puzzles added (Mar 22–31)
- Sentence auction: 40 new categories (10 per English band A/B/C + 10 Spanish A2)
- Blurt: 20 new categories (10 EN + 10 ES)
- Word Snake: 20 new categories (10 EN + 10 ES — chosen for easy/rich vocabulary)

### ✅ Completed 6 April
- PWA implementation (vite-plugin-pwa, icons, manifest)
- InstallApp page (/install) — bilingual, device-detecting
- Login install banner — one-time dismissible
- TeacherBrowse WOTD date default fix
- Demo account renamed to María Rodríguez, B2, general track
- WOTD and Connections English extended to end of April

### 🔴 Before Friday GET21 meeting
1. Record demo videos (Wordle, Connections, Real Talk, Pronunciation)
2. One-pager / leave-behind for GET21 (pricing, commission, what it does)
3. Practice live demo flow on the app

### 🎯 Next build sessions
- Stars rollout to all exercises
- Sentence challenge: speak/type toggle + input_method logging
- Matching leniency in TeacherBrowse standalone
- Marketing website refresh (perfect-english.org)

### 🔧 Needs investigation
- Quick dictation playback speed in RPE (A/B/C level adjustment not working)
- Bottom nav occasional two-tap glitch

### 🎮 Games
- Survival Mode permanent leaderboard (survival_scores table)

### 🔴 New Real Talk scenarios
- Hotel: late checkout, noise complaint, lost property, bill dispute
- Borrás: difficult return, product complaint, demanding discount
- Business: delivering bad news, handling missed deadline
