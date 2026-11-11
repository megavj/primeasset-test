/* TASK-MENU 메뉴 관리(2026-11-09). 관리자가 회원 업무 도구 화면의 메뉴 자체를 추가·수정·숨김·순서 바꾸기·삭제·되살리기.
   회원 화면(my_menu)·메뉴 권한 표와 같은 DB 목록(resources·menu_groups)을 쓴다. 바꾸면 바로 반영되고, 변경마다 서버 함수(admin_menu_*)
   한 번으로 저장되어 변경 기록에 '메뉴 관리' 한 줄로 남는다. 지운 메뉴는 30일 동안 '지운 메뉴'에서 되살릴 수 있고 그 뒤 서버가 자동 정리한다.
   웹 사례 조사(작업 폴더 RESEARCH-MENU.md): 순서는 위·아래 버튼(끌기 없음), 숨김은 스위치로 바로 반영, 삭제만 확인창, 지운 직후 [되살리기] 알림. */
(function () {
  'use strict';
  const KEEP_DAYS = 30;
  // 주소 고르기에 보여 줄 사이트 안 화면(직접 적어도 됨)
  const SITE_PAGES = [['/members/articles/', '작성글모음'], ['/product/', '상품통합분석기'], ['/members/claim/', '보험보상답변기'], ['/members/it/', '전산답변기'],
    ['/members/coach/', 'AI영업비서'], ['/news/', '최신보험뉴스'], ['/wiki/', '보험위키'], ['/qa/', '보험자료'], ['/performance/', '실적보드'], ['/members/me/', '내 정보']];
  const NAME_MAX = 40, DESC_MAX = 80, GROUP_MAX = 20, MEMO_MAX = 500;
  let uid = 0;

  window.PA_ADMIN_MENUS = function (ctx) {
    const { sb, S, el, button, empty, toast, mutate, go, fmt, num, filters, errorText, isBusy } = ctx;
    const f = filters.resources || (filters.resources = { q: '', view: 'list', open: null });
    let focusAfter = null;
    const menuError = e => (e && e.hint === 'pa-menu' && e.message) ? e.message : errorText(e);
    const groups = () => (S.groups || []).filter(g => !g.system);
    const gradeNames = r => S.grades.filter(g => S.perms.has(g.id + ':' + r.id)).map(g => g.name);
    const memberCount = g => S.members.filter(m => m.grade_id === g.id).length;
    const isExternal = url => /^https?:\/\//i.test(url || '');
    const siteUrl = url => /^\/(?!\/)/.test(url || '');
    const validUrl = url => !url || (siteUrl(url) && !/[\s\\]/.test(url)) || /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d+)?([/?#]\S*)?$/i.test(url);
    const shortUrl = url => url.length > 60 ? url.slice(0, 57) + '…' : url;
    const daysLeft = r => Math.max(0, Math.ceil((Date.parse(r.deleted_at) + KEEP_DAYS * 864e5 - Date.now()) / 864e5));
    const who = id => { const m = id && S.members.find(x => x.id === id); return m ? (m.name || m.email || '관리자') : id ? '지금은 없는 계정' : '일괄 정리(관리 작업)'; };
    const isGuest = g => /게스트|guest/i.test(g.name || '');
    const inGroup = name => S.resources.filter(r => r.kind !== 'ai' && r.category === name).sort((a, b) => (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name), 'ko') || a.id - b.id);
    const focusLater = sel => { focusAfter = sel; };

    // 화면 아래 알림(되살리기·되돌리기 버튼 하나). 다른 화면으로 다시 그려도 남고, 15초 뒤나 [닫기]로 사라진다(마우스·초점이 있으면 기다림).
    function snack(text, actionLabel, action) {
      document.querySelector('.adm-mn-snack')?.remove();
      const bar = el('div', { class: 'adm-mn-snack', role: 'status', 'aria-live': 'polite' });
      let timer = null, hold = false;
      const close = () => { clearTimeout(timer); bar.remove(); };
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!hold) close(); else arm(); }, 15000); };
      bar.append(el('p', {}, text), el('div', { class: 'adm-actions' },
        actionLabel ? button(actionLabel, async () => { if (isBusy()) return; close(); await action(); }, 'primary') : null,
        button('닫기', close, 'secondary', { 'aria-label': '알림 닫기' })));
      bar.addEventListener('mouseenter', () => { hold = true; }); bar.addEventListener('mouseleave', () => { hold = false; });
      bar.addEventListener('focusin', () => { hold = true; }); bar.addEventListener('focusout', () => { hold = false; });
      document.body.append(bar); arm();
      return bar;
    }

    function openDialog(dialog, onClose) {
      const previous = document.activeElement;
      dialog.addEventListener('cancel', e => { e.preventDefault(); onClose(); });
      dialog.addEventListener('close', () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); }, { once: true });
      document.body.append(dialog);
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    }

    // ---------- 추가·수정 대화창 ----------
    function editor(r) {
      const adding = !r;
      const id = 'mn' + (++uid);
      const dialog = el('dialog', { class: 'adm-dialog adm-mn-dialog', 'aria-labelledby': id + '-title' });
      let saving = false, tabTouched = !adding, reviewed = '';
      const review = el('section', { class: 'adm-mn-review', hidden: '', 'aria-label': '저장 전 변경 내용' });
      const startUrl = r ? r.url || '' : '';
      const startKind = !r ? 'site' : !startUrl ? 'none' : isExternal(startUrl) ? 'link' : 'site';
      const err = el('p', { class: 'adm-mn-error', role: 'alert', hidden: '' });
      const name = el('input', { class: 'adm-input', id: id + '-name', maxlength: String(NAME_MAX), required: '', autocomplete: 'off', value: r ? r.name : '', placeholder: '예: 상품 비교 도우미' });
      // 주소: 사이트 안 화면 / 외부 링크 / 아직 없음
      const kindName = id + '-kind';
      const kinds = [['site', '사이트 안 화면'], ['link', '외부 링크'], ['none', '아직 없음(준비 중)']].map(([v, t]) =>
        el('label', { class: 'adm-mn-radio' }, el('input', { type: 'radio', name: kindName, value: v, checked: v === startKind }), el('span', {}, t)));
      const kind = () => (dialog.querySelector(`input[name="${kindName}"]:checked`) || {}).value || 'site';
      const listId = id + '-pages';
      const pages = el('datalist', { id: listId }, ...SITE_PAGES.map(([u, t]) => el('option', { value: u }, t)));
      const url = el('input', { class: 'adm-input', id: id + '-url', autocomplete: 'off', spellcheck: 'false', inputmode: 'url', value: startUrl });
      const urlHelp = el('small', { class: 'adm-note', id: id + '-url-help' });
      const tryLink = el('a', { class: 'adm-mn-try', target: '_blank', rel: 'noopener noreferrer' }, '주소 열어 확인 ↗');
      const urlBox = el('div', { class: 'adm-mn-urlbox' }, url, tryLink);
      // 묶음: 있는 묶음 고르기 또는 새 묶음
      const NEW = '__new__';
      const group = el('select', { class: 'adm-input', id: id + '-group' },
        ...groups().map(g => el('option', { value: g.name, selected: r ? g.name === r.category : g.name === (f.addGroup || groups()[0]?.name) }, g.name)),
        el('option', { value: NEW }, '＋ 새 묶음 만들기'));
      const newGroup = el('input', { class: 'adm-input', id: id + '-newgroup', maxlength: String(GROUP_MAX), autocomplete: 'off', placeholder: '새 묶음 이름(예: 교육·자료)' });
      const newGroupField = el('label', { class: 'adm-field', hidden: '' }, el('span', {}, '새 묶음 이름'), newGroup, el('small', { class: 'adm-note' }, `${GROUP_MAX}자 이내 · 회원 화면 맨 아래 묶음으로 생깁니다(묶음 순서는 목록에서 바꿀 수 있음)`));
      const desc = el('input', { class: 'adm-input', id: id + '-desc', maxlength: String(DESC_MAX), autocomplete: 'off', value: r ? r.description || '' : '', placeholder: '예: 상품 보장과 조건 비교' });
      const descCount = el('small', { class: 'adm-note', 'aria-live': 'polite' });
      const newTab = el('input', { type: 'checkbox', role: 'switch', id: id + '-tab', checked: r ? r.open_new_tab !== false : false });
      const show = el('input', { type: 'checkbox', role: 'switch', id: id + '-show', checked: r ? r.active !== false : true });
      // 순서(위치)
      const where = el('select', { class: 'adm-input', id: id + '-where' });
      const fillWhere = () => {
        const g = group.value === NEW ? null : group.value;
        const items = g ? inGroup(g).filter(x => !r || x.id !== r.id) : [];
        const keep = r && g === r.category;
        where.replaceChildren(...[
          keep ? ['keep', '지금 자리 그대로'] : null, ['end', '묶음 맨 아래'], items.length ? ['start', '묶음 맨 위'] : null,
          ...items.map(x => ['after:' + x.id, `'${x.name}' 다음${x.active ? '' : ' (숨김)'}`])
        ].filter(Boolean).map(([v, t]) => el('option', { value: v }, t)));
        where.value = keep ? 'keep' : 'end';
      };
      // 처음 볼 수 있는 등급(추가할 때만)
      const gradeBoxes = S.grades.map(g => el('input', { type: 'checkbox', value: String(g.id), checked: !isGuest(g) }));
      const setGrades = test => { gradeBoxes.forEach((b, i) => { b.checked = test(S.grades[i]); }); paint(); };
      const memo = el('textarea', { class: 'adm-input', id: id + '-memo', rows: '3', maxlength: String(MEMO_MAX) });
      memo.value = r ? r.admin_memo || '' : '';
      // 회원 화면 미리보기
      const pv = el('div', { class: 'adm-mn-pv', 'aria-hidden': 'true' });
      function paint() {
        if (reviewed && reviewed !== before()) { reviewed = ''; review.hidden = true; saveBtn.textContent = adding ? '추가 내용 확인' : '변경 내용 확인'; }
        const k = kind();
        url.disabled = k === 'none';
        url.placeholder = k === 'link' ? 'https://로 시작하는 전체 주소' : k === 'site' ? '/로 시작하는 사이트 안 주소(예: /members/articles/)' : '';
        if (k === 'site') url.setAttribute('list', listId); else url.removeAttribute('list');
        urlHelp.textContent = k === 'link' ? '외부 사이트 주소를 붙여 넣으세요. 회원 화면에서 그 사이트로 연결됩니다.' : k === 'site' ? '목록에서 고르거나 /로 시작하는 주소를 적으세요.' : "회원 화면에는 '주소 준비 중입니다'로 보입니다.";
        const u = url.value.trim();
        const okLink = k !== 'none' && u && validUrl(u);
        tryLink.hidden = !okLink; if (okLink) tryLink.href = u;
        newGroupField.hidden = group.value !== NEW;
        descCount.textContent = `${desc.value.length} / ${DESC_MAX}자 · 회원 화면 칸 아래에 보입니다`;
        const gname = group.value === NEW ? (newGroup.value.trim() || '새 묶음') : group.value;
        const open = adding ? gradeBoxes.filter(b => b.checked).length : (r ? gradeNames(r).length : 0);
        pv.replaceChildren(el('small', {}, `회원 화면 미리보기 · 업무 도구 › ${gname}`),
          el('div', { class: 'adm-mn-pv-card' + (show.checked ? '' : ' is-off') },
            el('b', {}, name.value.trim() || '메뉴 이름'),
            desc.value.trim() ? el('p', {}, desc.value.trim()) : null,
            !show.checked ? el('span', {}, '숨김 — 회원에게 안 보임') : k === 'none' || !u ? el('span', {}, '주소 준비 중입니다.') : el('span', {}, newTab.checked ? '누르면 새 창으로 열림 ↗' : '누르면 같은 창에서 열림')),
          el('small', {}, adding ? `처음 볼 수 있는 등급 ${open}개 · 관리자는 늘 봄` : `볼 수 있는 등급 ${open}개 · 등급은 메뉴 권한 표에서 바꿉니다`));
      }
      dialog.addEventListener('change', e => {
        if (e.target.name === kindName) {
          if (!tabTouched) newTab.checked = kind() === 'link';
          if (kind() === 'none') url.value = '';
          url.focus();
        }
        if (e.target === newTab) tabTouched = true;
        if (e.target === group) { fillWhere(); if (group.value === NEW) newGroup.focus(); }
        paint();
      });
      dialog.addEventListener('input', paint);

      const before = () => JSON.stringify([name.value, kind(), url.value, group.value, newGroup.value, desc.value, newTab.checked, show.checked, memo.value, where.value, gradeBoxes.map(b => b.checked)]);
      let initial = '';
      const close = () => { dialog.close(); dialog.remove(); };
      const cancel = () => { if (saving) return; if (before() !== initial && !window.confirm('적은 내용을 저장하지 않고 닫을까요?')) return; close(); };
      const fail = (text, control) => { err.textContent = text; err.hidden = false; if (control) control.focus(); return false; };
      const saveBtn = button(adding ? '추가 내용 확인' : '변경 내용 확인', async () => {
        if (saving) return;
        err.hidden = true;
        const k = kind(), n = name.value.trim(), u = k === 'none' ? '' : url.value.trim();
        const gname = group.value === NEW ? newGroup.value.trim() : group.value;
        if (!n) return fail('메뉴 이름을 적어 주세요.', name);
        if (S.resources.some(x => x.name.trim().toLowerCase() === n.toLowerCase() && (!r || x.id !== r.id))) return fail('같은 이름의 메뉴가 이미 있습니다. 다른 이름을 적어 주세요.', name);
        if (k !== 'none' && !u) return fail(k === 'link' ? '외부 링크 주소를 적어 주세요. 주소가 아직 없으면 "아직 없음"을 고르세요.' : '사이트 안 주소를 적어 주세요. 주소가 아직 없으면 "아직 없음"을 고르세요.', url);
        if (k === 'link' && !isExternal(u)) return fail('외부 링크는 https://로 시작하는 전체 주소로 적어 주세요.', url);
        if (k === 'site' && !siteUrl(u)) return fail('사이트 안 주소는 /로 시작해야 합니다(예: /members/articles/).', url);
        if (!validUrl(u)) return fail('주소에 빈칸이나 쓸 수 없는 글자가 있습니다. 주소를 다시 확인해 주세요.', url);
        if (!gname) return fail('새 묶음 이름을 적어 주세요.', newGroup);
        const [mode, after] = where.value.split(':');
        const grades = gradeBoxes.filter(b => b.checked).map(b => Number(b.value));
        if (adding && !grades.length && reviewed !== before() && !window.confirm('볼 수 있는 등급을 하나도 고르지 않았습니다. 관리자만 보게 될까요?\n(나중에 메뉴 권한 표에서 켤 수 있습니다)')) return;
        const changes = [
          ['메뉴 이름', r?.name || '', n], ['연결 주소', r?.url || '', u], ['묶음', r?.category || '', gname],
          ['설명', r?.description || '', desc.value.trim()], ['열리는 방식', r ? (r.open_new_tab !== false ? '새 창' : '같은 창') : '', newTab.checked ? '새 창' : '같은 창'],
          ['회원 화면', r ? (r.active !== false ? '보임' : '숨김') : '', show.checked ? '보임' : '숨김'],
          ['관리자 메모', r?.admin_memo || '', memo.value.trim()],
          ...(mode !== 'keep' ? [['순서', r ? '현재 자리' : '', where.selectedOptions[0]?.textContent || '묶음 맨 아래']] : []),
          ...(adding ? [['볼 수 있는 등급', '', S.grades.filter(g => grades.includes(g.id)).map(g => g.name).join(' · ') || '관리자만']] : [])
        ].filter(([, oldValue, nextValue]) => oldValue !== nextValue);
        if (!changes.length) return toast('변경한 내용이 없습니다.');
        if (reviewed !== before()) {
          reviewed = before();
          review.replaceChildren(el('h4', {}, adding ? '이 내용으로 메뉴를 추가합니다' : '이렇게 바뀝니다'),
            el('div', { class: 'adm-review-list' }, ...changes.map(([label, oldValue, nextValue]) => el('div', { class: 'adm-review-row' },
              el('strong', {}, label), el('p', { class: 'before' }, el('span', {}, '변경 전 '), oldValue || '없음'),
              el('p', { class: 'after' }, el('span', {}, '변경 후 '), nextValue || '없음')))),
            el('p', { class: 'adm-note' }, '확인하고 저장하면 회원 화면에 바로 반영됩니다. 되돌리려면 변경 전 값을 다시 입력해 저장해 주세요.'));
          review.hidden = false;
          saveBtn.textContent = '확인하고 저장';
          review.scrollIntoView({ block: 'nearest' });
          return;
        }
        saving = true; saveBtn.disabled = true; saveBtn.textContent = '저장하는 중…';
        try {
          const res = await sb.rpc('admin_menu_save', {
            p_id: r ? r.id : null, p_name: n, p_url: u || null, p_group: gname, p_description: desc.value.trim() || null,
            p_open_new_tab: newTab.checked, p_active: show.checked, p_admin_memo: memo.value.trim() || null,
            p_position: mode, p_after_id: after ? Number(after) : null, p_grades: adding ? grades : null });
          if (res.error) throw res.error;
          close();
          f.view = 'list';
          focusLater(`[data-mn-id="${res.data}"] .adm-mn-edit`);
          await mutate(async () => ({}), adding ? `'${n}' 메뉴를 추가했습니다. 회원 업무 도구 화면에 바로 반영됩니다.` : `'${n}' 메뉴를 저장했습니다. 회원 화면에 바로 반영됩니다.`);
        } catch (e) {
          fail(menuError(e));
        } finally { saving = false; saveBtn.disabled = false; saveBtn.textContent = reviewed ? '확인하고 저장' : adding ? '추가 내용 확인' : '변경 내용 확인'; }
      }, 'primary');
      const lbl = (forId, text, req) => el('label', { for: forId }, text, req ? el('span', { class: 'adm-mn-req', 'aria-hidden': 'true' }, ' *') : null);
      dialog.append(
        el('div', { class: 'adm-dialog-head' }, el('h3', { id: id + '-title' }, adding ? '메뉴 추가' : `'${r.name}' 메뉴 수정`), button('닫기', cancel)),
        el('p', { class: 'adm-note' }, '* 표시는 꼭 적어 주세요. 저장하면 회원 업무 도구 화면과 메뉴 권한 표에 바로 반영됩니다.'),
        el('div', { class: 'adm-mn-form' },
          el('div', { class: 'adm-field' }, lbl(id + '-name', '메뉴 이름', true), name, el('small', { class: 'adm-note' }, `회원 화면 칸 제목 · ${NAME_MAX}자 이내`)),
          el('fieldset', { class: 'adm-field adm-mn-fs' }, el('legend', {}, '주소'), el('div', { class: 'adm-mn-radios' }, ...kinds), urlBox, urlHelp, pages),
          el('div', { class: 'adm-field' }, lbl(id + '-group', '묶음', true), group, el('small', { class: 'adm-note' }, '회원 화면에서 이 메뉴가 들어갈 묶음입니다.')), newGroupField,
          el('div', { class: 'adm-field' }, lbl(id + '-desc', '쉬운 설명 한 줄'), desc, descCount),
          el('div', { class: 'adm-field' }, lbl(id + '-where', '순서(위치)'), where),
          el('div', { class: 'adm-mn-switches' },
            el('label', { class: 'adm-mx-switch', for: id + '-tab' }, newTab, el('span', { class: 'adm-mx-switch-ui', 'aria-hidden': 'true' }), el('span', {}, '새 창으로 열기', el('small', {}, '업무 도구 칸을 누르면 새 창(탭)으로 엽니다. 외부 링크는 켜 두기를 권합니다.'))),
            el('label', { class: 'adm-mx-switch', for: id + '-show' }, show, el('span', { class: 'adm-mx-switch-ui', 'aria-hidden': 'true' }), el('span', {}, '회원에게 보이기', el('small', {}, '끄면 숨김으로 저장되어 회원 화면에 나오지 않습니다.')))),
          adding ? el('fieldset', { class: 'adm-field adm-mn-fs' }, el('legend', {}, '처음 볼 수 있는 등급'),
            el('div', { class: 'adm-mn-grades' }, ...S.grades.map((g, i) => el('label', { class: 'adm-mn-check' }, gradeBoxes[i], el('span', {}, g.name, el('small', {}, ` 회원 ${num(memberCount(g))}명`))))),
            el('div', { class: 'adm-actions' }, button('게스트 빼고 모두', () => setGrades(g => !isGuest(g))), button('모두', () => setGrades(() => true)), button('모두 끄기', () => setGrades(() => false))),
            el('small', { class: 'adm-note' }, '관리자는 체크와 관계없이 모든 메뉴를 봅니다. 나중에 메뉴 권한 표에서 바꿀 수 있습니다.'))
            : el('div', { class: 'adm-field' }, el('span', {}, '볼 수 있는 등급'), el('p', { class: 'adm-mn-gradeline' }, gradeNames(r).join(' · ') || '아직 없음(관리자만 봄)'),
              button('메뉴 권한 표에서 바꾸기', () => { if (before() !== initial && !window.confirm('적은 내용을 저장하지 않고 이동할까요?')) return; close(); go('matrix', { q: r.name }); })),
          el('details', { class: 'adm-mn-more', open: r && r.admin_memo ? '' : null }, el('summary', {}, '관리자 메모(회원에게 안 보임)'),
            el('div', { class: 'adm-field' }, lbl(id + '-memo', '메모'), memo, el('small', { class: 'adm-note' }, '확인한 내용·예전 주소 등 관리자끼리 알아 둘 점'))),
          pv),
        review, err,
        el('div', { class: 'adm-actions adm-dialog-actions' }, saveBtn, button('취소', cancel)));
      fillWhere(); paint(); initial = before();
      openDialog(dialog, cancel);
      name.focus();
    }

    // ---------- 삭제 확인 ----------
    function confirmDelete(r) {
      const names = gradeNames(r);
      const id = 'mnd' + (++uid);
      const dialog = el('dialog', { class: 'adm-dialog', role: 'alertdialog', 'aria-labelledby': id + '-t', 'aria-describedby': id + '-d' });
      const close = () => { dialog.close(); dialog.remove(); };
      const del = button('지우기', async () => {
        close();
        focusLater(`[data-mn-group="${CSS.escape(r.category)}"] .adm-mn-ghead h3`);
        const ok = await mutate(async () => { const res = await sb.rpc('admin_menu_delete', { p_id: r.id }); return res.error ? { error: res.error } : {}; }, null);
        if (ok) snack(`'${r.name}' 메뉴를 지웠습니다. ${KEEP_DAYS}일 안에 '지운 메뉴'에서 되살릴 수 있습니다.`, '되살리기', () => restore(r, true));
      }, 'danger');
      dialog.append(el('h3', { id: id + '-t' }, `'${r.name}' 메뉴를 지울까요?`),
        el('div', { id: id + '-d' },
          el('p', { class: 'adm-mn-strong' }, names.length ? `이 메뉴를 지우면 ${names.length}개 등급에서 사라집니다.` : '지금은 볼 수 있는 등급이 없습니다(관리자만 보는 메뉴).'),
          names.length ? el('p', { class: 'adm-note' }, names.join(' · ')) : null,
          el('ul', { class: 'adm-mn-ul' },
            el('li', {}, '회원 업무 도구 화면과 메뉴 권한 표에서 바로 빠지고, 이 메뉴의 등급 권한도 함께 정리됩니다.'),
            el('li', {}, `${KEEP_DAYS}일 동안 '지운 메뉴'에서 되살릴 수 있습니다. 되살리면 지우기 전 등급·자리로 돌아갑니다.`),
            el('li', {}, `${KEEP_DAYS}일이 지나면 자동으로 완전히 정리됩니다.`),
            el('li', {}, '페이지·링크 자체는 지워지지 않습니다(메뉴에서만 빠짐).'))),
        el('div', { class: 'adm-actions adm-dialog-actions' }, del, button('취소', close)));
      openDialog(dialog, close);
      dialog.querySelectorAll('button')[1].focus(); // 실수로 Enter 를 눌러도 지워지지 않게 [취소]에 초점
    }

    async function restore(r, fromSnack) {
      focusLater(`[data-mn-id="${r.id}"] .adm-mn-edit`);
      if (!fromSnack) f.view = 'list';
      const ok = await mutate(async () => { const res = await sb.rpc('admin_menu_restore', { p_id: r.id }); return res.error ? { error: res.error } : {}; }, null);
      if (ok) { f.view = 'list'; toast(`'${r.name}' 메뉴를 되살렸습니다. 지우기 전 등급·자리로 돌아갔습니다.`); }
      else if (!fromSnack) f.view = 'trash';
    }
    async function setShown(r, on) {
      focusLater(`[data-mn-id="${r.id}"] input[role="switch"]`);
      const ok = await mutate(async () => { const res = await sb.rpc('admin_menu_set_active', { p_id: r.id, p_active: on }); return res.error ? { error: res.error } : {}; }, null);
      if (ok) snack(on ? `'${r.name}'을(를) 다시 보이게 했습니다. 볼 수 있는 등급의 회원 화면에 바로 나옵니다.` : `'${r.name}'을(를) 숨겼습니다. 회원 화면에서 바로 빠집니다(등급 권한은 그대로).`, '되돌리기', () => setShown(r, !on));
      else draw();
    }
    async function move(r, step) {
      focusLater(`[data-mn-id="${r.id}"] .adm-mn-${step < 0 ? 'up' : 'down'}`);
      await mutate(async () => { const res = await sb.rpc('admin_menu_move', { p_id: r.id, p_step: step }); return res.error ? { error: res.error } : {}; }, `'${r.name}'을(를) 한 칸 ${step < 0 ? '위로' : '아래로'} 옮겼습니다.`);
    }
    async function moveGroup(g, step) {
      focusLater(`[data-mn-group="${CSS.escape(g.name)}"] .adm-mn-g${step < 0 ? 'up' : 'down'}`);
      await mutate(async () => { const res = await sb.rpc('admin_menu_group_move', { p_name: g.name, p_step: step }); return res.error ? { error: res.error } : {}; }, `'${g.name}' 묶음을 한 칸 ${step < 0 ? '위로' : '아래로'} 옮겼습니다.`);
    }
    function renameGroup(g) {
      const id = 'mng' + (++uid);
      const dialog = el('dialog', { class: 'adm-dialog', 'aria-labelledby': id + '-t' });
      const box = el('input', { class: 'adm-input', id: id + '-i', maxlength: String(GROUP_MAX), value: g.name, autocomplete: 'off' });
      const err = el('p', { class: 'adm-mn-error', role: 'alert', hidden: '' });
      const close = () => { dialog.close(); dialog.remove(); };
      const save = button('이름 바꾸기', async () => {
        const v = box.value.trim();
        if (!v) { err.textContent = '묶음 이름을 적어 주세요.'; err.hidden = false; box.focus(); return; }
        if (v === g.name) return close();
        save.disabled = true;
        const res = await sb.rpc('admin_menu_group_rename', { p_old: g.name, p_new: v });
        save.disabled = false;
        if (res.error) { err.textContent = menuError(res.error); err.hidden = false; box.focus(); return; }
        close();
        focusLater(`[data-mn-group="${CSS.escape(v)}"] .adm-mn-grename`);
        await mutate(async () => ({}), `묶음 이름을 '${v}'(으)로 바꿨습니다. 회원 화면에도 바로 반영됩니다.`);
      }, 'primary');
      dialog.append(el('h3', { id: id + '-t' }, `'${g.name}' 묶음 이름 바꾸기`),
        el('label', { class: 'adm-field', for: id + '-i' }, el('span', {}, '새 이름'), box, el('small', { class: 'adm-note' }, `${GROUP_MAX}자 이내 · 이 묶음의 메뉴 ${inGroup(g.name).length}개가 함께 옮겨집니다`)),
        err, el('div', { class: 'adm-actions adm-dialog-actions' }, save, button('취소', close)));
      box.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); save.click(); } });
      openDialog(dialog, close);
      box.select();
    }

    // ---------- 목록 ----------
    const body = el('div', { class: 'adm-mn-body' });
    const stat = el('p', { class: 'adm-note', role: 'status' });
    const tabsBar = el('div', { class: 'adm-mn-tabs', role: 'tablist', 'aria-label': '메뉴 목록 고르기' });
    const search = el('input', { class: 'adm-input adm-filter', type: 'search', 'aria-label': '메뉴 찾기', placeholder: '이름·설명·주소·묶음으로 찾기', value: f.q || '' });
    search.addEventListener('input', () => { f.q = search.value; draw(); });
    const matches = r => {
      const q = (f.q || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
      return !q || [r.name, r.description, r.url, r.category, r.admin_memo].join(' ').toLocaleLowerCase('ko-KR').replace(/\s/g, '').includes(q);
    };

    function row(r, i, list) {
      const names = gradeNames(r);
      const searching = !!(f.q || '').trim();
      const sw = el('input', { type: 'checkbox', role: 'switch', checked: !!r.active, 'aria-label': `${r.name} 회원에게 보이기`, onchange: e => { if (isBusy()) { e.target.checked = !e.target.checked; return; } setShown(r, e.target.checked); } });
      const up = button('▲ 위로', () => move(r, -1), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-up', 'aria-label': `${r.name} 한 칸 위로`, disabled: searching || i === 0 });
      const down = button('▼ 아래로', () => move(r, 1), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-down', 'aria-label': `${r.name} 한 칸 아래로`, disabled: searching || i === list.length - 1 });
      const where = !r.url ? el('span', { class: 'adm-badge adm-mn-badge--none' }, '주소 없음') : isExternal(r.url) ? el('span', { class: 'adm-badge' }, '외부 링크') : el('span', { class: 'adm-badge' }, '사이트 안 화면');
      return el('li', { class: 'adm-mn-item' + (r.active ? '' : ' is-hidden'), 'data-mn-id': String(r.id) },
        el('div', { class: 'adm-mn-order', role: 'group', 'aria-label': `${r.name} 순서` }, el('span', { class: 'adm-mn-no', 'aria-hidden': 'true' }, searching ? '·' : String(i + 1)), up, down),
        el('div', { class: 'adm-mn-main' },
          el('div', { class: 'adm-mn-title' }, el('strong', {}, r.name), r.active ? null : el('span', { class: 'adm-badge adm-mn-badge--off' }, '숨김'), where, r.url && r.open_new_tab !== false ? el('span', { class: 'adm-badge' }, '새 창') : null),
          el('p', { class: 'adm-mn-desc' + (r.description ? '' : ' is-empty') }, r.description || '설명이 비어 있습니다 — 회원 화면에 설명 줄이 없습니다'),
          r.url ? el('p', { class: 'adm-mn-url' }, el('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${r.name} 주소 열기 (새 창)` }, shortUrl(r.url) + ' ↗')) : el('p', { class: 'adm-mn-url' }, "회원 화면에는 '주소 준비 중'으로 보입니다"),
          el('p', { class: 'adm-mn-grades-line' }, el('span', {}, '볼 수 있는 등급 '), el('b', {}, names.length ? `${names.length}개` : '없음'), ' · ', names.join(' · ') || '관리자만 봄'),
          r.admin_memo ? el('details', { class: 'adm-mx-details' }, el('summary', {}, '관리자 메모'), el('p', { class: 'adm-mn-memo' }, r.admin_memo)) : null),
        el('div', { class: 'adm-mn-actions' },
          el('label', { class: 'adm-mx-switch' }, sw, el('span', { class: 'adm-mx-switch-ui', 'aria-hidden': 'true' }), el('span', { class: 'adm-mx-switch-text', 'aria-hidden': 'true' }, r.active ? '보임' : '숨김')),
          button('수정', () => editor(r), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-edit', 'aria-label': `${r.name} 수정` }),
          button('삭제', () => confirmDelete(r), 'danger', { class: 'adm-button adm-button--danger adm-mn-del', 'aria-label': `${r.name} 삭제` })));
    }

    function listView() {
      const ai = S.resources.find(r => r.kind === 'ai');
      const gs = groups();
      const searching = !!(f.q || '').trim();
      const sections = gs.map((g, gi) => {
        const all = inGroup(g.name), list = all.filter(matches);
        if (searching && !list.length) return null;
        const hidden = all.filter(r => !r.active).length;
        return el('section', { class: 'adm-mn-group', 'data-mn-group': g.name, 'aria-labelledby': 'mn-g-' + gi },
          el('div', { class: 'adm-mn-ghead' },
            el('h3', { id: 'mn-g-' + gi, tabindex: '-1' }, g.name, el('small', {}, ` · 메뉴 ${all.length}개${hidden ? ` (숨김 ${hidden})` : ''}`)),
            el('div', { class: 'adm-mn-gtools', role: 'group', 'aria-label': `${g.name} 묶음 순서·이름` },
              button('묶음 위로', () => moveGroup(g, -1), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-gup', disabled: gi === 0, 'aria-label': `${g.name} 묶음 위로` }),
              button('묶음 아래로', () => moveGroup(g, 1), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-gdown', disabled: gi === gs.length - 1, 'aria-label': `${g.name} 묶음 아래로` }),
              button('이름 바꾸기', () => renameGroup(g), 'secondary', { class: 'adm-button adm-button--secondary adm-mn-grename', 'aria-label': `${g.name} 묶음 이름 바꾸기` }),
              button('＋ 이 묶음에 추가', () => { f.addGroup = g.name; editor(null); f.addGroup = null; }, 'secondary', { 'aria-label': `${g.name} 묶음에 메뉴 추가` }))),
          list.length ? el('ol', { class: 'adm-mn-list' }, ...list.map((r, i) => row(r, searching ? -1 : i, searching ? [] : list)))
            : el('p', { class: 'adm-note adm-mn-emptyg' }, "이 묶음에는 메뉴가 없습니다(지운 메뉴만 있음). 메뉴를 추가하거나, 지운 메뉴의 30일 보관이 끝나면 묶음도 자동으로 정리됩니다."));
      }).filter(Boolean);
      return el('div', { class: 'adm-stack' },
        searching ? el('p', { class: 'adm-note' }, '찾는 동안에는 순서 바꾸기 버튼을 잠시 끕니다.') : null,
        ai && !searching ? el('section', { class: 'adm-mn-ai' }, el('div', {}, el('strong', {}, 'AI 질문'), el('span', { class: 'adm-badge' }, '고정'),
          el('p', { class: 'adm-mn-desc' }, '인트라넷 첫 화면 맨 위 질문창 · 지우거나 옮길 수 없습니다. 등급별 켜기·끄기와 하루 횟수는 메뉴 권한 표에서 정합니다.')),
          button('메뉴 권한 표에서 바꾸기', () => go('matrix'))) : null,
        sections.length ? sections : empty('찾는 메뉴가 없습니다', '검색어를 바꾸거나 지운 메뉴에서 찾아 보세요.'),
        el('p', { class: 'adm-note' }, '보험위키·보험노트 바로가기는 모든 회원에게 늘 보이는 고정 링크라 이 목록에 없습니다.'));
    }

    function trashView() {
      const list = (S.trash || []).filter(matches).sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
      return el('div', { class: 'adm-stack' },
        el('p', { class: 'adm-callout' }, `지운 메뉴는 ${KEEP_DAYS}일 동안 여기에 보관했다가 자동으로 정리합니다. [되살리기]를 누르면 지우기 전 묶음·자리·등급·숨김 상태로 돌아갑니다. 회원 화면에는 지운 메뉴가 보이지 않습니다.`),
        list.length ? el('ul', { class: 'adm-mn-list adm-mn-trash' }, ...list.map(r => {
          const left = daysLeft(r);
          const was = S.grades.filter(g => (r.deleted_grades || []).map(Number).includes(g.id)).map(g => g.name);
          return el('li', { class: 'adm-mn-item', 'data-mn-trash': String(r.id) },
            el('div', { class: 'adm-mn-main' },
              el('div', { class: 'adm-mn-title' }, el('strong', {}, r.name), el('span', { class: 'adm-badge' }, r.category), r.active ? null : el('span', { class: 'adm-badge adm-mn-badge--off' }, '숨김이었음')),
              el('p', { class: 'adm-mn-desc' }, `지운 때 ${fmt(r.deleted_at)} · ${who(r.deleted_by)}`),
              el('p', { class: 'adm-mn-left' + (left <= 3 ? ' is-soon' : '') }, left ? `${left}일 뒤 자동 정리` : '오늘 밤 자동 정리 예정'),
              el('p', { class: 'adm-mn-grades-line' }, '지우기 전 볼 수 있던 등급: ', was.join(' · ') || '없음')),
            el('div', { class: 'adm-mn-actions' }, button('되살리기', () => restore(r, false), 'primary', { class: 'adm-button adm-button--primary adm-mn-restore', 'aria-label': `${r.name} 되살리기` })));
        })) : empty(f.q ? '찾는 지운 메뉴가 없습니다' : '지운 메뉴가 없습니다', f.q ? '검색어를 바꿔 보세요.' : '메뉴를 지우면 이곳에 30일 동안 보관됩니다.'));
    }

    function draw() {
      const menus = S.resources.filter(r => r.kind !== 'ai');
      const visible = menus.filter(r => r.active).length;
      const trashN = (S.trash || []).length;
      tabsBar.replaceChildren(...[['list', `메뉴 목록 (${menus.length})`], ['trash', `지운 메뉴 (${trashN})`]].map(([v, t]) =>
        el('button', { type: 'button', role: 'tab', class: 'adm-mn-tab', 'aria-selected': String(f.view === v), tabindex: f.view === v ? '0' : '-1', 'data-mn-tab': v,
          onclick: () => { f.view = v; draw(); tabsBar.querySelector(`[data-mn-tab="${v}"]`)?.focus(); },
          onkeydown: e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); f.view = f.view === 'list' ? 'trash' : 'list'; draw(); tabsBar.querySelector(`[data-mn-tab="${f.view}"]`)?.focus(); } } }, t)));
      stat.textContent = `회원 화면에 보이는 메뉴 ${visible}개 · 숨김 ${menus.length - visible}개 · 묶음 ${groups().length}개 · 지운 메뉴 ${trashN}개 (+ AI 질문)`;
      body.setAttribute('role', 'tabpanel');
      body.replaceChildren(f.view === 'trash' ? trashView() : listView());
    }

    function resources() {
      if (!['list', 'trash'].includes(f.view)) f.view = 'list';
      draw();
      const view = el('div', { class: 'adm-stack adm-mn-view' },
        el('p', { class: 'adm-callout' }, '회원 업무 도구 화면에 보이는 메뉴를 여기서 추가·수정·숨김·삭제합니다. 바꾸면 회원 화면과 메뉴 권한 표에 바로 반영되고, 변경 기록에 남습니다. 페이지·링크 자체는 지워지지 않습니다.'),
        el('div', { class: 'adm-mn-top' },
          button('＋ 메뉴 추가', () => editor(null), 'primary', { class: 'adm-button adm-button--primary adm-mn-add' }),
          el('label', { class: 'adm-field adm-mn-search' }, el('span', {}, '메뉴 찾기'), search),
          button('메뉴 권한 표', () => go('matrix'), 'secondary')),
        tabsBar, stat, body);
      // 다른 화면(메뉴 권한 표 등)에서 [수정]·[메뉴 추가]로 넘어온 경우
      const open = f.open; f.open = null;
      if (open === 'new') setTimeout(() => editor(null), 0);
      else if (open) { const r = S.resources.find(x => String(x.id) === String(open) && x.kind !== 'ai'); if (r) setTimeout(() => editor(r), 0); }
      if (focusAfter) { const sel = focusAfter; focusAfter = null; setTimeout(() => { const n = document.querySelector(sel); if (n && !n.disabled) n.focus({ preventScroll: false }); else if (n) n.closest('li,section')?.querySelector('button:not([disabled]),input')?.focus(); }, 0); }
      return view;
    }
    return { resources };
  };
})();
