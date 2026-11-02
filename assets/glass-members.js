/* 프라임에셋 프리미엄 — 회원 로그인·도구 목록 (Supabase). 유리(Liquid Glass) 디자인용: assets/members.js 사본, 화면 배치·클래스만 다름. 3단계: 검색(초성)·최근 쓴 도구·새 소식 배너·승인 요청·막대그래프(assets/glass-chart.js) 추가. Supabase 호출·권한 판정은 그대로(새 함수 request_access 는 없으면 오픈채팅 안내로 대체).
   4단계(web-design-guidelines): 입력칸 이름(aria-label)·autocomplete·inputmode, 보내는 동안 버튼 잠금, 결과 문구 aria-live, 카드 제목은 h2.pa-h3(h1→h2 순서). 호출·인자는 그대로.
   도구 주소는 이 파일에 없음: 로그인 후 서버(my_resources)가 권한 있는 것만 내려줌
   FUNC-FIX-20261102: A1 승인 대기 회원은 메뉴별 버튼 31개 대신 안내 + '승인 요청 보내기' 1개(request_access(null), S4 SQL) + 접힌 메뉴 목록, 거절돼도 오픈채팅 자동 열기 없음.
     A6 '실적 요약'은 공개 실적보드 자료(/performance/ #perf-data)에서 기간·숫자를 읽음(코드에 기간 없음). 화면 꾸밈은 assets/members-ux.css
     A3 오류 안내 한국어(재요청 제한 남은 초·만료 링크·연결 끊김 다시 시도, 영어 원문은 console.debug), A4 주소의 칸 기억 → 그린 뒤 이동·로그인 전 칸은 이 기기에 잠시 저장
     A5 카카오톡 안 브라우저면 구글 버튼 위 안내 + 이메일 로그인 먼저 펼침, B7 불러오는 틀은 members/index.html(첫 show() 때 사라짐) */
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
  const show = (...nodes) => { box.removeAttribute("aria-busy"); document.body.classList.add("pa-hero-off"); box.replaceChildren(...nodes); }; // FUNC-FIX B7: 불러오는 틀은 여기서 통째로 바뀜, 고정 소개 글은 로그인 화면만(아래 loginView)
  const D = () => null; // 개발용 '섹션 설명' 문구는 유리 시안 화면에서 뺌
  const N = (t) => el("p", { class: "pa-note" }, t); // 아주 짧은 안내만
  const msg = (t, sub) => el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, t), sub ? el("p", {}, sub) : null);
  const mode = (inside) => { document.body.classList.toggle("pa-logged", !!inside); document.documentElement.classList.remove("pa-in"); }; // 로그인 후: 4개 메뉴·휴대폰 탭바 표시(html.pa-in 은 첫 화면 전 임시 표시, B7)

  if (!C.url || !C.anonKey || !window.supabase) {
    show(msg("로그인 준비 중입니다", "관리자가 로그인 서버 설정을 마치면 이 화면에서 구글 계정 또는 이메일로 로그인할 수 있습니다."));
    return;
  }
  // FUNC-FIX A3: 메일 링크가 만료·이미 사용됨 등으로 돌아오면 주소에 영어 오류(#error=…&error_description=…)만 붙음 →
  //   Supabase 가 읽기 전에 내용을 기억하고 주소를 정리(새로고침해도 다시 안 뜸), 로그인 화면에 한국어 안내
  const urlP = new URLSearchParams(location.hash.slice(1)), qP = new URLSearchParams(location.search);
  const pick = (k) => urlP.get(k) || qP.get(k) || "";
  let linkErr = pick("error") || pick("error_code") ? { code: pick("error_code"), error: pick("error"), desc: pick("error_description") } : null;
  if (linkErr) { console.debug("[auth redirect error]", linkErr); history.replaceState(null, "", location.pathname); }
  // FUNC-FIX A4: 주소의 칸(#stats·#info·#me·#home)을 지우기 전에 기억 → 화면을 그린 뒤 그 칸으로 이동(첫 1번만, 탭 전환 때 다시 그려도 끌려가지 않음).
  //   로그인 전이면 이 기기에 잠시(30분) 저장했다가 로그인 후 이동. 메인 도구 허브의 자물쇠 카드도 같은 키(pa_goto)에 저장(tool-hub.js). 돌아오는 주소는 그대로 /members/
  const SECTIONS = ["home", "stats", "info", "me"];
  const GOTO_KEY = "pa_goto", GOTO_TTL = 30 * 60 * 1000;
  let goto = SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : null;
  const saveGoto = (s) => { try { localStorage.setItem(GOTO_KEY, JSON.stringify({ s, t: Date.now() })); } catch {} };
  const takeGoto = () => { try { const v = JSON.parse(localStorage.getItem(GOTO_KEY) || "null"); localStorage.removeItem(GOTO_KEY); return v && SECTIONS.includes(v.s) && Date.now() - v.t < GOTO_TTL ? v.s : null; } catch { return null; } };
  const sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  window.PA_SB = sb;
  const here = location.origin + location.pathname;
  // FUNC-FIX A3: 화면에는 한국어만 — 영어 원문(Failed to fetch·rate limit 등)은 console.debug 로만
  const isNet = (e) => !!e && (e.name === "AuthRetryableFetchError" || /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(`${e.message || ""} ${e.details || ""}`) || navigator.onLine === false);
  const isRate = (e) => !!e && (e.status === 429 || /rate_limit|rate limit|only request this after/i.test(`${e.code || ""} ${e.message || ""}`));
  const hasKo = (t) => /[가-힣]/.test(String(t || ""));
  const NET_MSG = "인터넷 연결을 확인하고 다시 시도해 주세요.";
  const KAKAO = /KAKAOTALK/i.test(navigator.userAgent); // FUNC-FIX A5: 카카오톡 안 브라우저(안드로이드·아이폰 공통 표시)
  let retryOnline = null; // 연결 오류 화면이 떠 있으면 연결이 돌아올 때 자동으로 다시 시도
  window.addEventListener("online", () => { if (retryOnline) retryOnline(); });
  function failView(title, error, withLogout) {
    console.debug(`[${title}]`, error);
    const net = isNet(error), m = String((error && error.message) || "");
    const again = el("button", { class: "g-btn g-btn--pri", type: "button", onclick: () => { again.disabled = true; again.textContent = "다시 시도하는 중…"; retryOnline = null; boot(); } }, "다시 시도");
    retryOnline = () => again.click();
    mode(false);
    show(el("div", { class: "pa-card pa-fail", role: "alert" }, el("h2", { class: "pa-h3" }, net ? NET_MSG.replace(/\.$/, "") : title),
      el("p", {}, net ? `${title}. 연결이 돌아오면 '다시 시도'를 눌러 주세요.` : hasKo(m) ? m : "잠시 후 '다시 시도'를 눌러 주세요."),
      el("div", { class: "pa-head-btns" }, again, withLogout ? logoutBtn() : null)));
  }

  function loginView(note) {
    mode(false);
    const email = el("input", { type: "email", name: "email", placeholder: "이메일 주소", class: "pa-in", autocomplete: "email", inputmode: "email", spellcheck: "false", autocapitalize: "off", "aria-label": "이메일 주소" });
    const out = el("p", { class: "pa-note", role: "status" }, note || "");
    const su = location.hash === "#signup";
    // FUNC-FIX A3: 보낸 뒤·429(재요청 제한)면 같은 주소는 남은 초를 버튼에 보여 주며 잠금(다른 주소로 바꾸면 바로 풀림)
    let cool = null, sent = false;
    const sendBtn = el("button", { class: "g-btn g-btn--ghost pa-send", type: "button" }, "인증 메일 받기");
    const tick = () => {
      const left = cool ? Math.ceil((cool.until - Date.now()) / 1000) : 0;
      if (left > 0 && email.value.trim().toLowerCase() === cool.email) { sendBtn.disabled = true; sendBtn.textContent = `다시 보내기 (${left}초)`; return; }
      if (cool && left <= 0) { clearInterval(cool.timer); cool = null; }
      sendBtn.disabled = false; sendBtn.textContent = sent ? "인증 메일 다시 받기" : "인증 메일 받기";
    };
    const coolDown = (sec) => { if (cool) clearInterval(cool.timer); cool = { email: email.value.trim().toLowerCase(), until: Date.now() + sec * 1000, timer: setInterval(tick, 1000) }; tick(); };
    email.addEventListener("input", tick);
    sendBtn.addEventListener("click", async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.value)) { out.textContent = "이메일 주소를 확인해 주세요."; email.focus(); return; }
      sendBtn.disabled = true; sendBtn.textContent = "보내는 중…"; // 요청이 시작된 뒤에만 잠금(두 번 보내기 방지)
      const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: here } });
      if (!error) { sent = true; out.textContent = "메일함에서 로그인 링크를 눌러 주세요. (스팸함도 확인) 메일이 안 오면 1분 뒤 다시 보낼 수 있어요."; coolDown(60); return; }
      console.debug("[signInWithOtp]", error);
      if (isRate(error)) {
        const sec = Math.min(Math.max(Number((String(error.message || "").match(/after (\d+) second/) || [])[1]) || 60, 1), 3600);
        out.textContent = "1분 뒤 다시 보낼 수 있어요. 방금 받은 메일이 있으면 그 메일의 링크를 눌러 주세요."; coolDown(sec); return;
      }
      if (isNet(error)) { out.textContent = NET_MSG; sendBtn.disabled = false; sendBtn.textContent = "다시 시도"; return; }
      out.textContent = /email|address/i.test(`${error.code || ""} ${error.message || ""}`) && error.status === 400 ? "이메일 주소를 확인해 주세요." : "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
      tick();
    });
    const mailBox = el("details", { style: "margin-top:14px" }, el("summary", {}, "구글 계정이 없으면: 이메일로 로그인"), el("div", { class: "pa-row" }, email, sendBtn));
    // FUNC-FIX A5: 카카오톡 안 브라우저는 구글이 로그인을 막을 수 있음(403 disallowed_useragent) → 구글 버튼 위 안내 + 이메일 로그인 먼저 펼침.
    //   '다른 브라우저로 열기' 버튼(kakaotalk://web/openExternal, 비공식)은 보조 — 누를 때만, 안 되더라도 안내문은 그대로 남음
    let kakao = null;
    if (KAKAO) {
      const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      kakao = el("div", { class: "pa-kakao", role: "note" },
        el("p", {}, el("b", {}, "카카오톡 안에서는 구글 로그인이 막힐 수 있어요"), ` → 오른쪽 아래 ⋮ → 다른 브라우저로 열기${ios ? "(아이폰은 'Safari로 열기')" : ""}`),
        el("p", { class: "pa-note" }, "다른 브라우저로 옮기기 어려우면 아래 '이메일로 로그인'을 쓰세요."),
        el("a", { class: "g-btn g-btn--ghost g-btn--sm", href: "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href) }, "다른 브라우저로 열기"));
      mailBox.open = true;
    }
    // FUNC-FIX A3: 만료·이미 쓴 메일 링크로 돌아온 경우(주소는 위에서 정리함)
    let errCard = null;
    if (linkErr) {
      const expired = linkErr.code === "otp_expired" || /expired|email link/i.test(linkErr.desc);
      errCard = el("div", { class: "pa-card pa-banner pa-linkerr", role: "alert" },
        el("h2", { class: "pa-h3" }, expired ? "링크가 만료됐어요 — 새 메일 받기" : "로그인을 마치지 못했어요"),
        el("p", {}, expired ? "로그인 링크는 한 번만, 받은 뒤 정해진 시간 안에만 쓸 수 있어요. 이메일 주소를 넣고 새 메일을 받아 주세요." : "잠시 후 아래에서 다시 로그인해 주세요."),
        expired ? el("div", { class: "pa-row" }, el("button", { class: "g-btn g-btn--pri", type: "button", onclick: () => { mailBox.open = true; email.focus(); } }, "새 메일 받기")) : null);
      if (expired) mailBox.open = true;
      linkErr = null; // 한 번만 안내
    }
    // FUNC-FIX B7: 맨 위 소개 한 줄('가입하면 도구 24개와 실적 자료를 쓸 수 있습니다.')은 members/index.html 의 고정 글(.pa-hero-static)을 보여 줌 — 다시 그리지 않음
    show(el("div", { class: "pa-login" }, errCard,
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, su ? "회원가입 · 로그인" : "로그인"),
        N("구글 계정 버튼 하나로 로그인. 처음이면 로그인하는 순간 가입 신청이 됩니다."),
        kakao,
        el("button", { class: "g-btn g-btn--pri g-btn--lg g-wide", type: "button", onclick: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here } }) }, "구글 계정으로 로그인"),
        mailBox,
        out),
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, "가입 · 승인 · 이용 3단계"),
        el("ol", { class: "pa-steps" }, el("li", {}, el("b", {}, "가입"), "구글로 로그인 → 이름·소속 본부·휴대폰 입력, 개인정보 동의"),
          el("li", {}, el("b", {}, "승인"), "관리자가 확인하고 등급을 정합니다"),
          el("li", {}, el("b", {}, "이용"), "등급에 맞는 AI 도구·실적 자료가 열립니다 (승인 전에는 🔒)"))),
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, "연락처"), N("가입·승인 문의."),
        el("p", {}, "프라임에셋 이사 김상현 · 전화 ", el("a", { href: "tel:010-8714-9262" }, "010-8714-9262"), " · ",
          el("a", { href: "https://open.kakao.com/o/sFMF26y", target: "_blank", rel: "noopener" }, "카카오 오픈채팅")))));
    document.body.classList.remove("pa-hero-off");
  }

  function profileView(p) {
    mode(false);
    const n = el("input", { class: "pa-in", placeholder: "이름", name: "name", autocomplete: "name", "aria-label": "이름" });
    const b = el("input", { class: "pa-in", placeholder: "소속 본부·지사 (예: 188본부)", name: "organization", autocomplete: "organization", "aria-label": "소속 본부·지사" });
    const ph = el("input", { class: "pa-in", placeholder: "휴대폰 번호", type: "tel", name: "tel", autocomplete: "tel", inputmode: "tel", "aria-label": "휴대폰 번호" });
    const ok = el("input", { type: "checkbox", id: "pa-consent" });
    const out = el("p", { class: "pa-note", role: "status" });
    show(el("div", { class: "pa-login" }, el("div", { class: "pa-card" },
      el("h2", { class: "pa-h3" }, "가입 정보 입력"), N("처음 로그인한 분만 보입니다. 이름·소속 본부·휴대폰 번호와 [필수] 개인정보 수집 동의."), el("p", {}, `로그인 계정: ${p.email || ""}`), n, b, ph,
      el("label", { class: "pa-consent", for: "pa-consent" }, ok, " [필수] 개인정보 수집·이용에 동의합니다. ",
        el("a", { href: "../privacy/", target: "_blank" }, "개인정보처리방침 보기")),
      el("div", { class: "pa-head-btns" }, el("button", { class: "g-btn g-btn--pri g-btn--lg", type: "button", onclick: async (ev) => {
        const btn = ev.currentTarget; btn.disabled = true; btn.textContent = "보내는 중…";
        const { error } = await sb.rpc("complete_profile", { p_name: n.value, p_branch: b.value, p_phone: ph.value, p_consent: ok.checked });
        btn.disabled = false; btn.textContent = "가입 신청";
        if (error) { console.debug("[complete_profile]", error); out.textContent = isNet(error) ? NET_MSG : hasKo(error.message) ? error.message + " — 입력 내용을 확인한 뒤 다시 눌러 주세요." : "가입 신청을 보내지 못했어요. 잠시 후 다시 눌러 주세요."; } else boot();
      } }, "가입 신청"), logoutBtn()), out)));
  }

  const logoutBtn = () => el("button", { class: "g-btn g-btn--ghost g-btn--sm pa-logout", type: "button", onclick: async () => { const { error } = await sb.auth.signOut(); if (error) await sb.auth.signOut({ scope: "local" }); boot(); } }, "로그아웃"); // 연결이 끊겨도 이 기기에서는 로그아웃

  // ─── 3단계: 도구 검색(초성)·최근 쓴 도구(이 기기만)·새 소식 배너·잠긴 메뉴 '승인 요청' ───
  const OPENCHAT = "https://open.kakao.com/o/sFMF26y";
  const RECENT_KEY = "pa_recent_tools";   // [{id,name}] 최대 6개 — 주소는 저장하지 않음(권한 목록 my_menu 에서 다시 찾음)
  const NOTICE_KEY = "pa_notice_closed";  // 닫은 새 소식 본문(같은 내용이면 이 기기에서 다시 안 뜸)
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const pushRecent = (r) => store.set(RECENT_KEY, [{ id: r.id, name: r.name }, ...store.get(RECENT_KEY, []).filter(x => x && x.id !== r.id)].slice(0, 6));
  // 한글 초성 검색: 'ㅅㅍ' → 상품… (초성 글자는 그 초성으로 시작하는 모든 음절과 맞음, 나머지 글자는 그대로)
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const choRx = (q) => new RegExp([...q].map(c => { const i = CHO.indexOf(c); if (i < 0) return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const a = 0xAC00 + i * 588; return `[${c}${String.fromCharCode(a)}-${String.fromCharCode(a + 587)}]`; }).join(""));
  const requested = new Set(); // 이 화면에서 이미 요청 보낸 도구 id
  // FUNC-FIX A1: 서버가 요청을 거절해도 오픈채팅을 저절로 열지 않음 — 한국어 이유 + 오픈채팅 링크(누를 때만). 영어 원문은 console 에만(isNet·hasKo 는 위 A3)
  const REQ_WHY = [[/승인된 회원만/, "승인 대기 중인 계정의 요청은 아직 서버가 받지 않도록 설정돼 있어요. 가입 신청은 이미 접수돼 있으니 관리자가 확인하면 열립니다."],
    [/정지/, "이용이 정지된 계정이라 요청할 수 없어요."], [/로그인이 필요/, "로그인이 풀렸어요. 새로고침한 뒤 다시 로그인해 주세요."]];
  function reqFail(out, error) {
    console.debug("[request_access]", error);
    if (isNet(error)) { out.replaceChildren(NET_MSG); return true; }
    const m = String((error && error.message) || "");
    const hit = REQ_WHY.find(([rx]) => rx.test(m));
    const why = hit ? hit[1] : hasKo(m) ? `요청을 보내지 못했어요: ${m}` : "요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
    out.replaceChildren(why, " 급하면 관리자에게 알려 주세요 — ", el("a", { href: OPENCHAT, target: "_blank", rel: "noopener" }, "카카오 오픈채팅 ↗"));
    return false;
  }
  // 잠긴 도구 '승인 요청'(승인된 회원): 서버 함수 request_access(p_resource_id)
  function reqBtn(r) {
    const out = el("small", { class: "pa-req-msg", role: "status" });
    const btn = el("button", { class: "g-btn g-btn--ghost g-btn--sm pa-req", type: "button", onclick: async () => {
      if (requested.has(r.id)) { out.textContent = "이미 요청한 도구입니다. 관리자 확인 중."; return; }
      btn.disabled = true; btn.textContent = "보내는 중…";
      const { data, error } = await sb.rpc("request_access", { p_resource_id: r.id });
      if (!error) {
        requested.add(r.id); btn.textContent = "요청 보냄";
        out.textContent = data === "already" ? "이미 요청한 도구입니다. 관리자 확인 중." : data === "unlocked" ? "이미 열린 도구입니다. 새로고침해 주세요." : "요청을 보냈습니다. 관리자가 확인한 뒤 열립니다.";
        return;
      }
      btn.disabled = false; btn.textContent = reqFail(out, error) ? "다시 시도" : "승인 요청";
    } }, "승인 요청");
    return el("div", { class: "pa-req-row" }, btn, out);
  }
  // 승인 대기 회원: 메뉴별 버튼 31개 대신 안내 + '전체 승인 요청' 버튼 1개 + 접힌 메뉴 목록.
  // 요청은 request_access(null) 1건(S4 SQL: resource_id 빈칸 = 전체 승인 요청). S4 적용 전에는 서버가 거절 → 이유 안내, 적용 후 '요청 접수됨'
  function pendingCard(data) {
    const out = el("p", { class: "pa-note pa-wait-msg", role: "status" });
    const btn = el("button", { class: "g-btn g-btn--pri pa-wait-req", type: "button", onclick: async () => {
      btn.disabled = true; btn.textContent = "보내는 중…"; out.textContent = "";
      const { data: res, error } = await sb.rpc("request_access", { p_resource_id: null });
      if (!error) {
        btn.textContent = "요청 접수됨"; // 접수 뒤에는 잠금(다시 눌러도 서버는 1건만 둠)
        out.textContent = res === "already" ? "이미 승인 요청이 접수돼 있어요. 관리자가 확인 중입니다." : "승인 요청이 접수됐어요. 관리자가 확인한 뒤 열립니다.";
        return;
      }
      btn.disabled = false; btn.textContent = reqFail(out, error) ? "다시 시도" : "승인 요청 보내기";
    } }, "승인 요청 보내기");
    const groups = {};
    for (const r of data) (groups[r.category] = groups[r.category] || []).push(r);
    const list = el("details", { class: "pa-wait-list" }, el("summary", {}, `승인 후 열리는 메뉴 ${data.length}개 보기`),
      ...Object.entries(groups).map(([cat, rs]) => el("div", { class: "pa-wait-cat" }, el("h3", {}, cat, el("small", {}, ` ${rs.length}개`)),
        el("ul", { class: "pa-list" }, ...rs.map(r => el("li", { class: "pa-locked" }, el("span", {}, "🔒 " + r.name), r.description ? el("small", {}, r.description) : null))))));
    return el("div", { class: "pa-card pa-banner pa-wait" }, el("h2", { class: "pa-h3" }, "승인 대기 중 — 관리자 확인 후 열립니다"),
      el("p", {}, "인트라넷을 둘러보실 수 있지만 🔒 표시 메뉴는 관리자 승인 후 열립니다. 빨리 확인받으려면 승인 요청을 보내 주세요."),
      el("div", { class: "pa-row" }, btn), out, list);
  }

  // 인트라넷: 전체 메뉴 이름은 보이고, 권한 없는 항목은 🔒 잠금(주소는 서버가 아예 안 내려줌)
  async function intranetView(p, banner) {
    const { data, error } = await sb.rpc("my_menu");
    if (error) return failView("메뉴 목록을 불러오지 못했습니다", error, true);
    mode(true);
    const pending = p.status === "pending";
    if (pending) banner = pendingCard(data);
    const groups = {};
    for (const r of data) (groups[r.category] = groups[r.category] || []).push(r);
    const open = data.filter(r => r.unlocked).length;
    const head = el("div", { class: "pa-head" },
      el("div", { class: "pa-who" }, el("b", {}, `${p.name || p.email}`), el("span", { class: "pa-grade" }, ` · ${p.grade || ""}${p.is_admin ? " · 관리자" : ""}`), ` · 열린 메뉴 ${open}/${data.length}`),
      el("div", { class: "pa-head-btns" }, p.is_admin ? el("a", { class: "g-btn g-btn--ghost g-btn--sm", href: "admin/" }, "관리자 화면") : null, logoutBtn()));
    const links = el("div", { class: "pa-card" }, el("h3", {}, "바로가기"), D("섹션 설명: 보험위키·188 영업지원시스템·보험노트·프라임에셋 본사·이사님 페이스북·기존 사이트 (메인 '자주 쓰는 링크'에서 옮김)."), el("ul", { class: "pa-list" },
      el("li", {}, el("a", { href: "http://wiki.primeasset.info/", target: "_blank", rel: "noopener" }, "보험위키"), el("small", {}, "보장·용어·청구 가이드")),
      el("li", {}, el("a", { href: "https://188.primeasset.info/", target: "_blank", rel: "noopener" }, "188 영업지원시스템")),
      el("li", {}, el("a", { href: "https://bohumnote.com/", target: "_blank", rel: "noopener" }, "보험노트")),
      el("li", {}, el("a", { href: "http://primeasset.kr/", target: "_blank", rel: "noopener" }, "프라임에셋 본사")),
      el("li", {}, el("a", { href: "https://www.facebook.com/ksh1629", target: "_blank", rel: "noopener" }, "김상현 이사 페이스북")),
      el("li", {}, el("a", { href: "https://www.primeasset.info/", target: "_blank", rel: "noopener" }, "기존 프리미엄 사이트"))));
    // 도구 타일(자주 쓰는 도구·검색 결과·최근 공용). '열기'를 누르면 최근 목록에 기억. 잠긴 것은 🔒 + 승인 요청
    const tile = (r, no) => {
      if (r.unlocked && r.url) return el("a", { class: "pa-tool", href: r.url, target: "_blank", rel: "noopener noreferrer", onclick: () => { pushRecent(r); drawRecent(); } },
        no != null ? el("span", { class: "pa-no" }, no) : el("span", { class: "pa-cat-tag" }, r.category || ""), el("b", {}, r.name), r.description ? el("small", {}, r.description) : null, el("span", { class: "pa-go", "aria-hidden": "true" }, "열기 ↗"));
      return el("div", { class: "pa-tool pa-tool--locked" }, el("span", { class: "pa-cat-tag" }, r.category || ""), el("b", {}, (r.unlocked ? "" : "🔒 ") + r.name), r.description ? el("small", {}, r.description) : null,
        r.unlocked ? el("small", {}, "준비 중") : pending ? el("small", {}, "승인 후 열림") : reqBtn(r));
    };
    const row = (r) => el("li", { class: r.unlocked ? "" : "pa-locked" },
      r.unlocked ? (r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", onclick: () => { pushRecent(r); drawRecent(); } }, r.name) : el("span", {}, r.name + " (준비 중)"))
                 : el("span", { title: "승인·권한이 필요합니다" }, "🔒 " + r.name),
      r.description ? el("small", {}, r.description) : null, r.unlocked ? null : reqBtn(r));
    const cards = Object.entries(groups).map(([cat, rs]) => el("details", { class: "pa-cat", open: "" }, el("summary", {}, cat, el("small", {}, `${rs.filter(r => r.unlocked).length}/${rs.length} 열림`)), D("섹션 설명: 이 분류의 도구·링크. 등급 권한이 있으면 열리고, 없으면 🔒 잠금(주소는 내려오지 않음)."),
      el("ul", { class: "pa-list" }, ...rs.map(row))));
    // 1. 도구 검색 — 맨 위(이름 줄 바로 아래). 입력 즉시 큰 타일로. 이름·설명·분류, 초성 지원, 띄어쓰기로 여러 낱말(모두 포함)
    const q = el("input", { class: "pa-in", id: "pa-q", type: "search", placeholder: "도구 찾기 (예: 상품, 수당, ㅅㅍ)", "aria-label": "도구 검색", autocomplete: "off", enterkeyhint: "search" });
    const hits = el("div", { class: "pa-tools pa-hits", hidden: "" });
    const hitNote = el("p", { class: "pa-note pa-hit-note", hidden: "", "aria-live": "polite" });
    q.addEventListener("input", () => {
      const k = q.value.trim().toLowerCase();
      if (!k) { hits.hidden = hitNote.hidden = true; hits.replaceChildren(); return; }
      const terms = k.split(/\s+/).map(choRx);
      const found = data.filter(r => { const t = `${r.name} ${r.description || ""} ${r.category || ""}`.toLowerCase(); return terms.every(rx => rx.test(t)); });
      hits.replaceChildren(...found.slice(0, 12).map(r => tile(r)));
      hits.hidden = !found.length; hitNote.hidden = false;
      hitNote.textContent = found.length ? `${found.length}개 찾음${found.length > 12 ? " · 앞 12개만 표시" : ""}${found.some(r => !r.unlocked) ? (pending ? " · 🔒는 승인 후 열리는 도구" : " · 🔒는 권한이 필요한 도구(승인 요청 가능)") : ""}` : "찾는 도구가 없습니다.";
    });
    const search = el("div", { class: "pa-card pa-search" }, el("label", { class: "sr", for: "pa-q" }, "도구 검색"), q, hitNote, hits);
    // 2. 최근 쓴 도구 — 이 기기(localStorage)에만 이름·ID 저장. 권한 목록에서 다시 찾아 그리므로 권한이 바뀌면 자동 반영(잠기면 안 보임). 없으면 줄 숨김
    const recentGrid = el("div", { class: "pa-tools" });
    const recent = el("div", { class: "pa-recent", hidden: "" }, el("h2", { class: "pa-sec-title" }, "최근 쓴 도구", el("small", {}, "이 기기에서 연 순서 · 서버에 저장하지 않음")), recentGrid);
    const drawRecent = () => {
      const items = store.get(RECENT_KEY, []).map(it => it && (data.find(x => x.id === it.id) || data.find(x => x.name === it.name))).filter((r, i, a) => r && r.unlocked && r.url && a.indexOf(r) === i);
      recentGrid.replaceChildren(...items.map(r => tile(r))); recent.hidden = !items.length;
    };
    drawRecent();
    const FAV = /상품통합|보장분석|약관|설계|청약|AI/;
    const PRI = [/상품\s*통합/, /수당/, /상품\s*분석/, /전산\s*답변/, /보상/, /자료\s*검색/];
    const ok = data.filter(r => r.unlocked && r.url);
    const favs = [...new Set([...PRI.map(rx => ok.find(r => rx.test(r.name))).filter(Boolean), ...ok.filter(r => FAV.test(r.name) || FAV.test(r.category || "")), ...ok])].slice(0, 6);
    const statsTile = el("a", { class: "pa-tool pa-tool--stats", href: "#stats" }, el("span", { class: "pa-no" }, "표"), el("b", {}, "실적표 바로가기"), el("small", {}, "실적 요약 · 실적 표"), el("span", { class: "pa-go", "aria-hidden": "true" }, "아래로 이동 ↓"));
    const fav = el("div", {}, el("h2", { class: "pa-sec-title" }, "자주 쓰는 AI 도구", el("small", {}, "한 번 누르면 새 창에서 열립니다")),
      D("섹션 설명: 자주 쓰는 AI 도구 6개(상품통합분석기·수당계산기·상품분석기·전산답변기·보상답변기·자료검색기 순). 권한 있는 도구만 보입니다."),
      favs.length ? null : el("p", { class: "pa-note" }, "🔒 승인 후 열립니다."),
      el("div", { class: "pa-tools" }, ...favs.map((r, i) => tile(r, i + 1)), statsTile));
    // 승인 대기: 메뉴 31개 카드·버튼 대신 맨 위 안내 카드(pendingCard) 안의 접힌 목록만
    const allHead = pending ? null : el("div", { class: "pa-card" }, el("h3", {}, "전체 도구 메뉴"), N("등급 권한이 있으면 열리고, 없으면 🔒 잠금 — 옆의 '승인 요청'으로 관리자에게 알릴 수 있습니다."), ...cards);
    // 4. 새 소식 배너 — site_notice 가 있으면 맨 위 유리 배너. 닫으면 같은 내용은 이 기기에서 다시 안 뜸. 없으면 아무것도 없음
    const noticeBox = el("div", { class: "pa-notice-box" });
    if (banner) banner.classList.add("pa-banner");
    // FUNC-FIX A4: 새 소식은 화면을 그리기 전에 받아 둠(나중에 끼어들어 아래가 밀리면 이동한 칸이 어긋남·흔들림)
    const noticeP = sb.from("site_notice").select("text").eq("id", 1).maybeSingle().then(({ data: n }) => {
      const t = n && n.text ? String(n.text).trim() : "";
      if (!t || store.get(NOTICE_KEY, "") === t) return;
      noticeBox.replaceChildren(el("div", { class: "pa-card pa-notice", role: "status" },
        el("span", { class: "pa-notice-ico", "aria-hidden": "true" }, "📣"),
        el("p", {}, el("b", {}, "새 소식"), " ", t),
        el("button", { class: "pa-notice-x", type: "button", "aria-label": "새 소식 닫기", onclick: () => { store.set(NOTICE_KEY, t); noticeBox.replaceChildren(); } }, "×")));
    }, (e) => console.debug("[site_notice]", e));
    const [stats] = await Promise.all([statsCard(), noticeP]);
    const me = el("section", { class: "pa-sec", id: "me" }, el("h2", { class: "pa-sec-title" }, "내 정보"),
      el("div", { class: "pa-card pa-me" }, el("dl", {}, el("dt", {}, "이름"), el("dd", {}, p.name || "-"), el("dt", {}, "등급"), el("dd", {}, `${p.grade || ""}${p.is_admin ? " · 관리자" : ""}`), el("dt", {}, "계정"), el("dd", {}, p.email || "-"), el("dt", {}, "열린 메뉴"), el("dd", {}, `${open}/${data.length}`)),
        el("div", { class: "pa-head-btns" }, p.is_admin ? el("a", { class: "g-btn g-btn--ghost g-btn--sm", href: "admin/" }, "관리자 화면") : null, logoutBtn())));
    show(head, noticeBox, ...(banner ? [banner] : []),
      el("section", { class: "pa-sec", id: "home" }, search, recent, fav, allHead),
      el("section", { class: "pa-sec", id: "stats" }, el("h2", { class: "pa-sec-title" }, "실적"), stats),
      el("section", { class: "pa-sec", id: "info" }, el("h2", { class: "pa-sec-title" }, "자료"), links, ...infoCards()), me);
    markTab();
    if (goto) { jump(goto); goto = null; } // 첫 화면에서 한 번만
  }
  // FUNC-FIX A4: 그린 뒤 그 칸으로(고정 메뉴 높이는 .pa-sec scroll-margin-top). 글꼴이 늦게 와 높이가 바뀌면 사용자가 안 움직였을 때만 한 번 더 맞춤
  function jump(id) {
    const t = document.getElementById(id);
    if (!t) return;
    if (location.hash !== "#" + id) history.replaceState(null, "", location.pathname + "#" + id);
    markTab();
    if (id === "home") return; // 홈은 맨 위 그대로(이름 줄·새 소식이 보이게)
    const go = () => t.scrollIntoView({ block: "start", behavior: "instant" });
    go();
    const y = Math.round(scrollY);
    ((document.fonts && document.fonts.ready) || Promise.resolve()).then(() => setTimeout(() => { if (Math.abs(scrollY - y) < 3) go(); }, 60));
  }

  const INFO = [["교육 방향", ["프리미엄은 개개인의 전문화를 목표로 합니다. 자료 공유, 영업 방향 제시, 영업지원시스템 구성.", "이를 위해 늅늅방·정보방·카페·고무공 등을 운영합니다. 편한 영업보다 전문가가 되고 싶은 분을 지향합니다.", "Q&A: 하루에 얼마나 일하나 → 잘하는 분은 최대한 많이 하려 한다 / 초심 유지 → 생활패턴을 단순화(일-휴식 반복) / 약관 활용 → 외울 때까지 보고 적용 / 약한 세일즈 단계(AP·니즈환기·PT) → 집중 공부·연습 / 마감 앞 실적 부진 → 더 영업한다 / 힘들 때 → 더 영업에 집중한다.", "Q. 영업방법들을 보면 정말 어려운 방법도 많은데 그걸 어떻게 하죠? → 잘하는 분: ??(질문 자체가 이해가 안 됨) / 못하는 분: 쉬운 영업을 찾는다.", "Q. 영업하다 너무 힘들 땐 어떻게 해야 하나요? → 잘하는 분: 힘들지만 더 영업에 집중한다 / 못하는 분: 힘드니 쉰다."], [["https://www.primeasset.info/901c7125-6058-442d-b752-2ea048e4899c", "원문 보기"]]], ["보험정보 공유방 (단톡방)", ["프리미엄 산하 정보공유 단톡방. 누구든 필요한 자료를 공유하는 문화.", "상품자료, 리플렛, 인수기준, 주요 공지·안내, 질병 관련 자료 등. 오래 볼 자료는 정보카페로 옮겨 관리."], [["https://www.primeasset.info/81665774-c58c-409d-b515-1088b13fb755", "원문 보기"]]], ["보험정보 공유 카페", ["약 3,200여 개 보험자료 등록 (2025.12 기준).", "운영 원칙: 오래 보관할 자료 저장 / 보험·세무·보상 등 모든 자료 / 영업 방향·가이드 / 새 버전 나오면 기존 글 갱신 / 관련 글끼리 링크로 연결.", "공부자료: 보험경제뉴스, 추천견적·사례, 온라인영업, 기타영업, 강의·공부자료, 질병 자료, 보상자료, 분쟁사례, 추천강의, 영상자료, 블로그 모음, 상품자료, 기타자료.", "업무자료: 마케팅, 프라임에셋 자료, 시험 응시, 업무(+수납) 매뉴얼, 연락처, 보도자료, 리플렛, 보험이미지.", "손해보험 이슈(현대·메리츠·DB·하나·흥국·농협·한화·롯데·KB·삼성·예별·AIG 등), 생명보험 이슈."], [["https://www.primeasset.info/a2418d63-aa59-4abc-868d-0ec0fb67f6df", "원문 보기"]]], ["익명질문&답변방 (늅늅방)", ["프리미엄만의 익명 질문·답변방. 서로 누구인지 몰라도 묻고 답하는 문화가 자리 잡았습니다. 여러 번 개편을 거쳐 정착."], [["https://www.primeasset.info/9ac86671-1eca-4e19-a200-058d36a57a0c", "원문 보기"]]], ["고급정보 무한공유 (전설의 고무공)", ["리크루팅을 위한 영업지원 시스템. 수백 명의 타사 설계사와 정보 공유·소통. 그 밖의 리크루팅 제도도 준비·지원.", "참여 문의: 김상현 이사 010-8714-9262"], [["https://www.primeasset.info/979bd9c5-1680-4c63-8f6f-478ed8a55704", "원문 보기"]]], ["스탠다드 캠퍼스 (최신 교육시스템)", ["교육 → 자료 → 실행까지 연결된 내부 교육 시스템. 오프라인 강의 월 1회 실전 교육.", "상품저장소·디비저장소: 상품 / 화법 / 매뉴얼 / AI툴 / 디비 / 온라인 / 프로세스 / 이슈사항."], [["https://www.primeasset.info/32eb41e1-af69-80d2-9f2d-f40fc29a3ee5", "원문 보기"]]], ["영업규정집", ["프라임에셋은 영업규정집을 공개합니다(위촉·해촉, 관리자 승격·분할, 수수료, 준법 등). 승격 기준과 수수료 지급 기준이 투명하게 공개된다는 뜻입니다.", "다운로드: 프라임에셋_영업규정집_2024.pdf, 영업규정_요약본_2024.pdf (원문 페이지)"], [["https://www.primeasset.info/b94a8b28-d0cd-43da-9093-2aa713546115", "원문·파일 보기"]]], ["수수료 / 시책", ["수수료 총량은 원수사 판매실적·지급 방식, 대리점의 지급 방식(선지급·총량·시책)에 따라 달라집니다. 지급 방식 공개 여부, 매달 수수료표 공유, 급여 역계산 가능 여부를 확인해야 합니다.", "프라임에셋: 본사가 관리자·설계사에게 직접 급여 지급(중간관리자가 손댈 수 없음) / 매달 엑셀 수수료표·시책규정·영업규정 공개 / 상위 관리자와 지급률 협의 가능 / 본사전략시상으로 법인시상의 최대 190% 추가지급(본부장 30%, 지사장 60%, 설계사 100%) / 팜스에서 급여명세서 발행, 모든 계약 수수료·시책 원 단위 역추적 / 프라임 선지급제도.", "자료: 보험모집수수료(연동·고정지급률, 생보·손보, FC소득 예시), 증원수수료, 본부장·지사장 수수료(영업관리·분할·공헌), 시상. 수수료홍보자료(생명 2022.08, 손해 2023.09), 2023 영업규정집."], [["https://www.primeasset.info/f111be50-47d9-4f0a-97b7-922fa1af11cf", "원문·파일 보기"]]], ["승격 기준", ["직급: 설계사 - 팀장 - 지사장 - 본부장. 영업규정 조건을 만족하면 자동 승격(상위 관리자가 임의로 못 바꿈).", "팀장: 분기 전환성적 5천만 원(산하 합산 월납 약 100만 원 내외) / 지사장: 총인원 7명 이상 + 분기 전환성적 2억 원(월납 약 400만 원) / 본부장: 총인원 20명 이상 + 4분기 내 2분기 합산 전환성적 12억 원 이상(월납 약 1천만 원).", "설계사는 기본 연동지급률, 상위 관리자와 고정지급률 협의 가능. 신입·경력에 따라 직급·수수료 일부 조정 가능."], [["https://www.primeasset.info/19db7b3d-38fd-451c-a185-0b9d2670b182", "원문 보기"]]], ["프라임에셋은 어떤 곳인가요", ["초대형 GA, 1만여 명 설계사가 근무하는 독립법인. 소개·연혁·재무정보·판매회사, 공정성·투명성·지속성, 밸류체인, 수수료, CEO 메시지, 지표 및 현황."], [["https://www.primeasset.info/ee68e65a-2196-4af3-9236-0dbfba91ade7", "원문 보기"], ["http://primeasset.kr/", "프라임에셋 본사 사이트"]]], ["본사 지원 시스템", ["본사 조직도와 담당 연락처가 산하 설계사에게 공개됩니다.", "준법감시팀(금소법·심의), 인사행정팀(자격시험·협회등록·위촉), 계약관리팀(생손보 30개사 전담), 영업지원팀(복리후생·영업자료), 경영관리팀(수수료·시책 정산), 리스크관리팀, 재무관리팀, 교육지원팀(직급별·온라인 교육, 상품비교), 시스템지원팀, 미래상상팀.", "본사교육: 직급별(프라임입문·팀장리더십·지사장조직관리·본부장 본부운영), 테마별(신입 FC 입문, 인보험 마스터, 원수사별 심화, 외부강사, 보상특강), 온라인(원데이테마, 수요클래스, 유튜브 라이브 월간프라임, 관리자양성)."], [["https://www.primeasset.info/26b3958c-c24d-4767-9871-0515e8dd8d85", "원문 보기"]]], ["자료 모음", ["보험 카테고리: 보험 일을 하면서 필요한 상품·영업·지식·보상 등의 목적별 분류입니다. 이 카테고리에 있는 항목이 대부분의 보험영업에서 필요한 기초가 됩니다. 큰 분류와 작은 분류까지 실제 사례와 접목해 풀어 나갈 수 있게 하는 것이 목적이며, 책의 목차 같은 역할을 합니다. 파일: 보험 카테고리_바탕화면.zip(바탕화면용 이미지 압축파일), 보험 카테고리_화이트ver.pdf(교육용 출력 파일) — 원문 페이지에서 받습니다.", "프라임에셋 2024 브로슈어(PDF), 프라임에셋 입사설명회(2025.05), 보험 카테고리(바탕화면 이미지·출력용 PDF), 나를 돌아보는 시간(오늘의 한마디), 프리미엄 최신보험뉴스 안내, 2023 연말결산 자료."], [["https://www.primeasset.info/d6e84c39-d252-4882-b12e-1fde5e94ea76", "브로슈어"], ["https://www.primeasset.info/95e25396-d707-4032-b0b9-8353613b9556", "보험 카테고리"], ["https://www.primeasset.info/07d5cc3b-33c4-4bc5-81c5-b5d0a1064611", "나를 돌아보는 시간"], ["tool:최신보험뉴스", "최신보험뉴스 안내"], ["https://drive.google.com/drive/folders/1IHJs1d2D7ia48xYqrqvmngezAxyNhfgy?usp=drive_link", "2023 연말결산(구글 드라이브)"]]]];
  const fmt = (v) => /^-?\d{4,}$/.test(v) && !/^(19|20)\d\d$/.test(v) ? Number(v).toLocaleString("ko-KR") : v; // 연도(2012 등)는 쉼표 없이
  // HOME-29: 'tool:이름' 링크는 서버가 권한 있는 회원에게만 주소를 내려줌(공개 파일에 GAS 주소 없음)
  let myRes = null;
  function toolOr(u, n) {
    if (!u.startsWith("tool:")) return el("a", { href: u, target: "_blank", rel: "noopener" }, n + " ↗");
    const span = el("span", {}, "🔒 " + n + " (도구 권한 필요)");
    (myRes = myRes || sb.rpc("my_menu")).then(({ data }) => {
      const r = (data || []).find(x => x.name === u.slice(5) && x.unlocked && x.url);
      if (r) span.replaceWith(el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, n + " ↗"));
    });
    return span;
  }
  function infoCards() {
    return [el("div", { class: "pa-card" }, el("h3", {}, "프리미엄 안내 자료"),
      N("기존 사이트(www.primeasset.info)의 교육·정보 채널·프라임에셋 제도 안내. 제목을 누르면 펼쳐지고, 파일은 원문 페이지에서 받습니다."),
      ...INFO.map(([t, ps, ls]) => el("details", { class: "pa-card pa-fold" }, el("summary", {}, t), ...ps.map(x => el("p", {}, x)),
        el("p", {}, ...ls.flatMap(([u, n], i) => [i ? " · " : "", toolOr(u, n)])))))];
  }
  // 3. 실적 막대그래프(순수 SVG, assets/glass-chart.js). 표 key별 설정: x=이름 열, s=값 열, mult=원 환산 배수, limit=표의 앞 N줄만, skip=합계 줄 제외, short=가로축 글자 수
  //    숫자는 members_stats 가 내려준 표 값만 씀(새 숫자 없음). 설정에 없는 표는 그래프 없이 표만.
  const CHART = { division_monthly: { x: 0, s: [3, 4], orient: "v", mult: 1000, skip: /합계/ }, division_branches: { x: 1, s: [2], orient: "h", mult: 1000 },
    division_carriers: { x: 1, s: [3], orient: "h", mult: 1000, limit: 10 }, company_yearly: { x: 0, s: [2], orient: "v", mult: 1, short: 4 }, "188_conv_monthly": { x: 0, s: [1], orient: "v", mult: 1 } };
  const num = (v) => { const t = String(v ?? "").replace(/,/g, "").trim(); const n = Number(t); return t && Number.isFinite(n) ? n : null; };
  const colName = (s) => String(s ?? "").replace(/\s*\([^)]*\)\s*$/, "");
  function chartFor(r) {
    const c = CHART[r.key]; if (!c || !window.PA_CHART || !Array.isArray(r.rows) || !Array.isArray(r.cols)) return null;
    let rows = r.rows.filter(row => Array.isArray(row) && !(c.skip && c.skip.test(String(row[c.x]))) && c.s.some(i => num(row[i]) != null));
    if (c.limit) rows = rows.slice(0, c.limit);
    if (rows.length < 2) return null;
    const series = c.s.map(i => ({ name: colName(r.cols[i]), values: rows.map(row => (num(row[i]) || 0) * c.mult) }));
    const title = `${colName(r.cols[c.x])}별 ${series.map(s => s.name).join("·")}${c.limit ? ` — 표의 위 ${rows.length}줄` : ""}`;
    return window.PA_CHART.bars({ labels: rows.map(row => String(row[c.x])), series, orient: c.orient, fmt: window.PA_CHART.won, title, short: c.short,
      note: `막대 단위 억·만 원(표의 ${c.mult === 1000 ? "천원" : "원"} 값 환산). 막대에 올리면 값이 보입니다` });
  }
  // FUNC-FIX A6: '실적 요약' 숫자·기간은 공개 실적보드와 같은 자료(/performance/ 의 #perf-data JSON)에서 읽음 — 코드에 기간·숫자를 적지 않음.
  //   월별 total(천원)·count_total 합 = 누적 월보험료·계약 건수, period·basis 그대로. 못 읽으면 요약 줄만 생략(아래 표는 그대로)
  let perfP = null;
  const perfSummary = () => perfP = perfP || fetch("../performance/", { credentials: "same-origin" }).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(html => {
    const j = JSON.parse(new DOMParser().parseFromString(html, "text/html").getElementById("perf-data").textContent);
    const sum = (a) => (a || []).reduce((x, y) => x + (Number(y) || 0), 0);
    const totalK = sum(j.total), count = sum(j.count_total);
    return totalK > 0 ? { period: String(j.period || ""), basis: String(j.basis || ""), totalK, count, eok: (totalK / 100000).toFixed(2) } : null;
  }).catch(e => { console.debug("[perf-data]", e); return null; });
  async function statsCard() {
    const { data, error } = await sb.rpc("members_stats");
    const card = el("div", { class: "pa-card" }, el("h3", {}, "실적 요약 · 실적 표"),
      N("승인된 회원만 표가 열립니다. 설계사 개인 이름 없음."));
    if (error || !data) { card.append(el("p", { class: "pa-note", role: "status" }, "자료를 불러오지 못했습니다. 새로고침해 주세요.")); return card; }
    const dm = data.find(r => r.unlocked && r.key === "division_monthly");
    const pb = dm ? await perfSummary() : null; // 승인 회원(사업부 표가 열린 회원)에게만, 전처럼
    if (pb) card.append(el("div", { class: "pa-card" }, el("h3", {}, "실적 요약"),
      el("p", { class: "pa-stat-sum" }, `사업부 ${pb.period} 누적: 월보험료 `, el("b", {}, `${pb.eok}억`), ` (${fmt(String(pb.totalK))}천원) · 계약 ${fmt(String(pb.count))}건`),
      el("p", { class: "pa-note" }, `기준: ${pb.basis} — 공개 `, el("a", { href: "../performance/" }, "실적보드"), "와 같은 숫자입니다. 표는 펼쳐져 있습니다. 아래 표의 기간은 각 표 제목을 따릅니다.")));
    for (const r of data) {
      if (!r.unlocked) { card.append(el("div", { class: "pa-card pa-locked" }, el("span", { title: "승인·권한이 필요합니다" }, "🔒 " + r.title))); continue; }
      const t = el("table", { class: "pa-table" }, el("thead", {}, el("tr", {}, ...r.cols.map(c => el("th", {}, c)))),
        el("tbody", {}, ...r.rows.map(row => el("tr", {}, ...row.map(v => el("td", {}, fmt(v)))))));
      card.append(el("details", { class: "pa-card", open: "" }, el("summary", {}, r.title + ` (${r.rows.length}줄)`), r.note ? el("p", { class: "pa-note" }, r.note) : null, chartFor(r), el("p", { class: "pa-note pa-swipe" }, "← 옆으로 밀어 보기"), el("div", { class: "pa-scroll" }, t)));
    }
    return card;
  }

  // 메뉴(홈·실적·자료·내 정보) 현재 위치 표시 — 배치용, 데이터와 무관
  function markTab() {
    const cur = (location.hash || "#home").slice(1);
    if (cur === "main") return; // 건너뛰기 링크(#main)는 탭 표시를 바꾸지 않음
    document.querySelectorAll("[data-tab]").forEach(a => a.classList.toggle("on", a.getAttribute("data-tab") === cur));
  }
  window.addEventListener("hashchange", markTab);

  if (!document.getElementById("pa-swipe-css")) document.head.append(el("style", { id: "pa-swipe-css" }, "@media (min-width: 700px) { .pa-swipe { display: none } }"));
  let logged = false;
  async function boot() {
    const { data: { session }, error: sErr } = await sb.auth.getSession();
    if (!session) {
      if (sErr && isNet(sErr)) return failView("로그인 상태를 확인하지 못했습니다", sErr, false);
      if (goto) { saveGoto(goto); goto = null; } // 로그인 뒤 이 칸으로(이 기기에 30분)
      return loginView(location.hash === "#signup" ? "처음 오셨나요? 구글 계정이나 이메일로 로그인하면 바로 가입 신청이 됩니다." : "");
    }
    retryOnline = null;
    if (!goto) goto = takeGoto(); // 로그인 전에 가려던 칸(메인 허브 자물쇠 카드·/members/#stats 등)
    if (!logged) { logged = true; sb.rpc("record_login", { p_method: (session.user.app_metadata || {}).provider || "", p_agent: navigator.userAgent }); }
    if (location.hash && !SECTIONS.includes(location.hash.slice(1))) history.replaceState(null, "", location.pathname); // 토큰·#signup 은 지우고 칸 주소(#stats 등)는 둠
    const { data, error } = await sb.rpc("my_profile");
    const p = data && data[0];
    if (error) return failView("회원 정보를 확인하지 못했습니다", error, true);
    if (!p) return show(msg("회원 정보를 확인하지 못했습니다", "잠시 후 다시 시도해 주세요."), logoutBtn());
    if (!p.profile_done) return profileView(p);
    if (p.status === "suspended") return show(msg("이용이 정지된 계정입니다", "문의는 관리자에게 해 주세요."), logoutBtn());
    if (p.status === "pending") return intranetView(p, null); // 안내·요청 버튼은 intranetView 가 메뉴 목록과 함께 그림(pendingCard)
    return intranetView(p, /^(게스트|guest)$/i.test(p.grade || "") ? msg("Guest 등급입니다", "🔒 표시 메뉴는 등급이 정해지면 열립니다.") : null);
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") boot(); });
  boot();
})();
