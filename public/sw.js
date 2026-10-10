// Service worker mínimo: solo acelera estáticos propios, nunca toca /api ni HTML.
const STATIC_CACHE = 'eva-david-v1'
const STATIC_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_URLS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('push', (event) => {
  let title = 'Eva ♥ David'
  let body = 'Tienes un mensaje nuevo'
  let url = '/'
  try {
    const data = event.data ? event.data.json() : null
    if (data?.title) title = String(data.title)
    if (data?.body) body = String(data.body)
    if (data?.url) url = String(data.url)
  } catch {
    // payload no JSON: se usa el texto por defecto
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
      tag: 'eva-david-chat',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) return w.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return
  if (!STATIC_URLS.includes(url.pathname)) return
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ??
        fetch(event.request).then((res) => {
          const copy = res.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy))
          return res
        }),
    ),
  )
})
