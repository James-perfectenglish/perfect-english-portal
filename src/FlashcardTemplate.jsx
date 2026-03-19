import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import MemoryGame from './MemoryGame';

// ─────────────────────────────────────────────────────────────
// UNIFIED FLASHCARD TEMPLATE
//
// Props:
//   title, subtitle, levelBadge  — display text (optional for Supabase sets)
//   setName                      — string key for tracking, e.g. "borras", "hotel"
//   cards                        — hardcoded card array (Borrás / Hotel format)
//   flashcardSetId               — Supabase UUID (Verbs / Phrasal Verbs)
//   hasRounds                    — show round tabs (default false)
//   showMemoryGame               — show "Play Memory Game" button (default false)
//   onBack                       — callback
// ─────────────────────────────────────────────────────────────

export default function FlashcardTemplate({
  title: propTitle,
  subtitle: propSubtitle,
  levelBadge: propLevelBadge,
  setName = 'unknown',
  cards: propCards,
  flashcardSetId,
  hasRounds = false,
  showMemoryGame = false,
  onBack,
}) {
  // Data
  const [allCards, setAllCards]       = useState(propCards || [])
  const [dbMeta, setDbMeta]           = useState(null)
  const [loading, setLoading]         = useState(!!flashcardSetId)

  // Navigation
  const [selectedRound, setSelectedRound] = useState('all')
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [isFlipped, setIsFlipped]         = useState(false)
  const [finished, setFinished]           = useState(false)
  const [memoryRoundCards, setMemoryRoundCards] = useState(null)

  // Progress
  const [knownCards, setKnownCards]       = useState(new Set())
  const [learningCards, setLearningCards] = useState(new Set())

  // Touch
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd]     = useState(null)

  // ── Load from Supabase if needed ──
  useEffect(() => {
    if (flashcardSetId) loadFromSupabase()
  }, [flashcardSetId])

  async function loadFromSupabase() {
    try {
      const { data } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('id', flashcardSetId)
        .single()
      if (data) {
        setDbMeta(data)
        setAllCards(data.card_data.cards || [])
      }
    } catch (e) {
      console.error('Error loading flashcard set:', e)
    }
    setLoading(false)
  }

  // ── Derived state ──
  const rounds        = hasRounds ? [...new Set(allCards.map(c => c.round))] : []
  const filteredCards = hasRounds && selectedRound !== 'all'
    ? allCards.filter(c => c.round === selectedRound)
    : allCards

  const currentCard    = filteredCards[currentIndex]
  const totalCards     = filteredCards.length
  const isSupabaseCard = currentCard && currentCard.front !== undefined

  // ── Display metadata ──
  const displayTitle      = propTitle      || dbMeta?.title       || 'Flashcards'
  const displaySubtitle   = propSubtitle   || dbMeta?.description || ''
  const displayLevelBadge = propLevelBadge || (dbMeta?.level ? `Level: ${dbMeta.level}` : '')
  const currentRoundName  = selectedRound === 'all'
    ? 'All Cards'
    : allCards.find(c => c.round === selectedRound)?.roundName || `Round ${selectedRound}`

  // ── Handlers ──
  function changeRound(r) {
    setSelectedRound(r); setCurrentIndex(0)
    setIsFlipped(false); setFinished(false)
    setKnownCards(new Set()); setLearningCards(new Set())
    setMemoryRoundCards(null)
  }

  function handleFlip() { setIsFlipped(f => !f) }

  function handleKnowIt() {
    const id = currentCard.id
    setKnownCards(prev => new Set([...prev, id]))
    setLearningCards(prev => { const n = new Set(prev); n.delete(id); return n })
    setIsFlipped(false)
  }

  function handleStillLearning() {
    setLearningCards(prev => new Set([...prev, currentCard.id]))
    setIsFlipped(false)
  }

  function handleNext() {
    if (currentIndex < totalCards - 1) {
      setCurrentIndex(i => i + 1); setIsFlipped(false)
    } else {
      setFinished(true)
      saveSession()
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) { setCurrentIndex(i => i - 1); setIsFlipped(false) }
  }

  function handleReset() {
    setCurrentIndex(0); setIsFlipped(false)
    setKnownCards(new Set()); setLearningCards(new Set())
    setFinished(false); setMemoryRoundCards(null)
  }

  function handleShuffle() {
    const shuffled = [...filteredCards].sort(() => Math.random() - 0.5)
    setAllCards(prev => {
      if (!hasRounds || selectedRound === 'all') return shuffled
      const others = prev.filter(c => c.round !== selectedRound)
      return [...others, ...shuffled]
    })
    setCurrentIndex(0); setIsFlipped(false)
  }

  // ── Touch ──
  const minSwipe = 50
  const onTouchStart = e => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX) }
  const onTouchMove  = e => setTouchEnd(e.targetTouches[0].clientX)
  const onTouchEnd   = () => {
    if (!touchStart || !touchEnd) return
    const d = touchStart - touchEnd
    if (d < -minSwipe) handlePrevious()
    if (d >  minSwipe) handleNext()
  }

  // ── Save session ──
  async function saveSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('flashcard_sessions').insert({
        student_id:     user.id,
        set_name:       setName,
        round_name:     hasRounds ? currentRoundName : null,
        cards_seen:     totalCards,
        known_count:    knownCards.size,
        learning_count: learningCards.size,
      })
    } catch (e) {
      console.error('Error saving flashcard session:', e)
    }
  }

  // ── Card rendering ──
  function renderFront() {
    if (!currentCard) return null
    if (isSupabaseCard) {
      return (
        <>
          <div style={{ fontSize: 'clamp(0.9rem,3vw,1rem)', fontWeight: 600, opacity: 0.9, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
            {currentCard.front.language || 'ENGLISH'}
          </div>
          <div style={{ fontSize: 'clamp(2.5rem,8vw,4rem)', fontWeight: 700, marginBottom: '0.5rem' }}>
            {currentCard.front.infinitive || currentCard.front.word}
          </div>
          {currentCard.front.pronunciation && (
            <div style={{ fontSize: 'clamp(1.2rem,4vw,1.5rem)', opacity: 0.8, fontStyle: 'italic' }}>
              {currentCard.front.pronunciation}
            </div>
          )}
          {currentCard.front.example && (
            <div style={{ fontSize: 'clamp(1rem,3vw,1.2rem)', opacity: 0.9, marginTop: '1rem' }}>
              {currentCard.front.example}
            </div>
          )}
        </>
      )
    }
    // Hardcoded format
    return (
      <>
        <div style={{ fontSize: 'clamp(0.9rem,3vw,1rem)', fontWeight: 600, opacity: 0.9, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          {currentCard.partOfSpeech}
        </div>
        <div style={{ fontSize: 'clamp(2.5rem,8vw,4rem)', fontWeight: 700, marginBottom: '0.5rem' }}>
          {currentCard.word}
        </div>
        <div style={{ fontSize: 'clamp(0.85rem,2.5vw,1rem)', opacity: 0.7, marginTop: '1rem' }}>
          tap to reveal ↓
        </div>
      </>
    )
  }

  function renderBack() {
    if (!currentCard) return null
    if (isSupabaseCard) {
      const isVerbCard = currentCard.back.past_simple !== undefined
      if (isVerbCard) {
        return (
          <>
            <div style={{ fontSize: 'clamp(0.9rem,3vw,1rem)', fontWeight: 600, opacity: 0.7, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>PAST SIMPLE</div>
            <div style={{ fontSize: 'clamp(2rem,6vw,2.5rem)', fontWeight: 700, marginBottom: '0.5rem', color: '#764ba2' }}>{currentCard.back.past_simple}</div>
            {currentCard.back.example_past_simple && <div style={{ fontSize: 'clamp(0.95rem,3vw,1.1rem)', color: '#4a5568', fontStyle: 'italic', marginBottom: '1.5rem' }}>"{currentCard.back.example_past_simple}"</div>}
            <div style={{ fontSize: 'clamp(0.9rem,3vw,1rem)', fontWeight: 600, opacity: 0.7, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '2px' }}>PAST PARTICIPLE</div>
            <div style={{ fontSize: 'clamp(2rem,6vw,2.5rem)', fontWeight: 700, marginBottom: '0.5rem', color: '#764ba2' }}>{currentCard.back.past_participle}</div>
            {currentCard.back.example_past_participle && <div style={{ fontSize: 'clamp(0.95rem,3vw,1.1rem)', color: '#4a5568', fontStyle: 'italic' }}>"{currentCard.back.example_past_participle}"</div>}
          </>
        )
      }
      // Phrasal verb / vocabulary / bilingual
      return (
        <>
          {currentCard.back.translation && <div style={{ fontSize: 'clamp(1.5rem,5vw,2rem)', fontWeight: 600, marginBottom: '1.5rem', color: '#764ba2' }}>{currentCard.back.translation}</div>}
          {currentCard.back.example && <div style={{ fontSize: 'clamp(1rem,3vw,1.2rem)', color: '#4a5568', fontStyle: 'italic' }}>"{currentCard.back.example}"</div>}
          {currentCard.back.explanation && <div style={{ fontSize: 'clamp(0.9rem,3vw,1rem)', color: '#718096', marginTop: '1rem', maxWidth: '90%' }}>{currentCard.back.explanation}</div>}
        </>
      )
    }
    // Hardcoded format (Borrás / Hotel)
    return (
      <>
        <span style={{ background: '#f0ebff', color: '#764ba2', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: '20px' }}>
          {currentCard.partOfSpeech}
        </span>
        <div style={{ fontSize: 'clamp(1rem,3.5vw,1.2rem)', color: '#2d3748', fontWeight: 600, lineHeight: 1.5 }}>
          {currentCard.definition}
        </div>
        <div style={{ fontSize: 'clamp(0.9rem,3vw,1.05rem)', color: '#4a5568', fontStyle: 'italic', lineHeight: 1.5, borderLeft: '3px solid #667eea', paddingLeft: '0.8rem', textAlign: 'left', width: '100%' }}>
          "{currentCard.example}"
        </div>
        {currentCard.spanish && (
          <div style={{ background: '#fffaf0', border: '1.5px solid #ed8936', borderRadius: '10px', padding: '0.5rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>🇪🇸</span>
            <span style={{ fontSize: 'clamp(1rem,3.5vw,1.2rem)', fontWeight: 700, color: '#c05621' }}>{currentCard.spanish}</span>
          </div>
        )}
      </>
    )
  }

  // ── Memory game overlay ──
  if (memoryRoundCards) {
    return (
      <MemoryGame
        title={`${displayTitle} — Memory Game`}
        subtitle={`Round: ${currentRoundName}`}
        levelBadge={displayLevelBadge}
        cards={memoryRoundCards}
        gameName={setName}
        onBack={() => setMemoryRoundCards(null)}
      />
    )
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: '#667eea' }}>Loading flashcards...</div>
  if (!allCards.length) return <div style={{ textAlign: 'center', padding: '2rem' }}>No cards found.</div>

  return (
    <div style={{ width: '100vw', minHeight: '100vh', backgroundColor: '#f8f9fa', boxSizing: 'border-box', position: 'relative', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw' }}>
      <div style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* HEADER */}
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem,5vw,2.2rem)', fontWeight: 700 }}>{displayTitle}</h1>
          {displaySubtitle && <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: 'clamp(0.9rem,3vw,1.1rem)' }}>{displaySubtitle}</p>}
         
        </div>

        {/* ROUND TABS */}
        {hasRounds && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {['all', ...rounds].map(r => {
              const label    = r === 'all' ? 'All Cards' : `${r}. ${allCards.find(c => c.round === r)?.roundName}`
              const isActive = selectedRound === r
              return (
                <button key={r} onClick={() => changeRound(r)} style={{
                  background: isActive ? '#667eea' : 'white', color: isActive ? 'white' : '#4a5568',
                  border: `1.5px solid ${isActive ? '#667eea' : '#e2e8f0'}`,
                  borderRadius: '20px', padding: '5px 13px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer'
                }}>{label}</button>
              )
            })}
          </div>
        )}

        {!finished ? (
          <>
            {/* PROGRESS ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', fontSize: 'clamp(0.9rem,3vw,1rem)', color: '#4a5568', fontWeight: 500 }}>
              <span>{knownCards.size} of {totalCards} learned</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleShuffle} style={{ padding: '0.5rem 1rem', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>🔀 Shuffle</button>
                <button onClick={handleReset}   style={{ padding: '0.5rem 1rem', backgroundColor: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>↻ Reset</button>
              </div>
            </div>

            {/* COUNTER */}
            <div style={{ textAlign: 'center', fontSize: 'clamp(1rem,3vw,1.2rem)', color: '#4a5568', fontWeight: 600, marginBottom: '1rem' }}>
              {currentIndex + 1} / {totalCards}
            </div>

            {/* CARD */}
            <div style={{ perspective: '1000px', marginBottom: '1.5rem' }} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <div onClick={handleFlip} style={{
                position: 'relative', width: '100%', minHeight: '480px',
                transformStyle: 'preserve-3d', transition: 'transform 0.6s',
                transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)', cursor: 'pointer'
              }}>
                {/* FRONT */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '16px', padding: 'clamp(3rem,10vw,5rem) clamp(2rem,5vw,3rem)',
                  minHeight: '480px', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                  color: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', boxSizing: 'border-box'
                }}>
                  {renderFront()}
                </div>
                {/* BACK */}
                <div style={{
                  position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)', backgroundColor: 'white',
                  borderRadius: '16px', padding: 'clamp(2rem,6vw,3rem) clamp(2rem,5vw,3rem)',
                  minHeight: '480px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
                  justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                  color: '#667eea', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  border: '3px solid #667eea', boxSizing: 'border-box', gap: '1rem'
                }}>
                  {renderBack()}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: 'clamp(0.85rem,2.5vw,0.95rem)', color: '#718096', marginBottom: '1.5rem' }}>
              💡 Tap card to flip · Swipe to navigate
            </div>

            {/* NAV BUTTONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
              <button onClick={handlePrevious} disabled={currentIndex === 0} style={{ padding: '1rem 1.5rem', fontSize: 'clamp(1rem,3vw,1.1rem)', backgroundColor: currentIndex === 0 ? '#cbd5e0' : '#4a5568', color: 'white', border: 'none', borderRadius: '12px', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, flex: 1 }}>← Previous</button>
              <button onClick={handleNext}     style={{ padding: '1rem 1.5rem', fontSize: 'clamp(1rem,3vw,1.1rem)', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, flex: 1 }}>
                {currentIndex === totalCards - 1 ? 'Finish' : 'Next →'}
              </button>
            </div>

            {/* KNOW IT / STILL LEARNING */}
            {isFlipped && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={handleStillLearning} style={{ padding: '1.2rem', fontSize: 'clamp(1rem,4vw,1.2rem)', backgroundColor: '#ed8936', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(237,137,54,0.3)' }}>📚 Still Learning</button>
                <button onClick={handleKnowIt}        style={{ padding: '1.2rem', fontSize: 'clamp(1rem,4vw,1.2rem)', backgroundColor: '#48bb78', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(72,187,120,0.3)' }}>✅ Know It!</button>
              </div>
            )}
          </>
        ) : (
          /* FINISHED SCREEN */
          <div style={{ backgroundColor: 'white', padding: 'clamp(2rem,6vw,3rem)', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,6vw,2.2rem)', color: '#2C3E50', marginBottom: '1rem' }}>🎉 Complete!</h2>
            <div style={{ fontSize: 'clamp(1.2rem,4vw,1.5rem)', color: '#4a5568', marginBottom: '2rem' }}>
              You've reviewed all {totalCards} cards!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#f0fff4', borderRadius: '12px', border: '2px solid #48bb78' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#48bb78' }}>{knownCards.size}</div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Know It</div>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: '#fffaf0', borderRadius: '12px', border: '2px solid #ed8936' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ed8936' }}>{learningCards.size}</div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>Still Learning</div>
              </div>
            </div>

            {showMemoryGame && hasRounds && selectedRound !== 'all' && (
              <button
                onClick={() => setMemoryRoundCards(filteredCards)}
                style={{ width: '100%', padding: '1rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #48bb78, #38a169)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}
              >
                🎮 Play Memory Game for this round
              </button>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleReset} style={{ padding: '1rem 2rem', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Review Again</button>
              {onBack && <button onClick={onBack} style={{ padding: '1rem 2rem', backgroundColor: '#4a5568', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>Back to Exercises</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
