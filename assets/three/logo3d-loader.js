/* 첫 화면 3D 로고 켜기(HOME-PLUS-20261102). 조건: WebGL 됨 + 움직임 줄이기 아님 + 데이터 절약 아님 + 주소에 ?no3d 없음.
   조건을 못 채우면 아무것도 안 하고 기존 정지 WebP(assets/logo3d-hero*.webp)가 그대로 보인다.
   조건을 채우면 페이지 load 뒤 한가할 때 logo3d.min.js(three.js r187 MIT + 로고 장면, 약 621KB·gzip 160KB)를 불러온다. */
(function () {
  if (/[?&]no3d(=|&|$)/.test(location.search)) return;
  var mm = window.matchMedia;
  if (mm && mm('(prefers-reduced-motion: reduce)').matches) return;
  var con = navigator.connection; if (con && con.saveData) return;
  if (!document.querySelector('.g-hero-logo img')) return;
  var ok = false;
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    ok = !!gl;
    if (gl) { var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); }
  } catch (e) { ok = false; }
  if (!ok) return;
  var src = document.currentScript && document.currentScript.src;
  var url = src ? new URL('logo3d.min.js?v=2', src).href : 'assets/three/logo3d.min.js?v=1';
  function go() { import(url).catch(function () {}); }
  function idle() { if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 1500 }); else window.setTimeout(go, 400); }
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
})();
