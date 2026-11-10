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
  // UNSLOP 2026-11-10 ③ 아이콘: 자물쇠 그림 문자 대신 가는 선 자물쇠 하나(lucide 'lock', ISC). 16px·선 1.5·옆 글자 색, 낭독은 옆 글자로
  const lockIcon = () => {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    [['class', 'pa-lock-icon'], ['viewBox', '0 0 24 24'], ['width', '16'], ['height', '16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.5'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['focusable', 'false']].forEach(([k, v]) => svg.setAttribute(k, v));
    const body = document.createElementNS(ns, 'rect');
    [['x', '3'], ['y', '11'], ['width', '18'], ['height', '11'], ['rx', '2']].forEach(([k, v]) => body.setAttribute(k, v));
    const shackle = document.createElementNS(ns, 'path'); shackle.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
    svg.append(body, shackle);
    return svg;
  };
  const safeLink = value => {
    try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
  };
  const uuid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'ask-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  window.PA_ASK_HOME = Object.freeze({
    create({ sb, approved, tools, choRx, owner, onAuthFailure }) {
      const api = window.PA_ASK.create(sb);
      let alive = true, busy = false, last = null, timer = null, resumePause = null, retryKind = '', quotaKnown = false, remaining = null;
      let deepTimer = null, answerGeneration = 0, limit = null, access = approved ? 'checking' : 'pending';
      const q = el('textarea', { class: 'pa-in pa-ask-input', id: 'pa-q', rows: '3', maxlength: '1200', placeholder: '예) 실손의료비 통원 청구에 필요한 서류는 무엇인가요?', 'aria-label': '업무 질문 또는 도구 찾기', 'aria-keyshortcuts': '/', autocomplete: 'off' });
      const quota = el('p', { class: 'pa-ask-quota', role: 'status' }, approved ? '오늘 남은 질문 확인 중…' : '승인 후 AI 질문을 이용할 수 있습니다.');
      const submit = el('button', { class: 'g-btn g-btn--pri', type: 'submit' }, '질문하기');
      const out = el('p', { class: 'pa-ask-message', role: 'alert' });
      const suggestions = el('div', { class: 'pa-ask-suggestions', hidden: '', 'aria-label': '입력과 맞는 업무 도구' });
      const status = el('p', { class: 'pa-ask-status', role: 'status', 'aria-live': 'polite' });
      const steps = el('ol', { class: 'pa-ask-steps', 'aria-label': '답변 진행 단계' }, ...['접수', '찾는 중', '작성 중'].map(t => el('li', {}, t)));
      const progress = el('div', { class: 'pa-ask-progress', hidden: '' }, steps, status);
      const answer = el('section', { class: 'pa-ask-answer', hidden: '', 'aria-labelledby': 'pa-ask-answer-title' });
      const retryNote = el('p', { class: 'pa-ask-help', hidden: '' });
      const retry = el('button', { class: 'g-btn g-btn--ghost', type: 'button', hidden: '', onclick: () => run(retryKind === 'new') }, '결과 다시 확인');
      // TASK-ADM: 등급에 'AI 질문' 권한이 없으면 질문창 대신 짧은 안내만 보여 줍니다(요청 버튼 없음 — 권한은 관리자가 등급으로 정함). 서버도 같은 기준으로 막습니다.
      const lockBox = el('div', { class: 'pa-ask-lock', hidden: '', role: 'note' },
        el('p', { class: 'pa-ask-lock-title' }, lockIcon(), '현재 등급에서는 AI 질문을 이용할 수 없습니다'),
        el('p', { class: 'pa-ask-help' }, '이용 범위는 관리자가 등급에 따라 정합니다. 업무 도구와 보험자료는 그대로 이용할 수 있습니다.'));
      const form = el('form', { class: 'pa-ask-form', onsubmit: event => { event.preventDefault(); run(true); } },
          q, suggestions,
          el('div', { class: 'pa-ask-controls' }, submit), out, retry, retryNote);
      const node = el('section', { class: 'pa-ask', 'aria-labelledby': 'pa-ask-title' },
        el('div', { class: 'pa-ask-heading' }, el('h2', { id: 'pa-ask-title' }, 'AI 업무 질문'), quota),
        form, lockBox, progress, answer);
      function lock() {
        if (!alive) return;
        access = 'denied';
        form.hidden = true; lockBox.hidden = false; progress.hidden = true;
        quota.textContent = 'AI 질문 이용 권한 없음';
        controls();
      }
      function unlock() {
        if (!alive || access === 'allowed') return;
        access = 'allowed'; form.hidden = false; lockBox.hidden = true; controls();
      }
      async function checkAccess() {
        if (!approved) return;
        try {
          const { data, error } = await sb.rpc('my_ask_policy');
          if (!alive) return;
          const row = Array.isArray(data) ? data[0] : null;
          if (error || !row) return; // 확인하지 못하면 서버 응답(남은 횟수 확인)으로 판단합니다.
          if (Number(row.daily_limit) > 0) limit = Math.floor(Number(row.daily_limit));
          if (row.allowed === false) lock(); else unlock();
        } catch (_) { /* 서버 응답으로 판단 */ }
      }
      function invalidateAuth(error) {
        if (!['unauthorized', 'forbidden', 'login_required', 'invalid_token', 'expired', 'not_active', 'stale_session'].includes(error.code)) return false;
        if (!alive) return true;
        alive = false; answerGeneration++; clearTimeout(deepTimer); clearTimeout(timer); clearTimeout(quotaTimer); if (resumePause) resumePause();
        api.dispose(); q.value = ''; last = null; q.disabled = true; submit.disabled = true;
        answer.replaceChildren(); answer.hidden = true; progress.hidden = true; suggestions.replaceChildren(); suggestions.hidden = true;
        retry.hidden = true; retryNote.hidden = true; quota.textContent = '로그인·이용 권한 확인 필요';
        out.textContent = '이전 질문과 답변을 비웠습니다. 로그인·이용 권한을 확인한 뒤 다시 열어 주세요.';
        if (onAuthFailure) onAuthFailure();
        return true;
      }
      async function verifySession() {
        const response = await sb.auth.getSession(), session = response.data && response.data.session;
        if (response.error || !session || !session.user || (owner && session.user.id !== owner)) {
          const error = new Error('로그인 정보가 바뀌었습니다. 화면을 다시 열어 주세요.'); error.code = 'stale_session'; throw error;
        }
      }
      function controls() {
        submit.disabled = busy || !approved || remaining === 0 || access === 'denied';
        q.disabled = busy;
        retry.disabled = busy;
      }
      const limitText = () => limit ? `하루 ${limit}회` : '하루 횟수 제한';
      function setQuota(value) {
        if (!value || !alive) return;
        if (value.allowed === false) { lock(); return; }
        if (value.allowed === true) unlock();
        if (Number(value.limit) > 0) limit = Math.floor(Number(value.limit));
        if (value.exempt === true) { quota.textContent = '관리자 계정 · 질문 횟수 제한 없음'; quotaKnown = true; remaining = null; controls(); return; }
        const parsed = Number(value.remaining);
        if (value.remaining == null || value.remaining === '' || !Number.isFinite(parsed) || parsed < 0) {
          quota.textContent = `남은 질문 수를 확인하지 못했습니다. ${limitText()} · 한국시간 자정 초기화`;
          return;
        }
        quotaKnown = true;
        remaining = Math.max(0, Math.floor(parsed));
        quota.textContent = limit ? `오늘 남은 질문 ${remaining}/${limit}회 · 한국시간 자정 초기화` : `오늘 남은 질문 ${remaining}회 · 한국시간 자정 초기화`;
        if (remaining === 0) out.textContent = `오늘 질문 한도${limit ? `(${limit}회)` : ''}를 모두 쓰셨습니다. 업무 도구와 저장된 답변은 계속 이용할 수 있습니다.`;
        else if (out.textContent.startsWith('오늘 질문 한도')) out.textContent = '';
        controls();
      }
      async function loadQuota() {
        if (!approved) return;
        try { await verifySession(); const r = await api.request('askQuota'); if (alive) setQuota(r.quota); }
        catch (e) {
          if (invalidateAuth(e)) return;
          if (e.code === 'ask_forbidden') { lock(); return; }
          if (alive && !quotaKnown && access !== 'denied') quota.textContent = e.code === 'ask_policy_unavailable' ? '이용 권한을 확인하지 못했습니다. 잠시 후 다시 확인합니다.' : `남은 질문 수를 확인하지 못했습니다. ${limitText()} · 한국시간 자정 초기화`;
        }
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
          ? el('a', { href: tool.url, ...(tool.internal ? {} : { target: '_blank', rel: 'noopener noreferrer' }) }, el('b', {}, tool.name), el('span', {}, tool.internal ? '이 도구 열기 →' : '이 도구 열기 · 새 창 ↗'))
          : el('p', {}, el('b', {}, tool.name), ' ', el('span', { class: 'pa-ask-locked' }, lockIcon(), '이용 권한 필요'))));
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
      function renderAnswer(result, initialDeep, initialDeepQuota) {
        clearTimeout(deepTimer);
        const generation = ++answerGeneration, questionId = last.id;
        const current = () => alive && answerGeneration === generation && last && last.id === questionId;
        const fmt = window.PA_ASK_FORMAT;
        const richBody = raw => {
          const box = el('div', { class: 'pa-ask-answer-text' });
          box.append(fmt.fragment(raw || '자료에서 찾지 못했습니다. 질문을 더 구체적으로 적어 주세요.'));
          return box;
        };
        const references = sources => {
          const list = Array.isArray(sources) ? sources : [];
          return el('div', {}, el('h4', {}, '근거 자료 ', el('span', { class: 'pa-count' }, `${list.length}개`)), list.length
            ? el('ol', { class: 'pa-ask-sources' }, ...list.map(source => {
              const title = window.PA_ASK.maskResidentId(String(source.title || '참고 자료') + (source.page ? ` · ${source.page}쪽` : ''));
              const url = safeLink(source.url);
              return el('li', {}, url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, title, ' ↗') : title);
            }))
            : el('p', { class: 'pa-ask-help' }, '자료에서 찾지 못했습니다. 확인할 수 있는 근거가 없습니다.'));
        };
        const copyAnswer = async (value, includeSources, note) => {
          const sources = Array.isArray(value.sources) ? value.sources : [];
          const refs = sources.map((source, i) => `${i + 1}. ${source.title || '참고 자료'}${source.page ? ' · ' + source.page + '쪽' : ''}${safeLink(source.url) ? '\n' + safeLink(source.url) : ''}`).join('\n');
          const text = window.PA_ASK.maskResidentId(fmt.text(value.answer || '') + (includeSources ? '\n\n근거 자료\n' + (refs || '근거 자료 없음') : ''));
          try {
            await verifySession();
            if (!current()) return;
            if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
            else {
              const focus = document.activeElement, field = el('textarea', { class: 'pa-copy-field', readonly: '' }, text); document.body.append(field); field.select();
              const copied = document.execCommand('copy'); field.remove(); if (focus && focus.isConnected) focus.focus(); if (!copied) throw new Error('copy_failed');
            }
            if (current()) note.textContent = includeSources ? '답변과 근거를 복사했습니다.' : '답변을 복사했습니다.';
          } catch (error) { if (!invalidateAuth(error) && current()) note.textContent = '복사하지 못했습니다. 답변을 선택하여 복사해 주세요.'; }
        };
        const body = richBody(result.answer), sources = Array.isArray(result.sources) ? result.sources : [];
        const feedNote = el('p', { class: 'pa-ask-help', role: 'status' });
        const deep = el('section', { class: 'pa-ask-deep', hidden: '', 'aria-label': '더 깊게 다시 답변' });
        let deepStatus = '', deepUntil = 0, sendingFeedback = false;
        const feedback = el('div', { class: 'pa-ask-feedback', role: 'group', 'aria-label': '답변 평가' }, el('span', {}, '답변이 도움이 됐나요?'));
        const syncFeedback = () => feedback.querySelectorAll('button').forEach(b => { b.disabled = sendingFeedback || (b.dataset.rating === 'down' && ['queued', 'writing', 'done'].includes(deepStatus)); });
        const pollDeep = async () => {
          if (!current()) return;
          try {
            await verifySession();
            const state = await api.request('askStatus', { id: questionId });
            if (current()) renderDeep(state.deep, state.deepQuota);
          } catch (error) {
            if (invalidateAuth(error) || !current()) return;
            deep.replaceChildren(el('h4', {}, '더 깊게 다시 답변'), el('p', { class: 'pa-ask-help', role: 'status' }, '진행 상태를 확인하지 못했습니다. 결과를 다시 확인해 주세요.'),
              el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => { deepUntil = Date.now() + 600000; pollDeep(); } }, '다시 답변 결과 확인'));
          }
        };
        const renderDeep = (value, quotaValue) => {
          if (!current() || !value) return;
          clearTimeout(deepTimer);
          deepStatus = value.status || ''; deep.hidden = !deepStatus; syncFeedback();
          if (!deepStatus) return;
          const title = el('h4', {}, '더 깊게 다시 답변');
          if (deepStatus === 'queued' || deepStatus === 'writing') {
            deep.replaceChildren(title, el('p', { class: 'pa-ask-deep-status', role: 'status' }, '더 깊게 다시 답변하고 있습니다(1~3분)'));
            if (!deepUntil) deepUntil = Date.now() + 600000;
            if (Date.now() < deepUntil) deepTimer = setTimeout(pollDeep, 2000);
            else deep.append(el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => { deepUntil = Date.now() + 600000; pollDeep(); } }, '다시 답변 결과 확인'));
          } else if (deepStatus === 'done') {
            const note = el('p', { class: 'pa-ask-help', role: 'status' });
            deep.replaceChildren(title, richBody(value.answer), references(value.sources),
              el('p', { class: 'pa-ask-help' }, 'Claude Opus 5.5 · 높은 추론 · 첫 답변과 같은 근거 자료를 사용했습니다. 원문과 함께 확인해 주세요.'),
              el('div', { class: 'pa-ask-answer-actions' },
                el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => copyAnswer(value, false, note) }, '다시 답변 복사'),
                el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => copyAnswer(value, true, note) }, '다시 답변 근거 포함 복사')), note);
          } else if (deepStatus === 'error') {
            deep.replaceChildren(title, el('p', { class: 'pa-ask-message', role: 'status' }, '다시 답변을 만들지 못했습니다'), el('p', { class: 'pa-ask-help' }, '횟수는 차감하지 않았습니다. 아쉬워요를 눌러 다시 시도할 수 있습니다.'));
          }
          if (quotaValue && Number.isFinite(Number(quotaValue.remaining))) deep.append(el('p', { class: 'pa-ask-help' }, `오늘 다시 답변 ${Math.max(0, Number(quotaValue.remaining))}/5회 남음 · 한국시간 자정 초기화`));
        };
        [['up', '👍 도움 됐어요'], ['down', '👎 아쉬워요']].forEach(([rating, label]) => {
          const button = el('button', { type: 'button', 'data-rating': rating, 'aria-pressed': 'false', onclick: async () => {
            if (sendingFeedback || !current()) return;
            sendingFeedback = true; syncFeedback(); feedNote.textContent = '';
            try {
              await verifySession(); const response = await api.request('askFeedback', { id: questionId, rating });
              if (!current()) return;
              feedback.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
              feedNote.textContent = '의견을 기록했습니다.';
              renderDeep(response.deep, response.deepQuota);
            } catch (error) { if (!invalidateAuth(error) && current()) feedNote.textContent = error.message; }
            finally { sendingFeedback = false; if (current()) syncFeedback(); }
          } }, label); feedback.append(button);
        });
        const seconds = result.elapsedMs != null && result.elapsedMs !== '' && Number.isFinite(Number(result.elapsedMs)) ? Number(result.elapsedMs) / 1000 : null;
        const copyNote = el('p', { class: 'pa-ask-help', role: 'status', 'aria-live': 'polite' });
        const content = el('div', { id: 'pa-ask-answer-content' }, body, references(sources),
          el('p', { class: 'pa-ask-help' }, seconds !== null ? `응답 시간 ${seconds.toFixed(1)}초 · 세부 내용은 원문과 함께 확인해 주세요.` : '응답 시간 기록 없음 · 세부 내용은 원문과 함께 확인해 주세요.'));  // 2026-11-07 평가·다시답변 화면 제거(기록 보관)
        const collapse = el('button', { type: 'button', class: 'g-btn g-btn--ghost', 'aria-expanded': 'true', 'aria-controls': 'pa-ask-answer-content', onclick: () => {
          content.hidden = !content.hidden; collapse.setAttribute('aria-expanded', String(!content.hidden)); collapse.textContent = content.hidden ? '답변 펼치기' : '답변 접기';
        } }, '답변 접기');
        answer.replaceChildren(el('h3', { id: 'pa-ask-answer-title', tabindex: '-1' }, 'AI 답변'),
          el('div', { class: 'pa-ask-answer-actions' },
            el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => copyAnswer(result, false, copyNote) }, '답변 복사'),
            el('button', { type: 'button', class: 'g-btn g-btn--ghost', onclick: () => copyAnswer(result, true, copyNote) }, '근거 포함 복사'), collapse), copyNote, content);
        renderDeep(initialDeep || result.deep, initialDeepQuota || result.deepQuota);
        answer.hidden = false; progress.hidden = true; retry.hidden = true; retryNote.hidden = true; retryKind = '';
      }
      function pause(ms) { return new Promise(resolve => { resumePause = resolve; timer = setTimeout(() => { resumePause = null; resolve(); }, ms); }); }
      async function run(fresh) {
        if (busy || !approved || !alive || access === 'denied') return;
        const question = window.PA_ASK.maskResidentId(q.value.trim());
        q.value = question;
        if (fresh && (question.length < 3 || question.length > 1200)) { out.textContent = '질문을 3자 이상, 1,200자 이내로 적어 주세요.'; q.focus(); return; }
        // A second submit of an ambiguous request must also reuse its idempotency key.
        if (fresh && last && retryKind === 'resume' && !retry.hidden && last.question === question) fresh = false;
        if (fresh) last = { question, requestId: uuid(), id: null };
        if (!last) return;
        busy = true; controls(); out.textContent = ''; retry.hidden = true; retryNote.hidden = true;
        if (fresh) { answerGeneration++; clearTimeout(deepTimer); answer.hidden = true; answer.replaceChildren(); }
        stage(last.id ? 'searching' : 'queued');
        try {
          await verifySession();
          if (!last.id) {
            const submitted = await api.request('askSubmit', { question: last.question, length: 'normal', requestId: last.requestId });
            if (!alive) return;
            last.id = submitted.id; setQuota(submitted.quota);
          }
          const until = Date.now() + 600000;
          while (alive && Date.now() < until) {
            const result = await api.request('askStatus', { id: last.id });
            if (!alive) return;
            setQuota(result.quota);
            if (result.status === 'done') { renderAnswer(result.result || result, result.deep, result.deepQuota); return; }
            if (result.status === 'error') { const failure = new Error(window.PA_ASK.maskResidentId(result.message || '답변을 완성하지 못했습니다. 다시 질문해 주세요.')); failure.code = 'answer_failed'; throw failure; }
            if (result.status === 'ready') {
              stage('writing');
              const written = await api.request('askAnswer', { id: last.id });
              if (!alive) return;
              setQuota(written.quota);
              if (written.status === 'done' || written.answer) { renderAnswer(written.result || written, written.deep, written.deepQuota); return; }
              stage('writing'); await pause(2000); continue;
            }
            stage(result.status); await pause(2000);
          }
          if (alive) { const timeout = new Error('아직 처리 중입니다. 결과 다시 확인을 눌러 이어서 확인해 주세요.'); timeout.code = 'timeout'; throw timeout; }
        } catch (e) {
          if (!alive || invalidateAuth(e)) return;
          progress.hidden = true;
          if (e.code === 'ask_forbidden') { out.textContent = ''; lock(); return; }
          out.textContent = e.message;
          if (e.quota) setQuota(e.quota);
          if (e.code === 'daily_limit') { remaining = 0; quota.textContent = limit ? `오늘 남은 질문 0/${limit}회 · 한국시간 자정 초기화` : '오늘 남은 질문 0회 · 한국시간 자정 초기화'; }
          retryKind = ['answer_failed', 'not_found', 'invalid_question'].includes(e.code) ? 'new' : 'resume';
          retry.textContent = retryKind === 'new' ? '새 질문으로 접수' : last.id ? '기존 결과 확인' : '접수·결과 다시 확인';
          retryNote.textContent = retryKind === 'new' ? '새 질문으로 접수하며 하루 질문 횟수를 사용합니다.' : last.id ? '새 질문 횟수 차감 없음. 기존 질문의 진행 상태와 결과를 확인합니다.' : '같은 접수 번호로 확인합니다. 이미 접수된 질문은 횟수를 다시 차감하지 않습니다.';
          retry.hidden = ['daily_limit', 'unauthorized', 'forbidden', 'stale_session'].includes(e.code);
          retryNote.hidden = retry.hidden;
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
      controls(); checkAccess().then(loadQuota);
      return { node, dispose() { alive = false; answerGeneration++; clearTimeout(deepTimer); clearTimeout(timer); clearTimeout(quotaTimer); if (resumePause) resumePause(); window.removeEventListener('focus', refreshQuota); document.removeEventListener('visibilitychange', refreshQuota); api.dispose(); } };
    }
  });
})();
