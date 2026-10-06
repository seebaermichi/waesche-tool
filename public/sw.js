// Service Worker: zeigt die Push-Benachrichtigung an und hält die App offline lauffähig.
// Bewusst plain JS – die Datei wird von Vite nicht gebündelt, sondern 1:1 kopiert.

// Der Build setzt hier die Versionsnummer aus package.json ein. Dadurch ändert sich sw.js mit
// jedem Release, der Browser installiert den neuen Service Worker und lädt die App neu.
const VERSION = '__APP_VERSION__'
const CACHE = `waesche-${VERSION}`
const SHELL = ['/', '/index.html', '/icon-192.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const outdated = (await caches.keys()).filter((key) => key !== CACHE)
      await Promise.all(outdated.map((key) => caches.delete(key)))
      await self.clients.claim()

      // Update statt Erstinstallation: offene Fenster zeigen noch die alte Version – einmal
      // neu laden. Der Timer überlebt das, er steht in localStorage.
      if (outdated.length === 0) return
      const windows = await self.clients.matchAll({ type: 'window' })
      await Promise.all(windows.map((client) => client.navigate?.(client.url).catch(() => {})))
    })(),
  )
})

// Network-first für die Seite selbst, damit Updates sofort ankommen; der Cache ist nur das
// Netz-weg-Fallback. API-Aufrufe werden nie gecacht.
//
// `cache: 'no-cache'` zwingt den Browser, beim Server nachzufragen (dank ETag meist nur ein
// kurzes 304). Ohne das liefert Safari eine Seite ohne Cache-Control-Header tagelang aus dem
// HTTP-Cache – so blieb nach einem Upload die alte Version stehen.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match('/index.html'))),
  )
})

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      // Ohne Payload trotzdem etwas Sinnvolles anzeigen – ein stummer Push wäre auf iOS
      // ohnehin nicht erlaubt.
      let data = {}
      try {
        if (event.data) data = event.data.json()
      } catch {
        // Unlesbarer Inhalt: dann eben die allgemeine Meldung unten.
      }

      const titel = data.title ?? 'Wäsche ist fertig'

      try {
        await self.registration.showNotification(titel, {
          body: data.body ?? 'Das Programm ist durchgelaufen.',
          icon: '/icon-192.png',
          tag: 'waesche',
          data: { url: data.url ?? '/' },
        })
      } catch {
        // Lieber eine karge Benachrichtigung als gar keine: Stolpert der Browser über eine
        // Option, bliebe man sonst ohne jeden Hinweis. Genau das ist auf iOS passiert,
        // solange hier noch "renotify" stand.
        await self.registration.showNotification(titel)
      }
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
