/* AI 질문 통계: 화면의 회원 확인과 서버의 통계 권한 검증을 함께 사용합니다. */
(function () {
  'use strict';
  const el = (tag, attrs, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (value !== null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
    });
    children.flat().forEach(child => { if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(String(child))); });
    return node;
  };
  const count = value => Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
  const duration = value => value == null || !Number.isFinite(Number(value)) ? '—' : (Math.max(0, Number(value)) / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '초';
  const date = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '날짜 미확인' : d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const note = text => el('p', { class: 'ask-account-note' }, text);
  const button = (label, fn, primary) => el('button', { type: 'button', class: 'g-btn ' + (primary ? 'g-btn--pri' : 'g-btn--ghost'), onclick: fn }, label);
  const card = (title, ...nodes) => el('section', { class: 'ask-account-card' }, el('h2', {}, title), ...nodes);
  function metrics(values) {
    return el('dl', { class: 'ask-account-metrics' }, values.map(([label, value]) => el('div', {}, el('dt', {}, label), el('dd', {}, value))));
  }
  function table(headers, rows, empty) {
    if (!rows.length) return note(empty || '아직 기록이 없습니다.');
    return el('div', { class: 'ask-account-table-wrap', tabindex: '0', role: 'region', 'aria-label': headers.join(' · ') },
      el('table', { class: 'ask-account-table' },
        el('thead', {}, el('tr', {}, headers.map(header => el('th', { scope: 'col' }, header)))),
        el('tbody', {}, rows.map(row => el('tr', {}, row.map(value => el('td', {}, value)))))));
  }
  function categoryTable(stats) {
    const rows = Array.isArray(stats.byCategory) ? stats.byCategory : [];
    return table(['분야', '질문 수'], rows.map(row => [row.category || '기타', count(row.count) + '회']), '질문하면 분야별 이용 기록이 쌓입니다.');
  }
  function gate(root, title, description, retry) {
    root.removeAttribute('aria-busy');
    root.replaceChildren(card(title, note(description), el('div', { class: 'ask-account-actions' },
      el('a', { class: 'g-btn g-btn--pri', href: '/members/#login' }, '인트라넷으로'), retry ? button('다시 확인', retry) : null)));
  }
  async function connect(root, admin, onChange) {
    const config = window.PA_AUTH || {};
    if (!config.url || !config.anonKey || !window.supabase || !window.PA_ASK) throw new Error('화면을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
    const sb = window.PA_SB || window.supabase.createClient(config.url, config.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
    window.PA_SB = sb;
    let owner, stale = false, client = null;
    const check = () => { if (stale) { const error = new Error('로그인 정보가 바뀌었습니다. 화면을 다시 열어 주세요.'); error.code = 'stale_session'; throw error; } };
    function invalidate() {
      if (stale) return;
      stale = true;
      if (client) client.dispose();
      root.replaceChildren();
      document.body.classList.remove('pa-logged');
      if (onChange) onChange();
      gate(root, '로그인 정보가 바뀌었습니다', '다른 계정의 정보가 남지 않도록 화면을 비웠습니다. 다시 로그인한 뒤 열어 주세요.');
    }
    const subscription = sb.auth.onAuthStateChange((event, next) => {
      if (owner === undefined || event === 'INITIAL_SESSION') return;
      const nextOwner = next && next.user ? next.user.id : null;
      if (nextOwner !== owner) invalidate();
    }).data.subscription;
    try {
    const response = await sb.auth.getSession();
    if (response.error) throw new Error('로그인 상태를 확인하지 못했습니다. 연결을 확인해 주세요.');
    const session = response.data && response.data.session;
    owner = session && session.user ? session.user.id : null;
    if (!session) { subscription.unsubscribe(); gate(root, '로그인이 필요합니다', '설계사 인트라넷에 로그인하면 내 정보와 AI 질문 기록을 확인할 수 있습니다.'); return null; }
    const profileResponse = await sb.rpc('my_profile');
    check();
    if (profileResponse.error) throw new Error('회원 정보를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.');
    const profile = profileResponse.data && profileResponse.data[0];
    if (!profile || profile.profile_done === false) { subscription.unsubscribe(); gate(root, '회원 정보를 먼저 입력해 주세요', '인트라넷에서 가입 정보를 입력한 뒤 이용해 주세요.'); return null; }
    if (admin && (profile.status !== 'active' || profile.is_admin !== true)) {
      subscription.unsubscribe(); gate(root, '관리자만 볼 수 있습니다', 'AI 질문 전체 통계는 승인된 관리자 계정에서만 확인할 수 있습니다.'); return null;
    }
    document.body.classList.add('pa-logged');
    client = window.PA_ASK.create(sb);
    return { sb, session, profile, client, check,
      async verify() {
        check();
        const current = await sb.auth.getSession();
        check();
        if (current.error || !current.data.session || current.data.session.user.id !== owner) {
          invalidate(); check();
        }
        return current.data.session;
      },
      dispose() { stale = true; subscription.unsubscribe(); client.dispose(); }
    };
    } catch (error) { subscription.unsubscribe(); if (client) client.dispose(); throw error; }
  }
  window.PA_ASK_ACCOUNT = { el, count, duration, date, note, button, card, metrics, table, categoryTable, gate, connect };
})();
