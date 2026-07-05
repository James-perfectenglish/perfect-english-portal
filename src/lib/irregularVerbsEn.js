/* ============================================================
   Irregular Verbs — English content + structure (shared, pure JS)
   ------------------------------------------------------------
   For English (ESL) learners. Read by:
     • src/components/IrregularVerbsEN.jsx  (the Learn reference)
   The English counterpart to verbConjugatorEs.js. English barely
   "conjugates", so the reference is the IRREGULAR VERBS: the three
   principal parts (infinitive / past simple / past participle),
   grouped by pattern (easy → hard), plus a short forms-explainer on
   WHEN each form fires — the point being that the past participle
   never stands alone (perfect + passive), which is why "I have went"
   is wrong.

   British English throughout: got (not gotten), learnt / burnt /
   spelt, dived not dove, etc. Term is "infinitive" everywhere, never
   "base form" (matches the Tense Explainer and how James teaches).

   ⚠️ CONTENT NOTE FOR JAMES: forms double-checked and BrE-first, but
   the groupings, glosses and usage notes are yours to review, same
   status as the ES side. Notes use markdown-lite (**bold** /
   *italic*), rendered by the page.

   STRUCTURE
   FORMS[]   the three principal parts + a plain "used for" gloss.
   GROUPS[]  pattern-keyed sets. Each verb is [infinitive, past, pp]
             or [infinitive, past, pp, note]. `blurb` explains the
             pattern; optional group `note` carries a shared caveat.
   ============================================================ */

export const FORMS = [
  {
    key: 'base', label: 'Infinitive', example: 'go',
    usedFor: 'The dictionary form. Use it after *to* (*want **to go***), after modals (*will / can / should **go***), in the present tense (*I **go***), and in orders (***Go!***).',
  },
  {
    key: 'past', label: 'Past simple', example: 'went',
    usedFor: 'Finished past actions, on its own — no helper verb: *I **went** yesterday*. This is exactly why *I have **went*** is wrong: the past simple can’t follow *have*.',
  },
  {
    key: 'pp', label: 'Past participle', example: 'gone',
    usedFor: 'Never used alone — it always needs a helper. Two big jobs: the **perfect** (*have / had + **gone*** → *I have **gone***) and the **passive** (*be + **taken*** → *it was **taken***). Getting this third form right is the whole point of learning irregular verbs.',
  },
];

const GROUPS = [
  {
    id: 'no_change',
    title: 'No change',
    blurb: 'The easy ones — all three forms are identical. Nothing to learn except that they *don’t* change.',
    verbs: [
      ['cut', 'cut', 'cut'], ['put', 'put', 'put'], ['let', 'let', 'let'], ['set', 'set', 'set'],
      ['hit', 'hit', 'hit'], ['cost', 'cost', 'cost'], ['hurt', 'hurt', 'hurt'], ['shut', 'shut', 'shut'],
      ['split', 'split', 'split'], ['spread', 'spread', 'spread'], ['burst', 'burst', 'burst'],
      ['cast', 'cast', 'cast'], ['bet', 'bet', 'bet'], ['quit', 'quit', 'quit'],
      ['read', 'read', 'read', 'Spelt the same, but the past & participle are said /red/, like “red”.'],
    ],
  },
  {
    id: 'base_eq_pp',
    title: 'Infinitive = past participle',
    blurb: 'Only the middle form changes — the participle returns to the infinitive.',
    verbs: [
      ['come', 'came', 'come'], ['become', 'became', 'become'], ['run', 'ran', 'run'],
    ],
  },
  {
    id: 'ought_aught',
    title: '-ought / -aught',
    blurb: 'A set that *rhymes*: the past and the participle are identical, and all end in the same **-ought / -aught** sound. Learn the sound and the spelling follows.',
    verbs: [
      ['buy', 'bought', 'bought'], ['bring', 'brought', 'brought'], ['think', 'thought', 'thought'],
      ['fight', 'fought', 'fought'], ['seek', 'sought', 'sought'],
      ['catch', 'caught', 'caught'], ['teach', 'taught', 'taught'],
    ],
  },
  {
    id: 'past_eq_pp',
    title: 'Past = past participle',
    blurb: 'The biggest group: the past simple and the past participle are identical, so there are really only **two** forms to learn.',
    verbs: [
      ['sell', 'sold', 'sold'], ['tell', 'told', 'told'],
      ['feel', 'felt', 'felt'], ['keep', 'kept', 'kept'], ['sleep', 'slept', 'slept'], ['leave', 'left', 'left'],
      ['mean', 'meant', 'meant'], ['lose', 'lost', 'lost'], ['spend', 'spent', 'spent'], ['send', 'sent', 'sent'],
      ['build', 'built', 'built'], ['lend', 'lent', 'lent'], ['deal', 'dealt', 'dealt'],
      ['sit', 'sat', 'sat'], ['meet', 'met', 'met'], ['feed', 'fed', 'fed'], ['lead', 'led', 'led'],
      ['light', 'lit', 'lit'], ['shoot', 'shot', 'shot'],
      ['hold', 'held', 'held'], ['stand', 'stood', 'stood'], ['understand', 'understood', 'understood'],
      ['find', 'found', 'found'], ['get', 'got', 'got', 'British English: *got / got*. American English often uses *gotten* for the participle.'],
      ['win', 'won', 'won'], ['dig', 'dug', 'dug'], ['stick', 'stuck', 'stuck'],
      ['hang', 'hung', 'hung', 'For objects. To execute someone it’s regular: *hanged / hanged*.'],
      ['swing', 'swung', 'swung'], ['strike', 'struck', 'struck'],
      ['hear', 'heard', 'heard'], ['make', 'made', 'made'], ['have', 'had', 'had'],
      ['pay', 'paid', 'paid'], ['say', 'said', 'said'], ['lay', 'laid', 'laid'],
    ],
  },
  {
    id: 'brit_t',
    title: 'British -t spelling',
    blurb: 'These take a **-t** ending in British English. The regular *-ed* forms (*burned, learned…*) are also correct, and are the norm in American English.',
    verbs: [
      ['burn', 'burnt', 'burnt'], ['learn', 'learnt', 'learnt'], ['spell', 'spelt', 'spelt'],
      ['dream', 'dreamt', 'dreamt'], ['smell', 'smelt', 'smelt'],
    ],
  },
  {
    id: 'i_a_u',
    title: 'The i–a–u pattern',
    blurb: 'A satisfying set worth learning together: the vowel marches **i → a → u**.',
    verbs: [
      ['sing', 'sang', 'sung'], ['ring', 'rang', 'rung'], ['drink', 'drank', 'drunk'],
      ['swim', 'swam', 'swum'], ['begin', 'began', 'begun'], ['sink', 'sank', 'sunk'],
    ],
  },
  {
    id: 'ew_own',
    title: '-ew → -own',
    blurb: 'A tidy sub-pattern: the past ends in **-ew** and the participle in **-wn** — *know → knew → known*, *fly → flew → flown*.',
    verbs: [
      ['know', 'knew', 'known'], ['grow', 'grew', 'grown'], ['fly', 'flew', 'flown'],
      ['throw', 'threw', 'thrown'], ['blow', 'blew', 'blown'], ['draw', 'drew', 'drawn'],
    ],
  },
  {
    id: 'three_diff',
    title: 'All three different',
    blurb: 'All three forms differ — the ones to learn properly, because the participle is where most mistakes happen (*I have **gone***, not *I have **went***).',
    verbs: [
      ['go', 'went', 'gone'], ['do', 'did', 'done'], ['see', 'saw', 'seen'], ['eat', 'ate', 'eaten'],
      ['give', 'gave', 'given'], ['take', 'took', 'taken'], ['write', 'wrote', 'written'],
      ['drive', 'drove', 'driven'], ['ride', 'rode', 'ridden'], ['rise', 'rose', 'risen'],
      ['break', 'broke', 'broken'], ['speak', 'spoke', 'spoken'], ['steal', 'stole', 'stolen'],
      ['choose', 'chose', 'chosen'], ['freeze', 'froze', 'frozen'], ['wake', 'woke', 'woken'],
      ['wear', 'wore', 'worn'], ['tear', 'tore', 'torn'],
      ['show', 'showed', 'shown', 'The past is regular (*showed*); only the participle is irregular (*shown*).'],
      ['fall', 'fell', 'fallen'], ['forget', 'forgot', 'forgotten'], ['hide', 'hid', 'hidden'],
      ['bite', 'bit', 'bitten'], ['shake', 'shook', 'shaken'],
      ['beat', 'beat', 'beaten', 'The past is the same as the infinitive (*beat*); the participle is *beaten*.'],
      ['be', 'was / were', 'been', 'Special: present *am / is / are*, past *was / were*, participle *been*.'],
      ['lie', 'lay', 'lain', 'To recline. Don’t confuse it with *lay / laid / laid* (to put something down) or *lie / lied / lied* (to tell an untruth).'],
    ],
  },
];

/* ---------- derived structures + helpers ---------- */
export const GROUPS_EN = GROUPS;

export const VERB_COUNT = GROUPS.reduce((n, g) => n + g.verbs.length, 0);
