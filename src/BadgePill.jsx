// ─────────────────────────────────────────────────────────────────────────────
// src/components/BadgePill.jsx
//
// Central source of truth for ALL badge pills across the app.
// To restyle any badge type app-wide, edit this file only.
//
// Exports:
//   LevelBadge      – A1/B2/C1 etc. (green / blue / orange)
//   TypeBadge       – question format (Gap Fill, Multiple Choice, etc.)
//   AiMarkedBadge   – 🤖 AI marked
//   TopicBadge      – topic string from DB
//   ExcerptBadge    – word / phrase / sentence (Dictation)
//   TagBadge        – single semantic tag
//   TagBadges       – renders all tags[] for a question
// ─────────────────────────────────────────────────────────────────────────────

const BASE = {
  padding: '4px 12px',
  borderRadius: '20px',
  fontSize: '0.8rem',
  fontWeight: '600',
  display: 'inline-block',
  lineHeight: '1.4',
};

// ── Level ─────────────────────────────────────────────────────────────────────
// Keep the existing site palette: green A / blue B / orange C
const LEVEL = {
  A: { backgroundColor: '#c6f6d5', color: '#276749', border: '1px solid #68D391' },
  B: { backgroundColor: '#bee3f8', color: '#2b6cb0', border: '1px solid #63B3ED' },
  C: { backgroundColor: '#feebc8', color: '#c05621', border: '1px solid #F6AD55' },
};

export function LevelBadge({ level }) {
  if (!level) return null;
  const g = level.startsWith('A') ? 'A' : level.startsWith('B') ? 'B' : 'C';
  return <div style={{ ...BASE, ...LEVEL[g] }}>{level}</div>;
}

// ── Question type ─────────────────────────────────────────────────────────────
const TYPE = {
  gap_fill:          { backgroundColor: '#fff3cd', color: '#856404', border: '1px solid #F6D860',  label: '✏️ Gap Fill' },
  multiple_choice:   { backgroundColor: '#d4edda', color: '#155724', border: '1px solid #68D391',  label: '📝 Multiple Choice' },
  odd_one_out:       { backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC',  label: '🔍 Odd One Out' },
  error_correction:  { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5',  label: '🚨 Error Correction' },
  matching:          { backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7',  label: '🔗 Matching' },
  dictation:         { backgroundColor: '#EDE9FE', color: '#553C9A', border: '1px solid #C4B5FD',  label: '⌨️ Dictation' },
  sentence_building: { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A',  label: '🔨 Sentence Building' },
};

// sentence_building renders no badge (it shows the UI inline instead)
export function TypeBadge({ type }) {
  if (!type || type === 'sentence_building') return null;
  const cfg = TYPE[type];
  if (!cfg) return null;
  return <div style={{ ...BASE, ...cfg }}>{cfg.label}</div>;
}

// ── AI marked ─────────────────────────────────────────────────────────────────
const AI = { backgroundColor: '#EDE9FE', color: '#553C9A', border: '1px solid #C4B5FD' };

export function AiMarkedBadge() {
  return <div style={{ ...BASE, ...AI, fontSize: '0.75rem' }}>🤖 AI marked</div>;
}

// ── Topic ─────────────────────────────────────────────────────────────────────
// Slate grey — neutral, unobtrusive
const TOPIC_DEFAULT = { backgroundColor: '#f0f0f0', color: '#555',    border: '1px solid #CBD5E1' };
const TOPIC_SPECIAL = { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' };

export function TopicBadge({ topic }) {
  if (!topic) return null;
  const isSpecial = topic === 'question_forms' || topic === 'punctuation';
  const label = (topic === 'question_forms' ? '❓ ' : '') +
    topic.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return <div style={{ ...BASE, ...(isSpecial ? TOPIC_SPECIAL : TOPIC_DEFAULT) }}>{label}</div>;
}

// ── Excerpt type (Dictation only) ─────────────────────────────────────────────
const EXCERPT_LABELS = { word: 'Word', phrase: 'Phrase', sentence: 'Sentence' };
const EXCERPT = { backgroundColor: '#EDE9FE', color: '#553C9A', border: '1px solid #C4B5FD' };

export function ExcerptBadge({ excerptType }) {
  if (!excerptType) return null;
  return <div style={{ ...BASE, ...EXCERPT, fontSize: '0.75rem' }}>{EXCERPT_LABELS[excerptType] || excerptType}</div>;
}

// ── Tags ──────────────────────────────────────────────────────────────────────
//
// Four semantic categories, each with a distinct colour:
//   prep    → Slate grey   (preposition-related)
//   grammar → Indigo       (grammar / usage / structure)
//   verb    → Purple       (phrasal verbs, verb forms)
//   vocab   → Rose         (topic vocabulary)
//   default → Lavender     (anything not yet categorised)

const TAG_CATEGORY = {
  // Prepositions
  'Dependent preposition':   'prep',
  'Preposition of time':     'prep',
  'Preposition of place':    'prep',
  'Preposition of movement': 'prep',
  // Grammar / Usage
  'Fixed expression':        'grammar',
  'Collocation':             'grammar',
  'Confusable words':        'grammar',
  'Uncountable noun':        'grammar',
  'Countable noun':          'grammar',
  // Verbs
  'Phrasal verb':            'verb',
  'Business phrasal verb':   'verb',
  // Vocabulary
  'Business vocabulary':     'vocab',
  'Financial vocabulary':    'vocab',
  'HR vocabulary':           'vocab',
  'Hotel vocabulary':        'vocab',
  'Bathroom vocabulary':     'vocab',
  'Vocabulario':             'vocab',
};

const TAG_STYLES = {
  prep:    { backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' },
  grammar: { backgroundColor: '#EEF2FF', color: '#3730A3', border: '1px solid #C7D2FE' },
  verb:    { backgroundColor: '#FAF5FF', color: '#7E22CE', border: '1px solid #E9D5FF' },
  vocab:   { backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' },
  default: { backgroundColor: '#F5F3FF', color: '#6D28D9', border: '1px solid #DDD6FE' },
};

export function TagBadge({ tag }) {
  if (!tag) return null;
  const cat = TAG_CATEGORY[tag] || 'default';
  return <div style={{ ...BASE, ...TAG_STYLES[cat] }}>{tag}</div>;
}

export function TagBadges({ tags }) {
  if (!tags || tags.length === 0) return null;
  return tags.map(tag => <TagBadge key={tag} tag={tag} />);
}
