// api/mark-pronunciation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { target, spoken, language = 'en' } = req.body
  if (!target || !spoken) return res.status(400).json({ error: 'Missing fields' })

  const isSpanish = language === 'es'

  const prompt = isSpanish
    ? `Eres un profesor de español dando feedback de pronunciación a un estudiante.

Frase objetivo: "${target}"
Lo que dijo el estudiante: "${spoken}"

Compara lo que dijo el estudiante con la frase objetivo y da feedback específico y alentador sobre su pronunciación en español.

Considera:
- ¿Usaron las palabras correctas en el orden correcto?
- ¿Hay palabras que omitieron, añadieron o pronunciaron mal?
- Señala cualquier patrón de pronunciación que valga la pena mejorar (terminaciones de palabras, sonidos vocálicos, habla conectada, acento de palabras)
- Si lo dijeron correctamente, felicítalos y sugiere un refinamiento

Reglas:
- Sé conciso — máximo 2-3 frases
- Sé específico — nombra las palabras o sonidos reales
- Sé alentador — esto es un estudiante, no un hablante nativo
- Responde en español

Responde SÓLO con un objeto JSON:
{"valid": true, "feedback": "tu feedback"}  — si lo dijeron correctamente o casi correctamente
{"valid": false, "feedback": "tu feedback"} — si hay errores significativos
{"valid": null, "feedback": "tu feedback"}  — si no fue claro o no se pudo evaluar`
    : `You are an English pronunciation coach giving feedback to a language learner.

Target phrase: "${target}"
What the student said: "${spoken}"

Compare what the student said to the target phrase and give specific, encouraging pronunciation feedback.

Consider:
- Did they produce the right words in the right order?
- Are there words they missed, added, or got wrong?
- Note any pronunciation patterns worth improving (word endings, vowel sounds, connected speech, word stress)
- If they said it correctly, praise them and suggest one refinement to aim for

Rules:
- Be concise — 2-3 sentences maximum
- Be specific — name the actual words or sounds, not vague advice
- Be encouraging — this is a learner, not a native speaker
- If what they said is close but not perfect, treat it as a good attempt and guide them forward

Reply ONLY with a JSON object:
{"valid": true, "feedback": "your feedback"}  — if they said it correctly or nearly correctly
{"valid": false, "feedback": "your feedback"} — if there are significant errors
{"valid": null, "feedback": "your feedback"}  — if it was unclear or couldn't be assessed`

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
