// api/mark-correction.js
// Vercel serverless function — proxies AI marking requests to Anthropic
// Add ANTHROPIC_API_KEY to your Vercel environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { originalSentence, errorWord, studentReplacement, correctAnswerSentence, language = 'en', level = 'B1' } = req.body;

  if (!originalSentence || !errorWord || !studentReplacement || !correctAnswerSentence) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isSpanish = language === 'es';

  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de corrección de errores en español.

Frase original (con un error): "${originalSentence}"
La palabra con error es: "${errorWord}"
El alumno la ha sustituido por: "${studentReplacement}"
La respuesta correcta del modelo es: "${correctAnswerSentence}"

Decide: ¿es la sustitución del alumno gramaticalmente correcta Y corrige el error de la frase original?
Responde SÍ sólo si la palabra del alumno realmente funciona como corrección válida, aunque sea diferente a la respuesta del modelo.
Responde NO si es gramaticalmente incorrecta, cambia el significado de manera inapropiada, o no corrige el error.

Responde con exactamente un objeto JSON y nada más:
{"valid": true, "reason": "una frase corta en español explicando por qué funciona"}
o
{"valid": false, "reason": "una frase corta en español explicando por qué no funciona"}`
    : `You are marking an English error correction exercise for an adult learner at level ${level}.

Original sentence (contains one error): "${originalSentence}"
The error word is: "${errorWord}"
The student replaced it with: "${studentReplacement}"
The model answer is: "${correctAnswerSentence}"

Decide: is the student's replacement grammatically correct AND does it fix the error in the original sentence?
Only answer YES if their word genuinely works as a valid correction, even if different from the model answer.
Answer NO if it is grammatically wrong, changes the meaning inappropriately, or does not fix the error.

FEEDBACK LENGTH — match the student's level:
- A1/A2: maximum 1 sentence. Simple words only. Do not explain grammar rules.
- B1/B2: 1-2 sentences. A brief reason is fine.
- C1/C2: up to 2-3 sentences. Can include grammar terminology if relevant.

Reply with exactly one JSON object and nothing else:
{"valid": true, "reason": "short encouraging sentence"}
or
{"valid": false, "reason": "short explanation at the right level"}`;

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
    console.error('mark-correction error:', e);
    return res.status(200).json({ valid: null, reason: '' });
  }
}
