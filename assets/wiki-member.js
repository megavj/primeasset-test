/* 보험위키 설계사 전용 원문: 승인 회원만(wiki_member_sections, RLS). */
(function () {
  const msg = document.getElementById('wm-msg'), list = document.getElementById('wm-list');
  let epoch = 0;
  function gate(text) {
    msg.replaceChildren(document.createTextNode(text + ' '));
    const link = document.createElement('a'); link.href = '/members/#signup'; link.textContent = '로그인·가입 정보 입력'; msg.append(link);
    list.replaceChildren(window.PA_SIGNUP.guide());
  }
  const clean = (html) => { const t = document.createElement('template'); t.innerHTML = html || '';
    t.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
    t.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => n.removeAttribute(a.name))); return t.content; };
  async function run() {
    let sb; try { sb = await window.paClient(); } catch (e) { msg.textContent = '잠시 후 다시 열어 주세요.'; return; }
    let owner;
    sb.auth.onAuthStateChange((event, session) => {
      if (owner === undefined || event === 'INITIAL_SESSION') return;
      if ((session && session.user ? session.user.id : null) !== owner) { epoch++; gate('로그인 정보가 바뀌었습니다. 다시 로그인한 뒤 열어 주세요.'); }
    });
    const generation = ++epoch;
    const { data: { session } } = await sb.auth.getSession();
    if (generation !== epoch) return;
    owner = session && session.user ? session.user.id : null;
    if (!session) { gate('설계사 로그인 후 볼 수 있어요.'); return; }
    try {
      const response = await sb.rpc('my_profile');
      if (response.error) throw response.error;
      const profile = await window.PA_SIGNUP.resolveProfile(sb, response.data && response.data[0], session);
      if (generation !== epoch) return;
      if (!window.PA_SIGNUP.complete(profile)) { gate('이름·휴대폰·소속 본부와 개인정보 동의를 완료해야 가입 신청이 접수됩니다.'); return; }
      if (profile.status !== 'active') { gate('가입 승인된 설계사만 볼 수 있어요. 관리자 승인 후 다시 열어 주세요.'); return; }
    } catch (_) { if (generation === epoch) gate('가입 정보를 확인하지 못했습니다. 잠시 후 다시 열어 주세요.'); return; }
    const { data, error } = await sb.from('wiki_member_sections').select('key,title,body_html').order('key');
    if (generation !== epoch) return;
    if (error) { msg.textContent = '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'; return; }
    if (!data || !data.length) { msg.textContent = '가입 승인된 설계사만 볼 수 있어요. 승인 후 다시 열어 주세요.'; return; }
    msg.textContent = '회원 전용: 외부 공유 금지';
    list.replaceChildren();
    data.forEach(r => { const s = document.createElement('section'); s.id = r.key; s.className = 'qa-section';
      const h = document.createElement('h2'); h.textContent = r.title; s.append(h, clean(r.body_html)); list.append(s); });
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }
  run();
})();
