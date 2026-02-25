import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const STARTING_BUDGET = 1000;
const BID_INCREMENT = 50;
const AUCTIONS_PER_ROUND = 5;
const REVEAL_DELAY_MS = 700; // gap between each sentence revealing

const LEVELS = [
  {
    key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2', badgeLabel: 'Level: A1-A2',
    description: 'Simple sentences — basic grammar, common errors at beginner level.',
    colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱',
  },
  {
    key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', badgeLabel: 'Level: B1-B2',
    description: 'Trickier sentences — tenses, prepositions, collocations.',
    colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘',
  },
  {
    key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2', badgeLabel: 'Level: C1-C2',
    description: 'Subtle errors — register, nuance, advanced grammar.',
    colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓',
  },
];

export default function SentenceAuction({ onBack, onComplete }) {
  const [stage, setStage] = useState('level-select'); // level-select | loading | bidding | revealing | result | finished
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [auctions, setAuctions] = useState([]);       // array of question_bank rows
  const [currentIdx, setCurrentIdx] = useState(0);

  // Per-auction state
  const [bids, setBids] = useState({});               // { sentenceIndex: bidAmount }
  const [revealedCount, setRevealedCount] = useState(0); // how many sentences have been revealed
  const [auctionResult, setAuctionResult] = useState(null); // { gained, lost, net }

  // Round totals
  const [budget, setBudget] = useState(STARTING_BUDGET);
  const [roundResults, setRoundResults] = useState([]); // array of { gained, lost, net } per auction

  const revealTimerRef = useRef(null);

  useEffect(() => { fetchCounts(); }, []);

  const fetchCounts = async () => {
    const { data } = await supabase.from('question_bank').select('level').eq('type', 'sentence_auction');
    if (data) {
      const counts = {};
      LEVELS.forEach(lv => {
        counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length;
      });
      setQuestionCounts(counts);
    }
  };

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('loading');
    fetchAuctions(level.dbLevels);
  };

  const fetchAuctions = async (dbLevels) => {
    const { data, error } = await supabase
      .from('question_bank').select('*')
      .eq('type', 'sentence_auction').in('level', dbLevels);
    if (error) { console.error(error); setStage('bidding'); return; }
    const picked = shuffleArray(data || []).slice(0, AUCTIONS_PER_ROUND);
    setAuctions(picked);
    setCurrentIdx(0);
    setBudget(STARTING_BUDGET);
    setRoundResults([]);
    resetAuctionState({});
    setStage(picked.length > 0 ? 'bidding' : 'finished');
  };

  const resetAuctionState = (initialBids) => {
    setBids(initialBids);
    setRevealedCount(0);
    setAuctionResult(null);
  };

  // ── BID CONTROLS ──────────────────────────────────────────────
  const totalBid = Object.values(bids).reduce((a, b) => a + b, 0);
  const remainingBudget = budget - totalBid;

  const adjustBid = (idx, delta) => {
    const current = bids[idx] || 0;
    const next = current + delta;
    if (next < 0) return;
    if (delta > 0 && remainingBudget < delta) return; // can't exceed budget
    setBids(prev => ({ ...prev, [idx]: next }));
  };

  // ── REVEAL ────────────────────────────────────────────────────
  const placeBids = () => {
    if (totalBid === 0) return; // must bid something
    setStage('revealing');
    setRevealedCount(0);
    revealSentencesSequentially(0);
  };

  const revealSentencesSequentially = (count) => {
    const sentences = getParsedSentences();
    if (count < sentences.length) {
      revealTimerRef.current = setTimeout(() => {
        setRevealedCount(count + 1);
        revealSentencesSequentially(count + 1);
      }, REVEAL_DELAY_MS);
    } else {
      // All revealed — compute result
      computeResult();
    }
  };

  const computeResult = () => {
    const sentences = getParsedSentences();
    let gained = 0;
    let lost = 0;
    sentences.forEach((s, idx) => {
      const bid = bids[idx] || 0;
      if (bid === 0) return;
      if (s.correct) {
        gained += bid;
      } else {
        lost += bid;
      }
    });
    const net = gained - lost;
    const result = { gained, lost, net };
    setAuctionResult(result);
    setBudget(prev => prev + net);
    setRoundResults(prev => [...prev, result]);

    // Save to student_answers
    saveAnswer(sentences, gained, lost);
    setStage('result');
  };

  const saveAnswer = async (sentences, gained, lost) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const auction = auctions[currentIdx];
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: auction.question_number,
        student_answer: `gained:${gained} lost:${lost}`,
        correct_answer: 'auction',
        is_correct: gained > lost,
      });
    } catch (e) { console.error(e); }
  };

  const nextAuction = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const next = currentIdx + 1;
    if (next >= auctions.length) {
      setStage('finished');
    } else {
      setCurrentIdx(next);
      resetAuctionState({});
      setStage('bidding');
    }
  };

  const restartRound = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setStage('loading');
    fetchAuctions(selectedLevel.dbLevels);
  };

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    clearTimeout(revealTimerRef.current);
    setSelectedLevel(null);
    setAuctions([]);
    setStage('level-select');
    fetchCounts();
  };

  // ── HELPERS ───────────────────────────────────────────────────
  const getParsedSentences = () => {
    const auction = auctions[currentIdx];
    if (!auction) return [];
    return Array.isArray(auction.options)
      ? auction.options
      : JSON.parse(auction.options || '[]');
  };

  const getBudgetColour = () => {
    if (budget >= STARTING_BUDGET) return '#48bb78';
    if (budget >= STARTING_BUDGET * 0.6) return '#ed8936';
    return '#f56565';
  };

  // ── LEVEL SELECT ──────────────────────────────────────────────
  if (stage === 'level-select') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔨 Sentence Auction</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Bid on the sentences you think are correct — and don't waste money on the wrong ones!</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

          {/* How to play */}
          <div style={{ background: '#f7f8ff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', lineHeight: 1.7 }}>
            <strong style={{ color: '#2d3748' }}>How to play:</strong> You start with <strong>1,000 points</strong>. Each auction shows several sentences — some correct, some not. Decide how much to bid on each sentence you think is correct. Bid right → win that amount. Bid wrong → lose it. The goal: finish with as many points as possible!
          </div>

          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start</p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div
                  key={level.key}
                  onClick={() => available && selectLevel(level)}
                  style={{
                    border: `2px solid ${available ? level.colour : '#e2e8f0'}`,
                    borderRadius: '12px', padding: '1.25rem 1.5rem',
                    cursor: available ? 'pointer' : 'default',
                    background: available ? level.colourLight : '#f9fafb',
                    opacity: available ? 1 : 0.55,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                  }}
                  onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30`; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                      <span style={{ background: available ? level.colour : '#a0aec0', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{level.sublabel}</span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>{level.description}</p>
                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem', color: available ? '#4a5568' : '#a0aec0', fontWeight: 500 }}>
                      {available ? `${count} auction${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                    </span>
                  </div>
                  {available && <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>}
                </div>
              );
            })}
          </div>

          {onBack && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Back to Exercises</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LOADING ───────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔨 Sentence Auction</h1>
        </div>
        <div style={{ background: 'white', padding: '3rem 2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center', color: '#666' }}>
          Loading auctions...
        </div>
      </div>
    );
  }

  // ── BIDDING + REVEALING + RESULT ──────────────────────────────
  if (['bidding', 'revealing', 'result'].includes(stage)) {
    const sentences = getParsedSentences();
    const auction = auctions[currentIdx];

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2rem 2rem 1.5rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔨 Sentence Auction</h1>
          {selectedLevel && (
            <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>
              {selectedLevel.badgeLabel}
            </span>
          )}
        </div>

        <div style={{ background: 'white', padding: '1.5rem 2rem 2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

          {/* Budget + progress bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', color: '#718096', fontWeight: 500 }}>
              Auction {currentIdx + 1} of {auctions.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#718096' }}>Budget:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: getBudgetColour() }}>
                {budget.toLocaleString()} pts
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: '5px', backgroundColor: '#e0e0e0', borderRadius: '3px', marginBottom: '20px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(currentIdx / auctions.length) * 100}%`, background: GRADIENT, borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>

          {/* Bidding bar — only during bidding stage */}
          {stage === 'bidding' && (
            <div style={{ background: '#f7f8ff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                Bids placed: <strong>{totalBid.toLocaleString()} pts</strong>
              </span>
              <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                Still available: <strong style={{ color: remainingBudget === 0 ? '#f56565' : '#667eea' }}>{remainingBudget.toLocaleString()} pts</strong>
              </span>
            </div>
          )}

          {/* Optional context question */}
          {auction.question && auction.question.trim() && (
            <div style={{ fontSize: '1rem', color: '#4a5568', fontStyle: 'italic', marginBottom: '16px', lineHeight: 1.5 }}>
              {auction.question}
            </div>
          )}

          {/* Instruction */}
          {stage === 'bidding' && (
            <p style={{ fontSize: '0.9rem', color: '#718096', margin: '0 0 16px', lineHeight: 1.5 }}>
              Which sentences are correct? Set your bids, then lock them in. You can bid on as many as you like — but choose wisely!
            </p>
          )}
          {stage === 'revealing' && (
            <p style={{ fontSize: '0.9rem', color: '#667eea', fontWeight: 500, margin: '0 0 16px' }}>
              🔍 Revealing results...
            </p>
          )}

          {/* Sentences */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {sentences.map((s, idx) => {
              const bid = bids[idx] || 0;
              const isRevealed = stage === 'result' || (stage === 'revealing' && idx < revealedCount);
              const isCorrect = s.correct;
              const hadBid = bid > 0;
              const won = isRevealed && hadBid && isCorrect;
              const lost = isRevealed && hadBid && !isCorrect;

              let cardBg = 'white';
              let cardBorder = '2px solid #e2e8f0';
              let cardColour = '#2d3748';

              if (isRevealed) {
                if (isCorrect) {
                  cardBg = '#f0fff4'; cardBorder = '2px solid #48bb78'; cardColour = '#276749';
                } else {
                  cardBg = '#fff5f5'; cardBorder = '2px solid #f56565'; cardColour = '#c53030';
                }
              } else if (bid > 0) {
                cardBg = '#EDE9FE'; cardBorder = '2px solid #667eea'; cardColour = '#2d3748';
              }

              // Animate in on reveal
              const revealAnimation = isRevealed ? {
                transition: 'all 0.4s ease',
              } : {};

              return (
                <div key={idx} style={{ borderRadius: '12px', border: cardBorder, background: cardBg, padding: '1rem 1.25rem', transition: 'all 0.4s ease', ...revealAnimation }}>

                  {/* Sentence text */}
                  <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.1rem)', color: cardColour, fontWeight: 500, lineHeight: 1.5, marginBottom: isRevealed ? '10px' : (stage === 'bidding' ? '14px' : '0') }}>
                    {isRevealed && (
                      <span style={{ marginRight: '8px', fontSize: '1.1rem' }}>
                        {isCorrect ? '✅' : '❌'}
                      </span>
                    )}
                    {s.sentence}
                  </div>

                  {/* Bid result badge */}
                  {isRevealed && hadBid && (
                    <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', background: won ? '#c6f6d5' : '#fed7d7', color: won ? '#276749' : '#c53030' }}>
                      {won ? `+${bid} pts` : `-${bid} pts`}
                    </div>
                  )}

                  {/* Explanation after reveal */}
                  {isRevealed && s.explanation && (
                    <div style={{ fontSize: '0.9rem', color: isCorrect ? '#276749' : '#c53030', lineHeight: 1.5, opacity: 0.9 }}>
                      {s.explanation}
                    </div>
                  )}

                  {/* Bid controls — only during bidding */}
                  {stage === 'bidding' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#718096', fontWeight: 500 }}>My bid:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => adjustBid(idx, -BID_INCREMENT)}
                          disabled={bid === 0}
                          style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #e2e8f0', background: bid === 0 ? '#f7fafc' : 'white', color: bid === 0 ? '#cbd5e0' : '#4a5568', fontSize: '1.1rem', fontWeight: 700, cursor: bid === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        >−</button>
                        <span style={{ minWidth: '72px', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem', color: bid > 0 ? '#553C9A' : '#a0aec0' }}>
                          {bid > 0 ? `${bid} pts` : '—'}
                        </span>
                        <button
                          onClick={() => adjustBid(idx, BID_INCREMENT)}
                          disabled={remainingBudget < BID_INCREMENT}
                          style={{ width: '32px', height: '32px', borderRadius: '6px', border: '1px solid #e2e8f0', background: remainingBudget < BID_INCREMENT ? '#f7fafc' : 'white', color: remainingBudget < BID_INCREMENT ? '#cbd5e0' : '#667eea', fontSize: '1.1rem', fontWeight: 700, cursor: remainingBudget < BID_INCREMENT ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        >+</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Place bids button */}
          {stage === 'bidding' && (
            <button
              onClick={placeBids}
              disabled={totalBid === 0}
              style={{ width: '100%', padding: '1.1rem', fontSize: '1.1rem', background: totalBid > 0 ? GRADIENT : '#cbd5e0', color: 'white', border: 'none', borderRadius: '10px', cursor: totalBid > 0 ? 'pointer' : 'not-allowed', fontWeight: 700 }}
            >
              {totalBid > 0 ? `🔨 Place ${totalBid} pts in bids` : 'Set at least one bid to continue'}
            </button>
          )}

          {/* Revealing indicator */}
          {stage === 'revealing' && (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#667eea', fontWeight: 500 }}>
              {revealedCount < sentences.length ? `Revealing ${revealedCount + 1} of ${sentences.length}...` : 'Calculating result...'}
            </div>
          )}

          {/* Result summary + next button */}
          {stage === 'result' && auctionResult && (
            <div>
              {/* Result card */}
              <div style={{ background: auctionResult.net >= 0 ? '#f0fff4' : '#fff5f5', border: `2px solid ${auctionResult.net >= 0 ? '#48bb78' : '#f56565'}`, borderRadius: '12px', padding: '1.25rem', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>
                  {auctionResult.net > 0 ? '🤑' : auctionResult.net === 0 ? '😐' : '😬'}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: auctionResult.net >= 0 ? '#276749' : '#c53030', marginBottom: '4px' }}>
                  {auctionResult.net >= 0 ? '+' : ''}{auctionResult.net} pts
                </div>
                <div style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                  Won: <strong style={{ color: '#276749' }}>+{auctionResult.gained}</strong> · Lost: <strong style={{ color: '#c53030' }}>-{auctionResult.lost}</strong> · Budget now: <strong style={{ color: getBudgetColour() }}>{budget.toLocaleString()}</strong>
                </div>
              </div>

              <button
                onClick={nextAuction}
                style={{ width: '100%', padding: '1.1rem', fontSize: '1.1rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
              >
                {currentIdx + 1 >= auctions.length ? 'See Final Results' : `Next Auction →`}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── FINISHED ──────────────────────────────────────────────────
  if (stage === 'finished') {
    const totalGained = roundResults.reduce((a, r) => a + r.gained, 0);
    const totalLost = roundResults.reduce((a, r) => a + r.lost, 0);
    const finalBudget = budget;
    const profit = finalBudget - STARTING_BUDGET;
    const pct = Math.round((finalBudget / STARTING_BUDGET) * 100);

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px 12px 0 0', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔨 Sentence Auction</h1>
          {selectedLevel && (
            <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>
              {selectedLevel.badgeLabel}
            </span>
          )}
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0 0 12px 12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', textAlign: 'center' }}>

          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>
            {pct >= 150 ? '🏆' : pct >= 120 ? '🤑' : pct >= 100 ? '😊' : pct >= 80 ? '😬' : '💸'}
          </div>
          <h2 style={{ color: '#2d3748', margin: '0 0 4px' }}>Auction Complete!</h2>
          <p style={{ color: '#718096', margin: '0 0 24px' }}>
            {pct >= 150 ? 'Outstanding grammar judgement!' : pct >= 120 ? 'Very strong — you know your grammar!' : pct >= 100 ? 'You made a profit. Good work!' : pct >= 80 ? 'A few costly mistakes, but not bad.' : 'Ouch! Those wrong bids hurt.'}
          </p>

          {/* Final budget stat */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: GRADIENT, borderRadius: '12px', padding: '1.25rem 0.75rem', color: 'white' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Final budget</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{finalBudget.toLocaleString()}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>started with {STARTING_BUDGET.toLocaleString()}</div>
            </div>
            <div style={{ background: '#f0fff4', border: '2px solid #c6f6d5', borderRadius: '12px', padding: '1.25rem 0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Won</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#276749' }}>+{totalGained}</div>
              <div style={{ fontSize: '0.8rem', color: '#718096' }}>pts from correct bids</div>
            </div>
            <div style={{ background: '#fff5f5', border: '2px solid #fed7d7', borderRadius: '12px', padding: '1.25rem 0.75rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Lost</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#c53030' }}>-{totalLost}</div>
              <div style={{ fontSize: '0.8rem', color: '#718096' }}>pts on wrong bids</div>
            </div>
          </div>

          {/* Auction-by-auction breakdown */}
          {roundResults.length > 0 && (
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#718096', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Round by round</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {roundResults.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', background: '#f7fafc', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>Auction {i + 1}</span>
                    <span style={{ fontWeight: 700, color: r.net >= 0 ? '#276749' : '#c53030', fontSize: '0.95rem' }}>
                      {r.net >= 0 ? '+' : ''}{r.net} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={restartRound} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
            <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>
            {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
