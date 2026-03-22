import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const ENDING_STYLES = {
  good:    { bg: '#f0fff4', border: '#c6f6d5', color: '#276749', emoji: '🌟' },
  neutral: { bg: '#fffaf0', border: '#fbd38d', color: '#744210', emoji: '🤝' },
  bad:     { bg: '#fff5f5', border: '#fed7d7', color: '#9b2c2c', emoji: '😬' },
}

const CHARACTER_COLOURS = {
  receptionist: { bg: '#ebf8ff', border: '#bee3f8', text: '#2b6cb0' },
  guest:        { bg: '#faf5ff', border: '#e9d8fd', text: '#553c9a' },
  manager:      { bg: '#f0fff4', border: '#c6f6d5', text: '#276749' },
  customer:     { bg: '#fff5f5', border: '#fed7d7', text: '#9b2c2c' },
  interviewer:  { bg: '#fffaf0', border: '#fbd38d', text: '#744210' },
  default:      { bg: '#f7fafc', border: '#e2e8f0', text: '#4a5568' },
}

function getCharColour(character) {
  const key = character?.toLowerCase()
  return CHARACTER_COLOURS[key] || CHARACTER_COLOURS.default
}

export default function RealTalkExercise({ onBack, userTracks = [] }) {
  const [screen, setScreen]             = useState('select')
  const [scenarios, setScenarios]       = useState([])
  const [currentNode, setCurrentNode]   = useState(null)
  const [scenarioId, setScenarioId]     = useState(null)
  const [history, setHistory]           = useState([])
  const [isPlaying, setIsPlaying]       = useState(false)
  const [loading, setLoading]           = useState(true)
  const [choiceLoading, setChoiceLoading] = useState(false)
  const [nodesCache, setNodesCache]     = useState({})

  const audioRef = useRef(null)

  useEffect(() => {
    fetchScenarios()
    return () => { if (audioRef.current) audioRef.current.pause() }
  }, [])

  async function fetchScenarios() {
    setLoading(true)
    const { data } = await supabase
      .from('scenario_nodes')
      .select('scenario_id, scenario_title, level, language, tracks')
      .eq('node_key', 'start')
      .order('scenario_title')

    if (data) {
      // Filter by tracks
      const filtered = data.filter(s => {
        const sTracks = s.tracks || ['general']
        if (sTracks.includes('general')) return true
        if (!userTracks || userTracks.length === 0) return sTracks.includes('general')
        return sTracks.some(t => userTracks.includes(t))
      })
      setScenarios(filtered)
    }
    setLoading(false)
  }

  async function startScenario(sid) {
    setScenarioId(sid)
    setHistory([])
    setChoiceLoading(true)
    await loadNode(sid, 'start', {})
    setChoiceLoading(false)
    setScreen('play')
  }

  async function loadNode(sid, key, cache) {
    // Check cache first
    const cacheKey = `${sid}:${key}`
    if (cache[cacheKey]) {
      setCurrentNode(cache[cacheKey])
      return cache
    }
    const { data } = await supabase
      .from('scenario_nodes')
      .select('*')
      .eq('scenario_id', sid)
      .eq('node_key', key)
      .single()

    if (data) {
      setCurrentNode(data)
      const newCache = { ...cache, [cacheKey]: data }
      setNodesCache(newCache)
      return newCache
    }
    return cache
  }

  async function makeChoice(choice) {
    if (choiceLoading) return
    setChoiceLoading(true)
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }

    // Add current node + choice to history
    setHistory(h => [...h, { node: currentNode, choiceMade: choice.text }])

    const newCache = await loadNode(scenarioId, choice.next_node_key, nodesCache)
    setNodesCache(newCache)
    setChoiceLoading(false)
  }

  function playAudio(url) {
    if (!url || isPlaying) return
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0 }
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onplay  = () => setIsPlaying(true)
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play()
  }

  function restart() {
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }
    setHistory([])
    setCurrentNode(null)
    startScenario(scenarioId)
  }

  function backToSelect() {
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }
    setScreen('select')
    setCurrentNode(null)
    setHistory([])
    setScenarioId(null)
  }

  // ── Scenario select ───────────────────────────────────────────────────────
  if (screen === 'select') {
    return (
      <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ background: GRADIENT, borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1.25rem', color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', fontWeight: '700', margin: '0 0 0.4rem', color: 'white' }}>Real Talk</h1>
            <p style={{ fontSize: '0.9rem', opacity: 0.9, margin: 0, lineHeight: 1.5 }}>
              Real conversations, real decisions. Choose how you respond and see where it leads.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Loading scenarios...</div>
          ) : scenarios.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🚧</div>
              <p>Scenarios coming soon!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {scenarios.map(s => {
                const levelKey = s.level?.[0] || 'B'
                const levelStyle = {
                  A: { bg: '#f0fff4', color: '#276749' },
                  B: { bg: '#ebf8ff', color: '#2b6cb0' },
                  C: { bg: '#fffaf0', color: '#c05621' },
                }[levelKey] || { bg: '#ebf8ff', color: '#2b6cb0' }
                return (
                  <button
                    key={s.scenario_id}
                    onClick={() => startScenario(s.scenario_id)}
                    style={{
                      background: 'white', border: '1.5px solid #e8e8f0',
                      borderRadius: '14px', padding: '1.1rem 1.25rem',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', gap: '1rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', flexShrink: 0 }}>🎭</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2d3748', marginBottom: '4px' }}>
                        {s.scenario_title}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: levelStyle.bg, color: levelStyle.color }}>
                          {s.level}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#a0aec0' }}>
                          {s.language === 'es' ? '🇪🇸 Spanish' : '🇬🇧 English'}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: '#cbd5e0' }}>→</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Play screen ───────────────────────────────────────────────────────────
  if (screen === 'play' && currentNode) {
    const charColour = getCharColour(currentNode.character)
    const endingStyle = currentNode.ending_type ? ENDING_STYLES[currentNode.ending_type] || ENDING_STYLES.neutral : null
    const choices = currentNode.choices || []

    return (
      <div style={{ width: '100%', minHeight: '80vh', backgroundColor: '#f8f9fa', padding: '1rem', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ background: GRADIENT, borderRadius: '16px', padding: '0.9rem 1.25rem', marginBottom: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '1.5rem' }}>💬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentNode.scenario_title}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Real Talk · {history.length === 0 ? 'Start' : `Step ${history.length + 1}`}</div>
            </div>
            {history.length > 0 && (
              <button onClick={restart} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '4px 10px', color: 'white', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                ↺ Restart
              </button>
            )}
          </div>

          {/* Conversation history */}
          {history.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {history.map((item, i) => {
                const hChar = getCharColour(item.node.character)
                return (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    {/* Previous character speech */}
                    <div style={{ background: hChar.bg, border: `1px solid ${hChar.border}`, borderRadius: '12px', padding: '0.75rem 1rem', marginBottom: '4px', opacity: 0.65 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: hChar.text, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                        {item.node.character} · {item.node.character_role}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#4a5568', lineHeight: 1.5 }}>{item.node.text}</div>
                    </div>
                    {/* Choice made */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', background: '#667eea15', border: '1px solid #667eea40', borderRadius: '10px', padding: '4px 12px', fontSize: '0.8rem', color: '#553c9a', fontWeight: 500 }}>
                        You said: "{item.choiceMade}"
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Current node */}
          <div style={{ background: charColour.bg, border: `1.5px solid ${charColour.border}`, borderRadius: '14px', padding: '1.1rem 1.25rem', marginBottom: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: charColour.text, textTransform: 'uppercase', letterSpacing: '0.4px', background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '8px' }}>
                {currentNode.character} · {currentNode.character_role}
              </span>
              {currentNode.audio_url && (
                <button
                  onClick={() => playAudio(currentNode.audio_url)}
                  disabled={isPlaying}
                  style={{ marginLeft: 'auto', background: isPlaying ? '#e2e8f0' : GRADIENT, border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: isPlaying ? 'default' : 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                  {isPlaying ? '🔊' : '▶️'}
                </button>
              )}
            </div>
            <p style={{ fontSize: 'clamp(0.95rem, 3vw, 1.05rem)', color: '#2d3748', lineHeight: 1.65, margin: 0, fontStyle: 'normal' }}>
              "{currentNode.text}"
            </p>
          </div>

          {/* Ending screen */}
          {currentNode.is_ending && endingStyle && (
            <div style={{ background: endingStyle.bg, border: `1.5px solid ${endingStyle.border}`, borderRadius: '14px', padding: '1.1rem 1.25rem', marginBottom: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '6px' }}>{endingStyle.emoji}</div>
              <div style={{ fontSize: '0.85rem', color: endingStyle.color, fontWeight: 600 }}>
                {currentNode.ending_type === 'good' ? 'Great outcome! You handled that well.' : currentNode.ending_type === 'bad' ? 'That could have gone better — try a different approach!' : 'A reasonable outcome. Could you do better?'}
              </div>
            </div>
          )}

          {/* Choices */}
          {!currentNode.is_ending && choices.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.65rem' }}>
                👆 How do you respond?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => makeChoice(choice)}
                    disabled={choiceLoading}
                    style={{
                      background: 'white', border: '1.5px solid #e2e8f0',
                      borderRadius: '12px', padding: '0.9rem 1.1rem',
                      cursor: choiceLoading ? 'default' : 'pointer',
                      textAlign: 'left', fontSize: '0.92rem',
                      color: '#2d3748', lineHeight: 1.5,
                      transition: 'all 0.15s', width: '100%',
                      opacity: choiceLoading ? 0.6 : 1,
                      fontWeight: 500,
                    }}
                  >
                    <span style={{ color: '#667eea', fontWeight: 700, marginRight: '8px' }}>{i + 1}.</span>
                    {choice.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Restart / Back buttons */}
          {currentNode.is_ending && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
              <button onClick={restart} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: GRADIENT, border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                ↺ Try again
              </button>
              <button onClick={backToSelect} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', background: 'none', border: '2px solid #667eea', color: '#667eea', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                More scenarios →
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={backToSelect} style={{ background: 'none', border: 'none', color: '#a0aec0', fontSize: '0.8rem', cursor: 'pointer' }}>
              ← Back to scenarios
            </button>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
      Loading...
    </div>
  )
}
