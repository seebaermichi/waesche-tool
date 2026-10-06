// Anzeige-Helfer für Programme. Die Programme selbst stehen pro Gerät in src/machines/.

/** "Baumwolle" bzw. "ECO 40–60 (5 kg)" */
export function programLabel(program) {
  if (!program) return ''
  return program.note ? `${program.name} (${program.note})` : program.name
}

/** 160 → "2:40 Std." */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')} Std.`
}
