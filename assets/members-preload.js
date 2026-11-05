/* FUNC-FIX B7: CSS 를 받기 전에(그래서 아무것도 그려지기 전에) 이 기기의 로그인 세션 유무로 처음 모양을 정함 — 나중에 바뀌며 흔들리지 않게.
   세션 있음(또는 메일 링크로 막 돌아온 주소) → html.pa-in(불러오는 틀 = 인트라넷 모양, 로그인 화면 소개 한 줄 숨김) + body 가 생기는 즉시 body.pa-logged(메뉴 막대·탭바 = 인트라넷 모양).
   1초 뒤 html.pa-sk-show → 불러오는 틀의 회색 막대 표시(그 전에 화면이 그려지면 안 보임). 판정은 tool-hub.js 와 같은 저장 키(sb-*-auth-token) */
(function () {
  var h = document.documentElement, inside = /access_token=/.test(location.hash);
  try {
    for (var i = 0; i < localStorage.length && !inside; i += 1) {
      var k = localStorage.key(i);
      if (!/^sb-[a-z0-9]+-auth-token$/.test(k)) continue;
      var v = JSON.parse(localStorage.getItem(k) || 'null');
      inside = !!(v && v.access_token && v.refresh_token);
    }
  } catch (e) { inside = false; }
  if (inside) {
    h.classList.add('pa-in');
    new MutationObserver(function (ms, o) { if (document.body) { document.body.classList.add('pa-logged'); o.disconnect(); } }).observe(h, { childList: true });
  }
  setTimeout(function () { h.classList.add('pa-sk-show'); }, 1000);
})();
