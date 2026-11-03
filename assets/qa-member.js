/* 보험자료: 승인된 로그인 회원에게만 실명본(qa_member_posts, RLS 보호)을 보여 준다. 없으면 공개본 그대로. */
(function () {
  const m = location.pathname.match(/^\/qa\/([a-z0-9-]+)\/?$/);
  if (!m) return;
  const slug = m[1].replace(/^\d{4}-\d{2}-\d{2}-/, '');
  let tries = 0;
  async function run() {
    let sb; try { sb = await window.paClient(); } catch (e) { return; }
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      const { data, error } = await sb.from('qa_member_posts').select('question,body_html').eq('slug', slug).maybeSingle();
      if (error || !data || !data.body_html) return;
      const body = document.querySelector('#qa-article .qa-article-body');
      const h1 = document.querySelector('#qa-article h1');
      if (!body) return;
      const tpl = document.createElement('template'); tpl.innerHTML = data.body_html;
      tpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());
      tpl.content.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => n.removeAttribute(a.name)));
      body.replaceChildren(tpl.content);
      if (h1 && data.question) h1.textContent = data.question;
      const note = document.createElement('p'); note.className = 'qa-member-note';
      note.textContent = '회원 전용: 실제 회사·상품명이 표시된 내부용 원문입니다. 외부 공유 금지.';
      body.before(note);
    } catch (e) { /* 공개본 유지 */ }
  }
  run();
})();
