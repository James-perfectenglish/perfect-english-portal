import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const TYPE_INFO = {
  gap_fill:          { label: 'Gap Fill',          emoji: '✏️' },
  multiple_choice:   { label: 'Multiple Choice',   emoji: '📝' },
  sentence_building: { label: 'Sentence Building', emoji: '🧩' },
  odd_one_out:       { label: 'Odd One Out',        emoji: '🔍' },
  error_correction:  { label: 'Error Correction',  emoji: '🚨' },
}

function initials(name) {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function exportCSV(students) {
  const headers = ['Name', 'Level', 'Questions Answered', 'Accuracy %', 'Lessons Passed', 'Listening Done', 'Best Type', 'Worst Type', 'Last Active']
  const rows = students.map(s => [
    s.full_name || 'Unknown',
    s.level || '—',
    s.totalAnswers,
    s.accuracy,
    s.lessonsPassed,
    s.listeningCompleted || 0,
    s.bestType ? (TYPE_INFO[s.bestType]?.label || s.bestType) : '—',
    s.worstType ? (TYPE_INFO[s.worstType]?.label || s.worstType) : '—',
    s.lastActive ? new Date(s.lastActive).toLocaleDateString('en-GB') : '—'
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `perfect-english-students-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TeacherDashboard({ profile, handleLogout }) {
  const [students, setStudents]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [privateMode, setPrivateMode] = useState(false)
  const [sortKey, setSortKey]       = useState('lastActive')
  const [sortDir, setSortDir]       = useState('desc')

  useEffect(() => { fetchAllData() }, [])

  async function fetchAllData() {
    // 1. Get all approved non-teacher students
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, level, approved')
      .eq('approved', true)
      .eq('is_teacher', false)

    if (!profiles || profiles.length === 0) {
      setLoading(false)
      return
    }

    const ids = profiles.map(p => p.id)

    // 2. Get total and correct counts per student using count queries (no row limit problem)
    const totalCountsPromises  = ids.map(id =>
      supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id)
    )
    const correctCountsPromises = ids.map(id =>
      supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id).eq('is_correct', true)
    )
    const [totalResults, correctResults] = await Promise.all([
      Promise.all(totalCountsPromises),
      Promise.all(correctCountsPromises),
    ])
    const totalMap   = {}
    const correctMap = {}
    ids.forEach((id, i) => {
      totalMap[id]   = totalResults[i].count   || 0
      correctMap[id] = correctResults[i].count || 0
    })

    // 3. Get recent answers for type breakdown only (last 500 per student is plenty)
    const { data: answers } = await supabase
      .from('student_answers')
      .select('student_id, is_correct, question_id')
      .in('student_id', ids)
      .order('answered_at', { ascending: false })
      .limit(500)

    // 4. Get attempts per student
    const { data: attempts } = await supabase
      .from('student_attempts')
      .select('student_id, score, completed_at, answers')
      .in('student_id', ids)
      .order('completed_at', { ascending: false })
      .limit(1000)

    // 5. Get completed listening sessions per student
    const listenCountsPromises = ids.map(id =>
      supabase.from('listening_sessions').select('*', { count: 'exact', head: true })
        .eq('student_id', id).eq('stage_reached', 'review')
    )
    const listenResults = await Promise.all(listenCountsPromises)
    const listenMap = {}
    ids.forEach((id, i) => { listenMap[id] = listenResults[i].count || 0 })

    // 6. Get question types for type breakdown
    let typeMap = {}
    if (answers && answers.length > 0) {
      const questionIds = [...new Set(answers.map(a => a.question_id).filter(Boolean))]
      if (questionIds.length > 0) {
        const { data: questions } = await supabase
          .from('question_bank')
          .select('question_number, type')
          .in('question_number', questionIds)
        if (questions) questions.forEach(q => { typeMap[q.question_number] = q.type })
      }
    }

    // 7. Aggregate per student
    const studentMap = {}
    profiles.forEach(p => {
      studentMap[p.id] = {
        ...p,
        totalAnswers:      totalMap[p.id]   || 0,
        correctAnswers:    correctMap[p.id] || 0,
        listeningCompleted: listenMap[p.id] || 0,
        accuracy: 0,
        lessonsPassed: 0,
        lastActive: null,
        typeStats: {},
        bestType: null,
        worstType: null,
      }
    })

    // Type breakdown from recent answers sample
    if (answers) {
      answers.forEach(a => {
        const s = studentMap[a.student_id]
        if (!s) return
        const type = typeMap[a.question_id]
        if (type) {
          if (!s.typeStats[type]) s.typeStats[type] = { correct: 0, total: 0 }
          s.typeStats[type].total++
          if (a.is_correct) s.typeStats[type].correct++
        }
      })
    }

    if (attempts) {
      attempts.forEach(a => {
        const s = studentMap[a.student_id]
        if (!s) return
        if (!s.lastActive || new Date(a.completed_at) > new Date(s.lastActive)) {
          s.lastActive = a.completed_at
        }
        const total = a.answers?.total_questions
        let pct = a.score
        if (total && total > 0) pct = Math.round((a.score / total) * 100)
        else if (a.score <= 20) pct = Math.round((a.score / 20) * 100)
        if (pct >= 70) s.lessonsPassed++
      })
    }

    // Compute accuracy and best/worst type
    Object.values(studentMap).forEach(s => {
      s.accuracy = s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0
      const typeEntries = Object.entries(s.typeStats)
        .filter(([, d]) => d.total >= 5)
        .map(([type, d]) => ({ type, pct: Math.round((d.correct / d.total) * 100) }))
        .sort((a, b) => b.pct - a.pct)
      if (typeEntries.length > 0) {
        s.bestType  = typeEntries[0].type
        s.worstType = typeEntries[typeEntries.length - 1].type
      }
    })

    setStudents(Object.values(studentMap))
    setLoading(false)
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...students].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const activeThisWeek = students.filter(s => {
    if (!s.lastActive) return false
    return (new Date() - new Date(s.lastActive)) < 7 * 24 * 60 * 60 * 1000
  }).length
  const avgAccuracy = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.accuracy, 0) / students.length)
    : 0
  const totalQuestions  = students.reduce((sum, s) => sum + s.totalAnswers, 0)
  const totalListening  = students.reduce((sum, s) => sum + s.listeningCompleted, 0)

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#667eea' }}>Loading class data...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#2C3E50', margin: '0 0 0.25rem' }}>
            Teacher Dashboard
          </h1>
          <p style={{ color: '#718096', margin: 0, fontSize: '0.9rem' }}>
            {students.length} students · {activeThisWeek} active this week
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Toggle */}
          <button
            onClick={() => setPrivateMode(m => !m)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `2px solid ${privateMode ? '#667eea' : '#e2e8f0'}`,
              background: privateMode ? '#667eea' : 'white',
              color: privateMode ? 'white' : '#718096',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: '600',
              transition: 'all 0.2s',
            }}
          >
            {privateMode ? '🔒 Private View' : '👁 Public View'}
          </button>
          {privateMode && (
            <button
              onClick={() => exportCSV(sorted)}
              style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid #48bb78', background: 'white', color: '#48bb78', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
            >
              ⬇ Export CSV
            </button>
          )}
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#f44336', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}>
            Logout
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <SummaryCard emoji="👥" label="Total Students"     value={students.length} />
        <SummaryCard emoji="🟢" label="Active This Week"   value={activeThisWeek} />
        <SummaryCard emoji="🎯" label="Class Accuracy"     value={`${avgAccuracy}%`} />
        <SummaryCard emoji="📊" label="Questions Answered" value={totalQuestions.toLocaleString()} />
        <SummaryCard emoji="🎧" label="Listening Sessions"  value={totalListening} />
      </div>

      {/* PUBLIC MODE */}
      {!privateMode && (
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 1rem' }}>
            👁 Public View — Class Overview
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1rem', background: '#f7fafc', padding: '0.75rem', borderRadius: '8px' }}>
            Screen-share safe — shows initials only, no individual performance data visible.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
            {sorted.map(s => (
              <div key={s.id} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: s.lastActive && (new Date() - new Date(s.lastActive)) < 7 * 24 * 60 * 60 * 1000
                    ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0',
                  color: s.lastActive && (new Date() - new Date(s.lastActive)) < 7 * 24 * 60 * 60 * 1000
                    ? 'white' : '#a0aec0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '700', fontSize: '0.9rem', margin: '0 auto 0.3rem',
                }}>
                  {initials(s.full_name)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#718096' }}>{s.level || '—'}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '1rem', marginBottom: 0 }}>
            Purple = active this week · Grey = not active this week
          </p>
        </div>
      )}

      {/* PRIVATE MODE */}
      {privateMode && (
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 0.5rem' }}>
            🔒 Private View — Full Student Data
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 1rem' }}>
            Click column headers to sort. Best/worst type needs at least 5 answers to show.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {[
                  ['full_name',    'Student'],
                  ['level',        'Level'],
                  ['totalAnswers', 'Questions'],
                  ['accuracy',     'Accuracy'],
                  ['lessonsPassed',       'Passed'],
                  ['listeningCompleted',  '🎧 Listening'],
                  ['bestType',           'Best Type'],
                  ['worstType',    'Worst Type'],
                  ['lastActive',   'Last Active'],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                  >
                    {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#2C3E50' }}>{s.full_name || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    {s.level ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700',
                        background: s.level?.startsWith('A') ? '#c6f6d5' : s.level?.startsWith('B') ? '#bee3f8' : '#fbd38d',
                        color: s.level?.startsWith('A') ? '#276749' : s.level?.startsWith('B') ? '#2a69ac' : '#744210',
                      }}>{s.level}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568' }}>{s.totalAnswers.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ fontWeight: '700', color: s.accuracy >= 70 ? '#38a169' : s.accuracy >= 50 ? '#dd6b20' : '#e53e3e' }}>
                      {s.totalAnswers > 0 ? `${s.accuracy}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568' }}>{s.lessonsPassed}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568' }}>{s.listeningCompleted || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#38a169', fontSize: '0.8rem' }}>
                    {s.bestType ? `${TYPE_INFO[s.bestType]?.emoji || ''} ${TYPE_INFO[s.bestType]?.label || s.bestType}` : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#e53e3e', fontSize: '0.8rem' }}>
                    {s.worstType ? `${TYPE_INFO[s.worstType]?.emoji || ''} ${TYPE_INFO[s.worstType]?.label || s.worstType}` : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#718096', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatDate(s.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && (
            <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>No student data yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ emoji, label, value }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: '3px solid #667eea', textAlign: 'center' }}>
      <div style={{ fontSize: '1.4rem', marginBottom: '0.2rem' }}>{emoji}</div>
      <div style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: '700', color: '#2C3E50', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: '0.2rem' }}>{label}</div>
    </div>
  )
}
