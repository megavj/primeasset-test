/* ART-GUIDE 2026-11-24 이사님: [작성글 노하우] — 페이지 이동 없이 여는 안내(넓은 화면은 오른쪽 서랍, 휴대폰은 아래에서 올라오는 시트).
   네이티브 <dialog>(showModal): ESC·닫기 버튼·바깥 누르기로 닫히고, 닫으면 [작성글 노하우] 버튼으로 초점이 돌아간다. 열려 있는 동안 Tab은 안에서만 돈다.
   주소 #guide 로 바로 열 수 있다. 글 주소(#a=<번호>)와 섞이지 않게 #guide 는 열자마자 주소에서 지운다(articles.js 는 #guide 를 무시한다).
   본문의 기능 설명은 articles*.js 가 실제로 하는 일만, 검색·AI 설명은 아래 SRC 의 자료에서 직접 확인한 내용만 적었다(확인일 2026-11-24).
   점검표는 이 기기(localStorage)에만 저장한다. 서버 호출 없음. */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, opener = document.getElementById('art-guide-open');
  if (!K || !opener) return;
  if (typeof HTMLDialogElement !== 'function' || !HTMLDialogElement.prototype.showModal) { opener.hidden = true; return; }
  const { el } = K;
  const CHECK_KEY = 'pa_art_guide_check_v1';

  // ── 근거(모두 2026-11-24 확인) ──
  const SRC = {
    gHelpful: ['Google 검색 센터 · 유용하고 믿을 수 있는 콘텐츠 만들기 안내', 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content'],
    gAi: ['Google 검색 센터 · 생성형 AI 검색 최적화 안내', 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide'],
    nSmart: ['네이버 · 스마트블록, 검색을 넘어 탐색으로의 여정', 'https://www.navercorp.com/storyDetail?seq=32036'],
    nWeb: ['네이버 보도자료 · 웹문서 기본 가이드라인(2013)', 'https://navercorp.com/media/pressReleasesDetail?seq=28937'],
    nBrief: ['네이버 보도자료 · AI 브리핑 도입(2025.3)', 'https://navercorp.com/media/pressReleasesDetail?seq=32374'],
    nUgc: ['네이버 보도자료 · 창작자와 AI 브리핑(2026.5)', 'https://navercorp.com/media/pressReleasesDetail?seq=10034302'],
    geo: ['GEO 논문(KDD 2024)', 'https://arxiv.org/abs/2311.09735'],
    oai: ['OpenAI 도움말 · ChatGPT 검색', 'https://help.openai.com/en/articles/9237897-chatgpt-search']
  };
  // 글 안의 **굵게** 표시만 <b>로 바꾼다
  const rich = text => String(text).split('**').map((part, i) => i % 2 ? el('b', {}, part) : part);
  const sources = (...keys) => el('p', { class: 'ag-src' }, el('span', {}, '근거'), ...keys.map(k => typeof k === 'string' && SRC[k] ? el('a', { href: SRC[k][1], target: '_blank', rel: 'noopener' }, SRC[k][0]) : el('em', {}, k[0])));
  const bullets = items => el('ul', { class: 'ag-list' }, ...items.map(t => el('li', {}, ...rich(t))));

  const CHECKS = [
    ['title', '제목이 글 내용 그대로이고 과장이 없다'],
    ['answer', '첫 문단에서 질문에 바로 답했다'],
    ['exp', '내 상담 경험을 한 문단 넣었다 (고객을 알아볼 수 있는 내용은 뺐다)'],
    ['fact', '숫자와 제도를 오늘 기준으로 다시 확인했다'],
    ['date', '기준 날짜와 출처를 적었다'],
    ['fill', '노란 칸(설계사 이름·등록번호 등)을 내 정보에 맞게 고쳤다'],
    ['legal', '빨간 안내 문구와 맨 아래 필수안내사항을 내 정보에 맞게 고쳤다'],
    ['name', '보험사·상품 이름을 새로 넣지 않았다'],
    ['image', '그림이 제대로 들어갔고, 글과 관계없는 그림·검색어는 넣지 않았다'],
    ['review', '회사 광고심의 기준에 따라 확인을 마쳤다']
  ];
  const SECTIONS = [['sum', '3분 요약'], ['use', '쓰는 법'], ['search', '검색'], ['ai', 'AI 인용'], ['check', '점검표'], ['ex', '예시']];

  let dlg = null, body = null, navButtons = [], secNodes = [], checkCount = null;

  function loadChecks() { try { const v = JSON.parse(localStorage.getItem(CHECK_KEY) || '[]'); return new Set(Array.isArray(v) ? v.filter(x => typeof x === 'string') : []); } catch (_) { return new Set(); } }
  function saveChecks(set) { try { localStorage.setItem(CHECK_KEY, JSON.stringify([...set])); } catch (_) { /* 저장을 못 쓰는 브라우저에서는 이번에만 기억 */ } }

  function checklist() {
    const done = loadChecks();
    const bar = el('i', {}), meter = el('div', { class: 'ag-meter', role: 'progressbar', 'aria-label': '점검표 진행', 'aria-valuemin': '0', 'aria-valuemax': String(CHECKS.length) }, bar);
    const text = el('p', { class: 'ag-meter-text', role: 'status', 'aria-live': 'polite' });
    const boxes = CHECKS.map(([id, label]) => {
      const input = el('input', { type: 'checkbox', id: 'ag-ck-' + id });
      input.checked = done.has(id);
      input.addEventListener('change', () => { if (input.checked) done.add(id); else done.delete(id); saveChecks(done); draw(); });
      return { id, input, node: el('li', {}, el('label', { for: 'ag-ck-' + id }, input, el('span', {}, label))) };
    });
    const reset = el('button', { type: 'button', class: 'ag-reset', onclick: () => { done.clear(); boxes.forEach(b => { b.input.checked = false; }); saveChecks(done); draw(); boxes[0].input.focus({ preventScroll: true }); } }, '다시 체크');
    function draw() {
      const n = boxes.filter(b => b.input.checked).length, all = boxes.length;
      bar.style.transform = `scaleX(${n / all})`;
      meter.setAttribute('aria-valuenow', String(n));
      meter.classList.toggle('is-done', n === all);
      text.textContent = n === all ? `${all}개를 모두 확인했습니다. 회사 광고심의 기준에 따라 게시하세요.` : `${all}개 중 ${n}개 확인`;
      reset.disabled = n === 0;
      if (checkCount) checkCount.textContent = n ? ` ${n}/${all}` : '';
    }
    const node = el('div', { class: 'ag-check' },
      el('div', { class: 'ag-check-top' }, el('div', { class: 'ag-check-meter' }, meter, text), reset),
      el('ul', { class: 'ag-checks' }, ...boxes.map(b => b.node)),
      el('p', { class: 'ag-fine' }, '체크한 내용은 이 기기에만 저장됩니다. 글을 올릴 때마다 [다시 체크]로 비우고 쓰세요.'));
    return { node, draw };
  }

  function section(id, title, ...kids) {
    return el('section', { class: 'ag-sec', id: 'ag-' + id, 'aria-labelledby': 'ag-' + id + '-h' }, el('h3', { id: 'ag-' + id + '-h', tabindex: '-1' }, title), ...kids);
  }

  function build() {
    const check = checklist();
    const close = el('button', { type: 'button', class: 'ag-close', 'aria-label': '작성글 노하우 닫기', onclick: () => dlg.close() },
      (() => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '20'); s.setAttribute('height', '20'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M6 6l12 12M18 6 6 18'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.8'); p.setAttribute('stroke-linecap', 'round'); s.append(p); return s; })());
    navButtons = SECTIONS.map(([id, label]) => {
      const count = id === 'check' ? (checkCount = el('span', { class: 'ag-nav-n' })) : null;
      return el('button', { type: 'button', 'data-sec': id, onclick: () => jump(id) }, label, count);
    });

    const sum = el('section', { class: 'ag-sec ag-sum', id: 'ag-sum', 'aria-labelledby': 'ag-sum-h' },
      el('p', { class: 'ag-kicker' }, '바쁘면 이것만'),
      el('h3', { id: 'ag-sum-h', tabindex: '-1' }, '3분 요약'),
      el('ol', { class: 'ag-steps' }, ...[
        '**보관하고 복사합니다.** 글을 골라 [보관] → 내 보관함에서 복사 → 블로그에 붙여넣기.',
        '**세 군데는 꼭 고칩니다.** 첫 문단은 질문의 답부터, 내 상담 경험 한 문단, 기준 날짜와 출처.',
        '**제목은 내용 그대로 씁니다.** 과장하거나 놀라게 하는 제목은 피합니다.',
        '**노란 칸과 빨간 안내 문구**를 내 정보에 맞게 고칩니다.',
        '**회사 광고심의 기준에 따라 게시**합니다.'
      ].map(t => el('li', {}, ...rich(t)))),
      el('p', { class: 'ag-fine' }, '이 안내는 노출 가능성을 높이는 방법입니다. 검색 순위나 AI 인용을 보장하지는 않습니다.'));

    const use = section('use', '1. 작성글모음 쓰는 법',
      el('ol', { class: 'ag-steps' }, ...[
        '**고르기** — 검색창에 낱말을 넣거나 [분류]를 펼쳐 보험 종류·채널로 거릅니다. 채널은 네이버형·구글형·AI 인용형 세 가지이니 올릴 곳에 맞춰 고르세요.',
        '**보관** — [보관]을 누르면 글이 내 보관함으로 옮겨지고 다른 설계사 목록에서는 사라집니다. 하루에 보관할 수 있는 수가 정해져 있고(남은 수는 목록 위에 보입니다), 자정이 지나면 다시 보관할 수 있습니다.',
        '**복사** — 복사는 보관한 뒤에 할 수 있습니다. 보관한 글 화면이나 [내 보관함]에서 누르세요. 네이버 블로그는 [서식 그대로 복사], 홈페이지·워드프레스·티스토리는 [HTML 복사]입니다.',
        '**붙여넣기** — 네이버 블로그는 글쓰기 본문에 붙이고, 제목은 제목 칸에 따로 넣습니다. 그림이 안 들어오면 글 속 그림을 저장해 직접 올립니다.',
        '**꼭 고칠 곳** — 노란 칸(설계사 이름·등록번호·심의필 번호 자리), 빨간 안내 문구, 맨 아래 필수안내사항을 내 정보에 맞게 고칩니다. 숫자와 제도는 올리는 날 기준으로 한 번 더 확인합니다.',
        '**게시** — 보관한 글 위의 ‘게시 전에 꼭 확인하세요’를 읽고, 회사 광고심의 기준에 따라 게시합니다.'
      ].map(t => el('li', {}, ...rich(t)))),
      el('h4', {}, '알아 두면 좋은 것'),
      bullets([
        '**보관 취소** — [보관 취소]를 누르면 글이 작성글모음으로 돌아가 다른 설계사가 가져갈 수 있습니다. 오늘 보관 횟수는 돌아오지 않습니다.',
        '**‘최신 내용 반영 초안’ 표시 글** — 같은 주제를 최신 자료로 다시 확인해 만든 새 글입니다. 원래 글은 그대로 남습니다.',
        '**주제 요청** — 원하는 주제가 없으면 제목 줄 입력칸에 적고 [요청]을 누르세요. 하루 3개까지이고, 진행 상황은 ‘내 요청’에서 봅니다. 고객 이름·연락처는 적지 않습니다.'
      ]),
      sources(['이 화면의 실제 기능(2026년 11월 24일 기준)']));

    const search = section('search', '2. 검색에 잘 뜨는 법 (네이버·구글)',
      bullets([
        '**제목은 글 내용을 그대로 요약합니다.** 구글은 제목이 내용을 잘 설명하는지, 과장하거나 놀라게 하지 않는지 스스로 점검하라고 안내합니다.',
        '**직접 겪은 일을 넣고, 남의 글을 그대로 옮기지 않습니다.** 구글은 다른 글을 요약만 한 글보다 직접 겪은 경험이 드러나는 글을 권합니다. 네이버도 원문을 그대로 퍼 온 글보다 원본 글을 먼저 보여 주겠다고 밝힌 바 있습니다(2013년).',
        '**누가 썼는지 밝힙니다.** 구글은 작성자 정보(이름·소개)를 넣기를 권하고, 건강·돈·안전에 큰 영향을 주는 주제일수록 믿을 수 있는 글을 더 중요하게 본다고 밝혔습니다. 보험 글은 정확성이 먼저입니다.',
        '**검색어를 여러 번 넣기보다 질문에 맞는 내용을 씁니다.** 네이버는 검색어가 들어간 글을 찾아 주는 데 그치지 않고, 찾는 사람의 의도별로 글을 묶어 보여 줍니다(스마트블록).',
        '**글자 수를 채우거나 날짜만 바꾸지 않습니다.** 구글은 선호하는 글자 수가 없다고 밝혔고, 내용이 그대로인데 날짜만 바꾸는 것을 좋지 않은 신호로 봅니다.'
      ]),
      sources('gHelpful', 'nSmart', 'nWeb'));

    const ai = section('ai', '3. AI 답변에 인용되는 법',
      el('p', { class: 'ag-lead' }, 'AI 답변(구글 AI 개요, 네이버 AI 브리핑, ChatGPT 검색 등)은 요약과 함께 근거가 된 글을 링크로 보여 줍니다. 내 글이 그 근거로 쓰일 가능성을 높이는 방법입니다.'),
      bullets([
        '**기본은 검색과 같습니다.** 구글은 AI 답변도 기존 검색의 순위·품질 시스템에 뿌리를 둔다고 밝혔습니다. AI용 파일이나 특별한 표시는 필요 없고, 글을 잘게 쪼개 쓸 필요도 없다고 합니다.',
        '**흔한 정리보다 내 경험과 관점을 씁니다.** 구글은 누구나 아는 내용을 다시 정리한 글보다 직접 겪은 내용이 담긴 글을 권합니다. 네이버도 ‘실제 경험’과 ‘인사이트(내 관점)’가 담긴 글을 AI의 핵심 자산이라고 밝혔습니다.',
        '**출처·숫자·인용문을 붙입니다.** 한 연구(GEO, 2024)에서는 글에 출처, 통계, 인용문을 더했을 때 AI 답변에 반영되는 정도가 최대 40%쯤 늘었습니다. 검색어를 반복해 넣는 방법은 효과가 거의 없었습니다. 실험 결과이므로 실제 서비스에서 같은 효과가 난다고 볼 수는 없습니다.',
        '**공식 자료를 근거로 답니다.** 네이버 AI 브리핑의 ‘공식형’은 정부·공공기관 같은 공식 출처로 답을 만듭니다. 숫자와 제도를 쓸 때는 공공기관·법령 같은 공식 자료를 출처로 적어 두세요.',
        '**보장되는 방법은 없습니다.** 구글은 조건을 갖춰도 노출이 보장되지 않는다고 밝혔고, ChatGPT 검색도 노출 위치를 보장하지 않는다고 안내합니다.'
      ]),
      sources('gAi', 'nBrief', 'nUgc', 'geo', 'oai'));

    const checks = section('check', '4. 올리기 전 점검표', check.node, sources('gHelpful', ['이 화면의 ‘게시 전에 꼭 확인하세요’ 안내']));

    const tag = (n, label) => [el('span', { class: 'ag-tag' }, el('b', {}, String(n)), ' ' + label), ' '];
    const ex = section('ex', '5. 고치기 전·후 예시',
      el('p', { class: 'ag-lead' }, '‘보험금 청구 기간’ 글의 첫 부분을 고친 예입니다. 바뀐 세 군데를 보세요.'),
      el('div', { class: 'ag-ex is-before' }, el('p', { class: 'ag-ex-label' }, '고치기 전'),
        el('p', {}, '안녕하세요. 오늘은 많은 분이 궁금해하시는 보험금 청구 기간에 대해 알아보겠습니다. 보험은 만일을 대비하는 소중한 제도인데요, 끝까지 읽어 보시면 도움이 되실 겁니다.')),
      el('div', { class: 'ag-ex is-after' }, el('p', { class: 'ag-ex-label' }, '고친 뒤'),
        el('p', {}, tag(1, '답부터'), '보험금을 청구할 수 있는 기간은 3년입니다. 이 기간 안에 청구하지 않으면 받을 권리가 사라집니다.'),
        el('p', {}, tag(2, '내 경험'), '상담을 하다 보면 오래된 병원 영수증을 뒤늦게 찾아 문의하시는 분이 많습니다. 그래서 저는 진료를 받은 날 영수증을 사진으로 찍어 두시라고 말씀드립니다.'),
        el('p', {}, tag(3, '날짜·출처'), '기준일 2026년 11월 24일 · 출처: 상법 제662조(소멸시효), 국가법령정보센터')),
      bullets([
        '**답부터** — 인사말 대신 찾는 사람이 궁금해하는 답을 첫 문단에 씁니다.',
        '**내 경험** — 실제로 겪은 일만 쓰고, 고객을 알아볼 수 있는 내용(이름·나이·병명 등)은 뺍니다.',
        '**날짜·출처** — 언제 기준인지와 어디서 확인했는지를 적습니다. 숫자와 조문은 올리기 전에 직접 다시 확인하세요.'
      ]),
      sources('gHelpful', 'geo'));

    body = el('div', { class: 'ag-body', tabindex: '-1' }, sum, use, search, ai, checks, ex,
      el('p', { class: 'ag-end' }, el('button', { type: 'button', class: 'g-btn g-btn--ghost g-btn--sm', onclick: () => dlg.close() }, '닫고 글 고르러 가기')));
    secNodes = [sum, use, search, ai, checks, ex];
    dlg = el('dialog', { class: 'ag', id: 'art-guide', 'aria-labelledby': 'ag-title', closedby: 'any' },
      el('div', { class: 'ag-head' },
        el('div', { class: 'ag-top' },
          el('div', {}, el('h2', { class: 'ag-title', id: 'ag-title' }, '작성글 노하우'), el('p', { class: 'ag-sub' }, '작성글모음 활용법과 검색·AI 답변에 더 잘 보이게 고치는 법 · 읽는 데 약 5분')),
          close),
        el('nav', { class: 'ag-nav', 'aria-label': '안내 바로가기' }, ...navButtons)),
      body);
    document.body.append(dlg);
    check.draw();

    // 바깥(어두운 곳)을 눌렀다 뗐을 때만 닫는다 — 안에서 글자를 끌다가 밖에서 떼는 경우는 닫지 않음
    let downOutside = false;
    dlg.addEventListener('pointerdown', ev => { downOutside = ev.target === dlg; });
    dlg.addEventListener('click', ev => { if (ev.target === dlg && downOutside && dlg.open) dlg.close(); downOutside = false; });
    // 열려 있는 동안 Tab 은 안에서만 돈다
    dlg.addEventListener('keydown', ev => {
      if (ev.key !== 'Tab') return;
      const items = [...dlg.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(n => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], now = document.activeElement;
      if (ev.shiftKey && (now === first || !dlg.contains(now) || now === body)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && now === last) { ev.preventDefault(); first.focus(); }
    });
    dlg.addEventListener('close', () => {
      opener.setAttribute('aria-expanded', 'false');
      const target = opener.offsetParent !== null ? opener : document.getElementById('main');
      if (target) target.focus({ preventScroll: true });
    });
    let ticking = false;
    body.addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; spy(); }); }, { passive: true });
  }

  const calm = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function jump(id) {
    const node = secNodes.find(n => n.id === 'ag-' + id); if (!node) return;
    body.scrollTo({ top: node === secNodes[0] ? 0 : node.offsetTop + 8, behavior: calm() ? 'auto' : 'smooth' });   // 구역 위 여백 안쪽으로 맞춰 앞 구역 끝줄이 걸쳐 보이지 않게
    const h = node.querySelector('h3'); if (h) h.focus({ preventScroll: true });
    mark(id);
  }
  function mark(id) {
    navButtons.forEach(b => {
      const on = b.getAttribute('data-sec') === id;
      if (on) { b.setAttribute('aria-current', 'true'); if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } else b.removeAttribute('aria-current');
    });
  }
  function spy() {
    if (!body) return;
    const y = body.scrollTop + 60, end = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
    let current = secNodes[0];
    if (end) current = secNodes[secNodes.length - 1]; else secNodes.forEach(n => { if (n.offsetTop <= y) current = n; });
    const id = current.id.slice(3);
    const now = navButtons.find(b => b.hasAttribute('aria-current'));
    if (!now || now.getAttribute('data-sec') !== id) mark(id);
  }

  function open() {
    if (!dlg) build();
    if (dlg.open) return;
    dlg.showModal();
    opener.setAttribute('aria-expanded', 'true');
    spy();
  }
  opener.setAttribute('aria-expanded', 'false');
  opener.addEventListener('click', open);

  // ── 주소 #guide ── 목록을 쓸 수 있는 회원(body.art-on)일 때만 연다. 열 때 주소에서 #guide 를 지워 글 주소(#a=)·뒤로 가기와 섞이지 않게 한다.
  const allowed = () => document.body.classList.contains('art-on');
  const setUrl = url => { try { history.replaceState(history.state, '', url); } catch (_) { /* 주소를 못 바꿔도 여는 데는 지장 없음 */ } };
  let pending = location.hash === '#guide';
  function sync() {
    if (pending && allowed()) { pending = false; if (location.hash === '#guide') setUrl(location.pathname + location.search); open(); }
    if (!allowed() && dlg && dlg.open) dlg.close();   // 로그인 정보가 바뀌어 화면을 비울 때는 안내도 닫는다
  }
  window.addEventListener('hashchange', ev => {
    if (location.hash !== '#guide') return;
    let back = location.pathname + location.search;
    try { const old = new URL(ev.oldURL); if (old.origin === location.origin && old.pathname === location.pathname && old.hash !== '#guide') back += old.hash; } catch (_) {}
    setUrl(back);   // 보던 글(#a=…)이나 목록 주소로 되돌려 둔다 — replaceState 는 화면을 다시 그리지 않는다
    if (allowed()) open(); else pending = true;
  });
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
