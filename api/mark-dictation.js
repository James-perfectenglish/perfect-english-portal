// api/mark-dictation.js
// Checks whether a student's dictation answer matches the correct transcript,
// allowing for natural variation in transcription (not grammar marking).

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
{"valid": true, "reason": "frase corta explicando por qué es aceptable"}
o
{"valid": false, "reason": "frase corta explicando qué falta o está mal"}`
    : `You are checking a dictation exercise.

Correct transcript: "${correctAnswer}"
Student's answer:   "${studentAnswer}"

The student listened to audio and tried to write what they heard.
Ignore capitalisation and punctuation differences.
Accept minor spelling variations if the word is clearly the same sound.
${excerptType === 'word' ? 'The student only needed to type one or two words.' : excerptType === 'phrase' ? 'The student needed to type a short phrase or clause.' : 'The student needed to type the full sentence.'}
Reject if key words are missing, significant extra words are added, or the meaning changes.

Reply ONLY with a JSON object:
{"valid": true, "reason": "one short sentence explaining why it is acceptable"}
or
{"valid": false, "reason": "one short sentence explaining what is missing or wrong"}`;

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
