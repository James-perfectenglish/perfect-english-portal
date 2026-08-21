"""
Spanish word list import for Perfect English Portal.

Stages an inflected Spanish word list into `word_list_import_es`. Claude then
merges it into `word_lists` server-side, skipping any word whose `word_key`
already exists so the accented lemmas already in the table survive as the
canonical display form.

Source: words/an-array-of-spanish-words (MIT), ~636k forms, Letterpress-derived.
Already accent-stripped with ñ preserved, which matches how `wordle_words`
stores Spanish.

Pipeline:
  1. Fetch the list (falls back to the master branch if main 404s)
  2. Filter to length 4-15 and /^[a-zñ]+$/ (existing word_lists convention)
  3. Dedupe
  4. COPY into word_list_import_es in one statement
  5. Report the staged count

Run mode:
  python3 scripts/import_es_wordlist.py             # dry run, fetch + report only
  python3 scripts/import_es_wordlist.py --commit    # actually stage to DB

Requires:
  - $SUPABASE_DB env var (the pooler connection string)
  - psycopg2 installed
"""

import io
import os
import re
import sys
import json
import argparse
import urllib.request

import psycopg2

SOURCES = [
    "https://raw.githubusercontent.com/words/an-array-of-spanish-words/main/index.json",
    "https://raw.githubusercontent.com/words/an-array-of-spanish-words/master/index.json",
]

MIN_LEN, MAX_LEN = 4, 15
VALID = re.compile(r"^[a-zñ]+$")
EXPECTED = 634_527  # what Claude measured on the same source


def fetch():
    for url in SOURCES:
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                if r.status == 200:
                    print(f"  fetched {url}")
                    return json.loads(r.read().decode("utf-8"))
                print(f"  {url} -> {r.status}")
        except Exception as e:
            print(f"  {url} -> {e}")
    sys.exit("Could not fetch the word list from either URL.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true",
                    help="stage to word_list_import_es (otherwise dry run)")
    args = ap.parse_args()

    print("Fetching Spanish word list...")
    raw = fetch()
    print(f"  {len(raw):,} raw entries")

    words = sorted({w for w in raw
                    if MIN_LEN <= len(w) <= MAX_LEN and VALID.match(w)})
    print(f"  {len(words):,} after filtering (expected ~{EXPECTED:,})")
    print(f"  five-letter forms: {sum(1 for w in words if len(w) == 5):,}")

    for probe in ("tengo", "quiero", "puedo", "casas", "mares", "peces", "mañana"):
        print(f"    {probe:8} {'ok' if probe in set(words) else 'MISSING'}")

    if not args.commit:
        print("\nDry run — nothing written. Re-run with --commit to stage.")
        return

    dsn = os.environ.get("SUPABASE_DB")
    if not dsn:
        sys.exit("$SUPABASE_DB is not set — check ~/.zshrc.")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    cur.execute("select count(*) from word_list_import_es")
    existing = cur.fetchone()[0]
    if existing:
        print(f"\n  staging table already holds {existing:,} rows — clearing it")
        cur.execute("truncate word_list_import_es")

    buf = io.StringIO("\n".join(words) + "\n")
    print("  copying...")
    cur.copy_expert("COPY word_list_import_es (word) FROM STDIN", buf)

    cur.execute("select count(*) from word_list_import_es")
    staged = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()

    print(f"\nDone — {staged:,} rows staged in word_list_import_es.")
    print("Tell Claude the count and it will merge into word_lists.")


if __name__ == "__main__":
    main()
