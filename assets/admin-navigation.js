/* Administrator routes and keyboard navigation. No data or permission writes. */
(function () {
  'use strict';
  const groups = [
    ['업무 현황', [['tasks', '요약·현재 처리할 일']]],
    ['회원·승인', [['pending', '가입 승인'], ['members', '회원 관리'], ['requests', '지난 요청']]],
    ['AI 이용', [['ask', 'AI 질문·비용']]],
    ['자료·도구', [['articles', '작성글모음'], ['notice', '새 소식'], ['branches', '본부 관리']]],
    ['설정·기록', [['resources', '메뉴 관리'], ['matrix', '메뉴 권한'], ['grades', '등급 관리'], ['admins', '관리자 관리'], ['hits', '방문 합계'], ['audit', '변경 기록'], ['backup', '백업']]]
  ];
  const media = window.matchMedia('(min-width: 1001px)');
  let currentSelect = null, currentKey = 'tasks', currentCounts = {};
  const make = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  const href = key => key === 'ask' ? '/members/admin/ask/' : '/members/admin/#' + key;
  const visible = key => key !== 'requests' || currentKey === key || Number(currentCounts.requests) > 0;
  media.addEventListener('change', event => document.querySelectorAll('.admin-navigation').forEach(wrap => { wrap.open = event.matches; }));
  function countBadge(key) {
    const value = currentCounts[key];
    if (!(Number(value) > 0)) return null;
    const badge = make('span', String(value), 'admin-navigation-count');
    badge.setAttribute('aria-label', value + '건');
    return badge;
  }
  function create(current, select, counts) {
    currentSelect = select; currentKey = current; currentCounts = counts || {};
    const wrap = make('details', null, 'admin-navigation');
    const active = groups.flatMap(g => g[1]).find(item => item[0] === current);
    const summary = make('summary');
    summary.append(make('span', '☰', 'admin-navigation-toggle'), make('span', active ? active[1] : '요약'), make('span', '전체 메뉴', 'admin-navigation-hint')); wrap.append(summary);
    const nav = make('nav'); nav.setAttribute('aria-label', '관리자 전체 메뉴');
    groups.forEach(([title, items]) => {
      const section = make('div', null, 'admin-navigation-group');
      section.append(make('p', title));
      items.forEach(([key, text]) => {
        if (!visible(key)) return;
        const link = make('a'); link.href = href(key); link.dataset.tab = key;
        link.append(make('span', text));
        const count = countBadge(key); if (count) link.append(count);
        if (current === key) link.setAttribute('aria-current', 'page');
        if (select && key !== 'ask') link.addEventListener('click', event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); select(key); });
        section.append(link);
      }); nav.append(section);
    });
    const search = make('button', null, 'admin-command-trigger'); search.type = 'button'; search.dataset.adminCommand = '';
    search.append(make('span', '메뉴 빠르게 찾기'), make('kbd', '⌘ / Ctrl K'));
    search.setAttribute('aria-haspopup', 'dialog');
    nav.append(search); wrap.append(nav); wrap.open = media.matches;
    wrap.addEventListener('keydown', event => { if (event.key === 'Escape' && !media.matches) { wrap.open = false; summary.focus(); } });
    return wrap;
  }
  function openCommand() {
    if (!document.querySelector('.admin-navigation') || document.querySelector('dialog[open]')) return;
    const origin = document.activeElement;
    let restoreFocus = true;
    const dialog = make('dialog', null, 'admin-command'); dialog.setAttribute('aria-labelledby', 'admin-command-title');
    const head = make('div', null, 'admin-command-head'), title = make('h2', '메뉴 빠르게 찾기'); title.id = 'admin-command-title';
    const close = make('button', '닫기 Esc', 'admin-command-close'); close.type = 'button'; close.addEventListener('click', () => dialog.close());
    head.append(title, close);
    const query = make('input'); query.type = 'search'; query.placeholder = '메뉴 이름으로 검색'; query.setAttribute('aria-label', '관리자 메뉴 검색'); query.autocomplete = 'off';
    const hint = make('p', '↑ ↓ 이동 · Enter 열기 · Esc 닫기', 'admin-command-help');
    const list = make('div', null, 'admin-command-results'); list.setAttribute('aria-label', '메뉴 검색 결과');
    const status = make('p', null, 'admin-command-help'); status.setAttribute('role', 'status');
    const entries = groups.flatMap(([group, items]) => items.filter(([key]) => visible(key)).map(([key, label]) => ({key, label, group})));
    const draw = () => {
      const term = query.value.toLocaleLowerCase().replace(/\s/g, '');
      const results = entries.filter(e => (e.label + e.group).toLocaleLowerCase().replace(/\s/g, '').includes(term));
      list.replaceChildren(...results.map(e => {
        const b = make('button', null, 'admin-command-result'); b.type = 'button';
        const label = make('span', e.label, 'admin-command-label');
        const count = countBadge(e.key); if (count) label.append(count);
        b.append(label, make('small', e.key === currentKey ? '현재 메뉴' : e.group));
        b.addEventListener('click', () => {
          restoreFocus = false; dialog.close();
          if (currentSelect && e.key !== 'ask') { if (currentSelect(e.key) === false) restoreFocus = true; }
          else location.href = href(e.key);
        }); return b;
      }));
      status.textContent = results.length ? results.length + '개 메뉴' : '맞는 메뉴가 없습니다. 다른 검색어를 입력해 주세요.';
    };
    query.addEventListener('input', draw);
    dialog.addEventListener('keydown', event => {
      if (event.isComposing) return;
      const options = [...list.querySelectorAll('button')], at = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); const next = event.key === 'ArrowDown' ? (at + 1) % options.length : (at < 1 ? options.length - 1 : at - 1); options[next]?.focus();
      } else if (event.key === 'Enter' && document.activeElement === query) { event.preventDefault(); options[0]?.click(); }
    });
    dialog.addEventListener('close', () => { dialog.remove(); if (restoreFocus && origin?.isConnected) origin.focus({preventScroll:true}); }, {once:true});
    dialog.append(head, query, hint, list, status); draw(); document.body.append(dialog); dialog.showModal(); query.focus();
  }
  document.addEventListener('click', event => { if (event.target.closest('[data-admin-command]')) openCommand(); });
  document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') { if (document.querySelector('.admin-navigation')) { event.preventDefault(); openCommand(); } } });
  window.PA_ADMIN_NAV = { create, openCommand };
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('[data-admin-navigation]').forEach(node => node.replaceChildren(create(node.dataset.adminNavigation || 'ask'))));
})();
