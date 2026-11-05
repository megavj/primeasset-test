/* 프라임에셋 프리미엄 서비스워커(MAIN-V3-04, PWA). 정적 자산(css·js·글꼴·그림·manifest)만 네트워크 우선으로 받아 두고, 네트워크가 안 될 때만 저장본을 준다.
   캐시 금지: HTML 문서(모든 페이지), 다른 출처(Supabase 등 API), /product/ 아래 전부(질문 요청 포함), JSON 자료 파일. GET 이 아닌 요청은 손대지 않는다.
   VERSION 을 바꾸면 activate 때 옛 캐시를 전부 지운다. 추적·식별자 없음.
   FUNC-FIX B1(v3): 오프라인 안내 /offline.html 한 장만 설치 때 저장 → 페이지 이동·새로고침(navigate)이 네트워크 오류로 실패할 때만 그 자리에 보여 줌.
     페이지 HTML 은 여전히 저장하지 않음(항상 네트워크, 탐색 미리 받기(navigation preload)로 서비스워커 때문에 늦어지지 않게). /product/ 는 그대로 통과. */
// FIX-V2: 오프라인 화면의 개선된 보조 글자 대비를 기존 설치 사용자에게도 갱신. 캐시 정책은 유지.
var VERSION = 'pa-static-v10-gt4';
var OFFLINE_URL = '/offline.html';
var STATIC = /\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|webmanifest)$/i;

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () {
    if (self.registration.navigationPreload) return self.registration.navigationPreload.enable();
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;                 // Supabase·외부: 그대로 통과
  if (url.pathname.indexOf('/product/') === 0) return;              // /product/ 전부 통과(캐시 금지)
  if (req.mode === 'navigate') {                                    // 페이지 이동: 항상 네트워크, 실패할 때만 오프라인 안내(HTML 저장 안 함)
    event.respondWith(Promise.resolve(event.preloadResponse).then(function (pre) {
      return pre || fetch(req);
    }).catch(function () {
      return caches.match(OFFLINE_URL, { cacheName: VERSION }).then(function (hit) { return hit || Response.error(); });
    }));
    return;
  }
  if (req.destination === 'document') return;                      // 그 밖의 문서(iframe 등) 통과(캐시 금지)
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
