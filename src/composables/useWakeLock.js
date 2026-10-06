// Screen Wake Lock (Safari ab iOS 16.4). Optional: Nötig ist er nur, wenn man den Signalton
// hören will – die Benachrichtigung kommt auch bei gesperrtem Display an.

import { onBeforeUnmount, ref } from 'vue'

export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const active = ref(false)

  let sentinel = null
  let wanted = false

  async function acquire() {
    if (!supported || sentinel) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      active.value = true
      sentinel.addEventListener('release', () => {
        sentinel = null
        active.value = false
      })
    } catch {
      // Passiert z. B. bei niedrigem Akkustand – kein Grund, die App zu stören.
      active.value = false
    }
  }

  async function request() {
    wanted = true
    await acquire()
  }

  async function release() {
    wanted = false
    try {
      await sentinel?.release()
    } catch {
      // egal
    }
    sentinel = null
    active.value = false
  }

  // iOS gibt den Lock beim Wegwischen der App frei – beim Zurückkommen neu anfordern.
  function onVisibilityChange() {
    if (wanted && document.visibilityState === 'visible') acquire()
  }

  if (supported) document.addEventListener('visibilitychange', onVisibilityChange)

  onBeforeUnmount(() => {
    if (supported) document.removeEventListener('visibilitychange', onVisibilityChange)
    release()
  })

  return { supported, active, request, release }
}
