/* 시안 — 왜 프리미엄사업부인가 (lab/why)
   · html.js: 그리기 전에 붙임(<head> 에서 defer 없이 읽음) — 메인과 같이 휴대폰 고정 막대를 첫 화면에서는 숨김(assets/home-layout.css)
   · 상단 메뉴(정적 사본): 1100px 이하 '메뉴' 열기·닫기(Esc)
   · 금색 선 효과는 CSS 만(why.css). 본부 수는 메인 assets/branches.js. 고정 막대 보이기는 메인 assets/home-layout.js
   · 외부 요청 없음. inline style 없음(CSP) */
document.documentElement.classList.add('js');
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const nav = document.querySelector('[data-lab-nav]');
  const navBtn = nav && nav.querySelector('#pa-nav-toggle');
  if (!navBtn) return;
  const setNav = (open) => { nav.classList.toggle('is-open', open); navBtn.setAttribute('aria-expanded', String(open)); };
  navBtn.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); navBtn.focus(); }
  });
});
