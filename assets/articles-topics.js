/* ART-GUIDE 2026-11-24 이사님: 작성글모음 제목 줄의 주제 입력칸 — "원하는 게시글 주제를 적어주세요" → [요청].
   서버 함수(공용 계약 CONTRACT.md): art_topic_submit(p_topic) · art_topic_mine() · art_topic_cancel(p_id) · (있으면) art_topic_quota().
   권한·하루 3개·개인정보·같은 주제 묶기는 모두 서버가 판정한다. 이 화면은 보내기 전에 한 번 더 걸러 주고 결과를 보여 줄 뿐이다.
   Supabase 클라이언트는 articles.js가 만든 window.PA_SB(공통 메뉴와 같은 세션)를 그대로 쓴다 — 새로 만들지 않는다.
   서버 함수가 아직 없거나(404·PGRST202) 실패해도 목록·검색·보관은 그대로 동작하고, 입력칸 아래에만 "잠시 후 다시 시도해 주세요"가 보인다. */
(function () {
  'use strict';
  const K = window.PA_ART_CORE;
  const $ = id => document.getElementById(id);
  const form = $('art-topic'), input = $('art-topic-in'), send = $('art-topic-send');
  if (!K || !form || !input || !send) return;
  const { el, kDate } = K;
  const leftBox = $('art-topic-left'), mineBtn = $('art-topic-mine'), countBox = $('art-topic-count'), msg = $('art-topic-msg'), listBox = $('art-topic-list'), toastBox = $('art-toast');
  const quotaBox = leftBox ? leftBox.parentNode : null;
  const LIMIT = 3, MIN = 4, MAX = 60;
  const RETRY = '잠시 후 다시 시도해 주세요.';
  const PII_TEXT = '전화번호·주민번호·이메일처럼 보이는 내용은 보낼 수 없어요. 고객 정보는 빼고 주제만 적어 주세요.';
  const FULL_TEXT = `오늘은 ${LIMIT}개를 모두 요청했어요. 내일 다시 요청할 수 있어요.`;
  const S = { on: false, epoch: 0, busy: false, left: null, rows: [], noQuotaFn: false };
  const sb = () => window.PA_SB || null;
  const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');

  // ── 보내기 전 검사(서버도 같은 검사를 다시 한다) ──
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const PII = [
    /(^|[^\d])(\+?82[\s.-]?1[016789]|01[016789])[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/,   // 휴대폰
    /(^|[^\d])0\d{1,2}[\s.)-]{0,2}\d{3,4}[\s.-]?\d{4}(?!\d)/,                         // 일반 전화
    /\d{6}[\s-]?[1-8]\d{6}/,                                                         // 주민등록번호·외국인등록번호 모양
    /[^\s@]+@[^\s@]+\.[^\s@]{2,}/                                                    // 이메일
  ];
  function check(topic) {
    const n = Array.from(topic).length;
    if (!n) return '주제를 적어 주세요.';
    if (n < MIN) return `주제를 ${MIN}자 이상 적어 주세요.`;
    if (n > MAX) return `주제는 ${MAX}자까지 적을 수 있어요(지금 ${n}자).`;
    if (PII.some(rx => rx.test(topic))) return PII_TEXT;
    return '';
  }
  // 서버 응답 → 오류 코드 글자(예외로 오든, {ok:false, code}로 오든 같이 읽는다)
  const codeOf = r => {
    if (r && r.error) return `${r.error.code || ''} ${r.error.message || ''} ${r.error.details || ''} ${r.status || ''}`;
    const d = r && r.data;
    if (d && typeof d === 'object' && !Array.isArray(d) && (d.error || d.ok === false)) return String(d.error || d.code || 'failed');
    return '';
  };
  const missing = code => /PGRST202|42883|schema cache|could not find the function|\b404\b/i.test(code);
  function explain(code) {
    if (/topic_pii/.test(code)) return PII_TEXT;
    if (/topic_length/.test(code)) return `주제는 ${MIN}~${MAX}자로 적어 주세요.`;
    if (/topic_daily_limit/.test(code)) return FULL_TEXT;
    if (/login_required|JWT|PGRST301|\b401\b/i.test(code)) return '로그인이 만료되었어요. 새로 고친 뒤 다시 로그인해 주세요.';
    if (/art_forbidden|42501/.test(code)) return '현재 등급에서는 주제를 요청할 수 없어요.';
    return RETRY;
  }

  // ── 화면 ──
  const say = (text, soft) => { if (!msg) return; msg.textContent = text || ''; msg.classList.toggle('is-soft', !!soft); };
  let toastTimer = 0;
  const toast = (text, bad) => {   // 기존 알림 상자(#art-toast)를 같이 쓴다
    if (!toastBox) return say(text, !bad);
    clearTimeout(toastTimer); toastBox.className = 'art-toast is-on' + (bad ? ' is-bad' : ''); toastBox.textContent = text;
    toastTimer = setTimeout(() => { toastBox.className = 'art-toast'; }, 6000);
  };
  function drawLeft() {
    if (!leftBox) return;
    const n = S.left;
    leftBox.textContent = n === null ? '' : n > 0 ? `(오늘 ${n}개 남음)` : '(오늘은 모두 썼어요)';
    if (quotaBox) quotaBox.classList.toggle('is-full', n === 0);
  }
  const STATUS = { queued: '대기', writing: '작성 중', done: '등록됨', rejected: '못 씀', cancelled: '취소' };
  function rowOf(x) {
    const st = STATUS[x.status] ? x.status : 'queued';
    const sub = [kDate(x.created_at) ? `${kDate(x.created_at)} 요청` : null];
    let act = null;
    if (st === 'queued' && isUuid(x.id)) act = el('button', { type: 'button', class: 'art-topic-act', 'aria-label': `요청 취소: ${x.topic}`, onclick: ev => cancel(x, ev.currentTarget) }, '취소');
    else if (st === 'done' && x.article_open === true && isUuid(x.article_id)) act = el('a', { class: 'art-topic-act is-go', href: '#a=' + x.article_id, 'aria-label': `글 보기: ${x.topic}`, onclick: () => openList(false) }, '글 보기');
    if (st === 'queued') sub.push('순서를 기다리는 중');
    if (st === 'writing') sub.push('글을 쓰고 있어요');
    if (st === 'done' && !act) sub.push('지금은 작성글모음 목록에 없는 글');
    const reason = st === 'rejected' && x.reason ? el('b', {}, clean(x.reason)) : null;
    return el('li', { class: 'is-' + st },
      el('span', { class: 'art-topic-badge is-' + st }, STATUS[st]),
      el('span', { class: 'art-topic-text' }, x.topic || ''),
      act,
      el('p', { class: 'art-topic-sub' }, sub.filter(Boolean).join(' · '), reason ? ' · ' : null, reason));
  }
  function drawList() {
    const rows = S.rows;
    if (countBox) countBox.textContent = String(rows.length);
    if (mineBtn) mineBtn.hidden = !rows.length;
    if (!rows.length) return openList(false);
    if (listBox) listBox.replaceChildren(
      el('div', { class: 'art-topic-list-head' }, el('strong', {}, '내 요청'), el('span', {}, '최근 30일 · 10개까지')),
      el('ol', { class: 'art-topic-items' }, ...rows.map(rowOf)));
  }
  function openList(on) {
    if (!listBox || !mineBtn) return;
    const open = !!on && S.rows.length > 0;
    listBox.hidden = !open; mineBtn.setAttribute('aria-expanded', String(open));
  }
  const isOpen = () => !!listBox && !listBox.hidden;

  // ── 서버 ──
  const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(LIMIT, Math.trunc(n))) : null; };
  async function quota(c) {   // 내 요청이 하나도 없을 때만: 따로 묻고, 함수가 없으면 3으로 본다(계약)
    if (S.noQuotaFn) return LIMIT;
    try {
      const r = await c.rpc('art_topic_quota');
      if (r.error) { if (missing(codeOf(r))) S.noQuotaFn = true; return LIMIT; }
      const d = Array.isArray(r.data) ? r.data[0] : r.data;
      const n = num(d && typeof d === 'object' ? (d.left_today ?? d.art_topic_quota) : d);
      return n === null ? LIMIT : n;
    } catch (_) { return LIMIT; }
  }
  async function load(quiet) {
    const epoch = S.epoch, c = sb();
    if (!c) { if (!quiet) say(RETRY, true); return false; }
    try {
      const r = await c.rpc('art_topic_mine');
      if (epoch !== S.epoch) return false;
      if (r.error) throw r.error;
      const rows = (Array.isArray(r.data) ? r.data : []).filter(x => x && typeof x === 'object').slice(0, 10);
      let left = rows.length ? num(rows[0].left_today) : null;
      if (left === null) { left = await quota(c); if (epoch !== S.epoch) return false; }
      S.rows = rows; S.left = left;
      drawLeft(); drawList();
      if (!quiet) say('');
      return true;
    } catch (e) {
      if (epoch !== S.epoch) return false;
      console.debug('[art topics]', e);
      if (!quiet) say(RETRY, true);   // 입력칸 아래에만 조용히 — 목록·보관 등 나머지는 그대로
      return false;
    }
  }
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (S.busy) return;   // 중복 클릭·Enter 연타 막기
    const topic = clean(input.value), bad = check(topic);
    if (bad) { say(bad); input.focus(); return; }
    const c = sb(), epoch = S.epoch;
    if (!c) { say(RETRY); return; }
    S.busy = true; send.disabled = true; input.readOnly = true; form.setAttribute('aria-busy', 'true'); say('');
    try {
      const r = await c.rpc('art_topic_submit', { p_topic: topic });
      if (epoch !== S.epoch) return;
      const code = codeOf(r);
      if (code) {
        console.debug('[art topics] submit', code);
        if (/topic_daily_limit/.test(code)) { S.left = 0; drawLeft(); }
        say(explain(code));
        return;
      }
      const d = (Array.isArray(r.data) ? r.data[0] : r.data) || {};
      const left = num(d.left_today); if (left !== null) { S.left = left; drawLeft(); }
      input.value = '';
      toast(d.dup ? '이미 요청하신 주제입니다' : '주제를 요청했습니다. 진행 상황은 ‘내 요청’에서 볼 수 있어요.');
      await load(true);
    } catch (e) {
      if (epoch !== S.epoch) return;
      console.debug('[art topics] submit', e);
      say(RETRY);
    } finally {
      S.busy = false; send.disabled = false; input.readOnly = false; form.removeAttribute('aria-busy');
    }
  });
  async function cancel(x, button) {
    if (button.disabled) return;
    if (!window.confirm(`이 요청을 취소할까요?\n\n「${x.topic}」\n\n취소해도 오늘 요청 횟수는 돌아오지 않습니다.`)) return;
    const c = sb(), epoch = S.epoch;
    if (!c) { say(RETRY); return; }
    button.disabled = true;
    try {
      const r = await c.rpc('art_topic_cancel', { p_id: x.id });
      if (epoch !== S.epoch) return;
      const code = codeOf(r);
      if (code) { console.debug('[art topics] cancel', code); toast(missing(code) || explain(code) === RETRY ? '취소하지 못했습니다. ' + RETRY : explain(code), true); button.disabled = false; return; }
      const ok = r.data === true || (r.data && r.data.ok === true) || (Array.isArray(r.data) && (r.data[0] === true || (r.data[0] && r.data[0].ok === true)));
      toast(ok ? '요청을 취소했습니다.' : '취소하지 못했습니다. 이미 작성 중이거나 끝난 요청입니다.', !ok);
      await load(true);
      if (isOpen() && mineBtn) mineBtn.focus({ preventScroll: true });
    } catch (e) {
      if (epoch !== S.epoch) return;
      console.debug('[art topics] cancel', e); toast('취소하지 못했습니다. ' + RETRY, true); button.disabled = false;
    }
  }

  // ── 내 요청 펼치기 ──
  if (mineBtn) mineBtn.addEventListener('click', () => { const next = !isOpen(); openList(next); if (next) load(true); });
  document.addEventListener('pointerdown', ev => { if (isOpen() && !listBox.contains(ev.target) && !mineBtn.contains(ev.target)) openList(false); });
  form.addEventListener('keydown', ev => { if (ev.key === 'Escape' && isOpen()) { ev.preventDefault(); openList(false); mineBtn.focus({ preventScroll: true }); } });
  input.addEventListener('input', () => { if (msg && msg.textContent) say(''); });

  // ── 목록을 쓸 수 있는 상태(body.art-on, 글 읽는 중 아님)에서만 켠다. 로그인 정보가 바뀌면(art-on 꺼짐) 받은 내용을 모두 비운다 ──
  function sync() {
    const cl = document.body.classList, on = cl.contains('art-on') && !cl.contains('art-reading');
    if (!cl.contains('art-on') && (S.rows.length || S.left !== null || input.value)) {
      S.epoch++; S.rows = []; S.left = null; input.value = ''; say(''); drawLeft(); drawList(); if (listBox) listBox.replaceChildren();
    }
    if (on === S.on) return;
    S.on = on;
    if (on) load(false); else { S.epoch++; openList(false); }
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();
