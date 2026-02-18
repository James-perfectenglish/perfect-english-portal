import MemoryGame from "./MemoryGame";
import { BORRAS_CARDS } from "./BorrasFlashcards";

export default function BorrasMemoryGame({ onBack }) {
  return (
    <MemoryGame
      title="Borrás Memory Game 🚿"
      cards={BORRAS_CARDS}
      accentColour="#7c3aed"
      cardBackImage="/og-image.png"
      maxPerRound={6}
      onBack={onBack}
    />
  );
}
