#!/usr/bin/env python3
"""
tag_sentences.py — LLM tagging pass over the student_sentences corpus.

Reads untagged rows from the student_sentences_tagged view, asks an Anthropic
model to classify each one, and (with --commit) upserts the result into the
sentence_tags table. The classifier RE-JUDGES each sentence independently — it
does not trust the platform marker's is_correct verdict — so it also surfaces
marker false-positives and false-negatives.

Environment:
  SUPABASE_DB_URL   Postgres connection URI (use the SESSION POOLER URI from
                    Supabase > Project Settings > Database, port 5432).
  ANTHROPIC_API_KEY Your Anthropic API key.

Deps: psycopg2, requests  (pip install psycopg2-binary requests)

Usage:
  python scripts/tag_sentences.py                         # dry-run, all untagged
  python scripts/tag_sentences.py --student "Belinda Alemán Diaz"
  python scripts/tag_sentences.py --limit 20
  python scripts/tag_sentences.py --commit                # write tags
  python scripts/tag_sentences.py --retag --student "..." # re-tag already-tagged
  python scripts/tag_sentences.py --model claude-haiku-4-5 # cheaper, less accurate
"""

import os
import sys
import json
import time
import argparse

import psycopg2
import psycopg2.extras
import requests

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-4-6"
VALID_CATEGORIES = {"correct", "genuine_error", "off_target", "marker_noise"}

SYSTEM_PROMPT = """You are an expert ESL assessment analyst for an English-learning platform used by adult hospitality-sector learners. You classify a single sentence-challenge submission into one tag.

You RE-JUDGE the sentence independently. The platform's automatic marker is often wrong, and catching its mistakes is part of your job. The marker's verdict and feedback are given only as context — do not defer to them.

Return ONLY a JSON object, no prose and no markdown fences:
{"category": "...", "subtype": "...", "note": "..."}

category is exactly one of:
- "correct": good English AND meets the task (uses the target word/structure appropriately). Minor cosmetic slips (a typo, a missing space, missing capital) do NOT disqualify it.
- "genuine_error": a real language mistake a teacher would correct.
- "off_target": valid English that didn't use the required target structure/word, where this does NOT reveal a misunderstanding of the target (e.g. a fragment when a full sentence was asked for, or correct English that simply sidestepped the structure).
- "marker_noise": the marker failed it but it is NOT the student's fault.

subtype:
- For genuine_error, the single most substantive error type: verb_form, verb_tense, subject_verb_agreement, word_order, article, preposition, pronoun, plural, spelling, typo_function_word, word_meaning, word_choice, target_concept, other. If several errors exist, pick the most substantive and mention the rest in the note.
- For marker_noise, the reason: marker_fail, pos_overstrict, over_strict, cosmetic.
- For off_target and correct: null.

Rules (follow exactly):
1. target_concept: if the student wrote valid English but their choice shows they don't grasp the target concept, it is genuine_error/target_concept — NOT off_target. Example: the task asks for a REGULAR past-simple verb and they use an irregular one (went, woke, were) — they don't know which verbs are regular.
2. pos_overstrict: if the ONLY problem is that the student used the target word as a different part of speech (e.g. adjective 'clean' used as the verb 'cleans', or 'lost' used as a past-tense verb), classify marker_noise/pos_overstrict. At these levels this is not an error.
3. over_strict: if the form and word use are correct but the marker rejected it for wanting more elaboration or a narrower meaning, classify marker_noise/over_strict.
4. word_meaning: if the student misunderstood the target word's meaning (used the wrong or opposite sense, or described the wrong concept), classify genuine_error/word_meaning.
5. marker_fail: marker feedback like "Could not check", "Try again", or a generic non-specific rejection = marker_noise/marker_fail.
6. cosmetic: ignore spacing, missing capitals, and obvious phone typos when judging correctness — these alone are marker_noise/cosmetic, never genuine_error.
7. Fragments (noun phrases where a full sentence was required) where the target word/structure is otherwise used correctly = off_target.

The note is one short sentence (max ~20 words) explaining the call, written for the teacher."""


def get_args():
    p = argparse.ArgumentParser(description="Tag student sentences with an LLM.")
    p.add_argument("--commit", action="store_true", help="Write tags (default: dry-run).")
    p.add_argument("--retag", action="store_true", help="Re-tag rows that already have a tag.")
    p.add_argument("--student", default=None, help="Filter by student_name (exact).")
    p.add_argument("--source", default=None, help="Filter by source (wotd/gotd/pvotd/rpe/...).")
    p.add_argument("--limit", type=int, default=None, help="Max rows to process.")
    p.add_argument("--model", default=DEFAULT_MODEL, help=f"Anthropic model (default {DEFAULT_MODEL}).")
    p.add_argument("--sleep", type=float, default=0.0, help="Seconds to pause between calls.")
    return p.parse_args()


def fetch_rows(conn, args):
    where = []
    params = []
    if not args.retag:
        where.append("category IS NULL")
    if args.student:
        where.append("student_name = %s")
        params.append(args.student)
    if args.source:
        where.append("source = %s")
        params.append(args.source)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    limit = f"LIMIT {int(args.limit)}" if args.limit else ""
    sql = f"""
        SELECT source, row_id, student_name, student_level, language,
               item_level, target, sentence, is_correct, ai_feedback
        FROM student_sentences_tagged
        {clause}
        ORDER BY submitted_at
        {limit}
    """
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def classify(row, model, api_key):
    user_payload = {
        "source": row["source"],
        "target_asked_for": row["target"],
        "student_level": row["student_level"],
        "item_level": row["item_level"],
        "language": row["language"],
        "marker_verdict": "pass" if row["is_correct"] else "fail",
        "marker_feedback": row["ai_feedback"],
        "sentence": row["sentence"],
    }
    body = {
        "model": model,
        "max_tokens": 300,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    resp = requests.post(API_URL, headers=headers, json=body, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    obj = json.loads(text)
    cat = obj.get("category")
    if cat not in VALID_CATEGORIES:
        raise ValueError(f"invalid category: {cat!r}")
    sub = obj.get("subtype")
    if isinstance(sub, str) and sub.lower() in ("null", "none", ""):
        sub = None
    return cat, sub, (obj.get("note") or "").strip()


def marker_flag(category, is_correct):
    if category == "genuine_error" and is_correct:
        return "false_positive"
    if category in ("correct", "marker_noise") and not is_correct:
        return "false_negative"
    return "agree"


def main():
    args = get_args()
    db_url = os.environ.get("SUPABASE_DB_URL")
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not db_url:
        sys.exit("ERROR: set SUPABASE_DB_URL (session pooler URI).")
    if not api_key:
        sys.exit("ERROR: set ANTHROPIC_API_KEY.")

    conn = psycopg2.connect(db_url)
    rows = fetch_rows(conn, args)
    mode = "COMMIT" if args.commit else "DRY-RUN"
    print(f"[{mode}] {len(rows)} row(s) to tag with {args.model}\n")

    results = []
    cat_counts = {}
    flag_counts = {"false_positive": 0, "false_negative": 0, "agree": 0}
    failures = 0

    for i, row in enumerate(rows, 1):
        try:
            cat, sub, note = classify(row, args.model, api_key)
        except Exception as e:
            failures += 1
            print(f"  ! [{i}/{len(rows)}] {row['source']}:{row['row_id']} FAILED: {e}")
            continue
        flag = marker_flag(cat, row["is_correct"])
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
        flag_counts[flag] += 1
        results.append((row["source"], row["row_id"], cat, sub, note))
        tag = f"{cat}" + (f"/{sub}" if sub else "")
        snippet = (row["sentence"] or "")[:48].replace("\n", " ")
        marker = "OK " if row["is_correct"] else "FAIL"
        flagtag = "" if flag == "agree" else f"  <{flag}>"
        print(f"  [{i}/{len(rows)}] {marker} {tag:32} {snippet!r}{flagtag}")
        if args.sleep:
            time.sleep(args.sleep)

    print("\n--- summary ---")
    for c, n in sorted(cat_counts.items()):
        print(f"  {c:14} {n}")
    print(f"  marker false-positives: {flag_counts['false_positive']}")
    print(f"  marker false-negatives: {flag_counts['false_negative']}")
    if failures:
        print(f"  failures (not written): {failures}")

    if args.commit and results:
        with conn.cursor() as cur:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO sentence_tags (source, row_id, category, subtype, note, model)
                VALUES %s
                ON CONFLICT (source, row_id) DO UPDATE
                  SET category = EXCLUDED.category,
                      subtype  = EXCLUDED.subtype,
                      note     = EXCLUDED.note,
                      model    = EXCLUDED.model,
                      tagged_at = now()
                """,
                [(s, r, c, sub, note, args.model) for (s, r, c, sub, note) in results],
            )
        conn.commit()
        print(f"\nWrote {len(results)} tag(s) to sentence_tags.")
    elif not args.commit:
        print("\nDry-run only — no tags written. Re-run with --commit to persist.")

    conn.close()


if __name__ == "__main__":
    main()
