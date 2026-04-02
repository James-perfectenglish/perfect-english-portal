// api/mark-gap.js
// Consolidated: gap_fill | listening | dictation
// Pass { type: 'gap_fill' | 'listening' | 'dictation', ...fields } in body

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { type } = req.body;
  if (type === 'dictation') return handleDictation(req, res);
  if (type === 'listening') return handleListening(req, res);
  return handleGapFill(req, res);
}

// ── GAP FILL ──────────────────────────────────────────────────────────────────
async function handleGapFill(req, res) {
  const { question, correctAnswer, studentAnswer, language = 'en' } = req.body;
  if (!question || !correctAnswer || !studentAnswer)
    return res.status(400).json({ error: 'Missing required fields' });
  const isSpanish = language === 'es';
  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de completar huecos en español.

Pregunta (con ___ para el hueco): "${question}"
Respuesta correcta del modelo: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

¿Es la respuesta del alumno gramaticalmente correcta y tiene sentido en el hueco, aunque sea diferente a la respuesta del modelo?
Sé generoso/a: acepta sinónimos, palabras alternativas que funcionen en el hueco, y variantes que expresen un significado similar.
Por ejemplo, si el modelo es "aunque" y el alumno escribe "pero", ambas son conjunciones que crean contraste y son gramaticalmente correctas — acéptalo.
Responde NO solo si es claramente incorrecta gramaticalmente o no tiene ningún sentido en el contexto.

Responde con exactamente un objeto JSON y nada más:
{"valid": true, "reason": "una frase corta en español explicando por qué funciona"}
o
{"valid": false, "reason": "una frase corta en español explicando por qué no funciona"}`
    : `You are an experienced English teacher marking a gap-fill exercise. There are often multiple correct answers. Your job is to mark as a good teacher would — fair, linguistically aware, and always encouraging.

Sentence (with ___ for the gap): "${question}"
Model answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

Step 1 — Look at the whole sentence structure. Ask: does the student's answer fit grammatically and naturally into the sentence as written? Consider the words around the gap, especially prepositions and collocations.

Step 2 — Apply these rules:
RULE 1 — Multiple verbs can be correct: if the student's verb is grammatically correct, natural, and doesn't change the meaning, mark it valid. Don't over-restrict to the model answer's specific verb choice. Example: model="give priority to", student="assign priority to" → valid=true (both work naturally with "to").
RULE 2 — Synonyms and vocabulary alternatives are valid if they fit the sentence naturally.
RULE 3 — British/American English variants are always valid (hire/rent, autumn/fall, etc.).
RULE 4 — Idiom and expression variants are valid if meaning is preserved.
RULE 5 — Collocations and dependent prepositions: if the student's word would require a different preposition or structure from what appears in the sentence, mark it amber (valid=true) but explain the mismatch. Example: model="impediment to", student="problem" → valid=true, reason="Good try — but 'problem' collocates with 'for', not 'to'. The natural phrase is 'an impediment to' or 'a problem for'."
RULE 6 — Fixed expressions: if the student's answer is close but the fixed expression differs, mark valid=true and note the fixed phrase.

Mark INVALID only if the answer is clearly wrong grammar, nonsensical, or changes the meaning significantly.
FEEDBACK: Warm and encouraging. Plain English — no grammar labels or jargon. Concise but informative.

Reply with exactly one JSON object:
{"valid": true, "reason": "encouraging note, note any collocation issue if relevant"}
or
{"valid": false, "reason": "kind explanation"}`;
  return callAI(prompt, 300, res, 'mark-gap.gap_fill');
}

// ── LISTENING GAP ─────────────────────────────────────────────────────────────
async function handleListening(req, res) {
  const { student_answer, correct_answer, question, transcript } = req.body;
  if (!student_answer || !correct_answer)
    return res.status(400).json({ valid: false, reason: 'Missing required fields' });
  const prompt = `You are marking a listening comprehension gap-fill for a language learner.

Transcript excerpt: "${transcript}"
Question: "${question}"
Expected answer: "${correct_answer}"
Student's answer: "${student_answer}"

Mark generously — accept if it matches closely, captures the key word/phrase, or is a reasonable partial answer showing understanding. Minor spelling errors are fine.
Reject only if clearly wrong, significant mishearing, or unrelated.

JSON only: { "valid": true/false, "reason": "brief note to the student using 'you'" }`;
  return callAI(prompt, 200, res, 'mark-gap.listening');
}

// ── DICTATION ─────────────────────────────────────────────────────────────────
async function handleDictation(req, res) {
  const { correctAnswer, studentAnswer, excerptType = 'sentence', language = 'en', acceptableAlternatives = [] } = req.body;
  if (!correctAnswer || !studentAnswer)
    return res.status(400).json({ error: 'Missing required fields' });

  // Check acceptable_alternatives first — pure code, no AI needed
  if (acceptableAlternatives && acceptableAlternatives.length > 0) {
    const norm = s => s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '');
    if (acceptableAlternatives.map(norm).includes(norm(studentAnswer))) {
      return res.status(200).json({
        valid: true,
        reason: `Good — the full answer was "${correctAnswer}" but that works!`,
      });
    }
  }

  const isSpanish = language === 'es';
  const prompt = isSpanish
    ? `Estás comprobando un ejercicio de dictado en español.

Transcripción correcta: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

Ignora mayúsculas y puntuación. Acepta errores menores de ortografía si el sonido es claramente el mismo.
Rechaza si faltan palabras importantes o el significado cambia.

SÓLO JSON: {"valid": true/false, "reason": "frase corta"}`
    : `You are checking a dictation exercise.

Correct answer: "${correctAnswer}"
Student's answer: "${studentAnswer}"

1. Ignore capitalisation and punctuation differences.
2. Accept minor spelling mistakes if the intended word is obvious.
3. The student may omit degree modifiers or attributive adjectives (e.g. "busy" for "very busy", "compromise" for "sensible compromise") as long as the core word is present in the correct form. Note the full phrase in your reason.
4. The core word must be in the correct form (e.g. verb tense, noun form must match).
5. A modifier alone without the core word is NOT acceptable.
${excerptType === 'sentence' ? '6. For full sentences, all key words must be present — but rule 3 still applies.' : ''}

JSON only: {"valid": true/false, "reason": "one short sentence"}`;
  return callAI(prompt, 120, res, 'mark-gap.dictation');
}

// ── SHARED AI CALLER ──────────────────────────────────────────────────────────
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
    return res.status(200).json(JSON.parse(clean));
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error(`${label} timed out after ${TIMEOUT_MS}ms`);
      return res.status(200).json({ valid: null, reason: '' });
    }
    console.error(`${label} error:`, e);
    return res.status(200).json({ valid: null, reason: '' });
  }
}