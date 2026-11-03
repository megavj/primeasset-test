/* 공용: Supabase 클라이언트 준비(로그인 세션 공유). 회원 전용 원문 화면에서 사용. */
window.paClient = window.paClient || (async function () {
  if (window.PA_SB) return window.PA_SB;
  const c = window.PA_AUTH || {};
  if (!c.url || !c.anonKey) throw new Error('auth config missing');
  if (!window.supabase) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = '/assets/vendor/supabase-2.118.0.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  if (!window.PA_SB) window.PA_SB = window.supabase.createClient(c.url, c.anonKey);
  return window.PA_SB;
});
