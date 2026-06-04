// api/mark-game.js
// Consolidated game marking: blurt | word_snake
// Pass { type: 'blurt' | 'word_snake', ...fields } in body

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { type } = req.body;
  if (type === 'word_snake') return handleWordSnake(req, res);
  return handleBlurt(req, res);
}

// ── BLURT ─────────────────────────────────────────────────────────────────
async function handleBlurt(req, res) {
  const { categoryName, scoringInstructions, hasPenalty, penaltyCategoryName, answers } = req.body;
  if (!answers || answers.length === 0) return res.json({ scored: [] });

  const penaltyBlock = hasPenalty
    ? `\nPENALTY RULE: The penalty category is "${penaltyCategoryName}". If an answer clearly belongs to "${penaltyCategoryName}" rather than "${categoryName}", set penalty=true AND accepted=false. This deducts a point.`
    : '';

  const prompt = `You are scoring a fast-paced vocabulary game for adult language learners. The category is: "${categoryName}".

SCORING INSTRUCTIONS:
${scoringInstructions}${penaltyBlock}

GENERAL RULES:
- Be generous. Accept correct answers even if informally spelled or creatively phrased.
- Answers may be in English or Spanish — accept whichever language the category requires.
- Swear words and rude answers are fine if they genuinely fit the category.
- Duplicates: mark the second occurrence accepted=false, note="Already counted".
- note field: max 8 words. Only add a note for wrong answers, penalties, or something genuinely funny. Empty string for plain correct answers.

The student submitted these answers (in order):
${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Return ONLY a valid JSON array, no other text or markdown. Each element:
- "answer": original string exactly as submitted
- "accepted": true or false
- "penalty": true or false
- "note": string (very short, or empty string)

Example: [{"answer":"went","accepted":true,"penalty":false,"note":""},{"answer":"walked","accepted":false,"penalty":false,"note":"That one is regular!"}]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json();
    const text = (data.content?.find(b => b.type === 'text')?.text || '').trim();
    // Defensive: extract the first [...] array so a prose preamble/suffix can't break JSON.parse.
    let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBracket = clean.indexOf('[');
    const lastBracket  = clean.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      clean = clean.slice(firstBracket, lastBracket + 1);
    }
    res.json({ scored: JSON.parse(clean) });
  } catch (err) {
    console.error('mark-game.blurt error:', err);
    res.status(500).json({ error: 'Scoring failed', scored: [] });
  }
}

// ── WORD SNAKE ─────────────────────────────────────────────────────────────
async function handleWordSnake(req, res) {
  const { word, category_name, ai_prompt } = req.body;
  if (!word || !category_name || !ai_prompt)
    return res.status(400).json({ valid: false, reason: 'Missing required fields' });

  const prompt = `You are validating a single word entry for a fast-paced vocabulary game played by adult English learners.

Category: "${category_name}"
Category rules: ${ai_prompt}
The student submitted: "${word}"

GENERAL RULES:
- This is a game. Be very generous — err strongly on the side of accepting.
- Allow humour, slang, informal language, mild swearing, and creative interpretations.
- Only reject if the entry clearly and obviously does not belong to this category at all.
- If in doubt, accept it.

Return ONLY a valid JSON object:
{"valid": true, "reason": "brief explanation"}
or
{"valid": false, "reason": "brief explanation"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await response.json();
    const text = (data.content?.find(b => b.type === 'text')?.text || '').trim();
    // Defensive: extract the first {...} block so a prose preamble/suffix can't break JSON.parse.
    let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace  = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
    const result = JSON.parse(clean);
    res.json({ valid: Boolean(result.valid), reason: result.reason || '' });
  } catch (err) {
    console.error('mark-game.word_snake error:', err);
    res.status(500).json({ valid: false, reason: 'Validation unavailable — try again' });
  }
}