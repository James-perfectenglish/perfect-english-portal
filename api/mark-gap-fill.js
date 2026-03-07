// api/mark-gap-fill.js
// Vercel serverless function — AI marking for gap fill free-text answers
// Requires ANTHROPIC_API_KEY in Vercel environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, correctAnswer, studentAnswer, language = 'en' } = req.body;

  if (!question || !correctAnswer || !studentAnswer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isSpanish = language === 'es';

  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de completar huecos en español.

Pregunta (con ___ para el hueco): "${question}"
Respuesta correcta del modelo: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

¿Es la respuesta del alumno gramaticalmente correcta y adecuada para este contexto, aunque sea diferente a la respuesta del modelo?
Responde SÍ sólo si funciona de verdad en el hueco — misma forma verbal, concordancia correcta, significado apropiado.
Responde NO si es incorrecta, tiene errores gramaticales o cambia el significado.

Responde con exactamente un objeto JSON y nada más:
{"valid": true, "reason": "una frase corta en español explicando por qué funciona"}
o
{"valid": false, "reason": "una frase corta en español explicando por qué no funciona"}`
    : `You are marking an English gap-fill exercise. There are often multiple correct answers.

Sentence (with ___ for the gap): "${question}"
Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Decide whether the student's answer works in the gap. Be GENEROUS — mark it valid if:
- it is grammatically correct
- it makes sense in the sentence (even if the meaning is slightly different from the model answer)
- it fits the register (formal/business sentences need formal answers, but synonyms and near-synonyms are fine)

Examples of what to accept: if the model answer is "going over", also accept "looking at", "reviewing", "looking over", "going through", "checking", "examining" etc.

Mark it invalid ONLY if it is clearly grammatically wrong, makes no sense at all, or is obviously the wrong register (e.g. slang in a formal sentence).
Do NOT reject an answer just because it is not the same as the model answer.

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
    console.error('mark-gap-fill error:', e);
    return res.status(200).json({ valid: null, reason: '' });
  }
}