/* Read-only summary uses exactly the detailed dashboard's aggregate endpoint. */
(function () {
  'use strict';
  const money = value => value == null ? '기록 없음' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '원';
  const number = value => Number(value || 0).toLocaleString('ko-KR');
  function node(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  // Bound the whole read, including a stalled login-session lookup before fetch starts.
  function request(client, action, payload) {
    let timer;
    return Promise.race([
      Promise.resolve().then(() => client.request(action, payload)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })
    ]).finally(() => clearTimeout(timer));
  }
  function mount(target, client) {
    if (!target) return;
    let ticket = 0;
    const current = version => ticket === version && target.isConnected;
    function linkToDetail() {
      const link = node('a', 'AI 질문·비용 상세 보기', 'adm-button adm-button--secondary');
      link.href = '/members/admin/ask/'; return link;
    }
    async function loadQuestions(container, snapshotId, version) {
      container.setAttribute('aria-busy', 'true');
      container.replaceChildren(node('p', '최근 질문을 확인하는 중…', 'adm-note'));
      try {
        if (!snapshotId) throw new Error('snapshot unavailable');
        const recent = await request(client, 'askAdminQuestions', { snapshotId, page: 1 });
        if (!current(version)) return;
        const questionList = node('ul');
        (recent.questions || []).slice(0, 3).forEach(item => questionList.append(node('li', item.question || '질문 내용 없음')));
        container.replaceChildren(questionList.childElementCount ? questionList : node('p', '조건에 맞는 질문 없음', 'adm-note'));
      } catch (_) {
        if (!current(version)) return;
        const retry = node('button', '질문 미리보기 다시 확인', 'adm-button adm-button--secondary'); retry.type = 'button';
        retry.addEventListener('click', () => loadQuestions(container, snapshotId, version));
        container.replaceChildren(node('p', '최근 질문 미리보기를 확인하지 못했습니다. 위의 집계는 확인된 자료입니다.', 'adm-note'), retry);
      } finally {
        if (current(version)) container.removeAttribute('aria-busy');
      }
    }
    async function load() {
      const version = ++ticket; target.setAttribute('aria-busy', 'true');
      const loading = node('p', '이번 달 질문·비용을 확인하는 중…', 'adm-note'); loading.setAttribute('role', 'status');
      target.replaceChildren(loading);
      try {
        const response = await request(client, 'askAdminStats', { period: 'month', includeTests: false, reportVersion: 37 });
        if (!current(version)) return;
        if (!response || !response.stats) throw new Error('stats unavailable');
        const stats = response.stats, cost = stats.cost || {}, filters = response.filters || {};
        const heading = node('h3', '이번 달 AI 질문·비용');
        const start = filters.startDate || filters.start, end = filters.endDate || filters.end;
        const range = node('p', (start && end ? start + ' ~ ' + end : '이번 달') + ' · 한국시간 접수일 · 전체 설계사 · 테스트 제외', 'adm-note');
        const costLabel = cost.usd == null ? (cost.status === 'unverified_price' ? '단가 미확인' : '기록 없음') : money(cost.krw);
        const grid = node('div', null, 'adm-summary-metrics');
        [['질문 수', number(stats.total) + '건', 'questions'], ['질문한 설계사', number(stats.userCount) + '명', 'users'], ['예상 비용', costLabel, 'pricing'], ['자료 없음', number(stats.noEvidence) + '건', 'questions'], ['처리 실패', number(stats.failed) + '건', 'questions']].forEach(([label, value, anchor], index) => {
          const link = node('a', null, 'adm-summary-metric'); link.href = '/members/admin/ask/' + (index === 3 ? '?result=no_evidence' : index === 4 ? '?result=failed' : '') + '#' + anchor;
          link.append(node('span', label), node('strong', value));
          if (index === 2) link.append(node('span', cost.usd == null ? '산정 가능한 기록 없음' : '$' + Number(cost.usd).toFixed(6) + (cost.noApiQuestions === stats.total && stats.total ? ' · API 호출 없음' : '')));
          grid.append(link);
        });
        const note = node('p', '확인된 예상 비용 합계 · 산정 제외 ' + number(cost.excludedQuestions) + '건 · 토큰×공식 단가, 설정 환율 기준', 'adm-note');
        const footer = node('div', null, 'adm-actions'), open = node('a', '추이·설계사·질문 상세 보기', 'adm-button'); open.href = '/members/admin/ask/';
        const refresh = node('button', 'AI 통계 새로고침', 'adm-button adm-button--secondary'); refresh.type = 'button'; refresh.addEventListener('click', load);
        const stamp = response.snapshot && response.snapshot.createdAt;
        const time = node('p', stamp && !Number.isNaN(Date.parse(stamp)) ? '확인 시각 ' + new Date(stamp).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'}) + ' (한국시간)' : '현재 조회 결과', 'adm-note');
        const previews = node('div', null, 'adm-two-col');
        const users = node('section'), questions = node('section');
        users.append(node('h4', '설계사별 미리보기'));
        const userList = node('ul');
        (stats.byUser || []).slice(0, 3).forEach(user => userList.append(node('li', (user.displayName || '이름 기록 없음') + (user.branch ? ' · ' + user.branch : '') + ' · ' + number(user.count) + '건')));
        users.append(userList.childElementCount ? userList : node('p', '조건에 맞는 설계사 없음', 'adm-note'));
        questions.append(node('h4', '최근 질문 미리보기'));
        const questionBody = node('div', null, 'adm-summary-questions'); questionBody.setAttribute('aria-live', 'polite');
        questions.append(questionBody);
        previews.append(users, questions);
        footer.append(open, refresh); target.replaceChildren(heading, range, grid, note, time, previews, footer);
        // Render usable aggregate results before loading optional detail; its failure stays local.
        loadQuestions(questionBody, response.snapshot && response.snapshot.id, version);
      } catch (error) {
        if (!current(version)) return;
        const retry = node('button', '다시 시도', 'adm-button adm-button--secondary'); retry.type = 'button'; retry.addEventListener('click', load);
        const actions = node('div', null, 'adm-actions'); actions.append(retry, linkToDetail());
        const message = node('p', error?.message === 'timeout' || error?.code === 'timeout' ? '15초 동안 집계 응답이 없었습니다. 잠시 후 다시 시도해 주세요. 회원·가입 승인 업무는 계속할 수 있습니다.' : '연결과 관리자 권한을 확인한 뒤 다시 시도해 주세요. 회원·가입 승인 업무는 계속할 수 있습니다.', 'adm-note');
        message.setAttribute('role', 'status');
        target.replaceChildren(node('h3', '집계를 불러오지 못했어요'), message, actions);
      } finally { if (current(version)) target.removeAttribute('aria-busy'); }
    }
    load();
  }
  window.PA_ADMIN_SUMMARY = { mount };
})();
