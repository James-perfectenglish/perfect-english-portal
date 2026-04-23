import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './supabaseClient'
import WordOfTheDay from './WordOfTheDay'
import GrammarOfTheDay from './GrammarOfTheDay'

const LEVEL_GRADIENT = {
  A1: 'linear-gradient(135deg, #43b581, #2ecc71)',
  A2: 'linear-gradient(135deg, #43b581, #2ecc71)',
  B1: 'linear-gradient(135deg, #3498DB, #667eea)',
  B2: 'linear-gradient(135deg, #3498DB, #667eea)',
  C1: 'linear-gradient(135deg, #ed8936, #f6ad55)',
  C2: 'linear-gradient(135deg, #ed8936, #f6ad55)',
  Spanish: 'linear-gradient(135deg, #e53e3e, #c53030)',
}

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

function getWeakTypes(typeBreakdown) {
  return Object.entries(typeBreakdown)
    .filter(([, d]) => d.total >= 5)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .slice(0, 3)
    .map(([t]) => t)
}

export default function StudentDashboard({ profile, session }) {
  const [streak, setStreak]               = useState(0)
  const [questionsTotal, setQTotal]       = useState(0)
  const [typeBreakdown, setTypeBreakdown] = useState({})
  const [loading, setLoading]             = useState(true)

  const firstName     = profile.full_name?.split(' ')[0] || 'there'
  const hour          = new Date().getHours()
  const greeting      = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const profileLevel  = profile.level
  const isSpanish     = profileLevel === 'Spanish' || (Array.isArray(profile.tracks) && profile.tracks.includes('spanish'))
  const levelGradient = LEVEL_GRADIENT[profileLevel] || 'linear-gradient(135deg, #3498DB, #667eea)'

  useEffect(() => { fetchQuickData() }, [session])

  async function fetchQuickData() {
    const userId = session.user.id

    const { count: totalCount } = await supabase
      .from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', userId)
    setQTotal(totalCount || 0)

    const { data: recentAnswers } = await supabase
      .from('student_answers').select('is_correct, question_id, answered_at')
      .eq('student_id', userId).order('answered_at', { ascending: false }).limit(2000)

    if (recentAnswers && recentAnswers.length > 0) {
      setStreak(computeStreak(recentAnswers.map(a => a.answered_at)))
      const questionIds = [...new Set(recentAnswers.map(a => a.question_id).filter(Boolean))]
      if (questionIds.length > 0) {
        const { data: questions } = await supabase
          .from('question_bank').select('question_number, type').in('question_number', questionIds)
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
    setLoading(false)
  }

  const weakTypes = getWeakTypes(typeBreakdown)
  const weakParam = weakTypes.length > 0 ? `&weak=${weakTypes.join(',')}` : ''

  // Card component
  const QuickCard = ({ to, gradient, border, children }) => (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        background: gradient || 'white',
        border: border || '1.5px solid #e8e8f0',
        borderRadius: '14px', padding: '1rem',
        height: '100%', boxSizing: 'border-box',
        position: 'relative', overflow: 'hidden',
      }}>
        {children}
      </div>
    </Link>
  )

  return (
    <div className="pep-page-content" style={{ maxWidth: '700px', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>

      {/* GREETING */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', color: '#2C3E50', margin: '0 0 0.2rem', fontWeight: '700' }}>
          {greeting}, {firstName}! 👋
        </h1>
        <p style={{ color: '#718096', margin: 0, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {questionsTotal > 0 && <span>{questionsTotal.toLocaleString()} questions answered</span>}
          {streak > 0 && <span style={{ color: '#ed8936', fontWeight: 600 }}>🔥 {streak} day streak</span>}
        </p>
      </div>

      {/* WORD OF THE DAY */}
      <WordOfTheDay profile={profile} collapsible={true} />

      {/* GRAMMAR OF THE DAY */}
      <GrammarOfTheDay profile={profile} collapsible={true} />

      {/* QUICK START */}
      <div style={{ marginTop: '0.5rem' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 0.65rem' }}>
          Quick start
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

          {/* Row 1: Practise + Weak Spots */}
          <Link to="/practise" style={{ textDecoration: 'none' }}>
            <div style={{ background: levelGradient, borderRadius: '14px', padding: '1rem', color: 'white', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
              {profileLevel && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '20px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700 }}>
                  Your level
                </div>
              )}
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎯</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                {isSpanish ? 'Spanish Practise' : profileLevel ? `${profileLevel} Practise` : 'Practise'}
              </div>
              <div style={{ fontSize: '0.76rem', opacity: 0.85 }}>20 questions at your level</div>
            </div>
          </Link>

          <Link to={`/practise?mode=weakspots${weakParam}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'white', border: '2px solid #e53e3e25', borderRadius: '14px', padding: '1rem', height: '100%', boxSizing: 'border-box' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🔧</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C3E50', marginBottom: '0.2rem' }}>Weak Spots</div>
              <div style={{ fontSize: '0.76rem', color: '#718096' }}>Focus on your toughest types</div>
            </div>
          </Link>

          {/* Row 2: Learn + Play */}
          <QuickCard to="/learn">
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📚</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C3E50', marginBottom: '0.2rem' }}>Learn</div>
            <div style={{ fontSize: '0.76rem', color: '#718096' }}>Flashcards and topic exercises</div>
          </QuickCard>

          <QuickCard to="/play">
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎮</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C3E50', marginBottom: '0.2rem' }}>Play</div>
            <div style={{ fontSize: '0.76rem', color: '#718096' }}>Blurt!, Word Snake & more</div>
          </QuickCard>

          {/* Row 3: Listen + Speak */}
          <QuickCard to="/listen">
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎧</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C3E50', marginBottom: '0.2rem' }}>Listen</div>
            <div style={{ fontSize: '0.76rem', color: '#718096' }}>Listening exercises & dictation</div>
          </QuickCard>

          <QuickCard to="/speak">
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎤</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#2C3E50', marginBottom: '0.2rem' }}>Speak</div>
            <div style={{ fontSize: '0.76rem', color: '#718096' }}>Pronunciation practice</div>
          </QuickCard>

        </div>
      </div>
    </div>
  )
}
