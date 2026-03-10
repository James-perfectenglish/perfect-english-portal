import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { LevelBadge, TopicBadge } from './components/BadgePill';

// Inject global CSS to kill all browser outlines on option tiles
const STYLE_ID = 'ooo-focus-fix';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ooo-option, .ooo-option:focus, .ooo-option:focus-visible, .ooo-option:focus-within, 
    .ooo-option:active, .ooo-option:visited, .ooo-option:target, .ooo-option * { 
      outline: none !important; 
      outline-width: 0 !important;
      -webkit-tap-highlight-color: transparent !important; 
    }
  `;
  document.head.appendChild(style);
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const LEVELS = [
  {
    key: 'beginner',
    label: 'Beginner',
    sublabel: 'A1 – A2',
    badgeLabel: 'Level: A1-A2',
    description: 'Basic vocabulary categories — colours, animals, food, everyday objects.',
    colour: '#48bb78',
    colourLight: '#f0fff4',
    dbLevels: ['A1', 'A2'],
    icon: '🌱'
  },
  {
    key: 'intermediate',
    label: 'Intermediate',
    sublabel: 'B1 – B2',
    badgeLabel: 'Level: B1-B2',
    description: 'Grammar categories, collocations, phrasal verbs, and word families.',
    colour: '#4299e1',
    colourLight: '#ebf8ff',
    dbLevels: ['B1', 'B2'],
    icon: '📘'
  },
  {
    key: 'advanced',
    label: 'Advanced',
    sublabel: 'C1 – C2',
    badgeLabel: 'Level: C1-C2',
    description: 'Subtle distinctions, formal vs informal register, advanced word groups.',
    colour: '#ed8936',
    colourLight: '#fffaf0',
    dbLevels: ['C1', 'C2'],
    icon: '🎓'
  }
];

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const QUESTIONS_PER_ROUND = 10;

export default function OddOneOut({ onBack, onComplete, topicFilter }) {
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { fetchCounts(); }, []);

  const fetchCounts = async () => {
    let query = supabase.from('question_bank').select('level').eq('type', 'odd_one_out');
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
    let query = supabase.from('question_bank').select('*').eq('type', 'odd_one_out').in('level', dbLevels);
    if (topicFilter) query = query.eq('topic', topicFilter);
    const { data, error } = await query;
    if (error) { console.error('Error:', error); setStage('playing'); return; }
    if (data && data.length > 0) setQuestions(shuffleArray(data).slice(0, QUESTIONS_PER_ROUND));
    setStage('playing');
  };

  const saveAnswer = async (question, studentAnswer, isCorrect) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: question.question_number,
        student_answer: studentAnswer,
        correct_answer: question.correct_answer || '',
        is_correct: isCorrect
      });
    } catch (error) { console.error('Error saving answer:', error); }
  };

  const handleSelect = (option) => {
    if (feedback) return;
    setSelected(option);
    const q = questions[currentQ];
    const oddOne = q.correct_answer || '';
    const isCorrect = option.toLowerCase().trim() === oddOne.toLowerCase().trim();

    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback({ correct: true, oddOne, message: `✅ Correct! "${oddOne}" is the odd one out. ${q.explanation || ''}` });
    } else {
      setFeedback({ correct: false, oddOne, message: `❌ Not quite. "${oddOne}" is the odd one out. ${q.explanation || ''}` });
    }
    saveAnswer(q, option, isCorrect);
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (currentQ + 1 >= questions.length) { setStage('finished'); }
    else { setCurrentQ(c => c + 1); setSelected(null); setFeedback(null); }
  };

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(null); setQuestions([]); setCurrentQ(0); setScore(0);
    setSelected(null); setFeedback(null); setStage('level-select'); fetchCounts();
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0); setScore(0); setSelected(null); setFeedback(null);
    setStage('loading'); fetchQuestions(selectedLevel.dbLevels);
  };

  const q = questions[currentQ];

  const getOptionStyle = (option) => {
    const base = {
      padding: 'clamp(8px, 2.5vw, 10px) clamp(12px, 3vw, 16px)',
      borderRadius: '8px',
      border: 'none',
      boxShadow: 'inset 0 0 0 2px #e2e8f0',
      cursor: feedback ? 'default' : 'pointer',
      fontSize: 'clamp(0.9rem, 3.2vw, 1.1rem)',
      fontWeight: '500',
      textAlign: 'center',
      transition: 'all 0.2s ease',
      backgroundColor: 'white',
      color: '#2d3748',
      minHeight: '55px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      outline: 'none',
      WebkitTapHighlightColor: 'transparent'
    };
    if (!feedback) {
      if (selected === option) return { ...base, boxShadow: 'inset 0 0 0 2px #667eea', backgroundColor: '#EDE9FE', color: '#553C9A' };
      return base;
    }
    const oddOne = feedback.oddOne;
    const isOdd = option.toLowerCase().trim() === oddOne.toLowerCase().trim();
    const wasSelected = selected === option;
    if (isOdd) return { ...base, boxShadow: 'inset 0 0 0 2px #48bb78, 0 0 0 3px rgba(72, 187, 120, 0.3)', backgroundColor: '#f0fff4', color: '#276749' };
    if (wasSelected && !feedback.correct) return { ...base, boxShadow: 'inset 0 0 0 2px #f56565', backgroundColor: '#fff5f5', color: '#c53030' };
    return { ...base, opacity: 0.5 };
  };

  // LEVEL SELECT
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔍 Odd One Out</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Find the word that doesn't belong in each group</p>
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
                  display: 'flex', alignItems: 'center', gap: '1rem'
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
                      {available ? `${count} question${count !== 1 ? 's' : ''} available` : 'Coming soon'}
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

  // EXERCISE
  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🔍 Odd One Out</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Find the word that doesn't belong</p>
        {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
      </div>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading questions...</div>}
        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Questions for this level are being added. Check back soon!</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← Choose Another Level</button>
          </div>
        )}
        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Progress: {currentQ + 1}/{questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>
            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              {/* ── Badges ── */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                <LevelBadge level={q.level} />
                <TopicBadge topic={q.topic} />
              </div>
              <div style={{ fontSize: 'clamp(1.05rem, 3.5vw, 1.2rem)', color: '#2d3748', fontWeight: '500', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {q.question && q.question.trim() !== '' ? q.question : 'Which one doesn\'t belong? Tap the odd one out.'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1rem' }}>
                {(Array.isArray(q.options) ? q.options : JSON.parse(q.options || '[]')).map((option, idx) => (
                  <div key={idx} className="ooo-option" tabIndex={-1} onClick={() => handleSelect(option)} style={getOptionStyle(option)}
                    onMouseEnter={e => { if (!feedback) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #667eea'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                    onMouseLeave={e => { if (!feedback && selected !== option) { e.currentTarget.style.boxShadow = 'inset 0 0 0 2px #e2e8f0'; e.currentTarget.style.transform = 'none'; } }}
                  >{option}</div>
                ))}
              </div>
              {feedback && <div style={{ backgroundColor: feedback.correct ? '#f0fff4' : '#fff5f5', border: `1px solid ${feedback.correct ? '#c6f6d5' : '#fed7d7'}`, color: feedback.correct ? '#276749' : '#9b2c2c', padding: '1rem 1.25rem', borderRadius: '10px', fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', lineHeight: '1.6', marginBottom: '0.75rem' }}>{feedback.message}</div>}
              {feedback && <button onClick={nextQuestion} style={{ width: '100%', padding: '1rem', marginTop: '0.5rem', fontSize: '1rem', background: GRADIENT, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>{currentQ + 1 >= questions.length ? 'See Results' : 'Next Question →'}</button>}
            </div>
          </>
        )}
        {stage === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, margin: '12px 0', color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565' }}>{score}/{questions.length}</div>
            <p style={{ color: '#4a5568' }}>
              {score >= 9 ? 'Outstanding! You really know your word groups.' : score >= 7 ? 'Great work! Strong vocabulary knowledge.' : score >= 5 ? 'Good effort. Keep building your vocabulary.' : 'Keep going — practice makes perfect!'}
            </p>
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
