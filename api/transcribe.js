// api/transcribe.js
// Receives audio blob from MediaRecorder, sends to OpenAI Whisper, returns transcript

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Read raw body as buffer
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    // Get language from query param
    const language = req.query.language || 'en'

    // Build FormData for Whisper API
    const FormData = (await import('form-data')).default
    const form = new FormData()
    form.append('file', buffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm',
    })
    form.append('model', 'whisper-1')
    form.append('language', language === 'es' ? 'es' : 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Whisper API error:', err)
      return res.status(502).json({ error: 'Transcription failed', transcript: null })
    }

    const data = await response.json()
    return res.status(200).json({ transcript: data.text || '' })
  } catch (e) {
    console.error('transcribe error:', e)
    return res.status(500).json({ error: e.message, transcript: null })
  }
}
