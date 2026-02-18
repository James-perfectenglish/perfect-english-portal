import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// REUSABLE MEMORY GAME TEMPLATE
//
// Usage:
//   import MemoryGame from "./MemoryGame";
//   import { BORRAS_CARDS } from "./BorrasFlashcards";
//
//   <MemoryGame
//     title="Borrás Memory"
//     cardBackImage="/og-image.png"   ← your card back image
//     cards={BORRAS_CARDS}
//     accentColour="#7c3aed"
//     onBack={() => ...}
//   />
//
// cards prop: array of { id, word, spanish, roundName, round }
// Each round that has <= 6 items gets its own 4x3 memory board.
// ─────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build flat tile list from a set of 6 card-data objects
// Each pair: English tile + Spanish tile
function buildTiles(cardSet) {
  const tiles = [];
  cardSet.forEach((card) => {
    tiles.push({ tileId: `eng-${card.id}`, pairId: card.id, type: "english", text: card.word, pos: card.partOfSpeech });
    tiles.push({ tileId: `spa-${card.id}`, pairId: card.id, type: "spanish", text: card.spanish, pos: card.partOfSpeech });
  });
  return shuffle(tiles);
}

const POS_ACCENT = {
  noun: "#0891b2",
  verb: "#059669",
  adjective: "#d97706",
};

// ─────────────────────────────────────────────────────────────
// MEMORY BOARD — one round at a time
// ─────────────────────────────────────────────────────────────
function MemoryBoard({ cardSet, accentColour, cardBackImage, onComplete }) {
  const [tiles, setTiles] = useState(() => buildTiles(cardSet));
  const [flipped, setFlipped] = useState([]); // tileIds currently face-up (not matched)
  const [matched, setMatched] = useState(new Set()); // pairIds that are matched
  const [locked, setLocked] = useState(false);
  const [moves, setMoves] = useState(0);
  const [shake, setShake] = useState(null); // tileId to shake on mismatch

  const allMatched = matched.size === cardSet.length;

  useEffect(() => {
    if (flipped.length === 2) {
      setLocked(true);
      setMoves((m) => m + 1);
      const [a, b] = flipped.map((id) => tiles.find((t) => t.tileId === id));
      if (a.pairId === b.pairId) {
        // Match!
        setTimeout(() => {
          setMatched((prev) => new Set([...prev, a.pairId]));
          setFlipped([]);
          setLocked(false);
        }, 500);
      } else {
        // No match — shake briefly then flip back
        setShake(a.tileId);
        setTimeout(() => {
          setShake(null);
          setFlipped([]);
          setLocked(false);
        }, 900);
      }
    }
  }, [flipped, tiles]);

  function handleTile(tile) {
    if (locked) return;
    if (matched.has(tile.pairId)) return;
    if (flipped.includes(tile.tileId)) return;
    if (flipped.length >= 2) return;
    setFlipped((prev) => [...prev, tile.tileId]);
  }

  function reset() {
    setTiles(buildTiles(cardSet));
    setFlipped([]);
    setMatched(new Set());
    setLocked(false);
    setMoves(0);
  }

  const isFaceUp = (tile) => flipped.includes(tile.tileId) || matched.has(tile.pairId);
  const isMatched = (tile) => matched.has(tile.pairId);

  // Determine grid columns: 4 cols for 12 tiles (6 pairs), 4 cols for 10, adjust for small sets
  const cols = tiles.length <= 6 ? 3 : 4;

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "0.8rem",
      }}>
        <span style={{ fontSize: "0.78rem", color: "#888" }}>
          {matched.size}/{cardSet.length} matched
        </span>
        <span style={{
          fontWeight: 700, fontSize: "0.78rem",
          color: accentColour,
        }}>
          {moves} move{moves !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "clamp(6px, 2vw, 10px)",
      }}>
        {tiles.map((tile) => {
          const faceUp = isFaceUp(tile);
          const tileMatched = isMatched(tile);
          const posColour = POS_ACCENT[tile.pos] || accentColour;

          return (
            <div
              key={tile.tileId}
              onClick={() => handleTile(tile)}
              style={{
                perspective: 600,
                cursor: tileMatched ? "default" : "pointer",
                aspectRatio: "3/4",
                animation: shake === tile.tileId ? "shake 0.4s ease" : "none",
              }}
            >
              <div style={{
                width: "100%", height: "100%",
                position: "relative",
                transformStyle: "preserve-3d",
                transition: "transform 0.4s cubic-bezier(0.4,0.2,0.2,1)",
                transform: faceUp ? "rotateY(180deg)" : "rotateY(0deg)",
              }}>
                {/* Card back (face-down) */}
                <div style={{
                  position: "absolute", inset: 0,
                  backfaceVisibility: "hidden",
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}>
                  {cardBackImage ? (
                    <img
                      src={cardBackImage}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      background: `linear-gradient(135deg, ${accentColour}, ${accentColour}99)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: "1.5rem" }}>🚿</span>
                    </div>
                  )}
                </div>

                {/* Card front (face-up) */}
                <div style={{
                  position: "absolute", inset: 0,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  borderRadius: 10,
                  background: tileMatched
                    ? `linear-gradient(135deg, ${posColour}22, ${posColour}11)`
                    : tile.type === "english" ? "#fff" : "#fdf6ff",
                  border: `2px solid ${tileMatched ? posColour : tile.type === "english" ? "#ddd" : accentColour + "55"}`,
                  boxShadow: tileMatched ? `0 0 0 3px ${posColour}44` : "0 2px 8px rgba(0,0,0,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.3rem 0.2rem",
                  gap: "0.2rem",
                  textAlign: "center",
                  transition: "box-shadow 0.2s",
                }}>
                  {tileMatched && (
                    <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>✓</span>
                  )}
                  <span style={{
                    fontSize: tile.text.length > 12 ? "0.6rem" : "0.72rem",
                    fontWeight: 700,
                    color: tileMatched ? posColour : tile.type === "english" ? "#1a1a2e" : accentColour,
                    lineHeight: 1.2,
                  }}>
                    {tile.text}
                  </span>
                  {!tileMatched && (
                    <span style={{
                      fontSize: "0.55rem",
                      color: "#bbb",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}>
                      {tile.type === "english" ? "EN" : "ES"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed message */}
      {allMatched && (
        <div style={{
          marginTop: "1.2rem",
          background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
          border: "2px solid #10b981",
          borderRadius: 14,
          padding: "1rem",
          textAlign: "center",
        }}>
          <p style={{ margin: 0, fontWeight: 800, color: "#065f46", fontSize: "1rem" }}>
            🎉 Excellent! All matched in {moves} moves!
          </p>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem", justifyContent: "center" }}>
            <button onClick={reset} style={{
              background: "#10b981", color: "#fff", border: "none",
              borderRadius: 10, padding: "0.5rem 1rem",
              fontWeight: 700, cursor: "pointer", fontSize: "0.82rem",
            }}>
              Play again
            </button>
            {onComplete && (
              <button onClick={onComplete} style={{
                background: accentColour, color: "#fff", border: "none",
                borderRadius: 10, padding: "0.5rem 1rem",
                fontWeight: 700, cursor: "pointer", fontSize: "0.82rem",
              }}>
                Next round →
              </button>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT — full-page memory game with round selector
// ─────────────────────────────────────────────────────────────
export default function MemoryGame({
  title = "Memory Game",
  cards = [],           // full card array (e.g. BORRAS_CARDS)
  accentColour = "#7c3aed",
  cardBackImage = "/og-image.png",
  maxPerRound = 6,      // how many pairs per board (default 6 = 4x3 grid)
  onBack,
}) {
  // Group cards by round
  const rounds = [...new Set(cards.map((c) => c.round))];

  const [selectedRound, setSelectedRound] = useState(rounds[0] || 1);
  const [boardKey, setBoardKey] = useState(0); // force remount on round change

  // Get cards for selected round, capped at maxPerRound
  const roundCards = cards
    .filter((c) => c.round === selectedRound)
    .slice(0, maxPerRound);

  const roundName = roundCards[0]?.roundName || `Round ${selectedRound}`;

  function goToRound(r) {
    setSelectedRound(r);
    setBoardKey((k) => k + 1);
  }

  function goNext() {
    const idx = rounds.indexOf(selectedRound);
    if (idx < rounds.length - 1) goToRound(rounds[idx + 1]);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f2fb",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${accentColour}, ${accentColour}cc)`,
        padding: "clamp(1rem,3vw,1.6rem) 1rem 1rem",
      }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: "rgba(255,255,255,0.18)", border: "none",
              color: "#fff", padding: "5px 12px", borderRadius: 20,
              cursor: "pointer", fontSize: "0.78rem", marginBottom: "0.6rem",
              display: "block",
            }}>
              ← Back
            </button>
          )}
          <h1 style={{
            margin: 0, color: "#fff",
            fontSize: "clamp(1.1rem,4vw,1.5rem)", fontWeight: 800,
          }}>
            {title}
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.8rem" }}>
            Match the English word to its Spanish translation
          </p>
        </div>
      </div>

      {/* ── ROUND TABS ── */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e8e4f5",
        overflowX: "auto",
      }}>
        <div style={{
          maxWidth: 500, margin: "0 auto",
          display: "flex", gap: "0.3rem",
          padding: "0.5rem 1rem",
          whiteSpace: "nowrap",
        }}>
          {rounds.map((r) => {
            const name = cards.find((c) => c.round === r)?.roundName;
            const isActive = r === selectedRound;
            return (
              <button
                key={r}
                onClick={() => goToRound(r)}
                style={{
                  background: isActive ? accentColour : "transparent",
                  color: isActive ? "#fff" : "#666",
                  border: `1.5px solid ${isActive ? accentColour : "#ddd"}`,
                  borderRadius: 20, padding: "4px 12px",
                  fontSize: "0.7rem", fontWeight: 600,
                  cursor: "pointer", flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {r}. {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BOARD ── */}
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "1rem" }}>
        <div style={{
          background: "#fff",
          borderRadius: 16,
          padding: "1rem",
          boxShadow: "0 2px 16px rgba(124,58,237,0.08)",
          marginBottom: "0.8rem",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "0.8rem",
          }}>
            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#1a1a2e" }}>
              Round {selectedRound}: {roundName}
            </span>
            <span style={{
              background: "#f5f3ff", color: accentColour,
              fontSize: "0.7rem", fontWeight: 700,
              padding: "3px 10px", borderRadius: 20,
            }}>
              {roundCards.length} pairs
            </span>
          </div>
          <MemoryBoard
            key={boardKey}
            cardSet={roundCards}
            accentColour={accentColour}
            cardBackImage={cardBackImage}
            onComplete={rounds.indexOf(selectedRound) < rounds.length - 1 ? goNext : null}
          />
        </div>

        {/* How to play */}
        <div style={{
          background: "#f5f3ff", borderRadius: 12,
          padding: "0.7rem 0.9rem",
          fontSize: "0.75rem", color: "#555", lineHeight: 1.6,
        }}>
          <strong style={{ color: accentColour }}>How to play:</strong> Tap a card to flip it. Find the English word and its Spanish translation to make a pair. Match all {roundCards.length} pairs to complete the round!
        </div>
      </div>
    </div>
  );
}
