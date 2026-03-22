import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

const LEVELS = [
  { key: 'beginner',     label: 'Beginner',     sublabel: 'A1 – A2', description: 'Simple, everyday situations with clear and predictable language.',               colour: '#48bb78', colourLight: '#f0fff4', dbLevels: ['A1', 'A2'], icon: '🌱' },
  { key: 'intermediate', label: 'Intermediate', sublabel: 'B1 – B2', description: 'Workplace scenarios, customer service, and everyday professional situations.', colour: '#4299e1', colourLight: '#ebf8ff', dbLevels: ['B1', 'B2'], icon: '📘' },
  { key: 'advanced',     label: 'Advanced',     sublabel: 'C1 – C2', description: 'Complex negotiations, difficult conversations, and high-stakes interactions.',  colour: '#ed8936', colourLight: '#fffaf0', dbLevels: ['C1', 'C2'], icon: '🎓' },
]

const ENDING_STYLES = {
  good:    { bg: '#f0fff4', border: '#c6f6d5', color: '#276749', emoji: '🌟', label: 'STRONG CHOICE',        text: 'Eva showed empathy and kept control of the conversation.' },
  neutral: { bg: '#fffaf0', border: '#fbd38d', color: '#744210', emoji: '🤝', label: 'POSSIBLE, BUT WEAKER', text: 'Eva gave information, but Katie still felt unsupported.' },
  bad:     { bg: '#fff5f5', border: '#fed7d7', color: '#9b2c2c', emoji: '😬', label: 'POOR CHOICE',          text: "Eva's wording increased the guest's frustration." },
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
  return CHARACTER_COLOURS[character?.toLowerCase()] || CHARACTER_COLOURS.default
}

export default function RealTalkExercise({ onBack, userTracks = [] }) {
  const [stage, setStage]               = useState('level-select')
  const [selectedLevel, setSelectedLevel] = useState(null)
  const [scenarioList, setScenarioList] = useState([])
  const [scenarioCounts, setScenarioCounts] = useState({})
  const [listLoading, setListLoading]   = useState(false)
  const [currentNode, setCurrentNode]   = useState(null)
  const [scenarioId, setScenarioId]     = useState(null)
  const [scenarioTitle, setScenarioTitle] = useState('')
  const [scenarioImage, setScenarioImage] = useState(null)
  const [history, setHistory]           = useState([])
  const [isPlaying, setIsPlaying]       = useState(false)
  const [isPlayingChoice, setIsPlayingChoice] = useState(false)
  const [choiceLoading, setChoiceLoading] = useState(false)
  const [nodesCache, setNodesCache]     = useState({})

  const audioRef = useRef(null)

  useEffect(() => {
    fetchCounts()
    return () => { if (audioRef.current) audioRef.current.pause() }
  }, [])

  async function fetchCounts() {
    const { data } = await supabase
      .from('scenario_nodes')
      .select('scenario_id, level, tracks, language')
      .eq('node_key', 'start')

    if (data) {
      const counts = {}
      LEVELS.forEach(lv => {
        counts[lv.key] = data.filter(s => lv.dbLevels.includes(s.level)).length
      })
      setScenarioCounts(counts)
    }
  }

  async function fetchScenarioList(dbLevels) {
    setListLoading(true)
    const { data } = await supabase
      .from('scenario_nodes')
      .select('scenario_id, scenario_title, level, language, tracks, image_url')
      .eq('node_key', 'start')
      .in('level', dbLevels)
      .order('scenario_title')

    if (data) setScenarioList(data)
    setListLoading(false)
  }

  function selectLevel(level) {
    if ((scenarioCounts[level.key] || 0) === 0) return
    setSelectedLevel(level)
    setStage('scenario-list')
    fetchScenarioList(level.dbLevels)
  }

  async function startScenario(sid, title, image) {
    setScenarioId(sid)
    setScenarioTitle(title)
    setScenarioImage(image || null)
    setHistory([])
    setNodesCache({})
    setChoiceLoading(true)
    const cache = await loadNode(sid, 'start', {})
    setNodesCache(cache)
    setChoiceLoading(false)
    setStage('play')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  async function loadNode(sid, key, cache) {
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
      return { ...cache, [cacheKey]: data }
    }
    return cache
  }

  async function makeChoice(choice) {
    if (choiceLoading || isPlayingChoice) return
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }

    if (choice.audio_url) {
      setIsPlayingChoice(true)
      await new Promise((resolve) => {
        const audio = new Audio(choice.audio_url)
        audioRef.current = audio
        audio.onended = () => { setIsPlayingChoice(false); resolve() }
        audio.onerror = () => { setIsPlayingChoice(false); resolve() }
        audio.play().catch(() => { setIsPlayingChoice(false); resolve() })
      })
    }

    setChoiceLoading(true)
    setHistory(h => [...h, { node: currentNode, choiceMade: choice.text }])
    const newCache = await loadNode(scenarioId, choice.next_node_key, nodesCache)
    setNodesCache(newCache)
    setChoiceLoading(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    startScenario(scenarioId, scenarioTitle, scenarioImage)
  }

  function backToScenarioList() {
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }
    setStage('scenario-list')
    setCurrentNode(null)
    setHistory([])
    setScenarioId(null)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function backToLevelSelect() {
    setStage('level-select')
    setSelectedLevel(null)
    setScenarioList([])
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const renderImage = () => {
    if (!scenarioImage) return null
    return (
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <img
          src={scenarioImage}
          alt={scenarioTitle}
          style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', objectFit: 'cover', objectPosition: 'top', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
        />
      </div>
    )
  }

  // ── LEVEL SELECT ─────────────────────────────────────────────────────────
  if (stage === 'level-select') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
          <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white' }}>💬 Real Talk</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Real conversations, real decisions. Choose how you respond and see where it leads.</p>
          </div>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            <h2 style={{ color: '#2d3748', fontSize: '1.15rem', fontWeight: 600, margin: '0 0 6px', textAlign: 'center' }}>Choose your level</h2>
            <p style={{ color: '#718096', fontSize: '0.9rem', margin: '0 0 24px', textAlign: 'center' }}>Select a difficulty to see available scenarios</p>
            <div style={{ display: 'grid', gap: '16px' }}>
              {LEVELS.map(level => {
                const count = scenarioCounts[level.key] || 0
                const available = count > 0
                return (
                  <div key={level.key}
                    onClick={() => available && selectLevel(level)}
                    style={{ border: `2px solid ${available ? level.colour : '#e2e8f0'}`, borderRadius: '12px', padding: '1.25rem 1.5rem', cursor: available ? 'pointer' : 'default', background: available ? level.colourLight : '#f9fafb', opacity: available ? 1 : 0.55, transition: 'transform 0.15s, box-shadow 0.15s', display: 'flex', alignItems: 'center', gap: '1rem' }}
                    onMouseEnter={e => { if (available) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 16px ${level.colour}30` }}}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                  >
                    <div style={{ fontSize: '2rem', flexShrink: 0 }}>{level.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748' }}>{level.label}</span>
                        <span style={{ background: available ? level.colour : '#a0aec0', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>{level.sublabel}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.4 }}>{level.description}</p>
                      <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.8rem', color: available ? '#4a5568' : '#a0aec0', fontWeight: 500 }}>
                        {available ? `${count} scenario${count !== 1 ? 's' : ''} available` : 'Coming soon'}
                      </span>
                    </div>
                    {available && <div style={{ fontSize: '1.3rem', color: level.colour, flexShrink: 0 }}>→</div>}
                  </div>
                )
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
    )
  }

  // ── SCENARIO LIST ─────────────────────────────────────────────────────────
  if (stage === 'scenario-list') {
    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
          <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white' }}>💬 Real Talk</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.9 }}>Choose a scenario to start</p>
            {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.sublabel}</span>}
          </div>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            {listLoading && <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Loading scenarios...</div>}
            {!listLoading && scenarioList.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
                <h2 style={{ color: '#2C3E50', marginBottom: '0.5rem' }}>Coming Soon!</h2>
                <p style={{ color: '#718096' }}>Scenarios for this level are being added.</p>
              </div>
            )}
            {!listLoading && scenarioList.length > 0 && (
              <div style={{ display: 'grid', gap: '12px' }}>
                {scenarioList.map(s => {
                  const levelKey = s.level?.[0] || 'B'
                  const levelStyle = { A: { bg: '#f0fff4', color: '#276749' }, B: { bg: '#ebf8ff', color: '#2b6cb0' }, C: { bg: '#fffaf0', color: '#c05621' } }[levelKey] || { bg: '#ebf8ff', color: '#2b6cb0' }
                  return (
                    <div
                      key={s.scenario_id}
                      onClick={() => startScenario(s.scenario_id, s.scenario_title, s.image_url)}
                      style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '1rem' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = selectedLevel.colour; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                    >
                      {s.image_url
                        ? <img src={s.image_url} alt={s.scenario_title} style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', flexShrink: 0 }} />
                        : <div style={{ width: '56px', height: '56px', borderRadius: '10px', background: selectedLevel.colourLight, border: `1px solid ${selectedLevel.colour}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>💬</div>
                      }
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: '#2d3748', fontSize: '1rem', marginBottom: '4px' }}>{s.scenario_title}</div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: levelStyle.bg, color: levelStyle.color }}>{s.level}</span>
                      </div>
                      <div style={{ fontSize: '1.3rem', color: '#cbd5e0', flexShrink: 0 }}>→</div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={backToLevelSelect} style={{ padding: '10px 24px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '0.95rem' }}>← Change Level</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PLAY ─────────────────────────────────────────────────────────────────
  if (stage === 'play' && currentNode) {
    const charColour = getCharColour(currentNode.character)
    const endingStyle = currentNode.is_ending && currentNode.ending_type ? ENDING_STYLES[currentNode.ending_type] : null
    const choices = currentNode.choices || []

    return (
      <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>

          {/* Header */}
          <div style={{ background: GRADIENT, borderRadius: '12px', padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white', marginBottom: '1.5rem', position: 'relative' }}>
            {history.length > 0 && (
              <button onClick={restart} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '5px 12px', color: 'white', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                ↺ Restart
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white' }}>{scenarioTitle}</h1>
            <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: '0.85rem' }}>
              Real Talk · {history.length === 0 ? 'Start' : `Step ${history.length + 1}`}
            </p>
            {selectedLevel && <span style={{ display: 'inline-block', background: selectedLevel.colour, padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>{selectedLevel.sublabel}</span>}
          </div>

          {/* Content card */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>

            {/* Image — same as listening, shown at top of content */}
            {renderImage()}

            {/* Conversation history */}
            {history.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                {history.map((item, i) => {
                  const hChar = getCharColour(item.node.character)
                  return (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ background: hChar.bg, border: `1px solid ${hChar.border}`, borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '6px', opacity: 0.6 }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: hChar.text, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                          {item.node.character} · {item.node.character_role}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#4a5568', lineHeight: 1.5 }}>{item.node.text}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', background: '#667eea15', border: '1px solid #667eea40', borderRadius: '10px', padding: '4px 12px', fontSize: '0.8rem', color: '#553c9a', fontWeight: 500 }}>
                          You said: "{item.choiceMade}"
                        </span>
                      </div>
                    </div>
                  )
                })}
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '1rem 0' }} />
              </div>
            )}

            {/* Current node */}
            <div style={{ background: charColour.bg, border: `1.5px solid ${charColour.border}`, borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: charColour.text, textTransform: 'uppercase', letterSpacing: '0.4px', background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: '6px' }}>
                  {currentNode.character} · {currentNode.character_role}
                </span>
                {currentNode.audio_url && (
                  <button
                    onClick={() => playAudio(currentNode.audio_url)}
                    disabled={isPlaying}
                    style={{ background: isPlaying ? '#e2e8f0' : GRADIENT, border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: isPlaying ? 'default' : 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isPlaying ? '🔊' : '▶️'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: '1.05rem', color: '#2d3748', lineHeight: 1.7, margin: 0 }}>
                "{currentNode.text}"
              </p>
            </div>

            {/* Ending feedback */}
            {endingStyle && (
              <div style={{ background: endingStyle.bg, border: `1.5px solid ${endingStyle.border}`, borderRadius: '12px', padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.3rem' }}>{endingStyle.emoji}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: endingStyle.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{endingStyle.label}</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: endingStyle.color, lineHeight: 1.55 }}>{endingStyle.text}</div>
              </div>
            )}

            {/* Choices */}
            {!currentNode.is_ending && choices.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>
                  {isPlayingChoice ? '🔊 Playing...' : '👆 How do you respond?'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {choices.map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => makeChoice(choice)}
                      disabled={choiceLoading || isPlayingChoice}
                      style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.1rem', cursor: (choiceLoading || isPlayingChoice) ? 'default' : 'pointer', textAlign: 'left', fontSize: '0.95rem', color: '#2d3748', lineHeight: 1.5, transition: 'all 0.15s', width: '100%', opacity: (choiceLoading || isPlayingChoice) ? 0.6 : 1, fontWeight: 500 }}
                      onMouseEnter={e => { if (!choiceLoading && !isPlayingChoice) { e.currentTarget.style.borderColor = '#667eea'; e.currentTarget.style.background = '#f7f8ff' }}}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white' }}
                    >
                      <span style={{ color: '#667eea', fontWeight: 700, marginRight: '8px' }}>{i + 1}.</span>
                      {choice.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ending buttons */}
            {currentNode.is_ending && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
                <button onClick={restart} style={{ flex: 1, padding: '1rem', borderRadius: '10px', background: GRADIENT, border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                  ↺ Try again
                </button>
                <button onClick={backToScenarioList} style={{ flex: 1, padding: '1rem', borderRadius: '10px', background: 'none', border: '2px solid #667eea', color: '#667eea', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                  More scenarios →
                </button>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={backToScenarioList} style={{ background: 'none', border: 'none', color: '#a0aec0', fontSize: '0.85rem', cursor: 'pointer' }}>
              ← Back to scenarios
            </button>
          </div>

        </div>
      </div>
    )
  }

  return <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Loading...</div>
}
