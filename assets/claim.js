/* 보험보상답변기(/members/claim/): 승인 회원 전용.
   홈페이지 로그인 토큰(Supabase access token)을 사본 GAS(시험 배포)에 보내고, GAS가 Supabase로 다시 확인한 뒤에만 답한다.
   여기서의 회원 확인(my_profile)은 안내 화면을 고르는 용도이고, 실제 권한 판정은 GAS(서버)가 한다. */
(function () {
  'use strict';
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbyCChb5Yr2pSC1DNoVLcPlpqg-4I9rAMter-Xnc4z16zzpZUVdc0b9spnHfS4C_RHHlJw/exec';
  const CHUNK = 1024 * 1024, MAX_FILES = 10, FILE_MAX = 40 * 1048576, TOTAL_MAX = 120 * 1048576;
  const OK_EXT = /\.(pdf|jpe?g|png|tiff?|heic|zip|docx?|xlsx?|pptx?|hwp|hwpx|txt)$/i;
  const $ = (id) => document.getElementById(id);
  const S = { sb: null, me: null, files: [], busy: false, answer: '', timer: 0, started: 0, step: -1 };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function gate(html) { $('cl-gate').hidden = false; $('cl-gate-msg').innerHTML = html; $('cl-app').hidden = true; }
  function formMsg(t) { $('cl-form-msg').textContent = t || ''; }

  async function token() {
    const { data } = await S.sb.auth.getSession();
    return data && data.session ? data.session.access_token : '';
  }
  async function api(action, payload) {
    const t = await token();
    if (!t) { const e = new Error('로그인이 만료됐어요. 다시 로그인해 주세요.'); e.code = 'unauthorized'; throw e; }
    let res;
    try {
      res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: t, screen: innerWidth < 700 ? 'mobile' : 'desktop' }, payload || {})), credentials: 'omit', redirect: 'follow' });
    } catch (e) {
      const err = new Error('답변기 서버에 연결하지 못했어요. 관리자 설정(최초 권한 허용)이 끝나지 않았거나 연결이 잠시 불안정합니다.'); err.code = 'network'; throw err;
    }
    let j = null;
    try { j = await res.json(); } catch (e) { j = null; }
    if (!res.ok || !j) { const err = new Error('답변기 서버가 아직 준비되지 않았어요(관리자 설정 전). 잠시 후 다시 시도해 주세요.'); err.code = 'server'; throw err; }
    if (!j.ok) { const err = new Error(j.message || '처리하지 못했어요. 잠시 후 다시 시도해 주세요.'); err.code = j.error; err.sub = j.code; throw err; }
    return j;
  }

  /* ---------- 시작: 로그인·승인 확인 ---------- */
  async function boot() {
    try { S.sb = await window.paClient(); } catch (e) { return gate('잠시 후 다시 열어 주세요.'); }
    let session = null;
    try { session = (await S.sb.auth.getSession()).data.session; } catch (e) { session = null; }
    if (!session) return gate('설계사 로그인 후 쓸 수 있어요. <a href="/members/#login">로그인하기</a>');
    let prof = null;
    try { const r = await S.sb.rpc('my_profile'); if (r.error) throw r.error; prof = r.data && r.data[0]; }
    catch (e) { return gate('회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
    if (!prof || prof.status !== 'active') {
      return gate(prof && prof.status === 'pending' ? '가입 승인 대기 중이에요. 관리자가 승인하면 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>' : '가입 승인된 설계사만 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>');
    }
    legacyLink();
    try { S.me = await api('whoami'); }
    catch (e) { return gate(esc(e.message)); }
    $('cl-gate').hidden = true;
    $('cl-app').hidden = false;
    renderStatus(S.me);
    if (S.me.user && S.me.user.admin) $('cl-admin').hidden = false;
    if (S.me.caution) $('cl-caution').textContent = S.me.caution;
  }
  function renderStatus(me) {
    const mac = $('cl-st-mac'), ai = $('cl-st-ai'), p = me.processor || {};
    mac.className = p.online ? 'is-ok' : 'is-bad';
    mac.lastElementChild.textContent = p.online ? '판례 검색 연결됨(맥 자료창고)' : '판례 검색 꺼짐 — 기준 문서로만 답변';
    ai.className = me.ai && me.ai.ready ? 'is-ok' : 'is-warn';
    ai.lastElementChild.textContent = me.ai && me.ai.ready ? 'AI 답변 준비됨' : 'AI 키 등록 전 — 근거만 표시';
  }
  /* 이전 답변기(기존 GAS) 링크: 인트라넷 메뉴에 등록된 주소를 그대로 쓴다(권한 있는 회원만 보임) */
  async function legacyLink() {
    try {
      const r = await S.sb.rpc('my_menu');
      const item = (r.data || []).find((x) => /보상\s*답변/.test(x.name || '') && x.unlocked && x.url && !/\/members\/claim/.test(x.url));
      if (item && /^https:\/\//.test(item.url)) { $('cl-legacy').href = item.url; $('cl-legacy-wrap').hidden = false; }
    } catch (e) { /* 링크만 숨김 */ }
  }

  /* ---------- 진행 표시 ---------- */
  function tick() { const s = Math.floor((Date.now() - S.started) / 1000); $('cl-elapsed').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function setBusy(on) {
    S.busy = on;
    $('cl-ask').disabled = on; $('cl-ask').setAttribute('aria-disabled', String(on));
    $('cl-app').setAttribute('aria-busy', String(on));
    if (on) { S.started = Date.now(); S.step = -1; tick(); clearInterval(S.timer); S.timer = setInterval(tick, 1000); $('cl-progress').hidden = false; $('cl-result').hidden = true; }
    else { clearInterval(S.timer); $('cl-progress').hidden = true; }
  }
  function step(n, text) {
    S.step = n;
    document.querySelectorAll('.cl-steps li').forEach((li, i) => { li.classList.toggle('is-done', i < n); li.classList.toggle('is-active', i === n); if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    if (text) progress(text);
  }
  function progress(text) { $('cl-progress-text').textContent = text; }

  /* ---------- 질문 ---------- */
  async function ask(ev) {
    ev.preventDefault();
    if (S.busy) return;
    const q = $('cl-q').value.trim();
    formMsg('');
    if (!S.files.length && !q) { formMsg('질문을 입력하거나 서류를 첨부해 주세요.'); $('cl-q').focus(); return; }
    if (S.files.length && !(S.me && S.me.ai && S.me.ai.ready)) { formMsg('서류 분석은 AI 키 등록 후 쓸 수 있어요. 지금은 첨부를 빼고 질문만 보내 주세요.'); return; }
    setBusy(true);
    try {
      const isDoc = !!S.files.length;
      const res = isDoc ? await askDocs(q) : await askText(q);
      setBusy(false);
      showResult(res, isDoc);
    } catch (e) {
      setBusy(false);
      formMsg(e.message || '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
      if (e.code === 'unauthorized') gate(esc(e.message) + ' <a href="/members/#login">로그인하기</a>');
    }
  }
  async function askText(q) {
    step(0, '질문을 보내는 중…');
    const sub = await api('submit', { question: q });
    step(1, sub.processor && !sub.processor.online ? '맥 판례 처리기가 응답하지 않아요. 최대 25초 기다린 뒤 기준 문서로 답합니다.' : '맥 자료창고에서 판례·분쟁조정 사례를 찾는 중…');
    const t0 = Date.now();
    while (Date.now() - t0 < 27000) {
      await sleep(2000);
      let st;
      try { st = await api('status', { id: sub.id }); } catch (e) { break; }
      if (st.status === '근거완료') { progress('판례·분쟁조정 근거 ' + st.evidenceCount + '건을 찾았어요(검색 ' + st.searchSec + '초).'); break; }
      if (st.status === '오류') { progress('판례 검색이 되지 않았어요. 기준 문서로 답합니다.'); break; }
      progress('판례·분쟁조정 사례를 찾는 중… ' + Math.min(st.waitedSec, 25) + '초 / 최대 25초');
    }
    step(2, '기준 문서와 판례를 대조하는 중…');
    const later = setTimeout(() => { if (S.busy && S.step === 2) step(3, '답변을 쓰고 검수하는 중… (보통 1~3분)'); }, 4000);
    try { return await api('answer', { id: sub.id, question: q }); } finally { clearTimeout(later); }
  }
  function b64(buf) { let bin = ''; const bytes = new Uint8Array(buf); for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  async function askDocs(q) {
    step(0, '파일을 안전하게 보내는 중…');
    const meta = S.files.map((f) => ({ name: f.name, mime: f.type || 'application/octet-stream', size: f.size, chunks: Math.ceil(f.size / CHUNK) }));
    const job = await api('upStart', { files: meta });
    const total = meta.reduce((a, m) => a + m.chunks, 0);
    let sent = 0;
    for (let fi = 0; fi < S.files.length; fi++) {
      const f = S.files[fi];
      for (let ci = 0; ci < meta[fi].chunks; ci++) {
        const buf = await f.slice(ci * CHUNK, Math.min(f.size, (ci + 1) * CHUNK)).arrayBuffer();
        await api('upChunk', { jobId: job.jobId, fileIndex: fi, chunkIndex: ci, data: b64(buf) });
        sent++; progress('파일 보내는 중 ' + sent + '/' + total);
      }
    }
    await api('upFinish', { jobId: job.jobId });
    step(1, '문서를 읽으면서 판례·분쟁조정 사례를 함께 찾는 중… (파일 수에 따라 1~4분)');
    const later = setTimeout(() => { if (S.busy && S.step === 1) step(3, '사실관계와 근거를 대조해 답변을 쓰는 중…'); }, 40000);
    try { return await api('docAnswer', { jobId: job.jobId, question: q }); } finally { clearTimeout(later); }
  }

  /* ---------- 결과 ---------- */
  function showResult(res, isDoc) {
    S.answer = res.answer || '';
    const cs = res.caseSearch || {};
    const badge = $('cl-case-badge');
    badge.className = 'cl-badge' + (cs.ok ? '' : ' is-miss');
    badge.textContent = cs.ok ? '판례·분쟁조정 근거 ' + cs.count + '건 · 검색 ' + cs.searchSec + '초' : '판례 검색 안 됨' + (cs.reason ? ' — ' + cs.reason : '');
    const notes = [];
    if (res.notice) notes.push(res.notice);
    if (res.docMissing) notes.push('보상 기준 문서가 아직 연결되지 않아 판례·자료로만 정리했습니다.');
    $('cl-notice').hidden = !notes.length; $('cl-notice').textContent = notes.join(' ');
    $('cl-answer').innerHTML = S.answer ? (isDoc ? renderStructured(S.answer) : renderAnswer(S.answer)) : '<p class="cl-empty">답변 문장이 없습니다. 아래 근거를 먼저 확인해 주세요.</p>';
    $('cl-copy').hidden = !S.answer;
    const cases = res.cases || [];
    $('cl-cases').innerHTML = cases.length ? cases.map((c) => '<li><span class="cl-case-title">' + esc(c.title) + '</span><div class="cl-case-meta">' +
      (c.caseNo ? '<span class="cl-no">' + esc(c.caseNo) + '</span>' : '<span>사건·결정번호 표기 없음</span>') + (c.date ? '<span>' + esc(c.date) + '</span>' : '') + (c.page ? '<span>' + esc(c.page.split(',').map((p) => p + '쪽').join(' · ')) + '</span>' : '') +
      '</div>' + (c.summary ? '<p class="cl-case-sum">' + esc(c.summary) + '</p>' : '') + '</li>').join('') : '<li class="cl-empty">' + (cs.ok ? '화면에 보여 줄 수 있는 판례가 없습니다(비공개 출처 자료는 답변 참고에만 사용).' : '이번 질문은 판례 검색이 되지 않았습니다. 기준 문서와 기존 자료로만 답했습니다.') + '</li>';
    const src = res.sources || [];
    $('cl-sources-count').textContent = src.length ? '(' + src.length + ')' : '';
    $('cl-sources').innerHTML = src.map((s) => '<li>' + esc(s.title) + ' <small>' + esc(s.sourceType || '') + '</small></li>').join('') || '<li>표시할 자료가 없습니다.</li>';
    $('cl-originals').innerHTML = (res.originals || []).filter((x) => x && /^https:\/\//.test(x.viewUrl || x.downloadUrl || '')).map((x) => '<div class="cl-orig"><span>' + esc(x.name) + ' <small>' + esc(x.type || '') + '</small></span><span><a href="' + esc(x.viewUrl || x.downloadUrl) + '" target="_blank" rel="noopener noreferrer">원문 보기 ↗</a></span></div>').join('');
    if (res.caution) $('cl-caution').textContent = res.caution;
    $('cl-result').hidden = false;
    const h = $('cl-result-title'); h.focus({ preventScroll: true }); h.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (S.files.length) { S.files = []; renderFiles(); $('cl-file').value = ''; }
    if (S.me && S.me.user && S.me.user.admin && $('cl-admin').open) loadAdmin();
  }
  /* 원본 답변기와 같은 해석(굵게·목록·표·제목) + 허용된 색 강조 3종만. 어두운 바탕에서 읽히는 색으로 바꿔 보여 준다. */
  const COLOR = { '#c0392b': 'cl-risk', '#2e7d32': 'cl-good', '#b8860b': 'cl-doc', '#b8380b': 'cl-doc' };
  function inline(x) {
    const out = esc(x).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<span class="cl-code">$1</span>');
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
        html += '<div class="cl-table"><table><thead><tr>' + head.map((x) => '<th>' + inline(x) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + head.map((_, j) => '<td>' + inline(r[j] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
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
  function renderStructured(s) {
    const marker = '## 상세분석', idx = s.indexOf(marker);
    const summary = idx >= 0 ? s.slice(0, idx) : s, detail = idx >= 0 ? s.slice(idx + marker.length) : '';
    return renderAnswer(summary) + (detail ? '<details' + (innerWidth >= 1000 ? ' open' : '') + '><summary>상세 분석 보기</summary>' + renderAnswer(detail) + '</details>' : '');
  }
  function copyAnswer() {
    const plain = S.answer.replace(/<span[^>]*>|<\/span>/g, '').replace(/\*\*/g, '');
    navigator.clipboard.writeText(plain).then(() => { $('cl-copy').textContent = '복사했어요'; setTimeout(() => { $('cl-copy').textContent = '답변 복사'; }, 1800); }, () => { $('cl-copy').textContent = '복사 실패'; });
  }

  /* ---------- 서류(원본과 같은 제한) ---------- */
  function addFiles(list) {
    const incoming = Array.from(list || []); const msgs = [];
    for (const f of incoming) {
      if (S.files.length >= MAX_FILES) { msgs.push('최대 10개까지 첨부할 수 있어요.'); break; }
      if (f.size > FILE_MAX) { msgs.push(f.name + ': 파일당 40MB를 넘었어요.'); continue; }
      if (!OK_EXT.test(f.name)) { msgs.push(f.name + ': 지원하지 않는 형식이에요.'); continue; }
      S.files.push(f);
    }
    if (S.files.reduce((a, f) => a + f.size, 0) > TOTAL_MAX) { S.files.splice(-incoming.length); msgs.push('전체 첨부 용량은 120MB까지예요.'); }
    formMsg(msgs.join(' '));
    renderFiles();
  }
  function kind(n) { if (/진단|소견/i.test(n)) return '진단서/소견서'; if (/손해사정|심사/i.test(n)) return '손해사정보고서'; if (/약관|증권/i.test(n)) return '약관/증권'; if (/검사|의무기록|진료/i.test(n)) return '의무기록'; return '기타 문서'; }
  function renderFiles() {
    $('cl-files').innerHTML = S.files.map((f, i) => '<li><span><b>' + esc(f.name) + '</b><br>' + (f.size / 1048576).toFixed(1) + 'MB · ' + kind(f.name) + '</span><button type="button" class="g-btn g-btn--ghost cl-btn-sm" data-remove="' + i + '" aria-label="' + esc(f.name) + ' 첨부 빼기">빼기</button></li>').join('');
  }

  /* ---------- 관리자 ---------- */
  const yes = (v) => (v ? '있음' : '없음');
  async function loadAdmin() {
    const box = $('cl-admin-body');
    box.innerHTML = '<p class="cl-hint">불러오는 중…</p>';
    try {
      const r = await api('adminData');
      const s = r.settings || {}, c = r.copy || {}, p = c.processor || {}, q = c.queue || {}, st = r.stats || {};
      let last = ''; try { const L = JSON.parse(c.retention && c.retention.last || '{}'); last = L.at ? L.at + ' · 가린 행 ' + (L.masked || 0) : ''; } catch (e) { last = ''; }
      box.innerHTML = '<dl>' +
        '<dt>AI 키</dt><dd>Claude ' + yes(c.keys && c.keys.anthropic) + ' · OpenAI ' + yes(c.keys && c.keys.openai) + '</dd>' +
        '<dt>보상 기준 문서</dt><dd>' + (c.docIdSet ? '연결됨' : '연결 전(CLAIM_DOC_ID 없음)') + '</dd>' +
        '<dt>맥 판례 처리기</dt><dd>' + (p.online ? '켜짐 · 심박 ' + p.heartbeatAge + '초 전' : '꺼짐 또는 응답 없음') + (p.search5111 ? ' · 5111 ' + esc(p.search5111) : '') + '</dd>' +
        '<dt>질문함</dt><dd>전체 ' + (q.total || 0) + ' · 오늘 ' + (q.today || 0) + ' · 완료 ' + (q.done || 0) + '</dd>' +
        '<dt>7일 지난 질문 가림</dt><dd>' + (c.retention && c.retention.triggerOk ? '하루 1번 실행' : '트리거 준비 전') + (last ? ' · 마지막 ' + esc(last) : '') + '</dd>' +
        '<dt>답변 모델</dt><dd>' + esc(s.answerModel || '-') + ' (검수 ' + esc(s.verifyModel || '-') + ')</dd>' +
        '<dt>오늘 질문</dt><dd>' + (st.todayQueries || 0) + '건 · 누적 ' + (st.totalQueries || 0) + '건</dd>' +
        '</dl>' +
        ((s.modelOptions || []).length ? '<label for="cl-model">답변 모델 바꾸기</label><select id="cl-model">' + s.modelOptions.map((o) => '<option value="' + esc(o.value) + '"' + (o.value === s.answerModel ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>' : '<p class="cl-hint">AI 키를 등록하면 모델을 고를 수 있어요(키 등록은 사본 GAS 편집기의 스크립트 속성에서).</p>') +
        '<div class="cl-actions">' + ((s.modelOptions || []).length ? '<button type="button" class="g-btn g-btn--ghost cl-btn-sm" id="cl-model-save">모델 저장</button>' : '') + (c.docIdSet ? '<button type="button" class="g-btn g-btn--ghost cl-btn-sm" id="cl-doc-refresh">기준 문서 다시 읽기</button>' : '') + '</div>' +
        '<p class="cl-hint" id="cl-admin-msg" role="status"></p>';
    } catch (e) { box.innerHTML = '<p class="cl-hint">' + esc(e.message) + '</p>'; }
  }
  async function adminAction(id) {
    const out = $('cl-admin-msg');
    try {
      if (id === 'cl-model-save') { await api('adminSave', { answerModel: $('cl-model').value }); out.textContent = '저장했어요.'; }
      if (id === 'cl-doc-refresh') { const r = await api('adminRefreshDoc'); out.textContent = '기준 문서 다시 읽음: ' + r.sections + '개 항목'; }
    } catch (e) { out.textContent = e.message; }
  }

  /* ---------- 연결 ---------- */
  $('cl-form').addEventListener('submit', ask);
  $('cl-clear').addEventListener('click', () => { if (S.busy) return; $('cl-q').value = ''; S.files = []; renderFiles(); $('cl-file').value = ''; formMsg(''); $('cl-result').hidden = true; $('cl-q').focus(); });
  document.querySelectorAll('[data-example]').forEach((b) => b.addEventListener('click', () => { $('cl-q').value = b.dataset.example; $('cl-q').focus(); }));
  $('cl-file').addEventListener('change', (e) => addFiles(e.target.files));
  $('cl-files').addEventListener('click', (e) => { const b = e.target.closest('[data-remove]'); if (b) { S.files.splice(Number(b.dataset.remove), 1); renderFiles(); $('cl-file').focus(); } });
  const drop = $('cl-drop');
  ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  $('cl-copy').addEventListener('click', copyAnswer);
  $('cl-admin').addEventListener('toggle', () => { if ($('cl-admin').open) loadAdmin(); });
  $('cl-admin-body').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) adminAction(b.id); });
  boot();
})();
