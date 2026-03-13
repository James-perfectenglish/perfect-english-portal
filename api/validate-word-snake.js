import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, reason: 'Method not allowed' });
  }

  const { word, category_name, ai_prompt } = req.body;

  if (!word || !category_name || !ai_prompt) {
    return res.status(400).json({ valid: false, reason: 'Missing required fields' });
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `You are validating a single entry for a word-chain vocabulary game.

Category: "${category_name}"
Category rules: ${ai_prompt}

The student submitted: "${word}"

Respond with JSON only — no preamble, no markdown:
{"valid": true, "reason": "brief explanation"}
or
{"valid": false, "reason": "brief explanation"}

Be generous with near-correct spellings and minor variations. Only reject if the entry clearly does not belong to this category.`,
        },
      ],
    });

    const raw = message.content[0].text.trim().replace(/```json|```/g, '').trim();
    const result = JSON.parse(raw);
    return res.status(200).json({
      valid: Boolean(result.valid),
      reason: result.reason || '',
    });
  } catch (err) {
    console.error('validate-word-snake error:', err);
    return res.status(500).json({ valid: false, reason: 'Validation unavailable — try again' });
  }
}
