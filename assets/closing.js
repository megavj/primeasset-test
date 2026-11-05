/* 메인 합류(#contact) 금빛 한 번 스침 — lab/closing/closing.js 의 shine() 을 옮김(TASK28).
   버튼 두 개가 화면에 다 들어오고 0.4초 뒤 1회, 마우스를 올리거나 키보드로 갔을 때 1회(직전 스침 뒤 4초 쉼). 움직임 줄이기면 하지 않음.
   휴대폰 아래 고정 막대 동작은 assets/home-layout.js. 외부 요청 없음, inline style 없음(CSP) */
(function () {
  'use strict';
  var btn = document.querySelector('[data-shine]');
  if (!btn) return;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var REST = 4000;
  var last = -Infinity;
  function run() {
    if (reduce && reduce.matches) return;
    var now = Date.now();
    if (now - last < REST) return;
    last = now;
    btn.classList.remove('is-shine');
    void btn.offsetWidth; // 같은 애니메이션을 처음부터 다시
    btn.classList.add('is-shine');
  }
  btn.addEventListener('animationend', function (e) {
    if (e.animationName === 'cl-shine') btn.classList.remove('is-shine');
  });
  btn.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') run();
  });
  btn.addEventListener('focus', function () {
    var kb = true;
    try { kb = btn.matches(':focus-visible'); } catch (err) { /* 미지원 브라우저는 포커스 전부 */ }
    if (kb) run();
  });
  var area = btn.closest('.g-actions') || btn;
  if (!('IntersectionObserver' in window)) return;
  var timer = 0;
  var io = new IntersectionObserver(function (entries) {
    var e = entries[entries.length - 1];
    if (e.intersectionRatio >= 0.98) {
      if (!timer) timer = setTimeout(function () { timer = 0; io.disconnect(); run(); }, 400);
    } else if (timer) { clearTimeout(timer); timer = 0; }
  }, { threshold: [0, 0.98] });
  io.observe(area);
})();
