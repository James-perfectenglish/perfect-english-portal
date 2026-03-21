// api/mark-dictation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { correctAnswer, studentAnswer, excerptType = 'sentence', language = 'en' } = req.body;

  if (!correctAnswer || !studentAnswer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isSpanish = language === 'es';

  const prompt = isSpanish
    ? `Estás comprobando un ejercicio de dictado en español.

Transcripción correcta: "${correctAnswer}"
Respuesta del alumno:   "${studentAnswer}"

El alumno ha escuchado el audio e intentado escribir lo que oyó.
Ignora errores de mayúsculas y puntuación.
Acepta variaciones menores de ortografía si el sonido es claramente el mismo.
Rechaza si faltan palabras importantes, se añaden palabras extra significativas o el significado cambia.

Responde SÓLO con un objeto JSON:
{"valid": true, "reason": "frase corta"}
o
{"valid": false, "reason": "frase corta"}`
    : `You are checking a dictation exercise.

Correct answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Rules:
1. Ignore differences in capitalisation and punctuation.
2. Accept minor spelling mistakes if the intended word is obvious (e.g. "recieve" for "receive").
3. The student may omit optional modifiers (intensifiers, adverbs of degree) such as "very", "quite", "heavily", "really" — as long as the core content word is present in the correct grammatical form. Example: "busy" is acceptable for "very busy". "raining" is acceptable for "raining heavily".
4. The core content word must be in the correct form. Example: "rain" is NOT acceptable for "raining heavily" — the form is wrong.
5. A modifier alone without the core word is NOT acceptable. Example: "heavily" alone is not acceptable for "raining heavily".
${excerptType === 'sentence' ? '6. For full sentences, all key words must be present. Missing a whole clause or phrase is not acceptable.' : ''}

Reply ONLY with a JSON object:
{"valid": true, "reason": "one short sentence"}
or
{"valid": false, "reason": "one short sentence"}`;

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
    console.error('mark-dictation error:', e);
    return res.status(200).json({ valid: null, reason: '' });
  }
}