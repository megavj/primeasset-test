/* 보험자료: 가입 정보가 확인된 승인 회원만 실명본(qa_member_posts, RLS 보호)을 봅니다.
   계정 변경·조회 실패 때는 공개본을 유지하고, 이전 계정의 비동기 응답은 표시하지 않습니다. */
(function () {
  const m = location.pathname.match(/^\/qa\/([a-z0-9-]+)\/?$/);
  if (!m) return;
  const slug = m[1].replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const body = document.querySelector('#qa-article .qa-article-body');
  const h1 = document.querySelector('#qa-article h1');
  if (!body) return;
  const publicBody = [...body.childNodes].map(node => node.cloneNode(true));
  const publicTitle = h1 && h1.textContent;
  let epoch = 0, owner, note = null;
  function restore(text, href, label) {
    body.replaceChildren(...publicBody.map(node => node.cloneNode(true)));
    if (h1) h1.textContent = publicTitle;
    if (note) { note.remove(); note = null; }
    if (!text) return;
    note = document.createElement('p'); note.className = 'qa-member-note'; note.setAttribute('role', 'status');
    note.append(document.createTextNode(text));
    if (href) { const link = document.createElement('a'); link.href = href; link.textContent = label; note.append(' ', link); }
    body.before(note);
  }
  function invalidate() {
    epoch++;
    restore('로그인 정보가 바뀌어 공개 자료를 표시합니다.', '/members/#login', '다시 로그인');
  }
  // 로그인 기록이 없으면 공개본을 유지하며 SDK를 추가로 읽지 않습니다.
  try {
    let has = false;
    for (let i = 0; i < localStorage.length && !has; i += 1) {
      const key = localStorage.key(i);
      if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      has = !!(value && (value.access_token || value.refresh_token));
    }
    if (!has) return;
  } catch (_) { /* 저장소가 차단되어도 SDK로 로그인 상태 확인 */ }
  async function sameSession(sb, generation) {
    if (generation !== epoch) return false;
    const current = await sb.auth.getSession();
    if (generation !== epoch) return false;
    if (current.error || !current.data.session || current.data.session.user.id !== owner) { invalidate(); return false; }
    return true;
  }
  async function run() {
    let sb;
    try { sb = await window.paClient(); } catch (_) { return; }
    const generation = ++epoch;
    sb.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      const nextOwner = session && session.user ? session.user.id : null;
      if (owner === undefined || nextOwner !== owner) invalidate();
    });
    try {
      const response = await sb.auth.getSession();
      if (generation !== epoch) return;
      const session = response.data && response.data.session;
      if (response.error || !session) return;
      owner = session.user.id;
      const signup = window.PA_SIGNUP;
      if (!signup) return;
      const member = await sb.rpc('my_profile').setHeader('Authorization', 'Bearer ' + session.access_token);
      if (generation !== epoch) return;
      if (member.error) throw member.error;
      const profile = await signup.resolveProfile(sb, member.data && member.data[0], session);
      if (!await sameSession(sb, generation)) return;
      if (!signup.complete(profile)) {
        restore('이름·휴대폰·소속 본부와 개인정보 동의를 입력한 뒤 회원 전용 자료를 이용할 수 있습니다.', '/members/#signup', '가입 정보 입력'); return;
      }
      if (profile.status !== 'active') {
        restore('회원 전용 원문은 가입 승인 후 볼 수 있습니다.', '/members/#home', '승인 상태 확인'); return;
      }
      const { data, error } = await sb.from('qa_member_posts').select('question,body_html').eq('slug', slug).maybeSingle().setHeader('Authorization', 'Bearer ' + session.access_token);
      if (!await sameSession(sb, generation)) return;
      if (error || !data || !data.body_html) return;
      const tpl = document.createElement('template'); tpl.innerHTML = data.body_html;
      tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(node => node.remove());
      tpl.content.querySelectorAll('*').forEach(node => [...node.attributes].forEach(attr => node.removeAttribute(attr.name)));
      body.replaceChildren(tpl.content);
      if (h1 && data.question) h1.textContent = data.question;
      note = document.createElement('p'); note.className = 'qa-member-note';
      note.textContent = '회원 전용: 실제 회사·상품명이 표시된 내부용 원문입니다. 외부 공유 금지.';
      body.before(note);
    } catch (_) {
      if (generation === epoch) restore('회원 정보를 확인하지 못해 공개 자료를 표시합니다. 잠시 후 다시 열어 주세요.');
    }
  }
  run();
})();
