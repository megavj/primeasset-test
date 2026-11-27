/* TASK-ART 내 정보 › 내 보관함(2026-11-09). 작성글모음에서 [보관]한 글 목록과 복사 버튼([HTML 복사]·[서식 그대로 복사]).
   목록은 art_my_locker(본인 것만), 버튼을 누를 때 art_get으로 본문을 받아 온다(한 번 받으면 다시 쓰기).
   2026-11-17 UX: 하루 3개씩 쌓이므로 — 보관한 글 찾기(6개부터), 10개씩 [더 보기], 빈 보관함 안내, 보관 취소 결과 표시.
   서버 함수·인자는 그대로이며 찾기·더 보기는 이미 받은 목록으로 화면에서만 처리한다.
   2026-11-27 이사님: 보관한 글이 늘어도 헷갈리지 않게 [올릴 글]·[올린 글] 두 칸. 글마다 [업로드 완료]·[완료 취소], 올린 주소는 적어도 되고 안 적어도 된다.
   서버 art_my_uploads·art_set_uploaded(새 함수). 새 함수가 없으면(되돌린 경우) 예전처럼 한 줄 목록으로 보인다. */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, U = window.PA_ASK_ACCOUNT;
  if (!K || !U) return;
  const { el, kDate } = K;
  const PAGE = 10, SEARCH_FROM = 6;
  const norm = s => String(s || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  function mount(ctx) {
    ctxRef = ctx;
    const body = el('div', { class: 'art-locker-wrap' }, U.note('보관한 글을 불러오는 중…'));
    const node = U.card('내 보관함', body);
    node.id = 'art-locker';
    let flash = '';   // 보관 취소 뒤 한 번 보여 줄 결과
    let up = new Map(), tab = 'todo';   // 올린 글 표시(글 번호 → {uploaded_at, upload_url}), 보고 있는 칸
    load();
    return node;
    async function load() {
      try {
        await ctx.verify();
        const [list, quota, ups] = await Promise.all([ctx.sb.rpc('art_my_locker'), ctx.sb.rpc('art_my_quota'), ctx.sb.rpc('art_my_uploads')]);
        ctx.check();
        if (list.error) throw list.error;
        const items = list.data || [], q = (quota.data || [])[0] || null;
        const canMark = !ups.error;   // 올린 글 기능(새 서버 함수)이 있을 때만 두 칸
        up = new Map((canMark ? ups.data || [] : []).map(u => [u.article_id, u])); upRef = up;
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
        const nodes = new Map();   // 글마다 한 번만 만든다(받아 둔 본문·복사 결과 표시가 검색 중에도 남게). 올림 표시가 바뀌면 그 글만 다시 만든다
        const nodeOf = x => nodes.get(x.id) || (nodes.set(x.id, item(x, canMark ? moved : null)), nodes.get(x.id));
        const inTab = x => !canMark || (tab === 'done') === up.has(x.id);
        const tabBtn = (id, label) => el('button', { type: 'button', role: 'tab', class: 'art-locker-tab', 'data-tab': id, onclick: () => { tab = id; shownCount = PAGE; draw(0); } }, label);
        const tabs = canMark ? el('div', { class: 'art-locker-tabs', role: 'tablist', 'aria-label': '보관한 글 나눠 보기' }, tabBtn('todo', '올릴 글'), tabBtn('done', '올린 글')) : null;
        function moved(x, msg) {   // 업로드 완료·완료 취소 뒤: 그 글을 다시 만들고 지금 칸을 다시 그린다
          nodes.delete(x.id); flashLine.textContent = msg; flashLine.hidden = false; draw(0);
        }
        function draw(from) {
          const terms = query.split(/\s+/).map(norm).filter(Boolean);
          const all = items.filter(x => terms.every(w => hay.get(x.id).includes(w)));
          const found = all.filter(inTab);
          if (tabs) {
            const nDone = items.filter(x => up.has(x.id)).length;
            for (const b of tabs.children) {
              const on = b.dataset.tab === tab, n = b.dataset.tab === 'done' ? nDone : items.length - nDone;
              b.setAttribute('aria-selected', String(on)); b.classList.toggle('is-on', on);
              b.replaceChildren(b.dataset.tab === 'done' ? '올린 글 ' : '올릴 글 ', el('b', {}, String(n)));
            }
          }
          const label = !canMark ? '보관한 글' : tab === 'done' ? '올린 글' : '올릴 글';
          count.textContent = terms.length ? `${label} 중 ${found.length}개 찾음` : `${label} ${found.length}개`;
          const page = found.slice(from, shownCount).map(nodeOf);
          if (!found.length) ol.replaceChildren(el('li', { class: 'art-locker-none' }, terms.length ? '찾는 글이 없습니다. 검색어를 바꿔 보세요.'
            : tab === 'done' ? '아직 올린 글이 없습니다. 블로그에 올린 뒤 [올릴 글] 칸에서 [업로드 완료]를 눌러 주세요.' : '보관한 글을 모두 올렸습니다.'));
          else if (from > 0) { ol.append(...page); page[0]?.querySelector('h3 a')?.focus({ preventScroll: true }); }
          else ol.replaceChildren(...page);
          const rest = found.length - Math.min(found.length, shownCount);
          more.hidden = rest <= 0; more.textContent = `더 보기 (남은 ${rest}개)`;
        }
        const flashLine = el('p', { class: 'art-locker-flash', role: 'status', hidden: true });
        draw(0);
        body.replaceChildren(...[notice,
          el('div', { class: 'art-locker-head' },
            U.note('보관한 글은 나만 볼 수 있습니다. 필요한 부분을 고친 뒤 금소법 심의를 받고 게시하세요.'), K.copyHint()),
          quotaRow, tabs, flashLine,
          el('div', { class: 'art-locker-bar' }, count, search),
          ol, el('div', { class: 'art-more-wrap' }, more)].filter(Boolean));
      } catch (e) {
        if (e && e.code === 'stale_session') return;
        console.debug('[art locker]', e);
        body.replaceChildren(U.note('보관한 글을 불러오지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요.'), U.button('다시 불러오기', load));
      }
    }
    function item(x, moved) {
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
      const t = x.tags || {}, href = '/members/articles/#a=' + x.id, u = up.get(x.id), canMark = !!moved;
      return el('li', { onpointerenter: warm, onfocusin: warm, ontouchstart: warm },
        x.thumb ? el('img', { class: 'art-locker-thumb', src: x.thumb, alt: '', loading: 'lazy', width: '96', height: '64' }) : el('span', { class: 'art-locker-thumb', 'aria-hidden': 'true' }),
        el('div', { class: 'art-locker-text' }, el('h3', {}, el('a', { href }, x.title)),
          el('p', { class: 'art-locker-meta' }, [u ? `${kDate(u.uploaded_at)} 업로드 완료` : null, t.draft ? `최신 내용 반영 초안 · ${kDate(x.created_at)} 작성` : `${kDate(x.claimed_at)} 보관`, K.isProduct && K.isProduct(t) ? K.PRODUCT_LABEL : null, t.insurance, t.format, x.chars ? `약 ${Number(x.chars).toLocaleString('ko-KR')}자` : null].filter(Boolean).join(' · ')),
          K.searchMeta(t)),
        el('div', { class: 'art-locker-acts' },
          K.actionButtons(getArticle, status, { copyOnly: true }),   // 2026-11-12 이사님: 그림 내려받기·해시태그 복사·최신내용 반영판 삭제
          canMark ? uploadBox(x, u, status, moved) : null,
          el('div', { class: 'art-locker-sub' }, el('a', { class: 'art-locker-link', href }, '글 보기 · 게시 전 안내 →'),
            K.unclaimButton(ctx.sb, x.id, status, () => { flash = `「${x.title}」 글을 작성글모음으로 되돌렸습니다.`; load(); }, () => ctx.check()))),   // 2026-11-12 이사님: 보관 취소
        status);
    }
  }
  // ── 올린 글 표시(2026-11-27) ─────────────────────────────
  function uploadBox(x, u, status, moved) {
    const say = t => { status.textContent = t; };
    const call = async (done, url) => {
      await ctxRef.verify();
      const r = await ctxRef.sb.rpc('art_set_uploaded', { p_id: x.id, p_done: done, p_url: url });
      ctxRef.check();
      if (r.error) throw r.error;
      return (r.data || [])[0] || null;
    };
    if (!u) {
      return el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act art-upload', title: '블로그에 올렸으면 눌러 주세요. [올린 글] 칸으로 옮겨집니다', onclick: async ev => {
        const b = ev.currentTarget; b.disabled = true; say('표시하는 중…');
        try {
          const row = await call(true, null);
          if (!row || !row.ok) { say('표시하지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; return; }
          upRef.set(x.id, { article_id: x.id, uploaded_at: row.uploaded_at, upload_url: row.upload_url });
          moved(x, `「${x.title}」 글을 [올린 글] 칸으로 옮겼습니다. 올린 주소는 [올린 글] 칸에서 적을 수 있습니다(선택).`);
        } catch (e) { if (e && e.code === 'stale_session') return; console.debug('[art upload]', e); say('표시하지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; }
      } }, '✓ 업로드 완료');
    }
    const input = el('input', { type: 'url', class: 'ask-account-input art-upload-url', placeholder: '올린 글 주소 (선택)', 'aria-label': '올린 글 주소 (선택)', value: u.upload_url || '', autocomplete: 'off', inputmode: 'url', maxlength: '500' });
    const save = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act art-upload-save', onclick: async ev => {
      const v = input.value.trim();
      if (v && !/^https?:\/\/\S+$/.test(v)) { say('주소는 http:// 또는 https:// 로 시작해야 합니다.'); input.focus(); return; }
      const b = ev.currentTarget; b.disabled = true; say('저장하는 중…');
      try {
        const row = await call(true, v);
        if (!row || !row.ok) { say(row && row.code === 'bad_url' ? '주소 모양이 올바르지 않습니다.' : '저장하지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; return; }
        upRef.set(x.id, { article_id: x.id, uploaded_at: row.uploaded_at, upload_url: row.upload_url });
        say(v ? '올린 주소를 저장했습니다.' : '올린 주소를 지웠습니다.'); b.disabled = false; syncLink(row.upload_url);
      } catch (e) { if (e && e.code === 'stale_session') return; console.debug('[art upload url]', e); say('저장하지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; }
    } }, '주소 저장');
    const link = el('a', { class: 'art-locker-link art-upload-open', target: '_blank', rel: 'noopener noreferrer' }, '올린 글 열기 ↗');
    const syncLink = v => { if (v) { link.href = v; link.hidden = false; } else { link.removeAttribute('href'); link.hidden = true; } };
    syncLink(u.upload_url);
    const undo = el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act art-upload-undo', title: '업로드 완료 표시를 지우고 [올릴 글] 칸으로 되돌립니다', onclick: async ev => {
      if (!window.confirm('업로드 완료 표시를 취소하고 [올릴 글] 칸으로 되돌릴까요?\n적어 둔 올린 주소도 함께 지워집니다.')) return;
      const b = ev.currentTarget; b.disabled = true; say('되돌리는 중…');
      try {
        const row = await call(false, null);
        if (!row || !row.ok) { say('되돌리지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; return; }
        upRef.delete(x.id);
        moved(x, `「${x.title}」 글을 [올릴 글] 칸으로 되돌렸습니다.`);
      } catch (e) { if (e && e.code === 'stale_session') return; console.debug('[art upload undo]', e); say('되돌리지 못했습니다. 다시 눌러 주세요.'); b.disabled = false; }
    } }, '완료 취소');
    return el('div', { class: 'art-upload-box' }, el('div', { class: 'art-upload-row' }, input, save), el('div', { class: 'art-upload-row' }, link, undo));
  }
  let ctxRef = null, upRef = null;

  window.PA_ART_LOCKER = { mount };
})();
