/* TASK43 — 공통 본부 목록 구독만 사용하며 REST 요청을 추가하지 않는다. */
(function () {
  'use strict';
  function init() {
    const root = document.querySelector('[data-premium-branches]');
    if (!root || !window.PA_BRANCHES || !window.matchMedia) return;
    const desktop = window.matchMedia('(min-width:1024px) and (hover:hover) and (pointer:fine)');
    const toggle = root.querySelector('.premium-branches__toggle');
    const panel = root.querySelector('.premium-branches__panel');
    const list = root.querySelector('.premium-branches__list');
    const count = root.querySelector('[data-premium-branch-count]');
    const items = () => Array.from(list.querySelectorAll('.premium-branches__item'));
    const focus = element => element.focus({ preventScroll: true });
    function focusItem(element) {
      focus(element);
      // 페이지는 그대로 두고 목록 안에서만 초점 항목을 보이게 한다.
      const box = list.getBoundingClientRect(), item = element.getBoundingClientRect();
      if (item.top < box.top) list.scrollTop -= box.top - item.top;
      else if (item.bottom > box.bottom) list.scrollTop += item.bottom - box.bottom;
    }
    function close(restoreFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus && desktop.matches) focus(toggle);
    }
    function open() {
      if (!desktop.matches) return;
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      list.scrollTop = 0;
      focusItem(items()[0] || panel);
    }
    function render(branches) {
      const active = document.activeElement;
      const hadFocus = list.contains(active);
      const activeNo = hadFocus ? active.getAttribute('data-branch-no') : null;
      const scrollTop = list.scrollTop;
      list.replaceChildren(...branches.map(branch => {
        const row = document.createElement('li');
        const item = document.createElement(branch.url ? 'a' : 'span');
        item.className = 'premium-branches__item';
        item.setAttribute('data-branch-no', branch.no);
        if (branch.url) {
          item.href = branch.url;
          item.target = '_blank';
          item.rel = 'noopener noreferrer';
          item.setAttribute('aria-label', branch.no + '본부 홈페이지 (새 창)');
        } else {
          item.setAttribute('role', 'link');
          item.setAttribute('aria-disabled', 'true');
          item.tabIndex = -1;
        }
        const label = document.createElement('b');
        label.textContent = branch.no + '본부';
        const hint = document.createElement('small');
        hint.textContent = branch.url ? '홈페이지 ↗' : '준비 중';
        item.append(label, hint);
        row.append(item);
        return row;
      }));
      count.textContent = String(branches.length);
      list.scrollTop = scrollTop;
      if (hadFocus && !panel.hidden) {
        const next = items().find(item => item.getAttribute('data-branch-no') === activeNo);
        focusItem(next || items()[0] || panel);
      }
    }
    toggle.addEventListener('click', () => panel.hidden ? open() : close(true));
    toggle.addEventListener('keydown', event => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); open(); }
    });
    list.addEventListener('keydown', event => {
      const all = items(), index = all.indexOf(document.activeElement);
      if (index < 0) return;
      let next;
      switch (event.key) {
        case 'ArrowRight': next = index + 1; break;
        case 'ArrowLeft': next = index - 1; break;
        case 'ArrowDown': next = index + 3; break;
        case 'ArrowUp': next = index - 3; break;
        case 'Home': next = 0; break;
        case 'End': next = all.length - 1; break;
        default: return;
      }
      event.preventDefault();
      focusItem(all[Math.max(0, Math.min(all.length - 1, next))]);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); close(true); }
    });
    document.addEventListener('click', event => {
      if (!root.contains(event.target)) close(panel.contains(document.activeElement));
    });
    document.addEventListener('focusin', event => {
      if (!root.contains(event.target)) close(false);
    });
    function syncDesktop() {
      const hadFocus = root.contains(document.activeElement);
      if (!desktop.matches) close(false);
      root.hidden = !desktop.matches;
      if (hadFocus && !desktop.matches) {
        const main = document.getElementById('main');
        if (main) { main.setAttribute('tabindex', '-1'); focus(main); }
      }
    }
    if (desktop.addEventListener) desktop.addEventListener('change', syncDesktop);
    else desktop.addListener(syncDesktop);
    window.PA_BRANCHES.subscribe(render);
    syncDesktop();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
