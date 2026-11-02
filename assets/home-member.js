/* PAGES-V1 1: 메인 로그인 회원의 보기 순서만 조정.
   tool-hub.js 가 기존 세션 기준으로 붙인 .is-member 를 그대로 사용한다.
   실제 도구 접근·등급·승인은 인트라넷의 기존 서버 권한 판정에 맡긴다.
   비로그인일 때 본문·문구·순서는 건드리지 않는다. */
(function () {
  var hub = document.getElementById('tools');
  var hero = document.getElementById('hero');
  if (!document.body.classList.contains('g-main') || !hub || !hero) return;

  var member = hub.classList.contains('is-member');
  if (member) {
    hero.insertAdjacentElement('afterend', hub);
    document.body.classList.add('g-main--member');
  }

  // 다른 탭에서 로그인/로그아웃하거나 뒤로 돌아온 경우 기존 허브 표시도 함께 갱신.
  // 이 조건은 tool-hub.js 와 같다. 여기서는 표시 상태만 비교하며 권한을 부여하지 않는다.
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var v = JSON.parse(localStorage.getItem(key) || 'null');
        if (v && v.access_token && (!v.expires_at || v.expires_at * 1000 > Date.now() - 86400000)) return true;
      }
    } catch (e) { return false; }
    return false;
  }
  function refreshIfChanged() {
    if (hasStoredSession() !== member) window.location.reload();
  }
  window.addEventListener('storage', function (event) {
    if (event.key === null || /^sb-[a-z0-9]+-auth-token$/.test(event.key)) refreshIfChanged();
  });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) refreshIfChanged();
  });
})();
