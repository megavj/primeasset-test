/* 프라임에셋 프리미엄 서비스워커(MAIN-V3-04, PWA). 정적 자산(css·js·글꼴·그림·manifest)만 네트워크 우선으로 받아 두고, 네트워크가 안 될 때만 저장본을 준다.
   캐시 금지: HTML 문서(모든 페이지), 다른 출처(Supabase 등 API), /product/ 아래 전부(질문 요청 포함), JSON 자료 파일. GET 이 아닌 요청은 손대지 않는다.
   VERSION 을 바꾸면 activate 때 옛 캐시를 전부 지운다. 추적·식별자 없음. */
var VERSION = 'pa-static-v2';
var STATIC = /\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|webmanifest)$/i;

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;                 // Supabase·외부: 그대로 통과
  if (url.pathname.indexOf('/product/') === 0) return;              // /product/ 전부 통과(캐시 금지)
  if (req.mode === 'navigate' || req.destination === 'document') return; // HTML 문서 통과(캐시 금지)
  if (!STATIC.test(url.pathname)) return;                           // 정적 자산 확장자만
  if (req.destination === '' && !/\.(webmanifest)$/i.test(url.pathname)) return; // 스크립트 fetch() 로 받는 자료(JSON 등)는 통과
  event.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && (res.type === 'basic' || res.type === 'default')) {
      var copy = res.clone();
      caches.open(VERSION).then(function (cache) { cache.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) { return hit || Response.error(); });
  }));
});
