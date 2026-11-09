/* TASK-ART 작성글모음(/members/articles/, 2026-11-09). 목록 → 글 보기 → [보관](내 정보 보관함으로 이동, 다른 설계사 목록에서 사라짐).
   권한·하루 3개 한도·동시 보관은 모두 서버 함수(art_list·art_get·art_claim·art_my_quota)가 판정한다. 이 화면은 결과를 보여 줄 뿐이다.
   주소: 목록 = /members/articles/ · 글 = /members/articles/#a=<글 번호> (보관함 글도 같은 주소, 본인 것만 열림). */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, C = window.PA_AUTH || {}, signup = window.PA_SIGNUP;
  const root = document.getElementById('art-app'), toastBox = document.getElementById('art-toast');
  if (!root || !K) return;
  const { el, kDate, daysLeft, tagChips } = K;
  const S = { sb: null, owner: null, profile: null, quota: null, list: null, filter: { q: '', ins: '' }, epoch: 0 };
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');
  const routeId = () => { const m = location.hash.match(/^#a=([0-9a-f-]{36})$/i); return m && isUuid(m[1]) ? m[1] : null; };
  const busy = on => on ? root.setAttribute('aria-busy', 'true') : root.removeAttribute('aria-busy');
  let toastTimer = 0;
  const toast = (text, bad) => { clearTimeout(toastTimer); toastBox.className = 'art-toast is-on' + (bad ? ' is-bad' : ''); toastBox.textContent = text; toastTimer = setTimeout(() => { toastBox.className = 'art-toast'; }, 6000); };
  const card = (...k) => el('div', { class: 'pa-card art-gate' }, ...k);
  const gate = (title, desc, ...extra) => { busy(false); root.replaceChildren(card(el('h2', { class: 'pa-h3' }, title), desc ? el('p', {}, desc) : null, ...extra)); };
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
    if (id) return viewArticle(id, epoch);
    if (!q || !q.allowed) return failed({ message: 'art_forbidden' });
    return listView(epoch);
  }
  window.addEventListener('hashchange', () => { if (S.profile) route().catch(e => failed(e, '화면을 바꾸지 못했습니다')); });

  const quotaText = q => !q ? '' : q.remaining > 0 ? `오늘 ${q.remaining}개 더 보관할 수 있어요 (하루 ${q.daily_limit}개 · 한국시간 자정 초기화)` : `오늘은 ${q.daily_limit}개를 모두 보관했어요. 한국시간 자정에 다시 보관할 수 있어요.`;
  function quotaBar() {
    const q = S.quota;
    return el('div', { class: 'art-quota' + (q && q.remaining === 0 ? ' is-full' : ''), role: 'status' },
      el('span', { class: 'art-quota-dots', 'aria-hidden': 'true' }, ...Array.from({ length: q ? q.daily_limit : 0 }, (_, i) => el('i', { class: i < q.used ? 'is-used' : '' }))),
      el('span', { class: 'art-quota-text' }, quotaText(q)),
      el('a', { href: '/members/me/#art-locker' }, '내 보관함 보기 →'));
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
      if (x.ok) { toast('보관했습니다. 내 정보 › 내 글 보관함에서 언제든 다시 볼 수 있어요.'); after(true); return; }
      if (x.code === 'daily_limit') { toast(quotaText(S.quota), true); after(false); return; }
      if (x.code === 'mine') { toast('이미 내 보관함에 있는 글입니다.'); after(true); return; }
      toast('방금 다른 설계사가 먼저 보관한 글입니다. 목록을 새로 고칩니다.', true); after('gone');
    } catch (e) {
      if (/art_forbidden|42501/.test(errCode(e))) return failed(e);
      toast('보관하지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.', true);
    }
  }

  // ── 목록 ──
  async function listView(epoch) {
    busy(true);
    const r = await S.sb.rpc('art_list');
    if (epoch !== S.epoch) return;
    if (r.error) return failed(r.error, '글 목록을 불러오지 못했습니다');
    S.list = r.data || [];
    const f = S.filter;
    const kinds = [...new Set(S.list.map(x => x.tags && x.tags.insurance).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
    if (f.ins && !kinds.includes(f.ins)) f.ins = '';
    const search = el('input', { type: 'search', class: 'pa-in art-search', placeholder: '제목·요약으로 찾기', 'aria-label': '글 찾기', value: f.q });
    const chips = el('div', { class: 'art-chips', role: 'group', 'aria-label': '보험 종류로 거르기' });
    const status = el('p', { class: 'art-count', role: 'status' });
    const grid = el('div', { class: 'art-grid' });
    const drawChips = () => chips.replaceChildren(...[['', '전체'], ...kinds.map(k => [k, k])].map(([v, t]) => el('button', { type: 'button', class: 'art-chip', 'aria-pressed': String(f.ins === v), onclick: () => { f.ins = v; drawChips(); draw(); } }, t + (v ? ` ${S.list.filter(x => x.tags && x.tags.insurance === v).length}` : ` ${S.list.length}`))));
    const norm = s => String(s || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
    function draw() {
      const q = norm(f.q);
      const shown = S.list.filter(x => (!f.ins || (x.tags && x.tags.insurance === f.ins)) && (!q || norm(x.title + ' ' + x.summary).includes(q)));
      status.textContent = S.list.length ? `가져갈 수 있는 글 ${S.list.length}개${shown.length !== S.list.length ? ` 중 ${shown.length}개 표시` : ''}` : '';
      grid.replaceChildren(...(shown.length ? shown.map(cardOf) : [el('div', { class: 'art-empty' }, el('h2', { class: 'pa-h3' }, S.list.length ? '조건에 맞는 글이 없습니다' : '지금은 가져갈 글이 없습니다'), el('p', {}, S.list.length ? '검색어나 보험 종류를 바꿔 보세요.' : '새 글이 올라오면 이곳에 보입니다. 이미 보관한 글은 내 보관함에 있습니다.'))]));
    }
    function cardOf(x) {
      const left = daysLeft(x.expires_at);
      const open = '#a=' + x.id;
      return el('article', { class: 'art-card', 'data-article': x.id },
        x.thumb ? el('a', { class: 'art-thumb', href: open, tabindex: '-1', 'aria-hidden': 'true' }, el('img', { class: 'art-thumb-bg', src: x.thumb, alt: '', loading: 'lazy', decoding: 'async' }), el('img', { src: x.thumb, alt: '', loading: 'lazy', decoding: 'async', width: '600', height: '400' })) : null,   // ART3: 비율이 달라도 자르지 않음(뒤는 흐린 같은 그림)
        el('div', { class: 'art-card-body' },
          tagChips(x.tags),
          el('h2', { class: 'art-card-title' }, el('a', { href: open }, x.title)),
          x.summary ? el('p', { class: 'art-card-sum' }, x.summary) : null,
          el('p', { class: 'art-card-meta' }, [x.chars ? `약 ${Number(x.chars).toLocaleString('ko-KR')}자` : null, `${kDate(x.created_at)} 작성`, left != null ? `${left}일 뒤 자동 삭제` : null].filter(Boolean).join(' · ')),
          el('div', { class: 'art-row' }, el('a', { class: 'g-btn g-btn--ghost art-sm', href: open }, '글 보기'),
            el('button', { type: 'button', class: 'g-btn g-btn--pri art-sm', disabled: !(S.quota && S.quota.remaining > 0), onclick: () => claim(x, ok => {
              if (ok === true) { S.list = S.list.filter(y => y.id !== x.id); location.hash = '#a=' + x.id; }
              else if (ok === 'gone') route();
              else listView(S.epoch);
            }) }, '보관'))));
    }
    search.addEventListener('input', () => { f.q = search.value; draw(); });
    drawChips(); draw();
    busy(false);
    root.replaceChildren(quotaBar(), el('div', { class: 'art-tools' }, search, chips), status, grid,
      el('p', { class: 'art-foot-note' }, '보관하지 않은 글은 만든 날부터 60일이 지나면 그림과 함께 자동으로 지워집니다. 보관한 글은 지워지지 않습니다.'));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── 글 보기 ──
  async function viewArticle(id, epoch) {
    busy(true);
    const r = await S.sb.rpc('art_get', { p_id: id });
    if (epoch !== S.epoch) return;
    if (r.error) return failed(r.error, '글을 불러오지 못했습니다');
    const a = (r.data || [])[0];
    if (!a) return failed({ message: S.quota && S.quota.allowed === false ? 'art_forbidden' : 'art_not_found' });
    const mine = a.mine === true, open = a.status === 'open';
    const status = el('p', { class: 'art-status', role: 'status', 'aria-live': 'polite' });
    const left = daysLeft(a.expires_at);
    const imgs = (a.images || []).length;
    const meta = el('p', { class: 'art-view-meta' }, [a.meta && a.meta.chars ? `약 ${Number(a.meta.chars).toLocaleString('ko-KR')}자` : null, `그림 ${imgs}장`, `${kDate(a.created_at)} 작성`,
      mine ? `${kDate(a.claimed_at)} 보관` : open && left != null ? `${left}일 뒤 자동 삭제` : null].filter(Boolean).join(' · '));
    const back = el('p', { class: 'art-back' }, mine ? el('a', { href: '/members/me/#art-locker' }, '← 내 보관함') : el('a', { href: '/members/articles/' }, '← 작성글모음 목록'));
    let actions;
    if (mine) actions = el('div', { class: 'art-actbar' }, K.actionButtons(() => a, status), status);
    else if (open) {
      const claimBtn = el('button', { type: 'button', class: 'g-btn g-btn--pri', disabled: !(S.quota && S.quota.remaining > 0), onclick: () => claim(a, ok => { if (ok === true || ok === false) viewArticle(id, S.epoch); else route(); }) }, '보관하기');
      actions = el('div', { class: 'art-actbar' }, el('div', { class: 'art-row' }, claimBtn, el('span', { class: 'art-quota-inline' }, quotaText(S.quota))),
        K.actionButtons(() => a, status, { locked: true }),
        el('p', { class: 'art-lock-note' }, '복사·그림 내려받기는 보관한 뒤에 쓸 수 있습니다. 같은 글이 여러 블로그에 올라가면 검색에서 불리해서, 한 글은 한 사람만 가져갈 수 있습니다.'), status);
    } else actions = el('p', { class: 'art-lock-note' }, '관리자 보기 — 다른 회원이 보관한 글입니다. 보관 기록은 관리자 화면에서 확인합니다.');
    const body = K.render(a);
    if (open) body.classList.add('is-preview');
    busy(false);
    root.replaceChildren(back,
      el('article', { class: 'art-view' },
        el('header', { class: 'art-view-head' }, tagChips(a.meta), el('h2', { class: 'art-view-title', tabindex: '-1' }, a.title), meta),
        actions,
        mine ? K.postingGuide() : null,
        body,
        null),
      ...(mine ? [] : [quotaBar()])); // replaceChildren은 null도 글자로 넣으므로 빈 배열로
    window.scrollTo({ top: 0, behavior: 'instant' });
    root.querySelector('.art-view-title')?.focus({ preventScroll: true });
  }

  boot();
})();
