import { useState, useEffect, useRef } from 'react'

// Tap-to-play speaker button for ElevenLabs clips (Word Bluff, Word of the Day,
// Phrasal Verb of the Day). Renders nothing when there is no URL, so cards without
// audio look exactly as before.
export default function SpeakButton({ url, playing, onPlay, label = 'Listen', size = 32, colour = '#667eea' }) {
  if (!url) return null
  return (
    <button
      onClick={e => { e.stopPropagation(); onPlay(url) }}
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `1.5px solid ${playing ? colour : '#d6d9f5'}`,
        background: playing ? colour : 'white',
        color: playing ? 'white' : colour,
        fontSize: size > 30 ? '0.95rem' : '0.8rem', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
        transition: 'all 0.15s',
      }}>
      🔊
    </button>
  )
}

// One clip at a time: starting a new clip stops the previous one, and the clip
// stops when the component unmounts. Returns { play, playingUrl }.
export function useAudioPlayer() {
  const [playingUrl, setPlayingUrl] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => () => { if (audioRef.current) audioRef.current.pause() }, [])

  function play(url) {
    if (!url) return
    try {
      if (audioRef.current) audioRef.current.pause()
      const a = new Audio(url)
      audioRef.current = a
      setPlayingUrl(url)
      const done = () => setPlayingUrl(p => (p === url ? null : p))
      a.onended = done
      a.onerror = done
      a.play().catch(done)
    } catch {
      setPlayingUrl(null)
    }
  }

  return { play, playingUrl }
}
