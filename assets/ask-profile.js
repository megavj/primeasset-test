/* /members/me/: 기존 회원정보 RPC와 승인회원 AI 통계를 연결합니다. */
(function () {
  'use strict';
  const root = document.getElementById('ask-profile-app');
  const U = window.PA_ASK_ACCOUNT;
  if (!root || !U) return;
  const { el, note, button, card, metrics, count, duration, date } = U;
  let context = null;
  const mask = value => window.PA_ASK.maskResidentId(value);
  const timeText = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '기록 없음' : duration(value);
  const safeLink = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (_) { return null; } };
  const knownCount = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '집계 없음' : count(value) + '건';
  const phoneDigits = value => String(value || '').replace(/\D/g, '');
  const formatPhone = value => {
    const digits = phoneDigits(value);
    return digits.length === 11 ? digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7) : digits.length === 10 ? digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6) : digits;
  };
  function profileCard(ctx) {
    const p = ctx.profile;
    const status = { active: '승인 완료', pending: '승인 대기', suspended: '이용 정지' }[p.status] || '확인 필요';
    let phoneUnavailable = false;
    const summary = el('dl', { class: 'ask-account-profile' });
    function draw() {
      summary.replaceChildren(...[
        ['이름', p.name || '미입력'], ['소속 본부', p.branch || '미입력'],
        ['휴대폰', phoneUnavailable ? '확인하지 못했습니다' : p.phone == null ? '확인 중…' : formatPhone(p.phone) || '미입력'],
        ['등급', (p.grade || '미지정') + (p.is_admin ? ' · 관리자' : '')],
        ['승인 상태', status], ['계정', p.email || ctx.session.user.email || '미입력']
      ].flatMap(([label, value]) => [el('dt', {}, label), el('dd', {}, mask(value))]));
    }
    draw();
    async function loadPhone() {
      if (p.phone != null) return;
      await ctx.verify();
      const response = await ctx.sb.from('members').select('phone').eq('id', ctx.session.user.id).maybeSingle();
      ctx.check();
      if (response.error) throw response.error;
      p.phone = response.data && response.data.phone || '';
      phoneUnavailable = false; draw();
    }
    loadPhone().catch(error => { if (error.code !== 'stale_session') { phoneUnavailable = true; draw(); } });
    const message = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    const name = el('input', { class: 'ask-account-input', id: 'ask-profile-name', name: 'name', autocomplete: 'name', required: true, maxlength: '60' });
    const branch = el('select', { class: 'ask-account-input', id: 'ask-profile-branch', name: 'organization', autocomplete: 'organization', required: true });
    window.PA_SIGNUP.fillBranches(branch, p.branch);
    const phone = el('input', { class: 'ask-account-input', id: 'ask-profile-phone', name: 'tel', type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, maxlength: '15' });
    phone.addEventListener('blur', () => { phone.value = formatPhone(phone.value); });
    const consent = el('input', { id: 'ask-profile-consent', type: 'checkbox', required: true });
    const submit = el('button', { type: 'submit', class: 'g-btn g-btn--pri' }, '변경 저장');
    const cancel = button('취소', () => { form.hidden = true; edit.hidden = false; message.textContent = ''; edit.focus(); });
    const form = el('form', { class: 'ask-account-form', id: 'ask-profile-form', hidden: true },
      el('div', { class: 'ask-account-fields' },
        el('label', { class: 'ask-account-field', for: name.id }, '이름', name),
        el('label', { class: 'ask-account-field', for: branch.id }, '소속 본부', branch),
        el('label', { class: 'ask-account-field', for: phone.id }, '휴대폰 번호', phone)),
      el('label', { class: 'ask-account-consent', for: consent.id }, consent,
        el('span', {}, '[필수] 개인정보 수집·이용에 동의합니다. ', el('a', { href: '/privacy/', target: '_blank', rel: 'noopener' }, '개인정보처리방침'))),
      el('div', { class: 'ask-account-actions' }, submit, cancel));
    const edit = button('내 정보 수정', async () => {
      edit.disabled = true; message.textContent = '';
      try {
        await ctx.verify();
        await loadPhone();
        name.value = p.name || ''; window.PA_SIGNUP.fillBranches(branch, p.branch); phone.value = formatPhone(p.phone); consent.checked = false;
        form.hidden = false; edit.hidden = true; name.focus();
      } catch (error) {
        if (error.code !== 'stale_session') message.textContent = '내 정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
      } finally { edit.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!window.PA_SIGNUP.validName(name.value)) { message.textContent = '이름을 2자 이상 입력해 주세요.'; name.focus(); return; }
      if (!window.PA_SIGNUP.validBranch(branch.value)) { message.textContent = '목록에서 소속 본부를 선택해 주세요.'; branch.focus(); return; }
      if (!window.PA_SIGNUP.validPhone(phone.value)) { message.textContent = '010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.'; phone.focus(); return; }
      if (!consent.checked) { message.textContent = '개인정보 수집·이용 동의를 확인해 주세요.'; consent.focus(); return; }
      const values = { p_name: name.value.trim(), p_branch: branch.value.trim(), p_phone: formatPhone(phone.value), p_consent: true };
      const controls = [name, branch, phone, consent, submit, cancel];
      controls.forEach(control => { control.disabled = true; }); submit.textContent = '저장 중…'; message.textContent = '';
      try {
        const session = await ctx.verify();
        // 저장을 누른 계정의 토큰으로 요청을 고정합니다. 처리 중 계정이 바뀌어도 새 계정에 이전 입력을 쓰지 않습니다.
        const response = await ctx.sb.rpc('complete_profile', values).setHeader('Authorization', 'Bearer ' + session.access_token);
        ctx.check();
        if (response.error) throw response.error;
        p.name = values.p_name; p.branch = values.p_branch; p.phone = values.p_phone;
        draw(); form.hidden = true; edit.hidden = false; message.textContent = '내 정보를 저장했습니다.'; edit.focus();
        window.dispatchEvent(new Event('pa:profile'));
      } catch (error) {
        if (error.code !== 'stale_session') message.textContent = '저장하지 못했습니다. 입력 내용과 연결을 확인한 뒤 다시 시도해 주세요.';
      } finally { controls.forEach(control => { control.disabled = false; }); submit.textContent = '변경 저장'; }
    });
    const logout = button('로그아웃', async () => {
      logout.disabled = true; message.textContent = '';
      try {
        const response = await ctx.sb.auth.signOut();
        if (response.error) throw response.error;
        location.replace('/members/#login');
      } catch (_) { message.textContent = '로그아웃하지 못했습니다. 다시 시도해 주세요.'; logout.disabled = false; }
    });
    return card('계정 정보', summary, form, message,
      el('div', { class: 'ask-account-actions' }, edit,
        p.is_admin === true && p.status === 'active' ? el('a', { class: 'g-btn g-btn--ghost', href: '/members/admin/' }, '관리자 화면') : null,
        p.is_admin === true && p.status === 'active' ? el('a', { class: 'g-btn g-btn--ghost', href: '/members/admin/ask/' }, 'AI 질문 통계') : null, logout),
      note('이름·소속·휴대폰은 직접 수정할 수 있습니다. 등급·승인 상태 변경은 관리자에게 문의해 주세요.'));
  }
  function accessError(ctx, error) {
    if (!['unauthorized', 'forbidden', 'login_required', 'invalid_token', 'expired', 'not_active', 'stale_session'].includes(error.code)) return false;
    if (context === ctx) {
      ctx.dispose(); context = null; document.body.classList.remove('pa-logged');
      U.gate(root, '로그인·이용 권한을 확인해 주세요', '이전 계정의 정보와 답변을 비웠습니다. 다시 로그인하거나 이용 권한을 확인한 뒤 열어 주세요.', boot);
    }
    return true;
  }
  async function copyText(value, status, ctx) {
    try {
      await ctx.verify();
      const text = mask(value);
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const focus = document.activeElement, field = el('textarea', { class: 'ask-profile-copy-field', readonly: true }, text);
        document.body.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove(); if (focus && focus.isConnected) focus.focus(); if (!copied) throw new Error('copy_failed');
      }
      ctx.check(); status.textContent = '복사했습니다.';
    } catch (error) { if (!accessError(ctx, error)) status.textContent = '복사하지 못했습니다. 내용을 선택하여 복사해 주세요.'; }
  }
  function resultLabel(item) {
    if (['error', 'failed'].includes(item.status)) return '처리 실패';
    if (['done', 'completed'].includes(item.status)) return item.noEvidence === true ? '자료 없음' : item.noEvidence === false ? '답변 완료' : '답변 완료 · 자료 여부 미확인';
    return '처리 중';
  }
  function recentQuestion(ctx, item, index) {
    const completed = ['done', 'completed'].includes(item.status);
    const status = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    const detail = el('div', { class: 'ask-profile-answer', id: 'ask-profile-answer-' + index, hidden: true });
    let cached = null, loading = false;
    const open = button(completed ? '답변 다시 보기' : '진행 상태 확인', () => load(false));
    open.setAttribute('aria-controls', detail.id); open.setAttribute('aria-expanded', 'false');
    const copy = completed ? button('답변 복사', () => load(true)) : null;
    const heading = el('small', {}, date(item.createdAt) + ' · ' + mask(item.category || '미분류') + ' · ' + resultLabel(item));
    function render(result) {
      const sources = Array.isArray(result.sources) ? result.sources : [];
      const refs = sources.map((source, i) => `${i + 1}. ${source.title || '참고 자료'}${source.page ? ' · ' + source.page + '쪽' : ''}${safeLink(source.url) ? '\n' + safeLink(source.url) : ''}`).join('\n');
      detail.replaceChildren(el('h4', {}, '저장된 답변'), el('div', { class: 'ask-profile-answer-text' }, mask(result.answer || '저장된 답변 내용이 없습니다.')),
        el('h4', {}, '근거 자료 (' + sources.length + ')'), sources.length ? el('ol', { class: 'ask-profile-sources' }, sources.map(source => {
          const title = mask((source.title || '참고 자료') + (source.page ? ' · ' + source.page + '쪽' : ''));
          const url = safeLink(source.url);
          return el('li', {}, url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, title + ' · 새 창 ↗') : title);
        })) : note('저장된 근거 자료가 없습니다.'),
        el('div', { class: 'ask-account-actions' }, button('근거 포함 복사', () => copyText((result.answer || '') + '\n\n근거 자료\n' + (refs || '근거 자료 없음'), status, ctx))),
        note('저장된 답변 조회 · 새 질문 횟수 차감 없음. 내용은 원문과 함께 확인해 주세요.'));
    }
    async function load(copyOnly) {
      if (loading) return;
      if (!copyOnly && cached && !detail.hidden) {
        detail.hidden = true; open.setAttribute('aria-expanded', 'false'); open.textContent = '답변 다시 보기'; return;
      }
      loading = true; open.disabled = true; if (copy) copy.disabled = true; status.textContent = '저장된 결과를 확인하는 중…';
      try {
        await ctx.verify();
        if (!cached) {
          // Read-only path: never submit a new question or call askAnswer here.
          const response = await ctx.client.request('askStatus', { id: item.id });
          ctx.check();
          if (response.status !== 'done' && response.status !== 'completed') {
            status.textContent = response.status === 'error' || response.status === 'failed'
              ? '처리 실패 · ' + mask(response.message || '답변을 완성하지 못했습니다.')
              : response.status === 'ready' ? '자료 검색을 마쳤습니다. 저장된 답변이 아직 없습니다. 새 질문 횟수 차감 없음.'
              : '아직 처리 중입니다. 잠시 후 다시 확인해 주세요. 새 질문 횟수 차감 없음.';
            return;
          }
          cached = response.result || response;
          item.status = 'done'; item.noEvidence = typeof cached.noEvidence === 'boolean' ? cached.noEvidence : null;
          heading.textContent = date(item.createdAt) + ' · ' + mask(item.category || '미분류') + ' · ' + resultLabel(item);
          render(cached);
        }
        ctx.check();
        if (copyOnly) await copyText(cached.answer || '', status, ctx);
        else { detail.hidden = false; open.textContent = '답변 접기'; open.setAttribute('aria-expanded', 'true'); status.textContent = '저장된 답변을 열었습니다. 새 질문 횟수 차감 없음.'; }
      } catch (error) {
        if (!accessError(ctx, error)) status.textContent = mask(error.message && /[가-힣]/.test(error.message) ? error.message : '저장된 답변을 불러오지 못했습니다. 다시 확인해 주세요.');
      } finally { loading = false; open.disabled = false; if (copy) copy.disabled = false; }
    }
    return el('li', {}, heading, el('p', {}, mask(item.question || '질문 내용 없음')),
      el('small', {}, '응답 시간 ' + timeText(item.elapsedMs) + (item.feedback === 'up' ? ' · 도움 됨' : item.feedback === 'down' ? ' · 아쉬움' : '')),
      el('div', { class: 'ask-account-actions' }, open, copy), status, detail);
  }
  async function loadStats(ctx, container) {
    if (ctx.profile.status !== 'active') { container.replaceChildren(note('AI 질문 기록은 가입 승인이 완료되면 확인할 수 있습니다.')); return; }
    container.setAttribute('aria-busy', 'true'); container.replaceChildren(note('내 질문 기록을 불러오는 중…'));
    try {
      await ctx.verify();
      const response = await ctx.client.request('askMyStats', {});
      ctx.check();
      const stats = response.stats;
      if (!stats || typeof stats !== 'object') throw new Error('invalid_stats');
      const quota = response.quota || {};
      const quotaKnown = quota.remaining != null && quota.remaining !== '' && Number.isFinite(Number(quota.remaining));
      const recent = Array.isArray(stats.recent) ? stats.recent.slice(0, 10) : [];
      const results = stats.resultCounts || {};
      const feedback = stats.feedback || {};
      const samples = stats.responseSampleCount;
      const average = Number(samples) > 0 && stats.avgResponseMs != null ? duration(stats.avgResponseMs) : '집계 없음';
      const list = recent.length ? el('ol', { class: 'ask-account-questions' }, recent.map((item, index) => recentQuestion(ctx, item, index))) : note('아직 질문 기록이 없습니다. 인트라넷에서 첫 질문을 남겨 보세요.');
      const details = el('details', { class: 'ask-profile-details' }, el('summary', {}, '상세 통계 펼쳐 보기'),
        metrics([['총 질문 수', knownCount(stats.total)], ['이번 달', knownCount(stats.month)], ['평균 응답 시간', average]]),
        note(samples == null ? '응답 시간 표본 수를 확인하지 못했습니다.' : '완료 중 응답 시간이 기록된 ' + count(samples) + '건 기준'),
        metrics([['처리 중', knownCount(results.processing)], ['답변 완료', knownCount(results.answered)], ['자료 없음', knownCount(results.noEvidence)], ['처리 실패', knownCount(results.failed)]]),
        note('답변 완료는 정답을 보장하지 않습니다.' + (Number(results.unknown) > 0 ? ' 자료 여부 미확인 ' + count(results.unknown) + '건은 별도로 보관합니다.' : '')),
        el('h3', {}, '답변 평가'), note(feedback.total == null ? '평가 집계 없음' : '도움 됨 ' + count(feedback.up) + '건 / 평가 ' + count(feedback.total) + '건 · 평가한 질문만의 결과입니다.'),
        el('h3', {}, '분야별 질문'), U.categoryTable(stats));
      container.replaceChildren(
        el('section', { class: 'ask-profile-quota', 'aria-label': '오늘 질문 한도' },
          note(quotaKnown ? '오늘 남은 질문 ' + count(quota.remaining) + '/20회 · 한국시간 자정 초기화' : '남은 질문 수를 확인하지 못했습니다. 하루 20회 · 한국시간 자정 초기화')),
        el('div', { class: 'ask-profile-section-heading' }, el('h3', {}, '최근 질문 10개'), button('기록 새로고침', () => loadStats(ctx, container))),
        note('저장된 답변을 다시 보거나 복사해도 새 질문 횟수를 차감하지 않습니다.'), list,
        el('div', { class: 'ask-account-actions' }, el('a', { class: 'g-btn g-btn--pri', href: '/members/#home' }, '새로 질문하기')),
        details);
    } catch (error) {
      if (accessError(ctx, error)) return;
      container.replaceChildren(note(mask(error.message && /[가-힣]/.test(error.message) ? error.message : '내 질문 기록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.')), button('다시 불러오기', () => loadStats(ctx, container)));
    } finally { container.removeAttribute('aria-busy'); }
  }
  async function boot() {
    if (context) { context.dispose(); context = null; }
    try {
      context = await U.connect(root, false);
      if (!context) return;
      const body = el('div', {}, note('내 질문 기록을 불러오는 중…'));
      root.removeAttribute('aria-busy'); root.classList.add('ask-account-stack');
      root.replaceChildren(profileCard(context), card('내 AI 질문 기록', body));
      loadStats(context, body);
    } catch (error) { U.gate(root, '내 정보를 불러오지 못했습니다', error.message || '연결을 확인한 뒤 다시 시도해 주세요.', boot); }
  }
  boot();
})();
