// import-word-lists.mjs
// Step 3: Run this in Terminal: node import-word-lists.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = 'https://dyxmgicedabvmsbuvxny.supabase.co'
const SUPABASE_SERVICE_KEY = 'PASTE_YOUR_SECRET_KEY_HERE'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const BATCH = 1000

async function insertBatch(words, language) {
  const rows = words.map(w => ({ word: w, language }))
  const { error } = await supabase.from('word_lists').upsert(rows, { onConflict: 'word,language', ignoreDuplicates: true })
  if (error) console.error('Batch error:', error.message)
}

async function importLanguage(url, language, parse) {
  console.log(`\nFetching ${language} word list...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  const words = parse(text)
  console.log(`  ${words.length} words found`)

  let inserted = 0
  for (let i = 0; i < words.length; i += BATCH) {
    await insertBatch(words.slice(i, i + BATCH), language)
    inserted += Math.min(BATCH, words.length - i)
    process.stdout.write(`  ${inserted}/${words.length}\r`)
  }
  console.log(`  Done — ${words.length} words inserted`)
}

async function main() {
  console.log('Starting word list import...')

  await importLanguage(
    'https://www.freescrabbledictionary.com/sowpods/download/sowpods.txt',
    'en',
    text => text.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 3 && /^[a-z]+$/.test(w))
  )

  await importLanguage(
    'https://raw.githubusercontent.com/words/an-array-of-spanish-words/master/index.json',
    'es',
    text => {
      const all = JSON.parse(text)
      return all.filter(w => w.length >= 3 && /^[a-záéíóúñü]+$/.test(w))
    }
  )

  console.log('\nAll done! Delete this file or remove your key from it now.')
}

main().catch(console.error)
