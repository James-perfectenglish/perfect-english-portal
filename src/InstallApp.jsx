import { useState } from 'react'

const CONTENT = {
  en: {
    title: 'Install the app',
    subtitle: 'Add Perfect English to your home screen for the best experience.',
    ios: {
      heading: 'iPhone / iPad',
      steps: [
        { icon: '🌐', text: 'Open this page in Safari (not Chrome)' },
        { icon: '⬆️', text: 'Tap the Share button at the bottom of the screen' },
        { icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
        { icon: '✅', text: 'Tap "Add" — done!' },
      ],
    },
    android: {
      heading: 'Android',
      steps: [
        { icon: '🌐', text: 'Open this page in Chrome' },
        { icon: '⋮', text: 'Tap the three-dot menu in the top right' },
        { icon: '➕', text: 'Tap "Add to Home screen"' },
        { icon: '✅', text: 'Tap "Add" — done!' },
      ],
    },
    note: 'The app will appear on your home screen just like any other app.',
    url: 'app.perfect-english.org',
  },
  es: {
    title: 'Instala la aplicación',
    subtitle: 'Añade Perfect English a tu pantalla de inicio para la mejor experiencia.',
    ios: {
      heading: 'iPhone / iPad',
      steps: [
        { icon: '🌐', text: 'Abre esta página en Safari (no en Chrome)' },
        { icon: '⬆️', text: 'Pulsa el botón Compartir en la parte inferior de la pantalla' },
        { icon: '➕', text: 'Desplázate hacia abajo y pulsa "Añadir a pantalla de inicio"' },
        { icon: '✅', text: 'Pulsa "Añadir" — ¡listo!' },
      ],
    },
    android: {
      heading: 'Android',
      steps: [
        { icon: '🌐', text: 'Abre esta página en Chrome' },
        { icon: '⋮', text: 'Pulsa el menú de tres puntos arriba a la derecha' },
        { icon: '➕', text: 'Pulsa "Añadir a pantalla de inicio"' },
        { icon: '✅', text: 'Pulsa "Añadir" — ¡listo!' },
      ],
    },
    note: 'La aplicación aparecerá en tu pantalla de inicio como cualquier otra app.',
    url: 'app.perfect-english.org',
  },
}

function detectDevice() {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'both'
}

function detectLang() {
  const lang = navigator.language || navigator.languages?.[0] || 'en'
  return lang.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function Steps({ steps }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((step, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#f8f9fa', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>{step.icon}</span>
          <span style={{ fontSize: 15, lineHeight: 1.5, color: '#2d3748' }}>
            <strong style={{ color: '#a0aec0', marginRight: 6, fontSize: 12 }}>{i + 1}.</strong>
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function InstallApp() {
  const [lang, setLang] = useState(detectLang)
  const [device]        = useState(detectDevice)
  const c = CONTENT[lang]

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem' }}>

      <div style={{ width: '100%', maxWidth: 480, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icon-192x192.png" alt="Perfect English" style={{ width: 44, height: 44, borderRadius: 10 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#2d3748' }}>Perfect English</div>
              <div style={{ fontSize: 12, color: '#718096' }}>{c.url}</div>
            </div>
          </div>
          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
            title={lang === 'en' ? 'Ver en español' : 'View in English'}
          >
            {lang === 'en' ? '🇪🇸' : '🇬🇧'}
          </button>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2d3748', margin: '0 0 6px' }}>{c.title}</h1>
        <p style={{ fontSize: 15, color: '#718096', margin: 0, lineHeight: 1.5 }}>{c.subtitle}</p>
      </div>

      {(device === 'ios' || device === 'both') && (
        <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: 14, padding: '18px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🍎</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#2d3748' }}>{c.ios.heading}</span>
          </div>
          <Steps steps={c.ios.steps} />
        </div>
      )}

      {(device === 'android' || device === 'both') && (
        <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: 14, padding: '18px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#2d3748' }}>{c.android.heading}</span>
          </div>
          <Steps steps={c.android.steps} />
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center', color: '#718096', fontSize: 13, marginTop: 4 }}>
        {c.note}
      </div>
    </div>
  )
}
