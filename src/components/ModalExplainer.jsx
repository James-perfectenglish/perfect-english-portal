import { useState } from 'react';
import { modalGroups } from '../lib/modalExplainEn.js';
import ModalCard from './ModalCard';

/* ============================================================
   Modal Explainer — the Learn reference (card per modal)
   ------------------------------------------------------------
   Two-level accordion: function-area group → individual modal.
   Only one modal's detail is open at a time, so the reader focuses
   on one modal rather than a wall of cards. Each use carries a
   FUNCTION pill matching the Modal Chooser; "Practise in Modal
   Chooser" hands off via the onPractise prop.
   ============================================================ */

const C = {
  page: '#f8f9fa', card: 'white', line: '#e2e8f0',
  ink: '#2C3E50', slate: '#4a5568', muted: '#718096', faint: '#a0aec0',
  brand: '#667eea', brandDark: '#553C9A',
  goodBg: '#f0fff4', goodLine: '#38a169',
  warnInk: '#92400e', warnBg: '#fffbeb', warnLine: '#f59e0b',
  contrastBg: '#eef2ff', contrastInk: '#3730A3', contrastLine: '#c7d2fe',
};
const PG = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

/* The card renderer lives in ./ModalCard.jsx — shared with the
   "📖 See the full card" overlay in Modal Match. */

export default function ModalExplainer({ profile, onPractise }) {
  const groups = modalGroups();
  const [openGroup, setOpenGroup] = useState(groups[0]?.id || null);
  const [openModal, setOpenModal] = useState(null);

  return (
    <div style={{ background: C.page, minHeight: '100vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
        <div style={{ background: PG, borderRadius: 12, padding: '2.5rem 2rem 2rem', textAlign: 'center', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Modal Explainer</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>What each modal verb does — and the traps to avoid</p>
        </div>

        <div style={{ background: C.card, padding: '1.5rem', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', marginTop: '1rem' }}>
          <p style={{ color: C.slate, fontSize: '0.92rem', lineHeight: 1.55, margin: '0 0 1rem' }}>
            A quick reference: pick a modal to see its main jobs, the classic confusions, and a watch-out. The coloured labels are the same <strong>functions</strong> you’ll meet in the Modal Match.
          </p>

          {onPractise && (
            <button onClick={() => onPractise()} style={{ background: PG, color: 'white', border: 'none', borderRadius: 10, padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', width: '100%', marginBottom: '1.25rem' }}>
              ✏️ Practise in Modal Match →
            </button>
          )}

          {groups.map(g => {
            const gOpen = openGroup === g.id;
            return (
              <div key={g.id} style={{ marginBottom: '0.75rem' }}>
                <button onClick={() => setOpenGroup(gOpen ? null : g.id)} style={{
                  width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: gOpen ? '#f7fafc' : 'white', border: `1px solid ${C.line}`, borderRadius: 10,
                  padding: '0.85rem 1rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, color: C.ink,
                }}>
                  <span>{g.title}</span>
                  <span style={{ color: C.muted, fontSize: '0.9rem' }}>{gOpen ? '−' : '+'}</span>
                </button>
                {gOpen && (
                  <div style={{ display: 'grid', gap: '0.6rem', marginTop: '0.75rem' }}>
                    {g.cards.map(card => (
                      <ModalCard
                        key={card.id}
                        card={card}
                        open={openModal === card.id}
                        onToggle={() => setOpenModal(openModal === card.id ? null : card.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
