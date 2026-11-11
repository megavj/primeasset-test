/* TASK-ART 관리자 › 작성글모음(2026-11-09). 현황(남은 글·보관된 글·오늘 생성·오늘 보관·곧 지워질 글·그림 정리),
   남은 글/보관된 글 목록과 여러 개 한 번에 지우기(확인창), 보관 기록(어떤 글이 누구에게 언제 — 회원·기간·글로 거르기, CSV),
   원문 보기(보관된 글 포함). 표 읽기는 관리자 전용 읽기 정책, 지우기는 art_admin_delete(서버가 관리자 확인·변경 기록·그림 정리). */
(function () {
  'use strict';
  const VIEWS = [['open', '남은 글'], ['claimed', '보관된 글'], ['draft', '최신 내용 반영 초안'], ['log', '보관 기록']];
  const META_LABELS = [['insurance', '보험 종류'], ['situation', '고객 상황'], ['question', '궁금증'], ['format', '글 형식'], ['tone', '말투'], ['length', '길이'], ['image_style', '그림 스타일'], ['chars', '글자 수']];
  let viewerOpen = null;

  window.PA_ADMIN_ARTICLES = function (ctx) {
    const { sb, S, el, button, input, empty, toast, num, badge, filters } = ctx;
    const K = window.PA_ART_CORE;
    filters.articles = filters.articles || { view: 'open', q: '', member: '', from: '', to: '' };
    const st = { stats: null, rows: null, log: null, error: null, at: 0 };
    const fmtTime = t => t && !Number.isNaN(Date.parse(t)) ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short' }) : '—';
    const fmtDay = t => t && !Number.isNaN(Date.parse(t)) ? new Date(t).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' }) : '—';
    const memberOf = id => S.members.find(m => m.id === id) || null;
    const norm = v => String(v || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
    const kstDate = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    let urlRead = false;

    async function load(force) {
      if (!force && st.rows && Date.now() - st.at < 60000) return;
      st.error = null;
      try {
        const [s, a, c] = await Promise.all([
          sb.rpc('art_admin_stats'),
          sb.from('articles').select('id,title,summary,status,claimed_by,claimed_at,created_at,meta,images').order('created_at', { ascending: false }).range(0, 1999),
          sb.from('article_claims').select('*').order('claimed_at', { ascending: false }).range(0, 1999)]);
        if (s.error) throw s.error; if (a.error) throw a.error; if (c.error) throw c.error;
        st.stats = s.data; st.rows = a.data || []; st.log = c.data || []; st.at = Date.now();
      } catch (e) { console.debug('[admin articles]', e); st.error = e; }
    }

    function dialog(title, ...kids) {
      const d = el('dialog', { class: 'adm-dialog', 'aria-labelledby': 'adm-art-dlg-title' }, el('h3', { id: 'adm-art-dlg-title' }, title), ...kids);
      const close = () => { if (d.open) d.close(); d.remove(); };
      d.addEventListener('cancel', e => { e.preventDefault(); close(); });
      document.body.append(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      return { d, close };
    }

    // 원문 보기(관리자): 표를 직접 읽어 생성 정보(생각 깊이·재료·금소법 검사)까지 보여 준다
    async function openViewer(id) {
      if (!K) return toast('원문 보기 화면을 불러오지 못했습니다. 새로고침해 주세요.', true);
      const panel = el('dialog', { class: 'adm-drawer adm-art-drawer', 'aria-labelledby': 'adm-art-view-title' });
      const close = () => { viewerOpen = null; if (panel.open) panel.close(); panel.remove(); };
      panel.addEventListener('cancel', e => { e.preventDefault(); close(); });
      panel.addEventListener('click', e => { if (e.target === panel) close(); });
      const head = el('div', { class: 'adm-dialog-head' }, el('div', {}, el('h3', { id: 'adm-art-view-title' }, '원문 불러오는 중…')), button('닫기', close));
      const bodyBox = el('div', { class: 'adm-art-viewer' }, el('p', { class: 'adm-note', role: 'status' }, '불러오는 중…'));
      panel.append(head, bodyBox);
      document.body.append(panel); viewerOpen = id;
      if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
      head.querySelector('.adm-button')?.focus();
      const r = await sb.from('articles').select('*').eq('id', id).maybeSingle();
      if (!panel.isConnected) return;
      if (r.error || !r.data) {
        const gone = (st.log || []).find(x => x.article_id === id);
        head.querySelector('h3').textContent = gone ? gone.article_title : '글을 찾을 수 없습니다';
        bodyBox.replaceChildren(el('p', { class: 'adm-note' }, r.error ? '원문을 불러오지 못했습니다. 연결을 확인해 주세요.' : '이미 지워진 글입니다. 보관 기록과 지운 글 기록(제목·주제)만 남아 있습니다.'));
        return;
      }
      const a = r.data, m = a.meta || {}, internal = m.internal || {}, who = a.claimed_by ? memberOf(a.claimed_by) : null;
      const claim = (st.log || []).find(x => x.article_id === a.id);
      head.querySelector('h3').textContent = a.title;
      const finlaw = internal.finlaw || m.finlaw || null;
      const dl = el('dl', { class: 'adm-mm-dl adm-art-dl' },
        el('dt', {}, '상태'), el('dd', {}, a.status === 'open' ? `남은 글 · ${fmtDay(a.created_at)} 작성 · 보관 안 되면 ${fmtDay(new Date(Date.parse(a.created_at) + (st.stats?.keep_days || 60) * 86400000))} 자동 삭제` : a.status === 'draft' ? `최신 내용 반영 초안 · ${who?.name || '요청 회원'} · ${fmtTime(a.created_at)} 작성 · 광고심의 후 게시` : `보관됨 · ${claim ? `${claim.member_name || '이름 없음'}(${claim.grade_name || '등급 없음'})` : who ? who.name : '탈퇴 회원'} · ${fmtTime(a.claimed_at)}`),
        ...META_LABELS.filter(([k]) => m[k] != null && m[k] !== '').flatMap(([k, label]) => [el('dt', {}, label), el('dd', {}, k === 'chars' ? `약 ${num(m[k])}자` : String(m[k]))]),
        internal.effort ? [el('dt', {}, '생각 깊이'), el('dd', {}, `${internal.model || ''} · ${internal.effort}`)] : null,
        internal.materials ? [el('dt', {}, '재료'), el('dd', {}, (internal.materials || []).join(', '))] : null,
        finlaw ? [el('dt', {}, '금소법 검사'), el('dd', {}, finlaw.summary || (finlaw.pass ? '통과' : '확인 필요'))] : null,
        internal.similarity ? [el('dt', {}, '유사도'), el('dd', {}, internal.similarity)] : null);
      const sources = Array.isArray(m.sources) ? m.sources : [];
      const copyStatus = el('p', { class: 'art-status', role: 'status', 'aria-live': 'polite' });
      bodyBox.replaceChildren(dl, ...[K.searchMeta(m)].filter(Boolean), K.actionButtons(() => a, copyStatus, { hashtagsOnly: true }), copyStatus,
        K.refreshControls(sb, a),
        el('h4', {}, `그림 ${(a.images || []).length}장 · 본문`), K.render(a),
        sources.length ? el('details', { class: 'adm-art-src' }, el('summary', {}, `참고 자료 ${sources.length}개`), el('ul', {}, ...sources.map(s => el('li', {}, s.url ? el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title || s.url) : (s.title || '자료'))))) : null);
    }
    window.PA_ADMIN_ARTICLE_VIEW = openViewer;

    async function remove(list, after) {
      if (!list.length) return;
      const claimed = list.filter(a => a.status === 'claimed');
      const names = list.map(a => `· ${a.title}`).slice(0, 12).join('\n') + (list.length > 12 ? `\n· 외 ${list.length - 12}개` : '');
      const { d, close } = dialog(`글 ${num(list.length)}개를 지울까요?`,
        el('p', {}, '지우면 글과 그림 파일이 함께 사라지고 되돌릴 수 없습니다. 보관 기록과 지운 글의 제목은 남습니다.'),
        claimed.length ? el('p', { class: 'adm-callout' }, `이 중 ${num(claimed.length)}개는 회원이 이미 보관한 글입니다. 그 회원의 보관함에서도 사라지고, 회원이 블로그에 올린 그림이 보이지 않게 될 수 있습니다.`) : null,
        el('pre', { class: 'adm-art-names' }, names),
        el('div', { class: 'adm-actions adm-dialog-actions' }, button('취소', () => close()), button(`${num(list.length)}개 지우기`, async () => {
          close();
          try {
            const r = await sb.rpc('art_admin_delete', { p_ids: list.map(a => a.id) }); if (r.error) throw r.error;
            toast(`글 ${num(r.data?.deleted || 0)}개를 지웠습니다. 그림 파일은 몇 분 안에 정리됩니다.`);
          } catch (e) { toast(ctx.errorText(e), true); }
          await load(true); after();
        }, 'danger')));
      d.querySelector('.adm-button--danger')?.focus();
    }

    function csv(list) {
      sb.rpc('art_admin_log_export', { p_count: list.length }).then(() => {}, () => {});
      const cell = v => { let t = String(v ?? ''); if (/^[\t\r\n]/.test(t) || /^[\s\u0000-\u001f]*[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
      const alive = new Set((st.rows || []).map(a => a.id));
      const heads = ['보관 시각', '글 제목', '회원 이름', '이메일', '소속', '등급(보관 당시)', '보험 종류', '글 형식', '글 상태'];
      const rows = list.map(x => { const m = memberOf(x.member_id); return [fmtTime(x.claimed_at), x.article_title, x.member_name || m?.name, m?.email || '', x.member_branch || m?.branch, x.grade_name, x.article_meta?.insurance, x.article_meta?.format, alive.has(x.article_id) ? '보관함에 있음' : '지워짐']; });
      const text = '﻿' + [heads, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const a = el('a', { href: url, download: `작성글_보관기록_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.csv`, hidden: '' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function articles() {
      const f = filters.articles;
      if (!urlRead) { urlRead = true; const qs = new URLSearchParams(location.hash.split('?')[1] || ''); if (VIEWS.some(v => v[0] === qs.get('view'))) f.view = qs.get('view'); }
      const root = el('div', { class: 'adm-stack adm-art' });
      const statsBox = el('div', { class: 'adm-stats adm-art-stats' });
      const tabs = el('div', { class: 'adm-art-tabs', role: 'tablist', 'aria-label': '작성글모음 보기' });
      const body = el('div', { class: 'adm-stack' });
      const selected = new Set();
      const stat = (label, value, detail, view) => button(el('span', { class: 'adm-stat-inner' }, el('span', {}, label), el('strong', {}, value), el('small', {}, detail)), () => { if (view) { f.view = view; draw(); } }, 'stat');
      function drawStats() {
        const s = st.stats || {};
        statsBox.replaceChildren(
          stat('남은 글', num(s.open), `회원 목록에 보이는 글 · 7일 안에 자동 삭제 ${num(s.expiring_7d)}개`, 'open'),
          stat('보관된 글', num(s.claimed), `전체 보관 기록 ${num(s.claims_total)}건`, 'claimed'),
          stat('오늘 생성', num(s.today_created), `오늘 보관 ${num(s.today_claimed)}개 · 한국시간 기준`, 'log'));
      }
      function setView(v) { f.view = v; selected.clear(); history.replaceState(null, '', '#articles' + (v !== 'open' ? '?view=' + v : '')); draw(); }
      function drawTabs() {
        tabs.replaceChildren(...VIEWS.map(([v, t]) => el('button', { type: 'button', role: 'tab', class: 'adm-art-tab', 'aria-selected': String(f.view === v), onclick: () => setView(v) }, t)));
      }
      function listView(status) {
        const statusName = status === 'open' ? '남은 글' : status === 'draft' ? '최신 내용 반영 초안' : '보관된 글';
        const q = input('글 찾기', f.q || '', { type: 'search', placeholder: '제목·보험 종류·형식으로 찾기', class: 'adm-input adm-art-search' });
        q.removeAttribute('data-draft'); q.classList.add('adm-filter');
        const box = el('div'), bar = el('div', { class: 'adm-bulk', role: 'region', 'aria-label': '선택한 글' });
        const delBtn = button('선택한 글 지우기', () => remove((st.rows || []).filter(a => selected.has(a.id)), draw), 'danger', { disabled: true });
        const note = el('span', { class: 'adm-note', role: 'status' }, '0개 선택');
        bar.append(note, delBtn);
        const sync = () => { note.textContent = `${num(selected.size)}개 선택`; delBtn.disabled = !selected.size; };
        const paint = () => {
          const k = norm(q.value);
          const list = (st.rows || []).filter(a => a.status === status && (!k || norm([a.title, a.meta?.insurance, a.meta?.format, a.meta?.situation].join(' ')).includes(k)));
          const all = el('input', { type: 'checkbox', 'aria-label': '보이는 글 모두 선택', checked: list.length > 0 && list.every(a => selected.has(a.id)), onchange: e => { list.forEach(a => e.target.checked ? selected.add(a.id) : selected.delete(a.id)); paint(); } });
          box.replaceChildren(el('p', { class: 'adm-note', role: 'status' }, `${statusName} ${num(list.length)}개`),
            list.length ? ctx.table([el('label', { class: 'adm-check' }, all, el('span', { class: 'sr' }, '모두 선택')), '글', status === 'open' ? '만든 날 · 자동 삭제' : status === 'draft' ? '요청 회원 · 만든 시각' : '보관한 회원 · 시각', '보기'], list.map(a => {
              const claim = (st.log || []).find(x => x.article_id === a.id), who = claim ? `${claim.member_name || '이름 없음'} · ${claim.grade_name || ''}` : (memberOf(a.claimed_by)?.name || '—');
              const left = Math.ceil((Date.parse(a.created_at) + (st.stats?.keep_days || 60) * 86400000 - Date.now()) / 86400000);
              return el('tr', {},
                el('td', {}, el('label', { class: 'adm-check' }, el('input', { type: 'checkbox', checked: selected.has(a.id), 'aria-label': `${a.title} 선택`, onchange: e => { e.target.checked ? selected.add(a.id) : selected.delete(a.id); sync(); } }), el('span', { class: 'sr' }, a.title))),
                el('td', {}, el('div', { class: 'adm-art-title' }, a.images?.[0]?.url ? el('img', { src: a.images[0].url, alt: '', loading: 'lazy', width: '72', height: '48' }) : null,
                  el('div', {}, el('strong', {}, a.title), el('small', { class: 'adm-note' }, [a.meta?.ad_type === 'product' ? '상품광고(협회 심의 필요)' : null, a.meta?.insurance, a.meta?.format, a.meta?.length, a.meta?.chars ? `약 ${num(a.meta.chars)}자` : null, K?.seriesLabel(a.meta)].filter(Boolean).join(' · '))))),
                el('td', {}, status === 'open' ? `${fmtDay(a.created_at)} · ${left}일 남음` : `${who} · ${fmtTime(status === 'draft' ? a.created_at : a.claimed_at)}`),
                el('td', {}, button('원문 보기', () => openViewer(a.id))));
            }), `${statusName} 목록`) : empty(`${statusName}이 없습니다`, status === 'open' ? '생성기가 글을 올리면 이곳과 회원 화면에 보입니다.' : status === 'draft' ? '원문 보기에서 최신 내용 반영판을 요청하면 검사 통과 후 이곳과 요청한 회원의 보관함에 새 초안이 추가됩니다.' : '회원이 보관하면 이곳에 보입니다.'));
          sync();
        };
        q.addEventListener('input', () => { f.q = q.value; paint(); });
        paint();
        return [el('div', { class: 'adm-toolbar' }, ctx.field('글 찾기', q)), bar, box,
          el('p', { class: 'adm-note' }, status === 'open' ? `아무도 보관하지 않은 글은 만든 날부터 ${num(st.stats?.keep_days || 60)}일 뒤 매일 새벽 그림과 함께 자동으로 지워집니다.` : status === 'draft' ? '새 초안은 요청한 회원과 관리자만 볼 수 있습니다. 원래 글은 그대로 보존되며, 새 초안도 광고심의 후 게시해야 합니다.' : '보관된 글은 자동으로 지워지지 않습니다. 지우면 그 회원의 보관함에서도 사라집니다.')];
      }
      function logView() {
        const members = [...new Map((st.log || []).map(x => [x.member_id, x.member_name || memberOf(x.member_id)?.name || '이름 없음'])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ko'));
        const q = input('보관 기록 찾기', f.q || '', { type: 'search', placeholder: '글 제목·회원 이름으로 찾기', class: 'adm-input' }); q.removeAttribute('data-draft'); q.classList.add('adm-filter');
        const who = el('select', { class: 'adm-input adm-filter', 'aria-label': '회원' }, el('option', { value: '' }, `모든 회원 (${num(members.length)}명)`), ...members.map(([id, n]) => el('option', { value: id || '', selected: f.member === id }, n)));
        const from = el('input', { type: 'date', class: 'adm-input adm-filter', 'aria-label': '시작 날짜', value: f.from || '' });
        const to = el('input', { type: 'date', class: 'adm-input adm-filter', 'aria-label': '끝 날짜', value: f.to || '' });
        const box = el('div');
        const alive = new Set((st.rows || []).map(a => a.id));
        let shown = [];
        const paint = () => {
          const k = norm(q.value);
          shown = (st.log || []).filter(x => (!f.member || x.member_id === f.member) && (!f.from || kstDate(x.claimed_at) >= f.from) && (!f.to || kstDate(x.claimed_at) <= f.to)
            && (!k || norm([x.article_title, x.member_name, x.grade_name, x.member_branch].join(' ')).includes(k)));
          box.replaceChildren(el('p', { class: 'adm-note', role: 'status' }, `보관 기록 ${num(shown.length)}건${shown.length !== (st.log || []).length ? ` (전체 ${num((st.log || []).length)}건 중)` : ''}`),
            shown.length ? ctx.table(['보관 시각', '글 제목', '보관한 회원', '등급(보관 당시)', '글'], shown.map(x => el('tr', {},
              el('td', {}, fmtTime(x.claimed_at)), el('td', {}, el('strong', {}, x.article_title), el('small', { class: 'adm-note' }, [x.article_meta?.insurance, x.article_meta?.format].filter(Boolean).join(' · '))),
              el('td', {}, el('button', { type: 'button', class: 'adm-link', onclick: () => { f.member = x.member_id; who.value = x.member_id || ''; paint(); } }, x.member_name || memberOf(x.member_id)?.name || '이름 없음'), el('small', { class: 'adm-note' }, x.member_branch || '')),
              el('td', {}, x.grade_name || '—'),
              el('td', {}, alive.has(x.article_id) ? button('원문 보기', () => openViewer(x.article_id)) : badge('지워짐')))), '보관 기록') : empty('조건에 맞는 보관 기록이 없습니다', '회원·기간·검색어를 바꿔 보세요.'));
        };
        q.addEventListener('input', () => { f.q = q.value; paint(); });
        who.addEventListener('change', () => { f.member = who.value; paint(); });
        from.addEventListener('change', () => { f.from = from.value; paint(); });
        to.addEventListener('change', () => { f.to = to.value; paint(); });
        paint();
        return [el('div', { class: 'adm-toolbar' }, ctx.field('글·회원 찾기', q), ctx.field('회원', who), ctx.field('시작 날짜', from), ctx.field('끝 날짜', to)),
          el('div', { class: 'adm-actions' }, button('조건 지우기', () => { Object.assign(f, { q: '', member: '', from: '', to: '' }); draw(); }),
            button('엑셀(CSV) 내려받기', () => {
              if (!shown.length) return toast('내려받을 기록이 없습니다.', true);
              const { close } = dialog('보관 기록 내려받기', el('p', {}, `지금 보이는 ${num(shown.length)}건을 엑셀에서 열 수 있는 파일(CSV)로 내려받습니다.`),
                el('p', { class: 'adm-callout' }, '회원 이름·이메일이 들어 있습니다. 확인 용도로만 쓰고, 다 쓴 파일은 지워 주세요. 내려받은 기록(누가·언제·몇 건)은 변경 기록에 남습니다.'),
                el('div', { class: 'adm-actions adm-dialog-actions' }, button('취소', () => close()), button('내려받기', () => { close(); csv(shown); toast(`보관 기록 ${num(shown.length)}건을 내려받았습니다.`); }, 'primary')));
            })),
          box, el('p', { class: 'adm-note' }, '시각은 한국시간입니다. 최근 2,000건까지 보여 줍니다. 글이 지워져도 보관 기록은 남습니다.')];
      }
      function draw() {
        drawStats(); drawTabs();
        if (st.error) { body.replaceChildren(empty('작성글모음 자료를 불러오지 못했습니다', '연결을 확인한 뒤 다시 불러와 주세요.'), button('다시 불러오기', async () => { await load(true); draw(); })); return; }
        if (!st.rows) { body.replaceChildren(el('div', { class: 'adm-loading', role: 'status' }, '작성글모음 자료를 불러오는 중…')); return; }
        const s = st.stats || {};
        const warn = s.trash_failed ? el('p', { class: 'adm-callout' }, `그림 파일 ${num(s.trash_failed)}개를 여러 번 지우지 못했습니다. 저장 공간 설정을 확인해 주세요.`) : null;
        body.replaceChildren(...[warn, ...(f.view === 'log' ? logView() : listView(['claimed', 'draft'].includes(f.view) ? f.view : 'open'))].filter(Boolean));
      }
      root.append(statsBox, el('p', { class: 'adm-note' }, `설계사는 하루 ${num(st.stats?.daily_limit || 3)}개까지 보관합니다(한국시간 자정 초기화). 메뉴를 누가 볼지는 '메뉴 권한'의 '작성글모음' 줄에서 등급으로 정합니다.`), tabs, body);
      draw();
      load(false).then(() => { if (root.isConnected) draw(); });
      return root;
    }

    // 회원 상세 창의 '보관한 글' 칸(admin-members.js가 부름)
    async function memberClaims(m, box) {
      box.replaceChildren(el('p', { class: 'adm-note', role: 'status' }, '불러오는 중…'));
      const r = await sb.from('article_claims').select('id,article_id,article_title,claimed_at,grade_name').eq('member_id', m.id).order('claimed_at', { ascending: false }).limit(50);
      if (!box.isConnected) return;
      if (r.error) { box.replaceChildren(el('p', { class: 'adm-note' }, '보관한 글을 불러오지 못했습니다.')); return; }
      const list = r.data || [], today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      const ids = list.map(x => x.article_id).filter(Boolean);
      const alive = new Set();
      if (ids.length) { const a = await sb.from('articles').select('id').in('id', ids); (a.data || []).forEach(x => alive.add(x.id)); }
      if (!box.isConnected) return;
      box.replaceChildren(el('p', { class: 'adm-note' }, `오늘 ${num(list.filter(x => kstDate(x.claimed_at) === today).length)}개 · 전체 ${num(list.length)}개${list.length >= 50 ? ' (최근 50개만 표시)' : ''}`),
        list.length ? el('ul', { class: 'adm-art-claims' }, ...list.map(x => el('li', {}, el('span', {}, el('strong', {}, x.article_title), el('small', { class: 'adm-note' }, `${fmtTime(x.claimed_at)} · ${x.grade_name || ''}`)),
          alive.has(x.article_id) ? button('원문', () => openViewer(x.article_id)) : badge('지워짐')))) : el('p', { class: 'adm-note' }, '아직 보관한 글이 없습니다.'),
        list.length ? button('보관 기록에서 보기', () => { document.querySelectorAll('dialog.adm-drawer').forEach(d => { if (d.open) d.close(); d.remove(); }); filters.articles.view = 'log'; filters.articles.member = m.id; ctx.go('articles', { view: 'log', member: m.id }); }) : null);
    }
    window.PA_ADMIN_ARTICLE_CLAIMS = memberClaims;
    return { articles };
  };
})();
