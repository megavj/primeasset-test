/* 시안 — 김상현 이사 편지 + 합류 (lab/closing)
   · <head>에서 바로 실행해 html.js 를 붙인다(메인 맨 위 inline 스크립트와 같은 역할. 이 시안은 CSP 로 inline 을 막아 파일로 둠).
     그래야 휴대폰 막대가 처음부터 숨은 상태로 시작한다. 나머지는 문서를 다 읽은 뒤 실행
   · 휴대폰 아래 고정 막대(RECOMMEND22 1-4): '첫 화면 지나감' 그리고 '마지막 버튼 두 개가 아직 다 보이지 않음'일 때만 보임(.is-on).
     숨길 때는 inert + aria-hidden 으로 키보드·화면 읽기에서도 뺀다. 막대 안에 포커스가 있으면 숨기지 않고, 포커스가 나가면 다시 판단.
     메인 assets/home-layout.js 첫 블록에 그대로 옮길 수 있게 썼다(#hero 가 없는 이 시안은 첫 화면을 지나간 것으로 본다)
   · 금빛 한 번 스침(1-3): 버튼 두 개가 화면에 다 들어오고 0.4초 뒤 1회, 마우스를 올리거나 키보드로 갔을 때 1회(직전 스침 뒤 4초 쉼). 움직임 줄이기면 하지 않음
   · 시안 비교: 기본안 / 대안(FAQ 끝 인용을 편지 마지막 줄 위로). 주소 ?alt=1 로도 열림
   · 상단 메뉴(정적 사본) 열기·닫기. 외부 요청 없음, inline style 없음(CSP) */
document.documentElement.classList.add('js');
(function () {
  'use strict';
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ---------- 상단 메뉴(정적 사본) ---------- */
  function labNav() {
    var nav = document.querySelector('[data-lab-nav]');
    var btn = nav && nav.querySelector('#pa-nav-toggle');
    if (!btn) return;
    function set(open) { nav.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); }
    btn.addEventListener('click', function () { set(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); }
    });
  }

  /* ---------- 휴대폰 아래 고정 막대 ---------- */
  function ctaBar() {
    var bar = document.querySelector('.g-cta-bar');
    if (!bar) return;
    var hero = document.getElementById('hero');
    var end = document.querySelector('#contact .g-actions');
    var foot = document.querySelector('.g-foot');
    if (!('IntersectionObserver' in window)) { bar.classList.add('is-on'); return; }
    var passed = !hero;   // 첫 화면이 지나갔는지
    var reached = false;  // 마지막 버튼 두 개를 다 봤는지(다시 화면 아래로 내려가면 false)
    function apply() {
      var on = passed && !reached;
      if (!on && bar.contains(document.activeElement)) return; // 막대 안에 포커스가 있으면 숨기지 않음
      bar.classList.toggle('is-on', on);
      if (on) { bar.removeAttribute('inert'); bar.removeAttribute('aria-hidden'); }
      else { bar.setAttribute('inert', ''); bar.setAttribute('aria-hidden', 'true'); }
    }
    // 마지막 버튼 위치는 그때그때 실제 위치로 판단한다(한 번에 멀리 건너뛰어 관찰 경계를 넘지 않은 경우도 맞게)
    function check() {
      if (end) {
        var r = end.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (r.top >= vh) reached = false;            // 아직(또는 다시) 화면 아래 — 위로 올라가면 막대가 다시 보임
        else if (r.bottom <= vh + 1) reached = true; // 다 보임 · 위쪽에 걸침 · 이미 지나감
      }                                              // 아래쪽 끝에 걸쳐 있을 때는 그대로(경계에서 깜빡이지 않게)
      apply();
    }
    if (hero) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        passed = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
        check();
      }, { threshold: 0 }).observe(hero);
    }
    if (end) {
      var io = new IntersectionObserver(check, { threshold: [0, 0.98, 1] });
      io.observe(end);
      if (foot) io.observe(foot); // 바닥글이 보이면(끝으로 바로 건너뜀) 다시 판단
    }
    bar.addEventListener('focusout', function (e) {
      if (!bar.contains(e.relatedTarget)) setTimeout(apply, 0);
    });
    check();
  }

  /* ---------- 금빛 한 번 스침 ---------- */
  function shine() {
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
  }

  /* ---------- 시안 비교: 기본안 / 대안 ---------- */
  function variants() {
    var groups = Array.prototype.slice.call(document.querySelectorAll('[data-variant-group]'));
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-variant-btn]'));
    var parts = Array.prototype.slice.call(document.querySelectorAll('[data-variant-only]'));
    if (!buttons.length) return;
    function set(v, save) {
      document.documentElement.setAttribute('data-variant', v);
      parts.forEach(function (el) { el.hidden = el.getAttribute('data-variant-only') !== v; });
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-variant-btn') === v)); });
      if (save && window.history && history.replaceState) {
        history.replaceState(null, '', location.pathname + (v === 'alt' ? '?alt=1' : '') + location.hash);
      }
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { set(b.getAttribute('data-variant-btn'), true); });
    });
    groups.forEach(function (g) { g.hidden = false; });
    set(/[?&]alt=1(&|$)/.test(location.search) ? 'alt' : 'base', false);
  }

  ready(function () {
    labNav();
    variants();
    ctaBar();
    shine();
  });
})();
