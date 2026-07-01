import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import StudentPanel from './components/StudentPanel'
import UsageMap from './components/UsageMap'

const TYPE_INFO = {
  gap_fill:        { label: 'Gap Fill',        emoji: '✏️' },
  multiple_choice: { label: 'Multiple Choice', emoji: '📝' },
  sentence_building:{ label: 'Sentence Building', emoji: '🧩' },
  odd_one_out:     { label: 'Odd One Out',     emoji: '🔍' },
  error_correction:{ label: 'Error Correction',emoji: '🚨' },
  matching:        { label: 'Matching',         emoji: '🔗' },
  sentence_auction:{ label: 'Sentence Auction', emoji: '🔨' },
  dictation:       { label: 'Dictation',        emoji: '🎧' },
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

function getMondayISO() {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d); mon.setDate(diff); mon.setHours(0, 0, 0, 0)
  return mon.toISOString()
}

function exportCSV(students, showInactive) {
  const headers = ['Name', 'Level', 'Activity', 'Last 7d', 'Last 30d', 'Success %', 'Last Active']
  const rows = students.filter(s => showInactive || s.lastActive).map(s => [
    s.full_name || 'Unknown',
    s.level || '—',
    s.activityTotal || 0,
    s.events7d || 0,
    s.events30d || 0,
    s.successAll == null ? '' : s.successAll,
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

export default function TeacherDashboard({ profile, handleLogout }) {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [hideNames, setHideNames] = useState(false)
  const [sortKey, setSortKey] = useState('lastActive')
  const [sortDir, setSortDir] = useState('desc')
  const [wotdSubmissions, setWotdSubmissions] = useState([])
  const [wotdWords, setWotdWords] = useState([])
  const [wotdLoading, setWotdLoading] = useState(true)
  const [wotdOpen, setWotdOpen] = useState(true)
  const [wotdFilter, setWotdFilter] = useState('all')
  const [wotdProfileMap, setWotdProfileMap] = useState({})
  const [weeklyStars, setWeeklyStars] = useState([])
  const [weeklyStarsOpen, setWeeklyStarsOpen] = useState(true)
  const [queenBeeAlerts, setQueenBeeAlerts] = useState([])
  const [queenBeeOpen, setQueenBeeOpen] = useState(true)
  const [questionFlags, setQuestionFlags] = useState([])
  const [flagsOpen, setFlagsOpen] = useState(true)
  const [showInactive, setShowInactive] = useState(true)
  const [awardingFor, setAwardingFor] = useState(null) // { id, name } | null
  const [viewingStudent, setViewingStudent] = useState(null) // { id, full_name, level } | null

  useEffect(() => { fetchAllData(); fetchWotdData(); fetchStarsLeaderboard(); fetchQueenBeeAlerts(); fetchQuestionFlags() }, [])

  async function fetchAllData() {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, level, approved')
      .eq('approved', true)
      .eq('is_teacher', false)

    if (!profiles || profiles.length === 0) { setLoading(false); return }

    const ids = profiles.map(p => p.id)

    const totalCountsPromises   = ids.map(id => supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id))
    const correctCountsPromises  = ids.map(id => supabase.from('student_answers').select('*', { count: 'exact', head: true }).eq('student_id', id).eq('is_correct', true))
    const testPassedPromises     = ids.map(id => supabase.from('student_attempts').select('*', { count: 'exact', head: true }).eq('student_id', id).gte('score', 14))
    const listenPassPromises     = ids.map(id => supabase.from('listening_sessions').select('detail_correct, detail_total').eq('student_id', id).eq('stage_reached', 'review'))
    const topicPassPromises      = ids.map(id => supabase.from('topic_sessions').select('*', { count: 'exact', head: true }).eq('student_id', id).eq('passed', true))
    const realTalkPassPromises   = ids.map(id => supabase.from('real_talk_sessions').select('*', { count: 'exact', head: true }).eq('student_id', id).eq('ending_type', 'good'))

    const [totalResults, correctResults, testPassedResults, listenPassResults, topicPassResults, realTalkPassResults] = await Promise.all([
      Promise.all(totalCountsPromises),
      Promise.all(correctCountsPromises),
      Promise.all(testPassedPromises),
      Promise.all(listenPassPromises),
      Promise.all(topicPassPromises),
      Promise.all(realTalkPassPromises),
    ])

    const totalMap = {}, correctMap = {}, testPassedMap = {}, listenPassMap = {}, topicPassMap = {}, realTalkPassMap = {}
    ids.forEach((id, i) => {
      totalMap[id]        = totalResults[i].count || 0
      correctMap[id]      = correctResults[i].count || 0
      testPassedMap[id]   = testPassedResults[i].count || 0
      const listenRows    = listenPassResults[i].data || []
      listenPassMap[id]   = listenRows.filter(r => r.detail_total > 0 && r.detail_correct / r.detail_total >= 0.7).length
      topicPassMap[id]    = topicPassResults[i].count || 0
      realTalkPassMap[id] = realTalkPassResults[i].count || 0
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

    // Bulk lastActive from all other activity tables
    const [dictSess, rtSess, topicSess, wordleSess, connSess, wotdSess] = await Promise.all([
      supabase.from('dictation_sessions').select('student_id, completed_at').in('student_id', ids).order('completed_at', { ascending: false }).limit(500),
      supabase.from('real_talk_sessions').select('student_id, completed_at').in('student_id', ids).order('completed_at', { ascending: false }).limit(200),
      supabase.from('topic_sessions').select('student_id, created_at').in('student_id', ids).order('created_at', { ascending: false }).limit(500),
      supabase.from('wordle_sessions').select('student_id, completed_at').in('student_id', ids).order('completed_at', { ascending: false }).limit(500),
      supabase.from('connections_sessions').select('student_id, completed_at').in('student_id', ids).order('completed_at', { ascending: false }).limit(200),
      supabase.from('word_of_the_day_submissions').select('student_id, submitted_at').in('student_id', ids).order('submitted_at', { ascending: false }).limit(500),
    ])
    const allDictSess  = dictSess.data  || []
    const allRtSess    = rtSess.data    || []
    const allTopicSess = topicSess.data || []
    const allWrdlSess  = wordleSess.data|| []
    const allConnSess  = connSess.data  || []
    const allWotdSess  = wotdSess.data  || []

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
        totalAnswers:   totalMap[p.id]        || 0,
        correctAnswers: correctMap[p.id]       || 0,
        passedTotal:    (testPassedMap[p.id]   || 0)
                      + (listenPassMap[p.id]   || 0)
                      + (topicPassMap[p.id]    || 0)
                      + (realTalkPassMap[p.id] || 0),
        accuracy: 0,
        lastActive: null,
        typeStats: {}, bestType: null, worstType: null,
      }
    })

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

    // Helper: latest date per student from a rows array
    const latestPer = (rows, idKey, dateKey) => {
      const map = {}
      rows.forEach(r => {
        const id = r[idKey], d = r[dateKey]
        if (!id || !d) return
        if (!map[id] || new Date(d) > new Date(map[id])) map[id] = d
      })
      return map
    }
    const answerDates  = latestPer(answers || [],    'student_id', 'answered_at')
    const listenDates  = latestPer(listeningSessions || [], 'student_id', 'completed_at')
    const attemptDates = latestPer(attempts || [],   'student_id', 'completed_at')
    const dictDates    = latestPer(allDictSess,  'student_id', 'completed_at')
    const rtDates      = latestPer(allRtSess,    'student_id', 'completed_at')
    const topicDates   = latestPer(allTopicSess, 'student_id', 'created_at')
    const wrdlDates    = latestPer(allWrdlSess,  'student_id', 'completed_at')
    const connDates    = latestPer(allConnSess,  'student_id', 'completed_at')
    const wotdDates    = latestPer(allWotdSess,  'student_id', 'submitted_at')

    Object.values(studentMap).forEach(s => {
      s.lastActive = latestOf(
        answerDates[s.id], listenDates[s.id], attemptDates[s.id],
        dictDates[s.id], rtDates[s.id], topicDates[s.id],
        wrdlDates[s.id], connDates[s.id], wotdDates[s.id]
      )
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

    const { data: overview } = await supabase.rpc('student_overview')
    const ovMap = {}
    ;(overview || []).forEach(o => { ovMap[o.student_id] = o })
    Object.values(studentMap).forEach(s => {
      const o = ovMap[s.id]
      s.activityTotal = o ? Number(o.total_events) : 0
      s.events7d      = o ? Number(o.events_7d)     : 0
      s.events30d     = o ? Number(o.events_30d)    : 0
      s.successAll    = o ? o.success_pct : null
      s.mix = o ? {
        exercises:          Number(o.cat_exercises),
        speaking_listening: Number(o.cat_speaking_listening),
        games:              Number(o.cat_games),
        daily_prompt:       Number(o.cat_daily_prompt),
        flashcards:         Number(o.cat_flashcards),
      } : null
      if (o && o.last_active) s.lastActive = latestOf(s.lastActive, o.last_active)
      const daysQuiet = s.lastActive ? Math.floor((Date.now() - new Date(s.lastActive)) / 86400000) : Infinity
      s.dropped = s.activityTotal >= 20 && s.events7d === 0 && daysQuiet >= 7 && daysQuiet <= 60
    })

    setStudents(Object.values(studentMap))
    setLoading(false)
  }

  async function fetchWotdData() {
    setWotdLoading(true)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: subs } = await supabase
      .from('word_of_the_day_submissions')
      .select(`id, student_id, sentence, is_correct, is_soft_pass, ai_feedback, submitted_at,
        word_of_the_day ( id, date, word, part_of_speech, level, language )`)
      .gte('submitted_at', sevenDaysAgo)
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

  async function fetchStarsLeaderboard() {
    const monday = getMondayISO()
    const { data: rows } = await supabase
      .from('stars')
      .select('student_id, source, subtype')
      .gte('awarded_at', monday)

    if (!rows || rows.length === 0) return

    const studentIds = [...new Set(rows.map(r => r.student_id))]
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, level').in('id', studentIds)
    const profileMap = {}
    if (profiles) profiles.forEach(p => { profileMap[p.id] = p })

    // Group: per student, count by source.
    const totals = {}
    rows.forEach(r => {
      if (!totals[r.student_id]) totals[r.student_id] = { wordle: 0, spelling_bee: 0, connections: 0, wotd: 0, gotd: 0, wordsearch: 0, crossword: 0, teacher_awarded: 0, other: 0, total: 0 }
      const bucket = ['wordle','spelling_bee','connections','wotd','gotd','wordsearch','crossword','teacher_awarded'].includes(r.source) ? r.source : 'other'
      totals[r.student_id][bucket]++
      totals[r.student_id].total++
    })

    const leaderboard = Object.entries(totals)
      .map(([id, counts]) => ({
        id,
        name:  profileMap[id]?.full_name || 'Unknown',
        level: profileMap[id]?.level     || '—',
        ...counts,
      }))
      .sort((a, b) => b.total - a.total)

    setWeeklyStars(leaderboard)
  }

  async function fetchQueenBeeAlerts() {
    const { data: alerts } = await supabase
      .from('queen_bee_alerts')
      .select('*')
      .order('achieved_at', { ascending: false })
      .limit(20)
    if (!alerts || alerts.length === 0) return

    const userIds   = [...new Set(alerts.map(a => a.user_id))]
    const puzzleIds = [...new Set(alerts.map(a => a.puzzle_id))]
    const [profilesRes, puzzlesRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, level').in('id', userIds),
      supabase.from('spelling_bee_puzzles').select('id, play_date, language, centre_letter, outer_letters, pangrams').in('id', puzzleIds),
    ])
    const profileMap = {}, puzzleMap = {}
    ;(profilesRes.data || []).forEach(p => { profileMap[p.id] = p })
    ;(puzzlesRes.data  || []).forEach(p => { puzzleMap[p.id]  = p })

    setQueenBeeAlerts(alerts.map(a => ({
      ...a,
      student: profileMap[a.user_id] || null,
      puzzle:  puzzleMap[a.puzzle_id] || null,
    })))
  }

  async function markQueenBeeSeen(id) {
    await supabase.from('queen_bee_alerts').update({ seen_by_teacher: true }).eq('id', id)
    setQueenBeeAlerts(prev => prev.map(a => a.id === id ? { ...a, seen_by_teacher: true } : a))
  }

  async function fetchQuestionFlags() {
    const { data: flags } = await supabase
      .from('question_flags')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!flags || flags.length === 0) { setQuestionFlags([]); return }

    const userIds  = [...new Set(flags.map(f => f.user_id))]
    const qNumbers = [...new Set(flags.map(f => f.question_number))]
    const [profilesRes, questionsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, level').in('id', userIds),
      supabase.from('question_bank').select('question_number, question, type, level, topic, correct_answer').in('question_number', qNumbers),
    ])
    const profileMap = {}, questionMap = {}
    ;(profilesRes.data  || []).forEach(p => { profileMap[p.id] = p })
    ;(questionsRes.data || []).forEach(q => { questionMap[q.question_number] = q })

    setQuestionFlags(flags.map(f => ({
      ...f,
      student:  profileMap[f.user_id] || null,
      question: questionMap[f.question_number] || null,
    })))
  }

  async function resolveFlag(id) {
    await supabase.from('question_flags').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
    setQuestionFlags(prev => prev.filter(f => f.id !== id))
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const visibleStudents = showInactive ? students : students.filter(s => s.lastActive !== null)
  const sorted = [...visibleStudents].sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const neverActive = students.filter(s => !s.lastActive).length
  const activeThisWeek = students.filter(s => {
    if (!s.lastActive) return false
    return (new Date() - new Date(s.lastActive)) < 7 * 24 * 60 * 60 * 1000
  }).length

  const totalQAll    = visibleStudents.reduce((sum, s) => sum + s.totalAnswers, 0)
  const totalCAll    = visibleStudents.reduce((sum, s) => sum + s.correctAnswers, 0)
  const avgAccuracy  = totalQAll > 0 ? Math.round((totalCAll / totalQAll) * 100) : 0
  const totalQuestions = totalQAll
  const today = new Date().toISOString().split('T')[0]

  const filteredSubs = wotdSubmissions.filter(s => {
    if (wotdFilter === 'today')    return s.word_of_the_day?.date === today
    if (wotdFilter === 'correct')  return s.is_correct
    if (wotdFilter === 'incorrect')return !s.is_correct
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
          {neverActive > 0 && (
            <button onClick={() => setShowInactive(v => !v)}
              style={{ marginTop: '4px', padding: '2px 10px', fontSize: '0.75rem', borderRadius: '6px', border: `1px solid ${showInactive ? '#667eea' : '#e2e8f0'}`, background: showInactive ? '#EDE9FE' : 'white', color: showInactive ? '#553C9A' : '#718096', cursor: 'pointer', fontWeight: 600 }}>
              {showInactive ? `Showing all (hide ${neverActive} never active)` : `${neverActive} never-active hidden`}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '1px', height: '24px', background: '#e2e8f0', margin: '0 2px' }} />
          <button onClick={() => setHideNames(m => !m)}
            title="Swap names for initials — handy when sharing your screen"
            style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: `2px solid ${hideNames ? '#667eea' : '#e2e8f0'}`, background: hideNames ? '#667eea' : 'white', color: hideNames ? 'white' : '#718096', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
            {hideNames ? '🙈 Names hidden' : 'Hide names'}
          </button>
          <button onClick={() => exportCSV(sorted, showInactive)}
            style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: '2px solid #48bb78', background: 'white', color: '#48bb78', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
            ⬇ CSV
          </button>
          <button onClick={handleLogout}
            style={{ height: '34px', padding: '0 10px', borderRadius: '8px', border: 'none', background: '#f44336', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
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

      {/* STUDENT TABLE */}
      <div style={{ background: 'white', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: '0 0 0.5rem' }}>Students</h2>
          <p style={{ fontSize: '0.78rem', color: '#718096', margin: '0 0 1rem' }}>
            Click any row for the full breakdown · click a header to sort.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {[
                  ['full_name',     'Student'],
                  ['level',         'Level'],
                  ['mix',           'Mix'],
                  ['activityTotal', 'Activity'],
                  ['events7d',      'Last 7d'],
                  ['successAll',    'Success'],
                  ['lastActive',    'Last active'],
                ].map(([key, label]) => (
                  <th key={key} onClick={key === 'mix' ? undefined : () => handleSort(key)}
                    style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', cursor: key === 'mix' ? 'default' : 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', color: '#718096', fontWeight: '600', whiteSpace: 'nowrap' }}>Award</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.id} onClick={() => setViewingStudent({ id: s.id, full_name: s.full_name, level: s.level })}
                  style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa', cursor: 'pointer' }}>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: '600', color: '#2C3E50' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {s.dropped && <span title="Was a regular, gone quiet for 7+ days" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ed8936', flexShrink: 0 }} />}
                      {hideNames ? initials(s.full_name) : (s.full_name || '—')}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    {s.level ? (
                      <span style={{
                        padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: '700',
                        background: s.level === 'Spanish' ? '#fff0f0' : s.level?.startsWith('A') ? '#c6f6d5' : s.level?.startsWith('B') ? '#bee3f8' : '#fbd38d',
                        color:      s.level === 'Spanish' ? '#e53e3e' : s.level?.startsWith('A') ? '#276749' : s.level?.startsWith('B') ? '#2a69ac' : '#744210',
                      }}>{s.level === 'Spanish' ? 'ES' : s.level}</span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem' }}><MixBar mix={s.mix} total={s.activityTotal} /></td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#4a5568', fontWeight: 600 }}>{(s.activityTotal || 0).toLocaleString()}</td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', color: s.events7d > 0 ? '#4a5568' : '#cbd5e0' }}>{s.events7d > 0 ? s.events7d.toLocaleString() : '—'}</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span style={{ fontWeight: '700', color: s.successAll == null ? '#cbd5e0' : s.successAll >= 70 ? '#38a169' : s.successAll >= 50 ? '#dd6b20' : '#e53e3e' }}>
                      {s.successAll == null ? '—' : `${s.successAll}%`}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', color: '#718096', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {formatDate(s.lastActive)}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAwardingFor({ id: s.id, name: s.full_name || 'Student' }) }}
                      title={`Award a star to ${s.full_name || 'this student'}`}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      +⭐
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && <p style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem' }}>No student data yet.</p>}
        </div>

      <UsageMap />

      {/* REPORTED QUESTIONS */}
      {questionFlags.length > 0 && (
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '1rem' }}>
          <div onClick={() => setFlagsOpen(o => !o)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: flagsOpen ? '1px solid #fed7d7' : 'none', background: '#fff5f5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🚩</span>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#2C3E50', margin: 0 }}>Reported Questions</h2>
                <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>
                  {questionFlags.length} open report{questionFlags.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div style={{ background: flagsOpen ? 'linear-gradient(135deg, #f56565, #c53030)' : '#e2e8f0', color: 'white', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              {flagsOpen ? '🚩' : '🔒'}
            </div>
          </div>
          {flagsOpen && (
            <div style={{ padding: '0.5rem 1.25rem 1.25rem' }}>
              {questionFlags.map(f => {
                const q = f.question
                const typeInfo = q ? TYPE_INFO[q.type] : null
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.8rem 0.9rem', borderRadius: '10px', marginTop: '0.6rem',
                    background: '#fff5f5', border: '1px solid #fed7d7',
                  }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #fc8181, #e53e3e)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                      {initials(f.student?.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#2C3E50' }}>{f.student?.full_name || 'Unknown'}</span>
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>{formatDate(f.created_at)}</span>
                        <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>
                          Q{f.question_number}{q ? ` · ${typeInfo?.emoji || ''} ${typeInfo?.label || q.type}` : ' · (not found)'}{q?.level ? ` · ${q.level}` : ''}
                        </span>
                      </div>
                      {q && (
                        <div style={{ fontSize: '0.85rem', color: '#2d3748', marginTop: '4px', lineHeight: 1.4 }}>
                          {q.question}
                          {q.correct_answer ? <span style={{ color: '#718096' }}> — <em>ans: {q.correct_answer}</em></span> : null}
                        </div>
                      )}
                      {f.reason && (
                        <div style={{ fontSize: '0.78rem', color: '#9b2c2c', marginTop: '4px', fontStyle: 'italic', lineHeight: 1.4 }}>
                          💬 {f.reason}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => resolveFlag(f.id)}
                      title="Mark as resolved"
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fed7d7', background: 'white', color: '#c53030', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      ✓ Resolve
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* WEEKLY STARS LEADERBOARD */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '1rem' }}>
        <div onClick={() => setWeeklyStarsOpen(o => !o)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: weeklyStarsOpen ? '1px solid #e2e8f0' : 'none', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>⭐</span>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', color: '#2C3E50', margin: 0 }}>Stars this week</h2>
              <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>
                {weeklyStars.length > 0
                  ? `${weeklyStars.length} student${weeklyStars.length !== 1 ? 's' : ''} earned stars`
                  : 'No stars yet this week'}
              </p>
            </div>
          </div>
          <div style={{ background: weeklyStarsOpen ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#e2e8f0', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
            {weeklyStarsOpen ? '🟩' : '🔒'}
          </div>
        </div>
        {weeklyStarsOpen && (
          <div style={{ padding: '1.25rem' }}>
            {weeklyStars.length === 0 ? (
              <p style={{ color: '#a0aec0', textAlign: 'center', padding: '1rem', margin: 0 }}>No stars earned this week yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left',   color: '#718096', fontWeight: 600 }}>#</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'left',   color: '#718096', fontWeight: 600 }}>Student</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Wordle">🟩</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Spelling Bee">🐝</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Connections">🔗</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Word of the Day">📖</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Grammar of the Day">📝</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Wordsearch">🔎</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Crossword">✜</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Sentence challenges in topic practice / RPE">✍️</th>
                    <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', color: '#718096', fontWeight: 600 }} title="Awarded by you">👨‍🏫</th>
                    <th style={{ padding: '0.5rem 0.5rem', textAlign: 'center', color: '#718096', fontWeight: 600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyStars.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0', background: i === 0 ? '#fffbeb' : i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: i === 0 ? '#f59e0b' : '#718096' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600, color: '#2C3E50' }}>{s.name}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.wordle          || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.spelling_bee    || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.connections     || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.wotd            || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.gotd            || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.wordsearch      || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.crossword       || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.other           || '—'}</td>
                      <td style={{ padding: '0.6rem 0.4rem', textAlign: 'center', color: '#4a5568' }}>{s.teacher_awarded || '—'}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: '#2C3E50' }}>
                        {s.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* WORD OF THE DAY SUBMISSIONS */}
      <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div onClick={() => setWotdOpen(o => !o)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: wotdOpen ? '1px solid #e2e8f0' : 'none', background: '#fafafa' }}>
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
                    ['all',       'All',          '#667eea'],
                    ['today',     'Today',         '#48bb78'],
                    ['correct',   '✅ Correct',    '#38a169'],
                    ['incorrect', '❌ Incorrect',  '#e53e3e'],
                  ].map(([val, label, colour]) => (
                    <button key={val} onClick={() => setWotdFilter(val)}
                      style={{ padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', border: `2px solid ${wotdFilter === val ? colour : '#e2e8f0'}`, background: wotdFilter === val ? colour : 'white', color: wotdFilter === val ? 'white' : '#718096', transition: 'all 0.15s' }}>
                      {label}
                    </button>
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
                                      <span style={{
                                        padding: '1px 7px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: '700',
                                        background: studentProfile.level === 'Spanish' ? '#fff0f0' : studentProfile.level?.startsWith('A') ? '#c6f6d5' : studentProfile.level?.startsWith('B') ? '#bee3f8' : '#fbd38d',
                                        color:      studentProfile.level === 'Spanish' ? '#e53e3e' : studentProfile.level?.startsWith('A') ? '#276749' : studentProfile.level?.startsWith('B') ? '#2a69ac' : '#744210',
                                      }}>
                                        {studentProfile.level === 'Spanish' ? 'ES' : studentProfile.level}
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

      {/* QUEEN BEE ACHIEVEMENTS */}
      {queenBeeAlerts.length > 0 && (
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '1rem' }}>
          <div onClick={() => setQueenBeeOpen(o => !o)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer', borderBottom: queenBeeOpen ? '1px solid #fde68a' : 'none', background: '#fffbeb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.3rem' }}>👑</span>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#2C3E50', margin: 0 }}>Queen Bee Achievements</h2>
                <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>
                  {(() => {
                    const unseen = queenBeeAlerts.filter(a => !a.seen_by_teacher).length
                    return unseen > 0
                      ? `${unseen} new · ${queenBeeAlerts.length} all-time`
                      : `${queenBeeAlerts.length} total`
                  })()}
                </p>
              </div>
            </div>
            <div style={{ background: queenBeeOpen ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#e2e8f0', color: 'white', borderRadius: '8px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
              {queenBeeOpen ? '🍯' : '🔒'}
            </div>
          </div>
          {queenBeeOpen && (
            <div style={{ padding: '0.5rem 1.25rem 1.25rem' }}>
              {queenBeeAlerts.map(a => {
                const lang     = a.puzzle?.language === 'es' ? '🇪🇸' : '🇬🇧'
                const centre   = (a.puzzle?.centre_letter || '').toUpperCase()
                const outer    = (a.puzzle?.outer_letters || []).map(l => l.toUpperCase()).join('')
                const pangrams = (a.puzzle?.pangrams || []).map(p => p.toUpperCase()).join(', ')
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.8rem 0.9rem', borderRadius: '10px', marginTop: '0.6rem',
                    background: a.seen_by_teacher ? '#fafafa' : '#fffbeb',
                    border: `1px solid ${a.seen_by_teacher ? '#e2e8f0' : '#fde68a'}`,
                  }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                      {initials(a.student?.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, color: '#2C3E50' }}>{a.student?.full_name || 'Unknown'}</span>
                        {!a.seen_by_teacher && (
                          <span style={{ padding: '1px 8px', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700, background: '#fde68a', color: '#92400e' }}>NEW</span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>{formatDate(a.achieved_at)}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#718096', marginTop: '2px' }}>
                        {lang} · centre <strong style={{ color: '#d97706' }}>{centre}</strong> · {outer} · {a.word_count} words · {a.score} pts
                        {pangrams && <> · {pangrams}</>}
                      </div>
                      {a.note && (
                        <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '4px', fontStyle: 'italic', lineHeight: 1.4 }}>
                          📝 {a.note}
                        </div>
                      )}
                    </div>
                    {!a.seen_by_teacher && (
                      <button
                        onClick={() => markQueenBeeSeen(a.id)}
                        title="Mark as seen"
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fde68a', background: 'white', color: '#92400e', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        ✓ Seen
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {awardingFor && (
        <AwardStarModal
          student={awardingFor}
          onClose={() => setAwardingFor(null)}
          onAwarded={() => { setAwardingFor(null); fetchStarsLeaderboard() }}
        />
      )}

      {viewingStudent && (
        <StudentPanel student={viewingStudent} onClose={() => setViewingStudent(null)} />
      )}
    </div>
  )
}

const MIX_CATS = [
  { key: 'exercises',          colour: '#667eea' },
  { key: 'speaking_listening', colour: '#9f7aea' },
  { key: 'games',              colour: '#48bb78' },
  { key: 'daily_prompt',       colour: '#ed8936' },
  { key: 'flashcards',         colour: '#4299e1' },
]

function MixBar({ mix, total }) {
  if (!mix || !total) return <span style={{ color: '#cbd5e0', fontSize: '0.8rem' }}>—</span>
  const segs = MIX_CATS.filter(c => (mix[c.key] || 0) > 0)
  return (
    <div title={`${total.toLocaleString()} activities`} style={{ display: 'flex', height: '8px', width: '84px', borderRadius: '99px', overflow: 'hidden', background: '#edf2f7' }}>
      {segs.map(c => (
        <div key={c.key} style={{ flexGrow: mix[c.key], background: c.colour }} />
      ))}
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

function AwardStarModal({ student, onClose, onAwarded }) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function award() {
    setSubmitting(true); setError(null)
    const trimmed = note.trim()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('stars').insert({
      student_id: student.id,
      source:     'teacher_awarded',
      subtype:    'manual',
      context:    {
        ...(trimmed ? { note: trimmed } : {}),
        ...(user ? { awarded_by: user.id } : {}),
      },
    })
    setSubmitting(false)
    if (insertError) {
      console.warn('Award star failed:', insertError)
      setError(insertError.message || 'Could not award star')
      return
    }
    onAwarded()
  }

  return (
    <>
      <div onClick={() => !submitting && onClose()}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'white', borderRadius: '16px', padding: '1.5rem',
        width: 'min(420px, 92vw)', zIndex: 1001,
        boxShadow: '0 16px 48px rgba(0,0,0,0.25)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>⭐</div>
          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: '#2C3E50', fontWeight: 700 }}>
            Award a star to {student.name}
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096' }}>
            They'll see it in their stars total.
          </p>
        </div>

        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '0.4rem' }}>
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Great effort in class today"
          rows={2}
          maxLength={200}
          disabled={submitting}
          style={{ width: '100%', padding: '0.7rem', fontSize: '0.92rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit', background: '#fafafa' }}
          autoFocus
        />

        {error && (
          <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', background: '#fff5f5', border: '1px solid #fed7d7', color: '#9b2c2c', borderRadius: '8px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={onClose} disabled={submitting}
            style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '1.5px solid #e2e8f0', background: 'white', color: '#718096', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
            Cancel
          </button>
          <button onClick={award} disabled={submitting}
            style={{ flex: 2, padding: '0.7rem', borderRadius: '8px', border: 'none', background: submitting ? '#cbd5e0' : 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            {submitting ? 'Awarding…' : '⭐ Award star'}
          </button>
        </div>
      </div>
    </>
  )
}
