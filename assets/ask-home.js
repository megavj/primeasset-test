/* AI question panel, displayed only inside the member home. */
(function () {
  'use strict';
  const el = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach(c => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return n;
  };
  const safeLink = value => {
    try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
  };
  const uuid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'ask-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  window.PA_ASK_HOME = Object.freeze({
    create({ sb, approved, tools, choRx }) {
      const api = window.PA_ASK.create(sb);
      let alive = true, busy = false, last = null, timer = null, resumePause = null, length = 'normal', retryKind = '', quotaKnown = false, remaining = null;
      const q = el('textarea', { class: 'pa-in pa-ask-input', id: 'pa-q', rows: '3', maxlength: '1200', placeholder: '예) 실손의료비 통원 청구에 필요한 서류는 무엇인가요?', 'aria-describedby': 'pa-ask-help', 'aria-keyshortcuts': '/', autocomplete: 'off' });
      const hint = el('p', { class: 'pa-ask-help', id: 'pa-ask-help' }, '주민등록번호는 뒷자리 7자리만 가려 저장합니다. 도구 이름이나 초성도 찾을 수 있어요.');
      const quota = el('p', { class: 'pa-ask-quota', role: 'status' }, approved ? '오늘 남은 질문 확인 중…' : '승인 후 AI 질문을 이용할 수 있습니다.');
      const submit = el('button', { class: 'g-btn g-btn--pri', type: 'submit' }, '질문하기');
      const out = el('p', { class: 'pa-ask-message', role: 'alert' });
      const suggestions = el('div', { class: 'pa-ask-suggestions', hidden: '', 'aria-label': '입력과 맞는 업무 도구' });
      const status = el('p', { class: 'pa-ask-status', role: 'status', 'aria-live': 'polite' });
      const steps = el('ol', { class: 'pa-ask-steps', 'aria-label': '답변 진행 단계' }, ...['접수', '찾는 중', '작성 중'].map(t => el('li', {}, t)));
      const progress = el('div', { class: 'pa-ask-progress', hidden: '' }, steps, status);
      const answer = el('section', { class: 'pa-ask-answer', hidden: '', 'aria-labelledby': 'pa-ask-answer-title' });
      const retry = el('button', { class: 'g-btn g-btn--ghost', type: 'button', hidden: '', onclick: () => run(retryKind === 'new') }, '결과 다시 확인');
      const lengths = el('fieldset', { class: 'pa-ask-lengths' }, el('legend', {}, '답변 길이'));
      const radios = [];
      [['short', '짧게'], ['normal', '보통'], ['long', '자세히']].forEach(([value, text]) => {
        const radio = el('input', { type: 'radio', name: 'ask-length', value, ...(value === 'normal' ? { checked: '' } : {}), onchange: () => { length = value; } });
        radios.push(radio); lengths.append(el('label', {}, radio, el('span', {}, text)));
      });
      const examples = el('div', { class: 'pa-ask-examples', 'aria-label': '예시 질문' }, ...[
        ['전산 업무', '보험사 전산에서 청약 진행 상태를 확인하는 방법을 알려 주세요.'],
        ['상품 상담', '암보험 진단비 보장과 면책기간을 설명해 주세요.'],
        ['보상 청구', '실손의료비 통원 청구에 필요한 서류는 무엇인가요?']
      ].map(([label, value]) => el('button', { class: 'pa-ask-example', type: 'button', onclick: () => { if (!busy) { q.value = value; matchTools(); q.focus(); } } }, label)));
      const node = el('section', { class: 'pa-ask', 'aria-labelledby': 'pa-ask-title' },
        el('div', { class: 'pa-ask-heading' }, el('h2', { id: 'pa-ask-title' }, '업무가 막힐 때, AI에게 물어보세요'), quota),
        el('form', { class: 'pa-ask-form', onsubmit: event => { event.preventDefault(); run(true); } },
          el('label', { class: 'sr', for: 'pa-q' }, 'AI에게 질문하거나 도구 이름 찾기'), q, hint, suggestions, examples,
          el('div', { class: 'pa-ask-controls' }, lengths, submit), out, retry), progress, answer);
      function controls() {
        submit.disabled = busy || !approved || remaining === 0;
        q.disabled = busy; radios.forEach(r => { r.disabled = busy; });
        examples.querySelectorAll('button').forEach(b => { b.disabled = busy; });
        retry.disabled = busy;
      }
      function setQuota(value) {
        if (!value || !alive) return;
        quotaKnown = true;
        remaining = value.exempt ? null : Math.max(0, Number(value.remaining) || 0);
        quota.textContent = value.exempt ? '오늘 질문 제한 없음 · 관리자 예외' : `오늘 남은 질문 ${remaining}회`;
        quota.title = `한국시간 자정에 새로 시작합니다. 하루 ${value.limit}회`;
        if (remaining === 0) out.textContent = `오늘 질문 한도(${value.limit}회)를 모두 쓰셨습니다. 내일 다시 이용해 주세요.`;
        else if (out.textContent.startsWith('오늘 질문 한도(')) out.textContent = '';
        controls();
      }
      async function loadQuota() {
        if (!approved) return;
        try { const r = await api.request('askQuota'); if (alive) setQuota(r.quota); }
        catch (e) { if (alive && !quotaKnown) quota.textContent = '남은 질문 수를 확인하지 못했습니다.'; }
      }
      function matchTools() {
        const text = q.value.trim().toLowerCase();
        if (!text || text.length > 50) { suggestions.hidden = true; suggestions.replaceChildren(); return; }
        const terms = text.split(/\s+/).map(choRx);
        const found = tools.filter(tool => {
          const name = tool.name.toLowerCase();
          return name.replace(/\s/g, '') === text.replace(/\s/g, '') || terms.every(rx => rx.test(name) || rx.test(name.replace(/\s/g, '')));
        }).slice(0, 5);
        suggestions.hidden = !found.length;
        suggestions.replaceChildren(...found.map(tool => tool.unlocked && tool.url
          ? el('a', { href: tool.url, ...(tool.internal ? {} : { target: '_blank', rel: 'noopener noreferrer' }) }, el('b', {}, tool.name), el('span', {}, '이 도구 열기 ' + (tool.internal ? '→' : '↗')))
          : el('p', {}, tool.name, ' · 🔒 이용 권한 필요')));
      }
      q.addEventListener('input', matchTools);
      q.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!submit.disabled) run(true); }
        if (event.key === 'Escape') suggestions.hidden = true;
      });
      function stage(value) {
        progress.hidden = false;
        const index = value === 'writing' ? 2 : value === 'queued' ? 0 : 1;
        [...steps.children].forEach((item, i) => { item.classList.toggle('is-current', i === index); if (i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current'); });
        status.textContent = value === 'queued' ? '질문을 접수했습니다. 자료 검색을 기다리고 있습니다.' : value === 'writing' ? '찾은 자료를 바탕으로 답변을 작성하고 있습니다.' : '업무 자료에서 관련 근거를 찾고 있습니다.';
      }
      function renderAnswer(result) {
        const body = el('div', { class: 'pa-ask-answer-text' }, window.PA_ASK.maskResidentId(result.answer || '자료에서 찾지 못했습니다. 질문을 더 구체적으로 적어 주세요.'));
        const sources = Array.isArray(result.sources) ? result.sources : [];
        const sourceList = el('ol', { class: 'pa-ask-sources' }, ...sources.map(source => {
          const title = window.PA_ASK.maskResidentId(String(source.title || '참고 자료') + (source.page ? ` · ${source.page}쪽` : ''));
          const url = safeLink(source.url);
          return el('li', {}, url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, title, ' ↗') : title);
        }));
        const feedNote = el('p', { class: 'pa-ask-help', role: 'status' });
        let sendingFeedback = false;
        const feedback = el('div', { class: 'pa-ask-feedback', role: 'group', 'aria-label': '답변 평가' }, el('span', {}, '답변이 도움이 됐나요?'));
        [['up', '👍 도움 됐어요'], ['down', '👎 아쉬워요']].forEach(([rating, label]) => {
          const button = el('button', { type: 'button', 'aria-pressed': 'false', onclick: async () => {
            if (sendingFeedback) return;
            sendingFeedback = true; feedback.querySelectorAll('button').forEach(b => { b.disabled = true; }); feedNote.textContent = '';
            try {
              await api.request('askFeedback', { id: last.id, rating });
              if (!alive) return;
              feedback.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button))); feedNote.textContent = '의견을 기록했습니다.';
            } catch (e) { if (alive) feedNote.textContent = e.message; }
            finally { sendingFeedback = false; feedback.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
          } }, label); feedback.append(button);
        });
        const seconds = Math.max(0, Number(result.elapsedMs) || 0) / 1000;
        answer.replaceChildren(el('h3', { id: 'pa-ask-answer-title', tabindex: '-1' }, 'AI 답변'), body,
          el('h4', {}, `근거 자료 (${sources.length})`), sources.length ? sourceList : el('p', { class: 'pa-ask-help' }, '자료에서 찾지 못했습니다. 확인할 수 있는 근거가 없습니다.'),
          el('p', { class: 'pa-ask-help' }, seconds ? `응답 시간 ${seconds.toFixed(1)}초 · 세부 내용은 원문과 함께 확인해 주세요.` : '세부 내용은 원문과 함께 확인해 주세요.'), feedback, feedNote);
        answer.hidden = false; progress.hidden = true; retry.hidden = true; retryKind = '';
      }
      function pause(ms) { return new Promise(resolve => { resumePause = resolve; timer = setTimeout(() => { resumePause = null; resolve(); }, ms); }); }
      async function run(fresh) {
        if (busy || !approved || !alive) return;
        const question = window.PA_ASK.maskResidentId(q.value.trim());
        q.value = question;
        if (fresh && (question.length < 3 || question.length > 1200)) { out.textContent = '질문을 3자 이상, 1,200자 이내로 적어 주세요.'; q.focus(); return; }
        // A second submit of an ambiguous request must also reuse its idempotency key.
        if (fresh && last && retryKind === 'resume' && !retry.hidden && last.question === question && last.length === length) fresh = false;
        if (fresh) last = { question, length, requestId: uuid(), id: null };
        if (!last) return;
        busy = true; controls(); out.textContent = ''; retry.hidden = true;
        if (fresh) { answer.hidden = true; answer.replaceChildren(); }
        stage(last.id ? 'searching' : 'queued');
        try {
          if (!last.id) {
            const submitted = await api.request('askSubmit', { question: last.question, length: last.length, requestId: last.requestId });
            if (!alive) return;
            last.id = submitted.id; setQuota(submitted.quota);
          }
          const until = Date.now() + 600000;
          while (alive && Date.now() < until) {
            const result = await api.request('askStatus', { id: last.id });
            if (!alive) return;
            setQuota(result.quota);
            if (result.status === 'done') { renderAnswer(result.result || result); return; }
            if (result.status === 'error') { const failure = new Error(window.PA_ASK.maskResidentId(result.message || '답변을 완성하지 못했습니다. 다시 질문해 주세요.')); failure.code = 'answer_failed'; throw failure; }
            if (result.status === 'ready') {
              stage('writing');
              const written = await api.request('askAnswer', { id: last.id });
              if (!alive) return;
              setQuota(written.quota); renderAnswer(written); return;
            }
            stage(result.status); await pause(2000);
          }
          if (alive) { const timeout = new Error('아직 처리 중입니다. 결과 다시 확인을 눌러 이어서 확인해 주세요.'); timeout.code = 'timeout'; throw timeout; }
        } catch (e) {
          if (!alive) return;
          progress.hidden = true; out.textContent = e.message;
          if (e.quota) setQuota(e.quota);
          if (e.code === 'daily_limit') { remaining = 0; quota.textContent = '오늘 남은 질문 0회'; }
          retryKind = ['answer_failed', 'not_found', 'invalid_question'].includes(e.code) ? 'new' : 'resume';
          retry.textContent = retryKind === 'new' ? '다시 묻기' : '결과 다시 확인';
          retry.hidden = ['daily_limit', 'unauthorized', 'forbidden', 'stale_session'].includes(e.code);
        } finally { busy = false; if (alive) { controls(); loadQuota(); } }
      }
      const refreshQuota = () => { if (alive && !busy && document.visibilityState !== 'hidden') loadQuota(); };
      window.addEventListener('focus', refreshQuota);
      document.addEventListener('visibilitychange', refreshQuota);
      let quotaTimer;
      const scheduleQuotaReset = () => {
        const now = Date.now(), kst = new Date(now + 9 * 3600000);
        const midnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1) - 9 * 3600000;
        quotaTimer = setTimeout(() => { refreshQuota(); if (alive) scheduleQuotaReset(); }, midnight - now + 1000);
      };
      scheduleQuotaReset();
      controls(); loadQuota();
      return { node, dispose() { alive = false; clearTimeout(timer); clearTimeout(quotaTimer); if (resumePause) resumePause(); window.removeEventListener('focus', refreshQuota); document.removeEventListener('visibilitychange', refreshQuota); api.dispose(); } };
    }
  });
})();
