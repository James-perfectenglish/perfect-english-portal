#!/usr/bin/env python3
"""
generate_daily_audio.py: ElevenLabs audio for Word of the Day and Phrasal Verb of the Day.

Same idea as the Word Bluff generator (scripts/bluff/generate_bluff_audio.py), whose
ElevenLabs and Storage helpers it reuses. For every row missing audio it makes:
  - the word / phrasal verb on its own  -> audio_word_url
  - the example sentence                -> audio_example_url
uploads the MP3s to the public `audio` bucket (wotd/... and pvotd/...), and writes the
URLs back. Each row is committed as soon as its audio is up, so an interrupted run
carries on from where it stopped next time.

Which rows
  word_of_the_day          rows dated today onwards (use --from / --to to change)
  phrasal_verb_of_the_day  every active row (it is a rotating pool, so one run covers it)
  --lang en is the default; Spanish only runs with --lang es or --lang both.

Voices (column `voice`, filled in by this script when empty)
  en: alice / daniel, alternating by day and level, as in Word Bluff
  es: es_f / es_m, the two Castilian voices in ES_VOICES below
  Change a voice ID here and re-run with --force to redo those rows.

Models
  en word      -> eleven_flash_v2 (English-only, so false friends are never read as Spanish)
  es word      -> eleven_flash_v2_5 with language_code "es" (so "red", "pie", "once" stay Spanish)
  sentences    -> eleven_multilingual_v2

Heteronym check
  A word that can be said two ways in isolation (record, lead, upset, wind down...) is
  flagged: audio_check_pending = true. Its word clip is hidden from students (the
  example sentence still plays) and a copy is saved to --check-dir to listen to.
  Spanish entries with "+ infinitivo" style patterns are flagged too.
    --review                       list flagged rows with their clip URLs
    --table wotd --approve 12,15   publish those word clips
    --table wotd --ids 12 --force --commit   regenerate a bad one (stays flagged)

Usage (from the repo root; the wrapper loads .env.local):
  sh scripts/audio/run-daily-audio.sh                        # dry run: rows, voices, flags, characters
  sh scripts/audio/run-daily-audio.sh --commit --limit 3 --save-local ~/Desktop/daily-audio-test
  sh scripts/audio/run-daily-audio.sh --commit               # everything still missing audio (English)
  sh scripts/audio/run-daily-audio.sh --lang es --commit     # Spanish, once the voices are chosen
  sh scripts/audio/run-daily-audio.sh --table wotd --from 2026-12-01 --to 2026-12-31 --commit

Env (.env.local): ELEVENLABS_API_KEY, SUPABASE_DB, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (optional)
"""

import argparse
import os
import re
import sys
import time
import unicodedata
import urllib.request
import json
from datetime import date

import psycopg2

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bluff"))
from generate_bluff_audio import (  # noqa: E402
    ELEVEN_API_BASE,
    OUTPUT_FORMAT,
    PROJECT_URL_DEFAULT,
    SPEED_DEFAULT,
    VOICE_SETTINGS,
    VOICES as EN_VOICES,
    _send,
    env,
    public_url,
    require,
    upload,
)

# Castilian (peninsular) voices from the ElevenLabs Voice Library. Candidates chosen
# 27 Oct 2026: "Carolina" (natural, neutral, clear) and "Alex" (neutral, clear, calm).
# Audition them in ElevenLabs first; swap an ID here if you prefer another voice.
ES_VOICES = {
    "es_f": "UOIqAnmS11Reiei1Ytkc",  # Carolina
    "es_m": "7ilYbYb99yBZGMUUKSaf",  # Alex
}

VOICES = {**EN_VOICES, **ES_VOICES}
VOICE_PAIRS = {"en": ("alice", "daniel"), "es": ("es_f", "es_m")}

MODELS = {
    ("en", "word"): "eleven_flash_v2",
    ("es", "word"): "eleven_flash_v2_5",
    ("en", "example"): "eleven_multilingual_v2",
    ("es", "example"): "eleven_multilingual_v2",
}
# Models that accept language_code (forcing the language of very short texts).
LANG_CODE_MODELS = {"eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v3"}
# Approximate credits per character, for the dry-run estimate only.
CREDIT_RATE = {"eleven_flash_v2": 0.5, "eleven_flash_v2_5": 0.5, "eleven_multilingual_v2": 1.0}

LEVEL_INDEX = {"A1/A2": 0, "B1/B2": 1, "C1/C2": 2}
EPOCH = date(2026, 1, 1)

# Words that can be pronounced two ways on their own (different vowel or stress).
# Matched against every word of the entry, so "wind down" and "live up to" are caught.
HETERONYMS = set("""
abuse address advocate affect aged alternate animate appropriate approximate articulate
associate attribute axes bass bases blessed bow bows buffet close closes combat compact
compound conduct conflict console content contest contract contrast converse convert
convict coordinate crooked decrease defect delegate deliberate desert digest discount
does dogged dove duplicate elaborate entrance escort estimate excuse export extract
frequent graduate house import incense incline increase insert insult intern intimate
invalid invite lead leads learned legitimate live lives minute moderate moped number
object perfect permit polish present produce progress project protest putting read
rebel recall record records refund refuse reject research resume row rows separate
sewer sow subject subordinate survey suspect tear tears torment transfer transport
upset use used wicked wind winds wound
""".split())

MARKER = re.compile(r"\[\[(.+?)\]\]")
SPANISH_PLACEHOLDER = re.compile(r"\s*\+\s*")


# -----------------------------------------------------------------------------
# Text
# -----------------------------------------------------------------------------

def finish(text):
    t = text.strip()
    return t if t.endswith((".", "!", "?", "…")) else t + "."


def spoken_example(sentence):
    t = MARKER.sub(r"\1", sentence or "").strip()
    return t.strip('"“”').strip()


def spanish_forms(word):
    """'lóbrego/a' -> 'lóbrego, lóbrega'; 'profesor/a' -> 'profesor, profesora'."""
    w = word.strip()
    if "/" not in w:
        return w
    base, _, suffix = w.partition("/")
    suffix = suffix.strip()
    if suffix == "a":
        if base.endswith("o"):
            fem = base[:-1] + "a"
        elif base.endswith(("és", "ón", "ín", "án")):
            fem = base[:-2] + strip_accents(base[-2]) + base[-1] + "a"
        else:
            fem = base + "a"
        return f"{base}, {fem}"
    return w.replace("/", ", ")


def spoken_word(word, language):
    w = word.strip()
    if language == "es":
        w = spanish_forms(w)
        # "estar + gerundio" is said "estar más gerundio" in class.
        w = SPANISH_PLACEHOLDER.sub(" más ", w)
    return finish(w)


def needs_check(word, language):
    if language == "es":
        return "+" in word
    tokens = re.findall(r"[a-z]+", word.lower())
    return any(t in HETERONYMS for t in tokens)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", strip_accents(text).lower()).strip("-") or "x"


# -----------------------------------------------------------------------------
# Tables
# -----------------------------------------------------------------------------

WOTD_SELECT = """
select id, date, level, language, word, example_sentence, voice
from public.word_of_the_day
where (%(force)s or audio_word_url is null or audio_example_url is null)
  and language = any(%(langs)s)
  and (%(date_from)s::date is null or date >= %(date_from)s::date)
  and (%(date_to)s::date   is null or date <= %(date_to)s::date)
  and (%(ids)s::int[]      is null or id = any(%(ids)s::int[]))
order by date, language, level
"""

# pos = position in the pool the app picks from (active rows, same language and level,
# ordered by id), so neighbouring days alternate voices.
PVOTD_SELECT = """
with pool as (
  select p.*, (row_number() over (partition by language, level order by id) - 1)::int as pos
  from public.phrasal_verb_of_the_day p
  where p.active
)
select id, pos, level, language, phrasal_verb, example, voice
from pool
where (%(force)s or audio_word_url is null or audio_example_url is null)
  and language = any(%(langs)s)
  and (%(ids)s::int[] is null or id = any(%(ids)s::int[]))
order by language, level, id
"""

TABLES = {"wotd": "word_of_the_day", "pvotd": "phrasal_verb_of_the_day"}

UPDATE_SQL = """
update public.{table}
set voice = %s, audio_word_url = %s, audio_example_url = %s, audio_check_pending = %s
where id = %s
"""


class Item:
    """One row to voice, whichever table it came from."""

    def __init__(self, table, row_id, language, level, word, example, voice, rotation, folder, stem):
        self.table = table
        self.id = row_id
        self.language = language
        self.level = level
        self.word = word
        self.example = example
        self.rotation = rotation
        self.folder = folder
        self.stem = stem
        self.voice = voice or self.default_voice()
        self.check = needs_check(word, language)

    def default_voice(self):
        pair = VOICE_PAIRS[self.language]
        return pair[(self.rotation + LEVEL_INDEX.get(self.level, 0)) % 2]

    def clips(self):
        """(kind, text, model) for the word and the example."""
        return [
            ("word", spoken_word(self.word, self.language), MODELS[(self.language, "word")]),
            ("example", finish(spoken_example(self.example)), MODELS[(self.language, "example")]),
        ]

    def path(self, kind):
        return f"{self.folder}/{self.stem}-{kind}.mp3"

    def label(self):
        flag = "  ⚑ check" if self.check else ""
        return f"{self.table} #{self.id}  {self.language} {self.level}  {self.word}  [{self.voice}]{flag}"


def fetch_items(conn, args):
    langs = ["en", "es"] if args.lang == "both" else [args.lang]
    items = []
    with conn.cursor() as cur:
        if args.table in ("wotd", "both"):
            cur.execute(WOTD_SELECT, {
                "force": args.force, "langs": langs, "ids": args.ids,
                "date_from": args.date_from, "date_to": args.date_to,
            })
            for row_id, d, level, language, word, example, voice in cur.fetchall():
                items.append(Item(
                    "wotd", row_id, language, level, word, example, voice,
                    rotation=(d - EPOCH).days,
                    folder=f"wotd/{d.isoformat()}",
                    stem=f"{language}-{slug(level)}-{row_id}-{slug(word)}",
                ))
        if args.table in ("pvotd", "both"):
            cur.execute(PVOTD_SELECT, {"force": args.force, "langs": langs, "ids": args.ids})
            for row_id, pos, level, language, pv, example, voice in cur.fetchall():
                items.append(Item(
                    "pvotd", row_id, language, level, pv, example, voice,
                    rotation=pos,
                    folder=f"pvotd/{language}-{slug(level)}",
                    stem=f"{row_id}-{slug(pv)}",
                ))
    if args.limit:
        items = items[: args.limit]
    return items


# -----------------------------------------------------------------------------
# ElevenLabs
# -----------------------------------------------------------------------------

def tts(api_key, voice_id, text, model, speed, language):
    url = f"{ELEVEN_API_BASE}/v1/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
    body = {
        "text": text,
        "model_id": model,
        "voice_settings": {**VOICE_SETTINGS, "speed": speed},
    }
    if model in LANG_CODE_MODELS:
        body["language_code"] = language
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={"xi-api-key": api_key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
    )
    audio = _send(req, f"ElevenLabs ({model})")
    if not audio or len(audio) < 1000:
        raise RuntimeError(f"ElevenLabs returned suspiciously little audio ({len(audio or b'')} bytes) for: {text!r}")
    return audio


# -----------------------------------------------------------------------------
# Review / approve
# -----------------------------------------------------------------------------

def review(conn, args):
    tables = ["wotd", "pvotd"] if args.table == "both" else [args.table]
    total = 0
    with conn.cursor() as cur:
        for t in tables:
            word_col = "word" if t == "wotd" else "phrasal_verb"
            date_col = "date::text" if t == "wotd" else "null::text"
            cur.execute(
                f"select id, {date_col}, language, level, {word_col}, voice, audio_word_url "
                f"from public.{TABLES[t]} where audio_check_pending order by id"
            )
            rows = cur.fetchall()
            total += len(rows)
            if rows:
                print(f"{t}: {len(rows)} word clip(s) waiting for a listen")
            for row_id, d, language, level, word, voice, url in rows:
                when = f"{d} " if d else ""
                print(f"  #{row_id}  {when}{language} {level}  {word}  [{voice}]")
                print(f"      {url or '(no audio yet)'}")
    if not total:
        print("Nothing waiting: every word clip is published.")
    else:
        print("\nPublish good ones with:  --table <wotd|pvotd> --approve id,id")
        print("Redo a bad one with:     --table <wotd|pvotd> --ids id --force --commit")
    return 0


def approve(conn, args):
    with conn.cursor() as cur:
        cur.execute(
            f"update public.{TABLES[args.table]} set audio_check_pending = false "
            f"where id = any(%s::int[]) and audio_check_pending and audio_word_url is not null returning id",
            (args.approve,),
        )
        done = sorted(r[0] for r in cur.fetchall())
    conn.commit()
    missed = sorted(set(args.approve) - set(done))
    print(f"Published word clips for {args.table} #{', #'.join(map(str, done)) if done else '(none)'}")
    if missed:
        print(f"Not changed (not flagged, or no audio yet): #{', #'.join(map(str, missed))}")
    return 0


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def parse_ids(p, value, flag):
    try:
        return [int(x) for x in value.split(",") if x.strip()]
    except ValueError:
        p.error(f"{flag} must be comma-separated numbers")


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="ElevenLabs audio for Word of the Day and Phrasal Verb of the Day.")
    p.add_argument("--commit", action="store_true", help="generate, upload and write URLs (default is a dry run)")
    p.add_argument("--table", choices=["wotd", "pvotd", "both"], default="both")
    p.add_argument("--lang", choices=["en", "es", "both"], default="en")
    p.add_argument("--force", action="store_true", help="regenerate rows that already have audio")
    p.add_argument("--from", dest="date_from", help="WOTD: first date (YYYY-MM-DD); default today")
    p.add_argument("--to", dest="date_to", help="WOTD: last date (YYYY-MM-DD)")
    p.add_argument("--ids", help="comma-separated row ids (use with --table wotd or pvotd)")
    p.add_argument("--limit", type=int, help="process at most N rows")
    p.add_argument("--speed", type=float, default=SPEED_DEFAULT, help="0.7 to 1.2; default %(default)s")
    p.add_argument("--save-local", metavar="DIR", help="also save every MP3 here")
    p.add_argument("--check-dir", metavar="DIR", default="~/Desktop/audio-check",
                   help="where flagged word clips are saved to listen to (default %(default)s)")
    p.add_argument("--review", action="store_true", help="list word clips waiting for a listen")
    p.add_argument("--approve", metavar="IDS", help="publish these flagged word clips (needs --table)")
    args = p.parse_args(argv)

    args.ids = parse_ids(p, args.ids, "--ids") if args.ids else None
    args.approve = parse_ids(p, args.approve, "--approve") if args.approve else None
    if (args.ids or args.approve) and args.table == "both":
        p.error("--ids and --approve need --table wotd or --table pvotd (ids differ between tables)")
    for name in ("date_from", "date_to"):
        v = getattr(args, name)
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                p.error(f"--{name.replace('date_', '')} must be YYYY-MM-DD")
    if not args.date_from and not args.ids:
        args.date_from = date.today().isoformat()
    if not 0.7 <= args.speed <= 1.2:
        p.error("--speed must be between 0.7 and 1.2")
    return args


def save_copy(directory, path, audio):
    d = os.path.expanduser(directory)
    os.makedirs(d, exist_ok=True)
    local = os.path.join(d, path.replace("/", "_"))
    with open(local, "wb") as f:
        f.write(audio)
    return local


def main(argv=None):
    args = parse_args(argv)
    conn = psycopg2.connect(require(env("SUPABASE_DB"), ["SUPABASE_DB"]))
    try:
        if args.review:
            return review(conn, args)
        if args.approve:
            return approve(conn, args)

        items = fetch_items(conn, args)
        if not items:
            print("Nothing to do: every matching row already has audio.")
            return 0

        bad = sorted({i.voice for i in items if i.voice not in VOICES})
        if bad:
            sys.exit(f"Unknown voice value(s): {bad}. Known: {sorted(VOICES)}")

        chars = {}
        for i in items:
            for _kind, text, model in i.clips():
                chars[model] = chars.get(model, 0) + len(text)
        credits = sum(n * CREDIT_RATE.get(m, 1.0) for m, n in chars.items())
        flagged = [i for i in items if i.check]

        mode = "COMMIT" if args.commit else "DRY RUN"
        by_table = ", ".join(f"{sum(1 for i in items if i.table == t)} {t}" for t in ("wotd", "pvotd")
                             if any(i.table == t for i in items))
        print(f"{mode}: {len(items)} rows ({by_table}), lang {args.lang}, speed {args.speed}")
        for m, n in chars.items():
            print(f"  {m}: {n:,} characters")
        print(f"  ≈ {credits:,.0f} credits")
        print(f"  {len(flagged)} word clip(s) flagged for a listen before students hear them")
        print()

        if not args.commit:
            for i in items:
                print(i.label())
                for kind, text, model in i.clips():
                    print(f"    {kind:7} {model:24} {text}")
            print("\nDry run only. Add --commit to generate and upload.")
            return 0

        api_key = require(env("ELEVENLABS_API_KEY", "ELEVEN_API_KEY", "XI_API_KEY"), ["ELEVENLABS_API_KEY"])
        service_key = require(
            env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"),
            ["SUPABASE_SERVICE_ROLE_KEY"],
        )
        supabase_url = env("SUPABASE_URL", "VITE_SUPABASE_URL", default=PROJECT_URL_DEFAULT).rstrip("/")

        done, failed, to_check = 0, [], []
        for i in items:
            stamp = int(time.time())
            print(i.label())
            try:
                urls = {}
                for kind, text, model in i.clips():
                    audio = tts(api_key, VOICES[i.voice], text, model, args.speed, i.language)
                    path = i.path(kind)
                    upload(supabase_url, service_key, path, audio)
                    urls[kind] = public_url(supabase_url, path, stamp)
                    if args.save_local:
                        save_copy(args.save_local, path, audio)
                    if kind == "word" and i.check:
                        to_check.append((i, save_copy(args.check_dir, path, audio)))
                    print(f"    {kind:7} ok  {len(audio) // 1024} KB")
                with conn.cursor() as cur:
                    cur.execute(UPDATE_SQL.format(table=TABLES[i.table]),
                                (i.voice, urls["word"], urls["example"], i.check, i.id))
                conn.commit()
                done += 1
            except Exception as e:  # keep going; report at the end
                conn.rollback()
                failed.append((i, str(e)))
                print(f"    FAILED: {e}")

        print(f"\nDone: {done} rows with audio, {len(failed)} failed.")
        for i, err in failed:
            print(f"  {i.table} #{i.id} {i.word}: {err}")
        if failed:
            print("Re-run the same command to retry the failures; finished rows are skipped.")
        if to_check:
            print(f"\n{len(to_check)} word clip(s) are hidden from students until you approve them.")
            print(f"Copies to listen to: {os.path.expanduser(args.check_dir)}")
            for i, _local in to_check:
                print(f"  {i.table} #{i.id}  {i.word}")
            print("Then: --table <wotd|pvotd> --approve id,id   (or --review to list them again)")
        return 1 if failed else 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
