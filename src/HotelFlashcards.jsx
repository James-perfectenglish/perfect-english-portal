import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
// CARD DATA
// Rounds 1–3: General (everyone)  20 words
// Rounds 4–5: Client-facing       10 words
// Rounds 6–7: Back office         10 words
// ─────────────────────────────────────────────────────────────
export const HOTEL_CARDS = [

  // ── ROUND 1 · The Hotel (general) ───────────────────────────
  { id: 1, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'room', definition: 'A space in a hotel where a guest sleeps and stays during their visit.', example: 'The room on the third floor has a beautiful view of the sea.', spanish: 'la habitación' },
  { id: 2, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'floor', definition: 'A level of a building — ground floor, first floor, second floor, etc.', example: 'The restaurant is on the ground floor, next to the lobby.', spanish: 'la planta' },
  { id: 3, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'lift', definition: 'The machine you use to travel between floors without using the stairs.', example: 'Take the lift to the fifth floor — your room is on the right.', spanish: 'el ascensor' },
  { id: 4, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'lobby', definition: 'The entrance area of a hotel where guests arrive and check in.', example: 'Please wait for us in the lobby — we will be there in five minutes.', spanish: 'el vestíbulo / el lobby' },
  { id: 5, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'key card', definition: 'The plastic card you use like a key to open your hotel room door.', example: 'If your key card stops working, please come to reception.', spanish: 'la tarjeta llave' },
  { id: 6, round: 1, roundName: 'The Hotel', partOfSpeech: 'noun', word: 'guest', definition: 'A person who is staying at the hotel as a paying customer.', example: 'All guests must show their passport when they check in.', spanish: 'el/la huésped' },

  // ── ROUND 2 · In Your Room (general) ────────────────────────
  { id: 7, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'minibar', definition: 'A small fridge in the hotel room stocked with drinks and snacks to buy.', example: 'The minibar is restocked every morning by housekeeping.', spanish: 'el minibar' },
  { id: 8, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'room service', definition: 'A hotel service where food and drinks are delivered directly to your room.', example: 'Room service is available 24 hours a day in this hotel.', spanish: 'el servicio de habitaciones' },
  { id: 9, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'laundry', definition: 'A hotel service that washes and irons guests\' clothes for them.', example: 'Leave your laundry in the bag and we will return it by 6pm.', spanish: 'la lavandería / la ropa para lavar' },
  { id: 10, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'amenities', definition: 'All the small extras provided in a hotel room — soap, shampoo, towels, etc.', example: 'Our deluxe rooms include premium amenities from a luxury brand.', spanish: 'los artículos de cortesía / los amenities' },
  { id: 11, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'pillow', definition: 'The soft cushion you rest your head on when sleeping.', example: 'We can bring you an extra pillow — just call reception.', spanish: 'la almohada' },
  { id: 12, round: 2, roundName: 'In Your Room', partOfSpeech: 'noun', word: 'towel', definition: 'The cloth you use to dry yourself after a shower or bath.', example: 'Please hang your towel on the rail if you do not need it changed.', spanish: 'la toalla' },

  // ── ROUND 3 · Making a Booking (general) ────────────────────
  { id: 13, round: 3, roundName: 'Making a Booking', partOfSpeech: 'noun', word: 'reservation', definition: 'An arrangement made in advance to have a room kept for you.', example: 'I have a reservation for two nights under the name García.', spanish: 'la reserva' },
  { id: 14, round: 3, roundName: 'Making a Booking', partOfSpeech: 'verb', word: 'to book', definition: 'To reserve a room or service in advance. Regular verb: book → booked → booked.', example: 'We booked the suite three months before the wedding.', spanish: 'reservar' },
  { id: 15, round: 3, roundName: 'Making a Booking', partOfSpeech: 'verb', word: 'to cancel', definition: 'To say that a reservation is no longer needed. Regular verb: cancel → cancelled → cancelled.', example: 'The guest cancelled their booking two days before arrival.', spanish: 'cancelar' },
  { id: 16, round: 3, roundName: 'Making a Booking', partOfSpeech: 'verb', word: 'to confirm', definition: 'To say officially that a booking is correct and certain. Regular verb: confirm → confirmed → confirmed.', example: 'We will send you an email to confirm your reservation.', spanish: 'confirmar' },
  { id: 17, round: 3, roundName: 'Making a Booking', partOfSpeech: 'adjective', word: 'available', definition: 'Free to be used — not already booked or occupied.', example: 'I am sorry, we do not have any double rooms available this weekend.', spanish: 'disponible' },
  { id: 18, round: 3, roundName: 'Making a Booking', partOfSpeech: 'noun', word: 'suite', definition: 'A large, luxurious set of rooms in a hotel, usually with a separate living area.', example: 'The honeymoon suite on the top floor has a private terrace.', spanish: 'la suite' },

  // ── ROUND 4 · At Reception (client-facing) ──────────────────
  { id: 19, round: 4, roundName: 'At Reception', partOfSpeech: 'noun', word: 'check-in', definition: 'The process when a guest arrives, gives their name, and receives their room key.', example: 'Check-in is from 3pm — early check-in is available for an extra charge.', spanish: 'el check-in / el registro' },
  { id: 20, round: 4, roundName: 'At Reception', partOfSpeech: 'noun', word: 'check-out', definition: 'The process when a guest pays their bill and returns their key before leaving.', example: 'Check-out time is 12 noon — late check-out can be arranged.', spanish: 'el check-out / la salida' },
  { id: 21, round: 4, roundName: 'At Reception', partOfSpeech: 'noun', word: 'receptionist', definition: 'The person who works at the front desk, welcoming guests and managing arrivals.', example: 'Ask the receptionist — she will help you with directions to the beach.', spanish: 'el/la recepcionista' },
  { id: 22, round: 4, roundName: 'At Reception', partOfSpeech: 'noun', word: 'concierge', definition: 'A hotel employee who helps guests with special requests, tickets, and local information.', example: 'The concierge can book a taxi to the airport for you.', spanish: 'el/la conserje' },
  { id: 23, round: 4, roundName: 'At Reception', partOfSpeech: 'verb', word: 'to welcome', definition: 'To greet a guest warmly when they arrive. Regular verb: welcome → welcomed → welcomed.', example: 'We always welcome guests with a cold drink on hot days.', spanish: 'dar la bienvenida / recibir' },
  { id: 24, round: 4, roundName: 'At Reception', partOfSpeech: 'noun', word: 'porter', definition: 'The hotel staff member who carries guests\' bags and helps with luggage.', example: 'The porter will take your bags up to your room immediately.', spanish: 'el/la botones / el mozo de equipaje' },

  // ── ROUND 5 · Guest Services (client-facing) ────────────────
  { id: 25, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'complaint', definition: 'When a guest formally tells you they are unhappy with something.', example: 'The guest made a complaint about the noise from the room next door.', spanish: 'la queja / la reclamación' },
  { id: 26, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'double room', definition: 'A hotel room with one large bed, designed for two people.', example: 'We have one double room left for Saturday night.', spanish: 'la habitación doble' },
  { id: 27, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'single room', definition: 'A hotel room with one small bed, designed for one person.', example: 'A single room is twenty euros less per night than a double.', spanish: 'la habitación individual' },
  { id: 28, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'tip', definition: 'Extra money a guest gives to a staff member to thank them for good service.', example: 'The guest left a generous tip for the porter on the desk.', spanish: 'la propina' },
  { id: 29, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'breakfast', definition: 'The morning meal — often included in the price of a hotel room.', example: 'Breakfast is served in the dining room from 7am to 10:30am.', spanish: 'el desayuno' },
  { id: 30, round: 5, roundName: 'Guest Services', partOfSpeech: 'noun', word: 'upgrade', definition: 'When a guest is moved to a better room than the one they originally booked.', example: 'We gave the couple a free upgrade to the sea-view suite.', spanish: 'la mejora / el upgrade' },

  // ── ROUND 6 · Back Office 1 ──────────────────────────────────
  { id: 31, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'housekeeping', definition: 'The department responsible for cleaning rooms and maintaining the hotel.', example: 'Call housekeeping and ask them to bring more towels to room 204.', spanish: 'el departamento de pisos / la limpieza' },
  { id: 32, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'maintenance', definition: 'The team that repairs and looks after the building, equipment and facilities.', example: 'Maintenance came to fix the air conditioning in room 318 this morning.', spanish: 'el departamento de mantenimiento' },
  { id: 33, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'occupancy', definition: 'The percentage of rooms that are currently occupied by guests.', example: 'Occupancy this weekend is at 98% — we are almost fully booked.', spanish: 'la ocupación' },
  { id: 34, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'revenue', definition: 'The total amount of money the hotel earns from rooms, food and services.', example: 'Revenue in August was 30% higher than the same month last year.', spanish: 'los ingresos / la facturación' },
  { id: 35, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'rota', definition: 'The schedule showing which staff member works on which day and time.', example: 'Check the rota for next week — you are on the early shift on Monday.', spanish: 'el turno / el cuadrante' },
  { id: 36, round: 6, roundName: 'Back Office', partOfSpeech: 'noun', word: 'supplier', definition: 'A company that provides the hotel with food, products or equipment.', example: 'Our wine supplier delivers every Tuesday morning before 9am.', spanish: 'el/la proveedor/a' },

  // ── ROUND 7 · Back Office 2 ──────────────────────────────────
  { id: 37, round: 7, roundName: 'Back Office 2', partOfSpeech: 'noun', word: 'budget', definition: 'The amount of money a department is allowed to spend in a given period.', example: 'We need to order new bed linen, but we are over budget this month.', spanish: 'el presupuesto' },
  { id: 38, round: 7, roundName: 'Back Office 2', partOfSpeech: 'noun', word: 'commission', definition: 'A percentage of a sale paid to an agent or platform that sends guests to the hotel.', example: 'Booking.com charges a 15% commission on every reservation.', spanish: 'la comisión' },
  { id: 39, round: 7, roundName: 'Back Office 2', partOfSpeech: 'verb', word: 'to liaise', definition: 'To communicate and work closely with another person or department. Regular verb.', example: 'Please liaise with the kitchen team about the special dietary requests.', spanish: 'coordinarse / actuar de enlace' },
  { id: 40, round: 7, roundName: 'Back Office 2', partOfSpeech: 'noun', word: 'invoice', definition: 'An official document requesting payment for goods or services supplied.', example: 'The supplier sent the invoice for last month\'s deliveries on Friday.', spanish: 'la factura' },
];

function HotelFlashcards({ onBack }) {
  const rounds = [...new Set(HOTEL_CARDS.map(c => c.round))];
  const [selectedRound, setSelectedRound] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());
  const [learningCards, setLearningCards] = useState(new Set());
  const [finished, setFinished] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const filtered = selectedRound === 'all'
    ? HOTEL_CARDS
    : HOTEL_CARDS.filter(c => c.round === selectedRound);

  const currentCard = filtered[currentIndex];
  const totalCards = filtered.length;
  const roundName = selectedRound === 'all'
    ? 'All Cards'
    : HOTEL_CARDS.find(c => c.round === selectedRound)?.roundName;

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
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 5vw, 2.2rem)', fontWeight: '700' }}>
            Hotel Flashcards
          </h1>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: 'clamp(0.9rem, 3vw, 1.1rem)' }}>
            Essential hotel vocabulary in context 🏨
          </p>
          <span style={{
            display: 'inline-block', background: '#48bb78', padding: '4px 12px',
            borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.5rem'
          }}>
            Level: A2 · {roundName}
          </span>
        </div>

        {/* ROUND FILTER */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
          {['all', ...rounds].map(r => {
            const label = r === 'all' ? 'All Cards' : `${r}. ${HOTEL_CARDS.find(c => c.round === r)?.roundName}`;
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
                  <span style={{
                    background: '#f0ebff', color: '#764ba2', fontSize: '0.75rem',
                    fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                    padding: '3px 12px', borderRadius: '20px'
                  }}>{currentCard.partOfSpeech}</span>

                  <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.2rem)', color: '#2d3748', fontWeight: '600', lineHeight: 1.5 }}>
                    {currentCard.definition}
                  </div>

                  <div style={{
                    fontSize: 'clamp(0.9rem, 3vw, 1.05rem)', color: '#4a5568', fontStyle: 'italic',
                    lineHeight: 1.5, borderLeft: '3px solid #667eea', paddingLeft: '0.8rem',
                    textAlign: 'left', width: '100%'
                  }}>
                    "{currentCard.example}"
                  </div>

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

export default HotelFlashcards;
