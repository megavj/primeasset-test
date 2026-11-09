/* TASK-ART 내 정보 › 내 글 보관함(2026-11-09). 작성글모음에서 [보관]한 글 목록과 같은 버튼([HTML 복사]·[서식 그대로 복사]·[그림 내려받기]).
   목록은 art_my_locker(본인 것만), 버튼을 누를 때 art_get으로 본문을 받아 온다(한 번 받으면 다시 쓰기). */
(function () {
  'use strict';
  const K = window.PA_ART_CORE, U = window.PA_ASK_ACCOUNT;
  if (!K || !U) return;
  const { el, kDate } = K;
  function mount(ctx) {
    const body = el('div', { class: 'art-locker-wrap' }, U.note('보관한 글을 불러오는 중…'));
    const node = U.card('내 글 보관함', body);
    node.id = 'art-locker';
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
        const head = el('div', { class: 'art-locker-head' },
          U.note('보관한 글은 나만 볼 수 있습니다. 고객 상황에 맞게 고치고 본인 경험 한두 줄을 더한 뒤, 회사 광고심의를 받고 게시하세요.'),
          q && q.allowed ? el('p', { class: 'ask-account-note' }, q.remaining > 0 ? `오늘 ${q.remaining}개 더 보관할 수 있어요 (하루 ${q.daily_limit}개 · 한국시간 자정 초기화) · ` : `오늘은 ${q.daily_limit}개를 모두 보관했어요 · `,
            el('a', { href: '/members/articles/' }, '작성글모음에서 글 고르기 →')) : null);
        body.replaceChildren(head, items.length ? el('ol', { class: 'art-locker' }, ...items.map(item)) : U.note('아직 보관한 글이 없습니다.'));
        if (location.hash === '#art-locker') node.scrollIntoView({ block: 'start' });
      } catch (e) {
        if (e && e.code === 'stale_session') return;
        console.debug('[art locker]', e);
        body.replaceChildren(U.note('보관한 글을 불러오지 못했습니다.'), U.button('다시 불러오기', load));
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
      const t = x.tags || {};
      return el('li', { onpointerenter: warm, onfocusin: warm, ontouchstart: warm },
        x.thumb ? el('img', { class: 'art-locker-thumb', src: x.thumb, alt: '', loading: 'lazy', width: '96', height: '64' }) : el('span', { class: 'art-locker-thumb', 'aria-hidden': 'true' }),
        el('div', {}, el('h3', {}, el('a', { href: '/members/articles/#a=' + x.id }, x.title)),
          el('p', { class: 'art-locker-meta' }, [`${kDate(x.claimed_at)} 보관`, t.insurance, t.format, x.chars ? `약 ${Number(x.chars).toLocaleString('ko-KR')}자` : null].filter(Boolean).join(' · ')),
          el('a', { class: 'art-locker-link', href: '/members/articles/#a=' + x.id }, '글 보기 · 게시 전 안내 →')),
        K.actionButtons(getArticle, status), status);
    }
  }
  window.PA_ART_LOCKER = { mount };
})();
