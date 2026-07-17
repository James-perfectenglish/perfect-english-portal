import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const TYPE_INFO = {
  gap_fill:          { label: 'Gap Fill',          emoji: '✏️' },
  multiple_choice:   { label: 'Multiple Choice',   emoji: '📝' },
  sentence_building: { label: 'Sentence Building', emoji: '🧩' },
  odd_one_out:       { label: 'Odd One Out',        emoji: '🔍' },
  error_correction:  { label: 'Error Correction',  emoji: '🚨' },
  matching:          { label: 'Matching',           emoji: '🔗' },
  sentence_auction:  { label: 'Sentence Auction',  emoji: '🔨' },
  dictation:         { label: 'Dictation',          emoji: '⌨️' },
  modal_chooser:     { label: 'Modal Match',        emoji: '🎛️' },
  conditional_chooser:{ label: 'Conditionals',      emoji: '🔀' },
}

const TOPIC_LABELS = {
  prepositions:            'Prepositions',
  phrasal_verbs:           'Phrasal Verbs',
  business_phrasal_verbs:  'Business Phrasal Verbs',
  business_vocabulary:     'Business Vocabulary',
  hotel_vocabulary:        'Hotel Vocabulary',
  bathroom_vocabulary:     'Bathroom Vocabulary',
  vocabulary:              'Vocabulary',
  grammar:                 'Grammar',
  routines:                'Routines',
  idioms:                  'Idioms',
  used_to:                 'Used To',
  second_conditional:      'Second Conditional',
  work_and_study:          'Work & Study',
  daily_life:              'Daily Life',
  spanish:                 'Spanish',
  travel:                  'Travel',
  sport:                   'Sport',
}

function getMondayISO() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d); mon.setDate(diff); mon.setHours(0, 0, 0, 0)
  return mon.toISOString()
}

function toPercent(score, answers) {
  if (score === null || score === undefined) return 0
  const total = answers?.total_questions
  if (total && total > 0) return Math.round((score / total) * 100)
  if (score > 20) return score
  return Math.round((score / 20) * 100)
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
      <div style={{ marginBottom: '0.85rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 0.1rem' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.78rem', color: '#718096', margin: 0 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function TypeBar({ info, pct, total }) {
  const barColor = pct >= 70 ? '#48bb78' : pct >= 50 ? '#ed8936' : '#fc8181'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontSize: '1.1rem', width: '1.4rem', textAlign: 'center', flexShrink: 0 }}>{info.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '500', color: '#2C3E50' }}>{info.label}</span>
          <span style={{ fontSize: '0.78rem', color: '#718096' }}>{pct}% <span style={{ fontSize: '0.68rem', color: '#a0aec0' }}>({total} q{total !== 1 ? 's' : ''})</span></span>
        </div>
        <div style={{ background: '#edf2f7', borderRadius: '99px', height: '7px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: '99px' }} />
        </div>
      </div>
    </div>
  )
}

export default function Progress({ session, profile, handleLogout }) {
  const isSpanish = profile?.level === 'Spanish' || (Array.isArray(profile?.tracks) && profile.tracks.includes('spanish'))
  const [stats, setStats]               = useState(null)
  const [attempts, setAttempts]         = useState([])
  const [typeBreakdown, setTypeBreakdown] = useState({})
  const [topicProgress, setTopicProgress] = useState([])
  const [lessonsPassed, setLessonsPassed] = useState(0)
  const [daysStudied, setDaysStudied]   = useState(0)
  const [streak, setStreak]             = useState(0)
  const [listeningCompleted, setListeningCompleted] = useState(0)
  const [stars, setStars]               = useState({ total: 0, thisWeek: 0, bySource: {} })
  const [loading, setLoading]           = useState(true)

  useEffect(() => { fetchData() }, [session])

  function computeStreak(dates) {
    if (!dates || dates.length === 0) return 0
    const uniqueDays = [...new Set(dates.map(d => {
      const dt = new Date(d); dt.setHours(0,0,0,0); return dt.getTime()
    }))].sort((a, b) => b - a)
    const today = new Date(); today.setHours(0,0,0,0)
    const todayMs = today.getTime()
    const yesterdayMs = todayMs - 86400000
    if (uniqueDays[0] !== todayMs && uniqueDays[0] !== yesterdayMs) return 0
    let streak = 0, checkMs = uniqueDays[0]
    for (const dayMs of uniqueDays) {
      if (dayMs === checkMs) { streak++; checkMs -= 86400000 } else break
    }
    return streak
  }

  async function fetchData() {
    const userId = session.user.id

    const { count: totalCount } = await supabase
      .from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', userId)
    const { count: correctCount } = await supabase
      .from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', userId).eq('is_correct', true)

    setStats(totalCount > 0
      ? { total: totalCount, correct: correctCount, accuracy: Math.round((correctCount / totalCount) * 100) }
      : { total: 0, correct: 0, accuracy: 0 })

    const { data: recentAnswers } = await supabase
      .from('student_answers').select('is_correct, question_id, answered_at')
      .eq('student_id', userId).order('answered_at', { ascending: false }).limit(2000)

    // Collect activity dates from all engagement sources for streak
    const [dictActivity, listenActivity, rtActivity, wordleActivity, connActivity, wotdActivity] = await Promise.all([
      supabase.from('dictation_sessions').select('completed_at').eq('student_id', userId).order('completed_at', { ascending: false }).limit(500),
      supabase.from('listening_sessions').select('completed_at').eq('student_id', userId).order('completed_at', { ascending: false }).limit(500),
      supabase.from('real_talk_sessions').select('completed_at').eq('student_id', userId).order('completed_at', { ascending: false }).limit(200),
      supabase.from('wordle_sessions').select('completed_at').eq('student_id', userId).order('completed_at', { ascending: false }).limit(500),
      supabase.from('connections_sessions').select('completed_at').eq('student_id', userId).order('completed_at', { ascending: false }).limit(200),
      supabase.from('word_of_the_day_submissions').select('submitted_at').eq('student_id', userId).order('submitted_at', { ascending: false }).limit(500),
    ])
    const allActivityDates = [
      ...(recentAnswers || []).map(a => a.answered_at),
      ...(dictActivity.data || []).map(a => a.completed_at),
      ...(listenActivity.data || []).map(a => a.completed_at),
      ...(rtActivity.data || []).map(a => a.completed_at),
      ...(wordleActivity.data || []).map(a => a.completed_at),
      ...(connActivity.data || []).map(a => a.completed_at),
      ...(wotdActivity.data || []).map(a => a.submitted_at),
    ].filter(Boolean)

    if (recentAnswers && recentAnswers.length > 0) {
      setStreak(computeStreak(allActivityDates))
      const questionIds = [...new Set(recentAnswers.map(a => a.question_id).filter(Boolean))]
      if (questionIds.length > 0) {
        const { data: questions } = await supabase.from('question_bank').select('question_number, type').in('question_number', questionIds)
        if (questions) {
          const typeMap = {}
          questions.forEach(q => { typeMap[q.question_number] = q.type })
          const byType = {}
          recentAnswers.forEach(a => {
            const type = typeMap[a.question_id]
            if (!type) return
            if (!byType[type]) byType[type] = { correct: 0, total: 0 }
            byType[type].total++
            if (a.is_correct) byType[type].correct++
          })
          setTypeBreakdown(byType)
        }
      }
    } else if (allActivityDates.length > 0) {
      setStreak(computeStreak(allActivityDates))
    }

    const { data: attemptData } = await supabase
      .from('student_attempts').select('score, completed_at, answers')
      .eq('student_id', userId).order('completed_at', { ascending: false }).limit(100)

    if (attemptData && attemptData.length > 0) {
      const normalised = attemptData.map(a => ({ ...a, scorePercent: toPercent(a.score, a.answers) }))
      setLessonsPassed(normalised.filter(a => a.scorePercent >= 70).length)
      const allDays = [...new Set(allActivityDates.map(d => new Date(d).toDateString()))]
      setDaysStudied(allDays.length)
      setAttempts([...normalised].reverse())
    } else if (allActivityDates.length > 0) {
      const allDays = [...new Set(allActivityDates.map(d => new Date(d).toDateString()))]
      setDaysStudied(allDays.length)
    }

    const { count: listenCount } = await supabase
      .from('listening_sessions').select('*', { count: 'exact', head: true })
      .eq('student_id', userId).eq('stage_reached', 'review')
    setListeningCompleted(listenCount || 0)

    const { data: topicSessions } = await supabase
      .from('topic_sessions').select('topic, score, total, passed').eq('student_id', userId)
    if (topicSessions && topicSessions.length > 0) {
      const byTopic = {}
      topicSessions.forEach(s => {
        if (!byTopic[s.topic]) byTopic[s.topic] = { correct: 0, total: 0, passed: 0, sessions: 0 }
        byTopic[s.topic].correct += s.score
        byTopic[s.topic].total += s.total
        if (s.passed) byTopic[s.topic].passed++
        byTopic[s.topic].sessions++
      })
      const topicList = Object.entries(byTopic)
        .map(([topic, data]) => ({
          topic,
          label: TOPIC_LABELS[topic] || topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          pct: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          sessions: data.sessions,
          passed: data.passed,
        }))
        .sort((a, b) => a.pct - b.pct)
      setTopicProgress(topicList)
    }

    // Stars (unified across all sources) — counted server-side via get_star_summary RPC.
    // A plain select caps at Supabase's 1,000-row limit, which froze totals at 1,000.
    const { data: starSummary } = await supabase
      .rpc('get_star_summary', { p_student_id: userId, p_week_start: getMondayISO() })
    if (starSummary && starSummary.total > 0) {
      const bySource = {}
      Object.entries(starSummary.by_source || {}).forEach(([source, n]) => {
        const bucket = ['wordle','spelling_bee','connections','wotd','gotd','teacher_awarded'].includes(source) ? source : 'other'
        bySource[bucket] = (bySource[bucket] || 0) + n
      })
      setStars({ total: starSummary.total, thisWeek: starSummary.this_week, bySource })
    }

    setLoading(false)
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#667eea' }}>Loading your progress...</div>
  }

  const hasData    = stats && stats.total > 0
  const hasAttempts = attempts.length > 0
  const recent     = attempts.slice(-10)

  const statCards = [
    { emoji: '📊', label: isSpanish ? 'Preguntas respondidas' : 'Questions Answered', value: hasData ? stats.total.toLocaleString() : '—' },
    { emoji: '🎯', label: isSpanish ? 'Acierto general'      : 'Overall Accuracy',    value: hasData ? `${stats.accuracy}%` : '—' },
    { emoji: '🏆', label: isSpanish ? 'Lecciones aprobadas'  : 'Lessons Passed',      value: hasAttempts ? lessonsPassed : '—' },
    { emoji: '🎧', label: isSpanish ? 'Audios completados'   : 'Listening Done',      value: listeningCompleted > 0 ? listeningCompleted : '—' },
    { emoji: '📅', label: isSpanish ? 'Días estudiados'   : 'Days Studied',        value: hasAttempts ? daysStudied : '—' },
    ...(streak > 0 ? [{ emoji: '🔥', label: isSpanish ? 'Días seguidos' : 'Day Streak', value: streak, highlight: streak >= 7 }] : []),
    ...(stars.total > 0 ? [{ emoji: '⭐', label: isSpanish ? 'Estrellas' : 'Stars', value: stars.total, sub: isSpanish ? `${stars.thisWeek} esta semana` : `${stars.thisWeek} this week`, highlight2: true }] : []),
  ]

  return (
    <div className="pep-page-content" style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <h1 style={{ fontSize: 'clamp(1.3rem, 4vw, 1.6rem)', color: '#2C3E50', margin: '0 0 1.25rem', fontWeight: '700' }}>
        📊 My Progress
      </h1>

      {/* STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {statCards.map(({ emoji, label, value, highlight, highlight2, sub }) => (
          <div key={label} style={{
            background: highlight ? 'linear-gradient(135deg, #fffaf0, #fff5e0)' : highlight2 ? 'linear-gradient(135deg, #fffbeb, #fef3c7)' : 'white',
            borderRadius: '12px', padding: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${highlight ? '#ed8936' : highlight2 ? '#f59e0b' : '#667eea'}`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{emoji}</div>
            <div style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.2rem', lineHeight: 1.3 }}>{label}</div>
            {sub && <div style={{ fontSize: '0.68rem', color: '#a0aec0', marginTop: '2px' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* SCORE TREND */}
      {recent.length > 1 && (
        <Section title="📈 Score Trend" subtitle={`Your last ${recent.length} sessions`}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px', padding: '0 2px' }}>
            {recent.map((a, i) => {
              const pct = a.scorePercent ?? 0
              const score = a.score ?? 0
              const barH = Math.max(4, (pct / 100) * 80)
              const color = pct >= 70 ? '#48bb78' : pct >= 50 ? '#ed8936' : '#fc8181'
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '110px', minWidth: '8px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', color, marginBottom: '3px', lineHeight: 1 }}>{score}</span>
                  <div title={`Session ${i + 1}: ${score}/20 (${pct}%)`}
                    style={{ width: '100%', height: `${barH}px`, backgroundColor: color, borderRadius: '4px 4px 0 0' }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
            <span style={{ fontSize: '0.68rem', color: '#a0aec0' }}>Older</span>
            <span style={{ fontSize: '0.68rem', color: '#a0aec0' }}>Most recent</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {[['#48bb78', '70%+ (Pass)'], ['#ed8936', '50–69%'], ['#fc8181', 'Below 50%']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: c }} />
                <span style={{ fontSize: '0.72rem', color: '#718096' }}>{l}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* STARS BREAKDOWN */}
      {stars.total > 0 && (
        <Section
          title={isSpanish ? '⭐ Estrellas' : '⭐ Stars'}
          subtitle={isSpanish
            ? `${stars.total} en total · ${stars.thisWeek} esta semana`
            : `${stars.total} all time · ${stars.thisWeek} this week`}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: '0.6rem' }}>
            {[
              { key: 'teacher_awarded', emoji: '👨‍🏫', label: isSpanish ? 'Profesor'   : 'Teacher'   },
              { key: 'wordle',          emoji: '🟩', label: 'Wordle' },
              { key: 'spelling_bee',    emoji: '🐝', label: isSpanish ? 'Spelling Bee' : 'Spelling Bee' },
              { key: 'connections',     emoji: '🔗', label: 'Connections' },
              { key: 'wotd',            emoji: '📖', label: isSpanish ? 'Palabra'    : 'Word'      },
              { key: 'gotd',            emoji: '📝', label: isSpanish ? 'Gramática' : 'Grammar'   },
              { key: 'other',           emoji: '✍️', label: isSpanish ? 'Frases'     : 'Sentences' },
            ].filter(({ key }) => (stars.bySource[key] || 0) > 0).map(({ key, emoji, label }) => (
              <div key={key} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', lineHeight: 1 }}>{emoji}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#92400e', lineHeight: 1.1, marginTop: '4px' }}>{stars.bySource[key]}</div>
                <div style={{ fontSize: '0.68rem', color: '#a0aec0', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0.85rem 0 0' }}>
            {isSpanish
              ? 'Gana ⭐ jugando Wordle, Spelling Bee, Connections, la Palabra y la Gramática del día, escribiendo buenas frases, o cuando tu profesor te dé una.'
              : 'Earn ⭐ by playing Wordle, Spelling Bee, Connections, Word and Grammar of the Day, by writing good sentences, or when your teacher awards you one.'}
          </p>
        </Section>
      )}

      {/* STRENGTHS & WEAKNESSES */}
      {Object.keys(typeBreakdown).length > 0 && (
        <Section title="💪 Strengths & Weaknesses" subtitle="Accuracy by question type">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {Object.entries(typeBreakdown)
              .sort((a, b) => (b[1].correct / b[1].total) - (a[1].correct / a[1].total))
              .map(([type, data]) => {
                const pct = Math.round((data.correct / data.total) * 100)
                const info = TYPE_INFO[type] || { label: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), emoji: '📋' }
                return <TypeBar key={type} info={info} pct={pct} total={data.total} />
              })}
          </div>
        </Section>
      )}

      {/* PROGRESS BY TOPIC */}
      {topicProgress.length > 0 && (
        <Section title="📚 Progress by Topic" subtitle="Your accuracy across topic practice sessions — weakest first">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {topicProgress.map(({ topic, label, pct, sessions, passed }) => (
              <div key={topic} style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '500', color: '#2C3E50' }}>{label}</span>
                  <span style={{ fontSize: '0.78rem', color: '#718096' }}>
                    {pct}%
                    <span style={{ fontSize: '0.68rem', color: '#a0aec0', marginLeft: '4px' }}>
                      ({sessions} session{sessions !== 1 ? 's' : ''}{passed > 0 ? `, ${passed} passed` : ''})
                    </span>
                  </span>
                </div>
                <div style={{ background: '#edf2f7', borderRadius: '99px', height: '7px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: '99px',
                    backgroundColor: pct >= 70 ? '#48bb78' : pct >= 50 ? '#ed8936' : '#fc8181'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!hasData && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#718096' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
          <p style={{ margin: 0 }}>No data yet — complete some practice sessions and your progress will appear here.</p>
        </div>
      )}

      {/* SETTINGS */}
      <MuteSettings onLogout={handleLogout} isSpanish={isSpanish} />
    </div>
  )
}

const MUTE_AUDIO_KEY = 'pe_mute_audio_until';
const MUTE_SPEAKING_KEY = 'pe_mute_speaking_until';

function getMuteMinutesLeft(key) {
  const v = localStorage.getItem(key);
  if (!v) return 0;
  const ms = parseInt(v, 10) - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

function MuteSettings({ onLogout, isSpanish }) {
  const [tick, setTick] = useState(0);
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState(null); // { type: 'success'|'error', text }

  const audioMins = getMuteMinutesLeft(MUTE_AUDIO_KEY);
  const speakingMins = getMuteMinutesLeft(MUTE_SPEAKING_KEY);
  const hasMute = audioMins > 0 || speakingMins > 0;

  const unmute = (key) => {
    localStorage.removeItem(key);
    setTick(t => t + 1);
  };

  const handlePasswordChange = async () => {
    setPwMessage(null);
    if (newPw.length < 6) {
      setPwMessage({ type: 'error', text: isSpanish ? 'La contraseña debe tener al menos 6 caracteres.' : 'Password must be at least 6 characters.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ type: 'error', text: isSpanish ? 'Las contraseñas no coinciden.' : 'Passwords do not match.' });
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) {
      setPwMessage({ type: 'error', text: error.message });
    } else {
      setPwMessage({ type: 'success', text: isSpanish ? '✓ Contraseña actualizada.' : '✓ Password updated.' });
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => { setShowPwForm(false); setPwMessage(null); }, 2500);
    }
  };

  const closePwForm = () => {
    setShowPwForm(false);
    setNewPw('');
    setConfirmPw('');
    setPwMessage(null);
  };

  return (
    <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 0.85rem' }}>⚙️ {isSpanish ? 'Ajustes' : 'Settings'}</h2>

      {hasMute && (
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {audioMins > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#744210' }}>🔇 {isSpanish ? 'Audio silenciado' : 'Audio muted'} — {audioMins} min{audioMins !== 1 ? 's' : ''} {isSpanish ? 'restantes' : 'left'}</span>
              <button onClick={() => unmute(MUTE_AUDIO_KEY)} style={{ fontSize: '0.75rem', color: '#553C9A', background: 'none', border: '1px solid #c4b5fd', borderRadius: '5px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontWeight: 600 }}>{isSpanish ? 'Reactivar' : 'Unmute'}</button>
            </div>
          )}
          {speakingMins > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#744210' }}>🎤 {isSpanish ? 'Habla silenciada' : 'Speaking muted'} — {speakingMins} min{speakingMins !== 1 ? 's' : ''} {isSpanish ? 'restantes' : 'left'}</span>
              <button onClick={() => unmute(MUTE_SPEAKING_KEY)} style={{ fontSize: '0.75rem', color: '#553C9A', background: 'none', border: '1px solid #c4b5fd', borderRadius: '5px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontWeight: 600 }}>{isSpanish ? 'Reactivar' : 'Unmute'}</button>
            </div>
          )}
        </div>
      )}

      {!showPwForm ? (
        <button
          onClick={() => setShowPwForm(true)}
          style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: '600', color: '#553C9A', background: 'none', border: '1.5px solid #d6bcfa', borderRadius: '8px', cursor: 'pointer', marginBottom: '0.6rem' }}
        >
          🔑 {isSpanish ? 'Cambiar contraseña' : 'Change password'}
        </button>
      ) : (
        <div style={{ background: '#faf5ff', border: '1px solid #d6bcfa', borderRadius: '10px', padding: '0.85rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#553C9A', marginBottom: '0.6rem' }}>
            🔑 {isSpanish ? 'Cambiar contraseña' : 'Change password'}
          </div>
          <input
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder={isSpanish ? 'Nueva contraseña (mínimo 6 caracteres)' : 'New password (min 6 characters)'}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            style={{ width: '100%', padding: '0.55rem 0.7rem', fontSize: '0.9rem', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '0.5rem', boxSizing: 'border-box', color: '#2d3748', WebkitTextFillColor: '#2d3748' }}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            placeholder={isSpanish ? 'Confirmar contraseña' : 'Confirm password'}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onKeyDown={e => { if (e.key === 'Enter' && newPw && confirmPw && !pwLoading) handlePasswordChange(); }}
            style={{ width: '100%', padding: '0.55rem 0.7rem', fontSize: '0.9rem', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '0.6rem', boxSizing: 'border-box', color: '#2d3748', WebkitTextFillColor: '#2d3748' }}
          />
          {pwMessage && (
            <div style={{
              fontSize: '0.8rem',
              color: pwMessage.type === 'success' ? '#22543d' : '#9b2c2c',
              background: pwMessage.type === 'success' ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${pwMessage.type === 'success' ? '#9ae6b4' : '#feb2b2'}`,
              borderRadius: '6px', padding: '0.5rem 0.7rem', marginBottom: '0.6rem'
            }}>
              {pwMessage.text}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handlePasswordChange}
              disabled={pwLoading || !newPw || !confirmPw}
              style={{
                flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600,
                color: 'white',
                background: (pwLoading || !newPw || !confirmPw) ? '#cbd5e0' : '#667eea',
                border: 'none', borderRadius: '6px',
                cursor: (pwLoading || !newPw || !confirmPw) ? 'not-allowed' : 'pointer'
              }}
            >
              {pwLoading ? (isSpanish ? 'Guardando…' : 'Saving…') : (isSpanish ? 'Actualizar' : 'Update')}
            </button>
            <button
              onClick={closePwForm}
              disabled={pwLoading}
              style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, color: '#4a5568', background: 'none', border: '1px solid #cbd5e0', borderRadius: '6px', cursor: pwLoading ? 'not-allowed' : 'pointer' }}
            >
              {isSpanish ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onLogout}
        style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem', fontWeight: '600', color: '#e53e3e', background: 'none', border: '1.5px solid #fed7d7', borderRadius: '8px', cursor: 'pointer' }}
      >
        {isSpanish ? 'Cerrar sesión' : 'Log out'}
      </button>
    </div>
  );
}
