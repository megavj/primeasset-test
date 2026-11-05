/* /members/admin/ask/: 승인된 관리자만 질문 전문과 토큰 기반 예상 비용을 조회합니다. */
(function () {
  'use strict';
  const root = document.getElementById('ask-admin-app'), U = window.PA_ASK_ACCOUNT;
  if (!root || !U) return;
  const { el, note, button, card, metrics, count, duration, date, table } = U;
  const mask = value => window.PA_ASK.maskResidentId(value);
  const periods = { today: '오늘', month: '이번 달', all: '전체' };
  const statuses = { pending: '접수', queued: '접수', queued_v2: '접수', searching: '찾는 중', ready: '자료 확인 완료', writing: '작성 중', processing: '작성 중', answering: '작성 중', completed: '완료', done: '완료', failed: '실패', error: '실패' };
  const lengths = { short: '짧게', normal: '보통', long: '자세히' };
  const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const money = (value, currency) => hasNumber(value) ? Number(value).toLocaleString('ko-KR', { style: 'currency', currency, minimumFractionDigits: currency === 'USD' ? 4 : 0, maximumFractionDigits: currency === 'USD' ? 6 : 2 }) : '기록 없음';
  const costText = (usd, krw) => hasNumber(usd) ? money(usd, 'USD') + (hasNumber(krw) ? ' · ' + money(krw, 'KRW') : '') : '기록 없음';
  const tokenText = value => hasNumber(value) ? count(value) : '기록 없음';
  const userLabel = item => mask(item.displayName || '이름 기록 없음') + (item.userId ? ' · ' + item.userId : '');
  let context = null, sequence = 0;
  const filters = { period: 'month', includeTests: true, userId: '' };

  function pricingCard(pricing) {
    const models = pricing && pricing.models && typeof pricing.models === 'object' ? Object.entries(pricing.models) : [];
    const links = (Array.isArray(pricing.sources) ? pricing.sources : []).map(source => {
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:') return null;
        return el('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer' }, (source.provider || '모델') + ' 공식 가격 ↗');
      } catch { return null; }
    }).filter(Boolean);
    return card('비용 계산 기준',
      note('추정치(토큰×공식 단가)입니다. 실제 청구액과 다를 수 있으며, 토큰 기록이나 확인된 단가가 없는 질문은 합계에서 제외합니다.'),
      note('캐시 토큰 기록이 없는 과거 질문은 일반 입력 단가로 계산합니다. 캐시 할인 적용 전의 상한 추정치일 수 있습니다.'),
      note('단가 확인일: ' + (pricing.checkedAt || '기록 없음') + ' · 환율: ' + (hasNumber(pricing.exchangeRateKrwPerUsd) ? '1 USD = ' + count(pricing.exchangeRateKrwPerUsd) + '원' : '설정 없음') + ' · ' + (pricing.exchangeRateLabel || '설정 환율')),
      el('div', { class: 'ask-account-actions' }, links),
      el('details', { class: 'ask-admin-pricing' }, el('summary', {}, '모델별 단가 보기'),
        table(['모델', '입력 / 100만 토큰', '출력 / 100만 토큰', '캐시 입력 / 100만 토큰'], models.map(([model, rate]) => [model, money(rate.inputUsdPerMillion, 'USD'), money(rate.outputUsdPerMillion, 'USD'), money(rate.cachedInputUsdPerMillion, 'USD')]), '확인된 모델 단가가 없습니다.')));
  }

  function userTable(users) {
    if (!users.length) return note('선택한 기간에 질문한 설계사가 없습니다.');
    const labels = ['설계사', '오늘', '이번 달', '전체', '선택 기간', '선택 기간 비용'];
    return el('div', { class: 'ask-account-table-wrap ask-admin-users-wrap' },
      el('table', { class: 'ask-account-table ask-admin-users' },
        el('caption', { class: 'sr' }, '설계사별 질문 건수와 선택 기간 예상 비용'),
        el('thead', {}, el('tr', {}, labels.map(label => el('th', { scope: 'col' }, label)))),
        el('tbody', {}, users.map(user => {
          const excluded = Math.max(0, Number(user.missingUsage) || 0) + Math.max(0, Number(user.unpricedQuestions) || 0);
          const values = [el('span', { class: 'ask-admin-user-name' }, userLabel(user)), count(user.today) + '회', count(user.month) + '회', count(user.total) + '회', count(user.count) + '회',
            el('div', {}, !Number(user.pricedQuestions) && excluded ? (Number(user.missingUsage) ? '기록 없음' : '단가 미확인') : costText(user.costUsd, user.costKrw), excluded ? el('small', { class: 'ask-account-meta' }, '합계 제외 ' + count(excluded) + '건') : null)];
          return el('tr', {}, values.map((value, index) => el(index ? 'td' : 'th', { 'data-label': labels[index], ...(index ? {} : { scope: 'row' }) }, value)));
        }))));
  }

  function questionList(questions) {
    if (!questions.length) return note('선택한 조건에 해당하는 질문이 없습니다.');
    return el('ol', { class: 'ask-admin-question-list' }, questions.map(item => {
      const costLabel = item.costStatus === 'no_record' ? '기록 없음' : item.costStatus === 'unverified_price' ? '단가 미확인' : item.costStatus === 'no_api' ? 'API 호출 없음' : costText(item.costUsd, item.costKrw);
      const detail = [
        ['분야', mask(item.category || '기타')], ['답변 길이', lengths[item.length] || item.length || '기록 없음'],
        ['사용 모델', item.model || '기록 없음'], ['입력 토큰', tokenText(item.inputTokens)], ['출력 토큰', tokenText(item.outputTokens)],
        ['예상 비용', costLabel], ['처리 시간', duration(item.elapsedMs)], ['결과 상태', statuses[item.status] || item.status || '기록 없음']
      ];
      if (item.fallbackUsed) detail.push(['모델 전환', '대체 모델 사용']);
      if (item.reasoningEffort) detail.push(['추론 설정', item.reasoningEffort]);
      return el('li', { class: 'ask-admin-question', 'data-question-id': item.id || '' },
        el('div', { class: 'ask-admin-question-heading' },
          el('strong', {}, userLabel(item)), item.isTest ? el('span', { class: 'ask-admin-test-badge' }, '테스트') : null),
        el('time', { class: 'ask-account-meta', datetime: item.createdAt || '' }, date(item.createdAt) + ' (한국시간)'),
        el('p', { class: 'ask-admin-question-text' }, mask(item.question || '질문 내용 없음')),
        el('dl', { class: 'ask-admin-question-details' }, detail.map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value)))));
    }));
  }

  function renderStats(response, container) {
    const stats = response.stats;
    if (!stats || typeof stats !== 'object') throw new Error('invalid_stats');
    const byDay = Array.isArray(stats.byDay) ? stats.byDay : [];
    const byUser = Array.isArray(stats.byUser) ? stats.byUser : [];
    const questions = Array.isArray(stats.questions) ? stats.questions : [];
    const unanswered = Array.isArray(stats.unanswered) ? stats.unanswered : [];
    const feedback = stats.feedback || {}, cost = stats.cost || {}, settings = response.settings || {};
    const votes = Math.max(0, Number(feedback.up) || 0) + Math.max(0, Number(feedback.down) || 0);
    const positive = votes ? ((Math.max(0, Number(feedback.up) || 0) / votes) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%' : '—';
    const maxDay = Math.max(1, ...byDay.map(row => Number(row.count) || 0));
    const userSelect = el('select', { class: 'ask-account-input', id: 'ask-admin-user' }, el('option', { value: '' }, '모든 설계사'), ...byUser.map(user => el('option', { value: user.userId }, userLabel(user))));
    if (!byUser.some(user => user.userId === filters.userId)) filters.userId = '';
    userSelect.value = filters.userId;
    const questionCount = el('p', { class: 'ask-account-note', role: 'status' });
    const questionContent = el('div', {});
    function drawQuestions() {
      const selected = questions.filter(item => !filters.userId || item.userId === filters.userId);
      questionCount.textContent = periods[filters.period] + ' 질문 ' + count(selected.length) + '건 · 주민등록번호 뒷자리 7자리만 가림';
      questionContent.replaceChildren(questionList(selected));
    }
    userSelect.addEventListener('change', () => { filters.userId = userSelect.value; drawQuestions(); });
    drawQuestions();
    container.replaceChildren(
      card('전체 이용 현황', metrics([
        ['오늘 질문 수', count(stats.today) + '회'], ['이번 달', count(stats.month) + '회'], ['전체 질문 수', count(stats.allTime == null ? stats.total : stats.allTime) + '회'],
        ['선택 기간 질문 수', count(stats.total) + '회'], ['선택 기간 예상 비용 (USD)', money(cost.usd, 'USD')], ['선택 기간 예상 비용 (원)', money(cost.krw, 'KRW')]
      ]), note('추정치(토큰×공식 단가) · 비용 계산 가능 ' + count(cost.pricedQuestions) + '건 · 토큰 기록 없음 ' + count(cost.missingUsage) + '건 · 단가 미확인 ' + count(cost.unpricedQuestions) + '건'),
        note('선택 기간: ' + periods[filters.period] + ' · ' + (filters.includeTests ? '테스트 질문 포함' : '테스트 질문 제외') + ' · 모든 날짜는 한국시간 기준'),
        note('확인 시각 ' + date(new Date()))),
      card('설계사별 질문 · 비용', note('오늘·이번 달·전체 건수와 선택 기간의 비용 합계입니다. 이름을 기록하지 않은 과거 질문은 사용자 구분값으로 표시합니다.'), userTable(byUser)),
      card('질문 기록', el('label', { class: 'ask-account-field ask-admin-user-filter', for: 'ask-admin-user' }, '설계사 선택', userSelect), questionCount, questionContent),
      card('선택 기간 답변 현황', metrics([
        ['평균 응답 시간', duration(stats.avgResponseMs)], ['API 호출 수', count(stats.apiCalls) + '회'], ['입력 토큰', count(stats.inputTokens)], ['출력 토큰', count(stats.outputTokens)],
        ['👍 도움 됨', count(feedback.up) + '건'], ['👎 아쉬움', count(feedback.down) + '건'], ['긍정 피드백 비율', positive]
      ]), note('하루 한도: 1인당 ' + count(settings.dailyLimit || 20) + '회 · 한국시간 자정 기준' + (settings.adminExempt ? ' · 관리자 예외 적용' : ' · 관리자에게도 적용')),
        note('API 호출과 토큰은 서버 기록 기준입니다. 토큰을 기록하지 않은 과거 질문은 추정하지 않습니다.')),
      card('선택 기간 질문 분포', el('div', { class: 'ask-account-split' },
        el('div', {}, el('h3', {}, '일별 질문 추이'), table(['날짜 (한국시간)', '질문 수'], byDay.map(row => [row.day || '날짜 미확인',
          el('div', { class: 'ask-account-day' }, count(row.count) + '회', el('meter', { min: '0', max: maxDay, value: Math.max(0, Number(row.count) || 0), 'aria-label': (row.day || '') + ' 질문 ' + count(row.count) + '회' }))]))),
        el('div', {}, el('h3', {}, '분야별 질문'), U.categoryTable(stats)))),
      card('자료에서 답을 찾지 못한 질문', unanswered.length ? el('ol', { class: 'ask-account-questions' }, unanswered.map(item => el('li', {},
        el('small', {}, date(item.createdAt) + ' · ' + mask(item.category || '기타')), el('p', {}, mask(item.question || '질문 내용 없음'))))) : note('답을 찾지 못한 질문이 없습니다.')),
      pricingCard(response.pricing || stats.pricing || {}));
  }

  async function load(ctx, container, controls, status) {
    const ticket = ++sequence;
    container.setAttribute('aria-busy', 'true');
    controls.forEach(control => { control.disabled = true; });
    status.textContent = '질문과 비용 기록을 불러오는 중…';
    container.replaceChildren(note('잠시만 기다려 주세요.'));
    try {
      const response = await ctx.client.request('askAdminStats', { period: filters.period, includeTests: filters.includeTests });
      ctx.check();
      if (ticket !== sequence) return;
      renderStats(response, container);
      status.textContent = periods[filters.period] + ' 기록을 불러왔습니다.';
    } catch (error) {
      if (error.code === 'stale_session' || ticket !== sequence) return;
      if (error.code === 'forbidden' || error.code === 'unauthorized') { U.gate(root, '통계를 볼 수 없습니다', '승인된 관리자 계정으로 다시 로그인한 뒤 확인해 주세요.'); return; }
      status.textContent = '기록을 불러오지 못했습니다.';
      container.replaceChildren(card('통계를 불러오지 못했습니다', note(error.message && /[가-힣]/.test(error.message) ? error.message : '연결을 확인한 뒤 다시 시도해 주세요.'), button('다시 불러오기', () => load(ctx, container, controls, status))));
    } finally {
      if (ticket === sequence) { container.removeAttribute('aria-busy'); controls.forEach(control => { control.disabled = false; }); }
    }
  }

  async function boot() {
    if (context) { context.dispose(); context = null; }
    try {
      context = await U.connect(root, true);
      if (!context) return;
      root.removeAttribute('aria-busy'); root.classList.add('ask-account-stack');
      const period = el('select', { class: 'ask-account-input', id: 'ask-admin-period' }, ...Object.entries(periods).map(([value, label]) => el('option', { value }, label)));
      period.value = filters.period;
      const includeTests = el('input', { type: 'checkbox', id: 'ask-admin-tests' }); includeTests.checked = filters.includeTests;
      const status = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
      const content = el('div', { class: 'ask-account-stack' });
      const refresh = button('통계 새로고침', () => load(context, content, controls, status));
      const controls = [period, includeTests, refresh];
      period.addEventListener('change', () => { filters.period = period.value; load(context, content, controls, status); });
      includeTests.addEventListener('change', () => { filters.includeTests = includeTests.checked; load(context, content, controls, status); });
      root.replaceChildren(card('조회 조건',
        el('div', { class: 'ask-admin-filters' }, el('label', { class: 'ask-account-field', for: period.id }, '기간', period),
          el('label', { class: 'ask-account-consent', for: includeTests.id }, includeTests, '테스트 질문 포함'), refresh), status), content);
      await load(context, content, controls, status);
    } catch (error) { U.gate(root, '관리 권한을 확인하지 못했습니다', error.message || '연결을 확인한 뒤 다시 시도해 주세요.', boot); }
  }
  boot();
})();
