/* PlanifTrek — service worker écrit à la main (aucune dépendance).
 * - Application : préchargée à l'installation, servie depuis le cache (fonctionne sans réseau).
 * - Carte : les tuiles du « pack » téléchargé (cache pt-pack) sont servies en priorité ;
 *   sinon réseau, avec un petit cache de consultation (pt-carte) en secours.
 * - Recherche de lieu et autres services : réseau uniquement, rien n'est conservé.
 * La liste des fichiers et la version sont injectées au build.
 */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const APP = `pt-app-${VERSION}`;
const PACK = 'pt-pack';
const MAP = 'pt-carte';
const MAP_HOST = 'tiles.openfreemap.org';
const MAP_RUNTIME_MAX = 400;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pt-app-') && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimMapCache() {
  const c = await caches.open(MAP);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAP_RUNTIME_MAX))) await c.delete(k);
}

async function mapRequest(request) {
  const packed = await caches.match(request, { cacheName: PACK, ignoreVary: true });
  if (packed) return packed;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      caches.open(MAP).then((c) => c.put(request, copy)).then(trimMapCache);
    }
    return res;
  } catch (err) {
    const seen = await caches.match(request, { cacheName: MAP, ignoreVary: true });
    if (seen) return seen;
    throw err;
  }
}

async function appRequest(request) {
  const cached = await caches.match(request, { cacheName: APP, ignoreVary: true });
  return cached ?? fetch(request);
}

async function navigation(request) {
  try {
    return await fetch(request);
  } catch {
    const scope = new URL(self.registration.scope);
    return (await caches.match(new URL('./', scope).href, { cacheName: APP, ignoreVary: true })) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname === MAP_HOST) return event.respondWith(mapRequest(request));
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') return event.respondWith(navigation(request));
  event.respondWith(appRequest(request));
});
