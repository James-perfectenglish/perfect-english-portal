// api/mark-pronunciation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { target, spoken, language = 'en' } = req.body
  if (!target || !spoken) return res.status(400).json({ error: 'Missing fields' })

  const isSpanish = language === 'es'

  const prompt = isSpanish
    ? `Eres un profesor de español dando feedback de pronunciación a un estudiante anglohablante.

Frase objetivo: "${target}"
Lo que captó el reconocimiento de voz: "${spoken}"

El reconocimiento de voz comete errores, pero úsalo como guía. Tu trabajo es evaluar si el estudiante pronunció la frase de forma comprensible y natural para un hispanohablante nativo.

Evalúa:
- ¿Están presentes las palabras clave en el orden correcto?
- ¿La pronunciación suena natural en español o muy inglesa? (vocales, acento de palabras, ritmo)
- Señala UN aspecto específico a mejorar: vocales abiertas, la R vibrante, la entonación, etc.
- Si suena comprensible aunque con acento inglés: válido pero con feedback útil
- Si el acento es tan fuerte que un nativo tendría dificultad: marca como incorrecto con guía clara

Sé alentador pero honesto — el objetivo es mejorar de verdad.
Responde en español. Máximo 2-3 frases.

Responde SÓLO con un objeto JSON:
{"valid": true, "feedback": "tu feedback"}  — comprensible, buen intento
{"valid": false, "feedback": "tu feedback"} — necesita trabajo significativo
{"valid": null, "feedback": "tu feedback"}  — no se pudo evaluar`
    : `You are an English pronunciation coach giving feedback to a language learner.

Target phrase: "${target}"
What the speech recognition captured: "${spoken}"

IMPORTANT CONTEXT: You are receiving output from a speech recognition API, not a perfect transcript. Speech recognition makes mistakes, especially with connected speech and non-native accents. Use the transcript as a guide, not a perfect record.

Your job:
- Check whether the key words from the target phrase are present in what was captured
- If yes, assess the likely pronunciation quality: does it sound natural to a native English speaker, or is the accent very strong?
- If the student's accent is comprehensible but not native-sounding, mark as valid and give specific feedback on one thing to improve (word stress, a specific vowel sound, connected speech, rhythm)
- If the accent is so strong that a native speaker would struggle to understand, mark as invalid with clear, kind guidance
- Speech recognition errors can disguise good pronunciation — be generous with borderline cases
- Keep it to 2-3 sentences. Be encouraging but honest.

Reply ONLY with a JSON object:
{"valid": true, "feedback": "your feedback"}  — comprehensible, good attempt
{"valid": false, "feedback": "your feedback"} — needs significant work
{"valid": null, "feedback": "your feedback"}  — completely unclear or wrong words`

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
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('Anthropic error:', await response.text())
      return res.status(502).json({ valid: null, feedback: isSpanish ? 'No se pudo analizar tu grabación. Inténtalo de nuevo.' : 'Could not analyse your recording. Please try again.' })
    }

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    return res.status(200).json(result)
  } catch (e) {
    console.error('mark-pronunciation error:', e)
    return res.status(200).json({ valid: null, feedback: isSpanish ? 'No se pudo analizar tu grabación. Inténtalo de nuevo.' : 'Could not analyse your recording. Please try again.' })
  }
}