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
    : `You are marking an English gap-fill exercise for adult language learners. There are often multiple correct answers.

Sentence (with ___ for the gap): "${question}"
Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Decide whether the student's answer works in the gap. Follow these rules:

RULE 1 — Be generous. Mark valid if the answer is grammatically correct and makes sense in the sentence. Synonyms, near-synonyms, and paraphrases are fine.
Examples: model="going over" → also accept "reviewing", "looking at", "checking", "examining" etc.

RULE 2 — Idiom variants are also valid. If the student uses a different but equally established idiom that fits the sentence, mark it valid.
Examples: model="defied the odds" → also accept "beat the odds", "overcame the odds", "bucked the odds" (all standard idioms meaning the same thing).

RULE 3 — Fixed expressions: if the model answer is a fixed/idiomatic expression where the exact wording is conventional (e.g. "beyond their control", "by and large", "on the whole", "in the long run"), and the student writes something grammatically plausible but not the fixed phrase (e.g. "beyond their power"), still mark it VALID but include a note about the fixed phrase.
Example: model="beyond their control", student="beyond their power" → valid=true, reason="Good — you get the meaning! Note that the fixed phrase is 'beyond their control'."

Mark it INVALID only if it is clearly grammatically wrong, makes no sense, or is obviously the wrong register (e.g. slang in a formal sentence).

FEEDBACK: Be encouraging. Keep feedback concise but as detailed as the complexity of the answer warrants.

Reply with exactly one JSON object and nothing else:
{"valid": true, "reason": "encouraging note — mention the fixed phrase if Rule 3 applies"}
or
{"valid": false, "reason": "short explanation of why it does not work"}`;

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