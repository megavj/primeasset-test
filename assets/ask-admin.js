/* TASK37: 관리자 전용, 같은 서버 스냅샷으로 집계·목록·저장 답변·CSV를 확인합니다. */
(function () {
  'use strict';
  const root = document.getElementById('ask-admin-app'), U = window.PA_ASK_ACCOUNT;
  if (!root || !U) return;
  const { el, note, button, card, count, duration, date, table } = U;
  const mask = value => window.PA_ASK.maskResidentId(value);
  const answerPlain = value => window.PA_ASK_FORMAT.text(value || '');
  const answerBody = value => { const body = el('div', { class: 'pa-answer-rich' }); body.append(window.PA_ASK_FORMAT.fragment(value || '저장된 답변 없음')); return body; };

  const periods = { today: '오늘', week: '최근 7일', month: '이번 달', '30': '최근 30일', custom: '직접 기간', all: '전체' };
  const results = { pending: '처리 중', completed: '답변 완료', no_evidence: '자료 없음', failed: '처리 실패', unknown: '판정 미확인' };
  const lengths = { short: '짧게', normal: '보통', long: '자세히' };
  const defaults = () => ({ period: 'month', includeTests: false, userId: '', category: '', result: '', search: '', startDate: '', endDate: '' });
  const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const money = (value, currency = 'KRW') => numeric(value) ? Number(value).toLocaleString('ko-KR', { style: 'currency', currency, minimumFractionDigits: currency === 'USD' ? 4 : 0, maximumFractionDigits: currency === 'USD' ? 6 : 2 }) : '기록 없음';
  const token = value => numeric(value) ? count(value) : '기록 없음';
  const userName = user => mask(user.displayName || '이름 기록 없음');
  const userLabel = user => userName(user) + (user.branch ? ' · ' + mask(user.branch) : '');
  const resultLabel = item => results[item.result] || ({ done: '답변 완료', completed: '답변 완료', error: '처리 실패', failed: '처리 실패' }[item.status]) || '처리 중';
  let ctx, sequence = 0, detailSequence = 0, filters = defaults(), snapshot, stats, pricing = {}, filterForm, controls = {}, status, content, questionSection, questionContent, questionStatus, dialog, detailBody, closeDetailButton, detailReturn, detailScroll = 0;
  const initialResult = new URLSearchParams(location.search).get('result');
  if (Object.prototype.hasOwnProperty.call(results, initialResult)) filters.result = initialResult;
  let page = 1, localUserSearch = '', userSort = 'count', userPage = 1;

  function costData(item) {
    return item.cost || { usd: item.costUsd, krw: item.costKrw, status: item.costStatus, pricedQuestions: item.pricedQuestions, missingUsage: item.missingUsage, unpricedQuestions: item.unpricedQuestions, noApiQuestions: item.noApiQuestions, excludedQuestions: item.excludedQuestions };
  }
  function costLabel(item) {
    const c = costData(item), excluded = Number(c.excludedQuestions) || (Number(c.missingUsage) || 0) + (Number(c.unpricedQuestions) || 0);
    if (c.status === 'no_api') return '0원 · API 호출 없음';
    if (!numeric(c.usd) || (!Number(c.pricedQuestions) && !Number(c.noApiQuestions) && excluded)) return c.status === 'unverified_price' || (!Number(c.missingUsage) && Number(c.unpricedQuestions)) ? '단가 미확인' : '기록 없음';
    return money(c.krw);
  }
  function costNode(item, supplementary = true) {
    const c = costData(item), excluded = Number(c.excludedQuestions) || (Number(c.missingUsage) || 0) + (Number(c.unpricedQuestions) || 0);
    return el('div', { class: 'ask-admin-cost' }, el('span', {}, costLabel(item)), supplementary ? el('span', { class: 'ask-account-meta' },
      numeric(c.usd) ? money(c.usd, 'USD') : '금액을 추정하지 않음', excluded ? ' · 합계 제외 ' + count(excluded) + '건' : '') : null);
  }
  function safeLink(value) {
    try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
  }
  function appliedText() {
    const f = filters, option = controls.userId && controls.userId.selectedOptions[0];
    return [f.startDate && f.endDate ? f.startDate + ' ~ ' + f.endDate : periods[f.period], '한국시간 접수일', f.userId ? (option && option.textContent || '선택 설계사') : '전체 설계사', f.category || '전체 분야', results[f.result] || '전체 결과', f.search ? '검색: ' + mask(f.search) : '', f.includeTests ? '테스트 포함' : '테스트 제외'].filter(Boolean).join(' · ');
  }
  function field(label, control) { return el('label', { class: 'ask-account-field', for: control.id }, label, control); }
  function select(id, options) { return el('select', { id, class: 'ask-account-input' }, options.map(([value, label]) => el('option', { value }, label))); }
  function scrollToQuestions() { if (questionSection) { questionSection.scrollIntoView({ block: 'start' }); questionSection.focus({ preventScroll: true }); } }
  function setFilter(values, jump) {
    Object.assign(filters, values); syncControls();
    return load().then(() => { if (jump) scrollToQuestions(); });
  }
  function syncControls() {
    Object.entries(controls).forEach(([key, control]) => { if (!(key in filters)) return; if (key === 'includeTests') control.checked = filters[key]; else control.value = filters[key]; });
    controls.dateRange.hidden = filters.period !== 'custom';
  }
  function buildFilters() {
    controls.period = select('ask-admin-period', Object.entries(periods));
    controls.userId = select('ask-admin-user', [['', '전체 설계사']]);
    controls.category = select('ask-admin-category', [['', '전체 분야']]);
    controls.result = select('ask-admin-result', [['', '전체 결과'], ...Object.entries(results)]);
    controls.startDate = el('input', { class: 'ask-account-input', id: 'ask-admin-start', type: 'date' });
    controls.endDate = el('input', { class: 'ask-account-input', id: 'ask-admin-end', type: 'date' });
    controls.search = el('input', { class: 'ask-account-input', id: 'ask-admin-search', type: 'search', placeholder: '질문 내용 검색', maxlength: '120' });
    controls.includeTests = el('input', { id: 'ask-admin-tests', type: 'checkbox' });
    controls.dateRange = el('div', { class: 'ask-admin-date-range', hidden: true }, field('시작일', controls.startDate), field('종료일', controls.endDate));
    controls.period.addEventListener('change', () => { controls.dateRange.hidden = controls.period.value !== 'custom'; });
    const apply = el('button', { class: 'g-btn g-btn--pri', type: 'submit' }, '조건 적용');
    const reset = button('조건 초기화', () => { filters = defaults(); syncControls(); load(); });
    status = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    filterForm = el('form', { class: 'ask-admin-filter-form', onsubmit: event => {
      event.preventDefault();
      if (controls.period.value === 'custom' && (!controls.startDate.value || !controls.endDate.value || controls.startDate.value > controls.endDate.value)) {
        status.textContent = '시작일과 종료일을 날짜순으로 입력해 주세요.'; controls.startDate.focus(); return;
      }
      Object.keys(defaults()).forEach(key => { filters[key] = key === 'includeTests' ? controls[key].checked : controls[key].value.trim(); });
      load();
    } }, el('div', { class: 'ask-admin-filter-grid' }, field('기간', controls.period), field('설계사', controls.userId), field('분야', controls.category), field('결과', controls.result)),
      controls.dateRange, field('질문 검색어', controls.search),
      el('div', { class: 'ask-admin-filter-actions' }, el('label', { class: 'ask-account-consent', for: controls.includeTests.id }, controls.includeTests, '테스트 질문 포함'), apply, reset), status);
    syncControls(); return card('조회 조건', filterForm);
  }
  function updateOptions(options) {
    const users = options.users || [], categories = options.categories || [];
    controls.userId.replaceChildren(el('option', { value: '' }, '전체 설계사'), ...users.map(user => el('option', { value: user.userId }, userLabel(user) + ' · ' + String(user.userId || '').slice(-8))));
    if (filters.userId && !users.some(u => u.userId === filters.userId)) controls.userId.append(el('option', { value: filters.userId }, '선택 설계사 · ' + filters.userId.slice(-8)));
    controls.category.replaceChildren(el('option', { value: '' }, '전체 분야'), ...categories.map(item => { const name = typeof item === 'string' ? item : item.category; return el('option', { value: name }, mask(name)); }));
    if (filters.category && !categories.some(c => (typeof c === 'string' ? c : c.category) === filters.category)) controls.category.append(el('option', { value: filters.category }, mask(filters.category)));
    syncControls();
  }
  function metric(label, value, helper, fn) {
    return el('div', {}, el('dt', {}, label), el('dd', {}, el('button', { type: 'button', class: 'ask-admin-metric-link', onclick: fn }, value), el('span', { class: 'ask-account-meta' }, helper)));
  }
  function summaryCard() {
    const c = stats.cost || {}, excluded = Number(c.excludedQuestions) || (Number(c.missingUsage) || 0) + (Number(c.unpricedQuestions) || 0);
    return card('선택 기간 이용 요약',
      el('p', { class: 'ask-admin-applied' }, appliedText()),
      filters.includeTests ? el('p', { class: 'ask-admin-test-banner' }, '테스트 질문을 포함한 화면입니다. 숫자·차트·표·목록·CSV 모두 같은 조건입니다.') : null,
      el('dl', { class: 'ask-account-metrics ask-admin-key-metrics' },
        metric('질문 수', count(stats.total) + '건', '처리 중·실패 포함, 고유 질문', scrollToQuestions),
        metric('질문한 설계사', count(stats.userCount) + '명', '이 기간에 질문한 설계사', () => document.getElementById('users').scrollIntoView({ block: 'start' })),
        metric('예상 비용', costLabel({ cost: c }), (numeric(c.usd) ? money(c.usd, 'USD') + ' · ' : '') + (excluded ? '확인된 합계 · 제외 ' + count(excluded) + '건' : '질문에 연결된 호출 기준'), () => document.getElementById('pricing').scrollIntoView({ block: 'start' })),
        metric('자료 없음', count(stats.noEvidence) + '건', '처리 실패와 별도 집계', () => setFilter({ result: 'no_evidence' }, true)),
        metric('처리 실패', count(stats.failed) + '건', '오류로 종료한 질문', () => setFilter({ result: 'failed' }, true))),
      note('처리 중 ' + count(stats.pending) + '건 · 답변 완료 ' + count(stats.completed) + '건 · 판정 미확인 ' + count(stats.unknown) + '건. 답변 완료는 정답을 보장하지 않습니다.'),
      note('확인 시각 ' + date(snapshot.createdAt) + ' KST · 이 기준 시점의 기록으로 집계합니다.'),
      el('div', { class: 'ask-account-actions' }, button('새로고침', load), el('a', { class: 'g-btn g-btn--ghost', href: '/members/admin/' }, '현재 가입·요청 처리할 일')));
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, children = []) { const n = document.createElementNS(svgNS, tag); Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v)); children.forEach(child => n.append(child.nodeType ? child : document.createTextNode(String(child)))); return n; }
  function dayChart(rows, isCost) {
    if (!rows.length) return note('조건에 맞는 질문 없음');
    const width = 600, height = 250, left = 54, right = 14, top = 40, bottom = 42, plotW = width - left - right, plotH = height - top - bottom;
    const val = row => isCost ? (numeric(row.cost && row.cost.krw) ? Number(row.cost.krw) : null) : Number(row.count) || 0;
    const max = Math.max(1, ...rows.map(row => val(row) || 0)), step = plotW / rows.length;
    const chart = svg('svg', { viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': isCost ? '일별 예상 비용 선 그래프. 기록 누락·부분 합계는 선을 잇지 않습니다. 같은 자료를 아래 표로 확인할 수 있습니다.' : '일별 질문 수 세로 막대그래프. 같은 자료를 아래 표로 확인할 수 있습니다.', class: 'ask-admin-chart' });
    chart.append(svg('line', { x1: left, y1: top + plotH, x2: width - right, y2: top + plotH, class: 'ask-chart-axis' }));
    [0, .5, 1].forEach(ratio => { const y = top + plotH * (1 - ratio); chart.append(svg('line', { x1: left, y1: y, x2: width - right, y2: y, class: 'ask-chart-grid' }), svg('text', { x: left - 7, y: y + 5, 'text-anchor': 'end', class: 'ask-chart-label' }, [isCost ? Math.round(max * ratio).toLocaleString('ko-KR') : Math.round(max * ratio)])); });
    const labelCount = Math.min(rows.length, 5), labelIndexes = new Set(Array.from({ length: labelCount }, (_, n) => Math.round(n * (rows.length - 1) / Math.max(1, labelCount - 1))));
    let segment = [];
    const flush = () => { if (segment.length > 1) chart.append(svg('polyline', { points: segment.join(' '), class: 'ask-chart-line' })); segment = []; };
    rows.forEach((row, i) => {
      const value = val(row), x = left + (i + .5) * step, y = value === null ? null : top + plotH - value / max * plotH;
      if (isCost) {
        const incomplete = value === null || Number(row.cost && row.cost.excludedQuestions) > 0 || ['partial', 'no_record', 'unverified_price'].includes(row.cost && row.cost.status);
        if (incomplete) flush();
        if (value !== null) {
          if (!incomplete) segment.push(x + ',' + y);
          const dot = svg('circle', { cx: x, cy: y, r: 3.5, class: incomplete ? 'ask-chart-dot ask-chart-partial' : 'ask-chart-dot' });
          dot.append(svg('title', {}, [row.day + ': ' + money(value) + (incomplete ? ' · 일부 기록 제외' : '')])); chart.append(dot);
        }
      } else {
        const bar = svg('rect', { x: x - Math.max(1, step * .32), y, width: Math.max(1, step * .64), height: Math.max(0, top + plotH - y), rx: 2, class: 'ask-chart-bar' });
        bar.append(svg('title', {}, [row.day + ': ' + count(value) + '건'])); chart.append(bar);
      }
      if (labelIndexes.has(i)) {
        chart.append(svg('text', { x, y: height - 14, 'text-anchor': 'middle', class: 'ask-chart-label' }, [String(row.day).slice(5)]));
        if (value !== null) chart.append(svg('text', { x, y: Math.max(20, y - 10), 'text-anchor': 'middle', class: 'ask-chart-value' }, [isCost ? (Number(row.cost && row.cost.excludedQuestions) ? '부분 ' : '') + Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '원' : count(value) + '건']));
      }
    });
    if (isCost) flush(); return el('div', { class: 'ask-admin-chart-scroll', tabindex: '0', role: 'region', 'aria-label': (isCost ? '일별 예상 비용' : '일별 질문 수') + ' 차트 · 작은 화면은 좌우로 이동' }, chart);
  }
  function chartsCard() {
    const days = stats.byDay || [], categories = stats.byCategory || [], feedback = stats.feedback || {};
    const maxCategory = Math.max(1, ...categories.map(row => Number(row.count) || 0));
    const categoryBars = el('ul', { class: 'ask-admin-category-bars' }, categories.map(row => el('li', {}, el('span', {}, mask(row.category || '기타')), el('strong', {}, count(row.count) + '건'), el('meter', { min: 0, max: maxCategory, value: Number(row.count) || 0, 'aria-label': mask(row.category) + ' ' + count(row.count) + '건' }))));
    const dayBlock = (label, isCost) => el('section', {}, el('h3', {}, label), dayChart(days, isCost), isCost ? note('원화 기준 · 누락된 비용은 0원으로 연결하지 않습니다. 테두리 점은 일부만 확인된 합계입니다.') : note('한국시간 접수일 기준 · 조회가 완료된 날짜의 빈 날만 0건입니다.'),
      el('details', { class: 'ask-admin-table-toggle' }, el('summary', {}, '표로 보기'), table(isCost ? ['날짜', '예상 비용', '비용 상태·제외'] : ['날짜', '질문 수'], days.map(row => isCost ? [row.day, costLabel({ cost: row.cost || {} }), (row.cost && numeric(row.cost.usd) ? money(row.cost.usd, 'USD') + ' · ' : '') + '제외 ' + count(row.cost && row.cost.excludedQuestions) + '건'] : [row.day, count(row.count) + '건']))));
    return card('질문과 비용 추이', el('div', { class: 'ask-account-split' }, dayBlock('일별 질문 수', false), dayBlock('일별 예상 비용', true)),
      el('section', {}, el('h3', {}, '분야별 질문'), categories.length ? categoryBars : note('조건에 맞는 질문 없음'), el('details', { class: 'ask-admin-table-toggle' }, el('summary', {}, '표로 보기'), table(['분야', '질문 수'], categories.map(row => [mask(row.category || '기타'), count(row.count) + '건'])))),
      note(numeric(stats.avgResponseMs) && Number(stats.responseSampleCount) > 0 ? '완료 중 응답 시간이 기록된 ' + count(stats.responseSampleCount) + '건 평균 ' + duration(stats.avgResponseMs) + ' · 서버 처리 기록 기준' : '평균 응답 시간: 집계 없음'),
      note('도움 됨 ' + count(feedback.up) + '건 / 평가 ' + count(feedback.total == null ? Number(feedback.up || 0) + Number(feedback.down || 0) : feedback.total) + '건 · 평가하지 않은 질문은 비율에서 제외합니다.'));
  }
  function pager(current, totalPages, onChange, label) {
    const prev = button('이전', () => onChange(current - 1)), next = button('다음', () => onChange(current + 1)); prev.disabled = current <= 1; next.disabled = current >= totalPages;
    return el('nav', { class: 'ask-admin-pagination', 'aria-label': label }, prev, el('span', {}, current + ' / ' + Math.max(1, totalPages) + '페이지'), next);
  }
  function userTableCard(directoryStatus) {
    const search = el('input', { class: 'ask-account-input', type: 'search', id: 'ask-admin-user-search', placeholder: '이름·소속 찾기', value: localUserSearch });
    const sorting = select('ask-admin-user-sort', [['count', '질문 수 많은 순'], ['cost', '확인된 예상 비용 높은 순'], ['recent', '최근 질문 순'], ['name', '이름순']]); sorting.value = userSort;
    const body = el('div', {});
    const render = () => {
      let users = (stats.byUser || []).filter(u => !localUserSearch || userLabel(u).toLocaleLowerCase().includes(localUserSearch.toLocaleLowerCase()));
      users = users.slice().sort((a, b) => {
        if (userSort === 'name') return userName(a).localeCompare(userName(b), 'ko');
        if (userSort === 'recent') return String(b.lastQuestionAt || '').localeCompare(String(a.lastQuestionAt || ''));
        if (userSort === 'cost') { const av = numeric(a.costUsd), bv = numeric(b.costUsd); return av !== bv ? (av ? -1 : 1) : av ? Number(b.costUsd) - Number(a.costUsd) : 0; }
        return Number(b.count) - Number(a.count);
      });
      const pages = Math.max(1, Math.ceil(users.length / 20)); userPage = Math.min(userPage, pages);
      const headers = ['이름·소속', '질문', '자료 없음', '실패', '예상 비용', '최근 질문', '질문 보기'];
      const rows = users.slice((userPage - 1) * 20, userPage * 20).map(u => [el('div', {}, el('strong', {}, userName(u)), el('span', { class: 'ask-account-meta' }, mask(u.branch || '소속 미확인')), el('span', { class: 'ask-account-meta' }, '구분 ' + String(u.userId || '').slice(-8) + (u.nameSource === 'stored' ? ' · 저장 당시 이름' : ''))), count(u.count), count(u.noEvidence), count(u.failed), costNode(u), date(u.lastQuestionAt), button('질문 보기', () => setFilter({ userId: u.userId }, true))]);
      const rendered = table(headers, rows, '조건에 맞는 설계사 없음');
      if (rows.length) { rendered.classList.add('ask-admin-users-wrap'); const t = rendered.querySelector('table'); t.classList.add('ask-admin-users'); t.querySelectorAll('tbody tr').forEach(tr => Array.from(tr.children).forEach((td, i) => td.setAttribute('data-label', headers[i]))); }
      body.replaceChildren(note('표에 표시 ' + count(users.length) + '명 · 한 페이지 20명'), rendered, pager(userPage, pages, next => { userPage = next; render(); }, '설계사 표 페이지'));
    };
    search.addEventListener('input', () => { localUserSearch = search.value.trim(); userPage = 1; render(); }); sorting.addEventListener('change', () => { userSort = sorting.value; userPage = 1; render(); }); render();
    const section = card('설계사별 이용', note('아래 이름 찾기·정렬은 이 표에만 적용합니다. 전체 조건을 바꾸려면 상단 설계사 필터 또는 질문 보기를 이용해 주세요.'),
      directoryStatus !== 'current' ? note('일부 회원의 현재 이름·소속을 확인하지 못했습니다. 확인된 저장 이름과 사용자 구분값만 표시합니다.') : note('확인된 회원 이름·소속입니다. 이용량은 성과나 능력 순위가 아닙니다.'),
      el('div', { class: 'ask-admin-table-controls' }, field('표에서 이름 찾기', search), field('표 정렬', sorting)), body);
    section.id = 'users'; return section;
  }
  function questionList(questions) {
    if (!questions.length) return note('조건에 맞는 질문 없음');
    return el('ol', { class: 'ask-admin-question-list' }, questions.map(item => el('li', { class: 'ask-admin-question', 'data-question-id': item.id },
      el('div', { class: 'ask-admin-question-heading' }, el('strong', {}, userLabel(item)), el('span', { class: 'ask-admin-result' }, resultLabel(item)), item.isTest ? el('span', { class: 'ask-admin-test-badge' }, '테스트') : null),
      el('time', { class: 'ask-account-meta', datetime: item.createdAt }, date(item.createdAt) + ' KST · ' + mask(item.category || '기타')),
      el('p', { class: 'ask-admin-question-summary' }, mask(item.question || '질문 내용 없음')),
      el('div', { class: 'ask-admin-question-bottom' }, costNode(item, false), button('질문 상세', event => openDetail(item.id, event.currentTarget))))));
  }
  function accessError(error) {
    if (['forbidden', 'unauthorized', 'expired', 'invalid_token', 'not_active', 'login_required', 'stale_session'].includes(error.code)) {
      sequence++; detailSequence++; closeDialog(); snapshot = null; stats = null;
      if (ctx) ctx.dispose();
      U.gate(root, '관리자 권한을 확인해 주세요', '로그인 또는 이용 권한이 바뀌어 기록을 비웠습니다. 승인된 관리자 계정으로 다시 로그인한 뒤 열어 주세요.'); return true;
    }
    return false;
  }
  function errorMessage(error) { return error.code === 'snapshot_expired' ? '기록 조회 기준 시점이 만료됐습니다. 새로고침하면 집계와 목록을 같은 시점으로 다시 불러옵니다.' : error.message && /[가-힣]/.test(error.message) ? error.message : '기록을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  async function loadQuestions(nextPage = 1) {
    const ticket = sequence, currentSnapshot = snapshot.id; page = nextPage;
    questionContent.setAttribute('aria-busy', 'true'); questionContent.replaceChildren(note('질문 기록을 불러오는 중…'));
    try {
      const response = await ctx.client.request('askAdminQuestions', { snapshotId: currentSnapshot, page }); ctx.check();
      if (ticket !== sequence || snapshot.id !== currentSnapshot) return;
      questionStatus.textContent = '전체 ' + count(response.total) + '건 · 20건씩 · 요약·차트와 같은 조회 기준';
      questionContent.replaceChildren(questionList(response.questions || []), pager(response.page || page, response.pageCount || 1, next => { loadQuestions(next); scrollToQuestions(); }, '질문 기록 페이지'));
    } catch (error) { if (ticket !== sequence || accessError(error)) return; questionStatus.textContent = '질문 기록 불러오기 실패'; questionContent.replaceChildren(note(errorMessage(error)), button(error.code === 'snapshot_expired' ? '전체 새로고침' : '목록 다시 불러오기', error.code === 'snapshot_expired' ? load : () => loadQuestions(page))); }
    finally { if (ticket === sequence) questionContent.removeAttribute('aria-busy'); }
  }
  function questionsCard() {
    questionStatus = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' }); questionContent = el('div', {});
    questionSection = card('질문 기록', note('질문은 두 줄로 요약해 표시합니다. 상세를 열면 저장된 질문·답변·근거를 확인할 수 있습니다.'), questionStatus, questionContent);
    questionSection.id = 'questions'; questionSection.tabIndex = -1; return questionSection;
  }
  function pricingCard() {
    const modelRows = Object.entries(pricing.models || {}).map(([model, rate]) => [model, money(rate.inputUsdPerMillion, 'USD'), money(rate.outputUsdPerMillion, 'USD'), money(rate.cachedInputUsdPerMillion, 'USD')]);
    const sources = (pricing.sources || []).map(source => { const url = safeLink(source.url); return url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, (source.provider || '모델') + ' 공식 단가 · 새 창') : null; }).filter(Boolean);
    const section = card('비용 계산 기준', note('기록된 토큰 × 확인된 단가의 예상 비용입니다. 실제 청구액과 다를 수 있습니다. 접수일에 해당하는 질문의 연결 호출 비용을 합산하며 결제일 기준이 아닙니다.'),
      note('기록 없음·단가 미확인은 금액을 추정하지 않습니다. 일부만 산정되면 확인된 합계와 제외 건수를 함께 표시합니다. API 호출이 없다고 확인된 질문만 0원입니다.'),
      note('단가 확인일 ' + (pricing.checkedAt || '기록 없음') + ' · 설정 환율: ' + (numeric(pricing.exchangeRateKrwPerUsd) ? '1 USD = ' + count(pricing.exchangeRateKrwPerUsd) + '원' : '기록 없음')),
      el('details', { class: 'ask-admin-table-toggle' }, el('summary', {}, '모델별 단가 보기'), table(['모델', '입력 / 100만', '출력 / 100만', '캐시 입력 / 100만'], modelRows), el('div', { class: 'ask-account-actions' }, sources)));
    section.id = 'pricing'; return section;
  }
  function exportCard() {
    const full = el('input', { id: 'ask-admin-csv-fulltext', type: 'checkbox' }), report = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    const userExport = button('설계사 요약 CSV · ' + count(stats.userCount) + '명', () => exportCsv('users'));
    const questionExport = button('질문 비용 기록 CSV · ' + count(stats.total) + '건', () => exportCsv('questions'));
    async function exportCsv(kind) {
      const ticket = sequence, currentSnapshot = snapshot.id; userExport.disabled = true; questionExport.disabled = true; full.disabled = true;
      report.textContent = '현재 조건의 전체 기록을 준비하는 중…';
      try {
        const response = await ctx.client.request('askAdminExport', { snapshotId: currentSnapshot, kind, includeFullText: kind === 'questions' && full.checked }); ctx.check();
        if (ticket !== sequence || snapshot.id !== currentSnapshot) return;
        if (typeof response.csv !== 'string') throw new Error('CSV 기록을 받지 못했습니다. 다시 시도해 주세요.');
        const blob = new Blob([response.csv.charCodeAt(0) === 0xfeff ? '' : '\ufeff', response.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob), a = el('a', { href: url, download: String(response.filename || 'ASK-' + kind + '.csv').replace(/[\\/]/g, '-') }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        report.textContent = count(response.count) + (kind === 'users' ? '명' : '건') + ' 전체 기록을 내보냈습니다.';
      } catch (error) { if (ticket !== sequence || accessError(error)) return; report.textContent = errorMessage(error); }
      finally { if (ticket === sequence) { userExport.disabled = false; questionExport.disabled = false; full.disabled = false; } }
    }
    return card('현재 조건 CSV 내보내기', note('현재 페이지가 아닌, 상단 조건에 맞는 전체 기록입니다. 위 설계사 표의 이름 찾기·정렬은 내보내기 조건을 바꾸지 않습니다. 기본 CSV에는 질문·답변 전문을 넣지 않습니다.'),
      el('label', { class: 'ask-account-consent', for: full.id }, full, '질문 비용 기록 CSV에 질문·답변 전문도 포함'),
      el('div', { class: 'ask-account-actions' }, userExport, questionExport), report);
  }
  async function copyText(text, destination) {
    try { await navigator.clipboard.writeText(mask(text)); destination.textContent = '복사했습니다.'; }
    catch { destination.textContent = '복사하지 못했습니다. 본문을 선택해 복사해 주세요.'; }
  }
  function makeDialog() {
    closeDetailButton = button('상세 닫기', closeDialog);
    detailBody = el('div', { class: 'ask-admin-detail-body' });
    dialog = el('dialog', { class: 'ask-admin-detail', 'aria-labelledby': 'ask-admin-detail-title', onclose: () => {
      detailSequence++; document.body.classList.remove('ask-admin-detail-open');
      if (detailReturn && detailReturn.isConnected) detailReturn.focus({ preventScroll: true }); window.scrollTo({ top: detailScroll, behavior: 'instant' });
    } }, el('div', { class: 'ask-admin-detail-heading' }, el('h2', { id: 'ask-admin-detail-title' }, '질문 상세'), closeDetailButton), detailBody);
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
    return dialog;
  }
  function closeDialog() { if (dialog && dialog.open) dialog.close(); document.body.classList.remove('ask-admin-detail-open'); }
  function sourceText(sources) { return sources.map((source, i) => (i + 1) + '. ' + mask(source.title || '자료명 기록 없음') + (source.page ? ' · ' + mask(source.page) + '쪽' : '') + (safeLink(source.url) ? '\n' + safeLink(source.url) : '')).join('\n'); }
  function renderDetail(question) {
    const item = question || {}, saved = item.answer && typeof item.answer === 'object' ? item.answer : {}, answer = typeof item.answer === 'string' ? item.answer : saved.answer || '';
    const sources = Array.isArray(item.sources) ? item.sources : Array.isArray(saved.sources) ? saved.sources : Array.isArray(item.evidence) ? item.evidence : [];
    const report = el('p', { class: 'ask-account-status', role: 'status', 'aria-live': 'polite' });
    const meta = [['설계사', userLabel(item)], ['결과', resultLabel(item)], ['접수 시각', date(item.createdAt) + ' KST'], ['완료 시각', item.completedAt ? date(item.completedAt) + ' KST' : '기록 없음'], ['처리 시간', numeric(item.elapsedMs) && Number(item.elapsedMs) > 0 ? duration(item.elapsedMs) : '기록 없음'], ['평가', ({ up: '도움 됨', down: '아쉬움' }[item.feedback]) || '평가 없음'], ['예상 비용', costNode(item)]];
    const details = [['실제 모델', item.actualModel || item.model || '기록 없음'], ['선택 모델', item.selectedModel || '기록 없음'], ['모델 전환', item.fallbackUsed === true ? '대체 모델 사용' : item.fallbackUsed === false ? '전환 없음' : '기록 없음'], ['추론 설정', item.reasoningEffort || '기록 없음'], ['답변 길이', lengths[item.length] || '기록 없음'], ['API 호출 수', token(item.apiCalls)], ['입력 토큰', token(item.inputTokens)], ['출력 토큰', token(item.outputTokens)], ['단가 확인일', pricing.checkedAt || '기록 없음'], ['적용 환율', numeric(pricing.exchangeRateKrwPerUsd) ? count(pricing.exchangeRateKrwPerUsd) + '원 / USD' : '기록 없음']];
    const attempts = Array.isArray(item.usageDetails) ? item.usageDetails : [];
    const dl = pairs => el('dl', { class: 'ask-admin-question-details' }, pairs.map(([key, value]) => el('div', {}, el('dt', {}, key), el('dd', {}, value))));
    detailBody.replaceChildren(...[note('저장된 기록 조회입니다. 새 질문 횟수 차감이나 답변 생성은 없습니다.'), dl(meta),
      el('h3', {}, '질문'), el('p', { class: 'ask-admin-fulltext' }, mask(item.question || '질문 기록 없음')), button('질문 복사', () => copyText(item.question || '', report)),
      el('h3', {}, '저장된 답변'), answerBody(answer),
      answer ? el('div', { class: 'ask-account-actions' }, button('답변 복사', () => copyText(answerPlain(answer), report)), button('근거 포함 복사', () => copyText(answerPlain(answer) + (sources.length ? '\n\n근거 자료\n' + sourceText(sources) : ''), report))) : null,
      el('h3', {}, '근거 자료'), sources.length ? el('ol', { class: 'ask-admin-sources' }, sources.map(source => { const link = safeLink(source.url); return el('li', {}, el('strong', {}, mask(source.title || '자료명 기록 없음')), source.page ? el('p', {}, mask(source.page) + '쪽') : null, link ? el('a', { href: link, target: '_blank', rel: 'noopener noreferrer' }, '원문 열기 · 새 창') : note('원문 연결 없음')); })) : note('저장된 근거 없음'),
      item.deep && item.deep.status === 'done' ? el('section', {}, el('h3', {}, '더 깊게 다시 답변'), answerBody(item.deep.answer), note('첫 답변과 같은 근거 자료를 사용했습니다.'), button('다시 답변 복사', () => copyText(answerPlain(item.deep.answer), report))) : null,
      item.error ? el('section', {}, el('h3', {}, '처리 실패 기록'), note(mask(item.error))) : null,
      el('details', { class: 'ask-admin-table-toggle' }, el('summary', {}, '계산 상세 · 모델·토큰·단가'), dl(details),
        attempts.length ? table(['시도 모델', '입력', '출력', '캐시 읽기', '캐시 쓰기', '쓰기 5분', '쓰기 1시간'], attempts.map(a => [a.actualModel || a.model || '기록 없음', token(a.inputTokens), token(a.outputTokens), token(a.cachedInputTokens == null ? a.cacheReadInputTokens : a.cachedInputTokens), token(a.cacheCreationInputTokens), token(a.cacheCreation5mInputTokens), token(a.cacheCreation1hInputTokens)])) : note('시도별 사용량 기록 없음'),
        el('h3', {}, '적용 단가 (USD / 100만 토큰)'), table(['모델', '입력', '출력', '캐시 읽기', '캐시 쓰기 5분', '캐시 쓰기 1시간'], Object.entries(pricing.models || {}).filter(([model]) => model === item.model || model === item.actualModel || attempts.some(a => model === a.model || model.endsWith(':' + a.model))).map(([model, rate]) => [model, money(rate.inputUsdPerMillion, 'USD'), money(rate.outputUsdPerMillion, 'USD'), money(rate.cachedInputUsdPerMillion, 'USD'), money(rate.cacheWrite5mUsdPerMillion, 'USD'), money(rate.cacheWrite1hUsdPerMillion, 'USD')]), '이 모델에 확인된 단가 기록이 없습니다.')), report].filter(value => value != null));
  }
  async function openDetail(id, opener) {
    detailReturn = opener; detailScroll = window.scrollY; const ticket = ++detailSequence, currentSnapshot = snapshot.id;
    detailBody.replaceChildren(note('저장된 답변과 근거를 불러오는 중…'));
    if (!dialog.open) dialog.showModal(); document.body.classList.add('ask-admin-detail-open'); closeDetailButton.focus();
    try { const response = await ctx.client.request('askAdminDetail', { snapshotId: currentSnapshot, id }); ctx.check(); if (ticket !== detailSequence || !dialog.open) return; renderDetail(response.question); }
    catch (error) { if (ticket !== detailSequence || accessError(error)) return; detailBody.replaceChildren(note(errorMessage(error)), button(error.code === 'snapshot_expired' ? '닫고 전체 새로고침' : '상세 다시 불러오기', error.code === 'snapshot_expired' ? () => { closeDialog(); load(); } : () => openDetail(id, opener))); }
  }
  async function load() {
    const ticket = ++sequence; closeDialog(); snapshot = null; stats = null; page = 1; userPage = 1;
    content.setAttribute('aria-busy', 'true'); content.replaceChildren(note('집계와 조회 조건을 불러오는 중…')); status.textContent = '조회 중…';
    Array.from(filterForm.elements).forEach(control => { control.disabled = true; });
    try {
      const response = await ctx.client.request('askAdminStats', Object.assign({}, filters, { reportVersion: 37 })); ctx.check(); if (ticket !== sequence) return;
      if (!response.stats || !response.snapshot || !response.snapshot.id) throw new Error('통계 조회 형식을 확인하지 못했습니다. 다시 불러와 주세요.');
      stats = response.stats; snapshot = response.snapshot; pricing = response.pricing || {}; Object.assign(filters, response.filters || {});
      updateOptions(stats.filterOptions || response.filterOptions || { users: stats.byUser || [], categories: stats.byCategory || [] });
      content.replaceChildren(summaryCard(), chartsCard(), userTableCard(response.directoryStatus), questionsCard(), exportCard(), pricingCard());
      status.textContent = appliedText(); await loadQuestions();
    } catch (error) { if (ticket !== sequence || accessError(error)) return; status.textContent = '통계 불러오기 실패'; content.replaceChildren(card('통계를 불러오지 못했습니다', note(errorMessage(error)), button('다시 불러오기', load))); }
    finally { if (ticket === sequence) { content.removeAttribute('aria-busy'); Array.from(filterForm.elements).forEach(control => { control.disabled = false; }); } }
  }
  async function boot() {
    if (ctx) ctx.dispose();
    try {
      ctx = await U.connect(root, true, () => { sequence++; closeDialog(); }); if (!ctx) return;
      root.removeAttribute('aria-busy'); root.classList.add('ask-account-stack'); content = el('div', { class: 'ask-account-stack' });
      root.replaceChildren(buildFilters(), content, makeDialog()); await load();
      if (['#questions', '#users', '#pricing'].includes(location.hash)) document.querySelector(location.hash)?.scrollIntoView({ block: 'start' });
    } catch (error) { U.gate(root, '관리 권한을 확인하지 못했습니다', error.message || '연결을 확인하고 다시 열어 주세요.', boot); }
  }
  boot();
})();
