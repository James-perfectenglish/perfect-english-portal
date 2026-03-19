import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import WordOfTheDay from './WordOfTheDay'
import { TRACK_EMOJI, TRACK_LABEL } from './components/TeacherToolbar'

const TRACK_CONFIG = {
  general:  { label: 'General English',       emoji: '📚', description: 'Mixed vocabulary, grammar and skills across all areas',    color: '#667eea', topicFilter: null },
  business: { label: 'Business English',       emoji: '💼', description: 'Professional communication and workplace vocabulary',      color: '#ed8936', topicFilter: 'business' },
  hotels:   { label: 'Hotel English',          emoji: '🏨', description: 'Vocabulary and phrases for the hospitality industry',     color: '#48bb78', topicFilter: 'hotels' },
  bathroom: { label: 'Bathroom & Interiors',   emoji: '🚿', description: 'Product vocabulary for the Borrás showroom',             color: '#4299e1', topicFilter: 'borras' },
  exam:     { label: 'Exam Preparation',       emoji: '🎓', description: 'Targeted practice for English language exams',           color: '#9f7aea', topicFilter: 'exam' },
  spanish:  { label: 'Spanish Practice',       emoji: '🇪🇸', description: 'English practice with Spanish — ideal for A2 towards B1', color: '#e53e3e', topicFilter: 'spanish' },
}

const TYPE_INFO = {
  gap_fill:          { label: 'Gap Fill',          emoji: '✏️' },
  multiple_choice:   { label: 'Multiple Choice',   emoji: '📝' },
  sentence_building: { label: 'Sentence Building', emoji: '🧩' },
  odd_one_out:       { label: 'Odd One Out',        emoji: '🔍' },
  error_correction:  { label: 'Error Correction',  emoji: '🚨' },
  matching:          { label: 'Matching',           emoji: '🔗' },
  sentence_auction:  { label: 'Sentence Auction',  emoji: '🔨' },
  dictation:         { label: 'Dictation',          emoji: '⌨️' },
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
}

function toPercent(score, answers) {
  if (score === null || score === undefined) return 0
  const total = answers?.total_questions
  if (total && total > 0) return Math.round((score / total) * 100)
  if (score > 20) return score
  return Math.round((score / 20) * 100)
}

function computeStreak(answeredAtDates) {
  if (!answeredAtDates || answeredAtDates.length === 0) return 0
  const uniqueDays = [...new Set(answeredAtDates.map(d => {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }))].sort((a, b) => b - a)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()
  const yesterdayMs = todayMs - 86400000
  if (uniqueDays[0] !== todayMs && uniqueDays[0] !== yesterdayMs) return 0
  let streak = 0
  let checkMs = uniqueDays[0]
  for (const dayMs of uniqueDays) {
    if (dayMs === checkMs) { streak++; checkMs -= 86400000 }
    else break
  }
  return streak
}

function getRecommendation(profile, attempts, studentTracks) {
  if (studentTracks.length > 0) {
    const key = studentTracks[0]
    const track = TRACK_CONFIG[key]
    if (track) {
      return {
        emoji: track.emoji,
        title: track.label,
        desc: attempts.length === 0 ? 'Start your first session on this track' : 'Continue where you left off',
        href: `/practice?track=${key}`,
        color: track.color,
        tag: 'Recommended: your track',
      }
    }
  }
  if (profile.level) {
    return {
      emoji: '🎯',
      title: `${profile.level} Practice`,
      desc: attempts.length === 0 ? `Start your first ${profile.level} practice session` : `Keep building on your ${profile.level} progress`,
      href: '/practice',
      color: '#667eea',
      tag: 'Recommended: your level',
    }
  }
  return {
    emoji: '🎲',
    title: 'Random Practice',
    desc: 'Mix of all question types and levels — a great place to start',
    href: '/practice',
    color: '#667eea',
    tag: 'Recommended',
  }
}

export default function StudentDashboard({ profile, session, handleLogout, globalLang, onToggleLang, onBrowseClick, onTeacherClick, teacherTrack, onCycleTrack }) {
  const [stats, setStats] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [typeBreakdown, setTypeBreakdown] = useState({})
  const [topicProgress, setTopicProgress] = useState([])
  const [lessonsPassed, setLessonsPassed] = useState(0)
  const [daysStudied, setDaysStudied] = useState(0)
  const [streak, setStreak] = useState(0)
  const [listeningCompleted, setListeningCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const firstName = profile.full_name?.split(' ')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => { fetchDashboardData() }, [session])

  async function fetchDashboardData() {
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

    if (recentAnswers && recentAnswers.length > 0) {
      setStreak(computeStreak(recentAnswers.map(a => a.answered_at)))

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
    }

    const { data: attemptData } = await supabase
      .from('student_attempts').select('score, completed_at, answers')
      .eq('student_id', userId).order('completed_at', { ascending: false }).limit(100)

    if (attemptData && attemptData.length > 0) {
      const normalised = attemptData.map(a => ({ ...a, scorePercent: toPercent(a.score, a.answers) }))
      setLessonsPassed(normalised.filter(a => a.scorePercent >= 70).length)
      const attemptDays = normalised.map(a => new Date(a.completed_at).toDateString())
      const answerDays = (recentAnswers || []).map(a => new Date(a.answered_at).toDateString())
      setDaysStudied(new Set([...attemptDays, ...answerDays]).size)
      setAttempts([...normalised].reverse())
    } else if (recentAnswers && recentAnswers.length > 0) {
      const answerDays = recentAnswers.map(a => new Date(a.answered_at).toDateString())
      setDaysStudied(new Set(answerDays).size)
    }

    const { count: listenCount } = await supabase
      .from('listening_sessions').select('*', { count: 'exact', head: true })
      .eq('student_id', userId).eq('stage_reached', 'review')
    setListeningCompleted(listenCount || 0)

    // Topic progress
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
        .sort((a, b) => a.pct - b.pct) // weakest first
      setTopicProgress(topicList)
    }

    setLoading(false)
  }

  const studentTracks = Array.isArray(profile.tracks) ? profile.tracks : []
  const hasData = stats && stats.total > 0
  const hasAttempts = attempts.length > 0
  const recommendation = getRecommendation(profile, attempts, studentTracks)

  const hasWeakSpots = Object.entries(typeBreakdown)
    .filter(([, d]) => d.total >= 5)
    .some(([, d]) => Math.round((d.correct / d.total) * 100) < 70)

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: '#667eea' }}>Loading your dashboard...</div>
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>
      {/* GREETING */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#2C3E50', margin: '0 0 0.3rem' }}>
            {greeting}, {firstName}! 👋
          </h1>
          <p style={{ color: '#718096', margin: 0, fontSize: '0.95rem' }}>
            {hasData
              ? `You've answered ${stats.total.toLocaleString()} questions so far — keep it up!`
              : 'Welcome to your dashboard. Start with Random Practice to begin tracking your progress.'}
          </p>
        </div>
        {profile.is_teacher && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {onCycleTrack && (
              <button onClick={onCycleTrack} title={`Track: ${TRACK_LABEL[teacherTrack] || 'English'} — click to cycle`}
                style={{ height: '34px', width: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {TRACK_EMOJI[teacherTrack] || '🇬🇧'}
              </button>
            )}
            {onBrowseClick && (
              <button onClick={onBrowseClick} title="Browse questions"
                style={{ height: '34px', padding: '0 10px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', whiteSpace: 'nowrap' }}>
                🔍 Browse
              </button>
            )}
            {onTeacherClick && (
              <button onClick={onTeacherClick} title="Teacher Dashboard"
                style={{ height: '34px', width: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                👨‍🏫
              </button>
            )}
          </div>
        )}
      </div>

      <WordOfTheDay profile={profile} />

      {/* STAT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <StatCard emoji="📊" label="Questions Answered" value={hasData ? stats.total.toLocaleString() : '—'} />
        <StatCard emoji="🎯" label="Overall Accuracy"   value={hasData ? `${stats.accuracy}%` : '—'} />
        <StatCard emoji="🏆" label="Lessons Passed"     value={hasAttempts ? lessonsPassed : '—'} />
        <StatCard emoji="🎧" label="Listening Done"     value={listeningCompleted > 0 ? listeningCompleted : '—'} />
        <StatCard emoji="📅" label="Days Studied"       value={hasAttempts ? daysStudied : '—'} />
        {streak > 0 && <StatCard emoji="🔥" label="Day Streak" value={streak} highlight={streak >= 7} />}
      </div>

      {/* SCORE TREND */}
      {attempts.length > 1 && (
        <Section title="📈 Score Trend" subtitle={`Your last ${Math.min(attempts.length, 10)} sessions`}>
          <ScoreTrendChart attempts={attempts} />
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
              <div key={topic} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
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
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* MY TRACKS */}
      {studentTracks.length > 0 && (
        <Section title="🗺️ My Tracks" subtitle="Your personalised learning paths — click to start a focused practice session">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {studentTracks.map(key => {
              const track = TRACK_CONFIG[key]
              if (!track) return null
              return <TrackCard key={key} trackKey={key} track={track} />
            })}
          </div>
        </Section>
      )}

      {/* QUICK START */}
      <Section title="🚀 Quick Start" subtitle="Jump straight into a session">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <Link to={recommendation.href} style={{ textDecoration: 'none' }}>
            <RecommendedCard recommendation={recommendation} />
          </Link>
          <Link to="/practice" style={{ textDecoration: 'none' }}>
            <QuickLinkCard emoji="🎯" title="Random Practice" desc="20 mixed questions covering all topics and types" color="#667eea" />
          </Link>
          {hasWeakSpots && (
            <Link to="/practice?mode=weakspots" style={{ textDecoration: 'none' }}>
              <QuickLinkCard emoji="🔧" title="Weak Spots" desc="Practice focused on your toughest question types" color="#e53e3e" />
            </Link>
          )}
          <Link to="/exercises" style={{ textDecoration: 'none' }}>
            <QuickLinkCard emoji="📚" title="All Exercises" desc="Browse and choose by topic, type, or level" color="#48bb78" />
          </Link>
        </div>
      </Section>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#718096' }}>
          Your level: <strong style={{ color: '#667eea' }}>{profile.level || 'Not assigned yet'}</strong>
        </div>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1.25rem', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500' }}>
          Logout
        </button>
      </div>
    </div>
  )
}

function StatCard({ emoji, label, value, highlight }) {
  return (
    <div style={{ background: highlight ? 'linear-gradient(135deg, #fffaf0, #fff5e0)' : 'white', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${highlight ? '#ed8936' : '#667eea'}`, textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{emoji}</div>
      <div style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.2rem', lineHeight: 1.3 }}>{label}</div>
    </div>
  )
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

function RecommendedCard({ recommendation: r }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${r.color}18, ${r.color}08)`, border: `2px solid ${r.color}50`, borderRadius: '12px', padding: '1rem', cursor: 'pointer', height: '100%', boxSizing: 'border-box', position: 'relative', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${r.color}25` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
      <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.62rem', fontWeight: '700', letterSpacing: '0.4px', textTransform: 'uppercase', color: r.color, backgroundColor: `${r.color}18`, padding: '2px 7px', borderRadius: '99px' }}>⭐ {r.tag}</div>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{r.emoji}</div>
      <div style={{ fontWeight: '700', color: '#2C3E50', fontSize: '0.95rem', marginBottom: '0.2rem', paddingRight: '3rem' }}>{r.title}</div>
      <div style={{ fontSize: '0.76rem', color: '#718096', lineHeight: '1.4', marginBottom: '0.6rem' }}>{r.desc}</div>
      <div style={{ fontSize: '0.78rem', fontWeight: '600', color: r.color }}>Start now →</div>
    </div>
  )
}

function ScoreTrendChart({ attempts }) {
  const recent = attempts.slice(-10)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '110px', padding: '0 2px' }}>
        {recent.map((a, i) => {
          const pct = a.scorePercent ?? 0
          const score = a.score ?? 0
          const barH = Math.max(4, (pct / 100) * 80)
          const color = pct >= 70 ? '#48bb78' : pct >= 50 ? '#ed8936' : '#fc8181'
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '110px', minWidth: '8px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color, marginBottom: '3px', lineHeight: 1 }}>{score}</span>
              <div title={`Session ${i + 1}: ${score}/20 (${pct}%)`} style={{ width: '100%', height: `${barH}px`, backgroundColor: color, borderRadius: '4px 4px 0 0' }} />
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
          <span style={{ fontSize: '0.78rem', color: '#718096' }}>{pct}% <span style={{ fontSize: '0.68rem', color: '#a0aec0' }}>({total} question{total !== 1 ? 's' : ''})</span></span>
        </div>
        <div style={{ background: '#edf2f7', borderRadius: '99px', height: '7px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor, borderRadius: '99px' }} />
        </div>
      </div>
    </div>
  )
}

function TrackCard({ trackKey, track }) {
  return (
    <Link to={`/practice?track=${trackKey}`} style={{ textDecoration: 'none' }}>
      <div style={{ borderRadius: '12px', padding: '1rem', border: `2px solid ${track.color}30`, backgroundColor: `${track.color}0d`, cursor: 'pointer', height: '100%', boxSizing: 'border-box', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
        <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{track.emoji}</div>
        <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.92rem', marginBottom: '0.25rem' }}>{track.label}</div>
        <div style={{ fontSize: '0.76rem', color: '#718096', lineHeight: '1.45', marginBottom: '0.6rem' }}>{track.description}</div>
        <div style={{ fontSize: '0.78rem', fontWeight: '600', color: track.color }}>Start practice →</div>
      </div>
    </Link>
  )
}

function QuickLinkCard({ emoji, title, desc, color }) {
  return (
    <div style={{ background: `${color}0f`, border: `2px solid ${color}40`, borderRadius: '12px', padding: '1rem', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 20px ${color}30`; e.currentTarget.style.background = `${color}1a`; e.currentTarget.style.borderColor = `${color}90` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = `${color}0f`; e.currentTarget.style.borderColor = `${color}40` }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{emoji}</div>
      <div style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.92rem', marginBottom: '0.2rem' }}>{title}</div>
      <div style={{ fontSize: '0.76rem', color: '#718096', lineHeight: '1.4' }}>{desc}</div>
    </div>
  )
}
