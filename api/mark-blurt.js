// api/mark-blurt.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { categoryName, scoringInstructions, hasPenalty, penaltyCategoryName, answers } = req.body;

  if (!answers || answers.length === 0) {
    return res.json({ scored: [] });
  }

  const penaltyBlock = hasPenalty
    ? `\nPENALTY RULE: The penalty category is "${penaltyCategoryName}". If an answer clearly belongs to "${penaltyCategoryName}" rather than "${categoryName}", set penalty=true AND accepted=false. This deducts a point.`
    : '';

  const prompt = `You are scoring a fast-paced vocabulary game for adult language learners. The category is: "${categoryName}".

SCORING INSTRUCTIONS:
${scoringInstructions}${penaltyBlock}

GENERAL RULES:
- Be generous. Accept correct answers even if informally spelled or creatively phrased.
- Answers may be in English or Spanish depending on the category — accept whichever language the category requires.
- Swear words and rude answers are fine if they genuinely fit the category.
- Duplicates (same answer submitted twice) should only be counted once — mark the second occurrence accepted=false with note="Already counted".
- For the note field: keep it very short (max 8 words). Only add a note for: wrong answers, penalties, the James bonus, or something genuinely funny or interesting. Leave note as empty string for plain correct answers.

The student submitted these answers (in the order typed):
${answers.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Return ONLY a valid JSON array with no other text, preamble or markdown. Each element must have exactly these fields:
- "answer": the original answer string exactly as submitted
- "accepted": true or false
- "penalty": true or false
- "note": string (very short, or empty string)

Example format:
[{"answer":"went","accepted":true,"penalty":false,"note":""},{"answer":"walked","accepted":false,"penalty":false,"note":"That one is regular!"}]`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const raw = data.content[0].text.trim();
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const scored = JSON.parse(clean);

    res.json({ scored });
  } catch (err) {
    console.error('mark-blurt error:', err);
    res.status(500).json({ error: 'Scoring failed', scored: [] });
  }
}