import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { LevelBadge } from './components/BadgePill';
import SentenceChallenge from './components/SentenceChallenge';

// ─────────────────────────────────────────────────────────────────────────────
// Modal Chooser
//
// A sentence with a blank where a modal goes. The item is tagged with a
// FUNCTION (advice / prohibition / deduction …) shown as a pill, and the task
// is "use the appropriate modal for this function" — the pill is the scaffold.
//
// The palette is a FIXED keyboard shown every item; the other modals on the
// board are automatically fair distractors. Level gates which TOGGLES are live
// (n't, have), not which base tiles show.
//
// Entry: auto-defaults to the student's band (from profile), with an inline
// level switcher to change band or peek at levels still being built — closest
// in feel to the Tense Explainer / Tagger.
//
// Marking is client-side deterministic: the assembled modal is compared against
// correct_answer, then against acceptable_alternatives[].answer (each carries an
// optional register-note `feedback`). No AI / server marking.
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

const LEVELS = [
  { key: 'beginner', label: 'Beginner', sublabel: 'A1 – A2', description: 'Core modals for ability, permission, obligation and requests.', colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', description: 'Deduction, prohibition, advice, warnings and wish forms — negatives and perfect forms unlock here.', colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘' },
  { key: 'advanced', label: 'Advanced', sublabel: 'C1 – C2', description: 'Advanced modal nuance.', colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓' },
];

// Map a student's CEFR level to a band. Unknown / A-level → beginner.
function chooseBand(level, counts) {
  const key = /^C/i.test(level || '') ? 'advanced' : /^B/i.test(level || '') ? 'intermediate' : 'beginner';
  if ((counts[key] || 0) > 0) return key;
  // Natural band has no content yet (e.g. C-level before advanced items land) —
  // fall back to a populated band so the student lands in practice, not a wall.
  return ['intermediate', 'beginner', 'advanced'].find(k => (counts[k] || 0) > 0) || key;
}

// Fixed palette. Base modals always show (distractors are the point).
const BASE_MODALS = ['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would'];

// n't assembly is a lookup, not string concatenation (won't / shan't / can't …).
const NEG = {
  can: "can't", could: "couldn't", may: 'may not', might: "mightn't",
  must: "mustn't", shall: "shan't", should: "shouldn't", will: "won't", would: "wouldn't",
};

// Lexical tiles — kept separate from the perfect `have` toggle so we never build
// "must have to". These stand on their own.
const LEXICAL = ['have to', "don't have to", "needn't", 'ought to', 'had better'];

// Follow-up Sentence Challenge prompt phrasing, keyed by function pill.
const FUNCTION_PHRASE = {
  'ability': 'to talk about an ability',
  'permission': 'to give or ask permission',
  'possibility': 'to talk about a possibility',
  'deduction': 'to make a confident deduction',
  'deduction — negative': 'to say something is impossible',
  'obligation': 'to express an obligation',
  'prohibition': 'to forbid something',
  'absence of obligation': "to say something isn't necessary",
  'advice': 'to give advice',
  'warning': 'to give a warning',
  'request': 'to make a polite request',
  'offer': 'to offer to help',
  'annoying habit': 'to complain about an annoying habit (I wish you…)',
  'hypothetical wish': 'to make a wish (If only…)',
  'expectation': 'to say what you expect',
  'suggestion': 'to make a suggestion (Shall we…?)',
};
const functionPhrase = (fn) => FUNCTION_PHRASE[fn] || 'in a natural sentence';

// Function-pill palette. Keyed by the value stored in tags[0].
const PILL_STYLES = {
  'ability':               { bg: '#EBF8FF', fg: '#2B6CB0', bd: '#63B3ED' },
  'permission':            { bg: '#F0FFF4', fg: '#276749', bd: '#68D391' },
  'possibility':           { bg: '#E0F2FE', fg: '#0369A1', bd: '#7DD3FC' },
  'deduction':             { bg: '#FAF5FF', fg: '#6B21A8', bd: '#D6BCFA' },
  'deduction — negative':  { bg: '#F3E8FF', fg: '#553C9A', bd: '#C4B5FD' },
  'obligation':            { bg: '#FFFAF0', fg: '#C05621', bd: '#F6AD55' },
  'prohibition':           { bg: '#FEE2E2', fg: '#C53030', bd: '#FC8181' },
  'absence of obligation': { bg: '#E6FFFA', fg: '#2C7A7B', bd: '#4FD1C5' },
  'advice':                { bg: '#EEF2FF', fg: '#3730A3', bd: '#A5B4FC' },
  'warning':               { bg: '#FFFBEB', fg: '#92400E', bd: '#FBBF24' },
  'request':               { bg: '#FFF1F2', fg: '#BE123C', bd: '#FDA4AF' },
  'offer':                 { bg: '#FDF2F8', fg: '#9D174D', bd: '#F9A8D4' },
  'annoying habit':        { bg: '#F1F5F9', fg: '#334155', bd: '#CBD5E1' },
  'hypothetical wish':     { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' },
};
const PILL_DEFAULT = { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' };

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// Normalise straight/curly apostrophes so "needn't" tiles always compare cleanly.
const apos = (s) => (s || '').replace(/\u2019/g, "'");

function FunctionPill({ fn }) {
  if (!fn) return null;
  const st = PILL_STYLES[fn] || PILL_DEFAULT;
  return (
    <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '20px', fontSize: '0.95rem', fontWeight: 700, backgroundColor: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}>
      {capFirst(fn)}
    </span>
  );
}

// One palette tile.
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
        opacity: disabled ? 0.5 : 1,
        boxShadow: active ? '0 4px 12px rgba(102,126,234,0.35)' : 'none',
        transition: 'transform 0.1s ease',
      }}
    >
      {label}
    </button>
  );
}

export default function ModalChooser({ onBack, onComplete, userTracks = [] }) {
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

  // Answer-builder state
  const [selectedBase, setSelectedBase] = useState(null);
  const [negOn, setNegOn] = useState(false);
  const [haveOn, setHaveOn] = useState(false);
  const [selectedLexical, setSelectedLexical] = useState(null);

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

  const togglesLive = selectedLevel && selectedLevel.key !== 'beginner';

  const assembled = selectedLexical
    ? apos(selectedLexical)
    : selectedBase
      ? (negOn ? (NEG[selectedBase] || selectedBase) : selectedBase) + (haveOn ? ' have' : '')
      : '';

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

  const fetchCounts = async () => {
    const { data } = await supabase.from('question_bank').select('level')
      .eq('type', 'modal_chooser')
      .in('language', ['en', 'both']);
    const counts = {};
    LEVELS.forEach(lv => { counts[lv.key] = (data || []).filter(q => lv.dbLevels.includes(q.level)).length; });
    setQuestionCounts(counts);
    setCountsLoaded(true);
  };

  const fetchQuestions = async (dbLevels) => {
    const { data, error } = await supabase.from('question_bank').select('*')
      .eq('type', 'modal_chooser')
      .in('language', ['en', 'both'])
      .in('level', dbLevels);
    if (error) { console.error('Error fetching modal chooser questions:', error); setQuestions([]); setStage('playing'); return; }
    setQuestions(shuffleArray(data || []).slice(0, 10));
    setStage('playing');
  };

  const switchBand = (key) => {
    if (selectedLevel && selectedLevel.key === key) return;
    const lv = LEVELS.find(l => l.key === key);
    if (!lv) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    setSelectedLevel(lv); setCurrentQ(0); setScore(0); setFeedback(null); resetBuilder();
    setStage('loading'); fetchQuestions(lv.dbLevels);
  };

  const resetBuilder = () => { setSelectedBase(null); setNegOn(false); setHaveOn(false); setSelectedLexical(null); };

  const pickBase = (m) => {
    if (feedback) return;
    setSelectedLexical(null);
    setSelectedBase(prev => (prev === m ? null : m));
  };

  const pickLexical = (l) => {
    if (feedback) return;
    setSelectedBase(null); setNegOn(false); setHaveOn(false);
    setSelectedLexical(prev => (prev === l ? null : l));
  };

  const parseAlts = (q) => {
    if (Array.isArray(q.acceptable_alternatives)) return q.acceptable_alternatives;
    try { return JSON.parse(q.acceptable_alternatives || '[]'); } catch { return []; }
  };

  const checkAnswer = () => {
    if (feedback || !assembled) return;
    const q = questions[currentQ];
    const ua = norm(apos(assembled));
    const primary = norm(apos(q.correct_answer || ''));
    if (ua === primary) {
      setScore(s => s + 1);
      setFeedback({ result: 'correct', note: '', answer: q.correct_answer, explanation: q.explanation || '' });
      return;
    }
    const match = parseAlts(q).find(a => norm(apos(a.answer)) === ua);
    if (match) {
      setScore(s => s + 1);
      setFeedback({ result: 'soft', note: match.feedback || '', answer: q.correct_answer, explanation: q.explanation || '' });
      return;
    }
    setFeedback({ result: 'wrong', note: '', answer: q.correct_answer, explanation: q.explanation || '' });
  };

  const harvestModalSentence = async ({ sentence, inputMethod, result }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('sc_sentences').insert({
        student_id: user.id, source: 'modal_match',
        target: (q && q.tags && q.tags[0]) || 'modal', sentence,
        is_correct: result?.valid === true,
        ai_feedback: result?.feedback || result?.reason || null,
        input_method: inputMethod, language: 'en', level: q ? q.level : null,
      });
    } catch (e) { console.warn('ModalMatch: sc_sentences insert failed', e); }
  };

  const nextQuestion = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    resetBuilder();
    if (currentQ + 1 >= questions.length) { setFeedback(null); setStage('finished'); }
    else { setCurrentQ(c => c + 1); setFeedback(null); }
  };

  const restartExercise = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentQ(0); setScore(0); setFeedback(null); resetBuilder();
    setStage('loading'); fetchQuestions(selectedLevel.dbLevels);
  };

  const q = questions[currentQ];

  // ── Sentence with blank ───────────────────────────────────────────────────
  const renderSentence = (question) => {
    const parts = (question.question || '').split(/_{2,}/);
    const before = parts[0] || '';
    const after = parts.slice(1).join(' ');
    const atStart = before.trim() === '';
    const slotText = assembled ? (atStart ? capFirst(assembled) : assembled) : '';
    return (
      <div style={{ fontSize: '1.35rem', lineHeight: 1.6, color: '#2d3748', textAlign: 'center', margin: '0.5rem 0 1.5rem' }}>
        <span>{before}</span>
        <span style={{
          display: 'inline-block', minWidth: '120px', padding: '2px 12px', margin: '0 4px',
          borderBottom: `3px solid ${assembled ? '#667eea' : '#cbd5e0'}`,
          color: assembled ? '#5a3fc0' : '#a0aec0', fontWeight: 700,
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
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Modal Match</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Pick the right modal verb for each function</p>
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
              <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.85rem', margin: '0 0 8px' }}>Choose the best modal for this function.</p>

              {renderSentence(q)}

              {/* Base modal palette */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                {BASE_MODALS.map(m => (
                  <Tile key={m} label={negOn && selectedBase === m ? (NEG[m] || m) : m} active={selectedBase === m} disabled={!!feedback} onClick={() => pickBase(m)} />
                ))}
              </div>

              {/* Toggles (level-gated) */}
              {togglesLive && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                  <Tile label="+ n't" active={negOn} disabled={!!feedback || !selectedBase} onClick={() => selectedBase && setNegOn(v => !v)} />
                  <Tile label="+ have" active={haveOn} disabled={!!feedback || !selectedBase} onClick={() => selectedBase && setHaveOn(v => !v)} />
                </div>
              )}

              {/* Lexical tiles */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
                {LEXICAL.map(l => (
                  <Tile key={l} label={l} active={selectedLexical === l} disabled={!!feedback} onClick={() => pickLexical(l)} />
                ))}
              </div>

              {!feedback && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={resetBuilder} disabled={!assembled} style={{ padding: '10px 18px', background: 'transparent', color: assembled ? '#718096' : '#cbd5e0', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 500, cursor: assembled ? 'pointer' : 'default', fontSize: '0.95rem' }}>↺ Clear</button>
                  <button onClick={checkAnswer} disabled={!assembled} style={{ padding: '10px 32px', background: assembled ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0', color: assembled ? 'white' : '#a0aec0', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: assembled ? 'pointer' : 'default', fontSize: '1rem' }}>Check</button>
                </div>
              )}

              {feedback && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{
                    padding: '1rem 1.25rem', borderRadius: '10px',
                    background: feedback.result === 'wrong' ? '#fff5f5' : feedback.result === 'soft' ? '#fffaf0' : '#f0fff4',
                    border: `1px solid ${feedback.result === 'wrong' ? '#fc8181' : feedback.result === 'soft' ? '#f6ad55' : '#68d391'}`,
                  }}>
                    <div style={{ fontWeight: 700, color: feedback.result === 'wrong' ? '#c53030' : feedback.result === 'soft' ? '#c05621' : '#276749', marginBottom: '6px' }}>
                      {feedback.result === 'wrong'
                        ? <>❌ Not quite. A good answer here is <span style={{ textDecoration: 'underline' }}>{feedback.answer}</span>.</>
                        : feedback.result === 'soft'
                          ? <>✅ Correct.</>
                          : <>✅ Correct!</>}
                    </div>
                    {feedback.note && <div style={{ color: '#4a5568', marginBottom: '6px', fontStyle: 'italic' }}>{feedback.note}</div>}
                    {feedback.explanation && <div style={{ color: '#4a5568', lineHeight: 1.5 }}>{feedback.explanation}</div>}
                  </div>
                  <SentenceChallenge
                    key={currentQ}
                    word={feedback.answer}
                    language="en"
                    exercise="modal_match"
                    headerLabel="✏️ YOUR TURN — NOW PRODUCE IT"
                    promptText={`Now use this modal ${functionPhrase((q.tags && q.tags[0]) || '')}:`}
                    onMarkResult={harvestModalSentence}
                    onClose={nextQuestion}
                  />
                </div>
              )}
            </>
          )}

          {stage === 'finished' && (
            <div style={{ background: '#f7fafc', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{score >= 9 ? '🏆' : score >= 7 ? '⭐' : score >= 5 ? '👍' : '💪'}</div>
              <h2 style={{ color: '#2d3748', margin: '0 0 12px' }}>Exercise Complete!</h2>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: score >= 7 ? '#48bb78' : score >= 5 ? '#ed8936' : '#f56565', margin: '12px 0' }}>{score}/{questions.length}</div>
              <p style={{ color: '#4a5568' }}>{score >= 9 ? 'Outstanding modal control!' : score >= 7 ? 'Great work — your modals are strong.' : score >= 5 ? 'Good effort. Keep practising to improve.' : 'Keep going — practice makes perfect!'}</p>
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
