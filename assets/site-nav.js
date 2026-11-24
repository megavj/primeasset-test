/* 공개·회원 페이지 공통 메뉴. 저장 세션은 표시용이며 권한은 기존 my_profile/RLS가 판정합니다.
   공개 페이지는 SDK를 추가 로드하지 않습니다. 로그아웃을 누를 때만 로컬 SDK를 읽습니다. */
(function () {
  'use strict';
  const header = document.querySelector('[data-site-nav]');
  if (!header) return;
  const config = window.PA_AUTH || {};
  const sessionKey = /^sb-[a-z0-9]+-auth-token$/;
  const path = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  const isMembers = path === '/members';
  const kakao = '<svg class="g-kakao-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="#F5D75F" d="M12 3C6.48 3 2 6.47 2 10.75c0 2.75 1.85 5.17 4.65 6.54l-1.02 3.76c-.09.33.29.59.57.4l4.48-2.98c.43.04.87.06 1.32.06 5.52 0 10-3.48 10-7.78S17.52 3 12 3Z"/></svg>';
  const link = (key, href, label, extra = '') => '<a data-nav-key="' + key + '" href="' + href + '" ' + extra + '>' + label + '</a>';
  header.innerHTML = '<div class="g-bar pa-nav-bar">' +
    '<a class="g-logo" href="/"><img class="g-mark g-mark--shield" src="/assets/logo.svg" alt="" width="30" height="33"><span>프라임에셋 프리미엄</span></a>' +
    '<button id="pa-nav-toggle" type="button" aria-controls="pa-nav-menu" aria-expanded="false"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>메뉴</span></button>' +
    '<nav id="pa-nav-menu" aria-label="주요 메뉴">' +
    (isMembers ? '' : link('home', '/', '홈')) + link('performance', '/performance/', '실적보드') + link('qa', '/qa/', '보험자료') + link('wiki', '/wiki/', '보험위키') +
    link('intranet', '/members/#home', '설계사 인트라넷', 'hidden') + link('me', '/members/me/', '내 정보', 'hidden') +
    link('admin', '/members/admin/', '관리자', 'hidden') +
    '<button data-nav-key="install" class="g-menu-install" type="button" hidden>앱 설치</button>' +
    link('join', 'https://open.kakao.com/o/sFMF26y', kakao + '<span>합류문의</span>', 'target="_blank" rel="noopener"') +
    link('login', '/members/#login', '로그인') +
    '<button data-nav-key="logout" id="pa-nav-logout" type="button" hidden>로그아웃</button></nav></div>' +
    '<p id="pa-nav-status" role="status" aria-live="polite" hidden></p>';
  const menu = document.getElementById('pa-nav-menu');
  const toggle = document.getElementById('pa-nav-toggle');
  const logout = document.getElementById('pa-nav-logout');
  const status = document.getElementById('pa-nav-status');
  const tabs = document.querySelector('[data-site-tabs]');
  if (tabs) {
    tabs.innerHTML = '<div class="g-bar">' + link('home', '/', '홈') + link('intranet', '/members/#home', '인트라넷') + link('me', '/members/me/', '내 정보') + '</div>';
  }
  let session = null, admin = false, incomplete = false, roleToken = '', roleTime = 0, roleEpoch = 0, authClient = null, sdkPromise = null;
  function readSession() {
    try {
      const project = config.url && new URL(config.url).hostname.split('.')[0];
      const expected = project ? 'sb-' + project + '-auth-token' : '';
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!sessionKey.test(key) || (expected && key !== expected)) continue;
        let value;
        try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { continue; }
        if (value && value.access_token && (value.refresh_token || !value.expires_at || value.expires_at * 1000 > Date.now() - 86400000)) return value;
      }
    } catch (_) { /* 저장이 차단되어도 공개 메뉴는 사용할 수 있습니다. */ }
    return null;
  }
  function currentKey() {
    if (path === '/') return 'home';
    if (path === '/performance') return 'performance';
    if (path === '/qa' || path.startsWith('/qa/')) return 'qa';
    if (path === '/wiki' || path.startsWith('/wiki/')) return 'wiki';
    if (path === '/members/admin' || path.startsWith('/members/admin/')) return admin ? 'admin' : '';
    if (path === '/members/me') return session ? 'me' : 'login';
    if (isMembers) return session ? (location.hash === '#me' ? 'me' : 'intranet') : 'login';
    return '';
  }
  function render() {
    // 가입정보 입력 전(profile_done=false)에는 로그인 전처럼 보이되 로그인·로그아웃 버튼은 숨깁니다(이사 지시: 가입 화면에 로그아웃 없음).
    const inside = !!session && !incomplete;
    for (const key of ['intranet', 'me', 'logout']) menu.querySelector('[data-nav-key="' + key + '"]').hidden = !inside;
    for (const key of ['join', 'login']) menu.querySelector('[data-nav-key="' + key + '"]').hidden = !!session;
    menu.querySelector('[data-nav-key="admin"]').hidden = !(inside && admin);
    header.dataset.auth = inside ? (admin ? 'admin' : 'member') : 'guest';
    if (tabs) tabs.hidden = !inside;
    const current = currentKey();
    [header, tabs].filter(Boolean).forEach(root => root.querySelectorAll('[data-nav-key]').forEach(item => {
      const selected = !item.hidden && item.dataset.navKey === current;
      item.classList.toggle('on', selected);
      if (selected) item.setAttribute('aria-current', isMembers && inside ? 'location' : 'page');
      else item.removeAttribute('aria-current');
    }));
  }
  // 2026-11-24 이사님 지시: 로그인만 하고 가입 정보(이름·휴대폰·소속)를 넣지 않은 회원에게 안내 팝업 → 정보 입력 화면으로 이동.
  // 페이지마다 한 번만 띄웁니다. 개인정보처리방침 페이지는 동의 전에 읽어야 하므로 띄우지 않습니다.
  let prompted = false;
  function promptProfile() {
    if (prompted || path === '/privacy' || typeof HTMLDialogElement !== 'function') return;
    prompted = true;
    // 다른 페이지 팝업에서 '정보 입력하러 가기'로 넘어온 경우엔 입력 화면에서 같은 팝업을 다시 띄우지 않습니다.
    try { if (isMembers && sessionStorage.getItem('pa_profile_prompt_go')) { sessionStorage.removeItem('pa_profile_prompt_go'); return; } } catch (_) {}
    if (!document.getElementById('pa-profile-prompt-style')) {
      const style = document.createElement('link'); style.id = 'pa-profile-prompt-style'; style.rel = 'stylesheet';
      style.href = '/assets/profile-prompt.css?v=20261124-signup2';
      document.head.appendChild(style);
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'pa-profile-prompt';
    dialog.setAttribute('aria-labelledby', 'pa-profile-prompt-title');
    dialog.innerHTML = '<h2 id="pa-profile-prompt-title">가입 정보를 입력해 주세요</h2>' +
      '<p>이름·휴대폰 번호·소속 본부를 입력해야 가입 신청이 접수되고, 승인 후 인트라넷을 사용할 수 있습니다.</p>' +
      '<p class="pa-profile-countdown" role="timer" aria-live="off" hidden></p>' +
      '<button type="button" class="g-btn g-btn--pri g-btn--lg" data-act="go">' + (isMembers ? '정보 입력하기' : '정보 입력하러 가기') + '</button>' +
      (isMembers ? '' : '<button type="button" class="pa-profile-later" data-act="later">나중에 하기</button>');
    dialog.addEventListener('click', event => {
      const act = event.target && event.target.dataset ? event.target.dataset.act : '';
      if (act === 'later') dialog.close();
      if (act !== 'go') return;
      if (!isMembers) { try { sessionStorage.setItem('pa_profile_prompt_go', '1'); } catch (_) {} location.href = '/members/#signup'; return; }
      dialog.close();
      const field = document.getElementById('pa-signup-name');
      if (field) { field.scrollIntoView({ block: 'center' }); field.focus(); }
    });
    let timer = 0;
    dialog.addEventListener('close', () => { clearInterval(timer); dialog.remove(); });
    document.body.appendChild(dialog);
    dialog.showModal();
    // 2026-11-24 이사님 지시: 가입 6시간 안에 정보를 넣지 않으면 자동 거절 — 남은 시간을 보여 줍니다(서버 1분마다 실제 거절).
    const box = dialog.querySelector('.pa-profile-countdown');
    loadDeadline().then(deadline => {
      if (!deadline || !dialog.isConnected) return;
      const end = Date.parse(deadline);
      if (!Number.isFinite(end)) return;
      const two = n => String(n).padStart(2, '0');
      const tick = () => {
        const left = Math.floor((end - Date.now()) / 1000);
        if (left <= 0) { box.textContent = '입력 기한이 지나 가입 신청이 곧 자동 거절됩니다'; clearInterval(timer); return; }
        box.textContent = '자동 거절까지 ' + Math.floor(left / 3600) + '시간 ' + two(Math.floor(left / 60) % 60) + '분 ' + two(left % 60) + '초';
      };
      box.hidden = false; tick(); timer = setInterval(tick, 1000);
    }).catch(() => {});
  }
  async function loadDeadline() {
    if (!session) return null;
    if (window.PA_SB) {
      const response = await window.PA_SB.rpc('signup_reject_deadline');
      if (response.error) throw response.error;
      return response.data;
    }
    const response = await fetch(config.url + '/rest/v1/rpc/signup_reject_deadline', {
      method: 'POST', headers: { apikey: config.anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!response.ok) throw new Error('Deadline unavailable');
    return response.json();
  }
  async function checkRole() {
    if (!session || !config.url || !config.anonKey) return;
    const token = session.access_token;
    if (roleToken === token && Date.now() - roleTime < 60000) return;
    roleToken = token; roleTime = Date.now();
    const epoch = ++roleEpoch;
    try {
      let data;
      if (window.PA_SB) {
        const response = await window.PA_SB.rpc('my_profile');
        if (response.error) throw response.error;
        data = response.data;
      } else {
        const response = await fetch(config.url + '/rest/v1/rpc/my_profile', {
          method: 'POST', headers: { apikey: config.anonKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}'
        });
        if (!response.ok) throw new Error('Profile unavailable');
        data = await response.json();
      }
      if (epoch !== roleEpoch || !session || session.access_token !== token) return;
      admin = !!(data && data[0] && data[0].is_admin && data[0].status === 'active');
      incomplete = !!(data && data[0] && data[0].profile_done === false);
      render();
      if (incomplete) promptProfile();
    } catch (_) {
      if (epoch === roleEpoch) { admin = false; incomplete = false; roleToken = ''; render(); }
    }
  }
  function setSession(next) {
    if ((session && session.user && session.user.id) !== (next && next.user && next.user.id) || !next) {
      admin = false; incomplete = false; roleToken = ''; roleEpoch += 1;
    }
    session = next;
    render();
    // SDK auth callbacks hold the auth lock; role lookup must run after that callback returns.
    setTimeout(checkRole, 0);
  }
  function bindAuth() {
    const sb = window.PA_SB;
    if (!sb || authClient === sb) return;
    authClient = sb;
    sb.auth.onAuthStateChange((event, next) => {
      if (['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) setSession(next);
    });
  }
  // 이사 지시 2026-11-03: 메인에서 로그인하면 모든 페이지에서 로그인 유지. 만료된 출입증은 SDK로 자동 갱신(실패 시 로그아웃 표시).
  let renewing = false;
  function renewIfNeeded(s) {
    if (!s || renewing || window.PA_SB || !s.refresh_token) return;
    if (s.expires_at && s.expires_at * 1000 > Date.now() + 60000) return;
    renewing = true;
    clientForLogout().then(sb => sb.auth.getSession()).catch(() => {}).finally(() => { renewing = false; });
  }
  function refresh() { bindAuth(); const s = readSession(); setSession(s); renewIfNeeded(s); }
  function closeMenu(focus) {
    const restoreFocus = focus || menu.contains(document.activeElement);
    header.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus && toggle.getClientRects().length) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    header.classList.toggle('is-open', open); toggle.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', event => {
    const action = event.target.closest('a,button');
    // The install handler may already have hidden its button before this event bubbles.
    if (action) closeMenu(action.tagName === 'BUTTON');
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && header.classList.contains('is-open')) closeMenu(true); });
  document.addEventListener('click', event => { if (!header.contains(event.target)) closeMenu(false); });
  window.addEventListener('hashchange', render);
  window.addEventListener('pa:profile', () => { roleToken = ''; refresh(); }); // 가입정보 저장 직후 메뉴 갱신
  window.addEventListener('storage', event => { if (event.key === null || sessionKey.test(event.key || '')) refresh(); });
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  async function clientForLogout() {
    if (window.PA_SB) return window.PA_SB;
    if (!config.url || !config.anonKey) throw new Error('Authentication unavailable');
    if (!window.supabase) {
      if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = '/assets/vendor/supabase-2.118.0.js';
        script.onload = resolve; script.onerror = () => { script.remove(); sdkPromise = null; reject(new Error('SDK unavailable')); };
        document.head.appendChild(script);
      });
      await sdkPromise;
    }
    window.PA_SB = window.supabase.createClient(config.url, config.anonKey);
    bindAuth();
    return window.PA_SB;
  }
  logout.addEventListener('click', async () => {
    logout.disabled = true; status.hidden = true;
    try {
      const sb = await clientForLogout();
      const response = await sb.auth.signOut();
      if (response.error) throw response.error;
      if (isMembers) location.replace('/members/');
      else location.reload();
    } catch (_) {
      status.textContent = '로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
      status.hidden = false; logout.disabled = false;
    }
  });
  refresh();
})();
