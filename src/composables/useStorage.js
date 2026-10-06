// Persistenz in localStorage. Der laufende Timer muss ein Neuladen und das Schließen
// der App überleben – die Restzeit wird immer aus `endsAt` neu berechnet, nie mitgezählt.

const TIMER_KEY = 'waesche-tool.v1'
const ADJUST_KEY = 'waesche-tool.adjust.v2'
const ADJUST_KEY_V1 = 'waesche-tool.adjust.v1'
const SETTINGS_KEY = 'waesche-tool.settings.v1'
const CARE_KEY = 'waesche-tool.care.v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Privater Modus o. Ä. – dann läuft die App eben ohne Persistenz weiter.
  }
}

/** { machineId, programId, delayHours, minutes, startedAt, startsAt, endsAt, … } oder null */
export function loadTimer() {
  const t = read(TIMER_KEY, null)
  if (!t || typeof t.endsAt !== 'number') return null
  return t
}

export function saveTimer(timer) {
  write(TIMER_KEY, timer)
}

export function clearTimer() {
  write(TIMER_KEY, null)
}

/** { [machineId]: { [programId]: minutenDelta } } */
export function loadAdjustments() {
  const a = read(ADJUST_KEY, null)
  if (a && typeof a === 'object') return a
  // v1 kannte nur ein Gerät – dessen Korrekturen gehören zur HTW510C.
  const v1 = read(ADJUST_KEY_V1, null)
  return v1 && typeof v1 === 'object' ? { 'hanseatic-htw510c': v1 } : {}
}

export function saveAdjustments(adjustments) {
  write(ADJUST_KEY, adjustments)
}

/** { keepAwake: boolean, machineId: string|null, lastProgramId: string|null } */
export function loadSettings() {
  const s = read(SETTINGS_KEY, {})
  return {
    keepAwake: false,
    machineId: null,
    lastProgramId: null,
    ...(s && typeof s === 'object' ? s : {}),
  }
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings)
}

/**
 * Entkalkungs-Buchhaltung:
 * { washes, lastDescaledAt, countingSince, threshold, snooze: { washes, until } | null }
 */
export function loadCare(defaults) {
  const c = read(CARE_KEY, null)
  return { ...defaults, ...(c && typeof c === 'object' ? c : {}) }
}

export function saveCare(care) {
  write(CARE_KEY, care)
}
