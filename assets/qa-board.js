/* 보험자료 게시판 — 로그인 승인 회원 전용 (2026-11-07).
   글 내용은 공개 파일에 없고, Supabase qa_member_posts(RLS: 승인 회원만)에서 읽어 옵니다.
   주소: /qa/ (목록) · /qa/?field=분야 · /qa/?q=검색어 · /qa/?p=글주소 · /qa/?page=2 */
(function () {
  const app = document.getElementById('qa-app');
  if (!app) return;
  const form = document.querySelector('[data-qa-search]');
  const input = document.getElementById('qa-q');
  const FIELDS = ['전체', '약관', '판례', '분쟁사례', '보상', '사업방법서', '요약서', '상품·비교'];
  const PER = 20;
  let rows = [];
  const hero = document.querySelector('main > .qa-hero');
  const showHero = on => { if (hero) hero.style.display = on ? '' : 'none'; };

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const link = (href, text, cls) => { const a = el('a', cls, text); a.href = href; return a; };
  const fmt = d => (d || '').slice(0, 10).replace(/-/g, '.');
  const field = r => (r.meta && r.meta.field) || '';
  const date = r => (r.meta && r.meta.date) || (r.updated_at || '').slice(0, 10);
  const url = params => { const u = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v && v !== '전체' && !(k === 'page' && v === 1)) u.set(k, v); }); const s = u.toString(); return '/qa/' + (s ? '?' + s : ''); };

  function gate(text, href, label) {
    const box = el('div', 'qa-gate');
    box.append(el('p', '', text));
    if (href) box.append(link(href, label, 'g-btn g-btn--gold'));
    app.replaceChildren(box);
    if (form) form.hidden = true;
  }

  function clean(htmlText) {
    const tpl = document.createElement('template'); tpl.innerHTML = htmlText || '';
    tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,img').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => n.removeAttribute(a.name)));
    return tpl.content;
  }
  const plain = r => { const d = document.createElement('div'); d.append(clean(r.body_html)); return d.textContent; };

  function renderList(params) {
    showHero(true);
    const f = FIELDS.includes(params.field) ? params.field : '전체';
    const q = (params.q || '').trim().toLowerCase();
    let list = rows.filter(r => f === '전체' || field(r) === f || (f === '상품·비교' && field(r) === '상품·비교'));
    if (q) list = list.filter(r => (r.question + ' ' + ((r.meta && (r.meta.tags || []).join(' ')) || '') + ' ' + plain(r)).toLowerCase().includes(q));
    const pages = Math.max(1, Math.ceil(list.length / PER));
    const page = Math.min(pages, Math.max(1, parseInt(params.page, 10) || 1));
    const frag = document.createDocumentFragment();

    const nav = el('nav'); nav.setAttribute('aria-label', '보험자료 분야');
    const ul = el('ul', 'qa-filters');
    FIELDS.forEach(name => { const li = el('li'); const a = link(url({ field: name }), name); if (name === f) a.setAttribute('aria-current', 'page'); li.append(a); ul.append(li); });
    nav.append(ul); frag.append(nav);

    const top = el('div', 'qa-board-top');
    top.append(el('p', '', q ? `‘${params.q}’ 검색 결과 ${list.length}건` : `전체 ${list.length}건`));
    frag.append(top);

    if (!list.length) {
      frag.append(el('p', 'qa-empty', q ? '검색 결과가 없습니다. 다른 낱말로 찾아 보세요.' : '아직 이 분야의 글이 없습니다.'));
    } else {
      const table = el('table', 'qa-board');
      const cap = el('caption', 'qa-sr', '보험자료 게시글 목록'); table.append(cap);
      const thead = el('thead'); const hr = el('tr');
      [['번호', 'qa-col-no'], ['분야', 'qa-col-field'], ['제목', 'qa-col-title'], ['대상', 'qa-col-aud'], ['등록일', 'qa-col-date']].forEach(([t, c]) => { const th = el('th', c, t); th.scope = 'col'; hr.append(th); });
      thead.append(hr); table.append(thead);
      const tb = el('tbody');
      list.slice((page - 1) * PER, page * PER).forEach((r, i) => {
        const tr = el('tr');
        tr.append(el('td', 'qa-col-no', String(list.length - ((page - 1) * PER + i))));
        tr.append(el('td', 'qa-col-field', field(r)));
        const td = el('td', 'qa-col-title'); td.append(link(url({ p: r.slug }), r.question, 'qa-board-link'));
        const sub = el('span', 'qa-board-sub', [field(r), (r.meta && r.meta.audience_label) || '', fmt(date(r))].filter(Boolean).join(' · ')); td.append(sub);
        tr.append(td);
        tr.append(el('td', 'qa-col-aud', (r.meta && r.meta.audience_label) || '전체'));
        const tdd = el('td', 'qa-col-date'); const t = el('time', '', fmt(date(r))); t.dateTime = date(r); tdd.append(t); tr.append(tdd);
        tb.append(tr);
      });
      table.append(tb); frag.append(table);
      if (pages > 1) {
        const pg = el('nav', 'qa-pager'); pg.setAttribute('aria-label', '페이지');
        for (let n = 1; n <= pages; n++) { const a = link(url({ field: f, q: params.q, page: n }), String(n)); if (n === page) a.setAttribute('aria-current', 'page'); pg.append(a); }
        frag.append(pg);
      }
    }
    app.replaceChildren(frag);
    document.title = (q ? '검색: ' + params.q + ' · ' : f !== '전체' ? f + ' · ' : '') + '보험자료 | 프라임에셋 프리미엄';
  }

  function renderPost(slug) {
    showHero(false);
    const idx = rows.findIndex(r => r.slug === slug);
    if (idx < 0) { app.replaceChildren(el('p', 'qa-empty', '글을 찾을 수 없습니다.'), link('/qa/', '← 목록으로', 'qa-back')); return; }
    const r = rows[idx], m = r.meta || {};
    const art = el('article', 'qa-article'); art.id = 'qa-article';
    art.append(link('/qa/', '← 보험자료 목록', 'qa-back'));
    const hd = el('header', 'qa-hero');
    hd.append(el('p', 'qa-eyebrow', '보험자료' + (m.audience_label ? ' · ' + m.audience_label : '')));
    hd.append(el('h1', '', r.question));
    const meta = el('div', 'qa-meta'); meta.append(el('span', 'qa-field', field(r))); const t = el('time', '', fmt(date(r))); t.dateTime = date(r); meta.append(t); hd.append(meta);
    art.append(hd);
    art.append(el('p', 'qa-member-note', '회원 전용 자료입니다. 외부 공유 금지.'));
    if (Array.isArray(m.summary3) && m.summary3.length) {
      const s = el('section', 'qa-summary'); s.append(el('h2', '', '핵심 답변')); const ol = el('ol'); m.summary3.forEach(x => ol.append(el('li', '', x))); s.append(ol); art.append(s);
    }
    const sec = el('section', 'qa-section'); sec.append(el('h2', '', '자세한 설명')); const body = el('div', 'qa-article-body'); body.append(clean(r.body_html)); sec.append(body); art.append(sec);
    if (Array.isArray(m.practice_points) && m.practice_points.length) {
      const s = el('section', 'qa-section'); s.append(el('h2', '', '설계사 실무 포인트')); const ul = el('ul', 'qa-practice'); m.practice_points.forEach(x => ul.append(el('li', '', x))); s.append(ul);
      if (Array.isArray(m.tags) && m.tags.length) { const tg = el('div', 'qa-tags'); m.tags.forEach(x => tg.append(el('span', '', '#' + x))); s.append(tg); }
      art.append(s);
    }
    const nav = el('nav', 'qa-post-nav'); nav.setAttribute('aria-label', '이전 글과 다음 글');
    const older = rows[idx + 1], newer = rows[idx - 1];
    if (older) { const a = link(url({ p: older.slug }), ''); a.append(el('span', '', '← 이전 글'), document.createTextNode(older.question)); nav.append(a); }
    if (newer) { const a = link(url({ p: newer.slug }), '', 'qa-next'); a.append(el('span', '', '다음 글 →'), document.createTextNode(newer.question)); nav.append(a); }
    art.append(nav);
    const all = el('div', 'qa-all-link'); all.append(link('/qa/', '목록 보기', 'g-btn g-btn--ghost')); art.append(all);
    app.replaceChildren(art);
    document.title = r.question + ' | 보험자료';
    window.scrollTo(0, 0);
  }

  function route() {
    const p = Object.fromEntries(new URLSearchParams(location.search));
    if (input) input.value = p.q || '';
    if (p.p) renderPost(p.p); else renderList(p);
  }

  async function start() {
    let sb;
    try { sb = await window.paClient(); } catch (_) { gate('로그인 기능을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); return; }
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (!session) { gate('보험자료는 로그인한 회원만 볼 수 있습니다.', '/members/#login', '로그인'); return; }
    const me = await sb.rpc('my_profile').setHeader('Authorization', 'Bearer ' + session.access_token);
    const profile = me.data && me.data[0];
    if (me.error || !profile) { gate('회원 정보를 확인하지 못했습니다. 다시 로그인해 주세요.', '/members/#login', '다시 로그인'); return; }
    if (profile.status !== 'active') { gate('보험자료는 가입 승인 후 볼 수 있습니다.', '/members/#home', '승인 상태 확인'); return; }
    const res = await sb.from('qa_member_posts').select('slug,question,body_html,meta,updated_at').setHeader('Authorization', 'Bearer ' + session.access_token);
    if (res.error) { gate('자료를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); return; }
    rows = (res.data || []).filter(r => r.meta && r.meta.date).sort((a, b) => (date(b) + (b.meta.slot === 'pm' ? '2' : '1')).localeCompare(date(a) + (a.meta.slot === 'pm' ? '2' : '1')));
    if (form) {
      form.hidden = false;
      form.addEventListener('submit', e => { e.preventDefault(); history.pushState(null, '', url({ q: input.value.trim() })); route(); });
    }
    app.addEventListener('click', e => {
      const a = e.target.closest('a'); if (!a || a.target || !a.href.startsWith(location.origin + '/qa/')) return;
      e.preventDefault(); history.pushState(null, '', a.href); route();
    });
    window.addEventListener('popstate', route);
    sb.auth.onAuthStateChange((ev, s) => { if (!s) gate('로그아웃되었습니다.', '/members/#login', '다시 로그인'); });
    route();
  }
  start();
})();
