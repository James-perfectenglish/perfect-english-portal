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
    : `You are marking a sentence building exercise.

Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

The student arranged word tiles to build a sentence. Is the student's answer grammatically correct and does it convey the same meaning as the model answer, even if the word order differs?
Accept valid word order variations (e.g. adverb or time phrase placement) as long as the sentence is grammatically correct English with the same meaning.
Answer NO if the sentence is grammatically wrong, changes the meaning, or is incomplete.

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
