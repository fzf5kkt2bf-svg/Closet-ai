const CACHE = 'meu-closet-shell-v2';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/icon-192.png', '/icon-512.png'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('meu-closet-shell-') && key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET' || new URL(request.url).origin!==self.location.origin) return;
  const url=new URL(request.url);
  if(url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon-')) {
    event.respondWith(caches.match(request).then(cached=>cached || fetch(request).then(response=>{
      if(response.ok) {const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    })));
    return;
  }
  if(request.mode==='navigate') {
    event.respondWith(fetch(request).then(response=>{
      if(response.ok && response.type==='basic') {const copy=response.clone();void caches.open(CACHE).then(cache=>cache.put('/',copy));}
      return response;
    }).catch(()=>caches.match('/')));
  }
});
