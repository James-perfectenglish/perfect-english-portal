"""
crossword_engine.py — crossword construction engine for Perfect English Portal.

No database code. Takes (word, clue) candidates + a level config and produces a
puzzle whose grid/clues match the EXACT JSONB shape CrosswordGame.jsx expects:

    grid:  2D array of cells, each one of:
             {"letter":"C"} | {"num":1,"letter":"C"} | {"blocked":true}
    clues: [{num, dir, row, col, answer, length, clue_text, bank_id}, ...]

Greedy length-major placement + three validation layers:
  1. letter-consistency (crossings agree)
  2. connectivity (flood-fill: every word reachable)
  3. phantom-run (every maximal run >=2 is an intended placed word)
can_place() alone guarantees no phantoms; validate_no_phantoms() is the backstop.
"""
from __future__ import annotations
import random
from dataclasses import dataclass
from typing import Optional

@dataclass
class LevelConfig:
    target_words: int
    min_words: int
    max_dim: int
    name: str = ""

LEVEL_CONFIGS = {
    ("en", "A"): LevelConfig(9,  6,  10, "en-A"),
    ("en", "B"): LevelConfig(19, 14, 15, "en-B"),
    ("en", "C"): LevelConfig(18, 13, 15, "en-C"),
    ("es", "A"): LevelConfig(11, 7,  11, "es-A"),
}

ACROSS, DOWN = "across", "down"

@dataclass
class Placement:
    word: str
    clue_text: str
    bank_id: Optional[int]
    row: int
    col: int
    direction: str
    def cells(self):
        if self.direction == ACROSS:
            return [(self.row, self.col + i) for i in range(len(self.word))]
        return [(self.row + i, self.col) for i in range(len(self.word))]

class Grid:
    def __init__(self):
        self.cells: dict[tuple[int, int], str] = {}
        self.placements: list[Placement] = []
    def letter_at(self, r, c):
        return self.cells.get((r, c))
    def can_place(self, p: Placement) -> bool:
        cells = p.cells()
        if p.direction == ACROSS:
            before, after = (p.row, p.col - 1), (p.row, p.col + len(p.word))
        else:
            before, after = (p.row - 1, p.col), (p.row + len(p.word), p.col)
        if self.letter_at(*before) is not None or self.letter_at(*after) is not None:
            return False
        crossings = 0
        for i, (r, c) in enumerate(cells):
            existing = self.letter_at(r, c)
            if existing is not None:
                if existing != p.word[i]:
                    return False
                crossings += 1
            else:
                if p.direction == ACROSS:
                    side_a, side_b = self.letter_at(r - 1, c), self.letter_at(r + 1, c)
                else:
                    side_a, side_b = self.letter_at(r, c - 1), self.letter_at(r, c + 1)
                if side_a is not None or side_b is not None:
                    return False
        if self.placements and crossings == 0:
            return False
        return True
    def place(self, p: Placement):
        for i, (r, c) in enumerate(p.cells()):
            self.cells[(r, c)] = p.word[i]
        self.placements.append(p)
    def _maximal_runs(self):
        filled = set(self.cells.keys())
        runs = []
        for (r, c) in filled:
            if (r, c - 1) not in filled:
                run, cc = [(r, c)], c + 1
                while (r, cc) in filled:
                    run.append((r, cc)); cc += 1
                if len(run) >= 2:
                    runs.append((tuple(run), ACROSS))
        for (r, c) in filled:
            if (r - 1, c) not in filled:
                run, rr = [(r, c)], r + 1
                while (rr, c) in filled:
                    run.append((rr, c)); rr += 1
                if len(run) >= 2:
                    runs.append((tuple(run), DOWN))
        return runs
    def validate_no_phantoms(self) -> bool:
        placed = {(tuple(p.cells()), p.direction) for p in self.placements}
        return all((run, d) in placed for run, d in self._maximal_runs())
    def validate_connected(self) -> bool:
        if not self.placements:
            return False
        cellsets = [set(p.cells()) for p in self.placements]
        seen, stack = {0}, [0]
        while stack:
            i = stack.pop()
            for j in range(len(cellsets)):
                if j not in seen and cellsets[i] & cellsets[j]:
                    seen.add(j); stack.append(j)
        return len(seen) == len(cellsets)

def _candidate_placements(grid: Grid, word: str):
    out = []
    for (r, c), letter in grid.cells.items():
        for i, ch in enumerate(word):
            if ch == letter:
                out.append(Placement(word, "", None, r, c - i, ACROSS))
                out.append(Placement(word, "", None, r - i, c, DOWN))
    return out

def _fits_dim(grid: Grid, cand: Placement, max_dim: int) -> bool:
    rs = [r for r, _ in grid.cells] + [r for r, _ in cand.cells()]
    cs = [c for _, c in grid.cells] + [c for _, c in cand.cells()]
    return (max(rs) - min(rs) + 1) <= max_dim and (max(cs) - min(cs) + 1) <= max_dim

def build_grid(candidates, cfg: LevelConfig, rng: random.Random) -> Optional[Grid]:
    words = [dict(w) for w in candidates]
    rng.shuffle(words)
    words.sort(key=lambda w: len(w["word"]), reverse=True)
    grid = Grid()
    first = words[0]
    grid.place(Placement(first["word"], first["clue_text"], first.get("bank_id"), 0, 0, ACROSS))
    placed = {first["word"]}
    progress = True
    while progress and len(grid.placements) < cfg.target_words:
        progress = False
        for w in words:
            if w["word"] in placed or len(grid.placements) >= cfg.target_words:
                continue
            best, best_cross = None, -1
            for cand in _candidate_placements(grid, w["word"]):
                cand.clue_text, cand.bank_id = w["clue_text"], w.get("bank_id")
                if not grid.can_place(cand) or not _fits_dim(grid, cand, cfg.max_dim):
                    continue
                crossings = sum(1 for (r, c) in cand.cells() if grid.letter_at(r, c) is not None)
                if crossings > best_cross:
                    best, best_cross = cand, crossings
            if best is not None:
                grid.place(best); placed.add(w["word"]); progress = True
    if len(grid.placements) < cfg.min_words:
        return None
    if not grid.validate_no_phantoms() or not grid.validate_connected():
        return None
    return grid

def serialize(grid: Grid):
    rs = [r for r, _ in grid.cells]; cs = [c for _, c in grid.cells]
    r0, c0 = min(rs), min(cs)
    rows, cols = max(rs) - r0 + 1, max(cs) - c0 + 1
    norm = {(r - r0, c - c0): l for (r, c), l in grid.cells.items()}
    placements = [Placement(p.word, p.clue_text, p.bank_id, p.row - r0, p.col - c0, p.direction)
                  for p in grid.placements]
    def starts_across(r, c):
        return (r, c) in norm and (r, c - 1) not in norm and (r, c + 1) in norm
    def starts_down(r, c):
        return (r, c) in norm and (r - 1, c) not in norm and (r + 1, c) in norm
    number_at, n = {}, 0
    for r in range(rows):
        for c in range(cols):
            if starts_across(r, c) or starts_down(r, c):
                n += 1; number_at[(r, c)] = n
    grid_json = []
    for r in range(rows):
        row = []
        for c in range(cols):
            if (r, c) not in norm:
                row.append({"blocked": True})
            elif (r, c) in number_at:
                row.append({"num": number_at[(r, c)], "letter": norm[(r, c)]})
            else:
                row.append({"letter": norm[(r, c)]})
        grid_json.append(row)
    clues_json = [{"num": number_at[(p.row, p.col)], "dir": p.direction,
                   "row": p.row, "col": p.col, "answer": p.word, "length": len(p.word),
                   "bank_id": p.bank_id, "clue_text": p.clue_text} for p in placements]
    clues_json.sort(key=lambda x: (x["num"], 0 if x["dir"] == ACROSS else 1))
    star = max(placements, key=lambda p: len(p.word)).word
    return grid_json, clues_json, rows, cols, star

def generate_puzzle(candidates, language, level, rng=None, attempts=120):
    cfg = LEVEL_CONFIGS[(language, level)]
    rng = rng or random.Random()
    best = None
    for _ in range(attempts):
        pool = list(candidates); rng.shuffle(pool)
        grid = build_grid(pool, cfg, rng)
        if grid is None:
            continue
        if best is None or len(grid.placements) > len(best.placements):
            best = grid
            if len(best.placements) >= cfg.target_words:
                break
    if best is None:
        return None
    g, cl, rows, cols, star = serialize(best)
    return {"language": language, "level": level, "grid": g, "clues": cl,
            "grid_rows": rows, "grid_cols": cols, "star_word": star,
            "words_used": [p.word for p in best.placements]}