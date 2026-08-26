const CACHE_NAME = 'exam-ws-v48';
const CORE_ASSETS = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // 逐个缓存；单个资源缺失不阻断 SW 安装（避免 icon 缺失导致整页不可安装）
      return Promise.all(CORE_ASSETS.map(function(u){
        return cache.add(u).catch(function(){ /* 忽略单个失败 */ });
      }));
    }).then(function(){
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(key){ return key !== CACHE_NAME; }).map(function(key){ return caches.delete(key); }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event){
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  // 页面文档（导航 / 根路径 / index.html）采用「网络优先」，确保更新即时生效，不再被旧缓存卡住
  var isDoc = event.request.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('.html');
  if (isDoc) {
    event.respondWith(
      fetch(event.request, { cache: 'reload' }).then(function(networkResponse){
        if (networkResponse && networkResponse.status === 200) {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, clone); });
        }
        return networkResponse;
      }).catch(function(){
        return caches.match(event.request).then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }

  // 其余静态资源：缓存优先 + 后台静默更新
  event.respondWith(
    caches.match(event.request).then(function(response){
      var fetchPromise = fetch(event.request).then(function(networkResponse){
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          var clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, clone); });
        }
        return networkResponse;
      }).catch(function(){ return response; });
      return response || fetchPromise;
    })
  );
});
