// api/mark-pronunciation.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { target, spoken, language = 'en' } = req.body
  if (!target || !spoken) return res.status(400).json({ error: 'Missing fields' })

  const isSpanish = language === 'es'

  const prompt = isSpanish
    ? `Eres un profesor de español dando feedback de pronunciación a un estudiante.

Frase objetivo: "${target}"
Lo que captó el reconocimiento de voz: "${spoken}"

IMPORTANTE: El reconocimiento de voz automático comete errores, especialmente con acentos. Si las palabras clave de la frase objetivo aparecen en lo que se captó (aunque haya palabras extra o errores menores), asume que el estudiante lo dijo correctamente y da feedback positivo.

Solo marca como incorrecto si faltan palabras clave importantes o el orden es completamente diferente.

Reglas:
- Sé conciso — máximo 2-3 frases
- Sé específico — nombra las palabras o sonidos reales
- Sé muy alentador — esto es un estudiante aprendiendo
- Responde en español

Responde SÓLO con un objeto JSON:
{"valid": true, "feedback": "tu feedback"}  — si las palabras clave están presentes
{"valid": false, "feedback": "tu feedback"} — solo si faltan palabras clave importantes
{"valid": null, "feedback": "tu feedback"}  — si no se pudo evaluar`
    : `You are an English pronunciation coach giving feedback to a language learner.

Target phrase: "${target}"
What the speech recognition captured: "${spoken}"

IMPORTANT CONTEXT: You are receiving output from a speech recognition API, not a perfect transcript. Speech recognition makes mistakes, especially with connected speech, accents, and longer phrases. The student may have pronounced things correctly but the API transcribed them incorrectly.

Your job:
- If the KEY WORDS from the target phrase appear in what was captured (even with extra words, slightly wrong words nearby, or minor transcription errors), treat it as a successful attempt and give positive feedback
- Only mark as incorrect if the core content words are clearly missing or the student said something completely different
- Be very generous — it is far better to encourage a correct attempt than to penalise a transcription error
- Give specific, constructive feedback on one aspect of pronunciation they can improve (stress, rhythm, a specific sound)
- Keep it to 2-3 sentences

Reply ONLY with a JSON object:
{"valid": true, "feedback": "your feedback"}  — if key words are present (be generous)
{"valid": false, "feedback": "your feedback"} — only if core words are clearly absent
{"valid": null, "feedback": "your feedback"}  — if it was completely unintelligible`

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
