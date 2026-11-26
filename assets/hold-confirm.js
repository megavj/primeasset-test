/* TOUCH3-20261127 관리자 화면: 빨간(위험) 버튼은 0.6초 길게 눌러야 실행. 실수 클릭 방지.
   - 마우스·손가락 모두 같은 규칙. 누르는 동안 버튼 안이 왼쪽부터 채워지고, 다 차면 원래 동작(기존 확인 창 포함)이 그대로 실행된다.
   - 키보드(Enter·Space)로 누르면 기존처럼 바로 실행(기존 확인 창이 지켜 줌).
   - 실패해도 버튼은 원래대로 동작(이 파일이 없으면 예전과 같음). */
(function () {
  'use strict';
  var SEL = '.adm-button--danger', HOLD = 600;
  var timer = null, cur = null;
  function hint(b) {
    b.classList.remove('hc-nudge'); void b.offsetWidth; b.classList.add('hc-nudge');
    var t = document.getElementById('hc-hint');
    if (!t) { t = document.createElement('div'); t.id = 'hc-hint'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = '실수 방지: 버튼을 길게(0.6초) 누르면 실행됩니다.';
    var r = b.getBoundingClientRect();
    t.style.left = Math.max(8, Math.min(innerWidth - 268, r.left + r.width / 2 - 130)) + 'px';
    t.style.top = (r.top > 60 ? r.top - 44 : r.bottom + 8) + 'px';
    t.classList.add('is-on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('is-on'); }, 1800);
  }
  function cancel() { clearTimeout(timer); timer = null; if (cur) cur.classList.remove('hc-holding'); cur = null; }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest(SEL);
    if (!b || b.disabled || e.button > 0) return;
    cancel(); cur = b; b.classList.add('hc-holding');
    timer = setTimeout(function () {
      var x = cur; cancel(); if (!x || x.disabled) return;
      x._hcOk = true; x._hcQuiet = Date.now() + 1200;
      x.classList.add('hc-fired'); setTimeout(function () { x.classList.remove('hc-fired'); }, 500);
      x.click();
    }, HOLD);
  }, true);
  ['pointerup', 'pointercancel', 'dragstart'].forEach(function (n) { document.addEventListener(n, cancel, true); });
  document.addEventListener('pointerout', function (e) { if (cur && e.target.closest && e.target.closest(SEL) === cur && !cur.contains(e.relatedTarget)) cancel(); }, true);
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest(SEL)) e.preventDefault(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest(SEL);
    if (!b) return;
    if (b._hcOk) { b._hcOk = false; return; }              // 길게 눌러 생긴 실행 → 통과
    if (!e.isTrusted || e.detail === 0) return;            // 키보드·프로그램 실행 → 기존대로
    e.preventDefault(); e.stopImmediatePropagation();
    if ((b._hcQuiet || 0) > Date.now()) return;            // 길게 누른 뒤 손을 뗄 때 오는 클릭은 조용히 무시
    hint(b);
  }, true);
})();
