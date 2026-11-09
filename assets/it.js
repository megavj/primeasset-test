/* 전산답변기(/members/it/): 승인 회원 전용.
   홈페이지 로그인 토큰(Supabase access token)을 사본 GAS(시험 배포)에 보내고, GAS가 Supabase로 다시 확인한 뒤에만 답한다.
   여기서의 회원 확인(my_profile)은 안내 화면을 고르는 용도이고, 실제 권한 판정은 GAS(서버)가 한다. */
(function () {
  'use strict';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbx6uEY4cAXbKaux44qiEYZpDM0mm3v1nAFlkyIoXeAA6DIRF1HoZLWwDY1nzVVq1oq2TA/exec';
  const MENU_LEGACY_URL = 'https://script.google.com/macros/s/AKfycbwxsEPxs_uq5H4gH43Ie_FH0mrKAtdkrnzP-30b52GKTBMXVzARfgggs6_klkyadIVl/exec?itHelp=1'; // TASK-MENU: 메뉴에 있던 예전 주소
  const LEGACY_IDS = ['AKfycbzVbO8_XxSq8_WZhvNBXSi0myH22g0igqhAwkz7Kf9QtDUchxIds-E7fgTi06xGSP6lvg', 'AKfycbxWVCohTpOA3rZUK1hpuOqq_cfarzo57S2dlKL1g3CcTevVq1h-9oG28wBUvv_tzPb8tw', 'AKfycbzfFExpXscK87c2F54p17YDJwdDmpk7MAZ3NQAsWJtjqAFBXSaVJ1JC52H2czeaPPDNiw'];
  const $ = (id) => document.getElementById(id);
  const S = { sb: null, me: null, busy: false, answer: '', timer: 0, started: 0, step: -1, lastQuestion: '', lastInsurer: '', lastTask: '' };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const items = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
  function safeUrl(value) { try { const u = new URL(String(value || '')); return u.protocol === 'https:' && !u.username && !u.password; } catch (e) { return false; } }

  function gate(html) { const panel = $('it-gate'); panel.hidden = false; $('it-gate-msg').innerHTML = html; $('it-app').hidden = true; if (window.PA_SIGNUP && !panel.querySelector('.pa-signup-guide')) panel.append(window.PA_SIGNUP.guide()); }
  function formMsg(t) { $('it-form-msg').textContent = t || ''; }

  function clearSession() {
    S.me = null; S.answer = ''; setBusy(false);
    $('it-q').value = ''; $('it-result').hidden = true;
    ['it-answer', 'it-admin-body', 'it-originals', 'it-sources', 'it-cases', 'it-followups'].forEach((id) => { if ($(id)) $(id).replaceChildren(); });
    $('it-admin').hidden = true; $('it-admin').open = false;
    $('it-legacy-wrap').hidden = true; $('it-legacy').removeAttribute('href');
    S.lastQuestion = ''; S.lastInsurer = ''; S.lastTask = '';
    ['notice','case-badge','manual-badge','sources-count','answer-meta','answer-notes','manuals','links','clarification','progress-text'].forEach((suffix) => { const el = $('it-' + suffix); if (el) el.replaceChildren(); });
    formMsg(''); gate('로그인 정보가 바뀌어 입력과 답변을 지웠습니다. <a href="">화면 다시 열기</a>');
  }
  function api(action, payload, generation) { return S.guard.request(GAS_URL, action, payload, generation); }

  /* ---------- 시작: 로그인·승인 확인 ---------- */
  async function boot() {
    try { S.sb = await window.paClient(); S.guard = window.paToolSession(S.sb, clearSession); } catch (e) { return gate('화면을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); }
    let session = null;
    try { session = await S.guard.initialize(); } catch (e) { session = null; }
    if (!session) return gate('설계사 로그인 후 쓸 수 있어요. <a href="/members/#login">로그인하기</a>');
    const generation = S.guard.current();
    let prof = null;
    try { const r = await S.sb.rpc('my_profile'); if (r.error) throw r.error; S.guard.check(generation); prof = await window.PA_SIGNUP.resolveProfile(S.sb, r.data && r.data[0], session); S.guard.check(generation); }
    catch (e) { if (generation === S.guard.current()) gate('회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
    if (!window.PA_SIGNUP.complete(prof)) return gate('가입 정보를 먼저 입력해 주세요. 이름·휴대폰·소속 본부와 개인정보 동의를 완료해야 가입 신청이 접수됩니다. <a href="/members/#signup">가입 정보 입력</a>');
    if (!prof || prof.status !== 'active') {
      return gate(prof && prof.status === 'pending' ? '가입 승인 대기 중이에요. 관리자가 승인하면 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>' : '가입 승인된 설계사만 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>');
    }
    legacyLink(generation);
    try { const me = await api('whoami', {}, generation); S.guard.check(generation); S.me = me; }
    catch (e) { if (e.code !== 'stale_session') gate(esc(e.message)); return; }
    $('it-gate').hidden = true;
    $('it-app').hidden = false;
    renderStatus(S.me);
    if (S.me.user && S.me.user.admin) $('it-admin').hidden = false;
    if (S.me.caution) $('it-caution').textContent = S.me.caution;
  }
  function renderStatus(me) {
    const mac = $('it-st-mac'), ai = $('it-st-ai'), p = me.processor || {};
    mac.className = p.online ? 'is-ok' : 'is-bad';
    mac.lastElementChild.textContent = p.online ? '전산 매뉴얼 검색 연결됨' : '전산 매뉴얼 검색 꺼짐 — 기존 전산 자료로만 답변';
    ai.className = me.ai && me.ai.ready ? 'is-ok' : 'is-warn';
    ai.lastElementChild.textContent = me.ai && me.ai.ready ? 'AI 답변 준비됨' : '답변 서비스 준비 중 · 확인된 근거만 표시';
  }
  /* 승인 회원에게 기존 메뉴 주소를 우선 제공하고, 메뉴가 바뀌었으면 확인한 원본 배포를 쓴다. */
  async function legacyLink(generation) {
    let url = 'https://script.google.com/macros/s/' + LEGACY_IDS[0] + '/exec';
    try {
      const r = await S.sb.rpc('my_menu'); S.guard.check(generation);
      const item = items(r.data).find((x) => (/전산\s*답변/.test(x.name || '') || LEGACY_IDS.some((id) => String(x.url || '').includes(id))) && x.unlocked && x.url);
      // TASK-MENU(2026-11-09): 메뉴 주소가 이 화면(/members/it/)이면, 메뉴에 있던 예전 GAS 주소를 그대로 연다.
      if (item) url = safeUrl(item.url) && !/\/members\/it/.test(item.url) ? item.url : MENU_LEGACY_URL;
    } catch (e) { /* 확인된 원본 링크 사용 */ }
    if (generation !== S.guard.current()) return;
    $('it-legacy').href = url; $('it-legacy-wrap').hidden = false;
  }

  /* ---------- 진행 표시 ---------- */
  function tick() { const s = Math.floor((Date.now() - S.started) / 1000); $('it-elapsed').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function setBusy(on) {
    S.busy = on;
    $('it-ask').disabled = on; $('it-ask').setAttribute('aria-disabled', String(on));
    ['it-q', 'it-insurer', 'it-task', 'it-clear'].forEach((id) => { $(id).disabled = on; });
    document.querySelectorAll('[data-example], [data-followup], [data-insurer]').forEach((b) => { b.disabled = on; });
    $('it-app').setAttribute('aria-busy', String(on));
    if (on) { S.started = Date.now(); S.step = -1; tick(); clearInterval(S.timer); S.timer = setInterval(tick, 1000); $('it-progress').hidden = false; $('it-result').hidden = true; }
    else { clearInterval(S.timer); $('it-progress').hidden = true; }
  }
  function step(n, text) {
    S.step = n;
    document.querySelectorAll('.it-steps li').forEach((li, i) => { li.classList.toggle('is-done', i < n); li.classList.toggle('is-active', i === n); if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    if (text) progress(text);
  }
  function progress(text) { $('it-progress-text').textContent = text; }

  /* ---------- 질문 ---------- */
  async function ask(ev) {
    ev.preventDefault();
    if (S.busy) return;
    const q = $('it-q').value.trim();
    formMsg('');
    if (!q) { formMsg('막힌 내용을 입력해 주세요.'); $('it-q').focus(); return; }
    if (q.length > 800) { formMsg('질문은 800자 이내로 적어 주세요.'); $('it-q').focus(); return; }
    S.lastQuestion = q; S.lastInsurer = $('it-insurer').value; S.lastTask = $('it-task').value;
    const generation = S.guard.current();
    setBusy(true);
    try {
      const res = await askText(q, S.lastInsurer, S.lastTask, generation);
      S.guard.check(generation);
      setBusy(false);
      showResult(res);
    } catch (e) {
      if (generation !== S.guard.current()) return;
      setBusy(false);
      formMsg(e.message || '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      if (e.code === 'unauthorized') gate(esc(e.message) + ' <a href="/members/#login">로그인하기</a>');
    }
  }
  async function askText(q, insurer, task, generation) {
    step(0, '질문을 보내는 중…');
    const sub = await api('submit', { question: q, insurer, task }, generation);
    step(1, sub.processor && !sub.processor.online ? '매뉴얼 검색이 연결되지 않았어요. 최대 25초 기다린 뒤 기존 전산 자료로 확인합니다.' : '전산 매뉴얼을 찾는 중…');
    const t0 = Date.now();
    while (Date.now() - t0 < 27000) {
      await sleep(2000); S.guard.check(generation);
      let st;
      try { st = await api('status', { id: sub.id }, generation); } catch (e) { if (e.code === 'stale_session' || e.code === 'unauthorized' || e.code === 'forbidden') throw e; break; }
      if (st.status === '근거완료') { progress('전산 매뉴얼 근거 ' + st.evidenceCount + '건을 찾았어요(검색 ' + st.searchSec + '초).'); break; }
      if (st.status === '오류') { progress('전산 매뉴얼 검색이 되지 않았어요. 기존 전산 자료로 답합니다.'); break; }
      progress('전산 매뉴얼을 찾는 중… ' + Math.min(Number(st.waitedSec) || 0, 25) + '초 / 최대 25초');
    }
    step(2, '기존 전산 자료와 매뉴얼을 대조하는 중…');
    const later = setTimeout(() => { if (generation === S.guard.current() && S.busy && S.step === 2) step(3, '답변을 쓰고 검수하는 중… (보통 1~3분)'); }, 4000);
    try { return await api('answer', { id: sub.id }, generation); } finally { clearTimeout(later); }
  }
  /* ---------- 결과 ---------- */
  function showResult(res) {
    const search = res.manualSearch || {}, steps = items(res.steps);
    const badge = $('it-manual-badge');
    badge.className = 'it-badge' + (search.ok ? '' : ' is-miss');
    badge.textContent = res.needsClarification ? '보험사 확인이 필요해요' : search.ok ? '전산 매뉴얼 근거 ' + (Number(search.count) || 0) + '건 · 검색 ' + (Number(search.searchSec) || 0) + '초' : '전산 매뉴얼 검색 안 됨' + (search.reason ? ' — ' + search.reason : '');
    $('it-notice').hidden = !res.notice; $('it-notice').textContent = res.notice || '';
    $('it-answer-meta').textContent = [res.insurer, res.task, res.confidence === 'insufficient' ? '근거 부족' : ''].filter(Boolean).join(' · ');
    const detail = res.details || res.answer || '';
    $('it-answer').innerHTML = (res.summary ? '<p class="it-summary">' + inline(res.summary) + '</p>' : '') +
      (steps.length ? '<ol class="it-answer-steps">' + steps.map((s) => '<li><h3>' + esc(s.title || '처리') + '</h3>' + renderAnswer(s.body || '') + (s.menuPath ? '<p class="it-menu-path">' + esc(s.menuPath) + '</p>' : '') + '</li>').join('') + '</ol>' : '') +
      (detail ? renderAnswer(detail) : !res.summary && !steps.length ? '<p class="it-empty">아래 관련 매뉴얼을 먼저 확인해 주세요.</p>' : '');
    const notes = items(res.cautions).map((s) => '주의 · ' + s).concat(items(res.fallback).map((s) => '막힐 때 · ' + s));
    if (res.helpdesk) notes.push('문의 · ' + res.helpdesk);
    $('it-answer-notes').hidden = !notes.length;
    $('it-answer-notes').innerHTML = notes.map((s) => '<p>' + esc(s) + '</p>').join('');
    S.answer = [res.summary, ...steps.map((s, i) => (i + 1) + '. ' + (s.title || '처리') + '\n' + (s.body || '') + (s.menuPath ? '\n' + s.menuPath : '')), detail, ...notes].filter(Boolean).join('\n\n').replace(/<span[^>]*>|<\/span>/g, '').replace(/\*\*/g, '');
    $('it-copy').hidden = !S.answer;
    if (res.insurer && Array.from($('it-insurer').options).some((o) => o.value === res.insurer)) S.lastInsurer = res.insurer;
    if (res.task && Array.from($('it-task').options).some((o) => o.value === res.task)) S.lastTask = res.task;
    $('it-followups').innerHTML = items(res.followups).slice(0, 4).map((s) => '<button type="button" class="it-chip" data-followup="' + esc(s) + '">' + esc(s) + '</button>').join('');
    const choices = res.needsClarification ? items(res.clarification && res.clarification.options) : [];
    $('it-clarification').innerHTML = choices.filter((s) => Array.from($('it-insurer').options).some((o) => o.value === s)).map((s) => '<button type="button" class="it-chip" data-insurer="' + esc(s) + '">' + esc(s) + '</button>').join('');
    const manuals = items(res.manuals);
    $('it-manuals').innerHTML = manuals.length ? manuals.map((m) => '<li><span class="it-manual-title">' + esc(m.title || m.name || '전산 매뉴얼') + '</span><div class="it-manual-meta">' +
      [m.insurer, m.docType, m.page ? '쪽: ' + String(m.page) : ''].filter(Boolean).map((s) => '<span>' + esc(s) + '</span>').join('') + '</div>' + (m.summary ? '<p class="it-manual-sum">' + esc(m.summary) + '</p>' : '') + '</li>').join('') : '<li class="it-empty">' + (res.needsClarification ? '보험사를 선택하면 관련 매뉴얼을 확인합니다.' : '표시할 검색 근거가 없습니다. 아래 관련 자료도 확인해 주세요.') + '</li>';
    const src = items(res.sources);
    $('it-sources-count').textContent = src.length ? '(' + src.length + ')' : '';
    $('it-sources').innerHTML = src.map((s) => typeof s === 'string' ? '<li>' + esc(s) + '</li>' : '<li>' + esc(s.name || s.title || '관련 매뉴얼') + ' <small>' + esc([s.docType || s.sourceType, s.freshness, s.page].filter(Boolean).join(' · ')) + '</small>' + (s.excerpt ? '<p>' + esc(s.excerpt) + '</p>' : '') + (safeUrl(s.url) ? ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>' : '') + '</li>').join('') || '<li>표시할 자료가 없습니다.</li>';
    $('it-originals').innerHTML = items(res.originals).map((x) => {
      const view = safeUrl(x.viewUrl) ? x.viewUrl : safeUrl(x.downloadUrl) ? x.downloadUrl : '';
      return view ? '<div class="it-orig"><span>' + esc(x.name || '관련 원본') + ' <small>' + esc(x.page || x.type || '') + '</small></span><span><a href="' + esc(view) + '" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a>' + (safeUrl(x.downloadUrl) ? ' · <a href="' + esc(x.downloadUrl) + '" target="_blank" rel="noopener noreferrer">다운로드</a>' : '') + '</span></div>' : '';
    }).join('');
    $('it-links').innerHTML = items(res.links).filter((x) => safeUrl(x.url)).map((x) => '<a class="it-chip" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer">' + esc(x.title || '전산 바로가기') + ' ↗</a>').join('');
    if (res.caution) $('it-caution').textContent = res.caution;
    $('it-result').hidden = false;
    const h = $('it-result-title'); h.focus({ preventScroll: true }); h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (S.me && S.me.user && S.me.user.admin && $('it-admin').open) loadAdmin();
  }
  /* 원본 답변기와 같은 해석(굵게·목록·표·제목) + 허용된 색 강조 3종만. 어두운 바탕에서 읽히는 색으로 바꿔 보여 준다. */
  const COLOR = { '#c0392b': 'it-risk', '#2e7d32': 'it-good', '#b8860b': 'it-doc', '#b8380b': 'it-doc' };
  function inline(x) {
    const out = esc(x).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<span class="it-code">$1</span>');
    return out.replace(/&lt;span style=&quot;color:\s*(#[0-9a-fA-F]{6})\s*;\s*font-weight:\s*600;?\s*&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g, (all, color, content) => COLOR[color.toLowerCase()] ? '<span class="' + COLOR[color.toLowerCase()] + '">' + content + '</span>' : all);
  }
  function renderAnswer(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n');
    let html = '', list = '', type = '', i = 0;
    const close = () => { if (list) { html += '<' + type + '>' + list + '</' + type + '>'; list = ''; type = ''; } };
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        close();
        const head = line.replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
        i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|')) { rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim())); i++; }
        html += '<div class="it-table" role="region" tabindex="0" aria-label="답변 표 · 좌우로 스크롤하여 확인"><table><thead><tr>' + head.map((x) => '<th>' + inline(x) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + head.map((_, j) => '<td>' + inline(r[j] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
        continue;
      }
      let m = line.match(/^(#{1,4})\s+(.+)$/);
      if (m) { close(); const lv = Math.min(3, m[1].length + 1); html += '<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'; i++; continue; }
      m = line.match(/^[-*•]\s+(.+)$/);
      if (m) { if (type && type !== 'ul') close(); type = 'ul'; list += '<li>' + inline(m[1]) + '</li>'; i++; continue; }
      m = line.match(/^\d+[.)]\s+(.+)$/);
      if (m) { if (type && type !== 'ol') close(); type = 'ol'; list += '<li>' + inline(m[1]) + '</li>'; i++; continue; }
      close();
      if (line) html += '<p>' + inline(line) + '</p>';
      i++;
    }
    close();
    return html;
  }
  function copyAnswer() {
    if (!navigator.clipboard) { formMsg('이 브라우저에서는 자동 복사를 지원하지 않아요. 답변을 직접 선택해 복사해 주세요.'); return; }
    navigator.clipboard.writeText(S.answer).then(() => { $('it-copy').textContent = '복사했어요'; setTimeout(() => { $('it-copy').textContent = '답변 복사'; }, 1800); }, () => { $('it-copy').textContent = '복사 실패'; });
  }

  /* ---------- 관리자 ---------- */
  const yes = (v) => (v ? '있음' : '없음');
  async function loadAdmin() {
    const generation = S.guard.current();
    const box = $('it-admin-body');
    box.innerHTML = '<p class="it-hint">불러오는 중…</p>';
    try {
      const r = await api('adminData', {}, generation); S.guard.check(generation);
      const s = r.settings || {}, c = r.copy || {}, p = c.processor || {}, q = c.queue || {}, st = r.stats || {};
      let last = ''; try { const L = JSON.parse(c.retention && c.retention.last || '{}'); last = L.at ? L.at + ' · 가린 행 ' + (L.masked || 0) : ''; } catch (e) { last = ''; }
      box.innerHTML = '<dl>' +
        '<dt>AI 키</dt><dd>Claude ' + yes(c.keys && c.keys.anthropic) + ' · OpenAI ' + yes(c.keys && c.keys.openai) + '</dd>' +
        '<dt>기존 전산 자료</dt><dd>' + (c.sourceConfigured ? '연결됨' : '연결 전') + '</dd>' +
        '<dt>맥 매뉴얼 처리기</dt><dd>' + (p.online ? '켜짐 · 심박 ' + p.heartbeatAge + '초 전' : '꺼짐 또는 응답 없음') + (p.search5111 ? ' · 5111 ' + esc(p.search5111) : '') + '</dd>' +
        '<dt>질문함</dt><dd>전체 ' + (q.total || 0) + ' · 오늘 ' + (q.today || 0) + ' · 완료 ' + (q.done || 0) + '</dd>' +
        '<dt>7일 지난 질문 가림</dt><dd>' + (c.retention && c.retention.triggerOk ? '하루 1번 실행' : '트리거 준비 전') + (last ? ' · 마지막 ' + esc(last) : '') + '</dd>' +
        '<dt>답변 모델</dt><dd>' + esc(s.answerModel || '-') + ' (검수 ' + esc(s.verifyModel || '-') + ')</dd>' +
        '<dt>오늘 질문</dt><dd>' + (st.todayQueries || 0) + '건 · 누적 ' + (st.totalQueries || 0) + '건</dd>' +
        '</dl>' +
        ((s.modelOptions || []).length ? '<label for="it-model">답변 모델 바꾸기</label><select id="it-model">' + s.modelOptions.map((o) => '<option value="' + esc(o.value) + '"' + (o.value === s.answerModel ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>' : '<p class="it-hint">AI 키를 등록하면 모델을 고를 수 있어요(키 등록은 사본 GAS 편집기의 스크립트 속성에서).</p>') +
        '<div class="it-actions">' + ((s.modelOptions || []).length ? '<button type="button" class="g-btn g-btn--ghost it-btn-sm" id="it-model-save">모델 저장</button>' : '') + '</div>' +
        '<p class="it-hint" id="it-admin-msg" role="status"></p>';
    } catch (e) { if (generation !== S.guard.current()) return; box.innerHTML = '<p class="it-hint">' + esc(e.message) + '</p>'; }
  }
  async function adminAction(id) {
    const out = $('it-admin-msg');
    try {
      if (id === 'it-model-save') { await api('adminSave', { answerModel: $('it-model').value }); out.textContent = '저장했어요.'; }
    } catch (e) { out.textContent = e.message; }
  }

  /* ---------- 연결 ---------- */
  $('it-form').addEventListener('submit', ask);
  $('it-q').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); if (!S.busy) $('it-form').requestSubmit(); } });
  $('it-clear').addEventListener('click', () => { if (S.busy) return; $('it-q').value = ''; $('it-insurer').value = ''; $('it-task').value = ''; formMsg(''); $('it-result').hidden = true; $('it-q').focus(); });
  document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => { if (S.busy) return; $('it-q').value = b.dataset.example; $('it-q').focus(); }));
  $('it-copy').addEventListener('click', copyAnswer);
  $('it-followups').addEventListener('click', (ev) => {
    const button = ev.target.closest('[data-followup]');
    if (!button || S.busy) return;
    $('it-q').value = button.dataset.followup;
    $('it-insurer').value = S.lastInsurer; $('it-task').value = S.lastTask;
    $('it-form').requestSubmit();
  });
  $('it-clarification').addEventListener('click', (ev) => {
    const button = ev.target.closest('[data-insurer]');
    if (!button || S.busy) return;
    $('it-q').value = S.lastQuestion; $('it-insurer').value = button.dataset.insurer;
    $('it-task').value = S.lastTask; $('it-form').requestSubmit();
  });
  $('it-admin').addEventListener('toggle', () => { if ($('it-admin').open) loadAdmin(); });
  $('it-admin-body').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) adminAction(b.id); });
  window.paToolReady = window.paToolReady || {}; window.paToolReady.it = true;
  boot();
})();
