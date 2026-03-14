import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { TRACK_EMOJI, TRACK_LABEL } from './components/TeacherToolbar'

const TYPE_INFO = {
  gap_fill:          { label: 'Gap Fill',          emoji: '✏️' },
  multiple_choice:   { label: 'Multiple Choice',   emoji: '📝' },
  sentence_building: { label: 'Sentence Building', emoji: '🧩' },
  odd_one_out:       { label: 'Odd One Out',        emoji: '🔍' },
  error_correction:  { label: 'Error Correction',  emoji: '🚨' },
  matching:          { label: 'Matching',           emoji: '🔗' },
  sentence_auction:  { label: 'Sentence Auction',  emoji: '🔨' },
  dictation:         { label: 'Dictation',          emoji: '🎧' },
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
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function latestOf(...dates) {
  const valid = dates.filter(Boolean)
  if (valid.length === 0) return null
  return valid.reduce((best, d) => new Date(d) > new Date(best) ? d : best)
}

function exportCSV(students) {
  const headers = ['Name', 'Level', 'Questions Answered', 'Accuracy %', 'Test ✅', 'Listen ✅', 'Dict ✅', 'Topic ✅', 'Best Type', 'Worst Type', 'Last Active']
  const rows = students.map(s => [
    s.full_name || 'Unknown',
    s.level || '—',
    s.totalAnswers,
    s.accuracy,
    s.testPassed,
    s.listenPassed,
    s.dictPassed,
    s.topicPassed,
    s.bestType ? (TYPE_INFO[s.bestType]?.label || s.bestType) : '—',
    s.worstType ? (TYPE_INFO[s.worstType]?.label || s.worstType) : '—',
    s.lastActive ? new Date(s.lastActive).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
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

export default function TeacherDashboard({ profile, handleLogout, globalLang, onToggleLang, onBrowseClick, onHomeClick, teacherTrack = 'en', onCycleTrack }) {
  const [students, setStudents]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [privateMode, setPrivateMode]   = useState(false)
  const [sortKey, setSortKey]           = useState('lastActive')
  const [sortDir, setSortDir]           = useState('desc')

  const [wotdSubmissions, setWotdSubmissions] = useState([])
  const [wotdWords, setWotdWords]             = useState([])
  const [wotdLoading, setWotdLoading]         = useState(true)
  const [wotdOpen, setWotdOpen]               = useState(true)
  const [wotdFilter, setWotdFilter]           = useState('all')
  const [wotdProfileMap, setWotdProfileMap]   = useState({})

  useEffect(() => { fetchAllData(); fetchWotdData() }, [])

  async function fetchAllData() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, level, approved')
      .eq('approved', true)
      .eq('is_teacher', false)

    if (!profiles || profiles.length === 0) { setLoading(false); return }

    const ids = profiles.map(p => p.id)

    const totalCountsPromises   = ids.map(id =>
      supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id)
    )
    const correctCountsPromises = ids.map(id =>
      supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id).eq('is_correct', true)
    )
    const testPassedPromises = ids.map(id =>
      supabase.from('student_attempts').select('*', { count: 'exact', head: true }).eq('student_id', id).gte('score', 14)
    )
    const listenPassPromises = ids.map(id =>
      supabase.from('listening_sessions')
        .select('detail_correct, detail_total')
        .eq('student_id', id)
        .eq('stage_reached', 'review')
    )
    const dictPassPromises = ids.map(id =>
      supabase.from('dictation_sessions').select('*', { count: 'exact', head: true })
        .eq('student_id', id)
        .or('is_correct.eq.true,is_soft_pass.eq.true')
    )
    const topicPassPromises = ids.map(id =>
      supabase.from('topic_sessions').select('*', { count: 'exact', head: true })
        .eq('student_id', id)
        .eq('passed', true)
    )

    const [totalResults, correctResults, testPassedResults, listenPassResults, dictPassResults, topicPassResults] = await Promise.all([
      Promise.all(totalCountsPromises),
      Promise.all(correctCountsPromises),
      Promise.all(testPassedPromises),
      Promise.all(listenPassPromises),
      Promise.all(dictPassPromises),
      Promise.all(topicPassPromises),
    ])

    const totalMap = {}, correctMap = {}, testPassedMap = {}, listenPassMap = {}, dictPassMap = {}, topicPassMap = {}
    ids.forEach((id, i) => {
      totalMap[id]      = totalResults[i].count || 0
      correctMap[id]    = correctResults[i].count || 0
      testPassedMap[id] = testPassedResults[i].count || 0
      const listenRows  = listenPassResults[i].data || []
      listenPassMap[id] = listenRows.filter(r => r.detail_total > 0 && r.detail_correct / r.detail_total >= 0.7).length
      dictPassMap[id]   = dictPassResults[i].count || 0
      topicPassMap[id]  = topicPassResults[i].count || 0
    })

    const activeIds = ids.filter(id => (totalMap[id] || 0) > 0)
    const answerChunks = await Promise.all(
      activeIds.map(id =>
        supabase
          .from('student_answers')
          .select('student_id, is_correct, question_id, answered_at')
          .eq('student_id', id)
          .order('answered_at', { ascending: false })
          .limit(400)
      )
    )
    const answers = answerChunks.flatMap(r => r.data || [])

    const { data: attempts } = await supabase
      .from('student_attempts')
      .select('student_id, completed_at')
      .in('student_id', ids)
      .order('completed_at', { ascending: false })
      .limit(2000)

    const { data: listeningSessions } = await supabase
      .from('listening_sessions')
      .select('student_id, completed_at')
      .in('student_id', ids)
      .order('completed_at', { ascending: false })
      .limit(500)

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

    const studentMap = {}
    profiles.forEach(p => {
      studentMap[p.id] = {
        ...p,
        totalAnswers:   totalMap[p.id]      || 0,
        correctAnswers: correctMap[p.id]    || 0,
        testPassed:     testPassedMap[p.id] || 0,
        listenPassed:   listenPassMap[p.id] || 0,
        dictPassed:     dictPassMap[p.id]   || 0,
        topicPassed:    topicPassMap[p.id]  || 0,
        accuracy: 0,
        lastActive: null, lastAnswered: null, lastListened: null, lastAttempt: null,
        typeStats: {}, bestType: null, worstType: null,
      }
    })

    if (answers) {
      answers.forEach(a => {
        const s = studentMap[a.student_id]
        if (!s) return
        if (!s.lastAnswered || new Date(a.answered_at) > new Date(s.lastAnswered))
          s.lastAnswered = a.answered_at
        const type = typeMap[a.question_id]
        if (type) {
          if (!s.typeStats[type]) s.typeStats[type] = { correct: 0, total: 0 }
          s.typeStats[type].total++
          if (a.is_correct) s.typeStats[type].correct++
        }
      })
    }

    if (listeningSessions) {
      listeningSessions.forEach(ls => {
        const s = studentMap[ls.student_id]
        if (!s) return
        if (!s.lastListened || new Date(ls.completed_at) > new Date(s.lastListened))
          s.lastListened = ls.completed_at
      })
    }

    if (attempts) {
      attempts.forEach(a => {
        const s = studentMap[a.student_id]
        if (!s) return
        if (!s.lastAttempt || new Date(a.completed_at) > new Date(s.lastAttempt))
          s.lastAttempt = a.completed_at
      })
    }

    Object.values(studentMap).forEach(s => {
      s.lastActive = latestOf(s.lastAnswered, s.lastListened, s.lastAttempt)
      s.accuracy   = s.totalAnswers > 0 ? Math.round((s.correctAnswers / s.totalAnswers) * 100) : 0
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

  async function fetchWotdData() {
    setWotdLoading(true)
    const { data: subs } = await supabase
      .from('word_of_the_day_submissions')
      .select(`id, student_id, sentence, is_correct, is_soft_pass, ai_feedback, submitted_at, word_of_the_day ( id, date, word, part_of_speech, level, language )`)
      .order('submitted_at', { ascending: false })
      .limit(200)

    if (subs && subs.length > 0) {
      const studentIds = [...new Set(subs.map(s => s.student_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, level').in('id', studentIds)
      const profileMap = {}
      if (profiles) profiles.forEach(p => { profileMap[p.id] = p })
      setWotdProfileMap(profileMap)
      setWotdSubmissions(subs)
      const wordMap = {}
      subs.forEach(s => { if (s.word_of_the_day) wordMap[s.word_of_the_day.id] = s.word_of_the_day })
      setWotdWords(Object.values(wordMap).sort((a, b) => new Date(b.date) - new Date(a.date)))
    }
    setWotdLoading(false)
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

  const totalQAll   = students.reduce((sum, s) => sum + s.totalAnswers, 0)
  const totalCAll   = students.reduce((sum, s) => sum + s.correctAnswers, 0)
  const avgAccuracy = totalQAll > 0 ? Math.round((totalCAll / totalQAll) * 100) : 0
  const totalQuestions = totalQAll

  const today = new Date().toISOString().split('T')[0]
  const filteredSubs = wotdSubmissions.filter(s => {
    if (wotdFilter === 'today')     return s.word_of_the_day?.date === today
    if (wotdFilter === 'correct')   return s.is_correct
    if (wotdFilter === 'incorrect') return !s.is_correct
    return true
  })

  const subsByWord = {}
  filteredSubs.forEach(s => {
    const key = s.word_of_the_day?.id
    if (!key) return
    if (!subsByWord[key]) subsByWord[key] = { word: s.word_of_the_day, subs: [] }
    subsByWord[key].subs.push(s)
  })
  const groupedWords = Object.values(subsByWord).sort((a, b) => new Date(b.word.date) - new Date(a.word.date))

  const wotdTotal   = wotdSubmissions.length
  const wotdCorrect = wotdSubmissions.filter(s => s.is_correct).length
  const wotdToday   = wotdSubmissions.filter(s => s.word_of_the_day?.date === today).length

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: '#667eea' }}>Loading class data...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1rem 4rem' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', color: '#2C3E50', margin: '0 0 0.25rem' }}>Teacher Dashboard</h1>
          <p style={{ color: '#718096', margin: 0, fontSize: '0.9rem' }}>
            {students.length} students · {activeThisWeek} active this week
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Track cycler — replaces lang toggle */}
          {onCycleTrack && (
            <button
              onClick={onCycleTrack}
              title={`Track: ${TRACK_LABEL[teacherTrack]} — click to cycle`}
              style={{ height: '34px', width: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {TRACK_EMOJI[teacherTrack] || '🇬🇧'}
            </button>
          )}
          {onBrowseClick && (
            <button onClick={onBrowseClick} style={{ height: '34px', padding: '0 10px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: '#2d3748', whiteSpace: 'nowrap' }}>
              🔍 Browse
            </button>
          )}
          {onHomeClick && (
            <button onClick={onHomeClick} title="Home" style={{ height: '34px', width: '34px', borderRadius: '8px', background: '#f0f0f5', border: 'none', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🏠
            </button>
          )}
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 2px' }} />
          <button
            onClick={() => setPrivateMode(m => !m)}
            style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: `2px solid ${privateMode ? '#667eea' : '#e2e8f0'}`, background: privateMode ? '#667eea' : 'white', color: privateMode ? 'white' : '#718096', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
          >
            {privateMode ? '🔒 Private' : '👁️ Public'}
          </button>
          {privateMode && (
            <button
              onClick={() => exportCSV(sorted)}
              style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '2px solid #48bb78', background: 'white', color: '#48bb78', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', whiteSpace: 'nowrap' }}
            >
              ⬇ CSV
            </button>
          )}
          <button onClick={handleLogout} style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: 'none', background: '#f44336', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
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
      </div>

      {/* PUBLIC MODE */}
      {!privateMode && (
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 1rem' }}>👁 Public View — Class Overview</h2>
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
        <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 0.5rem' }}>🔒 Private View — Full Student Data</h2>
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
                  ['testPassed',   'Test ✅'],
                  ['listenPassed', 'Listen ✅'],
                  ['dictPassed',   'Dict ✅'],
                  ['topicPassed',  'Topic ✅'],
                  ['bestType',     'Best Type'],
                  ['worstType',    'Worst Type'],
                  ['lastActive',   'Last Active'],
                ].map(([key, label]) => (
                  <th key={key} onClick={() => handleSort(key)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
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
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700',
                        background: s.level === 'Spanish' ? '#fff0f0' : s.level?.startsWith('A') ? '#c6f6d5' : s.level?.startsWith('B') ? '#bee3f8' : '#fbd38d',
                        color:      s.level === 'Spanish' ? '#e53e3e' : s.level?.startsWith('A') ? '#276749' : s.level?.startsWith('B') ? '#2a69ac' : '#744210'
                      }}>{s.level === 'Spanish' ? 'ES' : s.level}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568' }}>{s.totalAnswers.toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ fontWeight: '700', color: s.accuracy >= 70 ? '#38a169' : s.accuracy >= 50 ? '#dd6b20' : '#e53e3e' }}>
                      {s.totalAnswers > 0 ? `${s.accuracy}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568', textAlign: 'center' }}>{s.testPassed || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568', textAlign: 'center' }}>{s.listenPassed || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568', textAlign: 'center' }}>{s.dictPassed || '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568', textAlign: 'center' }}>{s.topicPassed || '—'}</td>
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
          {students.length === 0 && <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>No student data yet.</p>}
        </div>
      )}

      {/* WORD OF THE DAY SUBMISSIONS */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div
          onClick={() => setWotdOpen(o => !o)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: wotdOpen ? '1px solid #e2e8f0' : 'none', background: '#fafafa' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📖</span>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: 0 }}>Word of the Day — Student Sentences</h2>
              <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>{wotdTotal} submissions · {wotdCorrect} correct · {wotdToday} today</p>
            </div>
          </div>
          <div style={{ background: wotdOpen ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
            {wotdOpen ? '👨‍🏫' : '🔒'}
          </div>
        </div>

        {wotdOpen && (
          <div style={{ padding: '1.25rem' }}>
            {wotdLoading && <p style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>Loading submissions...</p>}
            {!wotdLoading && wotdTotal === 0 && (
              <p style={{ color: '#a0aec0', textAlign: 'center', padding: '1rem' }}>No submissions yet — check back once students have used the Word of the Day!</p>
            )}
            {!wotdLoading && wotdTotal > 0 && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                  {[
                    ['all',       'All',        '#667eea'],
                    ['today',     'Today',      '#48bb78'],
                    ['correct',   '✅ Correct',  '#38a169'],
                    ['incorrect', '❌ Incorrect','#e53e3e'],
                  ].map(([val, label, colour]) => (
                    <button key={val} onClick={() => setWotdFilter(val)}
                      style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', border: `2px solid ${wotdFilter === val ? colour : '#e2e8f0'}`, background: wotdFilter === val ? colour : 'white', color: wotdFilter === val ? 'white' : '#718096', transition: 'all 0.15s' }}
                    >{label}</button>
                  ))}
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#a0aec0', alignSelf: 'center' }}>
                    {filteredSubs.length} submission{filteredSubs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {groupedWords.length === 0 && <p style={{ color: '#a0aec0', textAlign: 'center', padding: '1rem' }}>No submissions match this filter.</p>}
                {groupedWords.map(({ word, subs }) => {
                  const levelColour = word.level === 'A1/A2' ? '#48bb78' : word.level === 'B1/B2' ? '#4299e1' : '#ed8936'
                  const correctCount = subs.filter(s => s.is_correct).length
                  return (
                    <div key={word.id} style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#2C3E50' }}>{word.word}</span>
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0', fontStyle: 'italic' }}>{word.part_of_speech}</span>
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', background: levelColour + '22', color: levelColour }}>{word.level}</span>
                        {word.language === 'es' && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', background: '#fff0f0', color: '#e53e3e' }}>🇪🇸 Spanish</span>}
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>{new Date(word.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#718096', fontWeight: '600' }}>{correctCount}/{subs.length} correct</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {subs.map(sub => {
                          const studentProfile = wotdProfileMap[sub.student_id]
                          return (
                            <div key={sub.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: sub.is_correct ? '#f0fff4' : '#fff5f5', border: `1px solid ${sub.is_correct ? '#c6f6d5' : '#fed7d7'}`, borderRadius: '10px', padding: '0.75rem 1rem' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: sub.is_correct ? 'linear-gradient(135deg, #48bb78, #38a169)' : 'linear-gradient(135deg, #fc8181, #e53e3e)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem' }}>
                                {initials(studentProfile?.full_name)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  <span style={{ fontWeight: '600', color: '#2C3E50', fontSize: '0.85rem' }}>{studentProfile?.full_name || 'Unknown'}</span>
                                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    {studentProfile?.level && (
                                      <span style={{ padding: '1px 7px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '700', background: studentProfile.level?.startsWith('A') ? '#c6f6d5' : studentProfile.level?.startsWith('B') ? '#bee3f8' : '#fbd38d', color: studentProfile.level?.startsWith('A') ? '#276749' : studentProfile.level?.startsWith('B') ? '#2a69ac' : '#744210' }}>
                                        {studentProfile.level}
                                      </span>
                                    )}
                                    <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>{formatDate(sub.submitted_at)}</span>
                                    {sub.is_soft_pass && <span style={{ fontSize: '0.68rem', background: '#fbd38d', color: '#744210', padding: '1px 6px', borderRadius: '99px', fontWeight: '600' }}>soft pass</span>}
                                  </div>
                                </div>
                                <p style={{ margin: '0 0 0.35rem', fontSize: '0.9rem', color: '#2d3748', fontStyle: 'italic' }}>"{sub.sentence}"</p>
                                {sub.ai_feedback && (
                                  <p style={{ margin: 0, fontSize: '0.78rem', color: sub.is_correct ? '#276749' : '#9b2c2c', lineHeight: '1.4' }}>
                                    {sub.is_correct ? '✅ ' : '❌ '}{sub.ai_feedback}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
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
