/* 프라임에셋 프리미엄 — 익명 합계 집계(페이지 방문 수 · '합류 문의' 클릭 수). 서버 함수 track_hit(p_page, p_kind) 로 1씩 더함.
   보내는 것: 페이지 경로(예: '/story/')와 종류('view' | 'join_click') 두 가지뿐.
   보내지 않는 것: 쿠키, localStorage 식별자, 사용자 ID, 이름·이메일, 브라우저 정보(추가 헤더 없음). 로그인 세션 토큰도 붙이지 않고
   anon 키만 쓰므로 로그인한 회원도 누구인지 알 수 없음. 서버에 함수가 없으면 조용히 무시(화면 변화 없음).
   설정은 assets/auth-config.js 의 window.PA_AUTH 를 그대로 씀(키를 여기 적지 않음). /product/ 에는 넣지 않음. */
(function () {
  var C = window.PA_AUTH || {};
  if (!C.url || !C.anonKey || typeof fetch !== "function") return;
  if (location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return; // 로컬 미리보기는 집계 안 함
  var me = document.currentScript;
  var page = (me && me.getAttribute("data-page")) || location.pathname.replace(/index\.html$/, "");
  var OPENCHAT = "https://open.kakao.com/o/sFMF26y";
  function hit(kind) {
    try {
      fetch(String(C.url).replace(/\/$/, "") + "/rest/v1/rpc/track_hit", {
        method: "POST", keepalive: true, credentials: "omit", cache: "no-store",
        headers: { "Content-Type": "application/json", "apikey": C.anonKey, "Authorization": "Bearer " + C.anonKey },
        body: JSON.stringify({ p_page: page, p_kind: kind })
      }).catch(function () {});
    } catch (e) {}
  }
  hit("view"); // 페이지 열림 1회
  // 오픈채팅 '합류 문의' 링크를 누르면 1회 (data-track="join" 이거나 글자에 '합류'가 있는 링크만)
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a || String(a.href).indexOf(OPENCHAT) !== 0) return;
    if (a.getAttribute("data-track") === "join" || /합류/.test(a.textContent || "")) hit("join_click");
  }, true);
})();
