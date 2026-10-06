// Signalton per Web Audio – kein Audio-File nötig, das den Build aufbläht.
//
// iOS lässt Audio ausschließlich aus einer echten Nutzergeste heraus freischalten. Deshalb
// muss `unlock()` aus dem Click-Handler von "Start" heraus aufgerufen werden. Danach bleibt
// der Context nutzbar, solange die Seite im Vordergrund ist – nach einem Ausflug in den
// Hintergrund suspendiert iOS ihn allerdings und er muss neu geweckt werden.

import { onBeforeUnmount, ref } from 'vue'

const BEEP_HZ = 880
const BEEP_LENGTH = 0.2
const BEEPS_PER_BURST = 3
const BURST_INTERVAL_MS = 4000

export function useAlarm() {
  const ringing = ref(false)
  /** Ist der Ton freigeschaltet und einsatzbereit? Für den Hinweis in der Oberfläche. */
  const ready = ref(false)

  let ctx = null
  let intervalId = null

  function createContext() {
    if (ctx) return ctx
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    try {
      ctx = new Ctx()
    } catch {
      return null
    }
    return ctx
  }

  /**
   * Weckt den Context. Muss awaited werden: `resume()` ist asynchron, und wer direkt danach
   * Töne einplant, plant sie in die Vergangenheit eines noch stehenden Zeitgebers.
   */
  async function wake() {
    const c = createContext()
    if (!c) return false
    if (c.state !== 'running') {
      try {
        await c.resume()
      } catch {
        // Ohne Nutzergeste lehnt iOS ab – dann bleibt es eben still.
      }
    }
    ready.value = c.state === 'running'
    return ready.value
  }

  /** Aus einer Nutzergeste heraus aufrufen. Der unhörbare Ton öffnet iOS den Context. */
  async function unlock() {
    const c = createContext()
    if (!c) return false

    try {
      const gain = c.createGain()
      gain.gain.value = 0.0001
      const osc = c.createOscillator()
      osc.connect(gain).connect(c.destination)
      osc.start()
      osc.stop(c.currentTime + 0.01)
    } catch {
      // egal – entscheidend ist das resume() unten
    }

    return wake()
  }

  async function burst() {
    if (!(await wake())) return

    // Kleiner Vorlauf, damit der erste Ton nicht auf einen bereits vergangenen
    // Zeitstempel fällt und verschluckt wird.
    const base = ctx.currentTime + 0.06

    for (let i = 0; i < BEEPS_PER_BURST; i++) {
      const start = base + i * (BEEP_LENGTH + 0.12)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = BEEP_HZ

      // Weiche Flanken, sonst knackt es hörbar.
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.35, start + 0.02)
      gain.gain.setValueAtTime(0.35, start + BEEP_LENGTH - 0.03)
      gain.gain.linearRampToValueAtTime(0, start + BEEP_LENGTH)

      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + BEEP_LENGTH)
    }
  }

  /** Einzelner Probeton – für den "Ton testen"-Knopf. */
  async function test() {
    await unlock()
    await burst()
  }

  function start() {
    if (ringing.value) return
    ringing.value = true
    burst()
    intervalId = setInterval(burst, BURST_INTERVAL_MS)
  }

  function stop() {
    ringing.value = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // Nach dem Zurückkommen aus dem Hintergrund hat iOS den Context suspendiert. Ihn hier
  // wieder zu wecken kostet nichts und rettet den Ton für den Fall, dass der Timer abläuft,
  // während die App zwar offen ist, aber niemand mehr auf den Bildschirm tippt.
  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && ctx) wake()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stop()
  })

  return { ringing, ready, unlock, start, stop, test }
}
