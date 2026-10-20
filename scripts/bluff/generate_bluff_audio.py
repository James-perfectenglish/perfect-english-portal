#!/usr/bin/env python3
"""
generate_bluff_audio.py: ElevenLabs audio for the Call My Bluff game (table: bluff_words).

For every row that is missing audio it makes:
  - the word on its own                           -> audio_word_url
  - each context sentence ([[markers]] stripped)  -> audio_context_urls (same order as contexts)
uploads the MP3s to the public `audio` bucket under bluff/<play_date>/, and writes
the URLs back to the row. Each row is committed as soon as its audio is up, so an
interrupted run simply carries on from where it stopped next time.

Voices follow bluff_words.voice (alice / daniel), which rotates by day and level.

Models:
  single words -> eleven_flash_v2 (English-only, so false friends such as
                  "sensible" or "conductor" are never read as Spanish)
  sentences    -> eleven_multilingual_v2 (best quality)
Both can be overridden with --word-model / --context-model.

Usage (from the repo root; the wrapper loads .env.local):
  sh scripts/bluff/run-bluff-audio.sh                          # dry run: what would be made + character count
  sh scripts/bluff/run-bluff-audio.sh --commit --limit 3 --save-local ~/Desktop/bluff-test
                                                               # make three rows and keep local copies to listen to
  sh scripts/bluff/run-bluff-audio.sh --commit                 # everything still missing audio
  sh scripts/bluff/run-bluff-audio.sh --commit --ids 12,15 --force
                                                               # redo specific rows (e.g. a bad pronunciation)
  --from 2026-11-01 --to 2026-11-07                            # date window

Env (.env.local, one per line, no quotes):
  ELEVENLABS_API_KEY
  SUPABASE_DB                  session-pooler connection string (same as the other scripts)
  SUPABASE_SERVICE_ROLE_KEY    for Storage uploads (sb_secret_... keys work too)
  SUPABASE_URL                 optional, defaults to the project URL

Requires psycopg2 (already used by generate_wordsearch.py). No other dependencies.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date

import psycopg2

PROJECT_URL_DEFAULT = "https://dyxmgicedabvmsbuvxny.supabase.co"
ELEVEN_API_BASE = os.environ.get("ELEVENLABS_API_BASE", "https://api.elevenlabs.io")
BUCKET = "audio"
FOLDER = "bluff"
OUTPUT_FORMAT = "mp3_44100_128"

VOICES = {
    "alice": "ZEt85AU1ui8Rr8FxNslW",
    "daniel": "ynTHHllfDmGsZ3G8QJt9",
}

WORD_MODEL_DEFAULT = "eleven_flash_v2"
CONTEXT_MODEL_DEFAULT = "eleven_multilingual_v2"

# Steady, clear delivery. Slightly below normal speed for learners; --speed 1.0 to undo.
VOICE_SETTINGS = {
    "stability": 0.6,
    "similarity_boost": 0.8,
    "style": 0.0,
    "use_speaker_boost": True,
}
SPEED_DEFAULT = 0.95

MARKER = re.compile(r"\[\[(.+?)\]\]")


# -----------------------------------------------------------------------------
# Text and paths
# -----------------------------------------------------------------------------

def spoken_context(sentence):
    """The sentence as it should be read aloud: [[markers]] removed."""
    return MARKER.sub(r"\1", sentence).strip()


def spoken_word(word):
    """A trailing full stop gives the word a natural, finished intonation."""
    w = word.strip()
    return w if w.endswith((".", "!", "?")) else w + "."


def slug(word):
    return re.sub(r"[^a-z0-9]+", "-", word.lower()).strip("-") or "word"


def storage_path(play_date, level, position, word, kind):
    """kind is 'word' or 'ctx1', 'ctx2'."""
    d = play_date.isoformat() if isinstance(play_date, date) else str(play_date)
    return f"{FOLDER}/{d}/{level}{position}-{slug(word)}-{kind}.mp3"


def public_url(supabase_url, path, stamp):
    # ?v= busts the CDN cache when a clip is regenerated with --force
    return f"{supabase_url}/storage/v1/object/public/{BUCKET}/{path}?v={stamp}"


# -----------------------------------------------------------------------------
# Env
# -----------------------------------------------------------------------------

def env(*names, default=None):
    for n in names:
        v = os.environ.get(n)
        if v and v.strip():
            return v.strip()
    return default


def require(value, names):
    if not value:
        sys.exit(f"Missing environment variable: {' or '.join(names)} (add it to .env.local)")
    return value


# -----------------------------------------------------------------------------
# HTTP
# -----------------------------------------------------------------------------

RETRYABLE = {408, 409, 425, 429, 500, 502, 503, 504}


def _send(req, what, retries=5):
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:400]
            if e.code in RETRYABLE and attempt < retries - 1:
                wait = 2 ** attempt * 2
                print(f"    {what}: HTTP {e.code}, retrying in {wait}s")
                time.sleep(wait)
                continue
            raise RuntimeError(f"{what} failed: HTTP {e.code} {detail}") from None
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                wait = 2 ** attempt * 2
                print(f"    {what}: {e.reason}, retrying in {wait}s")
                time.sleep(wait)
                continue
            raise RuntimeError(f"{what} failed: {e.reason}") from None


def tts(api_key, voice_id, text, model, speed):
    url = f"{ELEVEN_API_BASE}/v1/text-to-speech/{voice_id}?output_format={OUTPUT_FORMAT}"
    body = {
        "text": text,
        "model_id": model,
        "voice_settings": {**VOICE_SETTINGS, "speed": speed},
    }
    # Models that accept an explicit language get one, so nothing drifts into Spanish.
    if model in ("eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_v3", "eleven_v4", "eleven_v4_turbo"):
        body["language_code"] = "en"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
    )
    audio = _send(req, f"ElevenLabs ({model})")
    if not audio or len(audio) < 1000:
        raise RuntimeError(f"ElevenLabs returned suspiciously little audio ({len(audio or b'')} bytes) for: {text!r}")
    return audio


def upload(supabase_url, service_key, path, audio):
    url = f"{supabase_url}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "apikey": service_key,
        "Content-Type": "audio/mpeg",
        "x-upsert": "true",
        "cache-control": "max-age=31536000",
    }
    # Legacy JWT service-role keys also go in Authorization; new sb_secret_ keys must not.
    if not service_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {service_key}"
    req = urllib.request.Request(url, data=audio, method="POST", headers=headers)
    _send(req, f"Storage upload {path}")


# -----------------------------------------------------------------------------
# DB
# -----------------------------------------------------------------------------

SELECT_SQL = """
select id, play_date, level, position, word, contexts, voice
from public.bluff_words
where (%(force)s
       or audio_word_url is null
       or audio_context_urls is null
       or cardinality(audio_context_urls) <> cardinality(contexts))
  and (%(date_from)s::date is null or play_date >= %(date_from)s::date)
  and (%(date_to)s::date   is null or play_date <= %(date_to)s::date)
  and (%(ids)s::bigint[]   is null or id = any(%(ids)s::bigint[]))
order by play_date, level, position
"""

UPDATE_SQL = """
update public.bluff_words
set audio_word_url = %s, audio_context_urls = %s
where id = %s
"""


def fetch_rows(conn, args):
    params = {
        "force": args.force,
        "date_from": args.date_from,
        "date_to": args.date_to,
        "ids": args.ids,
    }
    with conn.cursor() as cur:
        cur.execute(SELECT_SQL, params)
        rows = cur.fetchall()
    if args.limit:
        rows = rows[: args.limit]
    return rows


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Generate ElevenLabs audio for bluff_words.")
    p.add_argument("--commit", action="store_true", help="actually generate, upload and write URLs (default is a dry run)")
    p.add_argument("--force", action="store_true", help="regenerate rows that already have audio")
    p.add_argument("--from", dest="date_from", help="first play_date (YYYY-MM-DD)")
    p.add_argument("--to", dest="date_to", help="last play_date (YYYY-MM-DD)")
    p.add_argument("--ids", help="comma-separated bluff_words ids")
    p.add_argument("--limit", type=int, help="process at most N rows")
    p.add_argument("--word-model", default=WORD_MODEL_DEFAULT)
    p.add_argument("--context-model", default=CONTEXT_MODEL_DEFAULT)
    p.add_argument("--speed", type=float, default=SPEED_DEFAULT, help="0.7 to 1.2; default %(default)s")
    p.add_argument("--save-local", metavar="DIR", help="also save every MP3 here, to listen before students hear it")
    args = p.parse_args(argv)
    if args.ids:
        try:
            args.ids = [int(x) for x in args.ids.split(",") if x.strip()]
        except ValueError:
            p.error("--ids must be comma-separated numbers")
    else:
        args.ids = None
    for name in ("date_from", "date_to"):
        v = getattr(args, name)
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                p.error(f"--{name.replace('date_', '')} must be YYYY-MM-DD")
    if not 0.7 <= args.speed <= 1.2:
        p.error("--speed must be between 0.7 and 1.2")
    return args


def plan_row(row):
    """Everything to be spoken for one row: list of (kind, text, model_role)."""
    _id, play_date, level, position, word, contexts, voice = row
    items = [("word", spoken_word(word), "word")]
    for i, c in enumerate(contexts or [], 1):
        items.append((f"ctx{i}", spoken_context(c), "context"))
    return items


def main(argv=None):
    args = parse_args(argv)

    db_url = require(env("SUPABASE_DB"), ["SUPABASE_DB"])
    conn = psycopg2.connect(db_url)
    try:
        rows = fetch_rows(conn, args)
        if not rows:
            print("Nothing to do: every matching row already has audio.")
            return 0

        model_for = {"word": args.word_model, "context": args.context_model}
        chars = {args.word_model: 0, args.context_model: 0}
        for row in rows:
            for _kind, text, role in plan_row(row):
                chars[model_for[role]] += len(text)

        mode = "COMMIT" if args.commit else "DRY RUN"
        print(f"{mode}: {len(rows)} rows, speed {args.speed}")
        for m, n in chars.items():
            print(f"  {m}: {n:,} characters")
        print()

        bad_voice = sorted({r[6] for r in rows if r[6] not in VOICES})
        if bad_voice:
            sys.exit(f"Unknown voice value(s) in bluff_words.voice: {bad_voice}")

        if not args.commit:
            for row in rows:
                _id, play_date, level, position, word, _contexts, voice = row
                print(f"#{_id}  {play_date} {level}{position}  {word}  [{voice}]")
                for kind, text, role in plan_row(row):
                    print(f"    {kind:5} {model_for[role]:24} {text}")
            print("\nDry run only. Add --commit to generate and upload.")
            return 0

        api_key = require(env("ELEVENLABS_API_KEY", "ELEVEN_API_KEY", "XI_API_KEY"), ["ELEVENLABS_API_KEY"])
        service_key = require(
            env("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"),
            ["SUPABASE_SERVICE_ROLE_KEY"],
        )
        supabase_url = env("SUPABASE_URL", "VITE_SUPABASE_URL", default=PROJECT_URL_DEFAULT).rstrip("/")

        if args.save_local:
            os.makedirs(os.path.expanduser(args.save_local), exist_ok=True)

        done, failed = 0, []
        for row in rows:
            _id, play_date, level, position, word, contexts, voice = row
            voice_id = VOICES[voice]
            stamp = int(time.time())
            print(f"#{_id}  {play_date} {level}{position}  {word}  [{voice}]")
            try:
                urls = {}
                for kind, text, role in plan_row(row):
                    audio = tts(api_key, voice_id, text, model_for[role], args.speed)
                    path = storage_path(play_date, level, position, word, kind)
                    upload(supabase_url, service_key, path, audio)
                    urls[kind] = public_url(supabase_url, path, stamp)
                    if args.save_local:
                        local = os.path.join(os.path.expanduser(args.save_local), path.replace("/", "_"))
                        with open(local, "wb") as f:
                            f.write(audio)
                    print(f"    {kind:5} ok  {len(audio) // 1024} KB")
                ctx_urls = [urls[f"ctx{i}"] for i in range(1, len(contexts or []) + 1)]
                with conn.cursor() as cur:
                    cur.execute(UPDATE_SQL, (urls["word"], ctx_urls, _id))
                conn.commit()
                done += 1
            except Exception as e:  # keep going; report at the end
                conn.rollback()
                failed.append((_id, word, str(e)))
                print(f"    FAILED: {e}")

        print(f"\nDone: {done} rows with audio, {len(failed)} failed.")
        for _id, word, err in failed:
            print(f"  #{_id} {word}: {err}")
        if failed:
            print("Re-run the same command to retry the failures; finished rows are skipped.")
        return 1 if failed else 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
