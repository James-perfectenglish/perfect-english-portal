import { useRegisterSW } from 'virtual:pwa-register/react'

// One service-worker registration for the whole app, in prompt mode: a new
// build installs and WAITS, this banner appears, and the reload happens only
// when the student taps — so nobody mid-way through a practice set is thrown
// out by a deploy.
//
// Before this the app registered the worker on page load and never looked
// again. A standalone PWA rarely loads, it resumes from the app switcher, so
// students kept running a stale bundle until they force-quit the app. The
// visibilitychange check below is what closes that gap.
const HOUR = 60 * 60 * 1000

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      // Re-check whenever the app comes back to the foreground, plus hourly
      // for anyone who leaves it open on a desktop all day.
      const check = () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, HOUR)
    },
  })

  if (!needRefresh) return null

  return (
    <button
      onClick={() => updateServiceWorker(true)}
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        // Clear the student bottom nav (and the iPhone home indicator).
        bottom: 'calc(72px + env(safe-area-inset-bottom))',
        zIndex: 3000,
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: 'white',
        border: 'none',
        borderRadius: '999px',
        padding: '10px 18px',
        fontSize: '0.85rem',
        fontWeight: 700,
        boxShadow: '0 4px 14px rgba(102, 126, 234, 0.45)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      ✨ New version ready — tap to update
    </button>
  )
}
