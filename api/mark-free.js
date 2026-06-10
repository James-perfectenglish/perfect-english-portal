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
  const { word, partOfSpeech, definition, studentSentence, sentence, language, context,
          grammarPoint, structure, example, usage } = req.body

  // Challenge mode: called with { word, sentence, context: 'challenge', language }
  // Wordle mode:    called with { word, sentence, language } — no definition, no context
  // WOTD mode:      called with { word, sentence | studentSentence, partOfSpeech, definition, language, context?: 'wotd' }
  // GOTD mode:      called with { word: grammarPoint, sentence, grammarPoint, structure, example, usage, context: 'gotd', language }
  const isChallenge = context === 'challenge'
  const isGotd      = context === 'gotd'
  const isWotd      = !isGotd && (context === 'wotd' || (!!definition && !isChallenge))
  const isWordle    = !isChallenge && !isGotd && !isWotd
  const thesentence = sentence || studentSentence
  const isSpanish   = language === 'es'

  if (!word || !thesentence) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  let prompt

  if (isGotd) {
    prompt = isSpanish
      ? `Estás corrigiendo el ejercicio "Gramática del día" de un estudiante de español.

Punto gramatical: "${grammarPoint}"
Estructura: ${structure}
Ejemplo correcto: "${example}"
Uso: ${usage}

Frase del estudiante: "${thesentence}"

El estudiante debe escribir una frase en ESPAÑOL que use esta estructura gramatical correctamente.

REGLAS DE EVALUACIÓN — aplica en este orden:
1. ¿La frase usa claramente la estructura objetivo ("${grammarPoint}")? Si la estructura no aparece en absoluto o está claramente mal construida, marca valid=false con una explicación amable y breve.
   IMPORTANTE: Las formas negativas ("no estaba esperando", "no he estado estudiando") e interrogativas ("¿Estaba durmiendo?") SON usos válidos de la estructura objetivo. No rechaces sólo porque la forma sea negativa o interrogativa — son variaciones normales de la estructura.
2. Si la estructura está presente y correcta → valid=true. Elogia con calidez y brevedad.
3. Si la estructura está presente y correcta pero hay algún error menor en otro sitio (puntuación, tilde olvidada, género de un artículo, preposición no ideal), sigue siendo valid=true. Puedes mencionar el detalle muy brevemente, pero NO rechaces.
4. Errores de puntuación, mayúsculas, tildes sueltas o signos de apertura (¿¡) NUNCA son motivo de rechazo.

Sé generoso/a, cálido/a y alentador/a. Esto es un ejercicio de aprendizaje, no un examen. Mantente breve (1-2 frases).

Responde SÓLO con JSON:
{"valid": true, "feedback": "elogio cálido y breve, opcionalmente con una nota menor"}
o
{"valid": false, "feedback": "explicación amable de por qué la estructura no aparece o está mal, y un ejemplo pequeño si ayuda"}`
      : `You are marking a student's "Grammar of the Day" exercise.

Grammar point: "${grammarPoint}"
Structure: ${structure}
Correct example: "${example}"
Usage: ${usage}

Student's sentence: "${thesentence}"

The student must write an English sentence that uses this grammar structure correctly.

ASSESSMENT RULES — apply in this order:
1. Identify the auxiliary verb(s) and main verb form in the student's sentence. EXPAND CONTRACTIONS FIRST: "wasn't" = "was not", "weren't" = "were not", "hasn't" = "has not", "haven't" = "have not", "didn't" = "did not", "isn't" = "is not", "won't" = "will not". The contraction CONCEALS the auxiliary, it doesn't remove it.
   Then check: does the structure (auxiliary + correct verb form) match the target "${grammarPoint}"?
   Negative forms ("wasn't expecting" = was + -ing = past continuous), questions ("Was she sleeping?" = was + -ing = past continuous), and contractions ARE full uses of the target structure. Do NOT reject because the form is negative, interrogative, or contracted.
   If the structure is genuinely missing or malformed → valid=false with a kind, brief explanation.
2. If the structure is present and correctly used → valid=true. Warm, brief praise.
3. If the structure is present and correctly used but there is a minor error elsewhere (punctuation, article, spelling typo, a less-ideal preposition) → still valid=true. Mention the small detail briefly if you like, but do NOT reject.
4. Punctuation, capitalisation and minor cosmetic errors are NEVER grounds for rejection.

Be generous, warm and encouraging. This is a learning exercise, not a test. Keep it to 1–2 sentences.

Reply ONLY with JSON:
{"valid": true, "feedback": "warm brief praise, optionally a small note"}
or
{"valid": false, "feedback": "kind explanation of why the structure isn't quite there, plus a small nudge if helpful"}`
    return callAI(prompt, 200, res, 'mark-free.gotd')
  }

  if (isChallenge) {
    prompt = isSpanish
      ? `Eres un profesor de español corrigiendo un reto de frase. El alumno debe escribir una frase en español usando la palabra "${word}".

Frase del alumno: "${thesentence}"

Evalúa con rigor:
- ¿La frase está en español?
- ¿Es gramaticalmente correcta?
- ¿Usa "${word}" de forma apropiada y con sentido?

REGLA FUNDAMENTAL — puntuación y mayúsculas: La puntuación menor y las mayúsculas NUNCA son motivo de rechazo. No marques como inválido por falta de mayúscula inicial, tildes olvidadas, comas faltantes, o signos de apertura (¿¡) ausentes. Si la palabra está bien usada y el sentido es claro, marca valid=true. Puedes añadir un consejo breve al final, pero nunca rechaces sólo por puntuación.

Acepta frases creativas o sencillas.
Si el único error es de género (el/la, un/una), márcalo como válido (valid=true) pero menciona el error con amabilidad en el feedback.
Si hay errores gramaticales más importantes (tiempo verbal incorrecto, estructura rota), márcalo como inválido.
Sé cálido/a y alentador/a — esto es un ejercicio de aprendizaje.

Responde SÓLO con JSON, sin texto adicional ni marcadores de código:
{"valid": true, "feedback": "feedback cálido, menciona cualquier detalle menor"}
o
{"valid": false, "feedback": "corrección amable y clara"}`
      : `You are an English teacher marking a sentence challenge exercise.

The student was asked to write a sentence using the word: "${word}"
Their sentence: "${thesentence}"

Mark strictly for:
1. MINOR PUNCTUATION & CAPITALISATION ARE NEVER GROUNDS FOR REJECTION. Do NOT mark invalid for: missing capital "I", lowercase proper nouns or initialisms ("tv", "monday"), missing commas after introductory phrases, comma splices, missing full stops. These are cosmetic and this is a quick sentence challenge, not a writing exam. Mark valid=true; you may add one brief, friendly tip at the end of feedback if you like, but NEVER reject for punctuation alone.
2. Grammatical correctness — errors in tense, subject-verb agreement, articles, or word form = invalid
3. Appropriate use of "${word}" — the word must be used naturally and meaningfully

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
Lo más importante es que el alumno use la palabra con su SIGNIFICADO correcto. Si lo hace, marca valid=true aunque haya errores gramaticales menores en otra parte o use la palabra como otra categoría gramatical (por ejemplo, verbo en lugar de adjetivo) — sobre todo en niveles bajos, premia el uso correcto y con sentido por encima de la elegancia. Rechaza solo si la palabra está mal usada (significado equivocado) o no aparece.

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
4. REJECT (valid=false) ONLY IF the word is genuinely misused (wrong meaning) or not present at all. If the word is used with its correct meaning, mark valid=true — even if the sentence is an indirect or simple illustration. At lower levels especially, reward correct, meaningful use over elegance.
PART OF SPEECH (applies at all levels, especially A): Do NOT reject for using the word as a different part of speech from the one listed, provided the usage is correct English and shows the word's meaning. E.g. if the word of the day is the adjective "clean" and the student writes "She cleans the house", they have shown they understand what "clean" means — mark valid=true and you may briefly note the adjective form, but do not fail it.

Minor punctuation issues are always fine. Accept creative, humorous, or playful sentences if the word is used correctly. Be warm and encouraging.

Reply ONLY with a JSON object:
{"valid": true, "feedback": "one warm, encouraging sentence — if amber, briefly note the spelling or grammar issue"}
or
{"valid": false, "feedback": "one kind sentence explaining the issue and how to improve"}`
  }

  // Delegate to the shared caller so WOTD and Wordle get the same 529-retry + status passthrough as the other branches.
  return callAI(prompt, 150, res, isWordle ? 'mark-free.wordle' : 'mark-free.wotd')
}

// ── WORD ORDER ───────────────────────────────────────────────────────────────
function normaliseAnswer(str) {
  return str.toLowerCase().trim().replace(/[?!.،؟]+$/, '').replace(/\s+/g, ' ');
}

async function handleWordOrder(req, res) {
  const { correctAnswer, studentAnswer, language = 'en' } = req.body;
  if (!correctAnswer || !studentAnswer)
    return res.status(400).json({ error: 'Missing required fields' });

  // Exact match — skip AI entirely
  if (normaliseAnswer(studentAnswer) === normaliseAnswer(correctAnswer)) {
    return res.status(200).json({ valid: true, feedback: '✅ Perfect!', reason: '✅ Perfect!' });
  }
  const isSpanish = language === 'es';
  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de construcción de frases en español.

Respuesta modelo: "${correctAnswer}"
Respuesta del alumno: "${studentAnswer}"

El alumno ha ordenado palabras para construir una frase. Acéptala si:
- Es gramaticalmente correcta en español
- Tiene el mismo significado o muy parecido a la respuesta modelo

ACEPTA aunque el alumno use vocabulario diferente pero equivalente, diferente orden de palabras, o una frase más simple pero correcta.
ACEPTA CON NOTA si el alumno omite un pronombre de objeto indirecto (me, te, le, nos, os, les) que aparece en la respuesta sugerida — la frase sigue siendo correcta, solo es menos natural. Márcalo como válido pero indica brevemente qué pronombre faltaba.
RECHAZA solo si hay un error gramatical claro o el significado es muy diferente.

ITEMS QUE PRACTICAN UNA ESTRUCTURA — IMPORTANTE:
Si la respuesta modelo usa una estructura específica (inversión, oración escindida/"cleft", futuro perfecto, etc.) y la frase del alumno es gramaticalmente correcta y significa lo mismo pero NO usa esa estructura, márcala como válida (valid=true), nunca como incorrecta. Reconoce que es correcta y luego anima a usar la estructura que se practica. Una frase gramaticalmente correcta y con sentido NUNCA se marca como inválida en este ejercicio.

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
- Example: model="launch a new product", student="sell a new product" → valid=true with amber note ("launch" specifically means introduce for the first time; "sell" is grammatically natural here, just less specific)
- Example: model="The report must be finished by Friday at the latest", student="The latest the report must be finished is Friday" → valid=true with amber note (same deadline meaning, just rearranged into a cleft structure — the model phrasing is more natural)
- A simpler version that omits optional words but keeps the core meaning — note what was omitted

AMBER — still valid=true, but add a note if:
- The student omits an important word (e.g. "daily" from "daily routine") — accept but note it
- The student uses a word that is grammatically correct but not the natural collocation — accept but explain the more natural phrasing
- The student uses "one" as an indefinite article where "a" or "an" is the natural English choice (e.g. "one suitcase" instead of "a suitcase", "one taxi" instead of "a taxi") — mark valid=true but note that "a/an" is more natural. NEVER say "one" is clearer or better than "a" — it is not. This is a common error for Spanish speakers because "uno/una" can mean both.

REJECT (valid=false) if:
- There is a clear grammar error
- The meaning is significantly different
- The student uses a false friend or wrong collocation that produces unnatural English. Example: model="a day off", student="a free day" → invalid ("free day" is not natural English). This does NOT apply to natural synonyms or grammatically-fine content-word swaps — those are amber (valid=true), not red.
- The student's word order produces unnatural or incorrect English (e.g. "awake fully" instead of "fully awake"). Different order from the model is fine IF the student's order is itself natural English — but if the student's own word order is wrong, mark invalid.

FEEDBACK: Plain English only — no grammar labels, no syntactic categories (never write SVOC, SVO, etc.), no jargon. One short sentence. Warm and direct.

STRUCTURE-TARGETED ITEMS — IMPORTANT:
If the model answer uses a specific structure (inversion, cleft, future perfect, fronting, etc.) and the student's sentence is grammatically correct and means the same thing but does NOT use that structure, mark it AMBER (valid=true), never invalid. Affirm it's correct English, then nudge toward the structure being practised.
Example: model="Only after the meeting did I realise my mistake.", student="I realised my mistake after the meeting." → valid=true, reason="That's correct English! This one's practising inversion though — try starting with 'Only after…'".
A grammatically correct, meaningful sentence is NEVER marked invalid in this exercise.

JSON:
{"valid": true, "reason": "short encouraging note, mention suggested answer if vocabulary differs"}
or
{"valid": false, "reason": "one kind sentence explaining why"}`;
  return callAI(prompt, 150, res, 'mark-free.word_order');
}

// ── ERROR CORRECTION ──────────────────────────────────────────────────────────
// Levenshtein distance — for EC deterministic typo detection
function ecLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Diff originalSentence vs correctAnswerSentence to find the one differing word.
// Returns the expected replacement (lowercase), or null if not a clean single-word swap.
function findExpectedReplacement(originalSentence, correctAnswerSentence) {
  const tokenise = s => s.toLowerCase().replace(/[.,!?;:]/g, '').split(/\s+/).filter(Boolean);
  const orig = tokenise(originalSentence);
  const corr = tokenise(correctAnswerSentence);
  // Clean single-word DELETION: orig has exactly one extra token, rest identical in order.
  if (orig.length === corr.length + 1) {
    let removedAt = -1;
    for (let i = 0, j = 0; i < orig.length; i++) {
      if (orig[i] === corr[j]) { j++; }
      else if (removedAt === -1) { removedAt = i; }
      else { return null; }  // more than one mismatch -> not a clean deletion
    }
    if (removedAt !== -1) return { remove: true, word: orig[removedAt] };
    return null;
  }
  if (orig.length !== corr.length) return null;
  let diffIdx = -1;
  for (let i = 0; i < orig.length; i++) {
    if (orig[i] !== corr[i]) {
      if (diffIdx !== -1) return null;
      diffIdx = i;
    }
  }
  return diffIdx === -1 ? null : corr[diffIdx];
}

async function handleCorrection(req, res) {
  const { originalSentence, errorWord, studentReplacement, correctAnswerSentence, language = 'en', level = 'B1' } = req.body;
  if (!originalSentence || !errorWord || !studentReplacement || !correctAnswerSentence)
    return res.status(400).json({ error: 'Missing required fields' });
  const isSpanish = language === 'es';

  // Deterministic typo check — fires before AI for the easy cases.
  // Only meaningful if the student actually changed the tile.
  const studentTrimmed = studentReplacement.toLowerCase().trim();
  const errorTrimmed   = errorWord.toLowerCase().trim();
  if (studentTrimmed !== errorTrimmed) {
    const expected = findExpectedReplacement(originalSentence, correctAnswerSentence);
    // Deletion case: the fix is to remove the error word entirely (tile UI sends "-").
    if (expected && expected.remove) {
      const removedOk =
        (studentTrimmed === '-' || studentTrimmed === '') &&
        expected.word === errorTrimmed;
      if (removedOk) {
        const reason = isSpanish ? '✅ ¡Correcto!' : '✅ Correct!';
        return res.status(200).json({ valid: true, reason, feedback: reason });
      }
    }
    if (expected && !expected.remove) {
      if (studentTrimmed === expected) {
        const reason = isSpanish ? '✅ ¡Correcto!' : '✅ Correct!';
        return res.status(200).json({ valid: true, reason, feedback: reason });
      }
      const d = ecLevenshtein(studentTrimmed, expected);
      const maxLen = Math.max(studentTrimmed.length, expected.length);
      if ((d === 1 && maxLen >= 4) || (d === 2 && maxLen >= 6)) {
        const reason = isSpanish
          ? `Encontraste el error — solo un pequeño desliz de ortografía. La forma correcta es "${expected}".`
          : `Right answer — just a small typo. The correct spelling is "${expected}".`;
        return res.status(200).json({ valid: true, reason, feedback: reason });
      }
    }
  }

  const prompt = isSpanish
    ? `Estás corrigiendo un ejercicio de corrección de errores en español.

Frase original (con un error): "${originalSentence}"
La palabra con error es: "${errorWord}"
El alumno la ha sustituido por: "${studentReplacement}"
La respuesta correcta del modelo es: "${correctAnswerSentence}"

Decide: ¿es la sustitución del alumno gramaticalmente correcta Y corrige el error?
Responde SÍ sólo si la palabra del alumno realmente funciona como corrección válida, aunque sea diferente al modelo.
Responde NO si es gramaticalmente incorrecta, cambia el significado de manera inapropiada, o no corrige el error.
Si la corrección consiste en ELIMINAR la palabra con error por completo (sin sustituirla), entonces una respuesta vacía o "-" es la respuesta CORRECTA — marca valid=true.

LONGITUD DEL FEEDBACK — sé MUY breve: una sola frase corta (dos como máximo), en un solo idioma. No escribas párrafos ni expliques de más. En A1/A2 usa palabras sencillas, sin terminología gramatical.

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
Answer AMBER (valid=true) if the student has found the right error AND their replacement is a near-typo of the correct answer (1-2 characters different — e.g. "Finishec" for "finished", "finshed" for "finished"). This IS the right answer with a spelling mistake. Mark valid=true, skip the grammar explanation entirely, just confirm the correct spelling briefly. Apply this rule first before any other consideration.
Answer NO if grammatically wrong, changes the meaning inappropriately, or doesn't fix the error.
If the correction is to DELETE the error word entirely (no replacement needed), then an empty answer or "-" is the CORRECT response — mark valid=true.

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

async function fetchAnthropic(prompt, maxTokens, signal) {
  return fetch('https://api.anthropic.com/v1/messages', {
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
    signal,
  });
}

async function callAI(prompt, maxTokens, res, label) {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response = await fetchAnthropic(prompt, maxTokens, controller.signal);

    // One-shot retry on 529 overloaded — usually transient capacity at Anthropic.
    // Only retry if we have enough time budget left for backoff + another attempt + parse.
    if (response.status === 529 && (Date.now() - start) < TIMEOUT_MS - 3500) {
      const overloadBody = await response.text();
      console.warn(`${label} got 529 overloaded, retrying once. Body: ${overloadBody.slice(0, 200)}`);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
      response = await fetchAnthropic(prompt, maxTokens, controller.signal);
    }

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`${label} Anthropic error (${response.status}):`, errBody);
      // Pass 529 through so the client can show "AI is busy, try again" rather than a generic red X.
      const status = response.status === 529 ? 529 : 502;
      return res.status(status).json({ error: 'AI service error', valid: null, overloaded: response.status === 529 });
    }
    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    // Be defensive: the model occasionally wraps the JSON in prose or code fences
    // (seen more with looser Spanish prompts). Strip fences, then extract the first
    // {...} block so a conversational preamble/suffix can't break JSON.parse.
    let clean = text.replace(/```json|```/g, '').trim();
    const firstBrace = clean.indexOf('{');
    const lastBrace  = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.slice(firstBrace, lastBrace + 1);
    }
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
  } finally {
    clearTimeout(timeout);
  }
}
