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
  const { word, partOfSpeech, definition, studentSentence, sentence, language, context } = req.body

  // Challenge mode: called with { word, sentence, context: 'challenge', language }
  // Wordle mode:    called with { word, sentence, language }
  // WOTD mode:      called with { word, partOfSpeech, definition, studentSentence, language }
  const isChallenge = context === 'challenge'
  const isWordle    = !definition && !isChallenge
  const thesentence = (isWordle || isChallenge) ? sentence : studentSentence
  const isSpanish   = language === 'es'

  if (!word || !thesentence) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  let prompt

  if (isChallenge) {
    prompt = isSpanish
      ? `Eres un profesor de español corrigiendo un reto de frase. El alumno debe escribir una frase en español usando la palabra "${word}".

Frase del alumno: "${thesentence}"

Evalúa con rigor:
- ¿La frase está en español?
- ¿Es gramaticalmente correcta?
- ¿Usa "${word}" de forma apropiada y con sentido?

Acepta frases creativas o sencillas.
Si el único error es de género (el/la, un/una), márcalo como válido (valid=true) pero menciona el error con amabilidad en el feedback.
Si hay errores gramaticales más importantes (tiempo verbal incorrecto, estructura rota), márcalo como inválido.
Sé cálido/a y alentador/a — esto es un ejercicio de aprendizaje.

JSON: {"valid": true, "feedback": "feedback cálido, menciona cualquier detalle menor"} o {"valid": false, "feedback": "corrección amable y clara"}`
      : `You are an English teacher marking a sentence challenge exercise.

The student was asked to write a sentence using the word: "${word}"
Their sentence: "${thesentence}"

Mark strictly for:
1. Grammatical correctness — errors in tense, subject-verb agreement, articles, or word form = invalid
2. Appropriate use of "${word}" — the word must be used naturally and meaningfully

CRITICAL — PARTS OF SPEECH: Many English words function correctly as multiple parts of speech (e.g. "whisper", "smile", "walk", "love" are all valid as both verb and noun). Do NOT penalise a student for using a word in a different grammatical role from the one it was presented as, provided the usage is correct English. Award the mark for any valid, grammatically correct use of the word.

CRITICAL — COLLOCATIONS: Some words accept more than one preposition depending on construction. For example, "knack" works with both "for" (a knack for languages) AND "to" (there's a knack to it / a knack to swing bowling). Do not penalise a student for using a valid alternative preposition if the resulting phrase is natural English.

Accept creative or simple sentences if grammatically correct. Do NOT accept sentences with significant grammar errors — this is a learning exercise, not a game.
Be warm and encouraging even when incorrect. Keep feedback to 1-2 sentences.

Reply ONLY with JSON:
{"valid": true, "feedback": "warm praise + brief note on why it works"}
or
{"valid": false, "feedback": "kind correction — what was wrong and how to fix it"}`
    return callAI(prompt, 150, res, 'mark-free.challenge')
  }

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

IMPORTANT — PARTS OF SPEECH: Many English words are valid as multiple parts of speech (e.g. "whisper", "smile", "walk" work as both verb and noun). Do NOT penalise the student for using the word in a different grammatical role from the listed part of speech, provided the usage is correct English and shows understanding of the word's meaning.

ASSESSMENT RULES — apply in this order:
1. GREEN (valid=true, no mention of spelling): If the student misspells the target word "${word}" by just 1-2 letters but has clearly used it correctly — treat it as a pure typo, accept it fully, and do NOT mention the spelling at all. Just praise the sentence normally.
2. AMBER (valid=true, note the issue): If the student uses "${word}" correctly but the sentence has grammar errors elsewhere (wrong plurals, missing articles, wrong prepositions, capitalisation etc.) — accept it because they’ve shown they understand the word, but note the grammar issues briefly.
3. ACCEPT (valid=true, praise only): Sentence is correct and uses the word well.
4. REJECT (valid=false): The word is genuinely misused or misunderstood, OR the student has not actually used the word at all.

Minor punctuation issues are always fine. Accept creative, humorous, or playful sentences if the word is used correctly. Be warm and encouraging.

Reply ONLY with a JSON object:
{"valid": true, "feedback": "one warm, encouraging sentence — if amber, briefly note the spelling or grammar issue"}
or
{"valid": false, "feedback": "one kind sentence explaining the issue and how to improve"}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    let response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text())
      return res.status(502).json({ error: 'AI service error', valid: null, feedback: '', reason: '' })
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
    return res.status(200).json({ valid: null, feedback: '', reason: '' })
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

El alumno ha ordenado palabras para construir una frase. Acéptala si:
- Es gramaticalmente correcta en español
- Tiene el mismo significado o muy parecido a la respuesta modelo

ACEPTA aunque el alumno use vocabulario diferente pero equivalente, diferente orden de palabras, o una frase más simple pero correcta.
RECHAZA solo si hay un error gramatical claro o el significado es muy diferente.

JSON:
{"valid": true, "reason": "una frase corta alentadora"}
o
{"valid": false, "reason": "una frase corta explicando por qué"}`
    : `You are an experienced English teacher marking a sentence-building translation exercise. Mark as a good teacher would — fair, encouraging, and linguistically aware.

Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Step 1 — Is the student's sentence grammatically correct English? If not, it is invalid.
Step 2 — Does it express the same or very similar meaning to the model answer?
Step 3 — For translation exercises, check collocations: some phrases have fixed English equivalents that are different from a word-for-word translation.

ACCEPT (valid=true) if:
- Grammatically correct and same core meaning, even with different vocabulary or structure
- Example: model="keep forgetting", student="always forget" → valid (same meaning, both natural)
- Example: model="brush my teeth", student="clean my teeth" → valid (natural synonym)
- A simpler version that omits optional words but keeps the core meaning — note what was omitted

AMBER — still valid=true, but add a note if:
- The student omits an important word (e.g. "daily" from "daily routine") — accept but note it
- The student uses a word that is grammatically correct but not the natural collocation — accept but explain the more natural phrasing

REJECT (valid=false) if:
- There is a clear grammar error
- The meaning is significantly different
- The student uses a false friend or wrong collocation that changes the natural meaning. Example: model="a day off", student="a free day" → invalid ("free day" is not a natural English collocation in this context; "day off" is the fixed expression)

FEEDBACK: Plain English only — no grammar labels, no syntactic categories (never write SVOC, SVO, etc.), no jargon. One short sentence. Warm and direct.

JSON:
{"valid": true, "reason": "short encouraging note, mention model answer if vocabulary differs"}
or
{"valid": false, "reason": "one kind sentence explaining why"}`;
  return callAI(prompt, 150, res, 'mark-free.word_order');
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
Answer AMBER if the student's word is clearly a typo of the correct answer (e.g. "foir" for "for") — the intended correction is right but misspelled. Mark valid=true and note the spelling in your reason.
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
const TIMEOUT_MS = 12000;
async function callAI(prompt, maxTokens, res, label) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      console.error(`${label} Anthropic error:`, await response.text());
      return res.status(502).json({ error: 'AI service error', valid: null });
    }
    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json({
      valid: result.valid,
      feedback: result.feedback || result.reason || '',
      reason: result.reason || result.feedback || '',
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`${label} timed out after ${TIMEOUT_MS}ms`);
      return res.status(200).json({ valid: null, reason: '', feedback: '' });
    }
    console.error(`${label} error:`, e);
    return res.status(200).json({ valid: null, reason: '', feedback: '' });
  }
}
