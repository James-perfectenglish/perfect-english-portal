export default function Breadcrumb({ section, title, questionInfo, onExit }) {
  if (!title) return null
  return (
    <div style={{
      background: 'white',
      borderBottom: '0.5px solid #e2e8f0',
      padding: '0 1rem',
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.8rem',
      position: 'sticky',
      top: '52px', // sits just below desktop top nav
      zIndex: 999,
    }} className="pep-breadcrumb">
      {section && (
        <>
          <span style={{ color: '#a0aec0' }}>{section}</span>
          <span style={{ color: '#a0aec0' }}>›</span>
        </>
      )}
      <span style={{ color: '#2d3748', fontWeight: 600 }}>{title}</span>
      {questionInfo && (
        <>
          <span style={{ color: '#a0aec0', margin: '0 2px' }}>·</span>
          <span style={{ color: '#718096' }}>{questionInfo}</span>
        </>
      )}
      <div style={{ flex: 1 }} />
      {onExit && (
        <button onClick={onExit} style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.8rem',
          color: '#667eea',
          fontWeight: 600,
          padding: '4px 8px',
          borderRadius: '6px',
        }}>
          ✕ Exit
        </button>
      )}
      <style>{`
        .pep-breadcrumb { display: none; }
        @media (min-width: 768px) {
          .pep-breadcrumb { display: flex; }
        }
      `}</style>
    </div>
  )
}
