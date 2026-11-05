/* 메인 휴대폰 아래 고정 '합류 문의' 막대(MAIN-V3-02 + TASK28: lab/closing 기본안 새 동작을 합침 — 막대는 이 블록 하나만 다룸)
   · '첫 화면(3D 로고·대표문구·숫자 타일 4개)이 화면 위로 지나감' 그리고 '맨 끝 합류 버튼 두 개(#contact .g-actions)가 아직 다 보이지 않음'일 때만 보임(.is-on).
   · 숨길 때는 inert + aria-hidden 으로 키보드·화면 읽기에서도 뺀다. 막대 안에 포커스가 있으면 숨기지 않고, 포커스가 나가면 다시 판단.
   · IntersectionObserver 가 없거나 JS 가 꺼져 있으면 CSS 기본값대로 늘 보인다. 움직임 줄이기 설정이면 전환 효과 없이 바로(assets/home-layout.css). */
(function () {
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
})();

/* 영업지원시스템: JS 미사용 시 모든 내용을 표시. 모바일 펼침 상태는 화면 폭을 바꿔도 유지. */
(function () {
  var section = document.getElementById('sales-system');
  if (!section || !window.matchMedia) return;
  var mobile = window.matchMedia('(max-width:720px)');
  var buttons = Array.prototype.slice.call(section.querySelectorAll('.g-sales-toggle'));
  var panels = buttons.map(function (button) {
    return document.getElementById(button.getAttribute('aria-controls'));
  });
  var open = buttons.map(function (_, index) { return index === 0; });
  function render() {
    buttons.forEach(function (button, index) {
      var expanded = !mobile.matches || open[index];
      button.disabled = !mobile.matches;
      button.tabIndex = mobile.matches ? 0 : -1;
      button.setAttribute('aria-expanded', String(expanded));
      panels[index].hidden = !expanded;
    });
  }
  buttons.forEach(function (button, index) {
    // 기본 button 동작으로 클릭·Enter·Space 모두 지원한다.
    button.addEventListener('click', function () {
      if (!mobile.matches) return;
      open[index] = !open[index];
      render();
    });
  });
  if (mobile.addEventListener) mobile.addEventListener('change', render);
  else mobile.addListener(render);
  render();
})();
