/* 메인 휴대폰 아래 고정 '합류 문의' 막대(MAIN-V3-02): 첫 화면(3D 로고·대표문구·숫자 타일 4개)이 화면 위로 지나간 뒤에만 보인다(숫자 타일을 가리지 않게).
   IntersectionObserver 가 없거나 JS 가 꺼져 있으면 CSS 기본값대로 늘 보인다. 움직임 줄이기 설정이면 전환 효과 없이 바로 나타남(assets/home-layout.css). */
(function () {
  var bar = document.querySelector('.g-cta-bar');
  var hero = document.getElementById('hero');
  if (!bar) return;
  if (!hero || !('IntersectionObserver' in window)) { bar.classList.add('is-on'); return; }
  var io = new IntersectionObserver(function (entries) {
    var e = entries[entries.length - 1];
    bar.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.bottom <= 0);
  }, { threshold: 0 });
  io.observe(hero);
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
