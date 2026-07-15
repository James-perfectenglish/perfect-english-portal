# HANDOVER — 15 July 2026 (Matching expansion session)

## Session summary
Full freshen-up and expansion of the Matching exercise: image pipeline built, all
assets migrated/created, sound-matching programme redesigned and quadrupled, 31 new
questions + 2 rewrites live. Question bank now ends at **2672**.

## Code changes (in repo, NOT yet committed — James to push)
- **NEW `scripts/matching-images/matching_images.py`** — image pipeline: any source
  image → trimmed, squared, 256px transparent WebP (~5–15 KB). Flags: `--input DIR`,
  `--strip-bg` (rembg background removal), `--upload`, `--dry`, `--normalise-existing`.
  Auth: reads `SUPABASE_SERVICE_ROLE_KEY` from env. **Key format matters**: new
  `sb_secret_...` keys go in the `apikey` header ONLY (Authorization: Bearer makes
  Supabase parse them as JWT → "Invalid Compact JWS"). `auth_headers()` handles both
  key generations.
- **NEW `scripts/matching-images/fetch_openmoji.py`** — fetches the 27 approved
  OpenMoji icons by hexcode, processes through the same pipeline, uploads.
- **`src/components/MatchingPairs.jsx`** — image tiles `objectFit: 'cover'` →
  `'contain'` (no more cropping of transparent-background objects). esbuild-validated.
- `scripts/matching-images/out/` contains processed WebPs (gitignore candidate or
  leave; harmless).

## Environment changes (James's Mac)
- `.env.local` gained `SUPABASE_SERVICE_ROLE_KEY` (new sb_secret format).
- `pip3 install rembg onnxruntime --break-system-packages --user` (Homebrew Pillow
  conflict → `--user` flag required). U2-Net model cached at `~/.u2net/u2net.onnx`.

## Storage changes (bucket `audio`, folder `matching/`)
- 27 OpenMoji WebPs (travel / hotel room / restaurant vocab).
- 15 normalised WebPs replacing the old heavy PNGs (0.3–2.7 MB → ~10 KB each).
- 18 ChatGPT-generated B2B WebPs (housekeeping / hotel realia), backgrounds stripped
  via rembg.
- 37 new ElevenLabs MP3s (b_v 8, sh_ch 9, ed_endings 12, heteronyms_2 8).
  Production note: "van" needed **Eleven Turbo v2** (English-only model) — Multilingual
  v2 reads it as Dutch. Heteronym stress via cmu-arpabet phoneme tags (only work on
  Turbo v2 / Flash v2 / English v1).
- **The 15 old `matching/*.png` files are now unreferenced and can be deleted from
  the dashboard** (verified: 0 questions point at .png).

## DB changes (question_bank)
- **7 existing image questions** (731, 1897–1899, 1927–1929): URLs switched .png → .webp.
- **933/934 rewritten** (short_long_i): now forced-discrimination rounds — both members
  of each minimal pair on the board (ship/sheep/bit/beat; sit/seat/fill/feel). 931/932
  unchanged as warm-ups.
- **2642** — short_long_i capstone (order 5): audio → meaning, both pair-members present.
  Note: uses existing `Live - verb.mp3` (there is no plain live.mp3).
- **2643–2646** `b_v` (A2) · **2647–2650** `sh_ch` (A2→B1) · **2651–2653** `ed_endings`
  (B1, includes audio↔audio rounds) · **2654–2657** `heteronyms_2` (C1).
  All topic `pronunciation`, `correct_answer='match_all_pairs'`, tags `{Pronunciation}`.
- **2658–2666** — 9 OpenMoji image questions (A1, vocabulary): travel, hotel room,
  restaurant sets.
- **2667–2672** — 6 generated-image B2B questions (A2, vocabulary): housekeeping,
  hotel realia sets.
- **Verified: 0 broken asset references** across all 146 matching questions (SQL
  cross-check of every options URL against storage.objects).

## Design decisions locked this session
- **Per-set image style purity**: OpenMoji for general/travel sets; generated images
  (one locked ChatGPT prompt + --strip-bg) for B2B/realia sets. Never mixed in a set.
- **Sound-set architecture**: warm-up (one pair-member each) → forced discrimination
  (both members on board) → meaning/sentence capstone. The discrimination round is
  the point — James's insight that the old sets never made students choose ship vs sheep.
- General : B2B content ratio maintained at ≥ 1:1 (9 general + 6 B2B image questions).

## Pending / next session
1. **James: push** (scripts + MatchingPairs.jsx + this handover).
2. **James: delete the 15 old .png files** from Storage dashboard (safe now).
3. **OpenMoji attribution**: add "Icons by OpenMoji (CC BY-SA 4.0)" line somewhere
   discreet (app footer / about). Small but licence-required.
4. In-class spot-check of the new sets; trusted-student feedback on b_v difficulty.
5. Carried forward: 2370 EC batch, helper→auxiliary verb sweep, ES GOTD B1+ gaps,
   flashcard rebuild, Spanish Modal Explainer, monthly crossword/wordsearch top-ups
   (daily streams stocked to 31 July).

Last question number: **2672**. Always verify live before inserting.
