/* 승인 회원 홈 전용 배치. 서버·권한·질문 저장 방식은 기존 기능을 사용합니다. */
(function () {
  'use strict';
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    kids.forEach(k => { if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k))); });
    return n;
  };
  const icon = type => {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    Object.entries({ viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }).forEach(([k,v]) => svg.setAttribute(k,v));
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ({ tool: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', guide: 'M12 6.5C10.3 5 7.8 4.5 4 4.5v14c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-14c-3.8 0-6.3.5-8 2zM12 6.5v14', qa: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7', ask: 'M4 4h16v12H9l-5 4z', phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2', portal: 'M4 5h16v11H4zM8 20h8M12 16v4', menu: 'M4 6h16M4 12h16M4 18h16', collapse: 'M15 5l-7 7 7 7', plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M18 6L6 18', lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z', article: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3', keep: 'M7 3h10v18l-5-4-5 4z' })[type] || 'M4 4h16v16H4z');
    svg.append(path); return svg;
  };
  const read = (k, fallback) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; } catch (_) { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
  window.PA_MEMBERS_CHAT = Object.freeze({
    create({ sb, ask, tools, choRx, owner, profile, banner, onAuthFailure }) {
      const api = window.PA_ASK.create(sb), mask = window.PA_ASK.maskResidentId;
      const pinKey = 'pa_pinned_tools_v1:' + owner, labelKey = 'pa_pin_labels_v1:' + owner, collapseKey = 'pa_chat_sidebar_v1:' + owner;
      const saved = read(pinKey, []);
      let pins = [...new Set((Array.isArray(saved) ? saved : []).filter(k => typeof k === 'string'))];
      // 같은 계정별 저장 위치를 그대로 사용합니다. 옛 page:product·사라진 메뉴 키도 임의로 지우지 않습니다.
      const savedLabels = read(labelKey, {});
      const labels = savedLabels && typeof savedLabels === 'object' && !Array.isArray(savedLabels) ? savedLabels : {};
      let alive = true, drawer = false, collapsed = read(collapseKey, false) === true, historyEpoch = 0, menuTrigger = null, menuItem = null;
      let recent = [], posts = [];
      const announce = el('p', { class: 'sr', role: 'status', 'aria-live': 'polite' });
      const moreMenu = el('div', { class: 'pa-pin-menu', id: 'pa-pin-menu', role: 'menu', hidden: '', 'aria-label': '항목 고정' });
      function closeMenu(focus = false) {
        moreMenu.hidden = true;
        if (menuTrigger) { menuTrigger.setAttribute('aria-expanded', 'false'); if (focus && menuTrigger.isConnected) menuTrigger.focus(); }
        menuTrigger = null;
      }
      function togglePin(item) {
        const was = pins.includes(item.key);
        pins = was ? pins.filter(k => k !== item.key) : [...pins, item.key];
        if (!was && item.type !== 'tool') labels[item.key] = { title: item.title };
        const persisted = write(pinKey, pins); write(labelKey, labels);
        const originKey = item.key;
        closeMenu(); drawPins();
        announce.textContent = item.title + (was ? ' 고정을 해제했습니다.' : ' 상단에 고정했습니다.') + (persisted ? '' : ' 저장 공간을 사용할 수 없어 이번 화면에서만 유지됩니다.');
        const candidates = [...sidebar.querySelectorAll('[data-more-key]')];
        const target = candidates.find(n => n.dataset.moreKey === originKey && !n.closest('[hidden]'));
        if (target) target.focus();
      }
      const pinAction = el('button', { type: 'button', role: 'menuitem', onclick: () => { if (menuItem) togglePin(menuItem); } });
      moreMenu.append(pinAction);
      moreMenu.addEventListener('keydown', e => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); pinAction.focus(); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
        if (e.key === 'Tab') closeMenu(true);
      });
      function openMenu(trigger, item) {
        const same = menuTrigger === trigger && !moreMenu.hidden;
        closeMenu(); if (same) return;
        menuTrigger = trigger; menuItem = item;
        trigger.setAttribute('aria-expanded', 'true');
        pinAction.textContent = pins.includes(item.key) ? '고정 해제' : '상단 고정';
        moreMenu.hidden = false;
        const r = trigger.getBoundingClientRect(), m = moreMenu.getBoundingClientRect();
        moreMenu.style.left = Math.max(8, Math.min(innerWidth - m.width - 8, r.right - m.width)) + 'px';
        moreMenu.style.top = (r.bottom + m.height + 8 > innerHeight ? Math.max(8, r.top - m.height - 4) : r.bottom + 4) + 'px';
        pinAction.focus();
      }
      const isMobile = () => matchMedia('(max-width: 760px)').matches;
      const toolsBody = el('div', { class: 'pa-side-items' });
      const pinBody = el('div', { class: 'pa-side-items' });
      const postBody = el('div', { class: 'pa-side-items' }, el('p', { class: 'pa-side-note' }, '보험자료를 불러오는 중…'));
      const historyBody = el('div', { class: 'pa-side-items' }, el('p', { class: 'pa-side-note' }, '질문 내역을 불러오는 중…'));
      function section(id, title, body, link) {
        return el('section', { class: 'pa-side-section', id, 'aria-labelledby': id + '-title' }, el('h2', { id: id + '-title', tabindex: '-1' }, title), body, link);
      }
      const pinSection = section('pa-pinned', '고정됨', pinBody); pinSection.hidden = true;
      const query = el('input', { class: 'pa-side-search pa-in', type: 'search', placeholder: '도구 찾기 · 초성 가능', 'aria-label': '업무 도구 찾기', 'aria-controls': 'pa-side-tools', autocomplete: 'off', oninput: () => drawTools() });
      toolsBody.id = 'pa-side-tools';
      const toolsSection = section('directory', '업무 도구', el('div', {}, query, toolsBody));
      // 2026-11-12 이사님 승인: 빠른 확인 창 두 개(손생보 연락망 · 원수사 전산접속)
      const quickBtn = (label, glyph, fn) => el('div', { class: 'pa-side-row' }, el('button', { type: 'button', class: 'pa-side-link', onclick: () => { if (!window.PA_QUICK) return; if (isMobile()) setDrawer(false); fn(); } }, icon(glyph), el('span', { class: 'pa-side-label' }, label)));
      // 2026-11-12 이사님 지시: 빠른 확인 두 개를 '새 대화' 위로(맨 위 고정)
      const quickSection = el('div', { class: 'pa-side-items pa-side-quick pa-side-quicktop', id: 'pa-quick' },
        // 2026-11-24 이사님 지시: 손생보 연락망 위에 '인트라넷 가이드' 강조 버튼(안내 페이지 새 탭)
        el('div', { class: 'pa-side-row pa-side-guide-row' }, el('a', { class: 'pa-side-link pa-side-guide', href: '/guide/intranet/', target: '_blank', rel: 'noopener' }, icon('guide'), el('span', { class: 'pa-side-label' }, '인트라넷 가이드'), el('span', { class: 'pa-side-guide-new', 'aria-hidden': 'true' }, 'NEW'))),
        quickBtn('손생보 연락망', 'phone', () => window.PA_QUICK.openContacts(sb, profile)),
        quickBtn('원수사 전산접속', 'portal', () => window.PA_QUICK.openPortals()));
      // 2026-11-17 UX: 가운데(질문창 아래) 바로가기 — 휴대폰에서는 사이드바가 접혀 있어 자주 쓰는 것이 두 번 눌러야 나왔다.
      //   작성글모음·내 보관함은 서버가 내려준 메뉴(my_menu)에 작성글모음 주소가 '열림'으로 있을 때만 보인다(권한 판정은 그대로 서버·관리자 메뉴 설정).
      const pathOf = url => { try { return new URL(url, location.origin).pathname; } catch (_) { return ''; } };
      const artTool = tools.find(t => t.unlocked && t.url && t.internal && pathOf(t.url) === '/members/articles/');
      const shortBtn = (label, glyph, fn) => el('button', { type: 'button', class: 'pa-home-short-item', 'data-in-sidebar': '', onclick: () => { if (window.PA_QUICK) fn(); } }, icon(glyph), el('span', {}, label));
      const shortLink = (label, glyph, href) => el('a', { class: 'pa-home-short-item', href }, icon(glyph), el('span', {}, label));
      const shortcuts = el('nav', { class: 'pa-home-short', 'aria-label': '바로가기' },
        shortBtn('손생보 연락망', 'phone', () => window.PA_QUICK.openContacts(sb, profile)),
        shortBtn('원수사 전산접속', 'portal', () => window.PA_QUICK.openPortals()),
        artTool ? shortLink('작성글모음', 'article', artTool.url) : null,
        artTool ? shortLink('내 보관함', 'keep', '/members/me/#art-locker') : null);
      // Reuse the same authenticated list as 작성글모음. It never includes other members' saved articles.
      const latestList = el('ul', { class: 'pa-latest-list' });
      const latest = artTool ? el('section', { class: 'pa-home-latest', hidden: '', 'aria-labelledby': 'pa-home-latest-title' },
        el('div', { class: 'pa-latest-head' }, el('h3', { id: 'pa-home-latest-title' }, '새 작성글'),
          el('a', { class: 'pa-latest-all', href: artTool.url }, '전체 보기', el('span', { 'aria-hidden': 'true' }, '→'))), latestList) : null;
      const articleStore = 'https://ztypllzgjivutzorhayz.supabase.co/storage/v1/object/public/articles/';
      const displayDay = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
      function articleCard(row, timestamp) {
        const fallback = icon('article');
        const media = el('span', { class: 'pa-latest-media', 'aria-hidden': 'true' }, fallback);
        // Only the existing article bucket; do not fetch arbitrary image URLs from metadata.
        if (typeof row.thumb === 'string' && row.thumb.startsWith(articleStore) && !/[\\\s"'<>]/.test(row.thumb)) {
          try {
            const src = new URL(row.thumb);
            if (src.href.startsWith(articleStore) && /\.(?:png|webp|jpe?g|avif)$/i.test(src.pathname)) {
              const img = el('img', { alt: '', decoding: 'async', loading: 'lazy', referrerpolicy: 'no-referrer' });
              img.addEventListener('load', () => { fallback.remove(); img.classList.add('is-loaded'); }, { once: true });
              img.addEventListener('error', () => img.remove(), { once: true });
              media.append(img);
              img.src = src.href;
            }
          } catch (_) { /* Leave the quiet default cover. */ }
        }
        const koreanDay = Number.isFinite(timestamp) ? new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10) : '';
        return el('li', {}, el('a', { class: 'pa-latest-card', href: '/members/articles/#a=' + row.id }, media,
          el('span', { class: 'pa-latest-copy' }, el('span', { class: 'pa-latest-title' }, row.title.trim()),
            koreanDay ? el('time', { class: 'pa-latest-date', datetime: koreanDay }, displayDay.format(timestamp)) : null)));
      }
      async function loadLatest() {
        if (!latest) return;
        latest.hidden = true;
        latestList.replaceChildren();
        try {
          const reply = await sb.rpc('art_list');
          if (!alive || reply.error || !Array.isArray(reply.data)) return;
          const rows = reply.data.filter(row => row && typeof row.title === 'string' && row.title.trim() &&
            typeof row.id === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(row.id));
          const time = row => Date.parse(row.created_at);
          rows.sort((a, b) => (time(b) || 0) - (time(a) || 0));
          latestList.replaceChildren(...rows.slice(0, 3).map(row => articleCard(row, time(row))));
          latest.hidden = !latestList.childElementCount;
        } catch (_) { /* A failed optional list must never block the composer. */ }
      }
      const onPageShow = event => { if (event.persisted) loadLatest(); };
      const postSection = section('news', '최근 등록 보험자료', postBody, el('a', { class: 'pa-side-all', href: '/qa/' }, '전체 보기'));
      const historySection = section('pa-chat-history', '최근 AI 질문', historyBody, el('a', { class: 'pa-side-all', href: '/members/me/#ask-history' }, '전체 내역'));
      const newChat = el('button', { type: 'button', class: 'pa-side-new', onclick: () => {
        if (ask.resetChat()) { if (isMobile()) setDrawer(false); }
        else announce.textContent = '답변을 확인한 뒤 새 대화를 시작해 주세요.';
      } }, icon('plus'), '새 대화');
      const close = el('button', { type: 'button', class: 'pa-side-close pa-chat-icon', 'aria-label': '사이드바 접기', onclick: () => {
        if (isMobile()) setDrawer(false); else { collapsed = true; write(collapseKey, true); syncSidebar(); opener.focus(); }
      } }, icon('collapse'));
      const sidebar = el('aside', { class: 'pa-chat-sidebar', id: 'pa-chat-sidebar', 'aria-label': '업무 바로가기' },
        quickSection,
        el('div', { class: 'pa-side-top' }, newChat, close),
        el('div', { class: 'pa-side-scroll' }, pinSection, toolsSection, postSection, historySection,
          banner ? el('div', { class: 'pa-side-access' }, banner) : null),
        el('div', { class: 'pa-side-account' },
          el('div', { class: 'pa-side-me' }, el('a', { href: '/members/me/', title: '내 정보' }, [profile.name, profile.branch].filter(Boolean).join(' · ') || '내 정보'),
            artTool ? el('a', { class: 'pa-side-keep', href: '/members/me/#art-locker' }, '내 보관함') : null),
          el('a', { class: 'pa-side-privacy', href: '/privacy/' }, '개인정보처리방침')));
      const opener = el('button', { type: 'button', class: 'pa-chat-icon pa-side-open', 'aria-label': '사이드바 펼치기', 'aria-controls': sidebar.id, 'aria-expanded': 'false', onclick: () => {
        if (isMobile()) setDrawer(true); else { collapsed = false; write(collapseKey, false); syncSidebar(); close.focus(); }
      } }, icon('menu'), el('span', { class: 'pa-side-open-label' }, '업무 도구'));   // 2026-11-17 UX: 휴대폰에서 이름 없는 ☰ 가 위 '메뉴'와 헷갈려 글자를 붙임
      const backdrop = el('button', { type: 'button', class: 'pa-side-backdrop', tabindex: '-1', hidden: '', 'aria-label': '사이드바 닫기', onclick: () => setDrawer(false) });
      const center = el('div', { class: 'pa-chat-center' }, el('div', { class: 'pa-chat-toolbar' }, opener), ask.node);
      // 2026-11-11 대표 지시: 환영 문구에 이름 ('김상현님 무엇을 도와드릴까요?'), 빈 열을 만들던 '설계사 인트라넷' 글자 제거
      const hi = ask.node.querySelector('.pa-chat-welcome h2');
      if (hi) hi.replaceChildren(el('img', { class: 'pa-welcome-mark', src: '/assets/logo.svg', width: '30', height: '33', alt: '' }),
        el('span', {}, profile.name ? profile.name + '님 무엇을 도와드릴까요?' : hi.textContent));
      const ex = ask.node.querySelector('.pa-chat-examples');
      if (ex) {
        if (latest) ex.before(latest);
        ex.after(shortcuts);
      } else {
        if (latest) ask.node.append(latest);
        ask.node.append(shortcuts);
      }
      const node = el('section', { class: 'pa-chat-shell', id: 'home', 'aria-label': '설계사 인트라넷' }, backdrop, sidebar, center, announce);
      sidebar.append(moreMenu);
      function syncSidebar() {
        const mobile = isMobile(), shown = mobile ? drawer : !collapsed;
        node.classList.toggle('is-collapsed', !mobile && collapsed); node.classList.toggle('is-drawer-open', mobile && drawer);
        sidebar.inert = !shown; sidebar.setAttribute('aria-hidden', String(!shown));
        if (mobile && drawer) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); }
        else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); }
        center.inert = mobile && drawer;
        // 모바일 서랍이 열리면 공통 상단 메뉴도 키보드 이동에서 제외합니다.
        const header = document.querySelector('.g-nav'); if (header) header.inert = mobile && drawer;
        backdrop.hidden = !(mobile && drawer); opener.setAttribute('aria-expanded', String(shown));
        opener.setAttribute('aria-label', mobile ? '업무 사이드바 열기' : '사이드바 펼치기');
        close.setAttribute('aria-label', mobile ? '사이드바 닫기' : '사이드바 접기');
      }
      function setDrawer(value) {
        drawer = value; closeMenu(); syncSidebar();
        if (value) newChat.focus(); else opener.focus();
      }
      function asTool(tool, key = tool.key) { return { key, type: 'tool', title: tool.name, tool }; }
      const asPost = x => ({ key: 'qa:' + x.slug, type: 'qa', title: x.question, slug: x.slug });
      const asQuestion = x => ({ key: 'ask:' + x.id, type: 'ask', title: x.question, id: x.id });
      function resolvePin(key) {
        const tool = key === 'page:product' ? tools.find(r => r.name === '상품통합분석기') : tools.find(r => r.key === key);
        if (tool) return asTool(tool, key);
        if (key.startsWith('qa:')) return asPost(posts.find(r => 'qa:' + r.slug === key) || { slug: key.slice(3), question: labels[key]?.title || '고정한 보험자료' });
        if (key.startsWith('ask:')) return asQuestion(recent.find(r => 'ask:' + r.id === key) || { id: key.slice(4), question: labels[key]?.title || '고정한 AI 질문' });
        return null;
      }
      function row(item) {
        const title = mask(item.title || '제목 없음').split(/\r?\n/)[0];
        const glyph = icon(item.type), name = el('span', { class: 'pa-side-label' }, title);
        let primary;
        if (item.type === 'tool') {
          const tool = item.tool;
          primary = tool.unlocked && tool.url
            ? el('a', { class: 'pa-side-link', href: tool.url, title: tool.description || title, ...(tool.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) }, glyph, name)
            : el('span', { class: 'pa-side-link is-locked', 'aria-disabled': 'true', title: tool.unlocked ? '주소 준비 중입니다' : '현재 등급에서는 잠김' }, glyph, name, icon('lock'), el('span', { class: 'sr' }, tool.unlocked ? '주소 준비 중' : '잠김'));
        } else if (item.type === 'qa') primary = el('a', { class: 'pa-side-link', href: '/qa/?p=' + encodeURIComponent(item.slug), title }, glyph, name);
        else primary = el('button', { type: 'button', class: 'pa-side-link', title, onclick: () => {
          if (ask.busy) { announce.textContent = '진행 중인 답변을 확인한 뒤 이전 질문을 열어 주세요.'; return; }
          if (isMobile()) setDrawer(false);
          ask.openHistory({ id: item.id, question: item.title });
        } }, glyph, name);
        const more = el('button', { type: 'button', class: 'pa-side-more', 'data-more-key': item.key, 'aria-label': title + ' 더 보기', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': moreMenu.id, onclick: e => openMenu(e.currentTarget, item), onkeydown: e => {
          if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); openMenu(e.currentTarget, item); }
        } }, el('span', { 'aria-hidden': 'true' }, '…'));
        return el('div', { class: 'pa-side-row', 'data-item-key': item.key }, primary, more);
      }
      function drawPins() {
        const items = pins.map(resolvePin).filter(Boolean);
        pinSection.hidden = !items.length; pinBody.replaceChildren(...items.map(row));
      }
      function drawTools() {
        const terms = query.value.trim().toLowerCase().split(/\s+/).filter(Boolean).map(choRx);
        const found = tools.filter(t => terms.every(rx => rx.test(t.name.toLowerCase()) || rx.test(t.name.toLowerCase().replace(/\s/g, ''))));
        toolsBody.replaceChildren(...(found.length ? found.map(t => row(asTool(t))) : [el('p', { class: 'pa-side-note', role: 'status' }, '맞는 도구가 없습니다.')]));
      }
      function authError(error) {
        if (!['unauthorized', 'forbidden', 'login_required', 'invalid_token', 'expired', 'not_active', 'stale_session'].includes(error.code)) return false;
        if (alive && onAuthFailure) onAuthFailure(); return true;
      }
      async function refreshHistory() {
        const generation = ++historyEpoch;
        try {
          const response = await api.request('askMyStats', {});
          if (!alive || generation !== historyEpoch) return;
          recent = (Array.isArray(response.stats?.recent) ? response.stats.recent : []).slice(0, 10);
          historyBody.replaceChildren(...(recent.length ? recent.map(x => row(asQuestion(x))) : [el('p', { class: 'pa-side-note' }, '아직 질문 내역이 없습니다.')]));
          drawPins();
        } catch (error) {
          if (!alive || generation !== historyEpoch || authError(error)) return;
          historyBody.replaceChildren(el('p', { class: 'pa-side-note' }, '질문 내역을 불러오지 못했습니다.'), el('button', { class: 'pa-side-all', type: 'button', onclick: refreshHistory }, '다시 시도'));
        }
      }
      async function loadPosts() {
        try {
          const response = await sb.from('qa_member_posts').select('slug,question,meta');
          if (response.error) throw response.error;
          if (!alive) return;
          posts = (response.data || []).filter(x => x.slug && x.question).sort((a,b) => (Date.parse(b.meta?.datePublished || b.meta?.date) || 0) - (Date.parse(a.meta?.datePublished || a.meta?.date) || 0));
          postBody.replaceChildren(...(posts.length ? posts.slice(0, 5).map(x => row(asPost(x))) : [el('p', { class: 'pa-side-note' }, '등록된 보험자료가 없습니다.')]));
          drawPins();
        } catch (_) {
          if (alive) postBody.replaceChildren(el('p', { class: 'pa-side-note' }, '보험자료를 불러오지 못했습니다.'), el('button', { class: 'pa-side-all', type: 'button', onclick: loadPosts }, '다시 시도'));
        }
      }
      function onKey(e) {
        if (e.key === 'Escape' && !moreMenu.hidden) { e.preventDefault(); closeMenu(true); return; }
        if (!drawer || !isMobile()) return;
        if (e.key === 'Escape') { e.preventDefault(); setDrawer(false); }
        if (e.key === 'Tab') {
          const focusable = [...sidebar.querySelectorAll('a[href],button,input')].filter(n => !n.disabled && n.getClientRects().length && !n.closest('[hidden]'));
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      const outside = e => { if (!moreMenu.hidden && !moreMenu.contains(e.target) && e.target !== menuTrigger && !menuTrigger?.contains(e.target)) closeMenu(); };
      const onScroll = () => closeMenu();
      const onResize = () => {
        closeMenu(); if (!isMobile()) drawer = false;
        syncSidebar();
        const top = node.getBoundingClientRect().top;
        const viewport = window.visualViewport;
        node.style.height = Math.max(240, (viewport ? viewport.height + viewport.offsetTop : innerHeight) - top - 8) + 'px';
      };
      const onSection = e => {
        if (isMobile()) setDrawer(true); else { collapsed = false; write(collapseKey, false); syncSidebar(); }
        const target = e.detail === 'directory' ? toolsSection : postSection;
        const scroll = sidebar.querySelector('.pa-side-scroll');
        scroll.scrollTop = target.offsetTop - scroll.offsetTop; target.querySelector('h2').focus({ preventScroll: true });
      };
      const onStorage = e => {
        if (e.key === pinKey) { const value = read(pinKey, []); if (Array.isArray(value)) { pins = [...new Set(value.filter(k => typeof k === 'string'))]; drawPins(); } }
      };
      let observer;
      drawTools(); drawPins();
      return { node, refreshHistory,
        mount() {
          document.body.classList.add('pa-chat-layout');
          document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', outside);
          window.addEventListener('resize', onResize); window.addEventListener('pa:chat-section', onSection); window.addEventListener('storage', onStorage);
          window.visualViewport?.addEventListener('resize', onResize);
          sidebar.querySelector('.pa-side-scroll').addEventListener('scroll', onScroll);
          observer = new ResizeObserver(onResize); observer.observe(document.querySelector('.g-nav'));
          window.addEventListener('pageshow', onPageShow);
          onResize(); loadPosts(); refreshHistory(); loadLatest();
        },
        dispose() {
          alive = false; historyEpoch++; api.dispose(); observer?.disconnect();
          document.body.classList.remove('pa-chat-layout');
          const header = document.querySelector('.g-nav'); if (header) header.inert = false;
          document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', outside);
          window.removeEventListener('pageshow', onPageShow);
          window.removeEventListener('resize', onResize); window.removeEventListener('pa:chat-section', onSection); window.removeEventListener('storage', onStorage);
          window.visualViewport?.removeEventListener('resize', onResize);
        }
      };
    }
  });
})();
