/* Shared authenticated Ask API client. Never stores questions, answers, or tokens. */
(function () {
  'use strict';
  const maskResidentId = value => String(value == null ? '' : value).replace(/(^|[^\d])(\d{6})[\s.\-‐‑–—]*\d{7}(?!\d)/g, '$1$2-*******');
  const messages = {
    unauthorized: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
    forbidden: '승인된 계정의 이용 권한을 확인해 주세요.',
    daily_limit: '오늘 질문 한도를 모두 쓰셨습니다. 내일 다시 이용해 주세요.',
    ask_forbidden: '현재 등급에서는 AI 질문을 이용할 수 없습니다.',
    ask_policy_unavailable: 'AI 질문 이용 권한을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    deep_daily_limit: '오늘 다시 답변 횟수(5회)를 모두 쓰셨습니다',
    processing: '답변을 작성하고 있습니다. 잠시 후 결과를 다시 확인해 주세요.',
    not_found: '질문을 찾지 못했습니다. 새 질문을 입력해 주세요.',
    stale_session: '로그인 정보가 바뀌었습니다. 화면을 다시 열어 주세요.'
  };
  function error(code, message, quota) {
    const e = new Error(maskResidentId(message || messages[code] || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    e.code = code; if (quota) e.quota = quota; return e;
  }
  window.PA_ASK = Object.freeze({
    maskResidentId,
    create(sb) {
      let owner, closed = false;
      const active = new Set();
      const auth = sb.auth.onAuthStateChange((event, session) => {
        if (owner !== undefined && (session && session.user ? session.user.id : null) !== owner) {
          closed = true; active.forEach(c => c.abort());
        }
      });
      return {
        async request(action, payload) {
          if (closed) throw error('stale_session');
          const { data, error: sessionError } = await sb.auth.getSession();
          const session = data && data.session;
          if (closed) throw error('stale_session');
          if (sessionError || !session || !session.access_token) throw error('unauthorized');
          if (owner === undefined) owner = session.user.id;
          if (owner !== session.user.id) throw error('stale_session');
          const url = (window.PA_ASK_CONFIG || {}).url;
          if (!url) throw error('unavailable', 'AI 질문답변 연결을 준비하고 있습니다. 잠시 후 다시 이용해 주세요.');
          const dataToSend = Object.assign({}, payload || {});
          if (action === 'askSubmit' && typeof dataToSend.question === 'string') dataToSend.question = maskResidentId(dataToSend.question);
          const controller = new AbortController(); active.add(controller);
          let timedOut = false;
          const timer = setTimeout(() => { timedOut = true; controller.abort(); }, action === 'askAnswer' ? 480000 : 45000);
          try {
            const response = await fetch(url, {
              method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, credentials: 'omit', redirect: 'follow',
              signal: controller.signal, body: JSON.stringify(Object.assign({}, dataToSend, { action, token: session.access_token }))
            });
            const result = await response.json();
            if (closed) throw error('stale_session');
            if (!response.ok || !result || typeof result !== 'object' || Array.isArray(result)) throw error('invalid_response');
            if (result.ok !== true) {
              const code = result.code || result.error || 'server';
              const message = typeof result.message === 'string' && /[가-힣]/.test(result.message) ? result.message : messages[code];
              throw error(code, message, result.quota);
            }
            return result;
          } catch (e) {
            if (closed) throw error('stale_session');
            if (typeof e.code === 'string') throw e;
            throw error(timedOut ? 'timeout' : 'network', timedOut ? '응답 대기 시간이 지났습니다. 결과 다시 확인을 눌러 진행 상태를 확인해 주세요.' : '연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.');
          } finally { clearTimeout(timer); active.delete(controller); }
        },
        dispose() {
          closed = true; active.forEach(c => c.abort()); active.clear();
          if (auth && auth.data && auth.data.subscription) auth.data.subscription.unsubscribe();
        }
      };
    }
  });
})();
