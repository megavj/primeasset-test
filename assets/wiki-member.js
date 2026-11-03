/* 보험위키 설계사 전용 원문: 승인 회원만(wiki_member_sections, RLS). */
(function () {
  const msg = document.getElementById('wm-msg'), list = document.getElementById('wm-list');
  let tries = 0;
  const clean = (html) => { const t = document.createElement('template'); t.innerHTML = html || '';
    t.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
    t.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => n.removeAttribute(a.name))); return t.content; };
  async function run() {
    const sb = window.PA_SB;
    if (!sb) { if (++tries < 40) return setTimeout(run, 250); msg.textContent = '잠시 후 다시 열어 주세요.'; return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { msg.innerHTML = '설계사 로그인 후 볼 수 있어요. <a href="/members/#login">로그인하기</a>'; return; }
    const { data, error } = await sb.from('wiki_member_sections').select('key,title,body_html').order('key');
    if (error) { msg.textContent = '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'; return; }
    if (!data || !data.length) { msg.textContent = '가입 승인된 설계사만 볼 수 있어요. 승인 후 다시 열어 주세요.'; return; }
    msg.textContent = '회원 전용: 외부 공유 금지';
    data.forEach(r => { const s = document.createElement('section'); s.id = r.key; s.className = 'qa-section';
      const h = document.createElement('h2'); h.textContent = r.title; s.append(h, clean(r.body_html)); list.append(s); });
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }
  run();
})();
