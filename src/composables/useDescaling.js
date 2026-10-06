// Entkalkungs-Erinnerung. Bei hartem Wasser (ab ca. 14 °dH) sollte die Maschine etwa alle
// 3 Monate entkalkt werden. Weil das von der Nutzung abhängt, zählt die App die Waschgänge
// mit und erinnert nach `threshold` Wäschen – spätestens aber nach 3 Monaten, falls wenig
// gewaschen wurde. Welches Programm entkalkt, steht im Geräteprofil (`descale`).
//
// Jede eigene Waschmaschine hat ihren eigenen Stand (`appliance.care`). Die Änderungs-
// funktionen unten verändern so ein Objekt direkt; gespeichert wird in useAppliances.

import { computed } from 'vue'

export const DESCALE_INTERVAL_DAYS = 90
/** Grob 3 Wäschen pro Woche × 13 Wochen. Lässt sich in der App ändern. */
export const DEFAULT_THRESHOLD = 40
export const MIN_THRESHOLD = 10
export const MAX_THRESHOLD = 150

/** "Später" blendet die Erinnerung aus – bis 5 weitere Wäschen oder 7 Tage vergangen sind. */
const SNOOZE_WASHES = 5
const SNOOZE_DAYS = 7

const DAY_MS = 86_400_000

/** { washes, lastDescaledAt, countingSince, threshold, snooze: { washes, until } | null } */
export function newCare() {
  return {
    washes: 0,
    lastDescaledAt: null,
    // Ohne bekannte letzte Entkalkung läuft die 3-Monats-Frist ab der ersten Nutzung.
    countingSince: Date.now(),
    threshold: DEFAULT_THRESHOLD,
    snooze: null,
  }
}

// --- Änderungen -------------------------------------------------------------

export function countWash(care) {
  care.washes += 1
}

export function markDescaled(care) {
  care.washes = 0
  care.lastDescaledAt = Date.now()
  care.snooze = null
}

export function snooze(care) {
  care.snooze = {
    washes: care.washes + SNOOZE_WASHES,
    until: Date.now() + SNOOZE_DAYS * DAY_MS,
  }
}

/** Stand von Hand korrigieren, z. B. beim Einstieg mitten im Intervall. */
export function setWashes(care, value) {
  care.washes = Math.max(0, Math.round(value))
  care.snooze = null
}

export function setLastDescaledAt(care, ts) {
  care.lastDescaledAt = ts
  care.snooze = null
}

export function setThreshold(care, value) {
  care.threshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, value))
}

// --- Status -----------------------------------------------------------------

/** Abgeleiteter Status für den Stand `care` (ein computed/ref) zum Zeitpunkt `now`. */
export function useDescaling(now, care) {
  const referenceAt = computed(() => care.value.lastDescaledAt ?? care.value.countingSince)
  const dueAt = computed(() => referenceAt.value + DESCALE_INTERVAL_DAYS * DAY_MS)

  const dueByCount = computed(() => care.value.washes >= care.value.threshold)
  const dueByTime = computed(() => now.value >= dueAt.value)
  const due = computed(() => dueByCount.value || dueByTime.value)

  const snoozed = computed(() => {
    const s = care.value.snooze
    return s !== null && care.value.washes < s.washes && now.value < s.until
  })

  /** Fällig und nicht weggeklickt – dann zeigt die App die Erinnerung. */
  const remind = computed(() => due.value && !snoozed.value)

  /** Würde dieser Waschgang die Erinnerung auslösen? Für den Hinweis in der Push-Nachricht. */
  function dueAfterNextWash() {
    return care.value.washes + 1 >= care.value.threshold || dueByTime.value
  }

  return { dueAt, due, dueByCount, dueByTime, remind, dueAfterNextWash }
}
