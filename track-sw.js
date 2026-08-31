const CACHE_NAME = 'talagty-customer-v2';
const LOCAL_ASSETS = ['./track.html', './track.css?v=manual-whatsapp-1', './track.js?v=manual-whatsapp-1', './style.css?v=customer-responsive-1', './api-config.js'];
const QR_LIBRARY = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(LOCAL_ASSETS);
        try { await cache.add(QR_LIBRARY); } catch {}
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith('talagty-customer-') && name !== CACHE_NAME).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/api/')) return;
    event.respondWith((async () => {
        const cached = await caches.match(event.request, { ignoreSearch: false });
        if (cached) return cached;
        try {
            const response = await fetch(event.request);
            if (response.ok || response.type === 'opaque') {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch {
            if (event.request.mode === 'navigate') return caches.match('./track.html');
            throw new Error('offline');
        }
    })());
});
