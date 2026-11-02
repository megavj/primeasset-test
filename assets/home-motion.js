/* 메인 스크롤 연출 보조(MAIN-V3-04): ① 숫자 4개 카운트업 ② scroll-driven animation 미지원 브라우저의 카드 등장 대체(IntersectionObserver)
   · 카운트업: data-count 가 붙은 숫자(b)의 숫자 부분(쉼표 포함)만 0→값으로 1.6초. 글자(개 본부·명·억·만 원)는 그대로. 끝나면 원래 글자(textContent)를 그대로 되돌려 넣는다.
     JS 가 꺼지면 처음부터 원래 글자. 움직임 줄이기 설정이면 아무것도 하지 않는다.
   · 등장 대체: CSS.supports('animation-timeline: view()') 가 거짓일 때만 html.io 를 붙여 .g-reveal 을 숨겼다가 보이면 .is-in. 움직임 줄이기면 하지 않음. */
(function () {
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasIO = 'IntersectionObserver' in window;
  if (reduce) return;

  /* ---------- 숫자 카운트업 ---------- */
  function easeOut(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function group(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function tokens(text) {
    var out = [], re = /\d[\d,]*/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ s: text.slice(last, m.index) });
      out.push({ n: parseInt(m[0].replace(/,/g, ''), 10), g: m[0].indexOf(',') >= 0, raw: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ s: text.slice(last) });
    return out;
  }
  function render(toks, p) {
    return toks.map(function (t) { return t.s !== undefined ? t.s : (p >= 1 ? t.raw : (t.g ? group(Math.round(t.n * p)) : String(Math.round(t.n * p)))); }).join('');
  }
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length && hasIO && 'requestAnimationFrame' in window) {
    counters.forEach(function (el) {
      el.pbFinal = el.textContent; el.pbToks = tokens(el.pbFinal);
      if (el.pbToks.some(function (t) { return t.n !== undefined; })) el.textContent = render(el.pbToks, 0);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target, started = null, dur = parseInt(el.getAttribute('data-count'), 10) || 1600;
        function frame(now) {
          if (started === null) started = now;
          var t = Math.min(1, (now - started) / dur);
          el.textContent = t < 1 ? render(el.pbToks, easeOut(t)) : el.pbFinal;
          if (t < 1) window.requestAnimationFrame(frame);
        }
        window.requestAnimationFrame(frame);
      });
    }, { threshold: 0.3 });
    counters.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 카드 등장 대체 ---------- */
  var cssOK = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));
  var items = document.querySelectorAll('.g-reveal');
  if (cssOK || !hasIO || !items.length) return;
  document.documentElement.classList.add('io');
  var ro = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      ro.unobserve(e.target); e.target.classList.add('is-in');
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  Array.prototype.forEach.call(items, function (el) { ro.observe(el); });
})();
