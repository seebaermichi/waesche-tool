// Alle Geräteprofile in diesem Ordner. Ein neues Modell braucht nur eine neue Datei
// `<marke>-<modell>.js` – sie wird hier automatisch eingesammelt. Aufbau und Felder:
// siehe CONTRIBUTING.md, Prüfung: `npm run check`.

const modules = import.meta.glob('./*.js', { eager: true, import: 'default' })

export const machines = Object.entries(modules)
  .filter(([path]) => path !== './index.js')
  .map(([, machine]) => machine)
  .sort((a, b) => machineLabel(a).localeCompare(machineLabel(b), 'de'))

export function findMachine(id) {
  return machines.find((m) => m.id === id) ?? null
}

/** "hanseatic HTW510C" */
export function machineLabel(machine) {
  return `${machine.brand} ${machine.model}`
}

export function findProgram(machine, id) {
  return machine.programs.find((p) => p.id === id) ?? null
}

/** Schleudern, Spülen, Trommelreinigung usw. sind kein Waschgang und zählen nicht mit. */
export function countsAsWash(machine, programId) {
  if (programId === machine.descale?.programId) return false
  return findProgram(machine, programId)?.wash !== false
}

/** Wann startet die Maschine, wann ist sie fertig? Alle Werte in ms. */
export function schedule(machine, startedAt, delayHours, minutes) {
  const delayMs = delayHours * 3600_000
  const runMs = minutes * 60_000
  if (machine.delay.mode === 'end') {
    // Endzeitvorwahl: "fertig in X Std." – ist das Programm länger, startet sie sofort.
    const endsAt = startedAt + Math.max(delayMs, runMs)
    return { startsAt: endsAt - runMs, endsAt }
  }
  return { startsAt: startedAt + delayMs, endsAt: startedAt + delayMs + runMs }
}
