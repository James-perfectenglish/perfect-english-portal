import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function VerbsFlashcards({ flashcardSetId, onBack }) {
  const [flashcardSet, setFlashcardSet] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());
  const [learningCards, setLearningCards] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    fetchFlashcards();
  }, [flashcardSetId]);

  const fetchFlashcards = async () => {
    try {
      const { data, error } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', flashcardSetId)
        .single();

      if (error) throw error;

      setFlashcardSet(data);
      setCards(data.card_data.cards);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      setLoading(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKnowIt = () => {
    const cardId = cards[currentIndex].id;
    setKnownCards(prev => new Set([...prev, cardId]));
    learningCards.delete(cardId);
    setIsFlipped(false);
  };

  const handleStillLearning = () => {
    const cardId = cards[currentIndex].id;
    setLearningCards(prev => new Set([...prev, cardId]));
    setIsFlipped(false);
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      setFinished(true);
      saveProgress();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  // Swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isRightSwipe) {
      handlePrevious();
    }
    if (isLeftSwipe) {
      handleNext();
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnownCards(new Set());
    setLearningCards(new Set());
    setFinished(false);
  };

  const saveProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('flashcard_progress')
        .upsert({
          student_id: user.id,
          flashcard_set_id: flashcardSetId,
          known_cards: Array.from(knownCards),
          learning_cards: Array.from(learningCards),
          last_practiced: new Date().toISOString()
        }, {
          onConflict: 'student_id,flashcard_set_id'
        });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading flashcards...</div>;
  }

  if (!flashcardSet) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Flashcard set not found</div>;
  }

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const learnedCount = knownCards.size;

  return (
    <div style={{ 
      width: '100vw',
      minHeight: '100vh',
      backgroundColor: '#f8f9fa',
      boxSizing: 'border-box',
      position: 'relative',
      left: '50%',
      right: '50%',
      marginLeft: '-50vw',
      marginRight: '-50vw'
    }}>
      <div style={{
        padding: '1rem',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
          borderRadius: '12px', 
          padding: '2rem', 
          textAlign: 'center', 
          color: 'white',
          marginBottom: '2rem'
        }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: '700' }}>
            {flashcardSet.title}
          </h1>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>
            {flashcardSet.description}
          </p>
          <span style={{ 
            display: 'inline-block', 
            background: '#48bb78', 
            padding: '4px 12px', 
            borderRadius: '20px', 
            fontSize: '0.85rem', 
            fontWeight: 600, 
            marginTop: '0.5rem' 
          }}>
            Level: {flashcardSet.level}
          </span>
        </div>

        {!finished ? (
          <>
            {/* Progress Bar */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem',
              fontSize: 'clamp(0.9rem, 3vw, 1rem)',
              color: '#4a5568',
              fontWeight: '500'
            }}>
              <span>{learnedCount} of {totalCards} learned</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleShuffle}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  🔀 Shuffle
                </button>
                <button 
                  onClick={handleReset}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#4a5568',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                >
                  ↻ Reset
                </button>
              </div>
            </div>

            {/* Card Counter */}
            <div style={{ 
              textAlign: 'center', 
              fontSize: 'clamp(1rem, 3vw, 1.2rem)', 
              color: '#4a5568',
              fontWeight: '600',
              marginBottom: '1rem'
            }}>
              {currentIndex + 1} / {totalCards}
            </div>

            {/* Flashcard with 3D flip */}
            <div
              style={{
                perspective: '1000px',
                marginBottom: '1.5rem'
              }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <div
                onClick={handleFlip}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: '350px',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  cursor: 'pointer'
                }}
              >
                {/* Front of card */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: 'clamp(3rem, 10vw, 5rem) clamp(2rem, 5vw, 3rem)',
                  minHeight: '350px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: 'white',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  boxSizing: 'border-box'
                }}>
                  <div style={{ 
                    fontSize: 'clamp(0.9rem, 3vw, 1rem)', 
                    fontWeight: '600', 
                    opacity: 0.9,
                    marginBottom: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                  }}>
                    {currentCard.front.language || 'ENGLISH'}
                  </div>
                  <div style={{ 
                    fontSize: 'clamp(2.5rem, 8vw, 4rem)', 
                    fontWeight: '700',
                    marginBottom: '0.5rem'
                  }}>
                    {currentCard.front.infinitive || currentCard.front.word}
                  </div>
                  {currentCard.front.pronunciation && (
                    <div style={{ 
                      fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', 
                      opacity: 0.8,
                      fontStyle: 'italic'
                    }}>
                      {currentCard.front.pronunciation}
                    </div>
                  )}
                  {currentCard.front.example && (
                    <div style={{ 
                      fontSize: 'clamp(1rem, 3vw, 1.2rem)', 
                      opacity: 0.9,
                      marginTop: '1rem'
                    }}>
                      {currentCard.front.example}
                    </div>
                  )}
                </div>

                {/* Back of card */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: 'clamp(3rem, 10vw, 5rem) clamp(2rem, 5vw, 3rem)',
                  minHeight: '350px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: '#667eea',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  border: '3px solid #667eea',
                  boxSizing: 'border-box'
                }}>
                  {currentCard.back.past_simple && (
                    <>
                      <div style={{ 
                        fontSize: 'clamp(0.9rem, 3vw, 1rem)', 
                        fontWeight: '600', 
                        opacity: 0.7,
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '2px'
                      }}>
                        PAST SIMPLE
                      </div>
                      <div style={{ 
                        fontSize: 'clamp(2rem, 6vw, 3rem)', 
                        fontWeight: '700',
                        marginBottom: '2rem',
                        color: '#764ba2'
                      }}>
                        {currentCard.back.past_simple}
                      </div>
                      <div style={{ 
                        fontSize: 'clamp(0.9rem, 3vw, 1rem)', 
                        fontWeight: '600', 
                        opacity: 0.7,
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '2px'
                      }}>
                        PAST PARTICIPLE
                      </div>
                      <div style={{ 
                        fontSize: 'clamp(2rem, 6vw, 3rem)', 
                        fontWeight: '700',
                        marginBottom: '2rem',
                        color: '#764ba2'
                      }}>
                        {currentCard.back.past_participle}
                      </div>
                    </>
                  )}
                  {currentCard.back.translation && (
                    <div style={{ 
                      fontSize: 'clamp(1.5rem, 5vw, 2rem)', 
                      fontWeight: '600',
                      marginBottom: '1rem',
                      color: '#764ba2'
                    }}>
                      {currentCard.back.translation}
                    </div>
                  )}
                  {currentCard.back.example && (
                    <div style={{ 
                      fontSize: 'clamp(1rem, 3vw, 1.2rem)', 
                      color: '#4a5568',
                      fontStyle: 'italic'
                    }}>
                      "{currentCard.back.example}"
                    </div>
                  )}
                  {currentCard.back.explanation && (
                    <div style={{ 
                      fontSize: 'clamp(0.9rem, 3vw, 1rem)', 
                      color: '#718096',
                      marginTop: '1rem',
                      maxWidth: '90%'
                    }}>
                      {currentCard.back.explanation}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ 
              textAlign: 'center', 
              fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', 
              color: '#718096',
              marginBottom: '1.5rem'
            }}>
              💡 Click/tap card to flip • Swipe to navigate
            </div>

            {/* Navigation Buttons */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '1rem',
              gap: '1rem'
            }}>
              <button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                style={{
                  padding: '1rem 1.5rem',
                  fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  backgroundColor: currentIndex === 0 ? '#cbd5e0' : '#4a5568',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                  flex: 1
                }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                style={{
                  padding: '1rem 1.5rem',
                  fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  flex: 1
                }}
              >
                {currentIndex === totalCards - 1 ? 'Finish' : 'Next →'}
              </button>
            </div>

            {/* Know It / Still Learning Buttons */}
            {isFlipped && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1rem',
                marginTop: '1rem'
              }}>
                <button
                  onClick={handleStillLearning}
                  style={{
                    padding: '1.2rem',
                    fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                    backgroundColor: '#ed8936',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(237, 137, 54, 0.3)'
                  }}
                >
                  📚 Still Learning
                </button>
                <button
                  onClick={handleKnowIt}
                  style={{
                    padding: '1.2rem',
                    fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                    backgroundColor: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    boxShadow: '0 4px 12px rgba(72, 187, 120, 0.3)'
                  }}
                >
                  ✅ Know It!
                </button>
              </div>
            )}
          </>
        ) : (
          /* Finished Screen */
          <div style={{
            backgroundColor: 'white',
            padding: 'clamp(2rem, 6vw, 3rem)',
            borderRadius: '16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            textAlign: 'center'
          }}>
            <h2 style={{ 
              fontSize: 'clamp(1.8rem, 6vw, 2.2rem)',
              color: '#2C3E50',
              marginBottom: '1rem'
            }}>
              🎉 Complete!
            </h2>
            <div style={{ 
              fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', 
              color: '#4a5568',
              marginBottom: '2rem'
            }}>
              You've reviewed all {totalCards} cards!
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#f0fff4',
                borderRadius: '12px',
                border: '2px solid #48bb78'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#48bb78' }}>
                  {knownCards.size}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Know It</div>
              </div>
              <div style={{
                padding: '1.5rem',
                backgroundColor: '#fffaf0',
                borderRadius: '12px',
                border: '2px solid #ed8936'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ed8936' }}>
                  {learningCards.size}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Still Learning</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleReset}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                Review Again
              </button>
              <button
                onClick={onBack}
                style={{
                  padding: '1rem 2rem',
                  backgroundColor: '#4a5568',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                Back to Exercises
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerbsFlashcards;