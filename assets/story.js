/* PAGES-V1 5 · 페이지 탐색·회원용 이동. 외부 요청/저장/권한 판정 없음. */
(function () {
  'use strict';
  var doc = document;

  // Existing home/performance display rule. This is only a navigation hint;
  // actual membership/approval/resource access is still checked by /members/.
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var value;
        try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { continue; }
        if (value && value.access_token && (!value.expires_at || value.expires_at * 1000 > Date.now() - 86400000)) return true;
      }
    } catch (error) { /* Private mode/storage denied: the public page remains usable. */ }
    return false;
  }
  function refreshMemberDisplay() {
    var member = hasStoredSession();
    var focused = doc.activeElement;
    var leaving = focused && focused.closest && focused.closest(member ? '[data-story-guest]' : '[data-story-member]');
    doc.documentElement.classList.toggle('story-member', member);
    // A session change must not leave keyboard focus in content that just disappeared.
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
    // Native anchors and details remain fully usable if JavaScript is unavailable.
    var links = Array.prototype.slice.call(doc.querySelectorAll('.story-reader nav a[href^="#"]'));
    var sections = links.map(function (link) { return doc.getElementById(link.hash.slice(1)); });
    var ticking = false;
    function updateLocation() {
      ticking = false;
      var current = -1;
      sections.forEach(function (section, index) {
        if (section && section.getBoundingClientRect().top <= Math.max(160, window.innerHeight * 0.3)) current = index;
      });
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
    doc.addEventListener('toggle', scheduleLocation, true);
    updateLocation();
    refreshMemberDisplay();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
