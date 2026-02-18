import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
// CARD DATA — add new cards here as the course progresses
// ─────────────────────────────────────────────────────────────
export const BORRAS_CARDS = [
  // ── ROUND 1 · The Bathroom
  { id: 1, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'bath', definition: 'The large tub you lie in to wash your body.', example: 'This freestanding bath is our most popular model.', spanish: 'la bañera' },
  { id: 2, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'wash basin', definition: 'The bowl fixed to the wall where you wash your hands and face.', example: 'The wash basin in the showroom is made of white ceramic.', spanish: 'el lavabo' },
  { id: 3, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'toilet', definition: 'The bathroom fixture used for waste, with a seat and a flush.', example: 'This toilet has a soft-close seat and a silent flush.', spanish: 'el inodoro / el váter' },
  { id: 4, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'mirror', definition: 'The reflective glass panel fixed to a bathroom wall.', example: 'The mirror above the basin has a built-in LED light.', spanish: 'el espejo' },
  { id: 5, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'tap', definition: 'The device you turn or push to control the flow of water.', example: 'This tap is available in gold or brushed chrome.', spanish: 'el grifo' },
  { id: 6, round: 1, roundName: 'The Bathroom', partOfSpeech: 'noun', word: 'seat', definition: 'The part of the toilet you sit on, usually with a soft-close cover.', example: 'The soft-close seat is included in the price.', spanish: 'la tapa / el asiento' },

  // ── ROUND 2 · Shower & Storage
  { id: 7, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'shower tray', definition: 'The flat base of a shower where water collects and drains away.', example: 'The shower tray is made from a stone resin composite.', spanish: 'el plato de ducha' },
  { id: 8, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'mixer tap', definition: 'A single tap that blends hot and cold water to the right temperature.', example: 'The mixer tap has a long spout — perfect for filling the bath.', spanish: 'el grifo mezclador / el monomando' },
  { id: 9, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'shower screen', definition: 'The glass panel that keeps water inside the shower area.', example: 'The shower screen is made of 8mm tempered glass.', spanish: 'la mampara de ducha' },
  { id: 10, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'showerhead', definition: 'The part at the top of the shower where water comes out.', example: 'This showerhead has five different spray settings.', spanish: 'la alcachofa de ducha' },
  { id: 11, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'cabinet', definition: 'A bathroom furniture unit with doors for storing towels and products.', example: 'The mirrored cabinet above the basin has two shelves inside.', spanish: 'el armario / el mueble de baño' },
  { id: 12, round: 2, roundName: 'Shower & Storage', partOfSpeech: 'noun', word: 'towel rail', definition: 'A bar fixed to the wall for hanging towels — often heated.', example: 'The heated towel rail keeps your towels warm and dry.', spanish: 'el toallero (calefactado)' },

  // ── ROUND 3 · Technical
  { id: 13, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'plug', definition: 'A rubber or metal stopper that blocks the drain in a bath or basin.', example: 'The plug in the basin was missing when we arrived.', spanish: 'el tapón' },
  { id: 14, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'overflow', definition: 'The small hole near the top of a bath or basin that prevents flooding.', example: 'The overflow stopped the bath from flooding the bathroom floor.', spanish: 'el rebosadero' },
  { id: 15, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'fittings', definition: 'All the fixed items in a bathroom — taps, pipes, connectors and valves.', example: 'All the fittings in this bathroom suite are brushed gold.', spanish: 'la grifería / los accesorios' },
  { id: 16, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'flooring', definition: 'The material used to cover the floor of a room.', example: 'The flooring in the showroom is large-format Italian porcelain.', spanish: 'el suelo / el pavimento' },
  { id: 17, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'heater', definition: 'A device that produces warmth — in a bathroom, often a towel rail or underfloor system.', example: 'We installed underfloor heating as the main heater in the bathroom.', spanish: 'el calentador / el radiador' },
  { id: 18, round: 3, roundName: 'Technical', partOfSpeech: 'noun', word: 'tile', definition: 'A flat piece of ceramic or stone used to cover walls or floors.', example: 'These tiles come from a factory in Castellón.', spanish: 'el azulejo (pared) / la baldosa (suelo)' },

  // ── ROUND 4 · Business
  { id: 19, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'order', definition: 'A request for goods — from a client to the showroom, or to a supplier.', example: 'Your order will arrive at the showroom on Friday.', spanish: 'el pedido' },
  { id: 20, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'return', definition: 'When a client sends a product back because it is damaged or incorrect.', example: 'We processed the return and sent a replacement the same day.', spanish: 'la devolución' },
  { id: 21, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'invoice', definition: 'An official document requesting payment for goods or services.', example: 'I will send the invoice by email this afternoon.', spanish: 'la factura' },
  { id: 22, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'leak', definition: 'Water or liquid that escapes from a pipe, joint or fitting.', example: 'There is a small leak under the basin — we need a plumber.', spanish: 'la fuga / la gotera' },
  { id: 23, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'accessory', definition: 'A small decorative or functional item that completes a bathroom design.', example: 'We sell accessories to match every tap range in the showroom.', spanish: 'el accesorio' },
  { id: 24, round: 4, roundName: 'Business', partOfSpeech: 'noun', word: 'complaint', definition: 'When a client formally tells you they are unhappy with a product or service.', example: 'We received a complaint about the delivery — the bath arrived damaged.', spanish: 'la queja / la reclamación' },

  // ── ROUND 5 · Action! (Verbs)
  { id: 25, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to fit', definition: 'To install something in position. Regular verb: fit → fitted → fitted.', example: 'We fitted the new shower tray on Tuesday.', spanish: 'instalar / colocar' },
  { id: 26, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to order', definition: 'To request goods from a supplier. Regular verb: order → ordered → ordered.', example: 'We ordered the cabinet last Monday — it arrives on Friday.', spanish: 'pedir / encargar' },
  { id: 27, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to deliver', definition: 'To bring goods to an address. Regular verb: deliver → delivered → delivered.', example: 'They delivered the bath to the hotel on Wednesday morning.', spanish: 'entregar' },
  { id: 28, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to pay', definition: 'To give money for goods or a service. Irregular verb: pay → paid → paid.', example: 'The client paid the invoice yesterday — thank you!', spanish: 'pagar' },
  { id: 29, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to change', definition: 'To replace one item with a different one. Regular verb: change → changed → changed.', example: 'We changed the old tap for a new chrome one.', spanish: 'cambiar' },
  { id: 30, round: 5, roundName: 'Action!', partOfSpeech: 'verb', word: 'to complain', definition: 'To tell someone you are unhappy. Regular verb: complain → complained → complained.', example: 'The client complained about the colour of the tiles.', spanish: 'quejarse / reclamar' },

  // ── ROUND 6 · More Verbs
  { id: 31, round: 6, roundName: 'More Verbs', partOfSpeech: 'verb', word: 'to leak', definition: 'When water escapes from a pipe or fitting. Regular verb: leak → leaked → leaked.', example: 'The tap was leaking overnight — the floor was wet.', spanish: 'gotear / tener una fuga' },
  { id: 32, round: 6, roundName: 'More Verbs', partOfSpeech: 'verb', word: 'to return', definition: 'To send a product back to a supplier. Regular verb: return → returned → returned.', example: 'The client returned the basin because it was cracked.', spanish: 'devolver' },
  { id: 33, round: 6, roundName: 'More Verbs', partOfSpeech: 'verb', word: 'to tile', definition: 'To cover a wall or floor surface with tiles. Regular verb: tile → tiled → tiled.', example: 'The builders tiled the bathroom walls in white porcelain.', spanish: 'alicatar / poner azulejos' },
  { id: 34, round: 6, roundName: 'More Verbs', partOfSpeech: 'verb', word: 'to invoice', definition: 'To send a bill to a client. Regular verb: invoice → invoiced → invoiced.', example: 'We invoiced the hotel after fitting all twelve bathrooms.', spanish: 'facturar' },
  { id: 35, round: 6, roundName: 'More Verbs', partOfSpeech: 'adjective', word: 'modern', definition: 'New in design and style — not traditional or old-fashioned.', example: 'The client wanted a very modern look — no wood, no colour.', spanish: 'moderno/a' },
  { id: 36, round: 6, roundName: 'More Verbs', partOfSpeech: 'adjective', word: 'shiny', definition: 'A very bright, reflective surface — like polished chrome or gloss tiles.', example: 'The shiny finish on these taps shows every fingerprint!', spanish: 'brillante' },

  // ── ROUND 7 · How Does It Look?
  { id: 37, round: 7, roundName: 'How Does It Look?', partOfSpeech: 'adjective', word: 'matt', definition: 'A surface with no shine at all — the opposite of shiny.', example: 'Matt black taps are very fashionable right now.', spanish: 'mate' },
  { id: 38, round: 7, roundName: 'How Does It Look?', partOfSpeech: 'adjective', word: 'bright', definition: 'Giving a lot of light, or describing a strong, vivid colour.', example: 'The showroom looks very bright thanks to the large skylights.', spanish: 'luminoso/a / vivo/a (colour)' },
  { id: 39, round: 7, roundName: 'How Does It Look?', partOfSpeech: 'adjective', word: 'smooth', definition: 'A surface that is completely flat and even — no rough parts at all.', example: 'Run your hand across the bath — the surface is perfectly smooth.', spanish: 'liso/a / suave' },
];

function BorrasFlashcards({ onBack }) {
  const rounds = [...new Set(BORRAS_CARDS.map(c => c.round))];
  const [selectedRound, setSelectedRound] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());
  const [learningCards, setLearningCards] = useState(new Set());
  const [finished, setFinished] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const filtered = selectedRound === 'all'
    ? BORRAS_CARDS
    : BORRAS_CARDS.filter(c => c.round === selectedRound);

  const currentCard = filtered[currentIndex];
  const totalCards = filtered.length;
  const roundName = selectedRound === 'all'
    ? 'All Cards'
    : BORRAS_CARDS.find(c => c.round === selectedRound)?.roundName;

  function changeRound(r) {
    setSelectedRound(r);
    setCurrentIndex(0);
    setIsFlipped(false);
    setFinished(false);
    setKnownCards(new Set());
    setLearningCards(new Set());
  }

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleKnowIt = () => {
    setKnownCards(prev => new Set([...prev, currentCard.id]));
    setLearningCards(prev => { const n = new Set(prev); n.delete(currentCard.id); return n; });
    setIsFlipped(false);
  };

  const handleStillLearning = () => {
    setLearningCards(prev => new Set([...prev, currentCard.id]));
    setIsFlipped(false);
  };

  const handleNext = () => {
    if (currentIndex < totalCards - 1) { setCurrentIndex(currentIndex + 1); setIsFlipped(false); }
    else setFinished(true);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setIsFlipped(false); }
  };

  const handleReset = () => {
    setCurrentIndex(0); setIsFlipped(false);
    setKnownCards(new Set()); setLearningCards(new Set()); setFinished(false);
  };

  const minSwipeDistance = 50;
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance < -minSwipeDistance) handlePrevious();
    if (distance > minSwipeDistance) handleNext();
  };

  return (
    <div style={{
      width: '100vw', minHeight: '100vh', backgroundColor: '#f8f9fa',
      boxSizing: 'border-box', position: 'relative',
      left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw'
    }}>
      <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* HEADER */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px', padding: '2rem', textAlign: 'center',
          color: 'white', marginBottom: '1.5rem'
        }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '0.85rem', marginBottom: '1rem', display: 'block', margin: '0 auto 1rem'
            }}>← Back to Exercises</button>
          )}
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: '700' }}>
            Borrás Flashcards
          </h1>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>
            Bathroom vocabulary in context 🚿
          </p>
          <span style={{
            display: 'inline-block', background: '#48bb78', padding: '4px 12px',
            borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem'
          }}>
            Level: A1–B1 · {roundName}
          </span>
        </div>

        {/* ROUND FILTER */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {['all', ...rounds].map(r => {
            const label = r === 'all' ? 'All Cards' : `${r}. ${BORRAS_CARDS.find(c => c.round === r)?.roundName}`;
            const isActive = selectedRound === r;
            return (
              <button key={r} onClick={() => changeRound(r)} style={{
                background: isActive ? '#667eea' : 'white',
                color: isActive ? 'white' : '#4a5568',
                border: `1.5px solid ${isActive ? '#667eea' : '#e2e8f0'}`,
                borderRadius: '20px', padding: '5px 13px',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}>{label}</button>
            );
          })}
        </div>

        {!finished ? (
          <>
            {/* PROGRESS */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '1.5rem', fontSize: 'clamp(0.9rem, 3vw, 1rem)', color: '#4a5568', fontWeight: '500'
            }}>
              <span>{knownCards.size} of {totalCards} learned</span>
              <button onClick={handleReset} style={{
                padding: '0.5rem 1rem', backgroundColor: '#4a5568', color: 'white',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500'
              }}>↻ Reset</button>
            </div>

            {/* COUNTER */}
            <div style={{ textAlign: 'center', fontSize: 'clamp(1rem, 3vw, 1.2rem)', color: '#4a5568', fontWeight: '600', marginBottom: '1rem' }}>
              {currentIndex + 1} / {totalCards}
            </div>

            {/* CARD */}
            <div style={{ perspective: '1000px', marginBottom: '1.5rem' }}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <div onClick={handleFlip} style={{
                position: 'relative', width: '100%', minHeight: '350px',
                transformStyle: 'preserve-3d', transition: 'transform 0.6s',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', cursor: 'pointer'
              }}>
                {/* FRONT */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px',
                  padding: 'clamp(3rem, 10vw, 5rem) clamp(2rem, 5vw, 3rem)',
                  minHeight: '350px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                  color: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', boxSizing: 'border-box'
                }}>
                  <div style={{ fontSize: 'clamp(0.9rem, 3vw, 1rem)', fontWeight: '600', opacity: 0.9, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    {currentCard.partOfSpeech}
                  </div>
                  <div style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: '700', marginBottom: '0.5rem' }}>
                    {currentCard.word}
                  </div>
                  <div style={{ fontSize: 'clamp(0.85rem, 2.5vw, 1rem)', opacity: 0.7, marginTop: '1rem' }}>
                    tap to reveal ↓
                  </div>
                </div>

                {/* BACK */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)', backgroundColor: 'white', borderRadius: '16px',
                  padding: 'clamp(2rem, 6vw, 3rem) clamp(2rem, 5vw, 3rem)',
                  minHeight: '350px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '3px solid #667eea',
                  boxSizing: 'border-box', gap: '1rem'
                }}>
                  {/* Part of speech */}
                  <span style={{
                    background: '#f0ebff', color: '#764ba2', fontSize: '0.75rem',
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 12px', borderRadius: '20px'
                  }}>
                    {currentCard.partOfSpeech}
                  </span>

                  {/* Definition */}
                  <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.2rem)', color: '#2d3748', fontWeight: '600', lineHeight: 1.5 }}>
                    {currentCard.definition}
                  </div>

                  {/* Example */}
                  <div style={{
                    fontSize: 'clamp(0.9rem, 3vw, 1.05rem)', color: '#4a5568', fontStyle: 'italic',
                    lineHeight: 1.5, borderLeft: '3px solid #667eea', paddingLeft: '0.8rem',
                    textAlign: 'left', width: '100%'
                  }}>
                    "{currentCard.example}"
                  </div>

                  {/* Spanish */}
                  <div style={{
                    background: '#fffaf0', border: '1.5px solid #ed8936',
                    borderRadius: '10px', padding: '0.5rem 1.2rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1rem' }}>🇪🇸</span>
                    <span style={{ fontSize: 'clamp(1rem, 3.5vw, 1.2rem)', fontWeight: '700', color: '#c05621' }}>
                      {currentCard.spanish}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 'clamp(0.85rem, 2.5vw, 0.95rem)', color: '#718096', marginBottom: '1.5rem' }}>
              💡 Click/tap card to flip · Swipe to navigate
            </div>

            {/* NAV BUTTONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
              <button onClick={handlePrevious} disabled={currentIndex === 0} style={{
                padding: '1rem 1.5rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                backgroundColor: currentIndex === 0 ? '#cbd5e0' : '#4a5568',
                color: 'white', border: 'none', borderRadius: '12px',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: '600', flex: 1
              }}>← Previous</button>
              <button onClick={handleNext} style={{
                padding: '1rem 1.5rem', fontSize: 'clamp(1rem, 3vw, 1.1rem)',
                backgroundColor: '#667eea', color: 'white', border: 'none',
                borderRadius: '12px', cursor: 'pointer', fontWeight: '600', flex: 1
              }}>{currentIndex === totalCards - 1 ? 'Finish' : 'Next →'}</button>
            </div>

            {/* KNOW IT / STILL LEARNING */}
            {isFlipped && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={handleStillLearning} style={{
                  padding: '1.2rem', fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                  backgroundColor: '#ed8936', color: 'white', border: 'none',
                  borderRadius: '12px', cursor: 'pointer', fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(237,137,54,0.3)'
                }}>📚 Still Learning</button>
                <button onClick={handleKnowIt} style={{
                  padding: '1.2rem', fontSize: 'clamp(1rem, 4vw, 1.2rem)',
                  backgroundColor: '#48bb78', color: 'white', border: 'none',
                  borderRadius: '12px', cursor: 'pointer', fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(72,187,120,0.3)'
                }}>✅ Know It!</button>
              </div>
            )}
          </>
        ) : (
          /* FINISHED */
          <div style={{
            backgroundColor: 'white', padding: 'clamp(2rem, 6vw, 3rem)',
            borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center'
          }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 6vw, 2.2rem)', color: '#2C3E50', marginBottom: '1rem' }}>🎉 Complete!</h2>
            <div style={{ fontSize: 'clamp(1.2rem, 4vw, 1.5rem)', color: '#4a5568', marginBottom: '2rem' }}>
              You've reviewed all {totalCards} cards!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#f0fff4', borderRadius: '12px', border: '2px solid #48bb78' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#48bb78' }}>{knownCards.size}</div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Know It</div>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: '#fffaf0', borderRadius: '12px', border: '2px solid #ed8936' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ed8936' }}>{learningCards.size}</div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Still Learning</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleReset} style={{
                padding: '1rem 2rem', backgroundColor: '#667eea', color: 'white',
                border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem'
              }}>Review Again</button>
              <button onClick={onBack} style={{
                padding: '1rem 2rem', backgroundColor: '#4a5568', color: 'white',
                border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '1rem'
              }}>Back to Exercises</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BorrasFlashcards;
