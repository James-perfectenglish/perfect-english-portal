import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// CARD DATA — add new cards here as the course progresses
// ─────────────────────────────────────────────────────────────
export const BORRAS_CARDS = [
  // ── ROUND 1 · The Bathroom ──────────────────────────────────
  {
    id: 1, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "bath",
    definition: "the large tub you lie in to wash your body",
    example: "This freestanding bath is our most popular model.",
    spanish: "la bañera",
  },
  {
    id: 2, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "wash basin",
    definition: "the bowl fixed to the wall where you wash your hands and face",
    example: "The wash basin in the showroom is made of white ceramic.",
    spanish: "el lavabo",
  },
  {
    id: 3, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "toilet",
    definition: "the bathroom fixture used for waste, with a seat and a flush",
    example: "This toilet has a soft-close seat and a silent flush.",
    spanish: "el inodoro / el váter",
  },
  {
    id: 4, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "mirror",
    definition: "the reflective glass panel fixed to a bathroom wall",
    example: "The mirror above the basin has a built-in LED light.",
    spanish: "el espejo",
  },
  {
    id: 5, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "tap",
    definition: "the device you turn or push to control the flow of water",
    example: "This tap is available in gold or brushed chrome.",
    spanish: "el grifo",
  },
  {
    id: 6, round: 1, roundName: "The Bathroom", partOfSpeech: "noun",
    word: "seat",
    definition: "the part of the toilet you sit on, usually with a soft-close cover",
    example: "The soft-close seat is included in the price.",
    spanish: "la tapa / el asiento",
  },

  // ── ROUND 2 · Shower & Storage ──────────────────────────────
  {
    id: 7, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "shower tray",
    definition: "the flat base of a shower where water collects and drains away",
    example: "The shower tray is made from a stone resin composite.",
    spanish: "el plato de ducha",
  },
  {
    id: 8, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "mixer tap",
    definition: "a single tap that blends hot and cold water to the right temperature",
    example: "The mixer tap has a long spout — perfect for filling the bath.",
    spanish: "el grifo mezclador / el monomando",
  },
  {
    id: 9, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "shower screen",
    definition: "the glass panel that keeps water inside the shower area",
    example: "The shower screen is made of 8mm tempered glass.",
    spanish: "la mampara de ducha",
  },
  {
    id: 10, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "showerhead",
    definition: "the part at the top of the shower where water comes out",
    example: "This showerhead has five different spray settings.",
    spanish: "la alcachofa de ducha",
  },
  {
    id: 11, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "cabinet",
    definition: "a bathroom furniture unit with doors for storing towels and products",
    example: "The mirrored cabinet above the basin has two shelves inside.",
    spanish: "el armario / el mueble de baño",
  },
  {
    id: 12, round: 2, roundName: "Shower & Storage", partOfSpeech: "noun",
    word: "towel rail",
    definition: "a bar fixed to the wall for hanging towels — often heated",
    example: "The heated towel rail keeps your towels warm and dry.",
    spanish: "el toallero (calefactado)",
  },

  // ── ROUND 3 · Technical ─────────────────────────────────────
  {
    id: 13, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "plug",
    definition: "a rubber or metal stopper that blocks the drain in a bath or basin",
    example: "The plug in the basin was missing when we arrived.",
    spanish: "el tapón",
  },
  {
    id: 14, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "overflow",
    definition: "the small hole near the top of a bath or basin that prevents flooding",
    example: "The overflow stopped the bath from flooding the bathroom floor.",
    spanish: "el rebosadero",
  },
  {
    id: 15, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "fittings",
    definition: "all the fixed items in a bathroom — taps, pipes, connectors and valves",
    example: "All the fittings in this bathroom suite are brushed gold.",
    spanish: "la grifería / los accesorios",
  },
  {
    id: 16, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "flooring",
    definition: "the material used to cover the floor of a room",
    example: "The flooring in the showroom is large-format Italian porcelain.",
    spanish: "el suelo / el pavimento",
  },
  {
    id: 17, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "heater",
    definition: "a device that produces warmth — in a bathroom, often a towel rail or underfloor system",
    example: "We installed underfloor heating as the main heater in the bathroom.",
    spanish: "el calentador / el radiador",
  },
  {
    id: 18, round: 3, roundName: "Technical", partOfSpeech: "noun",
    word: "tile",
    definition: "a flat piece of ceramic or stone used to cover walls or floors",
    example: "These tiles come from a factory in Castellón.",
    spanish: "el azulejo (pared) / la baldosa (suelo)",
  },

  // ── ROUND 4 · Business ──────────────────────────────────────
  {
    id: 19, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "order",
    definition: "a request for goods — from a client to the showroom, or from the showroom to a supplier",
    example: "Your order will arrive at the showroom on Friday.",
    spanish: "el pedido",
  },
  {
    id: 20, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "return",
    definition: "when a client sends a product back because it is damaged or not correct",
    example: "We processed the return and sent a replacement the same day.",
    spanish: "la devolución",
  },
  {
    id: 21, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "invoice",
    definition: "an official document requesting payment for goods or services",
    example: "I will send the invoice by email this afternoon.",
    spanish: "la factura",
  },
  {
    id: 22, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "leak",
    definition: "water or liquid that escapes from a pipe, joint or fitting",
    example: "There is a small leak under the basin — we need a plumber.",
    spanish: "la fuga / la gotera",
  },
  {
    id: 23, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "accessory",
    definition: "a small decorative or functional item that completes a bathroom design",
    example: "We sell accessories to match every tap range in the showroom.",
    spanish: "el accesorio",
  },
  {
    id: 24, round: 4, roundName: "Business", partOfSpeech: "noun",
    word: "complaint",
    definition: "when a client formally tells you they are unhappy with a product or service",
    example: "We received a complaint about the delivery — the bath arrived damaged.",
    spanish: "la queja / la reclamación",
  },

  // ── ROUND 5 · Action! (Verbs) ───────────────────────────────
  {
    id: 25, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to fit",
    definition: "to install something in position — regular verb (fitted / fitted)",
    example: "We fitted the new shower tray on Tuesday.",
    spanish: "instalar / colocar",
  },
  {
    id: 26, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to order",
    definition: "to request goods from a supplier — regular verb (ordered / ordered)",
    example: "We ordered the cabinet last Monday — it arrives on Friday.",
    spanish: "pedir / encargar",
  },
  {
    id: 27, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to deliver",
    definition: "to bring goods to an address — regular verb (delivered / delivered)",
    example: "They delivered the bath to the hotel on Wednesday morning.",
    spanish: "entregar",
  },
  {
    id: 28, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to pay",
    definition: "to give money for goods or a service — irregular verb (paid / paid)",
    example: "The client paid the invoice yesterday — thank you!",
    spanish: "pagar",
  },
  {
    id: 29, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to change",
    definition: "to replace one item with a different one — regular verb (changed / changed)",
    example: "We changed the old tap for a new chrome one.",
    spanish: "cambiar",
  },
  {
    id: 30, round: 5, roundName: "Action!", partOfSpeech: "verb",
    word: "to complain",
    definition: "to tell someone you are unhappy — regular verb (complained / complained)",
    example: "The client complained about the colour of the tiles.",
    spanish: "quejarse / reclamar",
  },

  // ── ROUND 6 · More Verbs & Describing ──────────────────────
  {
    id: 31, round: 6, roundName: "More Verbs", partOfSpeech: "verb",
    word: "to leak",
    definition: "when water or liquid escapes from a pipe or fitting — regular verb (leaked / leaked)",
    example: "The tap was leaking overnight — the floor was wet.",
    spanish: "gotear / tener una fuga",
  },
  {
    id: 32, round: 6, roundName: "More Verbs", partOfSpeech: "verb",
    word: "to return",
    definition: "to send a product back to a supplier — regular verb (returned / returned)",
    example: "The client returned the basin because it was cracked.",
    spanish: "devolver",
  },
  {
    id: 33, round: 6, roundName: "More Verbs", partOfSpeech: "verb",
    word: "to tile",
    definition: "to cover a wall or floor surface with tiles — regular verb (tiled / tiled)",
    example: "The builders tiled the bathroom walls in white porcelain.",
    spanish: "alicatar / poner azulejos",
  },
  {
    id: 34, round: 6, roundName: "More Verbs", partOfSpeech: "verb",
    word: "to invoice",
    definition: "to send a bill to a client — regular verb (invoiced / invoiced)",
    example: "We invoiced the hotel after fitting all twelve bathrooms.",
    spanish: "facturar",
  },
  {
    id: 35, round: 6, roundName: "More Verbs", partOfSpeech: "adjective",
    word: "modern",
    definition: "new in design and style — not traditional or old-fashioned",
    example: "The client wanted a very modern look — no wood, no colour.",
    spanish: "moderno/a",
  },
  {
    id: 36, round: 6, roundName: "More Verbs", partOfSpeech: "adjective",
    word: "shiny",
    definition: "a very bright, reflective surface — like polished chrome or gloss tiles",
    example: "The shiny finish on these taps shows every fingerprint!",
    spanish: "brillante",
  },

  // ── ROUND 7 · How Does It Look? (Adjectives) ───────────────
  {
    id: 37, round: 7, roundName: "How Does It Look?", partOfSpeech: "adjective",
    word: "matt",
    definition: "a surface with absolutely no shine — the opposite of shiny",
    example: "Matt black taps are very fashionable right now.",
    spanish: "mate",
  },
  {
    id: 38, round: 7, roundName: "How Does It Look?", partOfSpeech: "adjective",
    word: "bright",
    definition: "giving a lot of light, or describing a strong, vivid colour",
    example: "The showroom looks very bright thanks to the large skylights.",
    spanish: "luminoso/a / vivo/a (colour)",
  },
  {
    id: 39, round: 7, roundName: "How Does It Look?", partOfSpeech: "adjective",
    word: "smooth",
    definition: "a surface that is completely flat and even — no rough parts at all",
    example: "Run your hand across the bath — the surface is perfectly smooth.",
    spanish: "liso/a / suave",
  },
];

// ─────────────────────────────────────────────────────────────
// PART OF SPEECH BADGE COLOURS
// ─────────────────────────────────────────────────────────────
const POS_COLOURS = {
  noun: { bg: "#e0f0ff", text: "#1a6aaa", border: "#b3d8f5" },
  verb: { bg: "#e8f8ee", text: "#1a7a42", border: "#a8e0bb" },
  adjective: { bg: "#fff3e0", text: "#a05000", border: "#ffd599" },
};

const ROUND_COLOURS = [
  "#7c3aed", // round 1
  "#0891b2", // round 2
  "#059669", // round 3
  "#d97706", // round 4
  "#db2777", // round 5
  "#7c3aed", // round 6
  "#0284c7", // round 7
];

// ─────────────────────────────────────────────────────────────
// SINGLE FLIP CARD
// ─────────────────────────────────────────────────────────────
function FlipCard({ card, accentColour }) {
  const [flipped, setFlipped] = useState(false);
  const pos = POS_COLOURS[card.partOfSpeech] || POS_COLOURS.noun;

  return (
    <div
      onClick={() => setFlipped((f) => !f)}
      style={{
        perspective: "1000px",
        cursor: "pointer",
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "62%",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))",
        }}
      >
        {/* ── FRONT (word) ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            borderRadius: 20,
            background: `linear-gradient(135deg, ${accentColour} 0%, ${accentColour}cc 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            boxSizing: "border-box",
          }}
        >
          <span style={{
            background: "rgba(255,255,255,0.22)",
            color: "#fff",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "3px 10px",
            borderRadius: 20,
            marginBottom: "0.75rem",
          }}>
            {card.partOfSpeech}
          </span>
          <span style={{
            color: "#fff",
            fontSize: "clamp(1.5rem, 5vw, 2.2rem)",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}>
            {card.word}
          </span>
          <span style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: "0.72rem",
            marginTop: "1rem",
            letterSpacing: "0.05em",
          }}>
            tap to reveal ↓
          </span>
        </div>

        {/* ── BACK (definition) ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 20,
            background: "#fff",
            border: `2px solid ${pos.border}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "1.2rem 1.4rem",
            boxSizing: "border-box",
            gap: "0.55rem",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            marginBottom: "0.2rem",
          }}>
            <span style={{
              background: pos.bg,
              color: pos.text,
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 12,
              border: `1px solid ${pos.border}`,
            }}>
              {card.partOfSpeech}
            </span>
            <span style={{ fontWeight: 800, fontSize: "1rem", color: "#1a1a2e" }}>
              {card.word}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: "0.82rem", color: "#333", lineHeight: 1.5 }}>
            {card.definition}
          </p>

          <div style={{
            background: "#f5f3ff",
            borderLeft: `3px solid ${accentColour}`,
            borderRadius: "0 8px 8px 0",
            padding: "0.4rem 0.6rem",
          }}>
            <span style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#444" }}>
              "{card.example}"
            </span>
          </div>

          <div style={{
            background: "#fdf6ec",
            borderRadius: 8,
            padding: "0.35rem 0.6rem",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}>
            <span style={{ fontSize: "0.7rem", color: "#a05000", fontWeight: 700 }}>🇪🇸</span>
            <span style={{ fontSize: "0.78rem", color: "#a05000", fontWeight: 600 }}>
              {card.spanish}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function BorrasFlashcards({ onBack }) {
  const rounds = [...new Set(BORRAS_CARDS.map((c) => c.round))];
  const [selectedRound, setSelectedRound] = useState("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardKey, setCardKey] = useState(0); // force re-mount to reset flip

  const filtered =
    selectedRound === "all"
      ? BORRAS_CARDS
      : BORRAS_CARDS.filter((c) => c.round === selectedRound);

  const roundName =
    selectedRound === "all"
      ? "All cards"
      : BORRAS_CARDS.find((c) => c.round === selectedRound)?.roundName;

  const accentColour = selectedRound === "all"
    ? "#7c3aed"
    : ROUND_COLOURS[(selectedRound - 1) % ROUND_COLOURS.length];

  const card = filtered[currentIndex];

  function goTo(idx) {
    setCurrentIndex(idx);
    setCardKey((k) => k + 1);
  }

  function prev() { goTo((currentIndex - 1 + filtered.length) % filtered.length); }
  function next() { goTo((currentIndex + 1) % filtered.length); }

  function changeRound(r) {
    setSelectedRound(r);
    setCurrentIndex(0);
    setCardKey((k) => k + 1);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f4f2fb", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(135deg, #7c3aed, #5b21b6)`,
        padding: "clamp(1.2rem,4vw,2rem) 1rem 1.2rem",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", padding: "6px 14px", borderRadius: 20,
              cursor: "pointer", fontSize: "0.8rem", marginBottom: "0.8rem",
              display: "block",
            }}>
              ← Back
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, color: "#fff", fontSize: "clamp(1.2rem,4vw,1.6rem)", fontWeight: 800 }}>
              Borrás Flashcards
            </h1>
            <span style={{
              background: "rgba(255,255,255,0.2)", color: "#fff",
              fontSize: "0.72rem", padding: "3px 10px", borderRadius: 20,
              fontWeight: 600, letterSpacing: "0.06em",
            }}>
              {filtered.length} cards · {roundName}
            </span>
          </div>
          <p style={{ margin: "0.4rem 0 0", color: "rgba(255,255,255,0.75)", fontSize: "0.82rem" }}>
            Bathroom vocabulary in context 🚿
          </p>
        </div>
      </div>

      {/* ── ROUND FILTER ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e8e4f5", overflowX: "auto" }}>
        <div style={{
          maxWidth: 600, margin: "0 auto",
          display: "flex", gap: "0.3rem",
          padding: "0.6rem 1rem",
          whiteSpace: "nowrap",
        }}>
          <RoundButton label="All" active={selectedRound === "all"} colour="#7c3aed"
            onClick={() => changeRound("all")} />
          {rounds.map((r) => {
            const name = BORRAS_CARDS.find((c) => c.round === r)?.roundName;
            return (
              <RoundButton key={r} label={`${r}. ${name}`}
                active={selectedRound === r}
                colour={ROUND_COLOURS[(r - 1) % ROUND_COLOURS.length]}
                onClick={() => changeRound(r)}
              />
            );
          })}
        </div>
      </div>

      {/* ── CARD AREA ── */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "1.5rem 1rem" }}>

        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#7c3aed", fontWeight: 700 }}>
            {currentIndex + 1} / {filtered.length}
          </span>
          <div style={{ flex: 1, margin: "0 0.8rem", height: 4, background: "#e8e4f5", borderRadius: 4 }}>
            <div style={{
              width: `${((currentIndex + 1) / filtered.length) * 100}%`,
              height: "100%", background: accentColour, borderRadius: 4,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: "0.78rem", color: "#888" }}>
            {card?.partOfSpeech}
          </span>
        </div>

        {/* The card */}
        {card && <FlipCard key={cardKey} card={card} accentColour={accentColour} />}

        {/* Nav buttons */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.4rem" }}>
          <NavBtn onClick={prev} label="← Previous" />
          <NavBtn onClick={next} label="Next →" primary accentColour={accentColour} />
        </div>

        {/* Card dots */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "6px",
          justifyContent: "center", marginTop: "1.2rem",
        }}>
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => goTo(i)}
              title={c.word}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                border: "none", cursor: "pointer", padding: 0,
                background: i === currentIndex ? accentColour : "#d4c8f5",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Hint */}
        <p style={{ textAlign: "center", color: "#aaa", fontSize: "0.72rem", marginTop: "1rem" }}>
          Tap the card to flip it
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────
function RoundButton({ label, active, colour, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? colour : "transparent",
      color: active ? "#fff" : "#666",
      border: `1.5px solid ${active ? colour : "#ddd"}`,
      borderRadius: 20, padding: "4px 12px",
      fontSize: "0.72rem", fontWeight: 600,
      cursor: "pointer", transition: "all 0.2s",
      flexShrink: 0,
    }}>
      {label}
    </button>
  );
}

function NavBtn({ onClick, label, primary, accentColour }) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      background: primary ? accentColour : "#fff",
      color: primary ? "#fff" : "#555",
      border: primary ? "none" : "1.5px solid #ddd",
      borderRadius: 12, padding: "0.75rem",
      fontSize: "0.88rem", fontWeight: 700,
      cursor: "pointer", transition: "opacity 0.2s",
    }}>
      {label}
    </button>
  );
}
