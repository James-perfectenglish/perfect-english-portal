"""
Wordle guess-dictionary export for Perfect English Portal.

Dumps the five-letter subset of `word_lists` into two JS modules that
`WordleGame.jsx` pulls in via dynamic import, so each becomes its own hashed
chunk: precached by the service worker, versioned with the build, and loaded
only when the game opens. No per-guess network call, and it works offline.

Words are written on their accent-normalised key (`word_key`), because students
type plain letters — the ES on-screen keyboard has no accent keys.

Re-run this after ANY change to word_lists, or the shipped dictionary drifts
away from the database.

Run mode:
  python3 scripts/export_wordle_words.py             # dry run, counts only
  python3 scripts/export_wordle_words.py --commit    # write src/data/*.js

Requires:
  - $SUPABASE_DB env var (the pooler connection string)
  - psycopg2 installed
"""

import os
import sys
import argparse
from pathlib import Path

import psycopg2

OUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

QUERY = """
    select distinct word_key
    from word_lists
    where language = %s
      and length(word_key) = 5
      and word_key ~ '^[a-zñ]+$'
    order by word_key
"""

HEADER = """// GENERATED FILE — do not edit by hand.
// Written by scripts/export_wordle_words.py from the word_lists table.
// {count:,} five-letter {lang} forms, on the accent-normalised key.
export const WORDS = """


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true",
                    help="write the files (otherwise report counts only)")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB")
    if not dsn:
        sys.exit("$SUPABASE_DB is not set — check ~/.zshrc.")

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    for lang in ("en", "es"):
        cur.execute(QUERY, (lang,))
        words = [r[0] for r in cur.fetchall()]
        payload = "[" + ",".join(f'"{w}"' for w in words) + "]\n"
        size_kb = len(payload.encode("utf-8")) / 1024
        print(f"  {lang}: {len(words):,} words, {size_kb:.0f}KB raw")

        if args.commit:
            OUT_DIR.mkdir(parents=True, exist_ok=True)
            path = OUT_DIR / f"wordleWords.{lang}.js"
            path.write_text(HEADER.format(count=len(words), lang=lang.upper())
                            + payload, encoding="utf-8")
            print(f"       -> {path.relative_to(OUT_DIR.parent.parent)}")

    cur.close()
    conn.close()

    if not args.commit:
        print("\nDry run — nothing written. Re-run with --commit.")


if __name__ == "__main__":
    main()
