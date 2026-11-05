/* /members/admin/ask/: 관리자만 조회하는 마스킹된 전체 AI 질문 통계. */
(function () {
  'use strict';
  const root = document.getElementById('ask-admin-app'), U = window.PA_ASK_ACCOUNT;
  if (!root || !U) return;
  const { el, note, button, card, metrics, count, duration, date, table } = U;
  let context = null;
  async function load(ctx, container) {
    container.setAttribute('aria-busy', 'true'); container.replaceChildren(note('AI 질문 통계를 불러오는 중…'));
    try {
      const response = await ctx.client.request('askAdminStats', {});
      ctx.check();
      const stats = response.stats;
      if (!stats || typeof stats !== 'object') throw new Error('invalid_stats');
      const byDay = Array.isArray(stats.byDay) ? stats.byDay : [];
      const byUser = Array.isArray(stats.byUser) ? stats.byUser : [];
      const unanswered = Array.isArray(stats.unanswered) ? stats.unanswered : [];
      const feedback = stats.feedback || {};
      const votes = Math.max(0, Number(feedback.up) || 0) + Math.max(0, Number(feedback.down) || 0);
      const positive = votes ? ((Math.max(0, Number(feedback.up) || 0) / votes) * 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '%' : '—';
      const maxDay = Math.max(1, ...byDay.map(row => Number(row.count) || 0));
      const settings = response.settings || {};
      container.replaceChildren(
        card('전체 이용 현황', metrics([
          ['전체 질문 수', count(stats.total) + '회'], ['이번 달', count(stats.month) + '회'], ['평균 응답 시간', duration(stats.avgResponseMs)],
          ['API 호출 수', count(stats.apiCalls) + '회'], ['입력 토큰', count(stats.inputTokens)], ['출력 토큰', count(stats.outputTokens)]
        ]), note('하루 한도: 1인당 ' + count(settings.dailyLimit || 20) + '회 · 한국시간 자정 기준' + (settings.adminExempt ? ' · 관리자 예외 적용' : ' · 관리자에게도 적용')),
          note('API 호출과 토큰은 서버에서 기록한 사용량입니다. 토큰을 제공하지 않은 응답은 합계에서 제외됩니다.'),
          el('div', { class: 'ask-account-actions' }, button('통계 새로고침', () => load(ctx, container)), note('확인 시각 ' + date(new Date())))),
        card('질문 분포', el('div', { class: 'ask-account-split' },
          el('div', {}, el('h3', {}, '일별 질문 추이'), table(['날짜 (한국시간)', '질문 수'], byDay.map(row => [row.day || '날짜 미확인',
            el('div', { class: 'ask-account-day' }, count(row.count) + '회', el('meter', { min: '0', max: maxDay, value: Math.max(0, Number(row.count) || 0), 'aria-label': (row.day || '') + ' 질문 ' + count(row.count) + '회' }))]))),
          el('div', {}, el('h3', {}, '분야별 질문'), U.categoryTable(stats)))),
        card('사용자별 질문 수', note('개인별 구분값으로 표시합니다. 고객 정보와 질문 원문은 노출하지 않습니다.'),
          table(['사용자 구분', '질문 수'], byUser.map(row => [row.userId || '미확인', count(row.count) + '회']))),
        card('답변 피드백', metrics([['👍 도움 됨', count(feedback.up) + '건'], ['👎 아쉬움', count(feedback.down) + '건'], ['긍정 피드백 비율', positive]]),
          note(votes ? '피드백을 남긴 답변 ' + count(votes) + '건을 기준으로 계산합니다.' : '아직 남겨진 피드백이 없습니다.')),
        card('자료에서 답을 찾지 못한 질문', note('저장 전에 개인정보를 가린 질문만 표시합니다.'),
          unanswered.length ? el('ol', { class: 'ask-account-questions' }, unanswered.map(item => el('li', {},
            el('small', {}, date(item.createdAt) + ' · ' + (item.category || '기타')),
            el('p', {}, item.question || '질문 내용 없음')))) : note('답을 찾지 못한 질문이 없습니다.')));
    } catch (error) {
      if (error.code === 'stale_session') return;
      if (error.code === 'forbidden' || error.code === 'unauthorized') { U.gate(root, '통계를 볼 수 없습니다', '승인된 관리자 계정으로 다시 로그인한 뒤 확인해 주세요.'); return; }
      container.replaceChildren(card('통계를 불러오지 못했습니다', note(error.message && /[가-힣]/.test(error.message) ? error.message : '연결을 확인한 뒤 다시 시도해 주세요.'), button('다시 불러오기', () => load(ctx, container))));
    } finally { container.removeAttribute('aria-busy'); }
  }
  async function boot() {
    if (context) { context.dispose(); context = null; }
    try {
      context = await U.connect(root, true);
      if (!context) return;
      root.classList.add('ask-account-stack');
      await load(context, root);
    } catch (error) { U.gate(root, '관리 권한을 확인하지 못했습니다', error.message || '연결을 확인한 뒤 다시 시도해 주세요.', boot); }
  }
  boot();
})();
