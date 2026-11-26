/* 손대면 반응하는 움직임(시안 TOUCH-20261127) — 설명은 home-touch.css 머리말.
   마우스가 있는 화면 + 움직임 줄이기 꺼짐일 때만 시작. 실패해도 원래 화면·버튼 동작은 그대로(링크 기본 동작 유지, ④만 컴퓨터에서 첫 클릭을 번호 보기로 바꿈). */
(function () {
  var mm = window.matchMedia;
  if (!mm || mm('(prefers-reduced-motion: reduce)').matches || !mm('(hover: hover) and (pointer: fine)').matches) return;

  /* ① 자석 버튼: 버튼 둘레 48px 안에서 거리 비율만큼 최대 4px */
  var R = 56, MAX = 6;
  Array.prototype.forEach.call(document.querySelectorAll('main .g-btn--pri.g-btn--lg'), function (b) {
    b.classList.add('tc-mag');
  });
  var mags = document.querySelectorAll('.tc-mag');
  var raf = 0, lx = 0, ly = 0;
  function magFrame() {
    raf = 0;
    Array.prototype.forEach.call(mags, function (b) {
      var r = b.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = lx - cx, dy = ly - cy;
      var near = lx > r.left - R && lx < r.right + R && ly > r.top - R && ly < r.bottom + R;
      if (near) {
        var fx = Math.max(-1, Math.min(1, dx / (r.width / 2 + R))), fy = Math.max(-1, Math.min(1, dy / (r.height / 2 + R)));
        b.style.setProperty('--tc-mx', (fx * MAX).toFixed(2) + 'px');
        b.style.setProperty('--tc-my', (fy * MAX * .7).toFixed(2) + 'px');
        b.classList.add('is-near');
      } else if (b.classList.contains('is-near')) {
        b.classList.remove('is-near');
        b.style.setProperty('--tc-mx', '0px'); b.style.setProperty('--tc-my', '0px');
      }
    });
  }
  if (mags.length) document.addEventListener('pointermove', function (e) {
    lx = e.clientX; ly = e.clientY;
    if (!raf) raf = requestAnimationFrame(magFrame);
  }, { passive: true });

  /* ② 카드 빛 따라가기 */
  Array.prototype.forEach.call(document.querySelectorAll('.pb-home__board, #contact .cl-panel'), function (host) {
    var s = document.createElement('span'); s.className = 'tc-spot'; s.setAttribute('aria-hidden', 'true');
    host.classList.add('tc-spot-host'); if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.insertBefore(s, host.firstChild);
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      host.style.setProperty('--tc-px', (e.clientX - r.left) + 'px');
      host.style.setProperty('--tc-py', (e.clientY - r.top) + 'px');
    }, { passive: true });
  });

  /* ③ 메뉴 미끄럼 바탕(메뉴가 가로로 펼쳐진 넓은 화면에서만) — 메뉴는 site-nav.js 가 늦게 그릴 수 있어 기다림 */
  function navInit(nav) {
    if (nav.classList.contains('tc-nav')) return;
    nav.classList.add('tc-nav'); if (getComputedStyle(nav).position === 'static') nav.style.position = 'relative';
    var ind = document.createElement('span'); ind.className = 'tc-nav-ind'; ind.setAttribute('aria-hidden', 'true');
    nav.insertBefore(ind, nav.firstChild);
    function horizontal() { var t = document.getElementById('pa-nav-toggle'); return !t || getComputedStyle(t).display === 'none'; }
    function to(el) {
      if (!horizontal() || !el || el.hidden) { ind.classList.remove('is-on'); return; }
      var nr = nav.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!ind.classList.contains('is-on')) { ind.style.transition = 'none'; }
      ind.style.setProperty('--tc-x', (r.left - nr.left) + 'px'); ind.style.setProperty('--tc-y', (r.top - nr.top) + 'px');
      ind.style.width = r.width + 'px'; ind.style.height = r.height + 'px';
      if (ind.style.transition === 'none') { void ind.offsetWidth; ind.style.transition = ''; }
      ind.classList.add('is-on');
    }
    nav.addEventListener('pointerover', function (e) {
      var a = e.target.closest('a,button'); if (a && a.parentNode === nav && !a.classList.contains('g-btn')) to(a);
    });
    nav.addEventListener('pointerleave', function () { ind.classList.remove('is-on'); });
    nav.addEventListener('focusin', function (e) { if (e.target.parentNode === nav && e.target.matches(':focus-visible')) to(e.target); });
    nav.addEventListener('focusout', function () { ind.classList.remove('is-on'); });
  }
  var tries = 0;
  (function waitNav() {
    var nav = document.getElementById('pa-nav-menu');
    if (nav) navInit(nav); else if (tries++ < 40) setTimeout(waitNav, 100);
  })();

  /* ④ 컴퓨터 '전화로 상담': 첫 클릭 = 번호 펼침 + 복사, 펼친 상태에서 다시 누르면 원래 전화 연결 */
  Array.prototype.forEach.call(document.querySelectorAll('#contact a.cl-tel[href^="tel:"]'), function (a) {
    var num = a.getAttribute('href').slice(4);
    var w0 = 0, timer = 0;
    a.classList.add('tc-tel'); if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
    a.innerHTML = '<span class="tc-tel__a">' + a.innerHTML + '</span><span class="tc-tel__b" aria-hidden="true">' + num + ' <span class="tc-tel__ok">복사됨</span></span>';
    function close() {
      a.classList.remove('is-open'); a.style.width = w0 + 'px';
      setTimeout(function () { if (!a.classList.contains('is-open')) a.style.width = ''; }, 450);
    }
    a.addEventListener('click', function (e) {
      if (a.classList.contains('is-open')) return; /* 두 번째 클릭은 원래대로 전화 앱 */
      e.preventDefault();
      w0 = a.getBoundingClientRect().width;
      var b = a.querySelector('.tc-tel__b');
      var need = Math.ceil(b.scrollWidth + 48);
      a.style.width = w0 + 'px'; void a.offsetWidth;
      a.style.width = Math.max(w0, need) + 'px';
      a.classList.add('is-open');
      var ok = a.querySelector('.tc-tel__ok');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(num).then(function () { ok.textContent = '복사됨'; }, function () { ok.textContent = ''; });
      else ok.textContent = '';
      var live = document.getElementById('pa-nav-status');
      if (live) { live.hidden = false; live.textContent = '전화번호 ' + num + (ok.textContent ? ' 복사됨' : ''); setTimeout(function () { live.textContent = ''; live.hidden = true; }, 3000); }
      clearTimeout(timer); timer = setTimeout(close, 6000);
    });
  });
})();
