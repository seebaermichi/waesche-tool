// Persistenz in localStorage. Der laufende Timer muss ein Neuladen und das Schließen
// der App überleben – die Restzeit wird immer aus `endsAt` neu berechnet, nie mitgezählt.

const TIMER_KEY = 'waesche-tool.v1'
const SETTINGS_KEY = 'waesche-tool.settings.v1'
const APPLIANCES_KEY = 'waesche-tool.appliances.v1'

// Bis 1.1.0 gab es nur ein Gerät mit gemeinsamem Feintuning und Entkalkungsstand. Diese
// Schlüssel werden nur noch einmalig gelesen und in die erste eigene Maschine übernommen.
const LEGACY_ADJUST_V1 = 'waesche-tool.adjust.v1'
const LEGACY_ADJUST_V2 = 'waesche-tool.adjust.v2'
const LEGACY_CARE = 'waesche-tool.care.v1'

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

/** { applianceId, machineId, programId, delayHours, minutes, startedAt, startsAt, endsAt, … } oder null */
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

/** { keepAwake: boolean } */
export function loadSettings() {
  const s = read(SETTINGS_KEY, {})
  return {
    keepAwake: false,
    ...(s && typeof s === 'object' ? s : {}),
  }
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings)
}

/** { activeId, list: [{ id, modelId, name, lastProgramId, adjustments, care }] } oder null */
export function loadAppliances() {
  const a = read(APPLIANCES_KEY, null)
  return a && typeof a === 'object' && Array.isArray(a.list) && a.list.length > 0 ? a : null
}

export function saveAppliances(appliances) {
  write(APPLIANCES_KEY, appliances)
}

/** Stand aus 1.0/1.1 für die Übernahme: { machineId, lastProgramId, adjustments, care } */
export function loadLegacy() {
  const settings = read(SETTINGS_KEY, {}) ?? {}
  const v2 = read(LEGACY_ADJUST_V2, null)
  const v1 = read(LEGACY_ADJUST_V1, null)
  const machineId = settings.machineId ?? 'hanseatic-htw510c'
  return {
    machineId,
    lastProgramId: settings.lastProgramId ?? null,
    // v1 kannte nur die HTW510C, v2 speicherte pro Modell.
    adjustments: (v2 && v2[machineId]) ?? (machineId === 'hanseatic-htw510c' ? v1 : null) ?? {},
    care: read(LEGACY_CARE, null),
  }
}
