// api/notify-events.js
//
// Single endpoint for teacher email alerts, driven by Supabase database webhooks.
// Wire one webhook per table (INSERT only) in Supabase -> Database -> Webhooks,
// both pointing here (https://app.perfect-english.org/api/notify-events):
//   - question_flags    -> "a student reported a question"
//   - queen_bee_alerts  -> "a student hit Queen Bee in Spelling Bee"
//
// Mirrors notify-new-signup.js: Supabase posts { type, table, record }; we look up
// the human-readable details with the service-role key (bypasses RLS) and send via
// Resend. No client changes are needed -- the inserts already happen in the app.

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  'https://dyxmgicedabvmsbuvxny.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

const TO   = 'james@perfect-english.org';
const FROM = 'Perfect English <james@perfect-english.org>';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const row = (label, value) => `
  <tr>
    <td style="padding: 4px 14px 4px 0; color: #666; vertical-align: top; white-space: nowrap;"><strong>${label}</strong></td>
    <td style="padding: 4px 0; vertical-align: top;">${value}</td>
  </tr>`;

const shell = (title, rows) => `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="margin: 0 0 16px;">${title}</h2>
      <table style="border-collapse: collapse; font-size: 15px;">
        ${rows}
      </table>
    </div>
  </body>
</html>`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, table, record } = req.body || {};

    // Only react to inserts; webhooks should be INSERT-only, but guard anyway.
    if (type && type !== 'INSERT') {
      return res.status(200).json({ message: `Ignoring ${type}` });
    }
    if (!record) {
      return res.status(200).json({ message: 'No record in payload' });
    }

    if (table === 'question_flags') {
      await sendFlagEmail(record);
    } else if (table === 'queen_bee_alerts') {
      await sendQueenBeeEmail(record);
    } else {
      return res.status(200).json({ message: `No handler for table: ${table}` });
    }

    return res.status(200).json({ message: 'Notification sent' });
  } catch (error) {
    console.error('notify-events error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// Resolve a profile id to a display name + level, with a safe fallback.
async function lookupStudent(userId) {
  if (!userId) return { name: 'A student', level: '' };
  const { data } = await supabase
    .from('profiles')
    .select('full_name, level')
    .eq('id', userId)
    .single();
  return {
    name:  (data?.full_name || '').trim() || 'A student',
    level: data?.level || '',
  };
}

async function sendFlagEmail(record) {
  const { name, level } = await lookupStudent(record.user_id);

  const { data: q } = await supabase
    .from('question_bank')
    .select('question, type, level, topic, correct_answer')
    .eq('question_number', record.question_number)
    .single();

  const subject = `🚩 ${name} flagged Q${record.question_number}`;

  const rows =
    row('Student',  `${esc(name)}${level ? ` (${esc(level)})` : ''}`) +
    row('Question', `Q${esc(record.question_number)}${q ? ` &middot; ${esc(q.type)} &middot; ${esc(q.level)}` : ' &middot; (not found in question_bank)'}`) +
    (q?.topic          ? row('Topic',  esc(q.topic)) : '') +
    (q                 ? row('Text',   esc(q.question)) : '') +
    (q?.correct_answer ? row('Answer', esc(q.correct_answer)) : '') +
    row('Reason', record.reason ? esc(record.reason) : '<em style="color:#999;">(none given)</em>');

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    html: shell('🚩 Question reported', rows),
  });
}

async function sendQueenBeeEmail(record) {
  const { name, level } = await lookupStudent(record.user_id);

  const { data: p } = await supabase
    .from('spelling_bee_puzzles')
    .select('play_date, language, centre_letter, outer_letters')
    .eq('id', record.puzzle_id)
    .single();

  const subject = `👑 ${name} got Queen Bee!`;

  const lang   = p?.language === 'es' ? '🇪🇸 Spanish' : '🇬🇧 English';
  const centre = (p?.centre_letter || '').toUpperCase();
  const outer  = (p?.outer_letters || []).map((l) => l.toUpperCase()).join('');

  const rows =
    row('Student', `${esc(name)}${level ? ` (${esc(level)})` : ''}`) +
    row('Words',   esc(record.word_count)) +
    row('Score',   esc(record.score)) +
    (p ? row('Puzzle', `${lang}${p.play_date ? ` &middot; ${esc(p.play_date)}` : ''}${centre ? ` &middot; centre ${esc(centre)} &middot; ${esc(outer)}` : ''}`) : '') +
    (record.note ? row('Note', esc(record.note)) : '');

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    html: shell('👑 Queen Bee achieved', rows),
  });
}
