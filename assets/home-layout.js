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
