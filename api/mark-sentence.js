// api/mark-sentence.js
// Vercel serverless function — AI marks a student's Word of the Day sentence

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { word, partOfSpeech, definition, studentSentence, language } = req.body;

  if (!word || !definition || !studentSentence) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isSpanish = language === 'es';

  const prompt = isSpanish
    ? `Eres un profesor de español corrigiendo el ejercicio de "Palabra del día" de un estudiante.

Palabra: "${word}" (${partOfSpeech})
Definición: "${definition}"
Frase del estudiante: "${studentSentence}"

El estudiante debe escribir una frase en ESPAÑOL usando esta palabra de forma que demuestre que entiende su significado.
Evalúa: ¿La frase está en español? ¿Es gramaticalmente correcta? ¿Usa la palabra de forma apropiada y coherente con la definición?
Sé alentador pero honesto. Los errores menores de puntuación están bien — céntrate en el uso correcto de la palabra.

Responde SOLO con un objeto JSON:
{"valid": true, "feedback": "una frase corta de felicitación explicando por qué funciona bien"}
o
{"valid": false, "feedback": "una frase corta explicando el problema y cómo mejorarla"}`
    : `You are an English teacher marking a student's Word of the Day exercise.

Word: "${word}" (${partOfSpeech})
Definition: "${definition}"
Student's sentence: "${studentSentence}"

The student must write a sentence that correctly uses this word in a way that demonstrates they understand its meaning.
Assess: Is the sentence grammatically correct? Does it use the word appropriately and in a way consistent with the definition?
Be encouraging but honest. Minor punctuation issues are fine — focus on correct usage of the word.

Reply ONLY with a JSON object:
{"valid": true, "feedback": "one short encouraging sentence explaining why it works well"}
or
{"valid": false, "feedback": "one short sentence explaining the problem and how to improve it"}`;

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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text());
      return res.status(502).json({ error: 'AI service error', valid: null });
    }

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);

  } catch (e) {
    console.error('mark-sentence error:', e);
    return res.status(200).json({ valid: null, feedback: '' });
  }
}