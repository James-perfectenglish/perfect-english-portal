// api/mark-free.js
// Consolidated: sentence (WOTD/Wordle) | word_order | correction
// Pass { type: 'sentence' | 'word_order' | 'correction', ...fields } in body

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { type } = req.body;
  if (type === 'word_order') return handleWordOrder(req, res);
  if (type === 'correction') return handleCorrection(req, res);
  return handleSentence(req, res);
}

// ── SENTENCE (WOTD + Wordle) ──────────────────────────────────────────────────
async function handleSentence(req, res) {
  const { word, partOfSpeech, definition, studentSentence, sentence, language } = req.body

  // Wordle mode: called with { word, sentence, language }
  // WOTD mode:   called with { word, partOfSpeech, definition, studentSentence, language }
  const isWordle    = !definition
  const thesentence = isWordle ? sentence : studentSentence
  const isSpanish   = language === 'es'

  if (!word || !thesentence) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  let prompt

  if (isWordle) {
    prompt = isSpanish
      ? `Eres un profesor de español entusiasta. Un estudiante acaba de jugar al Wordle en español y encontró la palabra "${word}". Sin saber necesariamente lo que significa, ha escrito esta frase: "${thesentence}".

Tu tarea:
1. Decide si la frase usa "${word}" de forma correcta o al menos plausible dado su significado real.
2. Responde de forma cálida y personal, como un profesor que conoce al estudiante.
3. SIEMPRE incluye una definición breve y natural de "${word}" en tu respuesta, tanto si la frase es correcta como si no — esto es parte del aprendizaje.
4. Si la frase es incorrecta pero creativa, reconócelo con humor antes de corregir.
5. Sé generoso/a — premia el esfuerzo y la creatividad.

Responde SOLO con JSON: {"valid": true o false, "reason": "tu feedback cálido de 1-2 frases en español, incluyendo la definición de la palabra"}` 

      : `You are an enthusiastic English teacher. A student just played Wordle and found the word "${word}". Without necessarily knowing what it means, they wrote this sentence: "${thesentence}".

Your job:
1. Decide if the sentence uses "${word}" correctly or at least plausibly given its real meaning.
2. Respond warmly and personally, like a teacher who knows the student.
3. ALWAYS include a brief, natural definition of "${word}" in your response, whether the sentence is right or wrong — this is the learning moment.
4. If the sentence is wrong but creative, acknowledge it with warmth before correcting.
5. Be generous — reward effort and creativity.

Examples of the tone to aim for:
- "Spot on! 'Smile' means a happy facial expression — and you used it perfectly in a natural context."
- "Nice try! 'Crisp' actually means fresh and cool (like a crisp autumn morning) — so 'the crisp bread' works, well done!"
- "Almost! 'Blunt' means direct or not sharp — your sentence is close but try thinking of it as the opposite of sharp."

Reply ONLY with JSON: {"valid": true or false, "reason": "your warm 1-2 sentence feedback in English, including the word's meaning"}`

  } else {
    prompt = isSpanish
      ? `Eres un profesor de español corrigiendo el ejercicio de "Palabra del día" de un estudiante.

Palabra: "${word}" (${partOfSpeech})
Definición: "${definition}"
Frase del estudiante: "${thesentence}"

El estudiante debe escribir una frase en ESPAÑOL usando esta palabra de forma que demuestre que entiende su significado.

Evalúa: ¿La frase está en español? ¿Es gramaticalmente correcta? ¿Usa la palabra de forma apropiada?

Sé cálido/a y alentador/a — como un buen profesor. Los errores menores de puntuación están bien. Acepta frases creativas o divertidas si usan la palabra correctamente.

Responde SOLO con un objeto JSON:
{"valid": true, "feedback": "una frase cálida y alentadora explicando por qué funciona bien"}
o
{"valid": false, "feedback": "una frase amable explicando el problema y cómo mejorarla"}`

      : `You are an English teacher marking a student's Word of the Day exercise.

Word: "${word}" (${partOfSpeech})
Definition: "${definition}"
Student's sentence: "${thesentence}"

The student must write a sentence that correctly uses this word in a way that demonstrates they understand its meaning.

Assess: Is the sentence grammatically correct? Does it use the word appropriately and in a way consistent with the definition?

Be warm and encouraging — like a good teacher who wants the student to succeed. Minor punctuation issues are fine. Accept creative, humorous, or playful sentences if the word is used correctly. Only reject if the word is genuinely misused or misunderstood.

Reply ONLY with a JSON object:
{"valid": true, "feedback": "one warm, encouraging sentence explaining why it works well"}
or
{"valid": false, "feedback": "one kind sentence explaining the issue and how to improve"}`
  }

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

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text())
      return res.status(502).json({ error: 'AI service error', valid: null })
    }

    const data = await response.json()
    const text = data.content?.find(b => b.type === 'text')?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    // Normalise: WOTD uses 'feedback', Wordle uses 'reason' — return both so callers work either way
    return res.status(200).json({
      valid:    result.valid,
      feedback: result.feedback || result.reason || '',
      reason:   result.reason   || result.feedback || '',
    })

  } catch (e) {
    console.error('mark-sentence error:', e)
    const fallback = isSpanish ? '¡Buen intento!' : 'Good effort!'
    return res.status(200).json({ valid: true, feedback: fallback, reason: fallback })
  }
}

// ── WORD ORDER ───────────────────────────────────────────────────────────────
async function handleWordOrder(req, res) {
  const { correctAnswer, studentAnswer, language = 'en' } = req.body;
  if (!correctAnswer || !studentAnswer)
    return res.status(400).json({ error: 'Missing required fields' });
  const isSpanish = language === 'es';
  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de construcción de frases en español.

Respuesta modelo: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

El alumno ha ordenado palabras para construir una frase. ¿Es gramaticalmente correcta y tiene el mismo significado, aunque el orden sea diferente?
Acepta variaciones válidas en el orden de palabras siempre que la frase sea correcta en español y el significado sea el mismo.
Responde NO si es incorrecta gramaticalmente, cambia el significado, o está incompleta.

JSON:
{"valid": true, "reason": "una frase corta"}
o
{"valid": false, "reason": "una frase corta"}`
    : `You are marking a sentence building exercise for adult language learners.

Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

RULE 1 — Accept grammatically correct answers even if some words are missing.
RULE 2 — Accept valid word order variations (adverb placement, time phrases etc).
RULE 3 — If grammatically correct but simplified, mark valid and note what was omitted.
Example: model has "on time" but student omits it → valid=true, reason="Correct! Note: 'on time' was omitted — the full sentence specifies the deadline."

Mark INVALID only if grammatically wrong, unnatural, or changes the core meaning.

JSON:
{"valid": true, "reason": "short encouraging note"}
or
{"valid": false, "reason": "one short sentence"}`;
  return callAI(prompt, 120, res, 'mark-free.word_order');
}

// ── ERROR CORRECTION ──────────────────────────────────────────────────────────
async function handleCorrection(req, res) {
  const { originalSentence, errorWord, studentReplacement, correctAnswerSentence, language = 'en', level = 'B1' } = req.body;
  if (!originalSentence || !errorWord || !studentReplacement || !correctAnswerSentence)
    return res.status(400).json({ error: 'Missing required fields' });
  const isSpanish = language === 'es';
  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de corrección de errores en español.

Frase original (con un error): "${originalSentence}"
La palabra con error es: "${errorWord}"
El alumno la ha sustituido por: "${studentReplacement}"
La respuesta correcta del modelo es: "${correctAnswerSentence}"

Decide: ¿es la sustitución del alumno gramaticalmente correcta Y corrige el error?
Responde SÍ sólo si la palabra del alumno realmente funciona como corrección válida, aunque sea diferente al modelo.
Responde NO si es gramaticalmente incorrecta, cambia el significado de manera inapropiada, o no corrige el error.

JSON:
{"valid": true, "reason": "una frase corta"}
o
{"valid": false, "reason": "una frase corta"}`
    : `You are marking an English error correction exercise for an adult learner at level ${level}.

Original sentence (contains one error): "${originalSentence}"
Error word: "${errorWord}"
Student replaced it with: "${studentReplacement}"
Model answer: "${correctAnswerSentence}"

Is the student's replacement grammatically correct AND does it fix the error?
Answer YES if it genuinely works as a valid correction, even if different from the model answer.
Answer NO if grammatically wrong, changes the meaning inappropriately, or doesn't fix the error.

FEEDBACK LENGTH by level:
- A1/A2: max 1 sentence, simple words, no grammar terminology.
- B1/B2: 1-2 sentences, brief reason.
- C1/C2: up to 3 sentences, may include grammar terms.

JSON:
{"valid": true, "reason": "short encouraging sentence"}
or
{"valid": false, "reason": "short explanation at the right level"}`;
  return callAI(prompt, 150, res, 'mark-free.correction');
}

// ── SHARED AI CALLER ─────────────────────────────────────────────────────────
async function callAI(prompt, maxTokens, res, label) {
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
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) {
      console.error(`${label} Anthropic error:`, await response.text());
      return res.status(502).json({ error: 'AI service error', valid: null });
    }
    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    // Normalise feedback/reason fields for sentence handler callers
    return res.status(200).json({
      valid: result.valid,
      feedback: result.feedback || result.reason || '',
      reason: result.reason || result.feedback || '',
    });
  } catch (e) {
    console.error(`${label} error:`, e);
    return res.status(200).json({ valid: null, reason: '', feedback: '' });
  }
}
