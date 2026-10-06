// Web Push: Der verlässliche Kanal, wenn die App zu ist oder das Display schläft.
//
// Auf iOS gilt: Benachrichtigungen gibt es nur, wenn die Seite über "Zum Home-Bildschirm"
// installiert und von dort gestartet wurde (ab iOS 16.4). In einem normalen Safari-Tab
// existiert die Notification-API gar nicht – dann zeigt die App einen Hinweis statt eines
// kaputten Buttons.

import { ref } from 'vue'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
const API_SECRET = import.meta.env.VITE_API_SECRET ?? ''

/** 'unsupported' | 'needs-install' | 'unconfigured' | 'default' | 'granted' | 'denied' */
const state = ref('unsupported')
const lastError = ref(null)

let registration = null
let subscription = null

function isStandalone() {
  return (
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  )
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS meldet sich als Mac, hat aber einen Touchscreen.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function post(action, body) {
  const response = await fetch('/api/timer.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret: API_SECRET, ...body }),
  })
  if (!response.ok) throw new Error(`${action}: HTTP ${response.status}`)
  return response.json()
}

export function usePush() {
  /** Beim App-Start: Service Worker registrieren und den aktuellen Stand ermitteln. */
  async function init() {
    if (!('serviceWorker' in navigator)) {
      state.value = 'unsupported'
      return
    }

    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    } catch (error) {
      lastError.value = String(error)
      state.value = 'unsupported'
      return
    }

    if (!('PushManager' in window) || !('Notification' in window)) {
      // Auf iOS fehlen beide APIs, solange die App nicht installiert ist.
      state.value = isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
      return
    }

    if (!VAPID_PUBLIC_KEY) {
      state.value = 'unconfigured'
      return
    }

    state.value = Notification.permission
    if (state.value === 'granted') {
      subscription = await registration.pushManager.getSubscription()
    }
  }

  /**
   * Erlaubnis holen und abonnieren. Muss aus einer Nutzergeste heraus laufen (Start-Button).
   * Gibt true zurück, wenn ein Push für diesen Timer geplant werden kann.
   */
  async function enable() {
    if (!registration || !('Notification' in window) || !VAPID_PUBLIC_KEY) return false

    try {
      if (Notification.permission === 'default') {
        state.value = await Notification.requestPermission()
      } else {
        state.value = Notification.permission
      }
      if (state.value !== 'granted') return false

      subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))
      return true
    } catch (error) {
      lastError.value = String(error)
      return false
    }
  }

  /**
   * Timer beim Backend anmelden, damit der Cronjob den Push zur Endzeit verschickt.
   * `hint` wird an den Text der Mitteilung angehängt (z. B. die Entkalkungs-Erinnerung).
   */
  async function schedule(endsAt, programName, hint = '') {
    if (!subscription) return false
    try {
      await post('schedule', {
        subscription: subscription.toJSON(),
        endsAt,
        programName,
        hint,
      })
      return true
    } catch (error) {
      lastError.value = String(error)
      return false
    }
  }

  /** Geplanten Push wieder abbestellen (Stopp-Button). */
  async function cancel() {
    if (!subscription) return
    try {
      await post('cancel', { endpoint: subscription.endpoint })
    } catch (error) {
      lastError.value = String(error)
    }
  }

  return { state, lastError, init, enable, schedule, cancel }
}
