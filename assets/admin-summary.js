/* Read-only summary uses exactly the detailed dashboard's aggregate endpoint. */
(function () {
  'use strict';
  const money = value => value == null ? '기록 없음' : Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 2 }) + '원';
  const number = value => Number(value || 0).toLocaleString('ko-KR');
  function node(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }
  function mount(target, client) {
    let ticket = 0;
    async function load() {
      const version = ++ticket; target.setAttribute('aria-busy', 'true'); target.replaceChildren(node('p', '이번 달 질문·비용을 확인하는 중…', 'adm-note'));
      try {
        const response = await client.request('askAdminStats', { period: 'month', includeTests: false, reportVersion: 37 });
        if (ticket !== version || !target.isConnected) return;
        const recent = await client.request('askAdminQuestions', { snapshotId: response.snapshot.id, page: 1 });
        if (ticket !== version || !target.isConnected) return;
        const stats = response.stats, cost = stats.cost || {}, filters = response.filters || {};
        const heading = node('h3', '이번 달 AI 질문·비용');
        const range = node('p', (filters.startDate || filters.start || '') + ' ~ ' + (filters.endDate || filters.end || '') + ' · 한국시간 접수일 · 전체 설계사 · 테스트 제외', 'adm-note');
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
        const refresh = node('button', 'AI 통계 새로고침', 'adm-button'); refresh.type = 'button'; refresh.addEventListener('click', load);
        const time = node('p', '확인 시각 ' + new Date(response.snapshot.createdAt).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'}) + ' (한국시간)', 'adm-note');
        const previews = node('div', null, 'adm-two-col');
        const users = node('section'), questions = node('section');
        users.append(node('h4', '설계사별 미리보기'));
        const userList = node('ul');
        (stats.byUser || []).slice(0, 3).forEach(user => userList.append(node('li', (user.displayName || '이름 기록 없음') + (user.branch ? ' · ' + user.branch : '') + ' · ' + number(user.count) + '건')));
        users.append(userList.childElementCount ? userList : node('p', '조건에 맞는 설계사 없음', 'adm-note'));
        questions.append(node('h4', '최근 질문 미리보기'));
        const questionList = node('ul');
        (recent.questions || []).slice(0, 3).forEach(item => questionList.append(node('li', item.question || '질문 내용 없음')));
        questions.append(questionList.childElementCount ? questionList : node('p', '조건에 맞는 질문 없음', 'adm-note'));
        previews.append(users, questions);
        footer.append(open, refresh); target.replaceChildren(heading, range, grid, note, time, previews, footer);
      } catch (error) {
        if (ticket !== version || !target.isConnected) return;
        const retry = node('button', 'AI 통계 다시 불러오기', 'adm-button'); retry.type = 'button'; retry.addEventListener('click', load);
        target.replaceChildren(node('h3', 'AI 통계 조회 실패'), node('p', '연결과 관리자 권한을 확인한 뒤 다시 불러오세요. 가입·요청 검토는 계속할 수 있습니다.', 'adm-note'), retry);
      } finally { target.removeAttribute('aria-busy'); }
    }
    load();
  }
  window.PA_ADMIN_SUMMARY = { mount };
})();
