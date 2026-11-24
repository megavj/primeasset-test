/* TASK-ART 작성글모음(/members/articles/, 2026-11-09). 목록 → 글 보기 → [보관](내 정보 보관함으로 이동, 다른 설계사 목록에서 사라짐).
   권한·하루 3개 한도·동시 보관은 모두 서버 함수(art_list·art_get·art_claim·art_my_quota)가 판정한다. 이 화면은 결과를 보여 줄 뿐이다.
   주소: 목록 = /members/articles/ · 글 = /members/articles/#a=<글 번호> (보관함 글도 같은 주소, 본인 것만 열림). */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, C = window.PA_AUTH || {}, signup = window.PA_SIGNUP;
  const root = document.getElementById('art-app'), toastBox = document.getElementById('art-toast');
  if (!root || !K) return;
  const { el, kDate, tagChips } = K;
  const S = { sb: null, owner: null, profile: null, quota: null, list: null, filter: { q: '', ins: '', ch: '', fresh: false }, epoch: 0, view: '', back: null, leftAt: 0, shown: null, prefOwner: undefined };
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');
  const routeId = () => { const m = location.hash.match(/^#a=([0-9a-f-]{36})$/i); return m && isUuid(m[1]) ? m[1] : null; };
  const busy = on => on ? root.setAttribute('aria-busy', 'true') : root.removeAttribute('aria-busy');
  let toastTimer = 0;
  const toast = (text, bad) => { clearTimeout(toastTimer); toastBox.className = 'art-toast is-on' + (bad ? ' is-bad' : ''); toastBox.textContent = text; toastTimer = setTimeout(() => { toastBox.className = 'art-toast'; }, 6000); };
  const card = (...k) => el('div', { class: 'pa-card art-gate' }, ...k);
  const gate = (title, desc, ...extra) => { busy(false); S.view = ''; document.body.classList.remove('art-reading', 'art-on'); root.replaceChildren(card(el('h2', { class: 'pa-h3' }, title), desc ? el('p', {}, desc) : null, ...extra)); };
  const link = (href, text, pri) => el('a', { class: 'g-btn ' + (pri ? 'g-btn--pri' : 'g-btn--ghost'), href }, text);
  const errCode = e => String((e && (e.message || e.code)) || '');
  function failed(e, what) {
    console.debug('[articles]', what, e);
    const m = errCode(e);
    if (/art_forbidden|42501/.test(m)) return gate('현재 등급에서는 작성글모음을 이용할 수 없습니다', '이용 범위는 관리자가 등급에 따라 정합니다.', link('/members/#home', '인트라넷으로'));
    if (/art_not_found|P0002/.test(m)) return gate('글을 찾을 수 없습니다', '다른 설계사가 먼저 보관했거나, 지워진 글입니다.', el('div', { class: 'art-row' }, link('/members/articles/', '작성글모음 목록', true), link('/members/me/#art-locker', '내 보관함')));
    if (/JWT|token|401/i.test(m)) return gate('로그인이 만료되었습니다', '인트라넷에서 다시 로그인한 뒤 열어 주세요.', link('/members/#login', '로그인하기', true));
    gate(what, '연결을 확인한 뒤 다시 시도해 주세요.', el('button', { type: 'button', class: 'g-btn g-btn--pri', onclick: () => boot() }, '다시 시도'));
  }

  async function boot() {
    const epoch = ++S.epoch;
    busy(true);
    try {
      if (!C.url || !C.anonKey || !window.supabase || !signup) throw new Error('config');
      if (!S.sb) {
        S.sb = window.PA_SB || window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
        window.PA_SB = S.sb; // 공통 메뉴(site-nav)와 같은 세션
        // 다른 탭에서 로그아웃하거나 계정을 바꾸면 화면을 비운다
        S.sb.auth.onAuthStateChange((ev, next) => {
          if (ev === 'INITIAL_SESSION') return;
          const uid = next && next.user ? next.user.id : null;
          if (S.owner && uid !== S.owner) { S.epoch++; S.owner = null; S.profile = null; gate('로그인 정보가 바뀌었습니다', '다른 계정의 정보가 남지 않도록 화면을 비웠습니다.', el('button', { type: 'button', class: 'g-btn g-btn--pri', onclick: () => boot() }, '다시 열기')); }
        });
      }
      const { data: { session } } = await S.sb.auth.getSession();
      if (epoch !== S.epoch) return;
      if (!session) return gate('로그인이 필요합니다', '설계사 인트라넷에 로그인하면 작성글모음을 볼 수 있습니다.', link('/members/#login', '로그인하기', true));
      S.owner = session.user.id;
      const r = await S.sb.rpc('my_profile');
      if (epoch !== S.epoch) return;
      if (r.error) throw r.error;
      const p = await signup.resolveProfile(S.sb, r.data && r.data[0], session);
      if (epoch !== S.epoch) return;
      if (!signup.complete(p)) return gate('가입 정보를 먼저 입력해 주세요', '이름·휴대폰·소속 본부와 개인정보 동의를 마치면 가입 신청이 접수됩니다.', link('/members/#signup', '가입 정보 입력', true));
      if (p.status === 'pending') return gate('가입 승인 대기 중입니다', '관리자가 승인하면 작성글모음을 쓸 수 있습니다.', link('/members/#home', '인트라넷으로'));
      if (p.status !== 'active') return gate('이용할 수 없는 계정입니다', '문의는 관리자에게 해 주세요.');
      S.profile = p;
      document.body.classList.add('pa-logged');
      await route(epoch);
    } catch (e) { if (epoch === S.epoch) failed(e, '작성글모음을 불러오지 못했습니다'); }
  }
  async function loadQuota() {
    const q = await S.sb.rpc('art_my_quota'); if (q.error) throw q.error;
    S.quota = (q.data || [])[0] || null; return S.quota;
  }
  async function route(epoch = S.epoch) {
    const id = routeId();
    const q = await loadQuota(); if (epoch !== S.epoch) return;
    if (id) { if (S.view === 'list') S.back = { scroll: S.leftAt, shown: S.shown ? S.shown() : 0 }; return viewArticle(id, epoch); }
    if (!q || !q.allowed) return failed({ message: 'art_forbidden' });
    return listView(epoch);
  }
  // 글을 보고 목록으로 돌아오면 보던 자리로(목록은 서버에서 다시 받아 그리므로 브라우저 자동 복원 대신 직접 맞춘다)
  try { history.scrollRestoration = 'manual'; } catch (_) {}
  let lastY = 0;
  window.addEventListener('scroll', () => { if (S.view === 'list') lastY = window.scrollY; }, { passive: true });
  // 2026-11-24: #guide 는 [작성글 노하우] 서랍(articles-guide.js)이 맡는다 — 여기서는 화면을 다시 그리지 않는다(보던 목록·글 그대로).
  window.addEventListener('hashchange', () => { if (location.hash === '#guide') return; S.leftAt = lastY; if (S.profile) route().catch(e => failed(e, '화면을 바꾸지 못했습니다')); });

  // 2026-11-17 UX: 문구를 짧게(하루 개수는 점 3개와 괄호로, '한국시간'은 뺌)
  const quotaText = q => !q ? '' : q.remaining > 0 ? `오늘 ${q.remaining}개 더 보관할 수 있어요 (하루 ${q.daily_limit}개)` : `오늘은 ${q.daily_limit}개를 모두 보관했어요. 자정이 지나면 다시 보관할 수 있어요.`;
  function quotaBar() {
    const q = S.quota;
    return el('div', { class: 'art-quota' + (q && q.remaining === 0 ? ' is-full' : ''), role: 'status' },
      el('span', { class: 'art-quota-dots', 'aria-hidden': 'true' }, ...Array.from({ length: q ? q.daily_limit : 0 }, (_, i) => el('i', { class: i < q.used ? 'is-used' : '' }))),
      el('span', { class: 'art-quota-text' }, ...K.quotaLine(q)));
  }

  // ── 보관 ──
  async function claim(item, after) {
    const q = S.quota;
    if (q && q.remaining <= 0) { toast(quotaText(q), true); return; }
    if (!window.confirm(`이 글을 보관할까요?\n\n「${item.title}」\n\n보관하면 내 정보의 보관함으로 옮겨지고 다른 설계사 목록에서는 사라집니다.\n오늘 보관할 수 있는 수: ${q ? q.remaining : '?'}개 → ${q ? Math.max(0, q.remaining - 1) : '?'}개`)) return;
    try {
      const r = await S.sb.rpc('art_claim', { p_id: item.id });
      if (r.error) throw r.error;
      const x = (r.data || [])[0] || {};
      if (S.quota) { S.quota.remaining = x.remaining; S.quota.used = S.quota.daily_limit - x.remaining; }
      if (x.ok) { toast('보관했습니다. 이제 복사해서 쓸 수 있어요. 내 정보 › 보관함에도 들어 있습니다.'); after(true); return; }
      if (x.code === 'daily_limit') { toast(quotaText(S.quota), true); after(false); return; }
      if (x.code === 'mine') { toast('이미 내 보관함에 있는 글입니다.'); after(true); return; }
      toast('방금 다른 설계사가 먼저 보관한 글입니다. 목록을 새로 고칩니다.', true); after('gone');
    } catch (e) {
      if (/art_forbidden|42501/.test(errCode(e))) return failed(e);
      toast('보관하지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.', true);
    }
  }

  // ── 목록 ──
  // 2026-11-17 UX: 글이 하루 10개씩 늘어 수백 개가 되므로 — 최신순 고정, 20개씩 [더 보기], 오늘 올라온 글 '새 글' 표시·거르기,
  //   검색(제목·요약·보험 종류·채널·형식·해시태그, 띄어 쓴 낱말 모두 포함), 고른 보험 종류·채널은 이 기기에 기억, 글을 보고 돌아오면 보던 자리로.
  //   모두 art_list 가 이미 내려주는 자료로 화면에서만 처리한다(서버 함수·인자 그대로).
  const PAGE = 20;
  const kDay = t => { const d = new Date(Number.isNaN(t) ? 0 : t + 9 * 3600000); return d.toISOString().slice(0, 10); };   // 한국시간 날짜(YYYY-MM-DD)
  const norm = s => String(s || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  const prefKey = () => 'pa_art_filter_v1:' + (S.owner || '');
  function loadPref() {
    if (S.prefOwner === S.owner) return;
    S.prefOwner = S.owner;
    try { const v = JSON.parse(localStorage.getItem(prefKey()) || 'null'); if (v && typeof v === 'object') { S.filter.ins = typeof v.ins === 'string' ? v.ins : ''; S.filter.ch = typeof v.ch === 'string' ? v.ch : ''; } } catch (_) { /* 저장을 못 쓰는 브라우저에서는 기억하지 않음 */ }
  }
  function savePref() { try { localStorage.setItem(prefKey(), JSON.stringify({ ins: S.filter.ins, ch: S.filter.ch })); } catch (_) {} }
  async function listView(epoch) {
    busy(true);
    const r = await S.sb.rpc('art_list');
    if (epoch !== S.epoch) return;
    if (r.error) return failed(r.error, '글 목록을 불러오지 못했습니다');
    const time = x => Date.parse(x.created_at) || 0;
    S.list = (r.data || []).slice().sort((a, b) => time(b) - time(a));   // 최신순
    loadPref();
    const f = S.filter, today = kDay(Date.now());
    const chOf = x => K.channelOf(x.tags), insOf = x => (x.tags && x.tags.insurance) || '';
    const isNew = x => kDay(time(x)) === today;
    const hay = new Map(S.list.map(x => [x.id, norm([x.title, x.summary, insOf(x), chOf(x), x.tags && x.tags.format, ...(K.hashtags(x.tags) || [])].join(' '))]));
    const kinds = [...new Set(S.list.map(insOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    // 2026-11-17: 채널(네이버형·구글형·AI 인용형)로 거르기 — 채널이 있는 글이 하나라도 있을 때만 보인다.
    const chans = K.CHANNELS.filter(c => S.list.some(x => chOf(x) === c));
    const newCount = S.list.filter(isNew).length;
    // 기억해 둔 조건에 맞는 글이 지금은 없으면(다 보관됨 등) 조건을 풀어 빈 화면으로 시작하지 않게 한다
    if (f.ins && !kinds.includes(f.ins)) f.ins = '';
    if (f.ch && !chans.includes(f.ch)) f.ch = '';
    if (f.fresh && !newCount) f.fresh = false;
    const back = S.back; S.back = null;
    let shownCount = back ? Math.max(PAGE, back.shown) : PAGE;

    const search = el('input', { type: 'search', class: 'pa-in art-search', placeholder: '제목·내용·보험 종류로 찾기', 'aria-label': '글 찾기', value: f.q, enterkeyhint: 'search', autocomplete: 'off' });
    const status = el('p', { class: 'art-count', role: 'status', 'aria-live': 'polite' });
    const reset = el('button', { type: 'button', class: 'art-reset', hidden: true, onclick: () => { f.q = ''; f.ins = ''; f.ch = ''; f.fresh = false; search.value = ''; savePref(); changed(); } }, '조건 지우기');
    const grid = el('div', { class: 'art-grid' });
    const more = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-more', hidden: true, onclick: () => {
      const from = shownCount; shownCount += PAGE; draw(from);
    } });
    const chip = (label, key, value) => {
      const count = el('span', { class: 'art-chip-n' });
      const b = el('button', { type: 'button', class: 'art-chip', 'aria-pressed': 'false', onclick: () => {
        if (key === 'fresh') f.fresh = !f.fresh; else f[key] = value;
        if (key !== 'fresh') savePref();
        changed();
        if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } }, label, count);
      return { b, count, key, value };
    };
    const insChips = [chip('전체', 'ins', ''), ...kinds.map(k => chip(k, 'ins', k))];
    const chChips = [chip('전체', 'ch', ''), ...chans.map(c => chip(c, 'ch', c))];
    const freshChip = newCount ? chip('오늘 새 글', 'fresh', true) : null;
    const filterCurrent = el('span', { class: 'art-filter-current', hidden: true });
    const filter = el('details', { class: 'art-filter' },
      el('summary', {}, el('span', {}, '분류'), filterCurrent),
      el('div', { class: 'art-filter-body' },
        el('div', { class: 'art-chips', role: 'group', 'aria-label': '보험 종류로 거르기' }, el('span', { class: 'art-chips-label' }, '보험 종류'), ...insChips.map(c => c.b)),
        chans.length ? el('div', { class: 'art-chips art-chips--ch', role: 'group', 'aria-label': '채널로 거르기' }, el('span', { class: 'art-chips-label' }, '채널'), ...chChips.map(c => c.b)) : null,
        freshChip ? el('div', { class: 'art-chips', role: 'group', 'aria-label': '등록 날짜로 거르기' }, el('span', { class: 'art-chips-label' }, '등록 날짜'), freshChip.b) : null));
    const terms = () => f.q.split(/\s+/).map(norm).filter(Boolean);
    const match = (x, skip, t) => (skip === 'ins' || !f.ins || insOf(x) === f.ins) && (skip === 'ch' || !f.ch || chOf(x) === f.ch) && (skip === 'fresh' || !f.fresh || isNew(x)) && t.every(w => hay.get(x.id).includes(w));
    let shown = [];
    function changed() { shownCount = PAGE; draw(0); }
    // from: 이미 그려 둔 카드 수([더 보기]를 누르면 뒤에 덧붙이고, 조건이 바뀌면 0부터 다시 그린다)
    function draw(from) {
      const t = terms();
      shown = S.list.filter(x => match(x, '', t));
      // 칩의 숫자는 다른 조건(검색어·채널 등)을 적용한 뒤의 개수 — 눌렀을 때 몇 개가 나올지 미리 보인다
      const tally = (list, of) => { const m = new Map(); list.forEach(x => m.set(of(x), (m.get(of(x)) || 0) + 1)); return m; };
      const insBase = S.list.filter(x => match(x, 'ins', t)), chBase = S.list.filter(x => match(x, 'ch', t));
      const insN = tally(insBase, insOf), chN = tally(chBase, chOf);
      insChips.forEach(c => { const n = c.value ? insN.get(c.value) || 0 : insBase.length; c.count.textContent = ' ' + n; c.b.setAttribute('aria-pressed', String(f.ins === c.value)); c.b.classList.toggle('is-none', !n && f.ins !== c.value); });
      chChips.forEach(c => { const n = c.value ? chN.get(c.value) || 0 : chBase.length; c.count.textContent = c.value ? ' ' + n : ''; c.b.setAttribute('aria-pressed', String(f.ch === c.value)); c.b.classList.toggle('is-none', !n && f.ch !== c.value); });
      if (freshChip) { freshChip.count.textContent = ' ' + S.list.filter(x => match(x, 'fresh', t) && isNew(x)).length; freshChip.b.setAttribute('aria-pressed', String(!!f.fresh)); }
      const active = [f.ins, f.ch, f.fresh ? '오늘 새 글' : ''].filter(Boolean);
      filterCurrent.textContent = active.join(' · ');
      filterCurrent.hidden = !active.length;
      const filtered = !!(f.q.trim() || active.length);
      reset.hidden = !filtered;
      status.textContent = !S.list.length ? '' : filtered ? `${S.list.length}개 중 ${shown.length}개` : `글 ${S.list.length}개`;
      const page = shown.slice(from, shownCount);
      if (!shown.length) grid.replaceChildren(el('div', { class: 'art-empty' }, el('h2', { class: 'pa-h3' }, S.list.length ? '조건에 맞는 글이 없습니다' : '지금은 가져갈 글이 없습니다'),
        el('p', {}, S.list.length ? '검색어나 보험 종류·채널을 바꿔 보세요.' : '새 글이 올라오면 이곳에 보입니다.'),
        S.list.length ? el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => reset.click() }, '조건 지우고 전체 보기') : el('a', { class: 'g-btn g-btn--ghost', href: '/members/me/#art-locker' }, '내 보관함 보기')));
      else if (from > 0) { const nodes = page.map(cardOf); grid.append(...nodes); nodes[0]?.querySelector('.art-card-title a')?.focus({ preventScroll: true }); }
      else grid.replaceChildren(...page.map(cardOf));
      const rest = shown.length - Math.min(shown.length, shownCount);
      more.hidden = rest <= 0; more.textContent = `더 보기 (남은 ${rest}개)`;
    }
    function cardOf(x) {
      const open = '#a=' + x.id, fresh = isNew(x);
      const tags = tagChips(x.tags) || (fresh ? el('ul', { class: 'art-tags', 'aria-label': '글 분류' }) : null);
      if (fresh) tags.prepend(el('li', { class: 'is-new' }, '새 글'));
      return el('article', { class: 'art-card', 'data-article': x.id },
        x.thumb ? el('a', { class: 'art-thumb', href: open, tabindex: '-1', 'aria-hidden': 'true' }, el('img', { class: 'art-thumb-bg', src: x.thumb, alt: '', loading: 'lazy', decoding: 'async' }), el('img', { src: x.thumb, alt: '', loading: 'lazy', decoding: 'async', width: '600', height: '400' })) : null,   // ART3: 비율이 달라도 자르지 않음(뒤는 흐린 같은 그림)
        el('div', { class: 'art-card-body' },
          tags,
          K.seriesLabel(x.tags) ? el('p', { class: 'art-series' }, K.seriesLabel(x.tags)) : null,
          el('h2', { class: 'art-card-title' }, el('a', { href: open }, x.title)),
          el('p', { class: 'art-card-meta' }, [`${kDate(x.created_at)} 작성`, x.chars ? `약 ${Number(x.chars).toLocaleString('ko-KR')}자` : null].filter(Boolean).join(' · ')),
          x.summary ? el('p', { class: 'art-card-sum' }, x.summary) : null,
          el('div', { class: 'art-row art-card-acts' }, el('a', { class: 'g-btn g-btn--ghost art-sm', href: open }, '글 보기'),
            el('button', { type: 'button', class: 'g-btn g-btn--pri art-sm', disabled: !(S.quota && S.quota.remaining > 0), title: S.quota && S.quota.remaining > 0 ? null : '오늘 보관할 수 있는 수를 모두 썼습니다', 'aria-label': `보관: ${x.title}`, onclick: () => claim(x, ok => {
              if (ok === true) { S.list = S.list.filter(y => y.id !== x.id); location.hash = '#a=' + x.id; }
              else if (ok === 'gone') route();
              else listView(S.epoch);
            }) }, '보관'))));
    }
    search.addEventListener('input', () => { f.q = search.value; changed(); });
    draw(0);
    busy(false);
    S.view = 'list'; S.shown = () => shownCount;
    document.body.classList.remove('art-reading'); document.body.classList.add('art-on');   // art-on: 제목 옆 [내 보관함] 표시(쓸 수 있는 상태일 때만)
    root.replaceChildren(el('div', { class: 'art-find' }, quotaBar(), search), filter,
      el('div', { class: 'art-listbar' }, el('div', { class: 'art-listbar-left' }, status, reset)), grid,
      el('div', { class: 'art-more-wrap' }, more));
    window.scrollTo({ top: back ? back.scroll : 0, behavior: 'instant' });
  }

  // ── 글 보기 ──
  async function viewArticle(id, epoch) {
    busy(true);
    const r = await S.sb.rpc('art_get', { p_id: id });
    if (epoch !== S.epoch) return;
    if (r.error) return failed(r.error, '글을 불러오지 못했습니다');
    const a = (r.data || [])[0];
    if (!a) return failed({ message: S.quota && S.quota.allowed === false ? 'art_forbidden' : 'art_not_found' });
    const mine = a.mine === true, open = a.status === 'open', draft = a.status === 'draft';
    const status = el('p', { class: 'art-status', role: 'status', 'aria-live': 'polite' });
    const imgs = (a.images || []).length;
    const meta = el('p', { class: 'art-view-meta' }, [`${kDate(a.created_at)} 작성`, a.meta && a.meta.chars ? `약 ${Number(a.meta.chars).toLocaleString('ko-KR')}자` : null, `그림 ${imgs}장`,
      draft ? '최신 내용 반영 초안 · 광고심의 후 게시' : mine ? `${kDate(a.claimed_at)} 보관` : null].filter(Boolean).join(' · '));
    // 목록에서 들어온 글이면 [목록]은 '뒤로 가기'로 처리해 보던 자리·조건 그대로 돌아간다(주소로 바로 연 글은 평소처럼 목록 주소로)
    const toList = ev => { if (S.back && history.length > 1) { ev.preventDefault(); history.back(); } };
    const back = el('p', { class: 'art-back' }, ...(mine ? [el('a', { href: '/members/me/#art-locker' }, '← 내 보관함'), el('a', { href: '/members/articles/' }, '작성글모음')] : [el('a', { href: '/members/articles/', onclick: toList }, '← 작성글모음 목록'), el('a', { href: '/members/me/#art-locker' }, '내 보관함')]));
    const canClaim = !!(S.quota && S.quota.remaining > 0);
    const claimButton = label => el('button', { type: 'button', class: 'g-btn g-btn--pri', disabled: !canClaim, onclick: () => claim(a, ok => { if (ok === true || ok === false) viewArticle(id, S.epoch); else route(); }) }, label);
    let actions, tail = null;
    if (mine) actions = el('div', { class: 'art-actbar art-actbar--mine' }, K.actionButtons(() => a, status, { copyOnly: true }), K.copyHint(),
      status, el('div', { class: 'art-row art-row--end' }, K.unclaimButton(S.sb, a.id, status, () => { location.href = '/members/me/#art-locker'; }, () => { if (epoch !== S.epoch || !S.owner) throw new Error('stale_session'); })));
    else if (open) {
      // 2026-11-17 UX: 보관 전에는 못 누르는 복사 버튼 두 개를 빼고 한 줄 안내만(복사 버튼은 보관하면 바로 이 자리에 나온다). 글 끝에도 [보관하기]
      actions = el('div', { class: 'art-actbar' + (canClaim ? '' : ' is-full') }, el('div', { class: 'art-row' }, claimButton('보관하기'), el('span', { class: 'art-quota-inline' }, quotaText(S.quota))),
        el('p', { class: 'art-lock-note' }, '복사는 보관한 뒤에 할 수 있습니다.'), status);
      tail = el('div', { class: 'art-view-tail' }, el('p', {}, canClaim ? '이 글을 쓰시려면 보관해 주세요.' : quotaText(S.quota)),
        el('div', { class: 'art-row' }, claimButton('보관하기'), el('a', { class: 'g-btn g-btn--ghost', href: '/members/articles/', onclick: toList }, '목록으로')));
    } else actions = el('p', { class: 'art-lock-note' }, '관리자 보기 — 다른 회원이 보관한 글입니다. 보관 기록은 관리자 화면에서 확인합니다.');
    const body = K.render(a);
    if (open) body.classList.add('is-preview');
    busy(false);
    S.view = 'article';
    document.body.classList.add('art-reading', 'art-on');
    root.replaceChildren(...[back,
      el('article', { class: 'art-view' },
        el('header', { class: 'art-view-head' }, tagChips(a.meta), el('h2', { class: 'art-view-title', tabindex: '-1' }, a.title), meta, K.searchMeta(a.meta)),
        K.adNote(a.meta),   // ART4 상품광고 표시·심의필 자리
        actions,
        // 2026-11-12 이사님: 최신내용 반영판 만들기·요청상태 새로고침 삭제
        mine ? K.postingGuide(a.meta) : null,
        body,
        tail)]); // replaceChildren은 null도 글자로 넣으므로 배열에는 빈 값을 넣지 않는다(el은 빈 값을 건너뜀)
    window.scrollTo({ top: 0, behavior: 'instant' });
    root.querySelector('.art-view-title')?.focus({ preventScroll: true });
  }

  boot();
})();
