/* /members/me/: 기존 회원정보 RPC와 승인회원 AI 통계를 연결합니다. */
(function () {
  'use strict';
  const root = document.getElementById('ask-profile-app');
  const U = window.PA_ASK_ACCOUNT;
  if (!root || !U) return;
  const { el, note, button, card, metrics, count, duration, date } = U;
  let context = null;
  const phoneDigits = value => String(value || '').replace(/\D/g, '');
  const formatPhone = value => {
    const digits = phoneDigits(value);
    return digits.length === 11 ? digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7) : digits.length === 10 ? digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6) : digits;
  };
  function profileCard(ctx) {
    const p = ctx.profile;
    const status = { active: '승인 완료', pending: '승인 대기', suspended: '이용 정지' }[p.status] || '확인 필요';
    const summary = el('dl', { class: 'ask-account-profile' });
    function draw() {
      summary.replaceChildren(...[
        ['이름', p.name || '미입력'], ['소속 본부', p.branch || '미입력'],
        ['등급', (p.grade || '미지정') + (p.is_admin ? ' · 관리자' : '')],
        ['승인 상태', status], ['계정', p.email || ctx.session.user.email || '미입력']
      ].flatMap(([label, value]) => [el('dt', {}, label), el('dd', {}, value)]));
    }
    draw();
    const message = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    const name = el('input', { class: 'ask-account-input', id: 'ask-profile-name', name: 'name', autocomplete: 'name', required: true, maxlength: '60' });
    const branch = el('input', { class: 'ask-account-input', id: 'ask-profile-branch', name: 'organization', autocomplete: 'organization', required: true, maxlength: '120' });
    const phone = el('input', { class: 'ask-account-input', id: 'ask-profile-phone', name: 'tel', type: 'tel', inputmode: 'tel', autocomplete: 'tel', required: true, maxlength: '15' });
    phone.addEventListener('blur', () => { phone.value = formatPhone(phone.value); });
    const consent = el('input', { id: 'ask-profile-consent', type: 'checkbox', required: true });
    const submit = el('button', { type: 'submit', class: 'g-btn g-btn--pri' }, '변경 저장');
    const cancel = button('취소', () => { form.hidden = true; edit.hidden = false; message.textContent = ''; edit.focus(); });
    const form = el('form', { class: 'ask-account-form', id: 'ask-profile-form', hidden: true },
      el('div', { class: 'ask-account-fields' },
        el('label', { class: 'ask-account-field', for: name.id }, '이름', name),
        el('label', { class: 'ask-account-field', for: branch.id }, '소속 본부·지사', branch),
        el('label', { class: 'ask-account-field', for: phone.id }, '휴대폰 번호', phone)),
      el('label', { class: 'ask-account-consent', for: consent.id }, consent,
        el('span', {}, '[필수] 개인정보 수집·이용에 동의합니다. ', el('a', { href: '/privacy/', target: '_blank', rel: 'noopener' }, '개인정보처리방침'))),
      el('div', { class: 'ask-account-actions' }, submit, cancel));
    const edit = button('내 정보 수정', async () => {
      edit.disabled = true; message.textContent = '';
      try {
        await ctx.verify();
        if (p.phone == null) {
          const response = await ctx.sb.from('members').select('phone').eq('id', ctx.session.user.id).maybeSingle();
          ctx.check();
          if (response.error) throw response.error;
          p.phone = response.data && response.data.phone || '';
        }
        name.value = p.name || ''; branch.value = p.branch || ''; phone.value = formatPhone(p.phone); consent.checked = false;
        form.hidden = false; edit.hidden = true; name.focus();
      } catch (error) {
        if (error.code !== 'stale_session') message.textContent = '내 정보를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
      } finally { edit.disabled = false; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!name.value.trim() || !branch.value.trim()) { message.textContent = '이름과 소속을 입력해 주세요.'; return; }
      if (!/^01[016789]\d{7,8}$/.test(phoneDigits(phone.value))) { message.textContent = '01로 시작하는 휴대폰 번호 10~11자리를 입력해 주세요.'; phone.focus(); return; }
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
      note('즐겨찾기 기능은 종료되었습니다. 이 브라우저에 저장된 기존 즐겨찾기 값은 삭제하지 않고 보관합니다.'));
  }
  async function loadStats(ctx, container) {
    if (ctx.profile.status !== 'active') { container.replaceChildren(note('AI 질문 통계는 가입 승인이 완료되면 확인할 수 있습니다.')); return; }
    container.setAttribute('aria-busy', 'true'); container.replaceChildren(note('내 질문 기록을 불러오는 중…'));
    try {
      const response = await ctx.client.request('askMyStats', {});
      ctx.check();
      const stats = response.stats;
      if (!stats || typeof stats !== 'object') throw new Error('invalid_stats');
      const quota = response.quota || {};
      const recent = Array.isArray(stats.recent) ? stats.recent.slice(0, 10) : [];
      const labels = { pending: '접수', queued: '접수', searching: '찾는 중', ready: '자료 확인 완료', writing: '작성 중', processing: '작성 중', answering: '작성 중', completed: '완료', done: '완료', failed: '실패', error: '실패' };
      const list = recent.length ? el('ol', { class: 'ask-account-questions' }, recent.map(item => el('li', {},
        el('small', {}, date(item.createdAt) + ' · ' + (item.category || '기타') + ' · ' + (labels[item.status] || item.status || '처리 중')),
        el('p', {}, item.question || '질문 내용 없음'),
        el('small', {}, '응답 시간 ' + duration(item.elapsedMs) + (item.feedback === 'up' ? ' · 👍 도움 됨' : item.feedback === 'down' ? ' · 👎 아쉬움' : ''))))) : note('아직 질문 기록이 없습니다. 인트라넷에서 첫 질문을 남겨 보세요.');
      container.replaceChildren(
        metrics([['총 질문 수', count(stats.total) + '회'], ['이번 달', count(stats.month) + '회'], ['평균 응답 시간', duration(stats.avgResponseMs)]]),
        note(quota.exempt ? '오늘 질문 한도: 관리자 예외 적용 중' : '오늘 남은 질문 ' + count(quota.remaining) + '회 · 하루 ' + count(quota.limit || 20) + '회, 한국시간 자정에 초기화'),
        el('h3', {}, '분야별 질문'), U.categoryTable(stats), el('h3', {}, '최근 질문 10개'),
        note('고객 이름·주민번호·전화번호 등 개인정보를 가린 질문만 표시합니다.'), list,
        el('div', { class: 'ask-account-actions' }, button('통계 새로고침', () => loadStats(ctx, container)), el('a', { class: 'g-btn g-btn--pri', href: '/members/#home' }, 'AI 질문하기')));
    } catch (error) {
      if (error.code === 'stale_session') return;
      container.replaceChildren(note(error.message && /[가-힣]/.test(error.message) ? error.message : '내 질문 통계를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.'), button('다시 불러오기', () => loadStats(ctx, container)));
    } finally { container.removeAttribute('aria-busy'); }
  }
  async function boot() {
    if (context) { context.dispose(); context = null; }
    try {
      context = await U.connect(root, false);
      if (!context) return;
      const body = el('div', {}, note('내 질문 기록을 불러오는 중…'));
      root.removeAttribute('aria-busy'); root.classList.add('ask-account-stack');
      root.replaceChildren(profileCard(context), card('내 AI 질문 통계', body));
      loadStats(context, body);
    } catch (error) { U.gate(root, '내 정보를 불러오지 못했습니다', error.message || '연결을 확인한 뒤 다시 시도해 주세요.', boot); }
  }
  boot();
})();
