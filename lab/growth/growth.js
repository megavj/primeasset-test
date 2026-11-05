/* 시안 — 설계사 성장 시스템 (lab/growth)
   · 상단 메뉴(정적 사본): 1100px 이하 '메뉴' 열기·닫기(Esc)
   · 실제 자료 크게 보기: [data-gr-open] 링크(자료 원본 크기 이미지)를 누르면 기본 dialog(showModal)로 엶.
     스크립트가 없거나 dialog 를 못 쓰는 브라우저는 링크가 이미지를 그대로 엶
     포커스 가둠·Esc 닫기는 브라우저 기본. 바깥(어두운 면)을 눌러도 닫히고, 닫으면 누른 링크로 포커스가 돌아감
     ←/→ 키·이전/다음 버튼·좌우 밀기(터치)로 자료를 넘기고, 바뀐 자료는 화면 읽기 프로그램에 알림
   · 외부 요청 없음. HTML inline style 속성 없음(CSP) — 판 폭 비율만 CSSOM 변수(--gr-ar)로 넣음 */
(() => {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------- 상단 메뉴(정적 사본) ---------- */
  const nav = $('[data-lab-nav]');
  const navBtn = nav && $('#pa-nav-toggle', nav);
  if (navBtn) {
    const setNav = (open) => { nav.classList.toggle('is-open', open); navBtn.setAttribute('aria-expanded', String(open)); };
    navBtn.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setNav(false); navBtn.focus(); }
    });
  }

  /* ---------- 실제 자료 크게 보기 ---------- */
  const dlg = $('#gr-dlg');
  const triggers = $$('[data-gr-open]');
  if (!dlg || typeof dlg.showModal !== 'function' || !triggers.length) return;

  const part = (k) => $(`[data-gr-d="${k}"]`, dlg);
  const ui = { src: part('src'), title: part('title'), img: part('img'), note: part('note'), i: part('i'), n: part('n'), raw: part('raw'), live: part('live') };
  const items = triggers.map((a) => ({
    a,
    href: a.getAttribute('href'),
    w: Number(a.dataset.grW) || 0,
    h: Number(a.dataset.grH) || 0,
    src: a.dataset.grSrc || '',
    title: a.dataset.grTitle || '',
    note: a.dataset.grNote || '',
    alt: a.dataset.grAlt || '',
  }));
  let cur = 0;
  let opener = null;

  const say = (msg) => {
    if (!ui.live) return;
    ui.live.textContent = '';
    setTimeout(() => { ui.live.textContent = msg; }, 60); // 같은 문장을 다시 알릴 때도 읽히게 비웠다가 넣음
  };

  const show = (i, announce) => {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    ui.src.textContent = it.src;
    ui.title.textContent = it.title;
    ui.note.textContent = it.note;
    ui.img.alt = it.alt;
    if (it.w && it.h) {
      ui.img.width = it.w; ui.img.height = it.h; // 불러오기 전에도 비율대로 자리 잡게
      dlg.style.setProperty('--gr-ar', (it.w / it.h).toFixed(4)); // 판 폭을 이미지 비율에 맞춤(CSSOM 이라 CSP 의 inline style 제한과 무관)
    }
    ui.img.src = it.href;
    ui.raw.href = it.href;
    ui.i.textContent = String(cur + 1);
    ui.n.textContent = String(items.length);
    if (announce) say(`${cur + 1} / ${items.length}. ${it.src}. ${it.title}. ${it.note}`);
  };

  triggers.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 새 탭 열기 등은 그대로
      e.preventDefault();
      opener = a;
      show(i, false);
      dlg.showModal();
    });
  });

  // 닫기: 버튼 · Esc(브라우저 기본) · 바깥 누르기(누르기 시작도 바깥이었을 때만 — 안에서 끌다가 바깥에서 놓으면 닫지 않음)
  $('[data-gr-close]', dlg).addEventListener('click', () => dlg.close());
  let downOnBackdrop = false;
  dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && downOnBackdrop) dlg.close();
    downOnBackdrop = false;
  });
  dlg.addEventListener('close', () => {
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  });

  // 이전·다음
  $('[data-gr-prev]', dlg).addEventListener('click', () => show(cur - 1, true));
  $('[data-gr-next]', dlg).addEventListener('click', () => show(cur + 1, true));
  dlg.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); }
  });

  // 좌우 밀기(터치): 가로로 50px 넘게, 세로 움직임이 작을 때만
  const view = $('.gr-dlg__view', dlg);
  let sx = 0, sy = 0, touching = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touching = true; sx = e.clientX; sy = e.clientY;
  });
  view.addEventListener('pointerup', (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) show(cur + (dx < 0 ? 1 : -1), true);
  });
  view.addEventListener('pointercancel', () => { touching = false; });
})();
