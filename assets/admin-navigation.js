/* Shared administrator navigation. All existing management routes remain available. */
(function () {
  'use strict';
  const groups = [
    ['요약', [['tasks', '요약·현재 처리할 일']]],
    ['회원·승인', [['pending', '가입 승인'], ['requests', '메뉴 이용 요청'], ['members', '회원 관리']]],
    ['AI 질문·비용', [['ask', 'AI 질문·비용']]],
    ['자료·도구', [['notice', '새 소식'], ['resources', '페이지·도구'], ['branches', '본부 관리']]],
    ['설정·기록', [['matrix', '메뉴 권한'], ['grades', '등급 관리'], ['admins', '관리자 관리'], ['hits', '방문 합계'], ['audit', '변경 기록'], ['backup', '백업']]]
  ];
  const media = window.matchMedia('(min-width: 801px)');
  media.addEventListener('change', event => document.querySelectorAll('.admin-navigation').forEach(wrap => { wrap.open = event.matches; }));
  function create(current, select, counts) {
    const wrap = document.createElement('details'); wrap.className = 'admin-navigation';
    const summary = document.createElement('summary');
    const active = groups.find(group => group[1].some(item => item[0] === current));
    summary.textContent = '현재 메뉴: ' + (active ? active[0] : '요약') + ' · 전체 메뉴'; wrap.append(summary);
    const nav = document.createElement('nav'); nav.setAttribute('aria-label', '관리자 전체 메뉴');
    groups.forEach(([title, items]) => {
      const section = document.createElement('div'); section.className = 'admin-navigation-group';
      const label = document.createElement('p'); label.textContent = title; section.append(label);
      items.forEach(([key, text]) => {
        const link = document.createElement('a'); link.href = key === 'ask' ? '/members/admin/ask/' : '/members/admin/#' + key;
        link.textContent = text; link.dataset.tab = key;
        if (counts && counts[key] != null) link.textContent += ' (' + counts[key] + ')';
        if (current === key) link.setAttribute('aria-current', 'page');
        if (select && key !== 'ask') link.addEventListener('click', event => { event.preventDefault(); select(key); });
        section.append(link);
      }); nav.append(section);
    }); wrap.append(nav);
    wrap.open = media.matches;
    summary.addEventListener('click', event => { if (media.matches) event.preventDefault(); });
    wrap.addEventListener('keydown', event => { if (event.key === 'Escape' && !media.matches) { wrap.open = false; summary.focus(); } });
    return wrap;
  }
  window.PA_ADMIN_NAV = { create };
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('[data-admin-navigation]').forEach(node => node.replaceChildren(create(node.dataset.adminNavigation || 'ask'))));
})();
