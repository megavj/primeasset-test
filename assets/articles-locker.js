/* TASK-ART 내 정보 › 내 보관함(2026-11-09). 작성글모음에서 [보관]한 글 목록과 복사 버튼([HTML 복사]·[서식 그대로 복사]).
   목록은 art_my_locker(본인 것만), 버튼을 누를 때 art_get으로 본문을 받아 온다(한 번 받으면 다시 쓰기).
   2026-11-17 UX: 하루 3개씩 쌓이므로 — 보관한 글 찾기(6개부터), 10개씩 [더 보기], 빈 보관함 안내, 보관 취소 결과 표시.
   서버 함수·인자는 그대로이며 찾기·더 보기는 이미 받은 목록으로 화면에서만 처리한다. */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, U = window.PA_ASK_ACCOUNT;
  if (!K || !U) return;
  const { el, kDate } = K;
  const PAGE = 10, SEARCH_FROM = 6;
  const norm = s => String(s || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  function mount(ctx) {
    const body = el('div', { class: 'art-locker-wrap' }, U.note('보관한 글을 불러오는 중…'));
    const node = U.card('내 보관함', body);
    node.id = 'art-locker';
    let flash = '';   // 보관 취소 뒤 한 번 보여 줄 결과
    load();
    return node;
    async function load() {
      try {
        await ctx.verify();
        const [list, quota] = await Promise.all([ctx.sb.rpc('art_my_locker'), ctx.sb.rpc('art_my_quota')]);
        ctx.check();
        if (list.error) throw list.error;
        const items = list.data || [], q = (quota.data || [])[0] || null;
        if (!items.length && !(q && q.allowed)) { node.remove(); return; } // 쓸 수 없는 등급이고 보관한 글도 없으면 칸을 숨김
        const pick = primary => el('a', { class: 'g-btn ' + (primary ? 'g-btn--pri' : 'g-btn--ghost') + ' art-locker-pick', href: '/members/articles/' }, '작성글모음에서 글 고르기');
        const quotaRow = q && q.allowed ? el('div', { class: 'art-locker-quota' + (q.remaining > 0 ? '' : ' is-full') },
          el('span', { class: 'art-quota-dots', 'aria-hidden': 'true' }, ...Array.from({ length: q.daily_limit }, (_, i) => el('i', { class: i < q.used ? 'is-used' : '' }))),
          el('span', { class: 'art-quota-text' }, ...K.quotaLine(q)),
          items.length ? pick(false) : null) : null;
        const notice = flash ? el('p', { class: 'art-locker-flash', role: 'status' }, flash) : null; flash = '';
        if (!items.length) {
          body.replaceChildren(...[notice, quotaRow, el('div', { class: 'art-empty art-locker-empty' }, el('h3', {}, '아직 보관한 글이 없습니다'),
            el('p', {}, '작성글모음에서 마음에 드는 글을 보관하면 여기에 모입니다.'), q && q.allowed ? pick(true) : null)].filter(Boolean));
          return;
        }
        // 찾기 · 더 보기
        let shownCount = PAGE, query = '';
        const hay = new Map(items.map(x => { const t = x.tags || {}; return [x.id, norm([x.title, t.insurance, t.format, K.channelOf(t), ...(K.hashtags(t) || [])].join(' '))]; }));
        const ol = el('ol', { class: 'art-locker' });
        const count = el('p', { class: 'art-count', role: 'status', 'aria-live': 'polite' });
        const more = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-more', hidden: true, onclick: () => { const from = shownCount; shownCount += PAGE; draw(from); } });
        const search = items.length >= SEARCH_FROM ? el('input', { type: 'search', class: 'ask-account-input art-locker-search', placeholder: '보관한 글 찾기 (제목·보험 종류)', 'aria-label': '보관한 글 찾기', enterkeyhint: 'search', autocomplete: 'off' }) : null;
        if (search) search.addEventListener('input', () => { query = search.value; shownCount = PAGE; draw(0); });
        const nodes = new Map();   // 글마다 한 번만 만든다(받아 둔 본문·복사 결과 표시가 검색 중에도 남게)
        const nodeOf = x => nodes.get(x.id) || (nodes.set(x.id, item(x)), nodes.get(x.id));
        function draw(from) {
          const terms = query.split(/\s+/).map(norm).filter(Boolean);
          const found = items.filter(x => terms.every(w => hay.get(x.id).includes(w)));
          count.textContent = terms.length ? `${items.length}개 중 ${found.length}개` : `보관한 글 ${items.length}개`;
          const page = found.slice(from, shownCount).map(nodeOf);
          if (!found.length) ol.replaceChildren(el('li', { class: 'art-locker-none' }, '찾는 글이 없습니다. 검색어를 바꿔 보세요.'));
          else if (from > 0) { ol.append(...page); page[0]?.querySelector('h3 a')?.focus({ preventScroll: true }); }
          else ol.replaceChildren(...page);
          const rest = found.length - Math.min(found.length, shownCount);
          more.hidden = rest <= 0; more.textContent = `더 보기 (남은 ${rest}개)`;
        }
        draw(0);
        body.replaceChildren(...[notice,
          el('div', { class: 'art-locker-head' },
            U.note('보관한 글은 나만 볼 수 있습니다. 필요한 부분을 고친 뒤 회사 광고심의를 받고 게시하세요.'), K.copyHint()),
          quotaRow,
          el('div', { class: 'art-locker-bar' }, count, search),
          ol, el('div', { class: 'art-more-wrap' }, more)].filter(Boolean));
      } catch (e) {
        if (e && e.code === 'stale_session') return;
        console.debug('[art locker]', e);
        body.replaceChildren(U.note('보관한 글을 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.'), U.button('다시 불러오기', load));
      }
    }
    function item(x) {
      // 본문은 버튼 근처에 손가락·마우스가 오면 미리 받아 둔다 → 누르는 순간 바로(동기로) 복사할 수 있게
      let cached = null, ready = null;
      const fetchIt = () => cached || (cached = (async () => {
        await ctx.verify();
        const r = await ctx.sb.rpc('art_get', { p_id: x.id });
        ctx.check();
        if (r.error || !r.data || !r.data[0]) { cached = null; throw r.error || new Error('art_not_found'); }
        ready = r.data[0]; return ready;
      })());
      const getArticle = () => ready || fetchIt();
      const warm = () => { fetchIt().catch(() => {}); };
      const status = el('p', { class: 'art-status', role: 'status', 'aria-live': 'polite' });
      const t = x.tags || {}, href = '/members/articles/#a=' + x.id;
      return el('li', { onpointerenter: warm, onfocusin: warm, ontouchstart: warm },
        x.thumb ? el('img', { class: 'art-locker-thumb', src: x.thumb, alt: '', loading: 'lazy', width: '96', height: '64' }) : el('span', { class: 'art-locker-thumb', 'aria-hidden': 'true' }),
        el('div', { class: 'art-locker-text' }, el('h3', {}, el('a', { href }, x.title)),
          el('p', { class: 'art-locker-meta' }, [t.draft ? `최신 내용 반영 초안 · ${kDate(x.created_at)} 작성` : `${kDate(x.claimed_at)} 보관`, K.isProduct && K.isProduct(t) ? K.PRODUCT_LABEL : null, t.insurance, t.format, x.chars ? `약 ${Number(x.chars).toLocaleString('ko-KR')}자` : null].filter(Boolean).join(' · ')),
          K.searchMeta(t)),
        el('div', { class: 'art-locker-acts' },
          K.actionButtons(getArticle, status, { copyOnly: true }),   // 2026-11-12 이사님: 그림 내려받기·해시태그 복사·최신내용 반영판 삭제
          el('div', { class: 'art-locker-sub' }, el('a', { class: 'art-locker-link', href }, '글 보기 · 게시 전 안내 →'),
            K.unclaimButton(ctx.sb, x.id, status, () => { flash = `「${x.title}」 글을 작성글모음으로 되돌렸습니다.`; load(); }, () => ctx.check()))),   // 2026-11-12 이사님: 보관 취소
        status);
    }
  }
  window.PA_ART_LOCKER = { mount };
})();
