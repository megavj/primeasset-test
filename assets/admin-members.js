/* TASK-ADM 회원 관리(2026-11-09). 많은 인원을 다루기 위한 화면: 한 칸 통합 검색(입력하는 대로), 빠른 필터, 정렬,
   여러 명 선택 후 한 번에 등급 변경·이용 정지·정지 풀기(확인창), 회원을 누르면 옆 상세 창(휴대폰은 전체 화면),
   엑셀(CSV, 한글 깨짐 없게 BOM) 내려받기와 개인정보 주의 안내. 필터·정렬·쪽 번호는 주소(#members?…)에 남긴다(검색어·회원 정보는 남기지 않음).
   저장은 기존 회원 표(members)·확인 규칙(checkedUpdate)을 그대로 쓴다. 최근 접속은 admin_member_activity, AI 사용량은 AI 질문 서버의 관리자 전용 요청. */
(function () {
  'use strict';
  const DAY = 86400000, RECENT_DAYS = 30, DORMANT_DAYS = 30, PAGE = 50;
  const CHIPS = [['', '전체'], ['active', '사용 중'], ['pending', '승인 대기'], ['incomplete', '정보 미입력'], ['recent', '최근 가입'], ['dormant', '오래 미접속'], ['admin', '관리자'], ['suspended', '정지']];
  const CHIP_HELP = { active: '현재 인트라넷을 사용할 수 있는 회원', pending: '가입 정보를 모두 넣고 승인을 기다리는 회원', incomplete: '가입 정보를 아직 완성하지 않아 승인할 수 없는 회원', recent: `최근 ${RECENT_DAYS}일 안에 가입한 회원`, dormant: `사용 중이지만 ${DORMANT_DAYS}일 넘게 접속하지 않은(또는 접속 기록이 없는) 회원`, admin: '관리자 권한이 있는 회원', suspended: '이용을 정지한 회원' };
  const SORTS = [['joined-desc', '가입일 · 최신순'], ['joined-asc', '가입일 · 오래된순'], ['name-asc', '이름 · 가나다순'], ['name-desc', '이름 · 가나다 역순'], ['seen-desc', '접속일 · 최신순'], ['seen-asc', '접속일 · 오래된순']];
  let activity = null, activityAt = null, activityError = false, activityRequest = null, activityVersion = 0;
  let usage = null, usageState = 'idle', usageAt = null, usageRequest = null, lastBulk = null, urlRead = false;
  function withDeadline(work) {
    let timer;
    return Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })
    ]).finally(() => clearTimeout(timer));
  }

  window.PA_ADMIN_MEMBERS = function (ctx) {
    const { sb, S, el, button, input, empty, toast, mutate, num, gname, badge, filters, profileComplete, checkedUpdate, setDirty, go } = ctx;
    const media = window.matchMedia('(max-width: 800px)');
    const fmtDate = t => t && !Number.isNaN(Date.parse(t)) ? new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    const fmtTime = t => t && !Number.isNaN(Date.parse(t)) ? new Date(t).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const ago = t => {
      if (!t || Number.isNaN(Date.parse(t))) return '기록 없음';
      const d = Math.floor((Date.now() - Date.parse(t)) / DAY);
      return d <= 0 ? '오늘' : d === 1 ? '어제' : d < 30 ? `${d}일 전` : d < 365 ? `${Math.floor(d / 30)}개월 전` : `${Math.floor(d / 365)}년 전`;
    };
    const stateOf = m => m.status === 'suspended' ? ['suspended', '정지'] : m.status === 'active' ? ['active', '사용 중'] : (m.status === 'pending' && profileComplete(m)) ? ['pending', '승인 대기'] : ['incomplete', '정보 미입력'];
    const stateBadge = state => { const b = badge(state[1]); b.classList.add('adm-badge--' + state[0]); return b; };
    const seen = m => activity && activity.get(m.id) || null;
    const isMe = m => !!(S.profile && m.email && m.email === S.profile.email);
    const match = {
      '': () => true,
      active: m => m.status === 'active',
      pending: m => stateOf(m)[0] === 'pending',
      incomplete: m => stateOf(m)[0] === 'incomplete',
      recent: m => m.created_at && Date.now() - Date.parse(m.created_at) <= RECENT_DAYS * DAY,
      dormant: m => m.status === 'active' && activity && (!seen(m) || Date.now() - Date.parse(seen(m)) > DORMANT_DAYS * DAY),
      admin: m => !!m.is_admin,
      suspended: m => m.status === 'suspended'
    };
    const norm = v => String(v || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
    const phone = v => { const d = String(v || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : (v || ''); };
    // 줄 아무 곳이나 눌러도 상세 창(선택 칸·버튼·링크를 누른 경우는 제외)
    const rowOpen = (m, open) => e => { if (!e.target.closest('input,label,button,a,select,textarea')) open(m); };
    const hit = (q, m) => !q || norm([m.name, m.email, m.branch, m.memo, m.phone].join(' ')).includes(q);

    // 주소(#members?보기=…) ↔ 화면 상태. 검색어는 개인정보가 섞일 수 있어 주소에 남기지 않는다.
    function readUrl(f) {
      const qs = location.hash.split('?')[1]; if (!qs) return;
      const p = new URLSearchParams(qs);
      if (CHIPS.some(c => c[0] === p.get('filter'))) f.status = p.get('filter');
      if (SORTS.some(s => s[0] === p.get('sort'))) f.sort = p.get('sort');
      if (/^\d+$/.test(p.get('grade') || '') && S.grades.some(g => String(g.id) === p.get('grade'))) f.grade = p.get('grade');
      if (/^\d+$/.test(p.get('page') || '')) f.page = Math.max(1, +p.get('page'));
    }
    function writeUrl(f) {
      const p = new URLSearchParams();
      if (f.status) p.set('filter', f.status);
      if (f.grade) p.set('grade', f.grade);
      if (f.sort && f.sort !== 'joined-desc') p.set('sort', f.sort);
      if (f.page > 1) p.set('page', String(f.page));
      const next = '#members' + (p.toString() ? '?' + p : '');
      if (location.hash !== next) history.replaceState(null, '', next);
    }

    async function loadActivity(redraw, force) {
      if (!force && activityAt === S.loadedAt && (activity || activityError)) return;
      if (!force && activityAt === S.loadedAt && activityRequest) { await activityRequest; redraw(); return; }
      const version = ++activityVersion;
      activityAt = S.loadedAt; activity = null; activityError = false;
      activityRequest = (async () => {
        try {
          const r = await withDeadline(() => sb.rpc('admin_member_activity')); if (r.error) throw r.error;
          if (version !== activityVersion) return;
          activity = new Map((r.data || []).map(x => [x.member_id, x.last_seen])); activityError = false;
        } catch (_) { if (version === activityVersion) { activity = null; activityError = true; } }
        finally { if (version === activityVersion) activityRequest = null; }
      })();
      await activityRequest;
      redraw();
    }
    async function loadUsage(force) {
      if (usageRequest) return usageRequest;
      if (!force && usageState === 'ok' && usageAt && Date.now() - usageAt < 120000) return;
      const client = ctx.askClient(); if (!client) { usageState = 'error'; return; }
      usageState = 'loading';
      usageRequest = (async () => {
        try {
          const r = await withDeadline(() => client.request('askAdminUsage', {}));
          usage = { day: r.day, users: new Map((r.users || []).map(u => [u.memberId, u])) }; usageState = 'ok'; usageAt = Date.now();
        } catch (_) { usageState = 'error'; }
        finally { usageRequest = null; }
      })();
      return usageRequest;
    }

    // 회원 등급으로 볼 수 있는 메뉴(회원 화면에 보이는 메뉴만). 관리자는 모두.
    function menusFor(m) {
      const visible = S.resources.filter(r => r.active && r.kind !== 'ai'); // TASK-MENU: 숨김·지운 메뉴는 DB 상태로만 가림
      const ai = S.resources.find(r => r.kind === 'ai');
      const allowed = r => m.is_admin || S.perms.has(m.grade_id + ':' + r.id);
      const grade = S.grades.find(g => g.id === m.grade_id);
      return { open: visible.filter(allowed), total: visible.length, ai: !!(ai && ai.active && allowed(ai)), limit: grade ? Number(grade.ask_daily_limit ?? 20) : 20 };
    }

    function csvDownload(list, withMemo) {
      // 내려받은 기록(누가·언제·몇 명)을 먼저 보낸다. 기록이 실패해도 내려받기는 진행.
      sb.rpc('log_admin_export', { p_kind: withMemo ? 'members_csv_memo' : 'members_csv', p_count: list.length }).then(() => {}, () => {});
      const cell = value => { let t = String(value ?? ''); if (/^[\t\r\n]/.test(t) || /^[\s\u0000-\u001f]*[=+\-@]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
      const heads = ['이름', '소속', '휴대폰', '이메일', '등급', '상태', '관리자', '가입일', '승인일', '최근 접속', '정지 사유', ...(withMemo ? ['관리 메모'] : [])];
      const rows = list.map(m => [m.name, m.branch, phone(m.phone), m.email, gname(m.grade_id), stateOf(m)[1], m.is_admin ? '예' : '', fmtTime(m.created_at), fmtTime(m.approved_at), seen(m) ? fmtTime(seen(m)) : '', m.suspend_reason, ...(withMemo ? [m.memo] : [])]);
      const text = '\ufeff' + [heads, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const a = el('a', { href: url, download: `회원목록_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}.csv`, hidden: '' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function dialog(title, ...kids) {
      const previous = document.activeElement;
      const d = el('dialog', { class: 'adm-dialog', 'aria-labelledby': 'adm-dlg-title' }, el('h3', { id: 'adm-dlg-title' }, title), ...kids);
      const close = () => { if (d.open) d.close(); d.remove(); if (previous?.isConnected) previous.focus(); };
      d.addEventListener('cancel', e => { e.preventDefault(); close(); });
      document.body.append(d);
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      return { d, close };
    }
    const nameList = list => { const names = list.map(m => m.name || m.email || '회원'); return names.slice(0, 10).join(', ') + (names.length > 10 ? ` 외 ${names.length - 10}명` : ''); };

    function members() {
      const f = filters.members;
      if (!f.sort) f.sort = 'joined-desc';
      if (!urlRead) { urlRead = true; readUrl(f); }
      const selected = new Set();
      let detailOpen = null;
      let searchTimer = null, composing = false;
      const root = el('div', { class: 'adm-stack adm-mm' });
      const status = el('p', { class: 'adm-note', id: 'adm-mm-result-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      const listBox = el('div', { class: 'adm-mm-list', id: 'adm-mm-results', 'aria-describedby': 'adm-mm-result-status' });
      const activeFilters = el('div', { class: 'adm-mm-active-filters', role: 'group', 'aria-label': '현재 적용한 검색 조건', hidden: '' });
      const activityNotice = el('div', { class: 'adm-callout adm-mm-activity-note', role: 'status', hidden: '' });
      const bulkBar = el('div', { class: 'adm-mm-bulk', role: 'region', 'aria-label': '선택한 회원 한 번에 바꾸기', hidden: '' });
      const q = input('회원 찾기', f.q || '', { type: 'search', placeholder: '이름 · 이메일 · 소속 · 연락처 · 메모', class: 'adm-input adm-mm-search', 'aria-controls': 'adm-mm-results', autocomplete: 'off', spellcheck: 'false' });
      q.removeAttribute('data-draft'); q.classList.add('adm-filter');
      const sort = el('select', { class: 'adm-input adm-filter', 'aria-label': '정렬' }, ...SORTS.map(([v, t]) => el('option', { value: v, selected: v === f.sort }, t)));
      const grade = el('select', { class: 'adm-input adm-filter', 'aria-label': '등급으로 거르기' }, el('option', { value: '' }, '모든 등급'), ...S.grades.map(g => el('option', { value: String(g.id), selected: String(g.id) === String(f.grade) }, g.name)));
      const chipBox = el('div', { class: 'adm-mm-chips', role: 'group', 'aria-label': '빠른 필터' });

      const filtered = () => {
        const nq = norm(f.q);
        const list = S.members.filter(m => hit(nq, m) && (!f.grade || String(m.grade_id) === String(f.grade)) && (match[f.status] || match[''])(m));
        const [key, dir] = f.sort.split('-'), sign = dir === 'asc' ? 1 : -1;
        const val = m => key === 'name' ? (m.name || m.email || '') : key === 'seen' ? (seen(m) ? Date.parse(seen(m)) : 0) : (Date.parse(m.created_at) || 0);
        return list.sort((a, b) => {
          const x = val(a), y = val(b);
          if (key === 'name') return sign * String(x).localeCompare(String(y), 'ko-KR');
          if (key === 'seen' && (!x || !y)) return x ? -1 : y ? 1 : 0; // 기록 없는 회원은 항상 맨 아래
          return sign * (x - y);
        });
      };
      function drawChips() {
        chipBox.replaceChildren(...CHIPS.map(([k, t]) => {
          const n = k === 'dormant' && !activity ? null : S.members.filter(m => (match[k])(m)).length;
          return button(el('span', {}, t, n == null ? null : el('small', {}, ` ${num(n)}`)), () => { f.status = f.status === k ? '' : k; f.page = 1; selected.clear(); draw(); chipBox.querySelector(`[data-chip="${k}"]`)?.focus(); }, 'secondary',
            { class: 'adm-button adm-button--secondary adm-mm-chip', 'aria-pressed': String(f.status === k), 'data-chip': k, title: CHIP_HELP[k] || '모든 회원' });
        }));
      }
      function resetFilters() {
        clearTimeout(searchTimer);
        Object.assign(f, { q: '', status: '', grade: '', sort: 'joined-desc', page: 1 });
        q.value = ''; sort.value = f.sort; grade.value = ''; selected.clear(); draw();
      }
      function drawFilterTags() {
        const tags = [];
        const tag = (text, label, clear) => button(el('span', {}, text, el('span', { 'aria-hidden': 'true' }, ' ×')), () => {
          clearTimeout(searchTimer); clear(); f.page = 1; selected.clear(); draw(); q.focus();
        }, 'secondary', { class: 'adm-button adm-button--secondary adm-mm-filter-tag', 'aria-label': label });
        if (f.q) tags.push(tag('검색: ' + f.q, '검색어 지우기', () => { f.q = ''; q.value = ''; }));
        if (f.status) tags.push(tag(CHIPS.find(c => c[0] === f.status)?.[1] || f.status, '상태 필터 지우기', () => { f.status = ''; }));
        if (f.grade) tags.push(tag('등급: ' + gname(+f.grade), '등급 필터 지우기', () => { f.grade = ''; grade.value = ''; }));
        activeFilters.hidden = !tags.length;
        activeFilters.replaceChildren(...tags);
        reset.disabled = !tags.length && f.sort === 'joined-desc' && f.page === 1;
      }
      function retryActivity() {
        loadActivity(() => { if (root.isConnected) draw(); }, true);
        draw();
      }

      function bulkRender(list) {
        const chosen = S.members.filter(m => selected.has(m.id));
        bulkBar.hidden = !chosen.length;
        if (!chosen.length) { bulkBar.replaceChildren(); return; }
        const to = el('select', { class: 'adm-input', 'aria-label': '바꿀 등급' }, el('option', { value: '' }, '바꿀 등급 고르기'), ...S.grades.map(g => el('option', { value: String(g.id) }, g.name)));
        bulkBar.replaceChildren(el('p', { class: 'adm-mm-bulk-text', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, `전체 ${num(list.length)}명 중 ${num(chosen.length)}명 선택됨`),
          el('div', { class: 'adm-actions' }, to, button('등급 바꾸기', () => { if (!to.value) { toast('바꿀 등급을 먼저 골라 주세요.', true); to.focus(); return; } bulkGrade(chosen, +to.value); }, 'primary'),
            button('이용 정지', () => bulkSuspend(chosen), 'danger'), button('정지 풀기', () => bulkResume(chosen)), button('선택 해제', () => { selected.clear(); draw(); })));
      }
      async function runBulk(items, action, done, after) {
        const failed = [];
        let started = false;
        await mutate(async () => {
          started = true;
          for (const m of items) { try { const r = await action(m); if (r?.error) throw r.error; } catch (e) { failed.push(m); } }
          if (after) after(failed); // 목록을 다시 그리기 전에 결과를 남겨 둔다(되돌리기 안내).
          return {};
        }, null);
        if (!started) return { ok: 0, failed: [], cancelled: true };
        selected.clear();
        const ok = items.length - failed.length;
        toast(`${num(items.length)}명 중 ${num(ok)}명 ${done}${failed.length ? ` · 처리하지 못한 회원: ${nameList(failed)} (목록에서 상태를 확인해 주세요)` : ''}`, !!failed.length);
        return { ok, failed };
      }
      function bulkGrade(chosen, gid) {
        const targets = chosen.filter(m => m.grade_id !== gid), same = chosen.length - targets.length;
        if (!targets.length) return toast(`선택한 회원이 모두 이미 ${gname(gid)} 등급입니다.`);
        const { close } = dialog(`${num(targets.length)}명의 등급을 ${gname(gid)}(으)로 바꿀까요?`,
          el('p', {}, nameList(targets)),
          el('ul', { class: 'adm-mm-dlg-list' }, ...[...new Set(targets.map(m => m.grade_id))].map(old => el('li', {}, `${gname(old)} → ${gname(gid)} : ${num(targets.filter(m => m.grade_id === old).length)}명`))),
          same ? el('p', { class: 'adm-note' }, `이미 ${gname(gid)} 등급인 ${num(same)}명은 빼고 바꿉니다.`) : null,
          el('p', { class: 'adm-note' }, '바꾸면 그 회원이 볼 수 있는 메뉴와 AI 질문 횟수가 새 등급 기준으로 바로 바뀝니다. 끝난 뒤 [방금 바꾼 등급 되돌리기]로 되돌릴 수 있습니다.'),
          el('div', { class: 'adm-actions adm-dialog-actions' }, button(`${num(targets.length)}명 바꾸기`, async () => {
            close();
            const before = targets.map(m => [m.id, m.grade_id, m.name || m.email]);
            await runBulk(targets, m => checkedUpdate(m.id, { grade_id: gid }), '등급을 바꿨습니다', failed => {
              const kept = before.filter(([id]) => !failed.some(x => x.id === id));
              lastBulk = kept.length ? { before: kept, to: gid, at: Date.now() } : null;
            });
          }, 'primary'), button('취소', () => close())));
      }
      function bulkSuspend(chosen) {
        const skip = chosen.filter(m => isMe(m) || m.is_admin || m.status === 'suspended');
        const targets = chosen.filter(m => !skip.includes(m));
        const reason = input('정지 사유', '', { maxlength: '200', placeholder: '예: 퇴사', class: 'adm-input' }); reason.removeAttribute('data-draft');
        if (!targets.length) return toast('이용 정지할 수 있는 회원이 없습니다. 관리자·내 계정·이미 정지된 회원은 빠집니다.', true);
        const { close } = dialog(`${num(targets.length)}명을 이용 정지할까요?`,
          el('p', {}, nameList(targets)),
          skip.length ? el('p', { class: 'adm-note' }, `빠지는 회원 ${num(skip.length)}명: ${nameList(skip)} — 관리자·내 계정은 여기서 정지하지 않고, 이미 정지된 회원은 그대로 둡니다.`) : null,
          el('label', { class: 'adm-field' }, el('span', {}, '정지 사유(선택)'), reason),
          el('p', { class: 'adm-note' }, '정지하면 로그인해도 인트라넷을 쓸 수 없습니다. 회원 자료는 지워지지 않으며 [정지 풀기]로 언제든 되돌릴 수 있습니다.'),
          el('div', { class: 'adm-actions adm-dialog-actions' }, button(`${num(targets.length)}명 정지하기`, async () => {
            const why = reason.value.trim(); close();
            await runBulk(targets, m => checkedUpdate(m.id, { status: 'suspended', suspend_reason: why || null }), '이용을 정지했습니다');
          }, 'danger'), button('취소', () => close())));
      }
      function bulkResume(chosen) {
        const targets = chosen.filter(m => m.status === 'suspended'), skip = chosen.length - targets.length;
        if (!targets.length) return toast('선택한 회원 중 정지된 회원이 없습니다.', true);
        const { close } = dialog(`${num(targets.length)}명의 정지를 풀까요?`, el('p', {}, nameList(targets)),
          skip ? el('p', { class: 'adm-note' }, `정지 상태가 아닌 ${num(skip)}명은 그대로 둡니다.`) : null,
          el('p', { class: 'adm-note' }, '정지를 풀면 바로 사용 중으로 바뀌고 원래 등급의 메뉴를 다시 볼 수 있습니다.'),
          el('div', { class: 'adm-actions adm-dialog-actions' }, button(`${num(targets.length)}명 정지 풀기`, async () => { close(); await runBulk(targets, m => checkedUpdate(m.id, { status: 'active' }), '정지를 풀었습니다'); }, 'primary'), button('취소', () => close())));
      }

      // 회원 상세 옆 창(휴대폰은 전체 화면)
      function openDetail(m) {
        detailOpen = m.id;
        const st = stateOf(m), menus = menusFor(m), g = S.grades.find(x => x.id === m.grade_id);
        const panel = el('dialog', { class: 'adm-drawer', 'aria-labelledby': 'adm-mm-detail-title' });
        const close = () => { detailOpen = null; if (panel.open) panel.close(); panel.remove(); root.querySelector(`[data-member="${m.id}"]`)?.focus(); };
        panel.addEventListener('cancel', e => { e.preventDefault(); close(); });
        panel.addEventListener('click', e => { if (e.target === panel) close(); });
        const gradeSel = el('select', { class: 'adm-input', 'aria-label': '회원 등급' }, ...S.grades.map(x => el('option', { value: String(x.id), selected: x.id === m.grade_id }, x.name)));
        const memo = el('textarea', { class: 'adm-input', rows: '4', maxlength: '1000', 'aria-label': '관리 메모', placeholder: '관리자만 보는 메모' }); memo.value = m.memo || '';
        const usageBox = el('div', { class: 'adm-mm-usage', role: 'status' }, '불러오는 중…');
        const claimsBox = el('div', { class: 'adm-art-claims-box' }); // TASK-ART: 이 회원이 보관한 글
        const drawUsage = () => {
          if (usageState === 'error') { usageBox.replaceChildren(el('p', { class: 'adm-note' }, 'AI 사용량을 불러오지 못했습니다.'), button('다시 불러오기', async () => { usageBox.textContent = '불러오는 중…'; await loadUsage(true); drawUsage(); })); return; }
          if (usageState !== 'ok') { usageBox.textContent = '불러오는 중…'; return; }
          const u = usage.users.get(m.id) || { today: 0, month: 0, total: 0, lastAt: '' };
          usageBox.replaceChildren(el('dl', { class: 'adm-mm-dl adm-mm-dl--grid' },
            el('dt', {}, '오늘'), el('dd', {}, menus.ai ? `${num(u.today)}회 / 하루 ${num(menus.limit)}회` : `${num(u.today)}회 · AI 질문 꺼짐`),
            el('dt', {}, '이번 달'), el('dd', {}, `${num(u.month)}회`), el('dt', {}, '전체'), el('dd', {}, `${num(u.total)}회`),
            el('dt', {}, '마지막 질문'), el('dd', {}, u.lastAt ? fmtTime(u.lastAt) : '기록 없음')));
        };
        const actions = [];
        if (st[0] === 'pending' || st[0] === 'incomplete') actions.push(button('가입 승인 화면으로', () => { close(); go('pending', { q: m.email || m.name, complete: st[0] === 'pending' ? 'yes' : 'no' }); }));
        if (m.status === 'suspended') actions.push(button('정지 풀기', () => { close(); bulkResume([m]); }, 'primary'));
        else if (m.status === 'active' && !m.is_admin && !isMe(m)) actions.push(button('이용 정지', () => { close(); bulkSuspend([m]); }, 'danger'));
        panel.append(
          el('div', { class: 'adm-dialog-head' }, el('div', {}, el('h3', { id: 'adm-mm-detail-title' }, m.name || '이름 미입력'), el('p', { class: 'adm-note' }, stateBadge(st), m.is_admin ? badge('관리자') : null, isMe(m) ? badge('내 계정') : null)), button('닫기', close)),
          el('section', {}, el('h4', {}, '기본 정보'), el('dl', { class: 'adm-mm-dl' },
            el('dt', {}, '이메일'), el('dd', {}, m.email || '—'), el('dt', {}, '휴대폰'), el('dd', {}, phone(m.phone) || '—'), el('dt', {}, '소속'), el('dd', {}, m.branch || '—'),
            el('dt', {}, '가입일'), el('dd', {}, fmtTime(m.created_at)), el('dt', {}, '승인일'), el('dd', {}, fmtTime(m.approved_at)),
            el('dt', {}, '최근 접속'), el('dd', {}, seen(m) ? `${fmtTime(seen(m))} (${ago(seen(m))})` : activityError ? '확인하지 못함' : '기록 없음'),
            ...(m.status === 'suspended' ? [el('dt', {}, '정지'), el('dd', {}, `${fmtTime(m.suspended_at)}${m.suspend_reason ? ' · ' + m.suspend_reason : ''}`)] : []))),
          el('section', {}, el('h4', {}, '등급'), el('div', { class: 'adm-mm-row' }, gradeSel, button('등급 저장', async () => {
            const to = +gradeSel.value; if (to === m.grade_id) return toast('등급이 그대로입니다.');
            if (!window.confirm(`${m.name || m.email} 님의 등급을 바꿀까요?\n${gname(m.grade_id)} → ${gname(to)}\n볼 수 있는 메뉴와 AI 질문 횟수가 새 등급 기준으로 바로 바뀝니다.`)) return;
            close(); await mutate(() => checkedUpdate(m.id, { grade_id: to }), '등급을 바꿨습니다.');
          }, 'primary'))),
          el('section', {}, el('h4', {}, `볼 수 있는 메뉴 ${m.is_admin ? '전체' : num(menus.open.length) + '개'} / ${num(menus.total)}개`),
            el('p', { class: 'adm-note' }, m.is_admin ? '관리자는 등급과 관계없이 모든 메뉴를 볼 수 있습니다.' : `${g ? g.name : '등급 없음'} 등급 기준입니다. 바꾸려면 메뉴 권한 화면에서 등급의 칸을 바꿉니다.`),
            el('p', { class: 'adm-mm-ai' }, menus.ai ? `AI 질문: 켜짐 · 하루 ${num(menus.limit)}회` : 'AI 질문: 꺼짐 (현재 등급에서는 이용할 수 없음)'),
            menus.open.length ? el('ul', { class: 'adm-mm-menus' }, ...menus.open.map(r => el('li', {}, r.name))) : el('p', { class: 'adm-note' }, '볼 수 있는 업무 도구가 없습니다.'),
            button('메뉴 권한 화면에서 보기', () => { close(); go('matrix', { q: '', grade: String(m.grade_id || '') }); })),
          el('section', {}, el('h4', {}, 'AI 질문 사용량'), usageBox),
          window.PA_ADMIN_ARTICLE_CLAIMS ? el('section', {}, el('h4', {}, '보관한 글(작성글모음)'), claimsBox) : null,
          el('section', {}, el('h4', {}, '관리 메모'), memo, el('div', { class: 'adm-actions' }, button('메모 저장', async () => {
            if (memo.value === (m.memo || '')) return toast('메모가 그대로입니다.');
            close(); await mutate(() => checkedUpdate(m.id, { memo: memo.value }), '메모를 저장했습니다.');
          }, 'primary'))),
          actions.length ? el('section', {}, el('h4', {}, '상태 바꾸기'), el('div', { class: 'adm-actions' }, ...actions)) : null);
        document.body.append(panel);
        if (typeof panel.showModal === 'function') panel.showModal(); else panel.setAttribute('open', '');
        panel.querySelector('.adm-dialog-head .adm-button')?.focus();
        loadUsage(false).then(() => { if (panel.isConnected) drawUsage(); }); drawUsage();
        if (window.PA_ADMIN_ARTICLE_CLAIMS) window.PA_ADMIN_ARTICLE_CLAIMS(m, claimsBox).catch(() => { claimsBox.textContent = '보관한 글을 불러오지 못했습니다.'; });
      }

      function row(m, list) {
        const st = stateOf(m), s = seen(m);
        const box = el('input', { type: 'checkbox', checked: selected.has(m.id), 'aria-label': `${m.name || m.email} 선택`, onchange: e => {
          e.target.checked ? selected.add(m.id) : selected.delete(m.id);
          e.target.closest('.adm-mm-tr,.adm-mm-card')?.classList.toggle('is-selected', e.target.checked);
          bulkRender(list); syncAll(list);
        } });
        const open = el('button', { type: 'button', class: 'adm-mm-name', 'data-member': m.id, onclick: () => openDetail(m) }, el('strong', {}, m.name || '이름 미입력'), el('span', {}, m.branch || '소속 미입력'), el('small', {}, m.email || '이메일 없음'));
        const seenText = activity ? (s ? ago(s) : '기록 없음') : activityError ? '확인 못 함' : '확인 중…';
        if (media.matches) return el('li', { class: 'adm-mm-card' + (selected.has(m.id) ? ' is-selected' : ''), onclick: rowOpen(m, openDetail) }, el('label', { class: 'adm-check' }, box), open,
          el('div', { class: 'adm-mm-card-meta' }, badge(gname(m.grade_id)), stateBadge(st), m.is_admin ? badge('관리자') : null, el('small', {}, `가입 ${fmtDate(m.created_at)} · 접속 ${seenText}`)));
        return el('tr', { class: 'adm-mm-tr' + (selected.has(m.id) ? ' is-selected' : ''), onclick: rowOpen(m, openDetail) }, el('td', { class: 'adm-mm-pick' }, el('label', { class: 'adm-check' }, box)), el('td', {}, open),
          el('td', {}, gname(m.grade_id), m.is_admin ? el('div', {}, badge('관리자')) : null), el('td', {}, stateBadge(st)),
          el('td', {}, fmtDate(m.created_at)), el('td', { title: s ? fmtTime(s) : '' }, seenText));
      }
      let pageAll = null;
      function syncAll(list) {
        if (!pageAll) return;
        const page = list.slice((f.page - 1) * PAGE, f.page * PAGE);
        pageAll.checked = page.length > 0 && page.every(m => selected.has(m.id));
        pageAll.indeterminate = !pageAll.checked && page.some(m => selected.has(m.id));
      }
      function draw() {
        clearTimeout(searchTimer);
        const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE));
        f.page = Math.min(Math.max(1, f.page || 1), pages);
        const page = list.slice((f.page - 1) * PAGE, f.page * PAGE);
        drawChips(); drawFilterTags(); writeUrl(f);
        const help = f.status ? CHIP_HELP[f.status] : '';
        const activityMissing = f.status === 'dormant' && !activity;
        status.textContent = `전체 회원 ${num(S.members.length)}명 · ${activityMissing ? (activityError ? '접속 기록 조회 실패' : '접속 기록 확인 중') : `조건에 맞는 회원 ${num(list.length)}명`}${list.length ? ` · ${num((f.page - 1) * PAGE + 1)}~${num((f.page - 1) * PAGE + page.length)}번째 표시` : ''}${help ? ' · ' + help : ''}`;
        activityNotice.hidden = !activityError || activityMissing;
        activityNotice.replaceChildren(...(activityError && !activityMissing ? [el('p', { class: 'adm-note' }, '최근 접속을 확인하지 못했습니다. 회원 기본 정보와 다른 관리 기능은 계속 사용할 수 있습니다.'), button('접속 기록 다시 확인', retryActivity)] : []));
        listBox.setAttribute('aria-busy', String(activityMissing && !activityError));
        csv.disabled = !list.length || activityMissing;
        pageAll = el('input', { type: 'checkbox', 'aria-label': '이 쪽에 보이는 회원 모두 선택', onchange: e => { page.forEach(m => e.target.checked ? selected.add(m.id) : selected.delete(m.id)); draw(); pageAll.focus(); } });
        const pager = pages > 1 ? el('div', { class: 'adm-pagination' }, el('span', { class: 'adm-note' }, `${f.page} / ${pages}쪽`),
          button('이전', () => { f.page--; draw(); root.scrollIntoView({ block: 'start' }); }, 'secondary', { disabled: f.page <= 1 }),
          button('다음', () => { f.page++; draw(); root.scrollIntoView({ block: 'start' }); }, 'secondary', { disabled: f.page >= pages })) : null;
        const headCell = (label, key) => {
          const [k, dir] = f.sort.split('-');
          const active = k === key;
          return el('th', { scope: 'col', 'aria-sort': active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none' }, button(label + (active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''), () => {
            f.sort = key + '-' + (active ? (dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc'); sort.value = f.sort; f.page = 1; draw();
          }, 'secondary', { class: 'adm-mm-sort', 'aria-label': `${label}으로 정렬` }));
        };
        let content;
        if (activityMissing) {
          content = empty(activityError ? '최근 접속을 확인하지 못했습니다' : '최근 접속 기록을 확인하는 중입니다', activityError ? '오래 미접속한 회원을 구분하려면 접속 기록이 필요합니다. 다시 확인하거나 다른 필터를 선택해 주세요.' : '접속 기록을 확인한 뒤 오래 미접속한 회원을 표시합니다.');
          if (activityError) content.append(button('접속 기록 다시 확인', retryActivity));
        } else if (!list.length) {
          content = empty(S.members.length ? '조건에 맞는 회원이 없습니다' : '등록된 회원이 없습니다', S.members.length ? '검색어, 상태 또는 등급 조건을 조정해 보세요.' : '회원이 가입하면 이곳에서 검색하고 관리할 수 있습니다.');
          if (f.q || f.grade || f.status) content.append(button('조건 지우고 전체 회원 보기', () => { resetFilters(); q.focus(); }));
        }
        else if (media.matches) content = el('div', {}, el('label', { class: 'adm-select-page' }, pageAll, el('span', {}, `이 쪽 ${num(page.length)}명 모두 선택`)), el('ul', { class: 'adm-mm-cards' }, ...page.map(m => row(m, list))));
        else content = el('div', { class: 'adm-table-scroll adm-matrix adm-mm-table', tabindex: '0', role: 'region', 'aria-label': '회원 목록' },
          el('table', { class: 'adm-table' }, el('caption', { class: 'sr' }, '회원 목록'),
            el('thead', {}, el('tr', {}, el('th', { scope: 'col', class: 'adm-mm-pick' }, el('label', { class: 'adm-check' }, pageAll)), headCell('이름', 'name'), el('th', { scope: 'col' }, '등급'), el('th', { scope: 'col' }, '상태'), headCell('가입일', 'joined'), headCell('최근 접속', 'seen'))),
            el('tbody', {}, ...page.map(m => row(m, list)))));
        listBox.replaceChildren(content, pager || el('span'));
        bulkRender(list); syncAll(list);
        undoBox.hidden = !(lastBulk && Date.now() - lastBulk.at < 30 * 60000);
      }

      const undoBox = el('div', { class: 'adm-callout adm-mm-undo', hidden: '' }, el('span', {}, '방금 여러 명의 등급을 바꿨습니다. '),
        button('방금 바꾼 등급 되돌리기', async () => {
          if (!lastBulk) return;
          const back = lastBulk.before.filter(([id]) => S.members.some(m => m.id === id));
          if (!window.confirm(`${num(back.length)}명의 등급을 바꾸기 전으로 되돌릴까요?`)) return;
          lastBulk = null;
          await runBulk(back.map(([id, gid, name]) => ({ id, gid, name })), x => checkedUpdate(x.id, { grade_id: x.gid }), '등급을 되돌렸습니다');
        }), button('닫기', () => { lastBulk = null; undoBox.hidden = true; }));
      const search = () => {
        f.q = q.value; f.page = 1; selected.clear(); clearTimeout(searchTimer);
        if (!composing) searchTimer = setTimeout(() => { if (root.isConnected) draw(); }, 160);
      };
      q.addEventListener('compositionstart', () => { composing = true; clearTimeout(searchTimer); });
      q.addEventListener('compositionend', () => { composing = false; search(); });
      q.addEventListener('input', search);
      q.addEventListener('keydown', e => {
        if (e.key === 'Escape' && q.value && !composing) { e.preventDefault(); e.stopPropagation(); q.value = ''; f.q = ''; f.page = 1; selected.clear(); draw(); }
      });
      sort.addEventListener('change', () => { f.sort = sort.value; f.page = 1; draw(); });
      grade.addEventListener('change', () => { f.grade = grade.value; f.page = 1; selected.clear(); draw(); });
      const csv = button('엑셀로 내려받기', () => {
        const list = filtered(), memoBox = el('input', { type: 'checkbox' });
        const { close } = dialog('회원 목록을 엑셀(CSV) 파일로 내려받을까요?',
          el('p', { class: 'adm-mm-privacy' }, '⚠ 이름·휴대폰·이메일 같은 개인정보가 들어 있습니다. 업무에만 쓰고, 다 쓰면 지워 주세요. 다른 사람에게 보내거나 공용 컴퓨터에 남기지 마세요.'),
          el('p', {}, `지금 화면의 조건에 맞는 회원 ${num(list.length)}명을 내려받습니다. 전체를 받으려면 빠른 필터를 '전체'로 두고 검색어를 지워 주세요.`),
          el('label', { class: 'adm-check adm-mm-memo' }, memoBox, el('span', {}, '관리 메모도 넣기(필요할 때만)')),
          el('p', { class: 'adm-note' }, '엑셀에서 한글이 깨지지 않게 저장합니다. 내려받은 기록(시각·인원 수)은 변경 기록에 남습니다.'),
          el('div', { class: 'adm-actions adm-dialog-actions' }, button(`${num(list.length)}명 내려받기`, () => { close(); csvDownload(list, memoBox.checked); toast(`회원 ${num(list.length)}명 파일을 내려받았습니다. 다 쓰면 지워 주세요.`); }, 'primary', { disabled: !list.length }), button('취소', () => close())));
      });
      const reset = button('조건 모두 지우기', () => { resetFilters(); q.focus(); });
      const onMedia = () => { if (root.isConnected) draw(); else media.removeEventListener('change', onMedia); };
      media.addEventListener('change', onMedia);
      setDirty(false);
      loadActivity(() => { if (root.isConnected) draw(); });
      draw();
      root.append(
        el('div', { class: 'adm-mm-tools' }, el('label', { class: 'adm-field adm-mm-searchfield' }, el('span', {}, '회원 찾기'), q),
          el('label', { class: 'adm-field' }, el('span', {}, '정렬'), sort), el('label', { class: 'adm-field' }, el('span', {}, '등급'), grade)),
        chipBox, activeFilters, el('div', { class: 'adm-mm-toolrow' }, status, el('div', { class: 'adm-actions' }, reset, csv)),
        activityNotice, undoBox, bulkBar, listBox,
        el('p', { class: 'adm-note' }, `이름을 누르면 옆에 상세 창이 열립니다. 여러 명을 고르면 위에 한 번에 바꾸기 막대가 나옵니다. 한 쪽에 ${PAGE}명씩 보입니다.`));
      return root;
    }
    return { members };
  };
})();
