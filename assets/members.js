/* 프라임에셋 프리미엄 — 회원 로그인·도구 목록 (Supabase). 도구 주소는 이 파일에 없음: 로그인 후 서버(my_resources)가 권한 있는 것만 내려줌 */
(function () {
  const C = window.PA_AUTH || {};
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const box = $("#pa-app");
  const show = (...nodes) => { box.replaceChildren(...nodes); };
  const msg = (t, sub) => el("div", { class: "pa-card" }, el("h3", {}, t), sub ? el("p", {}, sub) : null);

  if (!C.url || !C.anonKey || !window.supabase) {
    show(msg("로그인 준비 중입니다", "관리자가 로그인 서버 설정을 마치면 이 화면에서 구글 계정 또는 이메일로 로그인할 수 있습니다."));
    return;
  }
  const sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  window.PA_SB = sb;
  const here = location.origin + location.pathname;

  function loginView(note) {
    const email = el("input", { type: "email", placeholder: "이메일 주소", class: "pa-in", autocomplete: "email" });
    const out = el("p", { class: "pa-note" }, note || "");
    show(el("div", { class: "pa-card" },
      el("h3", {}, location.hash === "#signup" ? "회원가입 · 로그인" : "설계사 로그인"),
      el("p", {}, "처음이면 로그인하는 순간 가입 신청이 됩니다. 관리자 승인 후 도구가 보입니다."),
      el("button", { class: "lux-btn lux-btn--gold", onclick: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here } }) }, "구글 계정으로 로그인"),
      el("div", { class: "pa-or" }, "또는 이메일 인증"),
      el("div", { class: "pa-row" }, email,
        el("button", { class: "lux-btn lux-btn--ghost", onclick: async () => {
          if (!/^\S+@\S+\.\S+$/.test(email.value)) { out.textContent = "이메일 주소를 확인해 주세요."; return; }
          const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: here } });
          out.textContent = error ? "보내기 실패: " + error.message : "메일함에서 로그인 링크를 눌러 주세요. (스팸함도 확인)";
        } }, "인증 메일 받기")),
      out));
  }

  function profileView(p) {
    const n = el("input", { class: "pa-in", placeholder: "이름" });
    const b = el("input", { class: "pa-in", placeholder: "소속 본부·지사 (예: 188본부)" });
    const ph = el("input", { class: "pa-in", placeholder: "휴대폰 번호", type: "tel" });
    const ok = el("input", { type: "checkbox", id: "pa-consent" });
    const out = el("p", { class: "pa-note" });
    show(el("div", { class: "pa-card" },
      el("h3", {}, "가입 정보 입력"), el("p", {}, `로그인 계정: ${p.email || ""}`), n, b, ph,
      el("label", { class: "pa-consent", for: "pa-consent" }, ok, " [필수] 개인정보 수집·이용에 동의합니다. ",
        el("a", { href: "../privacy/", target: "_blank" }, "개인정보처리방침 보기")),
      el("button", { class: "lux-btn lux-btn--gold", onclick: async () => {
        const { error } = await sb.rpc("complete_profile", { p_name: n.value, p_branch: b.value, p_phone: ph.value, p_consent: ok.checked });
        if (error) out.textContent = error.message; else boot();
      } }, "가입 신청"), out, logoutBtn()));
  }

  const logoutBtn = () => el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm pa-logout", onclick: async () => { await sb.auth.signOut(); boot(); } }, "로그아웃");

  // 인트라넷: 전체 메뉴 이름은 보이고, 권한 없는 항목은 🔒 잠금(주소는 서버가 아예 안 내려줌)
  async function intranetView(p, banner) {
    const { data, error } = await sb.rpc("my_menu");
    if (error) { show(msg("목록을 불러오지 못했습니다", error.message), logoutBtn()); return; }
    const groups = {};
    for (const r of data) (groups[r.category] = groups[r.category] || []).push(r);
    const open = data.filter(r => r.unlocked).length;
    const head = el("div", { class: "pa-card pa-me" },
      el("b", {}, `${p.name || p.email}`), ` · ${p.grade || ""}${p.is_admin ? " · 관리자" : ""} · 열린 메뉴 ${open}/${data.length}`,
      p.is_admin ? el("a", { class: "lux-btn lux-btn--gold lux-btn--sm", href: "admin/" }, "관리자 화면") : null, logoutBtn());
    const links = el("div", { class: "pa-card" }, el("h3", {}, "바로가기"), el("ul", { class: "pa-list" },
      el("li", {}, el("a", { href: "http://wiki.primeasset.info/", target: "_blank", rel: "noopener" }, "보험위키"), el("small", {}, " — 보장·용어·청구 가이드")),
      el("li", {}, el("a", { href: "https://188.primeasset.info/", target: "_blank", rel: "noopener" }, "188 영업지원시스템")),
      el("li", {}, el("a", { href: "https://bohumnote.com/", target: "_blank", rel: "noopener" }, "보험노트"))));
    const cards = Object.entries(groups).map(([cat, rs]) => el("div", { class: "pa-card" }, el("h3", {}, cat),
      el("ul", { class: "pa-list" }, ...rs.map(r => el("li", { class: r.unlocked ? "" : "pa-locked" },
        r.unlocked ? (r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.name) : el("span", {}, r.name + " (준비 중)"))
                   : el("span", { title: "승인·권한이 필요합니다" }, "🔒 " + r.name),
        r.description ? el("small", {}, " — " + r.description) : null)))));
    show(...(banner ? [banner] : []), head, links, ...cards);
  }

  let logged = false;
  async function boot() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return loginView(location.hash === "#signup" ? "처음 오셨나요? 구글 계정이나 이메일로 로그인하면 바로 가입 신청이 됩니다." : "");
    if (!logged) { logged = true; sb.rpc("record_login", { p_method: (session.user.app_metadata || {}).provider || "", p_agent: navigator.userAgent }); }
    if (location.hash) history.replaceState(null, "", location.pathname);
    const { data, error } = await sb.rpc("my_profile");
    const p = data && data[0];
    if (error || !p) return show(msg("회원 정보를 확인하지 못했습니다", error ? error.message : "잠시 후 다시 시도해 주세요."), logoutBtn());
    if (!p.profile_done) return profileView(p);
    if (p.status === "suspended") return show(msg("이용이 정지된 계정입니다", "문의는 관리자에게 해 주세요."), logoutBtn());
    if (p.status === "pending") return intranetView(p, msg("승인 대기 중입니다", "인트라넷을 둘러보실 수 있지만 🔒 표시 메뉴는 관리자 승인 후 열립니다."));
    return intranetView(p, /^(게스트|guest)$/i.test(p.grade || "") ? msg("Guest 등급입니다", "🔒 표시 메뉴는 등급이 정해지면 열립니다.") : null);
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") boot(); });
  boot();
})();
