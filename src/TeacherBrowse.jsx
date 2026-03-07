import { useState, useCallback } from 'react';
import { supabase } from './supabaseClient';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_INFO = {
  gap_fill:          { emoji: '✏️',  label: 'Gap Fill' },
  multiple_choice:   { emoji: '🔘',  label: 'Multiple Choice' },
  sentence_building: { emoji: '🔧',  label: 'Sentence Building' },
  odd_one_out:       { emoji: '🦆',  label: 'Odd One Out' },
  error_correction:  { emoji: '🔴',  label: 'Error Correction' },
  matching:          { emoji: '🔗',  label: 'Matching' },
  sentence_auction:  { emoji: '🏷️', label: 'Sentence Auction' },
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const LEVEL_COLORS = {
  A1: '#48bb78', A2: '#38a169',
  B1: '#4299e1', B2: '#2b6cb0',
  C1: '#ed8936', C2: '#c05621',
};

const SOURCE_META = {
  question_bank: { emoji: '❓', color: '#667eea' },
  listening:     { emoji: '🎧', color: '#9f7aea' },
  dictation:     { emoji: '🎙️', color: '#48bb78' },
};

const NEW_ONLY_THRESHOLD = 860;

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const SETS_KEY = 'pep_teacher_sets_v1';
const loadSets  = () => { try { return JSON.parse(localStorage.getItem(SETS_KEY) || '[]'); } catch { return []; } };
const storeSets = (s) => localStorage.setItem(SETS_KEY, JSON.stringify(s));
const genId     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Tiny shared components ────────────────────────────────────────────────────

function Badge({ color = '#718096', children, style = {} }) {
  return (
    <span style={{ background: color, color: 'white', borderRadius: 6, padding: '2px 9px', fontSize: 12, fontWeight: 600, ...style }}>
      {children}
    </span>
  );
}

function LevelBadge({ level }) {
  return <Badge color={LEVEL_COLORS[level] || '#718096'}>{level}</Badge>;
}

function FilterSection({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a0aec0', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Teacher Card ──────────────────────────────────────────────────────────────
// Shows everything: answer, options highlighted, transcript, etc.

function TeacherCard({ item }) {
  if (item._source === 'listening') {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          <Badge color="#9f7aea">🎧 Listening</Badge>
          <LevelBadge level={item.level} />
          {item.topic && <Badge color="#718096">{item.topic}</Badge>}
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>{item.title}</h3>
        {item.description && <p style={{ color: '#718096', margin: '0 0 10px', fontSize: 14 }}>{item.description}</p>}
        {item.intro_text && (
          <div style={{ background: '#f0f4ff', borderRadius: 8, padding: 10, marginBottom: 10, lineHeight: 1.6, fontSize: 14 }}>
            {item.intro_text}
          </div>
        )}
        {item.audio_url && (
          <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />
        )}
        {item.transcript && (
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#667eea', fontSize: 14 }}>📄 Transcript</summary>
            <p style={{ marginTop: 8, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontSize: 13, color: '#4a5568' }}>{item.transcript}</p>
          </details>
        )}
      </div>
    );
  }

  if (item._source === 'dictation') {
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          <Badge color="#48bb78">🎙️ Dictation</Badge>
          <LevelBadge level={item.level} />
          {item.topic && <Badge color="#718096">{item.topic}</Badge>}
          {item.excerpt_type && <Badge color="#9f7aea">{item.excerpt_type}</Badge>}
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 17 }}>{item.title}</h3>
        {item.audio_url && (
          <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />
        )}
        <div style={{ background: '#f0fff4', border: '2px solid #48bb78', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#38a169', letterSpacing: 1, marginBottom: 4 }}>ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{item.answer}</div>
        </div>
        {item.sentence_template && (
          <div style={{ background: '#f7fafc', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: '#718096', letterSpacing: 1, marginBottom: 4 }}>STUDENT SEES</div>
            <div style={{ fontSize: 16 }}>{item.sentence_template}</div>
          </div>
        )}
        {item.hint && <p style={{ color: '#718096', fontSize: 13, margin: 0 }}>💡 Hint: {item.hint}</p>}
      </div>
    );
  }

  // question_bank
  const opts = Array.isArray(item.options) ? item.options : [];
  const correct = item.correct_answer;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, alignItems: 'center' }}>
        <Badge color="#667eea">{TYPE_INFO[item.type]?.emoji} {TYPE_INFO[item.type]?.label || item.type}</Badge>
        <LevelBadge level={item.level} />
        {item.topic && <Badge color="#718096">{item.topic}</Badge>}
        {item.language && item.language !== 'en' && <Badge color="#f6ad55">🌐 {item.language}</Badge>}
        <span style={{ marginLeft: 'auto', color: '#a0aec0', fontSize: 12 }}>Q{item.question_number}</span>
      </div>

      <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.65, margin: '0 0 14px' }}>{item.question}</p>

      {opts.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {opts.map((opt, i) => {
            const isCorrect = opt === correct;
            return (
              <div key={i} style={{
                padding: '7px 12px', borderRadius: 8, marginBottom: 5,
                background: isCorrect ? '#f0fff4' : '#f7fafc',
                border: `${isCorrect ? 2 : 1}px solid ${isCorrect ? '#48bb78' : '#e2e8f0'}`,
                fontWeight: isCorrect ? 600 : 400,
                color: isCorrect ? '#276749' : '#2d3748',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
              }}>
                {isCorrect ? '✅' : '○'} {opt}
              </div>
            );
          })}
        </div>
      )}

      {opts.length === 0 && correct && (
        <div style={{ background: '#f0fff4', border: '2px solid #48bb78', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#38a169', letterSpacing: 1, marginBottom: 4 }}>ANSWER</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{correct}</div>
        </div>
      )}

      {item.informal_feedback && (
        <div style={{ background: '#fffbeb', borderRadius: 8, padding: 9, fontSize: 13, color: '#92400e', marginBottom: 8 }}>
          💬 {item.informal_feedback}
        </div>
      )}

      {item.acceptable_alternatives && Array.isArray(item.acceptable_alternatives) && item.acceptable_alternatives.length > 0 && (
        <div style={{ fontSize: 13, color: '#718096' }}>
          Also accepted: {item.acceptable_alternatives.join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Student Preview ───────────────────────────────────────────────────────────
// Visual-only — looks like what the student sees, no scoring wired up.

function StudentPreview({ item }) {
  const grad = {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: 12, padding: '1.1rem 1.25rem',
    color: 'white', marginBottom: 12,
  };
  const inputStyle = {
    width: '100%', padding: '0.7rem', border: '2px solid #e2e8f0',
    borderRadius: 8, fontSize: 15, boxSizing: 'border-box', background: '#f7fafc',
  };

  if (item._source === 'listening') {
    return (
      <div>
        <div style={grad}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>🎧 Listening Exercise</div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{item.title}</h3>
          {item.intro_text && <p style={{ margin: '6px 0 0', opacity: 0.9, fontSize: 13 }}>{item.intro_text}</p>}
        </div>
        {item.audio_url && <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />}
        <p style={{ color: '#718096', fontStyle: 'italic', fontSize: 13 }}>Questions reveal after the student plays the audio.</p>
      </div>
    );
  }

  if (item._source === 'dictation') {
    return (
      <div>
        <div style={grad}>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>🎙️ Dictation</div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{item.title}</h3>
        </div>
        {item.audio_url && <audio controls src={item.audio_url} style={{ width: '100%', marginBottom: 10 }} />}
        {item.sentence_template && (
          <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 500, padding: '0.9rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 10 }}>
            {item.sentence_template}
          </div>
        )}
        <input readOnly placeholder="Student types answer here…" style={inputStyle} />
        {item.hint && <p style={{ color: '#718096', fontSize: 13, marginTop: 6 }}>💡 {item.hint}</p>}
      </div>
    );
  }

  const { type, question, options } = item;
  const opts = Array.isArray(options) ? options : [];

  if (type === 'multiple_choice') return (
    <div>
      <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>{question}</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {opts.map((opt, i) => (
          <div key={i} style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: 8, padding: '0.7rem', textAlign: 'center', fontSize: 14 }}>{opt}</div>
        ))}
      </div>
    </div>
  );

  if (type === 'gap_fill') return (
    <div>
      <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>{question}</p></div>
      <input readOnly placeholder="Type your answer…" style={inputStyle} />
    </div>
  );

  if (type === 'sentence_building') {
    const shuffled = [...opts].sort(() => Math.random() - 0.5);
    return (
      <div>
        <div style={grad}><p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Put the words in the correct order 👆</p></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
          {shuffled.map((w, i) => (
            <div key={i} style={{ background: '#667eea', color: 'white', borderRadius: 6, padding: '5px 13px', fontSize: 14 }}>{w}</div>
          ))}
        </div>
        <div style={{ minHeight: 44, border: '2px dashed #e2e8f0', borderRadius: 8, padding: '0.5rem', color: '#a0aec0', fontSize: 13 }}>Your sentence appears here</div>
      </div>
    );
  }

  if (type === 'error_correction') return (
    <div>
      <div style={grad}>
        <p style={{ margin: '0 0 5px', fontSize: 12, opacity: 0.8 }}>Find and correct the error:</p>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{question}</p>
      </div>
      <input readOnly placeholder="Type the corrected sentence…" style={inputStyle} />
    </div>
  );

  if (type === 'odd_one_out') return (
    <div>
      <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>Which one doesn't belong? 👆</p></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {opts.map((opt, i) => (
          <div key={i} style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: 8, padding: '0.9rem', textAlign: 'center', fontWeight: 500, fontSize: 14 }}>{opt}</div>
        ))}
      </div>
    </div>
  );

  if (type === 'sentence_auction') return (
    <div>
      <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>Which sentences are correct? Bid on them! 🏷️</p></div>
      {opts.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem' }}>
          <span style={{ flex: 1, fontSize: 14 }}>{s}</span>
          <input readOnly placeholder="£" style={{ width: 54, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6, textAlign: 'center', background: '#f7fafc' }} />
        </div>
      ))}
    </div>
  );

  if (type === 'matching') {
    const lefts  = opts.map(p => typeof p.left  === 'object' ? p.left.content  : p.left);
    const rights = opts.map(p => typeof p.right === 'object' ? p.right.content : p.right).sort(() => Math.random() - 0.5);
    return (
      <div>
        <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>Match the items 👆</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>{lefts.map((l, i) => <div key={i} style={{ background: '#667eea', color: 'white', borderRadius: 8, padding: '0.65rem', marginBottom: 7, textAlign: 'center', fontSize: 14 }}>{l}</div>)}</div>
          <div>{rights.map((r, i) => <div key={i} style={{ background: 'white', border: '2px solid #e2e8f0', borderRadius: 8, padding: '0.65rem', marginBottom: 7, textAlign: 'center', fontSize: 14 }}>{r}</div>)}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={grad}><p style={{ margin: 0, fontSize: 15 }}>{question}</p></div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TeacherBrowse({ user, globalLang = 'en' }) {
  const [filters, setFilters] = useState({
    source: 'all',
    levels: [],
    types: [],
    topic: '',
    lang: globalLang,
    qFrom: '',
    qTo: '',
    newOnly: false,
  });

  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [selected,   setSelected]   = useState(new Set());
  const [previewItem, setPreviewItem] = useState(null);
  const [previewMode, setPreviewMode] = useState('teacher');

  const [sets,         setSets]         = useState(loadSets);
  const [activeSet,    setActiveSet]    = useState(null);
  const [showSetsPanel, setShowSetsPanel] = useState(false);
  const [addToSetId,   setAddToSetId]   = useState('');
  const [newSetName,   setNewSetName]   = useState('');

  const setFilter   = (k, v) => setFilters(f => ({ ...f, [k]: v }));
  const toggleLevel = (lv) => setFilter('levels', filters.levels.includes(lv) ? filters.levels.filter(l => l !== lv) : [...filters.levels, lv]);
  const toggleType  = (tp) => setFilter('types',  filters.types.includes(tp)  ? filters.types.filter(t => t !== tp)  : [...filters.types, tp]);

  // ── Search ────────────────────────────────────────────────────────────────

  const search = useCallback(async (overrideFilters) => {
    const f = overrideFilters || filters;
    setLoading(true);
    setHasSearched(true);
    setActiveSet(null);
    setPreviewItem(null);
    setSelected(new Set());

    const all = [];

    if (f.source === 'all' || f.source === 'question_bank') {
      let q = supabase.from('question_bank').select('*').order('question_number');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.types.length)  q = q.in('type',  f.types);
      if (f.topic)  q = q.ilike('topic', `%${f.topic}%`);
      if (f.qFrom)  q = q.gte('question_number', parseInt(f.qFrom));
      if (f.qTo)    q = q.lte('question_number', parseInt(f.qTo));
      if (f.newOnly) q = q.gte('question_number', NEW_ONLY_THRESHOLD);
      const { data } = await q.limit(200);
      if (data) data.forEach(r => all.push({ ...r, _source: 'question_bank', _rowKey: `qb_${r.id}` }));
    }

    if (f.source === 'all' || f.source === 'listening') {
      let q = supabase.from('listening_exercises').select('*').order('title');
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      const { data } = await q.limit(100);
      if (data) data.forEach(r => all.push({ ...r, _source: 'listening', _rowKey: `li_${r.id}` }));
    }

    if (f.source === 'all' || f.source === 'dictation') {
      let q = supabase.from('dictation_exercises').select('*').order('title');
      if (f.lang === 'en') q = q.in('language', ['en', 'both']);
      else if (f.lang === 'es') q = q.in('language', ['es', 'both']);
      if (f.levels.length) q = q.in('level', f.levels);
      if (f.topic) q = q.ilike('topic', `%${f.topic}%`);
      const { data } = await q.limit(100);
      if (data) data.forEach(r => all.push({ ...r, _source: 'dictation', _rowKey: `di_${r.id}` }));
    }

    setResults(all);
    setLoading(false);
  }, [filters]);

  // ── Load a saved set ──────────────────────────────────────────────────────

  const loadSet = async (set) => {
    setActiveSet({ id: set.id, name: set.name });
    setLoading(true);
    setHasSearched(true);
    setPreviewItem(null);
    setSelected(new Set());

    const all = [];
    const qbIds = set.items.filter(i => i.source === 'question_bank').map(i => i.id);
    const liIds = set.items.filter(i => i.source === 'listening').map(i => i.id);
    const diIds = set.items.filter(i => i.source === 'dictation').map(i => i.id);

    if (qbIds.length) {
      const { data } = await supabase.from('question_bank').select('*').in('id', qbIds);
      if (data) data.forEach(r => all.push({ ...r, _source: 'question_bank', _rowKey: `qb_${r.id}` }));
    }
    if (liIds.length) {
      const { data } = await supabase.from('listening_exercises').select('*').in('id', liIds);
      if (data) data.forEach(r => all.push({ ...r, _source: 'listening', _rowKey: `li_${r.id}` }));
    }
    if (diIds.length) {
      const { data } = await supabase.from('dictation_exercises').select('*').in('id', diIds);
      if (data) data.forEach(r => all.push({ ...r, _source: 'dictation', _rowKey: `di_${r.id}` }));
    }

    // Preserve saved set order
    const orderMap = {};
    set.items.forEach((item, idx) => { orderMap[item.id] = idx; });
    all.sort((a, b) => (orderMap[a.id] ?? 99) - (orderMap[b.id] ?? 99));

    setResults(all);
    setLoading(false);
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect   = (key) => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const selectAll      = () => setSelected(new Set(results.map(r => r._rowKey)));
  const clearSelection = () => setSelected(new Set());

  // ── Saved-set CRUD ────────────────────────────────────────────────────────

  const saveSelectionToSet = (targetId, name) => {
    const newItems = results
      .filter(r => selected.has(r._rowKey))
      .map(r => ({
        source: r._source,
        id:     r.id,
        label:  r._source === 'question_bank'
          ? `Q${r.question_number}: ${(r.question || '').slice(0, 55)}`
          : (r.title || r.id),
      }));

    let updated;
    if (targetId === '__new__') {
      updated = [...sets, { id: genId(), name, createdAt: new Date().toISOString(), items: newItems }];
    } else {
      updated = sets.map(s => {
        if (s.id !== targetId) return s;
        const existing = new Set(s.items.map(i => i.id));
        return { ...s, items: [...s.items, ...newItems.filter(i => !existing.has(i.id))] };
      });
    }

    setSets(updated);
    storeSets(updated);
    setSelected(new Set());
    setAddToSetId('');
    setNewSetName('');
  };

  const deleteSet = (id) => {
    const updated = sets.filter(s => s.id !== id);
    setSets(updated);
    storeSets(updated);
    if (activeSet?.id === id) { setActiveSet(null); setResults([]); setHasSearched(false); }
  };

  const removeFromActiveSet = (itemId) => {
    if (!activeSet) return;
    const updated = sets.map(s =>
      s.id !== activeSet.id ? s : { ...s, items: s.items.filter(i => i.id !== itemId) }
    );
    setSets(updated);
    storeSets(updated);
    setResults(prev => prev.filter(r => r.id !== itemId));
  };

  // ── Render: filter sidebar ────────────────────────────────────────────────

  const sidebar = (
    <div style={{ width: 220, flexShrink: 0, background: 'white', borderRadius: 12, padding: '1.1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', alignSelf: 'flex-start', position: 'sticky', top: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#2d3748' }}>🔎 Filters</div>

      <FilterSection label="Source">
        {[['all', '🗂️ All'], ['question_bank', '❓ Questions'], ['listening', '🎧 Listening'], ['dictation', '🎙️ Dictation']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilter('source', val)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', borderRadius: 6, border: 'none', background: filters.source === val ? '#667eea' : 'transparent', color: filters.source === val ? 'white' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 13 }}>
            {lbl}
          </button>
        ))}
      </FilterSection>

      <FilterSection label="Language">
        <div style={{ display: 'flex', gap: 4 }}>
          {[['en', '🇬🇧'], ['es', '🇪🇸'], ['both', '🌐']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter('lang', val)} title={val === 'en' ? 'English' : val === 'es' ? 'Spanish' : 'Both'} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.lang === val ? '#667eea' : 'white', color: filters.lang === val ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 16 }}>
              {lbl}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="Level">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {LEVELS.map(lv => (
            <button key={lv} onClick={() => toggleLevel(lv)} style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #e2e8f0', background: filters.levels.includes(lv) ? LEVEL_COLORS[lv] : 'white', color: filters.levels.includes(lv) ? 'white' : '#4a5568', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {lv}
            </button>
          ))}
        </div>
      </FilterSection>

      {(filters.source === 'all' || filters.source === 'question_bank') && (
        <FilterSection label="Type">
          {Object.entries(TYPE_INFO).map(([key, { emoji, label }]) => (
            <button key={key} onClick={() => toggleType(key)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 7px', borderRadius: 6, border: 'none', background: filters.types.includes(key) ? '#edf2ff' : 'transparent', color: filters.types.includes(key) ? '#667eea' : '#4a5568', cursor: 'pointer', marginBottom: 1, fontSize: 12 }}>
              {filters.types.includes(key) ? '✓' : '○'} {emoji} {label}
            </button>
          ))}
        </FilterSection>
      )}

      <FilterSection label="Topic keyword">
        <input value={filters.topic} onChange={e => setFilter('topic', e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="e.g. comparatives" style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
      </FilterSection>

      {(filters.source === 'all' || filters.source === 'question_bank') && (
        <FilterSection label="Q number range">
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input value={filters.qFrom} onChange={e => setFilter('qFrom', e.target.value)} placeholder="From" style={{ flex: 1, padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
            <span style={{ color: '#a0aec0', fontSize: 12 }}>–</span>
            <input value={filters.qTo} onChange={e => setFilter('qTo', e.target.value)} placeholder="To" style={{ flex: 1, padding: '4px 7px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
          </div>
        </FilterSection>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <input type="checkbox" id="newOnly" checked={filters.newOnly} onChange={e => setFilter('newOnly', e.target.checked)} style={{ accentColor: '#667eea', width: 15, height: 15 }} />
        <label htmlFor="newOnly" style={{ fontSize: 12, cursor: 'pointer', color: '#4a5568' }}>New only ({NEW_ONLY_THRESHOLD}+)</label>
      </div>

      <button onClick={() => search()} disabled={loading} style={{ width: '100%', padding: '9px', background: '#667eea', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
        {loading ? '…' : '🔍 Search'}
      </button>

      <button onClick={() => { setFilters({ source: 'all', levels: [], types: [], topic: '', lang: globalLang, qFrom: '', qTo: '', newOnly: false }); setResults([]); setHasSearched(false); setActiveSet(null); setSelected(new Set()); }} style={{ width: '100%', padding: '7px', background: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 5 }}>
        Clear all
      </button>
    </div>
  );

  // ── Render: results list ──────────────────────────────────────────────────

  const resultsList = (
    <div style={{ flex: 1, minWidth: 0 }}>

      {/* Active set banner */}
      {activeSet && (
        <div style={{ background: '#f0f4ff', border: '2px solid #667eea', borderRadius: 10, padding: '9px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: '#667eea', fontSize: 14 }}>📂 {activeSet.name}</span>
          <button onClick={() => { setActiveSet(null); setResults([]); setHasSearched(false); }} style={{ background: 'none', border: 'none', color: '#718096', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Results header + bulk actions */}
      {hasSearched && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: '#4a5568', fontSize: 13 }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
          {results.length > 0 && (
            <>
              <button onClick={selectAll} style={{ fontSize: 12, color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Select all</button>
              {selected.size > 0 && (
                <>
                  <button onClick={clearSelection} style={{ fontSize: 12, color: '#718096', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                  <span style={{ background: '#667eea', color: 'white', borderRadius: 12, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{selected.size} selected</span>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Save selection bar */}
      {selected.size > 0 && (
        <div style={{ background: '#f0f4ff', border: '1px solid #c3d1f7', borderRadius: 10, padding: '9px 12px', marginBottom: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
          <span style={{ fontWeight: 600, color: '#4a5568', fontSize: 13 }}>💾 Save {selected.size} item{selected.size !== 1 ? 's' : ''}:</span>
          <select value={addToSetId} onChange={e => setAddToSetId(e.target.value)} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, background: 'white' }}>
            <option value="">— pick a set —</option>
            <option value="__new__">+ New set…</option>
            {sets.map(s => <option key={s.id} value={s.id}>{s.name} ({s.items.length})</option>)}
          </select>
          {addToSetId === '__new__' && (
            <input value={newSetName} onChange={e => setNewSetName(e.target.value)} placeholder="Set name" autoFocus style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && newSetName && saveSelectionToSet('__new__', newSetName)} />
          )}
          {((addToSetId && addToSetId !== '__new__') || (addToSetId === '__new__' && newSetName)) && (
            <button onClick={() => saveSelectionToSet(addToSetId, newSetName)} style={{ padding: '4px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Save ✓
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>Searching…</div>}

      {/* Empty / initial states */}
      {!loading && hasSearched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
          No results — try adjusting the filters.
        </div>
      )}
      {!loading && !hasSearched && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>
          Set your filters and hit Search, or open a saved set above.
        </div>
      )}

      {/* Result rows */}
      {!loading && results.map(item => {
        const isSel   = selected.has(item._rowKey);
        const isActive = previewItem?._rowKey === item._rowKey;
        const srcMeta = SOURCE_META[item._source];
        const title = item._source === 'question_bank'
          ? (item.question || '').slice(0, 110)
          : (item.title || '');
        const sub = item._source === 'question_bank'
          ? `Q${item.question_number} · ${TYPE_INFO[item.type]?.label || item.type}`
          : (item.description || item.answer || '').slice(0, 70);

        return (
          <div key={item._rowKey} onClick={() => setPreviewItem(isActive ? null : item)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: isActive ? '#f0f4ff' : 'white', border: `1px solid ${isActive ? '#667eea' : '#e2e8f0'}`, borderRadius: 10, marginBottom: 5, cursor: 'pointer' }}>

            {/* Checkbox */}
            <div onClick={e => { e.stopPropagation(); toggleSelect(item._rowKey); }} style={{ flexShrink: 0, width: 18, height: 18, border: `2px solid ${isSel ? '#667eea' : '#cbd5e0'}`, borderRadius: 4, background: isSel ? '#667eea' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11 }}>
              {isSel && '✓'}
            </div>

            {/* Source emoji */}
            <div style={{ flexShrink: 0, background: srcMeta.color, color: 'white', borderRadius: 5, padding: '2px 6px', fontSize: 12 }}>
              {srcMeta.emoji}
            </div>

            {/* Level */}
            {item.level && (
              <div style={{ flexShrink: 0, background: LEVEL_COLORS[item.level] || '#718096', color: 'white', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, minWidth: 26, textAlign: 'center' }}>
                {item.level}
              </div>
            )}

            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#718096', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
            </div>

            {/* Remove from active set */}
            {activeSet && (
              <button onClick={e => { e.stopPropagation(); removeFromActiveSet(item.id); }} title="Remove from set" style={{ flexShrink: 0, background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 17, padding: '1px 5px', lineHeight: 1 }}>×</button>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Render: preview panel ─────────────────────────────────────────────────

  const previewPanel = previewItem && (
    <div style={{ width: 380, flexShrink: 0, background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.11)', alignSelf: 'flex-start', position: 'sticky', top: 12, overflow: 'hidden' }}>
      {/* Toggle header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 7, padding: 3, gap: 2 }}>
          {[['teacher', '👩‍🏫 Teacher'], ['student', '👤 Student']].map(([mode, label]) => (
            <button key={mode} onClick={() => setPreviewMode(mode)} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: previewMode === mode ? '#667eea' : 'transparent', color: previewMode === mode ? 'white' : '#718096', cursor: 'pointer', fontSize: 12, fontWeight: previewMode === mode ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '1.1rem', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        {previewMode === 'teacher' ? <TeacherCard item={previewItem} /> : <StudentPreview item={previewItem} />}
      </div>
    </div>
  );

  // ── Render: full page ─────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>

      {/* Page header */}
      <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', padding: '1.25rem 1.5rem', color: 'white' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 700 }}>🔍 Question Browser</h1>
            <p style={{ margin: 0, opacity: 0.8, fontSize: 13 }}>Search, preview and organise questions for class</p>
          </div>
          <button onClick={() => setShowSetsPanel(v => !v)} style={{ background: showSetsPanel ? 'white' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.45)', color: showSetsPanel ? '#667eea' : 'white', borderRadius: 8, padding: '7px 15px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            📂 My Sets {sets.length > 0 ? `(${sets.length})` : ''}
          </button>
        </div>
      </div>

      {/* Sets panel */}
      {showSetsPanel && (
        <div style={{ maxWidth: 1300, margin: '10px auto 0', padding: '0 1rem' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '1.1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#2d3748' }}>📂 Saved Sets</div>
            {sets.length === 0
              ? <p style={{ color: '#718096', fontSize: 13, margin: 0 }}>No saved sets yet. Search for questions, tick the checkboxes, then save to a set.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sets.map(s => (
                    <div key={s.id} style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <button onClick={() => { loadSet(s); setShowSetsPanel(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#667eea', fontSize: 13, padding: 0 }}>
                        📂 {s.name}
                      </button>
                      <span style={{ color: '#a0aec0', fontSize: 12 }}>{s.items.length} items</span>
                      <button onClick={() => deleteSet(s.id)} title="Delete set" style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Three-column layout */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '10px 1rem 2rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {sidebar}
        {resultsList}
        {previewPanel}
      </div>
    </div>
  );
}
