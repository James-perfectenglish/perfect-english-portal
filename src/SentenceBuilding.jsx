import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SentenceBuildingInput from './components/SentenceBuildingInput';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const LEVELS = [
  { key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2', badgeLabel: 'Level: A2 Elementary', description: 'Simple sentences with common vocabulary and basic grammar structures.', colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', badgeLabel: 'Level: B1-B2', description: 'Longer sentences with phrasal verbs, conditionals, and more complex structures.', colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘' },
  { key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2', badgeLabel: 'Level: C1-C2 Advanced', description: 'Complex sentences with advanced grammar, idioms, and nuanced word order.', colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓' }
];

export default function SentenceBuilding({ onBack, onComplete, userTracks = [] }) {
  const [stage, setStage] = useState('level-select');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [hasAnswer, setHasAnswer] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const isSpanish = userTracks.includes('spanish') || userProfile?.level === 'Spanish' || (userProfile?.tracks || []).includes('spanish');

  useEffect(() => { fetchCounts(); fetchUserProfile(); }, []);

  useEffect(() => {
    if (!userProfile) return;
    if (isSpanish && stage === 'level-select') {
      setStage('loading');
      fetchQuestions([]);
    }
  }, [userProfile, userTracks]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('level, tracks').eq('id', user.id).single();
      if (data) setUserProfile(data);
    } catch (e) { console.error(e); }
  };

  const fetchCounts = async () => {
    const { data } = await supabase.from('question_bank').select('level')
      .eq('type', 'sentence_building')
      .in('language', ['en', 'both']);
    if (data) {
      const counts = {};
      LEVELS.forEach(lv => { counts[lv.key] = data.filter(q => lv.dbLevels.includes(q.level)).length; });
      setQuestionCounts(counts);
    }
  };

  const selectLevel = (level) => {
    if ((questionCounts[level.key] || 0) === 0) return;
    setSelectedLevel(level); setStage('loading'); fetchQuestions(level.dbLevels);
  };

  const fetchQuestions = async (dbLevels) => {
    const spanish = dbLevels.length === 0;
    let query = supabase.from('question_bank').select('*')
      .eq('type', 'sentence_building')
      .in('language', spanish ? ['es', 'both'] : ['en', 'both']);
    if (!spanish && dbLevels.length > 0) query = query.in('level', dbLevels);
    const { data, error } = await query;
    if (error) { console.error('Error fetching questions:', error); setStage('playing'); return; }
    if (data && data.length > 0) {
      const translation = shuffleArray(data.filter(q => q.question && q.question.trim() !== ''));
      const build = shuffleArray(data.filter(q => !q.question || q.question.trim() === ''));
      let combined = shuffleArray([...translation.slice(0, 5), ...build.slice(0, 5)]);
      if (combined.length < 10) {
        const usedIds = new Set(combined.map(q => q.id));
        combined.push(...shuffleArray(data.filter(q => !usedIds.has(q.id))).slice(0, 10 - combined.length));
      }
      setQuestions(combined.slice(0, 10));
    }
    setStage('playing');
  };

  const handleResult = (isCorrect) => {
    const q = questions[currentQ];
    if (isCorrect) {
      setScore(s => s + 1);
      setFeedback({ correct: true, message: `✅ Correct! ${q.explanation || ''}` });
    } else {
      const displaySentence = (q.correct_answer || '').replace(/ ([.,?!;:])/g, '$1').replace(/^(\w)/, m => m.toUpperCase());
      setFeedback({ correct: false, message: `❌ Not quite. The correct answer is: "${displaySentence}" — ${q.explanation || ''}` });
    }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (currentQ + 1 >= questions.length) setStage('finished');
    else { setCurrentQ(c => c + 1); setFeedback(null); setHasAnswer(false); }
  };

  const backToLevelSelect = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (isSpanish) {
      setQuestions([]); setCurrentQ(0); setScore(0); setFeedback(null); setHasAnswer(false);
      setStage('loading'); fetchQuestions([]);
    } else {
      setSelectedLevel(null); setQuestions([]); setCurrentQ(0); setScore(0);
      setFeedback(null); setHasAnswer(false); setStage('level-select'); fetchCounts();
    }
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0); setScore(0); setFeedback(null); setHasAnswer(false);
    setStage('loading'); fetchQuestions(isSpanish ? [] : selectedLevel.dbLevels);
  };

  const q = questions[currentQ];

  const getQuestionProps = (question) => {
    if (!question) return {};
    const options = Array.isArray(question.options) ? question.options : JSON.parse(question.options || '[]');
    const hasPrompt = question.question && question.question.trim() !== '';
    return {
      words: options,
      questionType: hasPrompt ? 'translation' : 'build',
      prompt: hasPrompt ? question.question : null,
      correctSentences: [question.correct_answer || ''],
      explanation: question.explanation || ''
    };
  };

  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Sentence Building</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Build correct sentences by putting words in the right order</p>
        </div>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
          <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
          <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to start practising</p>
          <div style={{ display: 'grid', gap: '16px' }}>
            {LEVELS.map(level => {
              const count = questionCounts[level.key] || 0;
              const available = count > 0;
              return (
                <div key={level.key} onClick={() => available && selectLevel(level)}
                  style={{ border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb', opacity: available ? 1 : 0.55, transition: 'transform 0.15s ease, box-shadow 0.15s ease', display: 'flex', alignItems: 'center', gap: '1rem' }}
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

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Sentence Building</h1>
        <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Drag the words into the correct order to build sentences</p>
        {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.badgeLabel}</span>}
      </div>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        {stage === 'loading' && <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#666' }}>Loading questions...</div>}
        {stage === 'playing' && questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
            <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
            <p style={{ color: '#666' }}>Questions for this level are being added.</p>
            <button onClick={backToLevelSelect} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>← {isSpanish ? 'Try Again' : 'Choose Another Level'}</button>
          </div>
        )}
        {stage === 'playing' && q && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
              <span>Progress: {currentQ + 1}/{questions.length}</span>
              <span>Score: {score}/{questions.length}</span>
            </div>
            <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
                {q.level && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: q.level.startsWith('A') ? '#c6f6d5' : q.level.startsWith('B') ? '#bee3f8' : '#feebc8', color: q.level.startsWith('A') ? '#276749' : q.level.startsWith('B') ? '#2b6cb0' : '#c05621', border: q.level.startsWith('A') ? '1px solid #48bb78' : q.level.startsWith('B') ? '1px solid #4299e1' : '1px solid #ed8936' }}>{q.level}</div>}
                {q.topic && <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', backgroundColor: '#e8daef', color: '#6c3483', border: '1px solid #805ad5' }}>{q.topic.replace(/_/g, ' ').replace(/\w/g, c => c.toUpperCase())}</div>}
              </div>
              <SentenceBuildingInput key={currentQ} {...getQuestionProps(q)} disabled={!!feedback} onResult={handleResult} feedback={feedback} showCheckButton={true} onAnswerReady={setHasAnswer} />
              {feedback && (
                <button onClick={nextQuestion} style={{ width: '100%', padding: '1rem', marginTop: '0.75rem', fontSize: '1rem', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                  {currentQ + 1 >= questions.length ? 'See Results' : 'Next Question →'}
                </button>
              )}
            </div>
          </>
        )}
        {stage === 'finished' && (
          <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center', marginTop: '1rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
            <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{score}/{questions.length}</div>
            <p style={{ color: '#4a5568' }}>{score >= 9 ? 'Outstanding! Perfect sentence construction.' : score >= 7 ? 'Great work! Your sentence building is strong.' : score >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
              {!isSpanish && <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Change Level</button>}
              {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
