/* 설계사 인트라넷: 회원 메뉴의 권한·활성 상태를 유지하며 업무별로 표시합니다.
   이름으로 메뉴를 숨기지 않습니다. 관리자가 숨긴 메뉴와 빈 분류는 데이터에 따라 제외됩니다.
   검색(초성)·계정별 즐겨찾기·승인 요청·본인 정보 수정. */
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
  const N = (t) => el("p", { class: "pa-note" }, t); // 아주 짧은 안내만
  const msg = (t, sub) => el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, t), sub ? el("p", {}, sub) : null);
  const mode = (inside) => { document.body.classList.toggle("pa-logged", !!inside); document.documentElement.classList.remove("pa-in"); }; // 로그인 후: 홈·내 정보 메뉴 표시(html.pa-in 은 첫 화면 전 임시 표시, B7)

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
  // 현재 섹션과 이전 저장 링크를 홈·내 정보 구조로 연결합니다.
  const SECTIONS = ["home", "me", "directory", "news", "pa-favorites"];
  const sectionFor = s => SECTIONS.includes(s) ? s : s === "stats" || s === "info" || /^info-([0-9]|1[01])$/.test(s) ? "home" : null;
  const knownSection = s => !!sectionFor(s);
  const GOTO_KEY = "pa_goto", GOTO_TTL = 30 * 60 * 1000;
  let goto = sectionFor(location.hash.slice(1));
  const saveGoto = (s) => { try { localStorage.setItem(GOTO_KEY, JSON.stringify({ s, t: Date.now() })); } catch {} };
  const takeGoto = () => { try { const v = JSON.parse(localStorage.getItem(GOTO_KEY) || "null"); localStorage.removeItem(GOTO_KEY); return v && knownSection(v.s) && Date.now() - v.t < GOTO_TTL ? sectionFor(v.s) : null; } catch { return null; } };
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
    const mailBox = el("section", { class: "pa-email-login", "aria-labelledby": "pa-email-title" }, el("h3", { id: "pa-email-title" }, "이메일로 로그인"), el("div", { class: "pa-row" }, email, sendBtn));
    // FUNC-FIX A5: 카카오톡 안 브라우저는 구글이 로그인을 막을 수 있음(403 disallowed_useragent) → 구글 버튼 위 안내 + 이메일 로그인 상시 표시.
    //   '다른 브라우저로 열기' 버튼(kakaotalk://web/openExternal, 비공식)은 보조 — 누를 때만, 안 되더라도 안내문은 그대로 남음
    let kakao = null;
    if (KAKAO) {
      const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      kakao = el("div", { class: "pa-kakao", role: "note" },
        el("p", {}, el("b", {}, "카카오톡 안에서는 구글 로그인이 막힐 수 있어요"), ` → 오른쪽 아래 ⋮ → 다른 브라우저로 열기${ios ? "(아이폰은 'Safari로 열기')" : ""}`),
        el("p", { class: "pa-note" }, "다른 브라우저로 옮기기 어려우면 아래 '이메일로 로그인'을 쓰세요."),
        el("a", { class: "g-btn g-btn--ghost g-btn--sm", href: "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href) }, "다른 브라우저로 열기"));
    }
    // FUNC-FIX A3: 만료·이미 쓴 메일 링크로 돌아온 경우(주소는 위에서 정리함)
    let errCard = null;
    if (linkErr) {
      const expired = linkErr.code === "otp_expired" || /expired|email link/i.test(linkErr.desc);
      errCard = el("div", { class: "pa-card pa-banner pa-linkerr", role: "alert" },
        el("h2", { class: "pa-h3" }, expired ? "링크가 만료됐어요 — 새 메일 받기" : "로그인을 마치지 못했어요"),
        el("p", {}, expired ? "로그인 링크는 한 번만, 받은 뒤 정해진 시간 안에만 쓸 수 있어요. 이메일 주소를 넣고 새 메일을 받아 주세요." : "잠시 후 아래에서 다시 로그인해 주세요."),
        expired ? el("div", { class: "pa-row" }, el("button", { class: "g-btn g-btn--pri", type: "button", onclick: () => email.focus() }, "새 메일 받기")) : null);
      linkErr = null; // 한 번만 안내
    }
    // 로그인 소개는 HTML의 고정 글을 보여 줍니다.
    show(el("div", { class: "pa-login" }, errCard,
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, su ? "회원가입 · 로그인" : "로그인"),
        N("구글로 간편 로그인. 처음이라면 가입 신청부터."),
        kakao,
        el("button", { class: "g-btn g-btn--pri g-btn--lg g-wide", type: "button", onclick: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here } }) }, "구글 계정으로 로그인"),
        mailBox,
        out),
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, "가입 → 승인 → 이용"),
        el("ol", { class: "pa-steps" }, el("li", {}, el("b", {}, "가입"), "구글로 로그인 → 이름·소속 본부·휴대폰 입력, 개인정보 동의"),
          el("li", {}, el("b", {}, "승인"), "관리자가 확인하고 등급을 정합니다"),
          el("li", {}, el("b", {}, "이용"), "등급에 맞는 업무 도구가 열립니다 (승인 전에는 🔒)"))),
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

  // 도구 검색(초성)·즐겨찾기·승인 요청
  const OPENCHAT = "https://open.kakao.com/o/sFMF26y";
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } } };
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
  // 승인 대기 회원은 전체 승인 요청 버튼 하나만 표시합니다.
  // 요청은 request_access(null) 1건(S4 SQL: resource_id 빈칸 = 전체 승인 요청). S4 적용 전에는 서버가 거절 → 이유 안내, 적용 후 '요청 접수됨'
  function pendingCard() {
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
    return el("div", { class: "pa-card pa-banner pa-wait" }, el("h2", { class: "pa-h3" }, "승인 대기 중 — 관리자 확인 후 열립니다"),
      el("p", {}, "인트라넷을 둘러보실 수 있지만 🔒 표시 메뉴는 관리자 승인 후 열립니다. 빨리 확인받으려면 승인 요청을 보내 주세요."),
      el("div", { class: "pa-row" }, btn), out);
  }

  const SITE_LINKS = [
    { key: "site:0", name: "보험위키", description: "보장·용어·청구 가이드", url: "http://wiki.primeasset.info/" },
    { key: "site:2", name: "보험노트", description: "보험노트 공식 홈페이지", url: "https://bohumnote.com/" }
  ];
  const WORK = ["영업 준비", "상담·보상", "청약·계약", "정보 공유", "업무 지원"];
  const workFor = r => {
    const n = r.name || "";
    if (/전산|고지|계약|청약/.test(n)) return WORK[2];
    if (/상담|화법|보상|질병|수술|실손|영업비서/.test(n)) return WORK[1];
    if (/자료|공유|질문|카페|뉴스/.test(n)) return WORK[3];
    if (/상품|진단|리크루팅/.test(n)) return WORK[0];
    return WORK[4];
  };
  let renderEpoch = 0;
  async function intranetView(p, banner, epoch, storageOwner) {
    const { data: raw, error } = await sb.rpc("my_menu");
    if (epoch !== renderEpoch) return;
    if (error || !Array.isArray(raw)) return failView("메뉴 목록을 불러오지 못했습니다", error, true);
    // my_menu는 활성 메뉴만 반환합니다. active를 포함하는 응답도 같은 일반 규칙으로 처리합니다.
    const data = raw.filter(r => r.active !== false);
    mode(true);
    const pending = p.status === "pending";
    const status = pending ? "승인 대기" : "승인 완료";
    const favKey = "pa_pinned_tools_v1:" + storageOwner;
    const catalog = [
      ...data.map(r => {
        const product = r.name === "상품통합분석기";
        return { ...r, key: "menu:" + r.id, work: workFor(r),
          url: r.unlocked && r.url ? (product ? "/product/" : r.url) : null, internal: product };
      }),
      ...SITE_LINKS.map(r => ({ ...r, unlocked: true, work: WORK[4] }))
    ];
    const available = r => r.unlocked && r.url;
    const savedPins = store.get(favKey, null);
    const product = catalog.find(r => r.name === "상품통합분석기");
    const defaults = product && available(product) ? [product.key] : [];
    let pins = [...new Set((Array.isArray(savedPins) ? savedPins : defaults)
      .map(k => k === "page:product" && product ? product.key : k)
      .filter(k => catalog.some(r => r.key === k)))];
    let activeWork = "전체";
    const works = WORK.filter(w => catalog.some(r => r.work === w));
    const announce = el("p", { class: "sr", role: "status", "aria-live": "polite" });
    const favoriteGrid = el("div", { class: "pa-work-grid pa-favorite-grid" });
    const directory = el("div", { id: "pa-directory" });
    const hitNote = el("p", { class: "pa-note pa-hit-note", role: "status", "aria-live": "polite" });
    const hits = el("div", { class: "pa-work-grid", id: "pa-search-results" });
    const resultBox = el("section", { class: "pa-search-results", hidden: "", "aria-label": "검색 결과" }, hitNote, hits);
    const q = el("input", { class: "pa-in", id: "pa-q", type: "search", placeholder: "도구 검색 · 초성도 가능", "aria-label": "업무 도구 검색", "aria-keyshortcuts": "/", "aria-controls": "pa-search-results", autocomplete: "off", enterkeyhint: "search" });
    const pinButton = r => el("button", { class: "pa-pin", type: "button", "data-pin-key": r.key, "aria-pressed": String(pins.includes(r.key)), "aria-label": r.name + (pins.includes(r.key) ? " 고정 해제" : " 고정"), onclick: () => {
      const was = pins.includes(r.key);
      pins = was ? pins.filter(k => k !== r.key) : [...pins, r.key];
      const persisted = store.set(favKey, pins);
      document.querySelectorAll("[data-pin-key]").forEach(b => {
        const item = catalog.find(x => x.key === b.dataset.pinKey), on = pins.includes(b.dataset.pinKey);
        b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", item.name + (on ? " 고정 해제" : " 고정")); b.textContent = on ? "★" : "☆";
      });
      drawFavorites();
      announce.textContent = r.name + (was ? " 고정을 해제했습니다." : " 즐겨찾기에 고정했습니다.") + (persisted ? "" : " 저장 공간을 사용할 수 없어 이번 화면에서만 유지됩니다.");
      if (!document.activeElement || document.activeElement === document.body) {
        const buttons = [...document.querySelectorAll("[data-pin-key]")];
        (buttons.find(b => b.dataset.pinKey === r.key && b.getClientRects().length) || document.getElementById("pa-edit-pins")).focus({ preventScroll: true });
      }
    } }, pins.includes(r.key) ? "★" : "☆");
    const tile = r => el("article", { class: "pa-work-card" + (!r.unlocked ? " is-locked" : ""), "data-resource-key": r.key },
      el("div", { class: "pa-work-meta" }, pinButton(r)),
      available(r) ? el("a", { class: "pa-work-link", href: r.url, title: r.description || r.name, "aria-label": r.name + (r.internal ? "" : " (새 창)"), ...(r.internal ? {} : { target: "_blank", rel: "noopener noreferrer" }) }, el("b", {}, r.name), el("span", { class: "pa-open-label", "aria-hidden": "true" }, r.internal ? "→" : "↗")) : el("b", { class: "pa-locked-name" }, r.name),
      !r.unlocked ? el("div", { class: "pa-lock-state" }, el("span", {}, "🔒 승인 후 열림"), pending ? null : r.id != null ? reqBtn(r) : null) : !r.url ? N("주소 준비 중입니다.") : null);
    function drawFavorites() {
      const items = pins.map(k => catalog.find(r => r.key === k)).filter(Boolean);
      favoriteGrid.replaceChildren(...(items.length ? items.map(tile) : [el("p", { class: "pa-empty" }, "도구의 ☆를 눌러 즐겨찾기에 담으세요.")]));
    }
    const filterBar = el("div", { class: "pa-filters", role: "group", "aria-label": "업무별 도구 분류" });
    function drawDirectory() {
      directory.replaceChildren(...works.filter(w => activeWork === "전체" || activeWork === w).map(w => {
        const items = catalog.filter(r => r.work === w);
        return el("section", { class: "pa-work-group", "aria-label": w },
          el("h3", {}, el("span", {}, w), el("small", {}, `${items.length}개`)), el("div", { class: "pa-work-grid" }, ...items.map(tile)));
      }));
    }
    // 적은 메뉴는 한 목록에서 모두 보입니다. 많은 경우에만 비어 있지 않은 분류 버튼을 만듭니다.
    if (catalog.length > 16 && works.length > 1) {
      ["전체", ...works].forEach(w => filterBar.append(el("button", { class: "pa-filter", type: "button", "aria-pressed": String(w === activeWork), onclick: () => {
        activeWork = w;
        [...filterBar.children].forEach(b => b.setAttribute("aria-pressed", String(b.textContent === w)));
        drawDirectory();
      } }, w)));
    } else filterBar.hidden = true;
    function searchTools() {
      const k = q.value.trim().toLowerCase();
      resultBox.hidden = !k; fav.hidden = !!k; browse.hidden = !!k;
      clearSearch.hidden = !k;
      if (!k) { hits.replaceChildren(); return; }
      const terms = k.split(/\s+/).map(choRx);
      const found = catalog.filter(r => {
        const text = `${r.name} ${r.description || ""} ${r.category || ""} ${r.work}`.toLowerCase();
        return terms.every(rx => rx.test(text) || rx.test(text.replace(/\s/g, "")));
      });
      hitNote.textContent = `${found.length}개 찾음`;
      hits.replaceChildren(...(found.length ? found.map(tile) : [el("div", { class: "pa-empty" }, el("b", {}, "검색 결과가 없습니다"), el("p", {}, "다른 이름이나 초성으로 찾아보세요."), el("button", { class: "g-btn g-btn--ghost", type: "button", onclick: () => { q.value = ""; searchTools(); q.focus(); } }, "검색어 지우기"))]));
    }
    q.addEventListener("input", searchTools);
    q.addEventListener("search", searchTools);
    q.addEventListener("keydown", e => { if (e.key === "Escape") { q.value = ""; searchTools(); } });
    const clearSearch = el("button", { class: "pa-search-clear", type: "button", hidden: "", "aria-label": "검색어 지우기", onclick: () => { q.value = ""; searchTools(); q.focus(); } }, "지우기");
    const search = el("div", { class: "pa-home-search" }, el("label", { for: "pa-q" }, "필요한 도구를 찾아보세요"),
      el("div", { class: "pa-search-field" }, q, clearSearch, el("kbd", { "aria-hidden": "true" }, "/")));
    const noticeBody = el("div", { class: "pa-notice-body" }, N("새 소식을 불러오는 중…"));
    const noticeBox = el("section", { class: "pa-home-notice pa-home-block", id: "news", "aria-labelledby": "pa-news-title" }, el("h2", { id: "pa-news-title" }, "새 소식"), noticeBody);
    const loadNotice = async () => {
      noticeBody.replaceChildren(N("새 소식을 불러오는 중…"));
      try {
        const { data: n, error: err } = await sb.from("site_notice").select("text").eq("id", 1).maybeSingle();
        if (err) throw err;
        noticeBody.replaceChildren(el("p", {}, n && String(n.text || "").trim() || "등록된 새 소식이 없습니다."));
      } catch (e) {
        noticeBody.replaceChildren(N("새 소식을 불러오지 못했습니다."), el("button", { class: "pa-text-button", type: "button", onclick: loadNotice }, "다시 시도"));
      }
    };
    const greeting = el("h2", { class: "pa-home-title" }, `${p.name || "회원"}님, 안녕하세요`);
    const accountName = el("b", {}, p.name || "내 계정");
    const head = el("header", { class: "pa-home-head" }, greeting,
      el("a", { class: "pa-account", href: "#me" }, el("span", { class: "pa-account-status" }, status), accountName, el("small", {}, "내 정보 →")));
    const fav = el("section", { id: "pa-favorites", class: "pa-home-block" }, el("div", { class: "pa-section-heading" }, el("h2", {}, "즐겨찾기"), el("a", { href: "#directory", id: "pa-edit-pins" }, "도구 모두 보기 ↓")), favoriteGrid);
    const browse = el("section", { id: "directory", class: "pa-home-block" }, el("div", { class: "pa-section-heading" }, el("h2", {}, "업무 도구")),
      data.length ? null : N("등록된 회원 도구가 없습니다."), filterBar, directory);
    const me = profileCard(p, status, storageOwner, () => { greeting.textContent = `${p.name}님, 안녕하세요`; accountName.textContent = p.name; });
    drawFavorites(); drawDirectory();
    show(announce, el("section", { class: "pa-sec", id: "home" }, head,
      pending ? pendingCard() : banner, search, resultBox, fav, browse, noticeBox), me);
    loadNotice();
    markTab();
    if (goto) { jump(goto); goto = null; }
  }

  function profileCard(p, status, storageOwner, onSave) {
    const summary = el("dl", {});
    const draw = () => summary.replaceChildren(el("dt", {}, "이름"), el("dd", {}, p.name || "-"), el("dt", {}, "소속 본부"), el("dd", {}, p.branch || "-"),
      el("dt", {}, "등급"), el("dd", {}, `${p.grade || "미지정"}${p.is_admin ? " · 관리자" : ""}`), el("dt", {}, "승인 상태"), el("dd", {}, status), el("dt", {}, "계정"), el("dd", {}, p.email || "-"));
    draw();
    const out = el("p", { class: "pa-note", role: "status", "aria-live": "polite" });
    const n = el("input", { class: "pa-in", id: "pa-edit-name", name: "name", value: p.name || "", required: "", autocomplete: "name" });
    const b = el("input", { class: "pa-in", id: "pa-edit-branch", name: "organization", value: p.branch || "", required: "", autocomplete: "organization" });
    const ph = el("input", { class: "pa-in", id: "pa-edit-phone", name: "tel", type: "tel", required: "", autocomplete: "tel", inputmode: "tel" });
    const consent = el("input", { id: "pa-edit-consent", type: "checkbox", required: "" });
    const submit = el("button", { class: "g-btn g-btn--pri", type: "submit" }, "변경 저장");
    const cancel = el("button", { class: "g-btn g-btn--ghost", type: "button", onclick: () => { form.hidden = true; edit.hidden = false; out.textContent = ""; edit.focus(); } }, "취소");
    const form = el("form", { id: "pa-profile-form", class: "pa-profile-form", hidden: "", onsubmit: async e => {
      e.preventDefault();
      if (![n, b, ph].every(x => x.value.trim())) { out.textContent = "이름·소속·연락처를 모두 입력해 주세요."; return; }
      const values = { name: n.value.trim(), branch: b.value.trim(), phone: ph.value.trim(), consent: consent.checked };
      [submit, cancel, n, b, ph, consent].forEach(x => { x.disabled = true; }); submit.textContent = "저장 중…"; out.textContent = "";
      try {
        const { error } = await sb.rpc("complete_profile", { p_name: values.name, p_branch: values.branch, p_phone: values.phone, p_consent: values.consent });
        if (error) throw error;
        p.name = values.name; p.branch = values.branch; p.phone = values.phone;
        draw(); onSave(); form.hidden = true; edit.hidden = false; out.textContent = "내 정보를 저장했습니다."; edit.focus();
      } catch (error) {
        console.debug("[complete_profile]", error);
        out.textContent = isNet(error) ? NET_MSG : hasKo(error.message) ? error.message : "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
      } finally { [submit, cancel, n, b, ph, consent].forEach(x => { x.disabled = false; }); submit.textContent = "변경 저장"; }
    } }, el("div", { class: "pa-profile-fields" },
      el("label", { for: "pa-edit-name" }, "이름", n), el("label", { for: "pa-edit-branch" }, "소속 본부·지사", b), el("label", { for: "pa-edit-phone" }, "휴대폰 번호", ph)),
      el("label", { class: "pa-consent", for: "pa-edit-consent" }, consent, " [필수] 개인정보 수집·이용에 동의합니다. ", el("a", { href: "../privacy/", target: "_blank", rel: "noopener" }, "개인정보처리방침")),
      el("div", { class: "pa-head-btns" }, submit, cancel));
    const edit = el("button", { class: "g-btn g-btn--ghost", type: "button", onclick: async () => {
      edit.disabled = true; out.textContent = "";
      try {
        // my_profile의 기존 응답에는 연락처가 없으므로 본인 행의 연락처만 읽습니다.
        if (p.phone == null) {
          const { data, error } = await sb.from("members").select("phone").eq("id", storageOwner).maybeSingle();
          if (error) throw error;
          p.phone = data && data.phone || "";
        }
        n.value = p.name || ""; b.value = p.branch || ""; ph.value = p.phone || ""; consent.checked = false;
        form.hidden = false; edit.hidden = true; n.focus();
      } catch (error) {
        console.debug("[profile contact]", error);
        out.textContent = isNet(error) ? NET_MSG : "내 정보를 불러오지 못했습니다. 다시 시도해 주세요.";
      } finally { edit.disabled = false; }
    } }, "내 정보 수정");
    return el("section", { class: "pa-sec", id: "me" }, el("h2", { class: "pa-sec-title" }, "내 정보"),
      el("div", { class: "pa-card pa-me" }, summary, form, out,
        el("div", { class: "pa-head-btns" }, edit, p.is_admin ? el("a", { class: "g-btn g-btn--ghost", href: "admin/" }, "관리자 화면") : null, logoutBtn()),
        N("즐겨찾기는 이 브라우저에 저장됩니다.")));
  }
  // FUNC-FIX A4: 그린 뒤 그 칸으로(고정 메뉴 높이는 .pa-sec scroll-margin-top). 글꼴이 늦게 와 높이가 바뀌면 사용자가 안 움직였을 때만 한 번 더 맞춤
  function jump(id, moveFocus = false) {
    id = sectionFor(id) || id;
    const t = document.getElementById(id);
    if (!t) return;
    if (location.hash !== "#" + id) history.replaceState(null, "", location.pathname + "#" + id);
    markTab();
    if (t.tagName === "DETAILS") t.open = true;
    if (moveFocus) {
      const focus = t.querySelector("summary, h2, h3, h4") || t;
      if (focus.tagName !== "SUMMARY") focus.setAttribute("tabindex", "-1");
      focus.focus({ preventScroll: true });
    }
    if (id === "home") { window.scrollTo({ top: 0, behavior: "instant" }); return; } // 홈은 맨 위 그대로(이름 줄·새 소식이 보이게)
    const go = () => t.scrollIntoView({ block: "start", behavior: "instant" });
    go();
    const y = Math.round(scrollY);
    ((document.fonts && document.fonts.ready) || Promise.resolve()).then(() => setTimeout(() => { if (Math.abs(scrollY - y) < 3) go(); }, 60));
  }

  // 홈·내 정보의 현재 위치를 표시합니다.
  function markTab() {
    const raw = (location.hash || "#home").slice(1);
    const cur = raw === "me" ? "me" : "home";
    if (cur === "main") return; // 건너뛰기 링크(#main)는 탭 표시를 바꾸지 않음
    document.querySelectorAll("[data-tab]").forEach(a => {
      const on = a.getAttribute("data-tab") === cur; a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
    });
  }
  window.addEventListener("hashchange", () => { markTab(); if (document.body.classList.contains("pa-logged") && knownSection(location.hash.slice(1))) jump(location.hash.slice(1), true); });
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const input = document.getElementById("pa-q");
    if (input) { e.preventDefault(); input.focus(); input.scrollIntoView({ block: "center", behavior: "instant" }); }
  });

  let logged = false;
  async function boot() {
    const epoch = ++renderEpoch;
    const { data: { session }, error: sErr } = await sb.auth.getSession();
    if (epoch !== renderEpoch) return;
    if (!session) {
      if (sErr && isNet(sErr)) return failView("로그인 상태를 확인하지 못했습니다", sErr, false);
      logged = false; requested.clear();
      if (goto) { saveGoto(goto); goto = null; } // 로그인 뒤 이 칸으로(이 기기에 30분)
      return loginView(location.hash === "#signup" ? "처음 오셨나요? 구글 계정이나 이메일로 로그인하면 바로 가입 신청이 됩니다." : "");
    }
    const storageOwner = session.user.id || "local";
    retryOnline = null;
    if (!goto) goto = takeGoto(); // 로그인 전에 가려던 칸
    if (!logged) { logged = true; sb.rpc("record_login", { p_method: (session.user.app_metadata || {}).provider || "", p_agent: navigator.userAgent }); }
    if (location.hash && !knownSection(location.hash.slice(1))) history.replaceState(null, "", location.pathname); // 토큰·가입 주소는 지우고 섹션 주소는 둠
    const { data, error } = await sb.rpc("my_profile");
    if (epoch !== renderEpoch) return;
    const p = data && data[0];
    if (error) return failView("회원 정보를 확인하지 못했습니다", error, true);
    if (!p) return show(msg("회원 정보를 확인하지 못했습니다", "잠시 후 다시 시도해 주세요."), logoutBtn());
    if (!p.profile_done) return profileView(p);
    if (p.status === "suspended") return show(msg("이용이 정지된 계정입니다", "문의는 관리자에게 해 주세요."), logoutBtn());
    if (p.status === "pending") return intranetView(p, null, epoch, storageOwner); // 안내·요청 버튼은 intranetView 가 메뉴 목록과 함께 그림(pendingCard)
    return intranetView(p, /^(게스트|guest)$/i.test(p.grade || "") ? msg("Guest 등급입니다", "🔒 표시 메뉴는 등급이 정해지면 열립니다.") : null, epoch, storageOwner);
  }
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") boot(); });
  boot();
})();
