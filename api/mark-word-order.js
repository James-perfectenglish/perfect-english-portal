// api/mark-sentence.js
// Vercel serverless function — AI marking for sentence building word-order answers
// Requires ANTHROPIC_API_KEY in Vercel environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { correctAnswer, studentAnswer, language = 'en' } = req.body;

  if (!correctAnswer || !studentAnswer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isSpanish = language === 'es';

  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de construcción de frases en español.

Respuesta modelo: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

El alumno ha ordenado palabras para construir una frase. ¿Es la respuesta del alumno gramaticalmente correcta y tiene el mismo significado que la respuesta modelo, aunque el orden de las palabras sea diferente?
Acepta variaciones válidas en el orden de palabras (por ejemplo, adverbios o complementos de tiempo en posición diferente) siempre que la frase sea gramaticalmente correcta en español y el significado sea el mismo.
Responde NO si la frase es incorrecta gramaticalmente, cambia el significado, o está incompleta.

Responde con exactamente un objeto JSON y nada más:
{"valid": true, "reason": "una frase corta explicando por qué es correcta"}
o
{"valid": false, "reason": "una frase corta explicando por qué no es correcta"}`
    : `You are marking a sentence building exercise for adult language learners.

Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

The student arranged word tiles to build a sentence. Apply these rules:

RULE 1 — Accept grammatically correct answers. If the student's sentence is grammatically correct English and makes sense, mark it valid — even if some words from the model answer are missing.

RULE 2 — Accept word order variations. Adverb placement, time phrase position, and similar variations are fine as long as the sentence is natural English.

RULE 3 — Simplified but correct. If the student's sentence is grammatically correct but omits some words (making it a slight simplification of the model), still mark it valid. Include a short note in the reason field pointing out what was simplified.
Example: model="The project is unlikely to be completed on time unless additional funding is approved", student="The project is unlikely to be completed unless additional funding is approved" → valid=true, reason="Correct! Note: 'on time' was omitted — the full sentence specifies the deadline."

Only mark INVALID if the sentence is grammatically wrong, unnatural, or completely changes the core meaning.

Reply with exactly one JSON object and nothing else:
{"valid": true, "reason": "short encouraging note — mention the simplification if Rule 3 applies"}
or
{"valid": false, "reason": "one short sentence explaining why it does not work"}`;

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
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }],
      }),
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
    console.error('mark-word-order error:', e);
    return res.status(200).json({ valid: null, reason: '' });
  }
}
