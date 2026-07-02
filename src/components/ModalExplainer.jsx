import { useState } from 'react';
import { modalGroups, FUNCTION_STYLES } from '../lib/modalExplainEn.js';

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
const PILL_DEFAULT = { bg: '#F5F3FF', fg: '#6D28D9', bd: '#DDD6FE' };

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function FunctionPill({ fn }) {
  const st = FUNCTION_STYLES[fn] || PILL_DEFAULT;
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, backgroundColor: st.bg, color: st.fg, border: `1px solid ${st.bd}` }}>
      {capFirst(fn)}
    </span>
  );
}

function ModalCard({ card, open, onToggle }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', boxShadow: open ? '0 4px 14px rgba(102,126,234,0.12)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
      {/* Collapsed/expanded header — the toggle */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        background: open ? PG : 'white', color: open ? 'white' : C.ink,
        border: 'none', padding: '0.75rem 1rem', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{card.modal}</span>
          <span style={{ background: open ? 'rgba(255,255,255,0.22)' : '#f1f5f9', color: open ? 'white' : C.muted, borderRadius: 8, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700 }}>{card.band}+</span>
        </span>
        <span style={{ fontSize: '1.2rem', fontWeight: 400, opacity: 0.8 }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '1rem 1.1rem 1.1rem' }}>
          <div style={{ background: '#f7fafc', border: `1px solid ${C.line}`, borderRadius: 9, padding: '0.4rem 0.65rem', fontSize: '0.82rem', fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: C.brandDark, marginBottom: '1rem' }}>
            {card.forms}
          </div>

          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.faint, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>When you use it</div>
          {card.uses.map((u, i) => (
            <div key={i} style={{ marginBottom: i < card.uses.length - 1 ? '0.9rem' : 0 }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
                <FunctionPill fn={u.fn} />
                <span style={{ color: C.brandDark, fontSize: '0.82rem', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{u.form}</span>
                <span style={{ color: C.muted, fontSize: '0.82rem' }}>— {u.gloss}</span>
              </div>
              <div style={{ background: C.goodBg, border: `1px solid ${C.goodLine}`, borderRadius: 9, padding: '0.5rem 0.7rem', color: C.ink, fontSize: '0.9rem' }}>
                {u.example}
              </div>
            </div>
          ))}

          {card.contrast && (
            <div style={{ marginTop: '1rem', background: C.contrastBg, border: `1px solid ${C.contrastLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
              <span style={{ fontWeight: 700, color: C.contrastInk, fontSize: '0.76rem' }}>↔ Don’t mix up · </span>
              <span style={{ color: C.contrastInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{card.contrast}</span>
            </div>
          )}

          <div style={{ marginTop: '0.75rem', background: C.warnBg, border: `1px solid ${C.warnLine}`, borderRadius: 9, padding: '0.6rem 0.8rem' }}>
            <span style={{ fontWeight: 700, color: C.warnInk, fontSize: '0.76rem' }}>👁️ Watch out · </span>
            <span style={{ color: C.warnInk, fontSize: '0.84rem', lineHeight: 1.5 }}>{card.watchOut}</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
