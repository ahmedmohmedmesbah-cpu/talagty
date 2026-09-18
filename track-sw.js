const CACHE_NAME = 'talagty-app-v6';
const APP_SHELL = [
    './track.html',
    './track.css?v=delivery-review-1',
    './track.js?v=delivery-review-1',
    './supplier.html',
    './supplier.css?v=delivery-review-1',
    './supplier.js?v=delivery-review-1',
    './supplier-manifest.json',
    './style.css?v=store-cleanup-v1',
    './api-config.js'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(APP_SHELL);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name =>
            name !== CACHE_NAME && /^talagty-(customer|supplier|app)-/.test(name)
        ).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.includes('/functions/v1/') || url.pathname.includes('/api/')) return;

    event.respondWith((async () => {
        try {
            const response = await fetch(event.request, { cache: 'no-cache' });
            if (response.ok || response.type === 'opaque') {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
                if (url.pathname.endsWith('/track.html')) return caches.match('./track.html');
                if (url.pathname.endsWith('/supplier.html')) return caches.match('./supplier.html');
            }
            return Response.error();
        }
    })());
});
