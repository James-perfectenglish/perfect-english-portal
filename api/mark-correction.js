// api/mark-correction.js
// Vercel serverless function — proxies AI marking requests to Anthropic
// Add ANTHROPIC_API_KEY to your Vercel environment variables

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { originalSentence, errorWord, studentReplacement, correctAnswerSentence } = req.body;

  if (!originalSentence || !errorWord || !studentReplacement || !correctAnswerSentence) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = `You are marking an English error correction exercise.

Original sentence (contains one error): "${originalSentence}"
The error word is: "${errorWord}"
The student replaced it with: "${studentReplacement}"
The model answer is: "${correctAnswerSentence}"

Decide: is the student's replacement grammatically correct AND does it fix the error in the original sentence?
Only answer YES if their word genuinely works as a valid correction, even if different from the model answer.
Answer NO if it is grammatically wrong, changes the meaning inappropriately, or does not fix the error.

Reply with exactly one JSON object and nothing else:
{"valid": true, "reason": "one short sentence explaining why it works"}
or
{"valid": false, "reason": "one short sentence explaining why it does not work"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error', valid: null });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (e) {
    console.error('mark-correction error:', e);
    // Return null valid so the component falls through gracefully
    return res.status(200).json({ valid: null, reason: '' });
  }
}
