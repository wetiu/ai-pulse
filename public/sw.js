var CACHE='aipulse-v1';
self.addEventListener('install',function(e){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(e){
if(e.request.method!=='GET')return;var u=new URL(e.request.url);
if(u.origin!==location.origin)return;
if(/\.(html|json|xml|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/')){
e.respondWith(fetch(e.request).then(function(r){var c=r.clone();caches.open(CACHE).then(function(cc){cc.put(e.request,c);});return r;}).catch(function(){return caches.match(e.request);}));
}});
