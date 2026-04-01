// api/validate-word-snake.js

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { word, category_name, ai_prompt } = req.body;

  if (!word || !category_name || !ai_prompt) {
    return res.status(400).json({ valid: false, reason: 'Missing required fields' });
  }

  const prompt = `You are validating a single word entry for a fast-paced vocabulary game played by adult English learners.

Category: "${category_name}"
Category rules: ${ai_prompt}

The student submitted: "${word}"

GENERAL RULES:
- This is a game. Be very generous — err strongly on the side of accepting.
- Allow humour, slang, informal language, mild swearing, and creative interpretations.
- Only reject if the entry clearly and obviously does not belong to this category at all.
- If in doubt, accept it.

Return ONLY a valid JSON object with no other text, preamble or markdown:
{"valid": true, "reason": "brief explanation"}
or
{"valid": false, "reason": "brief explanation"}`;

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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    const raw = data.content[0].text.trim();
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const result = JSON.parse(clean);

    res.json({ valid: Boolean(result.valid), reason: result.reason || '' });
  } catch (err) {
    console.error('validate-word-snake error:', err);
    res.status(500).json({ valid: false, reason: 'Validation unavailable — try again' });
  }
}