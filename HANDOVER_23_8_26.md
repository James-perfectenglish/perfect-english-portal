# Handover — 23 August 2026

**Session type:** website only. The public marketing site (`perfect-english.org`) was rebuilt from
scratch to showcase the app. **No portal code and no database were touched this session.** Nothing
in the 22 August handover was verified or advanced; §9 of that document carries forward intact.

---

## 1. What was done

The old landing page — untouched since 6 February, written before the app existed, six resource
cards all reading *"Coming soon"* — was replaced with a page built around live app footage.

**Live and pushed.** James sent the URL to a handful of people for feedback the same afternoon.

### Positioning

Per the 22 August reframe: this is **not** a SaaS signup page. It sells James's teaching, with the
app as the USP, and gives businesses a clearly signposted door. Primary CTA throughout is
*Get in touch*; *Open the app* is secondary, for students who already have accounts.

### Structure (single scroll)

| Section | Content | Clips |
|---|---|---|
| Hero | Headline, subline, two CTAs, four credibility chips | 1 |
| **Daily games** | Wordle, Spelling Bee, Connections, Crossword | 4 |
| **Daily learning** | WOTD, GOTD, PVOTD | 3 |
| Practice | Fix It, Tense Tagger, Real Talk, Listening | 4 |
| Built around you | Level / industry / language — text only | 0 |
| For businesses | Teacher dashboard + progress, three selling points | 2 |
| Testimonials | Pedro and José, carried over verbatim | 0 |
| CTA + footer | | 0 |

**Games and learning are deliberately separate sections.** James's correction mid-session: WOTD,
GOTD and PVOTD are *learning*, not games, and grouping them under "six daily games" misrepresented
the app. Games now runs four cards (Wordsearch is name-checked in the body text, since no clip of it
exists); learning runs three on a tinted band.

**PVOTD appears on the public site for the first time.** It was absent from the first draft entirely.

---

## 2. Design tokens — taken from the app, not invented

Extracted from `StudentDashboard.jsx` (note: `src/App.css` is still the untouched Vite stub and
carries nothing useful):

```
--grad:   linear-gradient(135deg, #3498DB, #667eea)   /* the signature */
--ink:    #2c3e50    --muted: #718096    --soft: #a0aec0
--line:   #e8e8f0    --bg:    #f7f8fc
--green:  #43b581 → #2ecc71     --orange: #ed8936 → #f6ad55
radii:    14px (buttons/cards), 20px (large surfaces)
font:     system-ui stack, weights 600/700/800
```

The site and the app now share one visual language, so the clips sit inside the page rather than
on top of it. **Any future restyling of either should update both.**

One flourish: the word *smart* in the hero headline renders as five green Wordle tiles that flip in
on load (`.tiles` in the stylesheet, ~20 lines, self-contained — delete freely if it ever grates).
Respects `prefers-reduced-motion`.

---

## 3. Video pipeline

**Screen Studio is gone.** James no longer subscribes and does not want to re-record or re-export
anything. The `.screenstudio` projects are kept only in case of a future resubscription. **All video
work now starts from the exported `.mp4`s in `~/Desktop/Screen grabs/`** (48 files).

### The chain

```
~/Desktop/Screen grabs/*.mp4        source exports (Screen Studio, 4-3 composited + variants)
        ↓  LosslessCut  (I / O / E, keyframe-snapped, no re-encode, instant)
~/Desktop/picks/*.mp4               14 trimmed masters + 14 .llc project files  (135 MB)
        ↓  ./prep-web-videos.sh ~/Desktop/picks
~/perfect-english/assets/video/     14 web clips   (2.87 MB total)
~/perfect-english/assets/posters/   14 poster JPGs (final-frame grabs)
```

`prep-web-videos.sh` lives in the site repo root. It strips audio (`-an`, which also guarantees iOS
autoplay), caps width at 960px, 30fps, H.264 crf 26, `+faststart`, slugifies filenames
(`Spelling Bee.mp4` → `spelling-bee.mp4`), grabs a poster from 0.2s before the end, and warns on any
output over 4 MB. **Nothing tripped the warning.**

### Compression result

Largest is `progress.mp4` at 685 KB; smallest `connections.mp4` at **47 KB**. Flat gradient
backgrounds compress extraordinarily well. The entire page's video payload is **2.87 MB** — less
than one phone photo, which is why no CDN, no external video host and no Vercel functions were
needed. **The Vercel serverless count is untouched at 8/12.**

### Embedding

Every clip is `muted loop playsinline preload="none"` with a poster, inside a fixed-aspect
`.vslot` (4:3 for phone footage, 16:9 for the dashboard, 9:16 for progress). An IntersectionObserver
plays clips at 35% visibility and pauses them off-screen; it no-ops under `prefers-reduced-motion`.
Only the hero uses `preload="metadata"`.

**Desktop and mobile share the same files** — the difference is layout, not assets. Under 860px the
card grids become horizontal scroll-snap rows; under 760px the nav collapses to logo + button.
Verified by James on resize.

---

## 4. Copy corrections — Claude got two wrong

Both from reading the wrong source and inferring rather than checking.

- **Fix It.** Drafted as *"every sentence hides one mistake, find it and fix it"* — that is **Error
  Correction**, a different exercise. Fix It serves a student **their own logged mistakes** back to
  them. Now reads: *"Built from your mistakes. The app remembers what you got wrong and serves it
  back — a personalised chance to put things right."* This is the strongest personalisation claim on
  the page and no competitor can make it.
- **Real Talk.** Drafted as free-text answers with AI feedback. It is the **branching scenario**
  exercise (`scenario_nodes`, choice-driven). Corrected from the component's own strings.

**Lesson, and the same one as §3f in the 22 August handover:** the component whose name matches the
feature is not necessarily the component that implements it. Read the source before writing copy
about behaviour.

James's own wording changes: *Custom-made realistic audio* for Listening; *Built by an experienced
working teacher* / *purpose-built* in the business section. Hyphens added to both compounds.

---

## 5. Repo and hosting

**`perfect-english` is a second, separate repo** — `github.com/James-perfectenglish/perfect-english`,
now cloned to `~/perfect-english`. Static HTML on **GitHub Pages** (CNAME → perfect-english.org).
No build step, no framework. A push is a deploy, live in a minute or two.

Do not confuse it with `~/perfect-english-portal` (the app, Vercel). **Handovers continue to live in
the portal repo root only.**

Files added this session: `index.html` (rewritten), `prep-web-videos.sh`, `PICK_LIST.md`
(scaffolding — the 14-clip trimming brief; delete whenever), `assets/video/`, `assets/posters/`.

Untouched: `CNAME`, `contact/`, `privacy/`, `favicon.png`, `og-image.png`, and the four legacy
`/examples` demo pages. **The examples are superseded by the app and were dropped from the nav but
not deleted or redirected** — an open decision.

### Local copies

Everything is already local and duplicated — **nothing lives only on GitHub**:

| What | Where | In git? |
|---|---|---|
| Source exports (48) | `~/Desktop/Screen grabs/` | no |
| Trimmed masters + `.llc` (14+14) | `~/Desktop/picks/` | no |
| Web clips + posters (28) | `~/perfect-english/assets/` | **yes** |
| The site itself | `~/perfect-english/` | **yes** |

A `git clone` is a full local copy, so the repo exists in two places already. The two Desktop folders
are the only single-copy items, and `~/Desktop/picks` is the one worth protecting — the `.llc`
project files make re-trimming any clip a ten-second job, and re-running `prep-web-videos.sh` over
that folder regenerates every web asset in a couple of minutes. **Neither Desktop folder should be
committed** (135 MB and rising); if they ever need to be, use a separate archive, not this repo.

---

## 6. Open items from this session

1. **Verify the live page is actually serving.** A fetch of `perfect-english.org` mid-session
   returned the **old** February page. Almost certainly stale CDN cache between the fetcher and
   GitHub Pages rather than a failed deploy — the local file is correct and James confirmed it live
   — but it was **not** independently confirmed from a cold client. Worth one check on mobile data
   or a private window, especially as the link has been shared.
2. **Error Correction and Pronunciation clips exist and are unused.** `RPE 4-3.mp4` was even trimmed
   into `~/Desktop/picks` and then not needed. Practice could go to a six-card grid; offered and not
   taken up this session.
3. **No Wordsearch clip exists** anywhere in Screen grabs. Handled in copy for now.
4. **Spanish version of the business section** — for the GET21 push in late October, not for launch.
5. **`/examples`** — retire, redirect into the app, or leave.
6. **Feedback pending** from the people James sent the link to.

---

## 7. Carried forward, untouched

Everything in §9 of the 22 August handover stands. Nothing was verified or advanced today. In
particular, still outstanding and **date-critical**:

- **October + November content — all 14 daily streams end 2026-09-30.** Target ~22 September. Must
  include ES WOTD B1/B2 and C1/C2, which only cover 1 Aug – 30 Sept and silently fall back to A1/A2
  outside that window.
- **GET21** — light no-ask touch mid-September, proper push late October. **The website now exists to
  point them at**, which was the main thing missing.
- `src/WordleGame.jsx` (`??` → `||` star-restore fix) was listed as *awaiting push* on 22 August.
  **Not verified this session** — check before assuming it is live.
- Spelling Bee thresholds (pending the September word-count recount), `rank_label` Queen Bee fix +
  backfill, teacher UI for `spanish_level`, the `!isSpanish` sibling-gate audit, and the PWA update
  lag.

**Before any insert: re-`SELECT MAX(question_number)` live.** It was 3113 at the close of
22 August and has drifted in every recent session.
