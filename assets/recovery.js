/* PAGE 7 · 안내용 세션 힌트만 읽는다. 권한·승인은 기존 인트라넷에서 확인.
   offline.html에는 이 파일 그대로 포함한다. API·추적·저장소 쓰기 없음. */
(function () {
  'use strict';
  var doc = document;
  var offline = doc.body.dataset.recovery === 'offline';
  var originalURL = location.href;
  var member = false;
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var value;
        try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch (error) { continue; }
        if (value && value.access_token && (!value.expires_at || value.expires_at * 1000 > Date.now() - 86400000)) return true;
      }
    } catch (error) { /* 저장소 제한 시에도 공개 목적지로 이동 가능. */ }
    return false;
  }
  function refreshMemberDisplay() {
    member = hasStoredSession();
    var active = doc.activeElement;
    var leaving = active && active.closest && active.closest(member ? '[data-guest]' : '[data-member]');
    doc.querySelectorAll('[data-member]').forEach(function (el) { el.hidden = !member; });
    doc.querySelectorAll('[data-guest]').forEach(function (el) { el.hidden = member; });
    if (leaving) {
      var next = doc.querySelector(member ? '.recovery-actions [data-member] a' : '.recovery-actions [data-guest] a');
      if (next) next.focus({ preventScroll: true });
    }
  }
  refreshMemberDisplay();
  window.addEventListener('storage', function (event) {
    if (event.key === null || /^sb-[a-z0-9]+-auth-token$/.test(event.key || '')) refreshMemberDisplay();
  });
  window.addEventListener('pageshow', refreshMemberDisplay);
  window.addEventListener('focus', refreshMemberDisplay);
  doc.addEventListener('visibilitychange', function () { if (!doc.hidden) refreshMemberDisplay(); });

  var back = doc.getElementById('recovery-back');
  if (back) {
    try {
      var previous = new URL(doc.referrer);
      // 외부 사이트나 같은 오류 페이지로 되돌아가는 동선은 표시하지 않는다.
      if (previous.origin === location.origin && previous.pathname !== location.pathname && !/\/(404|offline)\.html$/.test(previous.pathname) && history.length > 1) {
        back.hidden = false;
        back.addEventListener('click', function () { history.back(); });
      }
    } catch (error) { /* 직접 방문이면 확실한 목적지 링크만 표시. */ }
  }
  if (!offline) return;

  var retry = doc.getElementById('recovery-retry');
  var status = doc.getElementById('recovery-status');
  var busy = false;
  retry.hidden = false;
  function defaultTarget() {
    // SW 대체 화면은 원래 URL을 그대로 보유. 직접 안내 페이지를 연 경우만 홈으로.
    return location.pathname === '/offline.html' ? (member ? '/members/' : '/') : originalURL;
  }
  function navigate(target) {
    var next = new URL(target, location.href);
    // 앵커만 바뀌면 assign()은 문서를 요청하지 않으므로 원래 위치 복원 후 새로고침.
    if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search) {
      if (next.href !== location.href) {
        try { history.replaceState(null, '', next.href); } catch (error) { /* 새로고침은 계속 제공. */ }
      }
      location.reload();
    } else location.assign(target);
  }
  function checkConnection(target) {
    if (busy) return;
    if (navigator.onLine === false) {
      status.textContent = '아직 연결되지 않았어요. 와이파이나 모바일 데이터를 켠 뒤 다시 시도해 주세요.';
      return;
    }
    target = target || defaultTarget();
    if (!window.fetch || !window.AbortController) { navigate(target); return; }
    busy = true;
    retry.setAttribute('aria-disabled', 'true');
    retry.textContent = '연결 확인 중…';
    status.textContent = '요청한 페이지에 연결할 수 있는지 확인하고 있어요.';
    var controller = new AbortController();
    var timer;
    // HEAD는 SW 캐시·fallback을 거치지 않는다. 대상 페이지 응답을 확인한 뒤 이동.
    var timeout = new Promise(function (_, reject) {
      timer = window.setTimeout(function () { controller.abort(); reject(new Error('timeout')); }, 6000);
    });
    Promise.race([fetch(target, { method: 'HEAD', mode: 'same-origin', cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: controller.signal }), timeout])
      .then(function (response) {
        if (new URL(response.url, location.href).origin !== location.origin) throw new Error('origin');
        if (!(response.ok || response.status === 404)) throw new Error('unavailable');
        // 404도 서버 응답: 다시 열어 올바른 '페이지 없음' 안내를 받는다.
        status.textContent = '연결을 확인했어요. 페이지를 다시 열고 있어요.';
        navigate(target);
      })
      .catch(function () {
        status.textContent = '아직 페이지에 연결할 수 없어요. 연결 상태를 확인하거나 잠시 뒤 다시 시도해 주세요.';
      })
      .finally(function () {
        window.clearTimeout(timer);
        busy = false;
        retry.removeAttribute('aria-disabled');
        retry.textContent = '다시 시도';
      });
  }
  retry.addEventListener('click', function () { checkConnection(); });
  // 자동 복귀는 연결 복구 이벤트당 1회. 반복 폴링·무한 새로고침 없음.
  window.addEventListener('online', function () { checkConnection(); });
  window.addEventListener('offline', function () {
    status.textContent = '연결이 끊겨 있어요. 와이파이나 모바일 데이터를 확인해 주세요.';
  });
  doc.querySelectorAll('[data-recovery-link]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      checkConnection(link.href);
    });
  });
  status.textContent = navigator.onLine === false
    ? '연결이 끊겨 있어요. 연결이 돌아오면 자동으로 다시 시도합니다.'
    : '연결 복구를 기다리고 있어요. 연결했다면 다시 시도를 눌러 주세요.';
})();
