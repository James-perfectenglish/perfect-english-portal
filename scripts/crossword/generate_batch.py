"""
generate_batch.py — generate daily crosswords and either commit them or emit
reviewable SQL. Word choice uses the bank's used_count/last_used_date so a batch
prefers fresh vocabulary and avoids repeats; clue variants rotate for variety.

  python3 generate_batch.py --days 7 --start 2026-06-04                # dry run
  python3 generate_batch.py --days 7 --start 2026-06-04 --commit       # write DB
  python3 generate_batch.py --days 7 --start 2026-06-04 --out review.sql  # SQL only

Requires $SUPABASE_DB (pooler string) + psycopg2, same as generate_wordsearch.py.
"""
from __future__ import annotations
import argparse, json, os, random, sys
from collections import defaultdict
from datetime import date, timedelta
from crossword_engine import generate_puzzle, LEVEL_CONFIGS

LANG_LEVELS = [("en", "A"), ("en", "B"), ("en", "C"), ("es", "A")]
POOL_MULT = 3.0

def load_bank(conn):
    with conn.cursor() as cur:
        cur.execute("""SELECT id, word, language, level, clue_text,
                              used_count, last_used_date FROM crossword_clue_bank""")
        return [{"id": r[0], "word": r[1], "language": r[2], "level": r[3],
                 "clue_text": r[4], "used_count": r[5],
                 "last_used_date": r[6].isoformat() if r[6] else None}
                for r in cur.fetchall()]

def variants_by_word(rows):
    out = defaultdict(lambda: defaultdict(list))
    for r in rows:
        out[(r["language"], r["level"])][r["word"]].append(r)
    return out

def freshness_key(word_rows, extra_use):
    base = min(r["used_count"] for r in word_rows)
    last = max((r["last_used_date"] or "0000-00-00") for r in word_rows)
    return (base + extra_use * 5, last)   # in-batch use weighted x5 -> keeps week varied

def pick_pool(words_map, cfg, used_in_batch, rng, day_index):
    words = sorted(words_map, key=lambda w: freshness_key(words_map[w], used_in_batch[w]))
    fresh = words[:min(len(words), int(cfg.target_words * POOL_MULT))]
    rng.shuffle(fresh)
    out = []
    for w in fresh:
        variants = sorted(words_map[w], key=lambda r: r["used_count"])
        v = variants[day_index % len(variants)]
        out.append({"word": w, "clue_text": v["clue_text"], "bank_id": v["id"]})
    return out

def build_batch(rows, start, days, seed):
    rng = random.Random(seed)
    vbw = variants_by_word(rows)
    used_in_batch = {ll: defaultdict(int) for ll in LANG_LEVELS}
    stars_seen = defaultdict(set)
    out = []
    for d in range(days):
        play_date = (start + timedelta(days=d)).isoformat()
        for (lang, level) in LANG_LEVELS:
            cfg = LEVEL_CONFIGS[(lang, level)]
            pool = pick_pool(vbw[(lang, level)], cfg, used_in_batch[(lang, level)], rng, d)
            puz = generate_puzzle(pool, lang, level, rng=rng)
            if puz is None:
                out.append({"play_date": play_date, "language": lang, "level": level,
                            "failed": True}); continue
            seen = stars_seen[(lang, level)]
            if puz["star_word"] in seen:
                for w in sorted(set(puz["words_used"]), key=len, reverse=True):
                    if w not in seen:
                        puz["star_word"] = w; break
            seen.add(puz["star_word"])
            for c in puz["clues"]:
                used_in_batch[(lang, level)][c["answer"]] += 1
            puz["play_date"] = play_date
            out.append(puz)
    return out

def commit(conn, puzzles):
    from psycopg2.extras import Json
    with conn.cursor() as cur:
        for p in puzzles:
            if p.get("failed"):
                continue
            cur.execute(
                """INSERT INTO crossword_puzzles
                   (play_date, language, level, grid_rows, grid_cols, grid, clues, star_word)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (play_date, language, level) DO NOTHING""",
                (p["play_date"], p["language"], p["level"], p["grid_rows"],
                 p["grid_cols"], Json(p["grid"]), Json(p["clues"]), p["star_word"]))
            ids = [c["bank_id"] for c in p["clues"] if c["bank_id"] is not None]
            if ids:
                cur.execute(
                    """UPDATE crossword_clue_bank SET used_count = used_count + 1,
                       last_used_date = %s WHERE id = ANY(%s)""", (p["play_date"], ids))
    conn.commit()

def emit_sql(puzzles, path):
    L = ["BEGIN;"]
    for p in puzzles:
        if p.get("failed"):
            continue
        g = json.dumps(p["grid"], ensure_ascii=False)
        cl = json.dumps(p["clues"], ensure_ascii=False)
        ids = ",".join(str(c["bank_id"]) for c in p["clues"] if c["bank_id"] is not None)
        L.append(f"-- {p['play_date']} {p['language']}-{p['level']} star={p['star_word']}")
        L.append("INSERT INTO crossword_puzzles (play_date,language,level,grid_rows,"
                 "grid_cols,grid,clues,star_word) VALUES ("
                 f"'{p['play_date']}','{p['language']}','{p['level']}',{p['grid_rows']},"
                 f"{p['grid_cols']},$x${g}$x$::jsonb,$x${cl}$x$::jsonb,'{p['star_word']}') "
                 "ON CONFLICT (play_date,language,level) DO NOTHING;")
        if ids:
            L.append(f"UPDATE crossword_clue_bank SET used_count=used_count+1,"
                     f"last_used_date='{p['play_date']}' WHERE id IN ({ids});")
    L.append("COMMIT;")
    open(path, "w", encoding="utf-8").write("\n".join(L))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True, help="YYYY-MM-DD")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--commit", action="store_true", help="write puzzles to the DB")
    ap.add_argument("--out", help="write reviewable SQL to this path instead")
    args = ap.parse_args()
    dsn = os.environ.get("SUPABASE_DB")
    if not dsn:
        sys.exit("SUPABASE_DB env var not set.")
    import psycopg2
    seed = args.seed if args.seed is not None else random.randrange(1 << 30)
    with psycopg2.connect(dsn) as conn:
        rows = load_bank(conn)
        puzzles = build_batch(rows, date.fromisoformat(args.start), args.days, seed)
        print(f"seed={seed}")
        for p in puzzles:
            if p.get("failed"):
                print(f"  {p['play_date']} {p['language']}-{p['level']}  FAILED")
            else:
                print(f"  {p['play_date']} {p['language']}-{p['level']}  "
                      f"{p['grid_rows']}x{p['grid_cols']} {len(p['clues'])}w star={p['star_word']}")
        if args.out:
            emit_sql(puzzles, args.out); print(f"wrote {args.out}")
        if args.commit:
            commit(conn, puzzles); print("committed to DB")
    if not args.commit and not args.out:
        print("\nDry run only. Re-run with --commit to write, or --out file.sql to review.")

if __name__ == "__main__":
    main()