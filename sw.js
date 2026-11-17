const CACHE_NAME = 'school-bell-v58';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=58',
  './audio.js?v=25',
  './varna-schools.js?v=25',
  './class-calendars.js?v=58',
  './app.js?v=58',
  './Soundspace%20Sound%20Effects%20(128k).mp3',
  './images/themes/shevitsa.webp?v=58',
  './images/themes/gerb.webp?v=58',
  './images/themes/heroes.webp?v=58',
  './images/themes/tricolor.webp?v=58',
  './images/themes/cyrillic.webp?v=58',
  './images/themes/desert.webp?v=58',
  './images/themes/ocean.webp?v=58',
  './images/themes/jungle.webp?v=58',
  './images/themes/volcano.webp?v=58',
  './images/themes/snow.webp?v=58',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const swGlobal = typeof self !== 'undefined' ? self : null;

function hasNoStoreCacheControl(headers) {
  if (!headers || typeof headers.get !== 'function') return false;
  return String(headers.get('cache-control') || '').toLowerCase().includes('no-store');
}

function isAdminServerResponse(response) {
  if (!response || !response.headers) return false;
  if (typeof response.headers.has === 'function' && response.headers.has('x-schoolbell-admin')) {
    return true;
  }
  return Boolean(typeof response.headers.get === 'function' && response.headers.get('x-schoolbell-admin'));
}

function shouldSkipCaching(response) {
  return hasNoStoreCacheControl(response && response.headers) || isAdminServerResponse(response);
}

function matchesTrackedAdminPath(pathname, trackedPaths) {
  if (!pathname || !trackedPaths || trackedPaths.size === 0) return false;
  if (trackedPaths.has(pathname)) return true;
  for (const adminPath of trackedPaths) {
    if (pathname === adminPath || pathname.startsWith(adminPath + '/')) return true;
  }
  return false;
}

function isKnownAdminRequest(request, url, trackedPaths) {
  if (matchesTrackedAdminPath(url.pathname, trackedPaths)) return true;
  if (request && request.referrer) {
    try {
      const refUrl = new URL(request.referrer, url.origin);
      if (refUrl.origin === url.origin && matchesTrackedAdminPath(refUrl.pathname, trackedPaths)) {
        return true;
      }
    } catch (_) {}
  }
  return false;
}

function shouldInterceptRequest(request, origin, trackedPaths) {
  if (!request || request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== origin) return false;
  if (url.pathname.includes('/api/')) return false;
  if (request.cache === 'no-store') return false;
  if (request.headers && typeof request.headers.has === 'function' && request.headers.has('x-schoolbell-admin')) {
    return false;
  }
  if (isKnownAdminRequest(request, url, trackedPaths)) return false;
  return true;
}

function createFetchHandler(deps = {}) {
  const trackedAdminPaths = deps.trackedAdminPaths || new Set();
  const fetchFn = deps.fetch || ((req) => fetch(req));
  const cachesObj = deps.caches || (typeof caches !== 'undefined' ? caches : null);
  const ResponseCtor = deps.Response || Response;

  return function handleFetchEvent(request, origin) {
    if (!shouldInterceptRequest(request, origin, trackedAdminPaths)) {
      return null;
    }
    const url = new URL(request.url);

    return fetchFn(request)
      .then((networkResponse) => {
        if (isAdminServerResponse(networkResponse) && url.pathname && url.pathname !== '/') {
          trackedAdminPaths.add(url.pathname);
        }
        if (shouldSkipCaching(networkResponse)) {
          if (cachesObj) {
            cachesObj.open(CACHE_NAME).then((cache) => cache.delete(request)).catch(() => {});
          }
          return networkResponse;
        }
        if (networkResponse && networkResponse.status === 200 && cachesObj) {
          const responseClone = networkResponse.clone();
          cachesObj.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        if (isKnownAdminRequest(request, url, trackedAdminPaths) || !cachesObj) {
          return new ResponseCtor('', { status: 504, statusText: 'Offline' });
        }
        const cached = await cachesObj.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return cachesObj.match('./index.html');
        }
        return new ResponseCtor('', { status: 504, statusText: 'Offline' });
      });
  };
}

if (swGlobal && typeof swGlobal.addEventListener === 'function') {
  const swFetchHandler = createFetchHandler();

  swGlobal.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(ASSETS))
        .catch(() => {})
    );
    swGlobal.skipWaiting();
  });

  swGlobal.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        }));
      })
    );
    swGlobal.clients.claim();
  });

  // Network first, falling back to cache (never cache no-store / admin routes).
  swGlobal.addEventListener('fetch', (event) => {
    const responsePromise = swFetchHandler(event.request, swGlobal.location.origin);
    if (!responsePromise) return;
    event.respondWith(responsePromise);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_NAME,
    ASSETS,
    hasNoStoreCacheControl,
    isAdminServerResponse,
    shouldSkipCaching,
    isKnownAdminRequest,
    shouldInterceptRequest,
    createFetchHandler
  };
}
