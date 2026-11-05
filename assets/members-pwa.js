/* TASK29B: strict CSP member variant; presentation is in members-pwa.css. */
/* 앱처럼 설치(PWA, MAIN-V3-04): 서비스워커 등록(정적 자산만 캐시, /sw.js) + 조용한 설치 안내.
   · 설치 버튼(.g-menu-install, 메뉴 안, 기본 hidden)은 브라우저가 설치 가능하다고 알릴 때(beforeinstallprompt)만 보인다. 누르면 브라우저 설치창.
   · iOS Safari 는 설치 알림이 없으므로, 홈 화면에 추가되지 않은 iPhone/iPad 에서만 버튼을 보이고 누르면 '공유 → 홈 화면에 추가' 안내를 짧게 띄운다.
   · 이미 설치된 상태(standalone)면 아무것도 보이지 않는다. 추적·식별자 없음. */
(function () {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }
  var btn = document.querySelector('.g-menu-install');
  if (!btn) return;
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (standalone) return;
  var deferred = null;
  function toast(text) {
    var t = document.getElementById('pa-pwa-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'pa-pwa-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite');
      t.className = 'pa-pwa-toast';
      document.body.appendChild(t);
    }
    t.textContent = text; t.hidden = false;
    window.clearTimeout(t._tm); t._tm = window.setTimeout(function () { t.hidden = true; }, 4200);
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; btn.hidden = false;
  });
  window.addEventListener('appinstalled', function () { btn.hidden = true; deferred = null; });
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) btn.hidden = false;
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; btn.hidden = true; }).catch(function () {}); return; }
    toast(ios ? 'Safari 아래 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 설치됩니다.' : '브라우저 메뉴의 "앱 설치" 또는 "홈 화면에 추가"를 누르면 앱처럼 설치됩니다.');
  });
})();
