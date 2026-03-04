import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import MatchingPairs from './components/MatchingPairs';

function shuffleArray(arr) {
  const s = [...arr];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

const LEVELS = [
  {
    key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2', badgeLabel: 'Level: A1-A2',
    description: 'Match basic vocabulary — translations, everyday words, and simple pictures.',
    colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱',
  },
  {
    key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', badgeLabel: 'Level: B1-B2',
    description: 'Match collocations, definitions, and sound-alike words.',
    colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘',
  },
  {
    key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2', badgeLabel: 'Level: C1-C2',
    description: 'Match subtle distinctions, homophones, and advanced vocabulary.',
    colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓',
  },
];

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const QUESTIONS_PER_ROUND = 8;

function buildQuestionList(data) {
  const sequenced = data.filter(q => q.sequence_group);
  const free = data.filter(q => !q.sequence_group);
  const groups = {};
  sequenced.forEach(q => {
    if (!groups[q.sequence_group]) groups[q.sequence_group] = [];
    groups[q.sequence_group].push(q);
  });
  Object.values(groups).forEach(g => g.sort((a, b) => a.sequence_order - b.sequence_order));
  const blocks = [...Object.values(groups), ...free.map(q => [q])];
  return shuffleArray(blocks).flat().slice(0, QUESTIONS_PER_ROUND);
}

export default function MatchingExercise({ onBack, onComplete, topicFilter }) {
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [questionResult, setQuestionResult] = useState(null);

  useEffect(() => { fetchCounts(); }, []);

  const fetchCounts = async () => {
    let query = supabase
      .from('question_bank')
      .select('level')
      .eq('type', 'matching')
      .neq('topic', 'spanish');          // ← fix: exclude spanish
    if (topicFilter) query = query.eq('topic', topicFilter);
    const { data } = await query;
    if (data) {
      const counts = {};
      LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length; });
      setQuestionCounts(counts);
    }
  };

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level);
    setStage('loading');
    fetchQuestions(level.dbLevels);
  };

  const fetchQuestions = async (dbLevels) => {
    let query = supabase
      .from('question_bank')
      .select('*')
      .eq('type', 'matching')
      .neq('topic', 'spanish')           // ← fix: exclude spanish
      .in('level', dbLevels);
    if (topicFilter) query = query.eq('topic', topicFilter);
    const { data, error } = await query;
    if (error) { console.error('Matching fetch error:', error); setStage('playing'); return; }
    const ordered = data && data.length > 0 ? buildQuestionList(data) : [];
    setQuestions(ordered);
    setCurrentQ(0); setScore(0); setQuestionResult(null);
    setStage('playing');
  };

  const saveAnswer = async (q, isCorrect, wrongAttempts) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: q.question_number,
        student_answer: isCorrect ? 'all_matched_clean' : `${wrongAttempts}_wrong_attempt${wrongAttempts !== 1 ? 's' : ''}`,
        correct_answer: 'match_all_pairs',
        is_correct: isCorrect,
      });
    } catch (e) { console.error('Save answer error:', e); }
  };

  const handleResult = (isCorrect, wrongAttempts) => {
    setQuestionResult({ isCorrect, wrongAttempts });
    if (isCorrect) setScore(s => s + 1);
    saveAnswer(questions[currentQ], isCorrect, wrongAttempts);
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const nextIdx = currentQ + 1;
    setQuestionResult(null);
    if (nextIdx >= questions.length) { setStage('finished'); }
    else { setCurrentQ(nextIdx); }
  };

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(null); setQuestions([]); setCurrentQ(0); setScore(0);
    setQuestionResult(null); setStage('level-select'); fetchCounts();
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setStage('loading');
    fetchQuestions(selectedLevel.dbLevels);
  };

  const q = questions[currentQ];
  const parsedPairs = q ? (Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')) : [];

  // ── LEVEL SELECT ────────────────────────────────────────────
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔗 Matching</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Match the pairs — translations, definitions, and sounds</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start practising</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)} style={{
                  border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem',
                  cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb',
                  opacity: available ? 1 : 0.55, transition: 'transform 0.15s ease, box-shadow 0.15s ease',
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
                      {available ? `${count} set${count !== 1 ? 's' : ''} available` : 'Coming soon'}
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
      </div>
    );
  }

  // ── EXERCISE ────────────────────────────────────────────
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔗 Matching</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>👆Tap any tile, then tap its match on the other side</p>
        {selectedLevel && (
          <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>
        )}
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading...</div>}
        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔗</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Matching sets for this level are being added. Check back soon!</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Choose Another Level</button>
          </div>
        )}
        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Set: {currentQ + 1} / {questions.length}</span>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {q.sequence_group && (
                  <span style={{ fontSize: '0.78rem', background: '#EDE9FE', color: '#553C9A', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>Part {q.sequence_order}</span>
                )}
                <span>Score: {score} / {currentQ + (questionResult ? 1 : 0)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '16px' }}>
              {q.level && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8', color: q.level.startsWith('A') ? '#276749' : q.level.startsWith('B') ? '#2b6cb0' : '#c05621' }}>{q.level}</div>}
              {q.topic && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: '#e8daef', color: '#6c3483' }}>{q.topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>}
            </div>
            {q.question && q.question.trim() && (
              <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.15rem)', color: '#2d3748', fontWeight: 500, marginBottom: '20px', lineHeight: 1.5 }}>{q.question}</div>
            )}
            <MatchingPairs key={currentQ} pairs={parsedPairs} disabled={!!questionResult} onResult={handleResult} />
            {questionResult && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ backgroundColor: questionResult.isCorrect ? '#f0fff4' : '#fff3cd', border: `1px solid ${questionResult.isCorrect ? '#c6f6d5' : '#feebc8'}`, color: questionResult.isCorrect ? '#276749' : '#856404', padding: '1rem 1.25rem', borderRadius: '10px', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', lineHeight: '1.6', marginBottom: '1rem' }}>
                  {questionResult.isCorrect ? '✅ Perfect! All pairs matched correctly.' : `👍 All matched! You had ${questionResult.wrongAttempts} wrong attempt${questionResult.wrongAttempts !== 1 ? 's' : ''} along the way.`}
                  {q.explanation && <div style={{ marginTop: '8px', opacity: 0.85 }}>{q.explanation}</div>}
                </div>
                <button onClick={nextQuestion} style={{ width: '100%', padding: '1rem', fontSize: '1rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                  {currentQ + 1 >= questions.length ? 'See Results' : 'Next Set →'}
                </button>
              </div>
            )}
          </>
        )}
        {stage === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= questions.length * 0.9 ? '🏆' : score >= questions.length * 0.7 ? '⭐' : score >= questions.length * 0.5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, margin: '12px 0', color: score >= questions.length * 0.7 ? '#48bb78' : score >= questions.length * 0.5 ? '#ed8936' : '#f56565' }}>{score} / {questions.length}</div>
            <p style={{ color: '#4a5568' }}>
              {score >= questions.length * 0.9 ? 'Outstanding! Flawless matching — you really know your vocabulary connections.' : score >= questions.length * 0.7 ? 'Great work! Strong vocabulary connections.' : score >= questions.length * 0.5 ? 'Good effort. Keep building those vocabulary links.' : 'Keep going — the connections will come with practice!'}
            </p>
            <p style={{ color: '#718096', fontSize: '0.88rem' }}>A point is awarded for each set matched with no wrong attempts.</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
              <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>
              {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
