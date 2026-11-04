/* Member tools: one session generation per screen, bounded requests, no automatic resend. */
(function () {
  'use strict';
  window.paToolReady = window.paToolReady || {};
  window.paToolSession = function (sb, onChange) {
    let epoch = 0, uid, active = new Set();
    function stale() { const e = new Error('로그인 정보가 바뀌었습니다. 화면을 다시 열어 주세요.'); e.code = 'stale_session'; return e; }
    function check(expected) { if (expected !== epoch) throw stale(); }
    function changed(next) {
      if (uid === undefined || next === uid) return;
      uid = next; epoch++;
      active.forEach((c) => c.abort()); active.clear();
      onChange();
    }
    sb.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION') changed(session && session.user ? session.user.id : null);
    });
    return {
      current: () => epoch, check,
      async initialize() {
        const r = await sb.auth.getSession(), session = r.data && r.data.session;
        uid = session && session.user ? session.user.id : null;
        return session;
      },
      async request(url, action, payload, expected = epoch) {
        check(expected);
        const r = await sb.auth.getSession(), session = r.data && r.data.session;
        check(expected);
        changed(session && session.user ? session.user.id : null); check(expected);
        if (!session) { const e = new Error('로그인이 만료됐습니다. 다시 로그인해 주세요.'); e.code = 'unauthorized'; throw e; }
        const controller = new AbortController(); active.add(controller);
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, /^(answer|docAnswer|callClaude)$/.test(action) ? 350000 : 45000);
        try {
          const response = await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: session.access_token, screen: innerWidth < 700 ? 'mobile' : 'desktop' }, payload || {})), signal: controller.signal, credentials: 'omit', redirect: 'follow' });
          const result = await response.json(); check(expected);
          if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result)) throw new Error('invalid_response');
          if (result.ok !== true) {
            const code = result.error === 'failed' && typeof result.code === 'string' ? result.code : (result.error || result.code || 'server');
            const messages = {
              unauthorized: '로그인이 만료됐습니다. 다시 로그인해 주세요.', forbidden: '이 작업을 사용할 권한이 없습니다.',
              processing: '이미 답변을 작성하고 있습니다. 같은 질문을 다시 전송하지 말고 잠시 기다려 주세요.',
              completed: '이미 처리된 질문입니다. 같은 질문을 다시 전송하지 마세요.',
              answer_failed: '이 요청의 답변을 완성하지 못했습니다. 중복 처리를 막기 위해 같은 요청은 다시 실행하지 않습니다.',
              rate_limit: '이용 횟수에 도달했습니다. 잠시 후 다시 이용해 주세요.',
              invalid_output: '답변을 완성하지 못했습니다. 잠시 후 다시 이용해 주세요.'
            };
            const e = new Error(messages[code] || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); e.code = code; e.sub = result.code; throw e;
          }
          return result;
        } catch (error) {
          check(expected);
          if (error.code) throw error;
          const e = new Error(timedOut ? '응답 대기 시간이 지났습니다. 서버에서 처리 중일 수 있으니 같은 요청을 바로 다시 보내지 마세요.' : '답변기에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
          e.code = timedOut ? 'timeout' : 'network'; throw e;
        } finally { clearTimeout(timeout); active.delete(controller); }
      }
    };
  };
  setTimeout(() => {
    [['claim','cl'], ['it','it'], ['coach','coach']].forEach(([name, prefix]) => {
      const el = document.getElementById(prefix + '-load-error');
      if (el && !window.paToolReady[name]) el.hidden = false;
    });
  }, 15000);
})();
