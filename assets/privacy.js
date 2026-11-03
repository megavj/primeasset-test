/* PAGES-V1 6 · 문서 탐색, 항목 링크 복사, 인쇄. 새 요청·저장·권한 판정 없음. */
(function () {
  'use strict';
  var doc = document;

  // Existing home/story display hint only. /members/ still checks actual access.
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var value;
        try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { continue; }
        if (value && value.access_token && (!value.expires_at || value.expires_at * 1000 > Date.now() - 86400000)) return true;
      }
    } catch (error) { /* Storage denied: document remains available. */ }
    return false;
  }
  function refreshMemberDisplay() {
    var member = hasStoredSession();
    var focused = doc.activeElement;
    var leaving = focused && focused.closest && focused.closest(member ? '[data-privacy-guest]' : '[data-privacy-member]');
    doc.documentElement.classList.toggle('privacy-member', member);
    if (leaving) {
      var target = doc.querySelector(member ? '.g-menu a[href="../members/"]' : '.g-menu-login');
      if (target) target.focus({ preventScroll: true });
    }
  }
  refreshMemberDisplay();
  window.addEventListener('storage', function (event) {
    if (event.key === null || /^sb-[a-z0-9]+-auth-token$/.test(event.key || '')) refreshMemberDisplay();
  });
  window.addEventListener('pageshow', refreshMemberDisplay);
  window.addEventListener('focus', refreshMemberDisplay);
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) refreshMemberDisplay(); });

  function start() {
    var printButton = doc.getElementById('privacy-print');
    if (printButton && typeof window.print === 'function') {
      printButton.hidden = false;
      printButton.addEventListener('click', function () { window.print(); });
    }
    var links = Array.prototype.slice.call(doc.querySelectorAll('.privacy-toc a[href^="#"]'));
    var sections = links.map(function (link) { return doc.getElementById(link.hash.slice(1)); });
    var ticking = false;
    function updateLocation() {
      ticking = false;
      var current = -1;
      sections.forEach(function (section, index) {
        if (section.getBoundingClientRect().top <= Math.max(140, window.innerHeight * 0.25)) current = index;
      });
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= doc.documentElement.scrollHeight - 4) current = sections.length - 1;
      links.forEach(function (link, index) {
        if (index === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }
    function scheduleLocation() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateLocation); }
    }
    window.addEventListener('scroll', scheduleLocation, { passive: true });
    window.addEventListener('resize', scheduleLocation);
    window.addEventListener('hashchange', scheduleLocation);

    var status = doc.getElementById('privacy-status');
    var timer;
    function announce(message) {
      window.clearTimeout(timer);
      status.textContent = message;
      timer = window.setTimeout(function () { status.textContent = ''; }, 4500);
    }
    var dialog = doc.getElementById('privacy-copy-dialog');
    var urlField = doc.getElementById('privacy-copy-url');
    var copyTrigger;
    function manualCopy(url, button) {
      if (dialog && typeof dialog.showModal === 'function') {
        copyTrigger = button;
        urlField.value = url;
        if (!dialog.open) dialog.showModal();
        urlField.focus();
        urlField.select();
      } else {
        // Legacy fallback leaves a real anchor in the address bar for manual copying.
        location.hash = button.getAttribute('data-copy-section');
        announce('이 항목으로 이동했습니다. 브라우저 주소창의 주소를 복사해 주세요.');
      }
    }
    dialog.addEventListener('close', function () { if (copyTrigger) copyTrigger.focus({ preventScroll: true }); });
    doc.querySelectorAll('[data-copy-section]').forEach(function (button) {
      button.hidden = false;
      button.addEventListener('click', function () {
        var url = new URL(location.href);
        url.search = '';
        url.hash = button.getAttribute('data-copy-section');
        var address = url.href;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(address).then(function () {
            announce('이 항목의 링크를 복사했습니다.');
          }).catch(function () { manualCopy(address, button); });
        } else manualCopy(address, button);
      });
    });
    updateLocation();
    refreshMemberDisplay();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
