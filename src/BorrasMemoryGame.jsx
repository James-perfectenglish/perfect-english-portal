import MemoryGame from './MemoryGame';
import { BORRAS_CARDS } from './BorrasFlashcards';

export default function BorrasMemoryGame({ onBack }) {
  return (
    <MemoryGame
      title="Borrás Memory Game"
      subtitle="Match the English word to its Spanish translation 🚿"
      levelBadge="Level: A1–B1"
      cards={BORRAS_CARDS}
      cardBackImage="/og-image.png"
      maxPerRound={6}
      onBack={onBack}
    />
  );
}
