/* TASK-ADM 메뉴 권한(2026-11-09). 사이트 메뉴 순서대로 묶은 권한표: 줄마다 쉬운 설명·미리보기, 등급 머리에 볼 수 있는 메뉴 수와
   [이 등급으로 보기], 바뀐 칸 색 표시, 저장 전 '무엇이 바뀌는지' 확인. 휴대폰은 등급을 고르면 메뉴가 켜기/끄기 스위치 목록.
   'AI 질문' 줄은 켜기/끄기와 등급별 하루 질문 횟수를 함께 둔다(서버도 같은 값으로 검사). 저장은 기존 표(grade_permissions·grades)를 그대로 쓴다. */
(function () {
  'use strict';
  // TASK-MENU(2026-11-09): 묶음·쉬운 설명·주소·관리자 메모는 DB(메뉴 관리 화면에서 정함)를 그대로 쓴다. 회원 화면(my_menu)과 같은 목록·같은 순서.
  //   예전에 이 파일에 있던 메뉴 이름 사전(묶음·설명)과 주소 바꾸기 규칙은 DB로 옮겼다(작업 폴더 sql/menu02_data.sql).
  const route = r => {
    if (r.kind === 'ai') return { group: 'ai', url: '/members/#home' };
    if (!r.active) return { group: 'hidden', url: r.url || null, why: '숨김으로 설정됨 — 메뉴 관리에서 켤 수 있음' };
    return { group: r.category, url: r.url || null };
  };

  window.PA_ADMIN_MATRIX = function (ctx) {
    const { sb, S, el, button, input, empty, toast, mutate, num, setDirty, filters, go } = ctx;
    const media = window.matchMedia('(max-width: 800px)');
    const descOf = r => r.description || (r.url ? '설명이 비어 있습니다 — 메뉴 관리에서 한 줄 적어 주세요' : '아직 주소가 없는 준비 중 메뉴');
    const checkNote = r => r.admin_memo ? el('small', { class: 'adm-mx-why' + (/^⚠/.test(r.admin_memo) ? ' is-warn' : '') }, '메모: ' + r.admin_memo) : null;
    const editLink = r => r.kind === 'ai' ? null : el('button', { type: 'button', class: 'adm-mx-edit', onclick: () => go('resources', { open: r.id }), 'aria-label': `${r.name} 메뉴 수정(메뉴 관리)` }, '수정');
    const memberCount = g => S.members.filter(m => m.grade_id === g.id).length;

    function matrix() {
      const f = filters.matrix;
      // 묶음 순서 = DB 묶음 순서(회원 화면과 같음). 'AI 질문' 맨 위, 숨김 메뉴 맨 아래. 불러올 때마다 다시 계산.
      const WORK = (S.groups || []).filter(g => !g.system).map(g => g.name);
      const GROUPS = [['ai', 'AI 질문', '인트라넷 첫 화면 맨 위 질문창'], ...WORK.map(w => [w, '업무 도구 · ' + w, '인트라넷 업무 도구 묶음']), ['hidden', '회원 화면에 안 보이는 메뉴', '숨김 메뉴 — 켜 두어도 회원에게 보이지 않습니다']];
      const want = new Set(S.perms), limits = new Map(S.grades.map(g => [g.id, Number(g.ask_daily_limit ?? 20)]));
      // 묶음 안 순서는 회원 메뉴(my_menu: 묶음 순서·순서·이름)와 같게 — 글자 코드 순으로 비교한다.
      const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
      const rows = S.resources.map(r => ({ r, ...route(r) }))
        .sort((a, b) => GROUPS.findIndex(x => x[0] === a.group) - GROUPS.findIndex(x => x[0] === b.group) || cmp(String(a.r.category), String(b.r.category)) || (a.r.sort || 0) - (b.r.sort || 0) || cmp(String(a.r.name), String(b.r.name)) || a.r.id - b.r.id);
      const key = (g, r) => g.id + ':' + r.id;
      const visible = row => row.group !== 'hidden';
      const ai = rows.find(x => x.group === 'ai');
      const diff = () => {
        const add = [...want].filter(k => !S.perms.has(k)), del = [...S.perms].filter(k => !want.has(k));
        const lim = S.grades.filter(g => limits.get(g.id) !== Number(g.ask_daily_limit ?? 20)).map(g => [g.id, limits.get(g.id)]);
        return { add, del, limits: lim, count: add.length + del.length + lim.length };
      };
      const seeCount = g => rows.filter(x => visible(x) && want.has(key(g, x.r))).length;
      const totalVisible = rows.filter(visible).length;
      const counters = new Map(), cells = new Map(), limitInputs = new Map();
      const shown = () => {
        const q = (f.q || '').toLocaleLowerCase('ko-KR').replace(/\s/g, '');
        return rows.filter(x => !q || [x.r.name, descOf(x.r), GROUPS.find(g => g[0] === x.group)[1]].join(' ').toLocaleLowerCase('ko-KR').replace(/\s/g, '').includes(q));
      };

      const bar = el('div', { class: 'adm-mx-savebar', role: 'region', 'aria-label': '바뀐 내용 저장', hidden: '' });
      const barText = el('p', { class: 'adm-mx-savebar-text', role: 'status' });
      const saveBtn = button('바뀐 내용 확인 후 저장', () => confirmSave(), 'primary');
      const undoBtn = button('모두 되돌리기', () => { want.clear(); S.perms.forEach(k => want.add(k)); S.grades.forEach(g => limits.set(g.id, Number(g.ask_daily_limit ?? 20))); draw(); sync(); });
      bar.append(barText, el('div', { class: 'adm-actions' }, saveBtn, undoBtn));
      function sync() {
        const d = diff();
        setDirty(d.count > 0);
        bar.hidden = !d.count;
        barText.textContent = d.count ? `바뀐 곳 ${num(d.count)}개 · 아직 저장되지 않았습니다` : '';
        S.grades.forEach(g => { const c = counters.get(g.id); if (c) c.forEach(node => { node.textContent = `볼 수 있는 메뉴 ${seeCount(g)}개`; }); });
        cells.forEach((nodes, k) => {
          const changed = want.has(k) !== S.perms.has(k);
          nodes.forEach(n => { n.classList.toggle('is-changed', changed); const tag = n.querySelector('.adm-mx-changed'); if (tag) tag.hidden = !changed; });
        });
        limitInputs.forEach((nodes, gid) => {
          const g = S.grades.find(x => x.id === gid), on = ai && want.has(gid + ':' + ai.r.id);
          nodes.forEach(n => { n.input.disabled = !on; n.wrap.classList.toggle('is-changed', limits.get(gid) !== Number(g.ask_daily_limit ?? 20)); });
        });
      }
      const remember = (map, k, node) => { if (!map.has(k)) map.set(k, []); map.get(k).push(node); };
      const toggle = (g, row, on) => { const k = key(g, row.r); if (on) want.add(k); else want.delete(k); sync(); };
      const changedTag = () => el('span', { class: 'adm-mx-changed', hidden: '' }, '바뀜');
      const previewLink = row => row.url ? el('a', { class: 'adm-mx-preview', href: row.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${row.r.name} 미리보기 (새 창)` }, '미리보기 ↗') : el('span', { class: 'adm-mx-nourl' }, '주소 없음');
      function limitField(g) {
        const box = input(`${g.name} AI 하루 질문 횟수`, String(limits.get(g.id)), { type: 'number', min: '1', max: '1000', step: '1', inputmode: 'numeric', class: 'adm-input adm-mx-limit-input' });
        box.removeAttribute('data-draft');
        box.addEventListener('input', () => { const v = Number(box.value); limits.set(g.id, Number.isInteger(v) ? v : box.value); sync(); });
        const wrap = el('label', { class: 'adm-mx-limit' }, el('span', {}, '하루'), box, el('span', {}, '회'));
        remember(limitInputs, g.id, { input: box, wrap });
        return wrap;
      }
      const memberNote = el('p', { class: 'adm-note' });

      // PC: 표(줄 = 메뉴, 칸 = 등급)
      function desktop(list) {
        const grades = S.grades.filter(g => !f.grade || String(g.id) === String(f.grade));
        const head = el('tr', {}, el('th', { scope: 'col', class: 'adm-mx-corner' }, '메뉴', el('small', {}, '✓ 표시 = 그 등급 회원이 볼 수 있음')),
          ...grades.map(g => {
            const count = el('span', { class: 'adm-mx-count' });
            remember(counters, g.id, count);
            return el('th', { scope: 'col' }, el('div', { class: 'adm-mx-head' }, el('strong', {}, g.name), el('small', {}, `회원 ${num(memberCount(g))}명`), count,
              button('이 등급으로 보기', () => previewGrade(g), 'secondary', { class: 'adm-button adm-button--secondary adm-mx-asgrade', 'aria-label': `${g.name} 등급 회원에게 보이는 화면 미리보기` })));
          }));
        const body = [];
        GROUPS.forEach(([gk, title, sub]) => {
          const items = list.filter(x => x.group === gk);
          if (!items.length) return;
          body.push(el('tr', { class: 'adm-mx-group' + (gk === 'hidden' ? ' is-hidden-group' : '') }, el('th', { scope: 'rowgroup', colspan: String(grades.length + 1) }, el('span', {}, title), el('small', {}, ` · ${items.length}개 · ${sub}`))));
          items.forEach(row => body.push(el('tr', { class: gk === 'hidden' ? 'is-muted' : '' },
            el('th', { scope: 'row' }, el('div', { class: 'adm-mx-name' }, el('strong', {}, row.r.name), previewLink(row), editLink(row.r)), el('p', { class: 'adm-mx-desc' }, descOf(row.r)), checkNote(row.r), row.why ? el('small', { class: 'adm-mx-why' }, row.why) : null),
            ...grades.map(g => {
              const k = key(g, row.r);
              const box = el('input', { type: 'checkbox', checked: want.has(k), 'aria-label': `${g.name} · ${row.r.name} 볼 수 있음`, onchange: e => toggle(g, row, e.target.checked) });
              const td = el('td', { class: 'adm-mx-cell' }, el('label', { class: 'adm-mx-check' }, box, el('span', { class: 'adm-mx-mark', 'aria-hidden': 'true' })), row.group === 'ai' ? limitField(g) : null, changedTag());
              remember(cells, k, td);
              return td;
            }))));
        });
        return el('div', { class: 'adm-table-scroll adm-matrix adm-mx', tabindex: '0', role: 'region', 'aria-label': '등급별 메뉴 권한표 · 좌우로 움직일 수 있습니다' },
          el('table', { class: 'adm-table' }, el('caption', { class: 'sr' }, '등급별 메뉴 권한표'), el('thead', {}, head), el('tbody', {}, ...body)));
      }

      // 휴대폰: 등급 하나를 고르면 그 등급의 메뉴가 스위치 목록
      const chipBar = el('div', { class: 'adm-mx-chips', role: 'group', 'aria-label': '등급 고르기' });
      function mobile(list) {
        if (!S.grades.some(g => String(g.id) === String(f.grade))) f.grade = String(S.grades[0]?.id || '');
        const g = S.grades.find(x => String(x.id) === String(f.grade));
        chipBar.replaceChildren(...S.grades.map(x => button(el('span', {}, x.name, el('small', {}, ` ${num(memberCount(x))}명`)), () => { f.grade = String(x.id); draw(); chipBar.querySelector('[aria-pressed="true"]')?.focus(); }, 'secondary', { 'aria-pressed': String(String(x.id) === String(f.grade)), class: 'adm-button adm-button--secondary adm-mx-chip' })));
        if (!g) return empty('등급이 없습니다', '등급 관리에서 등급을 먼저 만들어 주세요.');
        const count = el('span', { class: 'adm-mx-count' }); remember(counters, g.id, count);
        const sections = GROUPS.map(([gk, title, sub]) => {
          const items = list.filter(x => x.group === gk);
          if (!items.length) return null;
          const listNode = el('ul', { class: 'adm-mx-list' }, ...items.map(row => {
            const k = key(g, row.r);
            const sw = el('input', { type: 'checkbox', role: 'switch', checked: want.has(k), 'aria-label': `${row.r.name} 볼 수 있음`, onchange: e => { toggle(g, row, e.target.checked); state.textContent = e.target.checked ? '켬' : '끔'; } });
            const state = el('span', { class: 'adm-mx-switch-text', 'aria-hidden': 'true' }, want.has(k) ? '켬' : '끔');
            const li = el('li', { class: 'adm-mx-item' + (gk === 'hidden' ? ' is-muted' : '') },
              el('div', { class: 'adm-mx-item-text' }, el('strong', {}, row.r.name), el('p', { class: 'adm-mx-desc' }, descOf(row.r)), checkNote(row.r), el('div', { class: 'adm-mx-item-links' }, previewLink(row), editLink(row.r), changedTag())),
              el('label', { class: 'adm-mx-switch' }, sw, el('span', { class: 'adm-mx-switch-ui', 'aria-hidden': 'true' }), state),
              row.group === 'ai' ? limitField(g) : null);
            remember(cells, k, li);
            return li;
          }));
          const section = el('section', { class: 'adm-mx-section' }, el('h3', {}, title, el('small', {}, ` · ${items.length}개`)), el('p', { class: 'adm-note' }, sub), listNode);
          return gk === 'hidden' ? el('details', { class: 'adm-mx-hidden' }, el('summary', {}, `${title} ${items.length}개 펼치기`), section) : section;
        });
        return el('div', { class: 'adm-mx-mobile' }, el('div', { class: 'adm-mx-gradehead' }, el('div', {}, el('strong', {}, g.name), el('small', {}, ` 회원 ${num(memberCount(g))}명 · `), count),
          button('이 등급으로 보기', () => previewGrade(g), 'secondary')), ...sections);
      }

      const body = el('div', { class: 'adm-mx-body' });
      function draw() {
        counters.clear(); cells.clear(); limitInputs.clear();
        const list = shown();
        body.replaceChildren(list.length ? (media.matches ? mobile(list) : desktop(list)) : empty('찾는 메뉴가 없습니다', '검색어를 바꿔 보세요.'));
        chipBar.hidden = !media.matches;
        gradeField.hidden = media.matches;
        memberNote.textContent = `회원 화면에 보이는 메뉴 ${totalVisible}개 · 숨김 ${rows.length - totalVisible}개. 관리자는 체크와 관계없이 모든 메뉴를 볼 수 있습니다.`;
        sync();
      }

      // 저장 전 확인: 등급별로 무엇이 켜지고 꺼지는지
      function summary(d) {
        const name = id => S.resources.find(r => String(r.id) === String(id))?.name || '메뉴';
        return S.grades.map(g => {
          const on = d.add.filter(k => k.split(':')[0] === String(g.id)).map(k => name(k.split(':')[1]));
          const off = d.del.filter(k => k.split(':')[0] === String(g.id)).map(k => name(k.split(':')[1]));
          const lim = d.limits.find(x => x[0] === g.id);
          if (!on.length && !off.length && !lim) return null;
          return { g, on, off, lim };
        }).filter(Boolean);
      }
      function confirmSave() {
        const d = diff();
        if (!d.count) return toast('바뀐 곳이 없습니다.');
        const badLimit = d.limits.find(([, v]) => !Number.isInteger(v) || v < 1 || v > 1000);
        if (badLimit) { toast('AI 하루 질문 횟수는 1~1000 사이 숫자로 적어 주세요.', true); limitInputs.get(badLimit[0])?.[0]?.input.focus(); return; }
        const parts = summary(d);
        const dialog = el('dialog', { class: 'adm-dialog', 'aria-labelledby': 'adm-mx-confirm-title' });
        const close = () => { dialog.close(); dialog.remove(); saveBtn.focus(); };
        dialog.append(el('h3', { id: 'adm-mx-confirm-title' }, '이렇게 바뀝니다'),
          el('p', { class: 'adm-note' }, '저장하면 해당 등급의 모든 회원에게 바로 적용됩니다.'),
          ...parts.map(p => el('section', { class: 'adm-mx-change' }, el('h4', {}, `${p.g.name} (회원 ${num(memberCount(p.g))}명)`),
            el('ul', {}, p.on.length ? el('li', {}, el('b', { class: 'is-on' }, '볼 수 있게: '), p.on.join(', ')) : null,
              p.off.length ? el('li', {}, el('b', { class: 'is-off' }, '안 보이게: '), p.off.join(', ')) : null,
              p.lim ? el('li', {}, el('b', {}, 'AI 하루 질문 횟수: '), `${num(p.g.ask_daily_limit ?? 20)}회 → ${num(p.lim[1])}회`) : null))),
          el('div', { class: 'adm-actions adm-dialog-actions' }, button(`${num(d.count)}곳 바꾸기`, async () => { close(); await save(d); }, 'primary'), button('취소', close)));
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        document.body.append(dialog);
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else if (window.confirm(parts.map(p => `${p.g.name}: 켬 ${p.on.length} · 끔 ${p.off.length}${p.lim ? ' · 하루 ' + p.lim[1] + '회' : ''}`).join('\n') + '\n저장할까요?')) { dialog.remove(); save(d); }
      }
      async function save(d) {
        let done = 0;
        const ok = await mutate(async () => {
          try {
            for (const k of d.del) { const [g, r] = k.split(':'); const res = await sb.from('grade_permissions').delete().eq('grade_id', +g).eq('resource_id', +r); if (res.error) throw res.error; done++; }
            if (d.add.length) { const res = await sb.from('grade_permissions').insert(d.add.map(k => { const [g, r] = k.split(':'); return { grade_id: +g, resource_id: +r }; })); if (res.error) throw res.error; done += d.add.length; }
            for (const [gid, v] of d.limits) { const res = await sb.from('grades').update({ ask_daily_limit: v }).eq('id', gid); if (res.error) throw res.error; done++; }
            return {};
          } catch (e) { return { error: e }; }
        }, `메뉴 권한 ${num(d.count)}곳을 저장했습니다. 해당 등급 회원에게 바로 적용됩니다.`);
        if (!ok && done) toast(`${num(done)}곳만 저장되고 나머지는 저장되지 않았습니다. 새로고침해 지금 상태를 확인해 주세요.`, true);
      }

      // 이 등급으로 보기: 그 등급 회원의 인트라넷 첫 화면이 어떻게 보이는지(저장 전 변경 포함)
      function previewGrade(g) {
        const aiOn = ai && want.has(key(g, ai.r));
        const tools = rows.filter(x => visible(x) && x.group !== 'ai');
        const dialog = el('dialog', { class: 'adm-dialog adm-dialog--wide adm-mx-preview-dialog', 'aria-labelledby': 'adm-mx-preview-title' });
        const close = () => { dialog.close(); dialog.remove(); };
        const unsaved = diff().count > 0;
        dialog.append(el('div', { class: 'adm-dialog-head' }, el('h3', { id: 'adm-mx-preview-title' }, `'${g.name}' 등급 회원에게 보이는 화면`), button('닫기', close)),
          el('p', { class: 'adm-note' }, unsaved ? '아직 저장하지 않은 변경도 반영한 미리보기입니다.' : '지금 저장된 설정 그대로의 미리보기입니다.', ' 실제 화면은 회원 인트라넷 첫 화면입니다.'),
          el('section', { class: 'adm-mx-pv-ai' + (aiOn ? '' : ' is-locked') }, el('h4', {}, '업무가 막힐 때, AI에게 물어보세요'),
            aiOn ? el('p', {}, `질문창이 보입니다 · 하루 ${num(limits.get(g.id))}회`) : el('p', {}, '🔒 현재 등급에서는 AI 질문을 이용할 수 없습니다')),
          el('h4', {}, `업무 도구 · 볼 수 있음 ${tools.filter(x => want.has(key(g, x.r))).length}개 / 전체 ${tools.length}개`),
          ...WORK.map(w => {
            const items = tools.filter(x => x.group === w);
            return el('section', { class: 'adm-mx-pv-group' }, el('h5', {}, w), items.length ? el('ul', {}, ...items.map(x => {
              const on = want.has(key(g, x.r));
              return el('li', { class: on ? 'is-open' : 'is-locked' }, el('strong', {}, on ? x.r.name : '🔒 ' + x.r.name), el('small', {}, on ? descOf(x.r) : '관리자가 등급에 따라 열어 드립니다'));
            })) : el('p', { class: 'adm-note' }, '등록된 도구가 없습니다.'));
          }),
          el('p', { class: 'adm-note' }, '보험위키·보험노트 바로가기는 모든 회원에게 보입니다. 숨김 메뉴는 회원 화면에 나오지 않습니다.'));
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        document.body.append(dialog);
        if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      }

      const q = input('메뉴 검색', f.q || '', { type: 'search', placeholder: '메뉴 이름이나 설명으로 찾기' });
      q.removeAttribute('data-draft'); q.classList.add('adm-filter');
      q.addEventListener('input', () => { f.q = q.value; draw(); });
      const gradeSelect = el('select', { class: 'adm-input adm-filter', 'aria-label': '표에 보일 등급' }, el('option', { value: '' }, '모든 등급'), ...S.grades.map(g => el('option', { value: String(g.id), selected: String(g.id) === String(f.grade) }, g.name)));
      gradeSelect.addEventListener('change', () => { f.grade = gradeSelect.value; draw(); });
      const gradeField = el('label', { class: 'adm-field' }, el('span', {}, '보일 등급'), gradeSelect);
      const onMedia = () => { if (body.isConnected) draw(); else media.removeEventListener('change', onMedia); };
      media.addEventListener('change', onMedia);
      draw();
      return el('div', { class: 'adm-stack adm-mx-view' },
        el('p', { class: 'adm-callout' }, '✓ 표시한 메뉴를 그 등급 회원이 볼 수 있습니다. 바꾼 칸은 색으로 표시되고, 아래 [바뀐 내용 확인 후 저장]을 눌러야 적용됩니다. 메뉴 자체의 추가·이름·주소·순서·삭제는 [메뉴 관리]에서 합니다.'),
        el('div', { class: 'adm-toolbar' }, el('label', { class: 'adm-field' }, el('span', {}, '메뉴 찾기'), q), gradeField,
          button('＋ 메뉴 추가', () => go('resources', { open: 'new' }), 'secondary'), button('메뉴 관리', () => go('resources'), 'secondary')),
        chipBar, memberNote, body, bar);
    }
    return { matrix };
  };
})();
