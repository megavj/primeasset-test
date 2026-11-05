/* 시안 — 자주 묻는 질문 A안 (lab/faq: 메인 예시 index.html · 전체 질문 all/index.html 공용)
   · 상단 메뉴(정적 사본): 1100px 이하 '메뉴' 열기·닫기(Esc)
   · 주소 #faq-… 로 오면 그 질문을 펼침: 처음 열 때 · 주소가 바뀔 때 · 같은 주소 링크를 다시 누를 때
     펼치고 접는 것 자체는 details/summary 기본 동작(여러 개 함께 펼침). 스크립트가 없어도 질문·답은 모두 읽힘
   · 전체 질문의 '링크 복사': 클립보드를 쓸 수 있을 때만 보임. 그 질문 주소(#id)를 복사하고 결과를 화면 읽기 프로그램에도 알림
   · 외부 요청 없음. inline style 없음(CSP) */
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

  /* ---------- 주소 #질문id → 그 질문 펼침 ---------- */
  const itemFor = (hash) => {
    if (!hash || hash.length < 2) return null;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (e) { return null; }
    const el = document.getElementById(id);
    return (el && el.closest('details[data-fq]')) || null;
  };
  const fromUrl = () => { const item = itemFor(location.hash); if (item) item.open = true; };
  fromUrl();
  window.addEventListener('hashchange', fromUrl);
  // 같은 주소를 다시 누르면 hashchange 가 없어 클릭에서 펼침(스크롤 전에 펼쳐 둠).
  // 포커스는 링크 이동(브라우저가 포커스를 풀어 버림)이 끝난 뒤 그 질문으로 옮겨, Tab 이동이 거기서 이어지게
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || a.origin !== location.origin || a.pathname !== location.pathname) return;
    const item = itemFor(a.hash);
    if (!item) return;
    item.open = true;
    const s = $('summary', item);
    if (s) setTimeout(() => s.focus({ preventScroll: true }), 0);
  });

  /* ---------- 링크 복사(전체 질문) ---------- */
  const live = $('[data-fq-live]');
  const say = (msg) => {
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = msg; }, 60); // 같은 문장을 다시 알릴 때도 읽히게 비웠다가 넣음
  };
  const canCopy = !!(window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText);
  $$('[data-fq-copy]').forEach((btn) => {
    const item = btn.closest('details[data-fq]');
    const summary = item && $('summary', item);
    if (!canCopy || !item || !item.id || !summary) return;
    if (!summary.id) summary.id = item.id + '-q';
    btn.setAttribute('aria-describedby', summary.id); // 버튼 이름은 보이는 글 그대로, 어느 질문인지는 설명으로
    btn.hidden = false;
    const label = btn.textContent;
    let timer = 0;
    btn.addEventListener('click', async () => {
      const url = location.origin + location.pathname + '#' + item.id;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = '복사했습니다';
        btn.classList.add('is-done');
        say('질문 링크를 복사했습니다.');
      } catch (err) {
        btn.textContent = '복사하지 못했습니다';
        say('링크를 복사하지 못했습니다. 주소창의 주소를 이용해 주세요.');
        history.replaceState(null, '', '#' + item.id); // 주소창에서 바로 복사할 수 있게
      }
      clearTimeout(timer);
      timer = setTimeout(() => { btn.textContent = label; btn.classList.remove('is-done'); }, 2400);
    });
  });
})();
