// Prüft alle Geräteprofile in src/machines/ auf Vollständigkeit und Plausibilität.
//
//   npm run check
//
// Läuft auch in der CI, damit ein neues Modell nicht erst in der App auffällt.

import { readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'machines')
const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/

const errors = []
const seen = new Set()

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const isWholeNumber = (v) => Number.isInteger(v) && v >= 0

function check(file, machine) {
  const fail = (msg) => errors.push(`${file}: ${msg}`)

  if (!machine || typeof machine !== 'object') return fail('kein `export default { … }`')

  if (machine.id !== basename(file, '.js')) fail(`id "${machine.id}" muss dem Dateinamen entsprechen`)
  if (seen.has(machine.id)) fail(`id "${machine.id}" ist doppelt`)
  seen.add(machine.id)

  for (const key of ['brand', 'model', 'description', 'source']) {
    if (!isText(machine[key])) fail(`\`${key}\` fehlt`)
  }
  if (machine.timingNote !== undefined && !isText(machine.timingNote)) {
    fail('`timingNote` muss Text sein')
  }

  const programs = machine.programs
  if (!Array.isArray(programs) || programs.length === 0) {
    fail('`programs` fehlt oder ist leer')
  } else {
    const ids = new Set()
    programs.forEach((p, i) => {
      const where = `programs[${i}]`
      if (!isText(p?.id) || !ID_PATTERN.test(p.id)) fail(`${where}: \`id\` fehlt oder ist ungültig`)
      else if (ids.has(p.id)) fail(`${where}: id "${p.id}" ist doppelt`)
      ids.add(p?.id)
      if (!isText(p?.name)) fail(`${where}: \`name\` fehlt`)
      if (!Number.isInteger(p?.minutes) || p.minutes <= 0 || p.minutes > 24 * 60) {
        fail(`${where}: \`minutes\` muss eine ganze Zahl zwischen 1 und 1440 sein`)
      }
      if (p?.note !== undefined && !isText(p.note)) fail(`${where}: \`note\` muss Text sein`)
      if (p?.wash !== undefined && typeof p.wash !== 'boolean') {
        fail(`${where}: \`wash\` muss true oder false sein`)
      }
    })
  }

  const delay = machine.delay
  if (!delay || !['start', 'end'].includes(delay.mode)) {
    fail('`delay.mode` muss "start" oder "end" sein')
  }
  const hours = delay?.hours
  if (!Array.isArray(hours) || !hours.every(isWholeNumber)) {
    fail('`delay.hours` muss eine Liste ganzer Stunden sein')
  } else {
    if (hours[0] !== 0) fail('`delay.hours` muss mit 0 (= sofort) beginnen')
    if (hours.some((h, i) => i > 0 && h <= hours[i - 1])) fail('`delay.hours` muss aufsteigend sein')
  }

  const descale = machine.descale
  if (descale !== undefined) {
    if (!programs?.some?.((p) => p.id === descale?.programId)) {
      fail(`\`descale.programId\` "${descale?.programId}" gibt es nicht in \`programs\``)
    }
    if (descale?.temperature !== undefined && !isText(descale.temperature)) {
      fail('`descale.temperature` muss Text sein')
    }
    if (descale?.afterwards !== undefined && !(Array.isArray(descale.afterwards) && descale.afterwards.every(isText))) {
      fail('`descale.afterwards` muss eine Liste von Texten sein')
    }
  }
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.js') && f !== 'index.js')

for (const file of files) {
  try {
    const mod = await import(pathToFileURL(join(DIR, file)).href)
    check(file, mod.default)
  } catch (error) {
    errors.push(`${file}: lässt sich nicht laden – ${error.message}`)
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'))
  process.exit(1)
}
console.log(`✓ ${files.length} Geräteprofil${files.length === 1 ? '' : 'e'} in Ordnung`)
