export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { student_answer, correct_answer, question, transcript } = req.body;

  if (!student_answer || !correct_answer) {
    return res.status(400).json({ valid: false, reason: 'Missing required fields' });
  }

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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are marking a listening comprehension gap-fill question for an English or Spanish language learner.

The student listened to an audio recording and must fill in a blank based on what they heard.

Transcript excerpt:
"${transcript}"

Gap-fill question: "${question}"

Expected answer: "${correct_answer}"

Student's answer: "${student_answer}"

Mark this generously. Accept the answer if:
- It matches the expected answer closely (exact or near-exact)
- It captures the key word or phrase from the transcript, even if the student didn't catch every word
- It is a reasonable partial answer that shows the student understood the relevant part
- Minor spelling errors that don't change the meaning

Reject only if the student's answer is clearly wrong, shows they misheard something significant, or is unrelated to what was said.

Respond with JSON only: { "valid": true/false, "reason": "brief explanation" }`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch (err) {
    console.error('mark-listening-gap error:', err);
    return res.status(500).json({ valid: false, reason: 'Marking service unavailable' });
  }
}
