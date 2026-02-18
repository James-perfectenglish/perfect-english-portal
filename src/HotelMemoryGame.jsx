import MemoryGame from './MemoryGame';
import { HOTEL_CARDS } from './HotelFlashcards';

export default function HotelMemoryGame({ onBack }) {
  return (
    <MemoryGame
      title="Hotel Memory Game"
      subtitle="Match the English word to its Spanish translation 🏨"
      levelBadge="Level: A2"
      cards={HOTEL_CARDS}
      cardBackImage="/og-image.png"
      maxPerRound={6}
      onBack={onBack}
    />
  );
}
