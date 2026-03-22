// api/transcribe.js
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length < 500) {
      return res.status(200).json({ transcript: '' })
    }

    const language = req.query.language || 'en'

    // Detect actual content type from request header
    // iOS Safari produces audio/mp4, Chrome produces audio/webm
    const contentType = req.headers['content-type'] || 'audio/webm'
    const ext = contentType.includes('mp4') ? 'mp4'
      : contentType.includes('ogg') ? 'ogg'
      : contentType.includes('wav') ? 'wav'
      : 'webm'

    const filename = `audio.${ext}`

    // Build multipart form manually without form-data package
    const boundary = '----WhisperBoundary' + Date.now()
    const CRLF = '\r\n'

    const preamble = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      `whisper-1${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
      `${language === 'es' ? 'es' : 'en'}${CRLF}` +
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`
    )
    const epilogue = Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
    const body = Buffer.concat([preamble, buffer, epilogue])

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length.toString(),
      },
      body,
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Whisper API error:', err)
      return res.status(502).json({ transcript: null, error: err })
    }

    const data = await response.json()
    console.log('Whisper transcript:', data.text)
    return res.status(200).json({ transcript: data.text || '' })

  } catch (e) {
    console.error('transcribe error:', e)
    return res.status(500).json({ transcript: null, error: e.message })
  }
}
