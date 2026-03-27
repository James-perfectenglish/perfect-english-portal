export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { word, sentence, language } = req.body
  if (!word || !sentence) return res.status(400).json({ error: 'Missing word or sentence' })

  const isSpanish = language === 'es'

  const prompt = isSpanish
    ? `Eres un profesor de español. Un estudiante acaba de jugar al Wordle en español y encontró la palabra "${word}". Ahora ha escrito esta frase: "${sentence}". ¿Usa correctamente la palabra "${word}"? Sé generoso/a — acepta frases que usen la palabra correctamente aunque tengan pequeños errores. Responde SOLO con JSON: {"valid": true o false, "reason": "feedback breve dirigido al estudiante de tú, en español, máximo 20 palabras"}`
    : `A student just played Wordle and found the word "${word}". They wrote this sentence: "${sentence}". Does it correctly use the word "${word}"? Be generous — accept sentences that use the word correctly even if not perfectly written. Reply ONLY with JSON: {"valid": true or false, "reason": "brief feedback addressed directly to the student as 'you', max 20 words"}`

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
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    return res.status(200).json(result)
  } catch (e) {
    return res.status(200).json({ valid: true, reason: isSpanish ? '¡Bien hecho!' : 'Good effort!' })
  }
}
