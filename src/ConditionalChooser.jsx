import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { fetchSeenMap, pickFresh } from './lib/questionFreshness';
import { LevelBadge } from './components/BadgePill';
import SentenceChallenge from './components/SentenceChallenge';
import ExplainerOverlay from './components/ExplainerOverlay';
import ConditionalCard from './components/ConditionalCard';
import ConditionalCardES from './components/ConditionalCardES';
import { byId as enCardById } from './lib/conditionalExplainEn.js';
import { byId as esCardById } from './lib/conditionalExplainEs.js';

// ─────────────────────────────────────────────────────────────────────────────
// Conditionals Chooser
//
// A conditional sentence with ONE blank. The item is tagged with a FUNCTION
// (real future / past regret / mixed time …) shown as a pill, and the task is
// "pick the form that completes this conditional". Unlike Modal Match's fixed
// keyboard, the verb forms vary too much for a palette — so each question
// carries its own four tiles in `options` (jsonb), shuffled once at fetch.
//
// Bank contract (type = 'conditional_chooser'):
//   tags[0] = function pill · tags[1] = card id in conditionalExplainEn/Es
//   options = jsonb array of exactly the tiles to show (correct_answer is one)
//   language = 'en' | 'es' | 'both' — this component serves both tracks via
//   the `language` prop (ExerciseList routes by track).
//
// Marking is client-side deterministic: the chosen tile is compared against
// correct_answer, then acceptable_alternatives[].answer (each with an optional
// register-note `feedback`). The produce loop is SentenceChallenge with
// apiType='conditional' (mark-free.js handleConditional) — v1, agreed 6 Jul.
// ─────────────────────────────────────────────────────────────────────────────

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Compare tolerantly: case-insensitive, punctuation-stripped, whitespace-collapsed.
const norm = (s) => (s || '').toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
// Normalise straight/curly apostrophes so "don't" tiles always compare cleanly.
const apos = (s) => (s || '').replace(/\u2019/g, "'");
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const LEVELS = [
  { key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2', description: 'Zero and first conditionals — real situations, now and in the future.', colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', description: 'Second and third conditionals, unless and friends — the negatives throughout.', colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘' },
  { key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2', description: 'Mixed conditionals and the formal forms — two times in one sentence.', colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓' },
];

// Map a student's CEFR level to a band. Unknown / A-level → beginner.
function chooseBand(level, counts) {
  const key = /^C/i.test(level || '') ? 'advanced' : /^B/i.test(level || '') ? 'intermediate' : 'beginner';
  if ((counts[key] || 0) > 0) return key;
  return ['intermediate', 'beginner', 'advanced'].find(k => (counts[k] || 0) > 0) || key;
}

// Follow-up Sentence Challenge prompt phrasing, keyed by function pill (tags[0]).
// English scaffolding for both tracks — the Spanish track's audience is
// native-English learners, matching the ES tense cards.
const FUNCTION_PHRASE = {
  'general truth': 'about something that is always true',
  'real future': 'about a real future possibility',
  'warning': 'to warn someone',
  'promise': 'to make a promise or an offer',
  'advice': 'to give advice',
  'hypothetical now': 'to imagine a different present',
  'past regret': 'about a past you would change',
  'criticism': 'to criticise a past action',
  'mixed time': 'mixing a past condition with a present result',
  'formal': 'in a formal register',
  'only if': 'with a condition attached',
  'preparation': 'about preparing for a possibility',
};
const functionPhrase = (fn) => FUNCTION_PHRASE[fn] || 'in a natural sentence';

// Function-pill palette. Keyed by the value stored in tags[0].
const PILL_STYLES = {
  'general truth':   { bg: '#E0F2FE', fg: '#0369A1', bd: '#7DD3FC' },
  'real future':     { bg: '#F0FFF4', fg: '#276749', bd: '#68D391' },
  'warning':         { bg: '#FFFBEB', fg: '#92400E', bd: '#FBBF24' },
  'promise':         { bg: '#FDF2F8', fg: '#9D174D', bd: '#F9A8D4' },
  'advice':          { bg: '#EEF2FF', fg: '#3730A3', bd: '#A5B4FC' },
  'hypothetical now':{ bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' },
  'past regret':     { bg: '#FFF7ED', fg: '#C2410C', bd: '#FDBA74' },
  'criticism':       { bg: '#FEE2E2', fg: '#C53030', bd: '#FC8181' },
  'mixed time':      { bg: '#ECFEFF', fg: '#155E75', bd: '#67E8F9' },
  'formal':          { bg: '#F1F5F9', fg: '#334155', bd: '#CBD5E1' },
  'only if':         { bg: '#E6FFFA', fg: '#2C7A7B', bd: '#4FD1C5' },
  'preparation':     { bg: '#FAF5FF', fg: '#6B21A8', bd: '#D6BCFA' },
};
const PILL_DEFAULT = { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' };

function FunctionPill({ fn }) {
  if (!fn) return null;
  const st = PILL_STYLES[fn] || PILL_DEFAULT;
  return (
    <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '20px', fontSize: '0.95rem', fontWeight: 700, backgroundColor: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}>
      {capFirst(fn)}
    </span>
  );
}

// One option tile.
function Tile({ label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 16px', borderRadius: '10px', fontSize: '1rem', fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#fff',
        color: active ? '#fff' : disabled ? '#a0aec0' : '#2d3748',
        border: active ? '1px solid transparent' : '1px solid #e2e8f0',
        opacity: disabled && !active ? 0.5 : 1,
        boxShadow: active ? '0 4px 12px rgba(102,126,234,0.35)' : 'none',
        transition: 'transform 0.1s ease',
      }}
    >
      {label}
    </button>
  );
}

export default function ConditionalChooser({ language = 'en', onBack, onComplete, classMode = false }) {
  const isSpanish = language === 'es';
  const cardById = isSpanish ? esCardById : enCardById;

  const [stage, setStage] = useState('loading');
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [questionCounts, setQuestionCounts] = useState({});
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [showSC, setShowSC] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [selected, setSelected] = useState(null);
  // One Sentence Challenge per FORM per visit: once a conditional's card id has
  // had its produce step, later questions on the same form skip straight to
  // Next. Survives Try Again and band switches; resets on leaving the exercise.
  const seenFormsRef = useRef(new Set());

  useEffect(() => { fetchCounts(); fetchProfile(); }, []);

  // Once profile + counts are in, auto-default to the student's band.
  useEffect(() => {
    if (autoStarted || !profileLoaded || !countsLoaded) return;
    setAutoStarted(true);
    const key = chooseBand(userProfile?.level, questionCounts);
    const lv = LEVELS.find(l => l.key === key) || LEVELS[0];
    setSelectedLevel(lv);
    fetchQuestions(lv.dbLevels);
  }, [profileLoaded, countsLoaded, autoStarted]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('level, tracks').eq('id', user.id).single();
        if (data) setUserProfile(data);
      }
    } catch (e) { console.error(e); }
    finally { setProfileLoaded(true); }
  };

  const parseOptions = (q) => {
    if (Array.isArray(q.options)) return q.options;
    try { return JSON.parse(q.options || '[]'); } catch { return []; }
  };

  const fetchCounts = async () => {
    const { data } = await supabase.from('question_bank').select('level')
      .eq('type', 'conditional_chooser')
      .in('language', [language, 'both']);
    const counts = {};
    LEVELS.forEach(lv => { counts[lv.key] = (data || []).filter(q => lv.dbLevels.includes(q.level)).length; });
    setQuestionCounts(counts);
    setCountsLoaded(true);
  };

  const fetchQuestions = async (dbLevels) => {
    // Seen-history read runs in parallel with the pool fetch (no added latency).
    // classMode skips it — teacher previews shouldn't be freshness-shaped.
    const [{ data, error }, seenMap] = await Promise.all([
      supabase.from('question_bank').select('*')
        .eq('type', 'conditional_chooser')
        .in('language', [language, 'both'])
        .in('level', dbLevels),
      classMode ? Promise.resolve(new Map()) : fetchSeenMap(supabase),
    ]);
    if (error) { console.error('Error fetching conditional chooser questions:', error); setQuestions([]); setStage('playing'); return; }
    // Least-recently-seen first, then shuffle each question's tiles ONCE here,
    // so re-renders never reshuffle.
    const prepared = pickFresh(data || [], seenMap, 10)
      .map(q => ({ ...q, _tiles: shuffleArray(parseOptions(q)) }));
    setQuestions(prepared);
    setStage('playing');
  };

  const switchBand = (key) => {
    if (selectedLevel && selectedLevel.key === key) return;
    const lv = LEVELS.find(l => l.key === key);
    if (!lv) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(lv); setCurrentQ(0); setScore(0); setFeedback(null); setShowCard(false); setSelected(null);
    setStage('loading'); fetchQuestions(lv.dbLevels);
  };

  const parseAlts = (q) => {
    if (Array.isArray(q.acceptable_alternatives)) return q.acceptable_alternatives;
    try { return JSON.parse(q.acceptable_alternatives || '[]'); } catch { return []; }
  };

  // Record the choose-step attempt so Conditionals Chooser counts on the Teacher
  // Dashboard. Mirrors RandomPracticeExercise's student_answers shape; question_bank
  // rows carry a question_number, so this flows into student_activity as normal
  // exercise activity. Fire-and-forget — never blocks the UI, never throws.
  const recordChooserAnswer = async (question, studentAnswer, isCorrect) => {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('student_answers').insert({
        student_id: user.id,
        question_id: question.question_number,
        student_answer: studentAnswer,
        correct_answer: question.correct_answer || '',
        is_correct: isCorrect,
      });
    } catch (e) { console.warn('ConditionalChooser: student_answers insert failed', e); }
  };

  const checkAnswer = () => {
    if (feedback || !selected) return;
    const q = questions[currentQ];
    const ua = norm(apos(selected));
    const primary = norm(apos(q.correct_answer || ''));
    const alts = parseAlts(q);
    const equally = (picked) =>
      [q.correct_answer, ...alts.map(a => a.answer)].filter(a => norm(apos(a)) !== picked);
    const altMatch = alts.find(a => norm(apos(a.answer)) === ua);
    const isCorrect = ua === primary || !!altMatch;
    recordChooserAnswer(q, selected, isCorrect);
    // The Sentence Challenge fires only the first time this form is shown.
    const formKey = (q.tags && q.tags[1]) || norm(apos(q.correct_answer || ''));
    const scDue = !seenFormsRef.current.has(formKey);
    seenFormsRef.current.add(formKey);
    if (ua === primary) {
      setScore(s => s + 1);
      setFeedback({ result: 'correct', note: '', answer: q.correct_answer, explanation: q.explanation || '', equally: equally(ua), scDue });
      return;
    }
    if (altMatch) {
      setScore(s => s + 1);
      setFeedback({ result: 'correct', note: altMatch.feedback || '', answer: altMatch.answer, explanation: q.explanation || '', equally: equally(ua), scDue });
      return;
    }
    setFeedback({ result: 'wrong', note: '', answer: q.correct_answer, explanation: q.explanation || '', equally: alts.map(a => a.answer), scDue });
  };

  const q = questions[currentQ];
  const qCard = q && q.tags && q.tags[1] ? cardById[q.tags[1]] : null;

  const harvestConditionalSentence = async ({ sentence, inputMethod, result }) => {
    if (classMode) return; // Class Play: teacher preview writes nothing
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'conditional_chooser',
        target: (q && q.tags && q.tags[1]) || 'conditional', sentence,
        is_correct: result?.valid === true,
        ai_feedback: result?.feedback || result?.reason || null,
        input_method: inputMethod, language, level: q ? q.level : null,
      });
    } catch (e) { console.warn('ConditionalChooser: sc_sentences insert failed', e); }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelected(null);
    setShowSC(false);
    setShowCard(false);
    if (currentQ + 1 >= questions.length) { setFeedback(null); setStage('finished'); }
    else { setCurrentQ(c => c + 1); setFeedback(null); }
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0); setScore(0); setFeedback(null); setShowSC(false); setShowCard(false); setSelected(null);
    setStage('loading'); fetchQuestions(selectedLevel.dbLevels);
  };

  // Tiny inline renderer for the **bold** / *italic* markdown used across the
  // bank's explanations — the feedback box shows it properly, not as asterisks.
  const renderMd = (text) => String(text || '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });

  // ── Sentence with blank ───────────────────────────────────────────────────
  const renderSentence = (question) => {
    const parts = (question.question || '').split(/_{2,}/);
    const before = parts[0] || '';
    const after = parts.slice(1).join(' ');
    const atStart = before.trim() === '';
    const slotText = selected ? (atStart ? capFirst(selected) : selected) : '';
    return (
      <div style={{ fontSize: '1.35rem', lineHeight: 1.6, color: '#2d3748', textAlign: 'center', margin: '0.5rem 0 1.5rem' }}>
        <span>{before}</span>
        <span style={{
          display: 'inline-block', minWidth: '120px', padding: '2px 12px', margin: '0 4px',
          borderBottom: `3px solid ${selected ? '#667eea' : '#cbd5e0'}`,
          color: selected ? '#5a3fc0' : '#a0aec0', fontWeight: 700,
        }}>
          {slotText || '\u2003\u2003\u2003'}
        </span>
        <span>{after}</span>
      </div>
    );
  };

  // ── Level switcher (auto-default band + free change) ──────────────────────
  const levelSwitcher = (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
      {LEVELS.map(l => {
        const active = selectedLevel && selectedLevel.key === l.key;
        const has = (questionCounts[l.key] || 0) > 0;
        return (
          <button key={l.key} onClick={() => switchBand(l.key)} style={{
            padding: '6px 16px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 600,
            letterSpacing: '0.02em', cursor: 'pointer', transition: 'all 0.12s',
            background: active ? l.colour : 'transparent', color: active ? '#fff' : '#718096',
            border: `1px solid ${active ? l.colour : '#e2e8f0'}`, opacity: has ? 1 : 0.6,
          }}>{l.label}{has ? '' : ' · soon'}</button>
        );
      })}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Conditionals Chooser</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{isSpanish ? 'Pick the form that completes each Spanish conditional' : 'Pick the form that completes each conditional'}</p>
        </div>

        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', marginTop: '1rem' }}>
          {(stage === 'playing' || stage === 'loading') && levelSwitcher}

          {stage === 'loading' && <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#666' }}>Loading questions...</div>}

          {stage === 'playing' && questions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧩</div>
              <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
              <p style={{ color: '#666' }}>Questions for this level are being added. Pick another level above to keep practising.</p>
            </div>
          )}

          {stage === 'playing' && q && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f7fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', color: '#4a5568', fontWeight: 500 }}>
                <span>Progress: {currentQ + 1}/{questions.length}</span>
                <span>Score: {score}/{questions.length}</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                <FunctionPill fn={(q.tags && q.tags[0]) || ''} />
                <LevelBadge level={q.level} />
              </div>
              <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.85rem', margin: '0 0 8px' }}>Choose the form that completes the conditional.</p>

              {renderSentence(q)}

              {/* This question's four tiles — shuffled once at fetch */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                {(q._tiles || []).map(opt => (
                  <Tile
                    key={opt}
                    label={opt}
                    active={selected === opt}
                    disabled={!!feedback}
                    onClick={() => { if (!feedback) setSelected(prev => (prev === opt ? null : opt)); }}
                  />
                ))}
              </div>

              {!feedback && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => setSelected(null)} disabled={!selected} style={{ padding: '10px 18px', background: 'transparent', color: selected ? '#718096' : '#cbd5e0', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: selected ? 'pointer' : 'default', fontSize: '0.95rem' }}>↺ Clear</button>
                  <button onClick={checkAnswer} disabled={!selected} style={{ padding: '10px 32px', background: selected ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0', color: selected ? 'white' : '#a0aec0', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: selected ? 'pointer' : 'default', fontSize: '1rem' }}>Check</button>
                </div>
              )}

              {feedback && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{
                    padding: '1rem 1.25rem', borderRadius: '10px',
                    background: feedback.result === 'wrong' ? '#fff5f5' : '#f0fff4',
                    border: `1px solid ${feedback.result === 'wrong' ? '#fc8181' : '#68d391'}`,
                  }}>
                    <div style={{ fontWeight: 700, color: feedback.result === 'wrong' ? '#c53030' : '#276749', marginBottom: '6px' }}>
                      {feedback.result === 'wrong'
                        ? <>❌ Not quite. The answer here is <span style={{ textDecoration: 'underline' }}>{feedback.answer}</span>.</>
                        : <>✅ Correct!</>}
                    </div>
                    {feedback.equally && feedback.equally.length > 0 && (
                      <div style={{ color: feedback.result === 'wrong' ? '#c53030' : '#276749', marginBottom: '6px', fontSize: '0.95rem' }}>
                        Equally correct: {feedback.equally.map((a, i) => (
                          <span key={i}><em>{a}</em>{i < feedback.equally.length - 1 ? ' · ' : ''}</span>
                        ))}
                      </div>
                    )}
                    {feedback.note && <div style={{ color: '#4a5568', marginBottom: '6px', fontStyle: 'italic' }}>{renderMd(feedback.note)}</div>}
                    {feedback.explanation && <div style={{ color: '#4a5568', lineHeight: 1.5 }}>{renderMd(feedback.explanation)}</div>}
                  </div>
                  {!showSC && (
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
                      {feedback.scDue ? (
                        <button onClick={() => setShowSC(true)} style={{ padding: '10px 32px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
                          ✏️ Your turn →
                        </button>
                      ) : (
                        <button onClick={nextQuestion} style={{ padding: '10px 32px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
                          Next →
                        </button>
                      )}
                      {qCard && (
                        <button onClick={() => setShowCard(true)} style={{ padding: '10px 20px', background: 'white', color: '#553C9A', border: '1px solid #D6BCFA', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>
                          📖 See the full card
                        </button>
                      )}
                    </div>
                  )}
                  {showSC && (
                    <SentenceChallenge
                      key={currentQ}
                      word={qCard ? qCard.short : feedback.answer}
                      language={language}
                      exercise="conditional_chooser"
                      noStars={classMode}
                      headerLabel="✏️ YOUR TURN — NOW PRODUCE IT"
                      promptText={<strong style={{ color: '#2d3748' }}>Now write your own {isSpanish ? 'Spanish ' : ''}sentence with this structure <span style={{ background: '#EDE9FE', color: '#553C9A', padding: '1px 6px', borderRadius: '4px' }}>{functionPhrase((q.tags && q.tags[0]) || '')}</span>:</strong>}
                      apiType="conditional"
                      apiExtraFields={{ conditionalName: qCard ? qCard.name : 'conditional', structure: qCard ? qCard.formula : '', level: q.level }}
                      onMarkResult={harvestConditionalSentence}
                      onClose={nextQuestion}
                    />
                  )}
                  {showCard && qCard && (
                    <ExplainerOverlay open onClose={() => setShowCard(false)}>
                      {isSpanish
                        ? <ConditionalCardES card={qCard} />
                        : <ConditionalCard card={qCard} />}
                    </ExplainerOverlay>
                  )}
                </div>
              )}
            </>
          )}

          {stage === 'finished' && (
            <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
              <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{score}/{questions.length}</div>
              <p style={{ color: '#4a5568' }}>{score >= 9 ? 'Outstanding — your conditionals are rock solid!' : score >= 7 ? 'Great work — your conditionals are strong.' : score >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
              <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={restartExercise} style={{ padding: '10px 24px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}>Try Again</button>
                {onBack && <button onClick={onBack} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '1rem' }}>Back to Exercises</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
