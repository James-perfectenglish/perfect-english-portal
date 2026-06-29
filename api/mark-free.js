// api/mark-free.js
// Consolidated: sentence (WOTD/Wordle) | word_order | correction
// Pass { type: 'sentence' | 'word_order' | 'correction', ...fields } in body

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { type } = req.body;
  if (type === 'word_order') return handleWordOrder(req, res);
  if (type === 'correction') return handleCorrection(req, res);
  if (type === 'tense') return handleTense(req, res);
  return handleSentence(req, res);
}

// ── SENTENCE (WOTD + Wordle) ──────────────────────────────────────────────────
async function handleSentence(req, res) {
  const { word, partOfSpeech, definition, studentSentence, sentence, language, context,
          grammarPoint, structure, example, usage,
          phrasalVerb, meaning, separable } = req.body

  // Challenge mode: called with { word, sentence, context: 'challenge', language }
  // Wordle mode:    called with { word, sentence, language } — no definition, no context
  // WOTD mode:      called with { word, sentence | studentSentence, partOfSpeech, definition, language, context?: 'wotd' }
  // GOTD mode:      called with { word: grammarPoint, sentence, grammarPoint, structure, example, usage, context: 'gotd', language }
  const isChallenge = context === 'challenge'
  const isGotd      = context === 'gotd'
  const isPvotd     = context === 'pvotd'
  const isWotd      = !isGotd && !isPvotd && (context === 'wotd' || (!!definition && !isChallenge))
  const isWordle    = !isChallenge && !isGotd && !isPvotd && !isWotd
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

  if (isPvotd) {
    prompt = `You are marking a student's "Phrasal Verb of the Day" exercise.

Phrasal verb: "${word}"
Meaning: ${meaning}
Example of correct use: "${example}"
This phrasal verb is ${separable ? 'SEPARABLE' : 'INSEPARABLE (the verb and particle must stay together)'}.

Student's sentence: "${thesentence}"

The student must write an English sentence that uses the phrasal verb "${word}" correctly, with the meaning given above.

ASSESSMENT RULES — apply in this order:
1. Is the phrasal verb "${word}" actually used (the verb AND its particle/s), with the meaning given above? A literal or different-meaning use of the same words does NOT count. If it is missing or used with the wrong meaning → valid=false, kind brief explanation.
2. SEPARABILITY:
   - INSEPARABLE phrasal verbs must keep the verb and particle together (e.g. "look after the children", never "look the children after"). If the student splits an inseparable phrasal verb → valid=false, briefly explain it stays together.
   - SEPARABLE phrasal verbs may place a NOUN object either after the particle or between the verb and particle (e.g. "turn on the light" / "turn the light on" are both fine). BUT a PRONOUN object (it, them, him, her, me, us, you) MUST go in the middle: "turn it on", never "turn on it". A pronoun after the particle → valid=false, briefly explain the pronoun goes in the middle.
3. If the phrasal verb is used with the right meaning and separability is respected → valid=true. Warm, brief praise.
4. Minor errors elsewhere (punctuation, capitalisation, an article, a spelling typo) are NEVER grounds for rejection — still valid=true; you may note the detail very briefly.

Be generous, warm and encouraging. This is a learning exercise, not a test. Keep it to 1–2 sentences.

Reply ONLY with JSON:
{"valid": true, "feedback": "warm brief praise, optionally a small note"}
or
{"valid": false, "feedback": "kind explanation of the problem with a small nudge"}`
    return callAI(prompt, 200, res, 'mark-free.pvotd')
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
    : `You are an experienced English teacher marking a "build a sentence" exercise. The student was given a bank of word tiles and asked to "build a correct sentence" — they were NOT told which tense or structure to use, and they do not see the model answer.

Model answer (what we had in mind): "${correctAnswer}"
Student's answer: "${studentAnswer}"

GUIDING PRINCIPLE — the most important rule:
The brief was "build a CORRECT sentence". The student met it if they produced a grammatical, natural, sensible English sentence from the tiles. Because we did NOT request a specific tense, structure, or meaning, the student must NEVER be marked wrong merely for building a DIFFERENT sentence from the one we had in mind. BUT "different" must still be genuinely correct, natural English — not just word-shaped. A sentence that is unnatural, uses the wrong collocation, or is a false friend is NOT a correct sentence, and is still red.

The one thing this exercise drops compared to a translation task: we no longer reject for "meaning differs from the model". Everything else a good teacher checks — grammar, naturalness, collocation — still applies.

MARK valid=true (ACCEPT) when the sentence is correct and natural:
- Same meaning as the model → valid=true, just praise it.
- DIFFERENT but still correct and natural English (different tense, simpler, different emphasis, a genuine synonym) → valid=true with an AMBER note. Affirm it's correct, then invite the richer version as an open question.
  Example: model="The bridge is being repaired at the moment", student="The bridge was repaired" → valid=true. "That's a correct sentence! How could you build one with 'is being repaired' to say it's happening right now?"
  Example: model="keep forgetting", student="always forget" → valid=true (natural synonym).
  Example: model="brush my teeth", student="clean my teeth" → valid=true (natural).
- "one" used as an indefinite article where "a/an" is natural (e.g. "one suitcase" for "a suitcase") → valid=true, but note "a/an" is more natural. NEVER say "one" is clearer or better than "a" — it isn't. (Common Spanish-speaker slip: "uno/una".)

MARK valid=false (REJECT) when the sentence is NOT correct, natural English:
- A clear grammar error, or word order that produces unnatural/incorrect English (e.g. "awake fully" instead of "fully awake"). A different order from the model is fine ONLY if the student's order is itself natural English.
- A false friend or wrong collocation that produces unnatural English. Example: model="a day off", student="a free day" → invalid ("free day" is not natural English). This does NOT apply to genuine synonyms or grammatically-fine content-word swaps — those are amber (valid=true), not red.
- The sentence is broken or nonsensical.
Do NOT reject for a different-but-natural tense/structure, and do NOT reject for minor punctuation or capitalisation.

FEEDBACK: Plain English only — no grammar-jargon codes (never write SVO, SVOC, etc.). One or two short, warm sentences. When nudging toward a tense/structure, phrase it as a friendly "how could you…?" invitation and quote the helpful phrase, never a telling-off.

JSON:
{"valid": true, "reason": "short warm note; if it differs from the model, affirm it's correct then invite the target tense/structure as a question"}
or
{"valid": false, "reason": "one kind sentence on what's unnatural/incorrect and how to fix it"}`;
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

// ── TENSE TAGGER (production: naturalness + form, and form-vs-function at C1) ──
// Layer 2 of the Tense Tagger production check. The client runs a structural
// regex first (layer 1, also the offline fallback); this is the arbiter when
// reachable. Generous like the other prompts: cosmetic slips never fail; only a
// wrong/absent form, unnatural English, or (on form≠function items) a wrong time
// reference fails.
async function handleTense(req, res) {
  const { sentence, tenseName, isMismatch, functionTime, note, level = 'B1', language = 'en' } = req.body;
  if (!sentence || !tenseName) return res.status(400).json({ error: 'Missing required fields' });

  // Spanish track: native-English learners of Spanish. No form≠function second
  // question; feedback in English (the learner's L1) for the pretérito/imperfecto
  // contrast; tildes and other cosmetics never fail.
  if (language === 'es') {
    const promptEs = `You are marking a "Tense Tagger" production task. The learner is a native English speaker learning SPANISH (level ${level}). They recognised a Spanish tense and must now WRITE their own SPANISH sentence in it.

Student's sentence: "${sentence}"
Target tense: ${tenseName} (Spanish)

ASSESSMENT RULES — apply in order:
1. Is the sentence in Spanish, with the main verb in the ${tenseName}? Identify the conjugated verb and its tense.
   Reference: presente (hablo / come), presente continuo (estoy hablando), pretérito (hablé / comió — a completed past action), imperfecto (hablaba / comía — an ongoing or habitual past). Pretérito vs imperfecto is the key contrast: both are past, but only the ${tenseName} is accepted here. A correct verb in the WRONG past tense → valid=false, and say which tense they actually used.
2. Is it natural, grammatical Spanish? Right tense but broken or unnatural → valid=false with a gentle fix.
3. Cosmetic only — a missing or wrong accent/tilde, capitalisation, punctuation, an opening ¿ or ¡ — is NEVER grounds for rejection → valid=true; you may note it in one short clause.

Give the feedback in ENGLISH (the learner's first language) — it's clearer for the contrast. Be warm and encouraging; 1–2 short sentences.

Reply ONLY with JSON:
{"valid": true, "feedback": "warm brief praise in English, optionally a tiny note"}
or
{"valid": false, "feedback": "kind, specific reason in English and a small nudge"}`;
    return callAI(promptEs, 200, res, 'mark-free.tense.es');
  }

  const FN = { past: 'the past', present: 'the present', future: 'the future', general: 'a general, timeless truth' };
  const fnText = FN[functionTime] || functionTime;

  const functionBlock = isMismatch
    ? `THIS IS A FORM-vs-MEANING ITEM. The ${tenseName} FORM is being used to refer to ${fnText}.${note ? ` (${note})` : ''} So the student must do BOTH: use the ${tenseName} form AND have the sentence genuinely refer to ${fnText}.
   - Right form, but it clearly refers to a different time → valid=false. Be warm and name the gap, e.g. "The form is spot on, but this is talking about the present, not ${fnText} — try once more with that meaning."
   - When the time reference is plausibly ${fnText}, give the benefit of the doubt and accept.`
    : `Here the form carries its ordinary meaning, so there is no separate time-reference check — just judge the form and whether it is natural English.`;

  const prompt = `You are marking a "Tense Tagger" production task for an adult English learner at level ${level}. They have just correctly recognised a tense and must now WRITE their own sentence using it.

Student's sentence: "${sentence}"
Target tense (FORM): ${tenseName}

${functionBlock}

ASSESSMENT RULES — apply in order:
1. EXPAND CONTRACTIONS FIRST: "isn't"=is not, "aren't"=are not, "wasn't"=was not, "hasn't"=has not, "haven't"=have not, "didn't"=did not, "won't"=will not, "'ll"=will, "'ve"=have, "'re"=are, "'s"=is or has. A contraction conceals the auxiliary, it does not remove it.
2. FORM: does the verb phrase match the ${tenseName}? Negatives ("isn't being cleaned"), questions ("Has it been booked?") and contractions are full, valid uses of the form. If the form is genuinely missing or malformed → valid=false with a short, kind reason.
3. NATURALNESS: a sentence that is the right shape but unnatural English — a wrong collocation, a verb that does not work in this aspect ("I am knowing"), broken phrasing — is NOT a pass → valid=false with a gentle fix.
4. Cosmetic only — punctuation, capitalisation, a missing full stop, a typo on a non-target word — is NEVER grounds for rejection → valid=true; you may note it in one short clause.

Be warm and encouraging — this is practice, not an exam. Keep feedback to 1–2 short sentences, with no grammar-jargon codes.

Reply ONLY with JSON:
{"valid": true, "feedback": "warm brief praise, optionally a tiny note"}
or
{"valid": false, "feedback": "kind, specific reason and a small nudge"}`;

  return callAI(prompt, 200, res, 'mark-free.tense');
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
