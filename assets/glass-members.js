/* 설계사 인트라넷: 회원 메뉴의 권한·활성 상태를 유지하며 업무별로 표시합니다.
   이름으로 메뉴를 숨기지 않습니다. 관리자가 숨긴 메뉴와 빈 분류는 데이터에 따라 제외됩니다.
   AI 질문·도구 이름(초성) 제안·승인 요청. 기존 즐겨찾기 저장값은 읽거나 지우지 않습니다. */
/* AUDIT-20261103: 다른 사이트가 이 화면을 보이지 않는 액자(iframe)로 띄워 클릭을 유도하는 것(클릭재킹) 방지.
   GitHub Pages는 X-Frame-Options 헤더를 못 주므로, 다른 출처 액자 안이면 화면을 숨긴다. 같은 사이트 안 액자는 허용. */
(function () { try { if (window.top !== window.self && window.top.location.origin !== window.location.origin) throw 0; } catch (e) { document.documentElement.style.display = 'none'; } })();
(function () {
  const C = window.PA_AUTH || {};
  const signup = window.PA_SIGNUP;
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
  let viewKey = null, disposeView = null;
  const show = (...nodes) => { if (disposeView) disposeView(); disposeView = null; viewKey = null; box.removeAttribute("aria-busy"); document.body.classList.add("pa-hero-off"); box.replaceChildren(...nodes); }; // 실제 상태 전환 때만 화면 교체
  const N = (t) => el("p", { class: "pa-note" }, t); // 아주 짧은 안내만
  const msg = (t, sub) => el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, t), sub ? el("p", {}, sub) : null);
  const mode = (inside) => { document.body.classList.toggle("pa-logged", !!inside); document.documentElement.classList.remove("pa-in"); }; // 로그인 후: 홈·내 정보 메뉴 표시(html.pa-in 은 첫 화면 전 임시 표시, B7)

  if (!C.url || !C.anonKey || !window.supabase || !signup) {
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
  const SECTIONS = ["home", "me", "directory", "news"];
  const sectionFor = s => SECTIONS.includes(s) ? s : s === "pa-favorites" ? "directory" : s === "stats" || s === "info" || /^info-([0-9]|1[01])$/.test(s) ? "home" : null;
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
  const digits = value => String(value || "").replace(/\D/g, "");
  const formatPhone = value => {
    const d = digits(value);
    if (d.length <= 3 || d.length > 11) return d;
    if (d.length <= 6) return d.slice(0, 3) + "-" + d.slice(3);
    const middle = d.length > 10 ? 4 : 3;
    return d.slice(0, 3) + "-" + d.slice(3, 3 + middle) + "-" + d.slice(3 + middle);
  };
  const validPhone = value => signup.validPhone(value);
  const PHONE_MSG = "010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.";
  function formatPhoneInput(input) {
    const before = input.value, start = input.selectionStart;
    const count = digits(before.slice(0, start == null ? before.length : start)).length;
    input.value = formatPhone(before);
    if (document.activeElement === input && start != null) {
      let pos = 0, seen = 0;
      while (pos < input.value.length && seen < count) { if (/\d/.test(input.value[pos])) seen++; pos++; }
      input.setSelectionRange(pos, pos);
    }
  }
  function bindPhone(input) {
    input.addEventListener("beforeinput", event => {
      const pos = input.selectionStart;
      if (pos == null || pos !== input.selectionEnd) return;
      const forward = event.inputType === "deleteContentForward" && input.value[pos] === "-";
      const backward = event.inputType === "deleteContentBackward" && input.value[pos - 1] === "-";
      if (!forward && !backward) return;
      event.preventDefault();
      // 자동 하이픈에서 Delete/Backspace가 멈추지 않도록 인접 숫자까지 지웁니다.
      input.setRangeText("", backward ? pos - 2 : pos, forward ? pos + 2 : pos, "end");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.addEventListener("input", () => formatPhoneInput(input));
    input.addEventListener("blur", () => formatPhoneInput(input));
  }
  // 가입 초안은 이 탭 안에서 사용자별로만 보관하며 인증번호·토큰은 저장하지 않습니다.
  const DRAFT_PREFIX = "pa_signup_draft_v1:";
  const draftMemory = new Map();
  function readDraft(owner) {
    if (draftMemory.has(owner)) return draftMemory.get(owner);
    try { return JSON.parse(sessionStorage.getItem(DRAFT_PREFIX + owner) || "null") || draftMemory.get(owner) || {}; }
    catch { return draftMemory.get(owner) || {}; }
  }
  function saveDraft(owner, value) {
    draftMemory.set(owner, value);
    try { sessionStorage.setItem(DRAFT_PREFIX + owner, JSON.stringify(value)); } catch {}
  }
  function clearDraft(owner) {
    draftMemory.delete(owner);
    try { sessionStorage.removeItem(DRAFT_PREFIX + owner); } catch {}
  }
  function clearDrafts() {
    draftMemory.clear();
    try { Object.keys(sessionStorage).filter(k => k.startsWith(DRAFT_PREFIX)).forEach(k => sessionStorage.removeItem(k)); } catch {}
  }
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
    let cool = null, sent = false, sending = false, verifying = false, sentEmail = "", alive = true;
    const sendBtn = el("button", { class: "g-btn g-btn--ghost pa-send", type: "button" }, "인증 메일 받기");
    const token = el("input", { class: "pa-in", id: "pa-otp", name: "token", type: "text", autocomplete: "one-time-code", inputmode: "numeric", pattern: "[0-9]{6,10}", placeholder: "메일로 받은 인증번호", "aria-describedby": "pa-otp-help", enterkeyhint: "done" });
    token.addEventListener("input", () => { token.value = digits(token.value); });
    const verifyBtn = el("button", { class: "g-btn g-btn--pri", type: "submit" }, "확인");
    const otpForm = el("form", { class: "pa-otp-form", hidden: "", novalidate: "", onsubmit: async ev => {
      ev.preventDefault();
      if (sending || verifying) return;
      token.value = digits(token.value);
      if (!/^[0-9]{6,10}$/.test(token.value)) { out.textContent = "메일로 받은 숫자 인증번호를 입력해 주세요."; token.focus(); return; }
      if (!sentEmail || email.value.trim().toLowerCase() !== sentEmail) { out.textContent = "이메일 주소를 확인하고 인증 메일을 먼저 받아 주세요."; return; }
      verifying = true; email.disabled = true; token.disabled = true; verifyBtn.disabled = true; verifyBtn.textContent = "확인 중…"; out.textContent = ""; tick();
      try {
        const { error } = await sb.auth.verifyOtp({ email: sentEmail, token: token.value, type: "email" });
        if (!alive) return;
        if (error) throw error;
        out.textContent = "인증됐어요. 가입 정보를 확인하는 중입니다.";
        boot();
      } catch (error) {
        if (!alive) return;
        console.debug("[verifyOtp]", error);
        out.textContent = isNet(error) ? NET_MSG : isRate(error) ? "인증을 너무 여러 번 시도했어요. 잠시 기다린 뒤 다시 확인해 주세요." :
          /expired|otp_expired/i.test(`${error.code || ""} ${error.message || ""}`) ? "인증번호가 틀렸거나 사용 시간이 지났어요. 번호를 다시 확인하거나 새 인증 메일을 받아 주세요." :
          "인증번호를 확인해 주세요. 가장 최근에 받은 메일의 번호를 입력하고, 계속 안 되면 새 인증 메일을 받아 주세요.";
      } finally {
        verifying = false; email.disabled = false; token.disabled = false; verifyBtn.disabled = false; verifyBtn.textContent = "확인"; tick();
      }
    } }, el("label", { for: "pa-otp" }, "인증번호"),
      el("p", { id: "pa-otp-help", class: "pa-note" }, "메일로 받은 인증번호를 입력하거나, 메일의 링크를 눌러 주세요."),
      el("div", { class: "pa-row" }, token, verifyBtn));
    const tick = () => {
      if (!alive) return;
      if (sending || verifying) { sendBtn.disabled = true; return; }
      const left = cool ? Math.ceil((cool.until - Date.now()) / 1000) : 0;
      if (left > 0 && email.value.trim().toLowerCase() === cool.email) { sendBtn.disabled = true; sendBtn.textContent = `다시 보내기 (${left}초)`; return; }
      if (cool && left <= 0) { clearInterval(cool.timer); cool = null; }
      sendBtn.disabled = false; sendBtn.textContent = sent ? "인증 메일 다시 받기" : "인증 메일 받기";
    };
    const coolDown = (address, sec) => { if (cool) clearInterval(cool.timer); cool = { email: address, until: Date.now() + sec * 1000, timer: setInterval(tick, 1000) }; };
    email.addEventListener("input", () => {
      if (email.value.trim().toLowerCase() !== sentEmail) { otpForm.hidden = true; token.value = ""; }
      else if (sentEmail) otpForm.hidden = false;
      tick();
    });
    const showCode = address => { sentEmail = address; token.value = ""; otpForm.hidden = false; };
    sendBtn.addEventListener("click", async () => {
      if (sending || verifying || sendBtn.disabled) return;
      const address = email.value.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(address)) { out.textContent = "이메일 주소를 확인해 주세요."; email.focus(); return; }
      sending = true; email.disabled = true; verifyBtn.disabled = true; sendBtn.disabled = true; sendBtn.textContent = "보내는 중…";
      try {
        const { error } = await sb.auth.signInWithOtp({ email: address, options: { emailRedirectTo: here } });
        if (!alive) return;
        if (error) throw error;
        sent = true; showCode(address); coolDown(address, 60);
        out.textContent = "인증 메일을 보냈어요. 스팸함도 확인해 주세요. 메일이 안 오면 1분 뒤 다시 받을 수 있어요.";
        token.focus();
      } catch (error) {
        if (!alive) return;
        console.debug("[signInWithOtp]", error);
        if (isRate(error)) {
          const sec = Math.min(Math.max(Number((String(error.message || "").match(/after (\d+) second/) || [])[1]) || 60, 1), 3600);
          showCode(address); coolDown(address, sec);
          out.textContent = "메일을 너무 자주 요청했어요. 버튼에 표시된 시간이 지나면 다시 받을 수 있어요. 이미 받은 메일의 인증번호나 링크도 사용할 수 있어요.";
        } else out.textContent = isNet(error) ? NET_MSG : /email|address/i.test(`${error.code || ""} ${error.message || ""}`) && error.status === 400 ? "이메일 주소를 확인해 주세요." : "메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
      } finally { sending = false; email.disabled = false; verifyBtn.disabled = false; tick(); }
    });
    const mailBox = el("section", { class: "pa-email-login", "aria-labelledby": "pa-email-title" }, el("h3", { id: "pa-email-title" }, "이메일로 로그인"), el("div", { class: "pa-row" }, email, sendBtn), otpForm);
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
        N("구글 계정이나 이메일로 로그인한 뒤, 처음 오신 분은 가입 정보를 입력해 주세요."),
        kakao,
        el("button", { class: "g-btn g-btn--pri g-btn--lg g-wide", type: "button", onclick: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here } }) }, "구글 계정으로 로그인"),
        mailBox,
        out),
      signup.guide(),
      el("div", { class: "pa-card" }, el("h2", { class: "pa-h3" }, "연락처"), N("가입·승인 문의."),
        el("p", {}, "프라임에셋 이사 김상현 · 전화 ", el("a", { href: "tel:010-8714-9262" }, "010-8714-9262"), " · ",
          el("a", { href: "https://open.kakao.com/o/sFMF26y", target: "_blank", rel: "noopener" }, "카카오 오픈채팅")))));
    viewKey = "login";
    disposeView = () => { alive = false; if (cool) clearInterval(cool.timer); };
    document.body.classList.remove("pa-hero-off");
  }

  function profileView(p, owner, key) {
    mode(false);
    const n = el("input", { class: "pa-in", id: "pa-signup-name", placeholder: "이름을 입력해 주세요", name: "name", autocomplete: "name", minlength: "2", maxlength: "60", required: "", "aria-label": "이름" });
    const b = el("select", { class: "pa-in", id: "pa-signup-branch", name: "organization", autocomplete: "organization", required: "", "aria-label": "소속 본부" });
    const ph = el("input", { class: "pa-in", id: "pa-signup-phone", placeholder: "010으로 시작하는 휴대폰 번호", type: "tel", name: "tel", autocomplete: "tel", inputmode: "tel", maxlength: "13", required: "", "aria-label": "휴대폰 번호" });
    const ok = el("input", { type: "checkbox", id: "pa-consent", required: "" });
    const out = el("p", { class: "pa-note", role: "status" });
    const draft = readDraft(owner);
    n.value = typeof draft.name === "string" ? draft.name : p.name || "";
    signup.fillBranches(b, typeof draft.branch === "string" ? draft.branch : p.branch || "");
    ph.value = formatPhone(typeof draft.phone === "string" ? draft.phone : p.phone || "");
    ok.checked = draft.consent === true;
    bindPhone(ph);
    let saving = false, draftActive = true;
    const remember = () => { if (draftActive) saveDraft(owner, { name: n.value, branch: b.value, phone: ph.value, consent: ok.checked }); };
    [n, b, ph, ok].forEach(input => ["input", "change", "blur"].forEach(event => input.addEventListener(event, remember)));
    const switchEmail = el("button", { class: "pa-text-button pa-switch-email", type: "button", onclick: async () => {
      if (saving) return;
      switchEmail.disabled = true;
      try { await leaveAccount(); }
      catch (error) { out.textContent = isNet(error) ? NET_MSG : "계정을 바꾸지 못했어요. 잠시 후 다시 눌러 주세요."; }
      finally { switchEmail.disabled = false; }
    } }, "다른 이메일로 가입하기");
    const submit = el("button", { class: "g-btn g-btn--pri g-btn--lg", type: "submit" }, "가입 신청");
    const form = el("form", { id: "pa-signup-form", novalidate: "", onsubmit: async ev => {
      ev.preventDefault();
      if (saving) return;
      ph.value = formatPhone(ph.value); remember();
      if (![n, b, ph].every(input => input.value.trim())) { out.textContent = "이름·소속·휴대폰 번호를 모두 입력해 주세요."; [n, b, ph].find(input => !input.value.trim()).focus(); return; }
      if (!signup.validName(n.value)) { out.textContent = "이름을 2자 이상 입력해 주세요."; n.focus(); return; }
      if (!signup.validBranch(b.value)) { out.textContent = "목록에서 소속 본부를 선택해 주세요."; b.focus(); return; }
      if (!validPhone(ph.value)) { out.textContent = PHONE_MSG; ph.focus(); return; }
      if (!ok.checked) { out.textContent = "개인정보 수집·이용 동의에 체크해 주세요."; ok.focus(); return; }
      const values = { p_name: n.value.trim(), p_branch: b.value.trim(), p_phone: ph.value, p_consent: ok.checked };
      saving = true; [n, b, ph, ok, submit, switchEmail].forEach(input => { input.disabled = true; }); submit.textContent = "보내는 중…"; out.textContent = "";
      try {
        const current = await sb.auth.getSession();
        if (current.error || !current.data.session || current.data.session.user.id !== owner || currentOwner !== owner) {
          await boot(); return;
        }
        // 전송 계정 고정: 제출 도중 다른 계정으로 바뀌어도 이전 입력을 새 계정에 저장하지 않습니다.
        const { error } = await sb.rpc("complete_profile", values).setHeader("Authorization", "Bearer " + current.data.session.access_token);
        if (currentOwner !== owner) return;
        if (error) throw error;
        draftActive = false; clearDraft(owner);
        window.dispatchEvent(new Event("pa:profile")); // 공통 메뉴: 로그아웃·내 정보 표시
        await boot();
      } catch (error) {
        console.debug("[complete_profile]", error);
        out.textContent = isNet(error) ? NET_MSG : hasKo(error.message) ? error.message + " — 입력 내용을 확인한 뒤 다시 눌러 주세요." : "가입 신청을 보내지 못했어요. 잠시 후 다시 눌러 주세요.";
      } finally {
        saving = false; [n, b, ph, ok, submit, switchEmail].forEach(input => { input.disabled = false; }); submit.textContent = "가입 신청";
      }
    } }, el("label", { class: "pa-signup-form-label", for: n.id }, "이름"), n,
      el("label", { class: "pa-signup-form-label", for: ph.id }, "휴대폰 번호"), ph,
      el("label", { class: "pa-signup-form-label", for: b.id }, "소속 본부"), b,
      el("label", { class: "pa-consent", for: "pa-consent" }, ok, " [필수] 개인정보 수집·이용에 동의합니다. ",
        el("a", { href: "../privacy/", target: "_blank", rel: "noopener" }, "개인정보처리방침 보기")),
      el("div", { class: "pa-head-btns" }, submit), out, switchEmail);
    show(el("div", { class: "pa-login" }, el("div", { class: "pa-card" },
      el("h2", { class: "pa-h3" }, "가입 정보 입력"), el("p", { class: "pa-profile-intro" }, "아직 가입 신청이 완료되지 않았습니다. 이름·휴대폰·소속 본부를 입력하고 개인정보 수집·이용에 동의한 뒤 가입 신청을 눌러 주세요."), el("p", { class: "pa-signup-account" }, `가입 계정: ${p.email || ""}`), form), signup.guide()));
    viewKey = key;
    window.addEventListener("pagehide", remember);
    disposeView = () => { draftActive = false; window.removeEventListener("pagehide", remember); };
  }

  async function leaveAccount() {
    let result;
    try { result = await sb.auth.signOut(); } catch (error) { result = { error }; }
    if (result.error) result = await sb.auth.signOut({ scope: "local" });
    if (result.error) throw result.error;
    clearDrafts();
    await boot();
  }
  const logoutBtn = () => el("button", { class: "g-btn g-btn--ghost g-btn--sm pa-logout", type: "button", onclick: async ev => {
    const btn = ev.currentTarget; btn.disabled = true;
    try { await leaveAccount(); }
    catch (error) { console.debug("[signOut]", error); btn.textContent = "로그아웃 다시 시도"; }
    finally { btn.disabled = false; }
  } }, "로그아웃"); // 연결이 끊겨도 이 기기에서는 로그아웃

  // 도구 검색(초성)·승인 요청
  const OPENCHAT = "https://open.kakao.com/o/sFMF26y";
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
  // 가입 정보를 저장한 승인 대기 회원에게만 접수 안내를 표시합니다. 실제 알림 발송 여부는 서버에서 확인합니다.
  function pendingCard() {
    return el("div", { class: "pa-card pa-banner pa-wait" }, el("h2", { class: "pa-h3" }, "승인 대기 중 — 관리자 확인 후 열립니다"),
      el("p", {}, "가입 신청이 접수됐어요. 관리자가 가입 정보를 확인하고 승인하면 🔒 표시 메뉴가 열립니다. 그동안 인트라넷은 둘러보실 수 있어요."));
  }

  const SITE_LINKS = [
    { key: "site:0", name: "보험위키", description: "보장·용어·청구 가이드", url: "/wiki/" },
    { key: "site:2", name: "보험노트", description: "보험노트 공식 홈페이지", url: "https://bohumnote.com/" }
  ];
  // 4분류 고정. 확인된 이름과 기존 경로를 우선하며 미분류 메뉴도 자료·지식에서 이용할 수 있습니다. 등록·이름 변경 시 이 매핑을 함께 확인합니다.
  const WORK = ["상품·상담", "보상·청구", "청약·전산", "자료·지식"];
  const TOOL_WORK = Object.freeze({
    "상품통합분석기": "상품·상담", "AI영업비서": "상품·상담",
    "질병정보·화법도우미": "상품·상담", "실전 질병정보·화법도우미": "상품·상담", "DB영업 화법도우미": "상품·상담",
    "실전 DB영업 화법도우미": "상품·상담", "다보이는 보험비교 카페": "상품·상담", "레몬보험 보험비교 카페": "상품·상담",
    "보험보상답변기": "보상·청구", "N대·종수술 답변기": "보상·청구", "실손의료비 답변기": "보상·청구",
    "고지의무 판독기": "청약·전산", "전산답변기": "청약·전산",
    "프라임에셋 내부인트라넷 팜스": "청약·전산",
    "보험정보공유카페": "자료·지식", "프리미엄 상품저장소카페": "자료·지식",
    "프리미엄 디비영업저장소 카페": "자료·지식", "보험설계사끼리 카페": "자료·지식",
    "프리미엄 자료검색기": "자료·지식", "최신보험뉴스": "자료·지식", "보험위키": "자료·지식", "보험노트": "상품·상담"
  });
  const TOOL_PURPOSE = Object.freeze({
    "상품통합분석기": "상품 보장과 조건 비교", "AI영업비서": "상담 준비와 화법 점검",
    "질병정보·화법도우미": "질병 정보와 상담 화법", "DB영업 화법도우미": "DB 고객 상담 화법",
    "실전 DB영업 화법도우미": "DB 고객 상담 화법", "다보이는 보험비교 카페": "고객 확보용 카페", "레몬보험 보험비교 카페": "고객 확보용 카페",
    "보험보상답변기": "보상 기준과 청구 서류 확인", "N대·종수술 답변기": "질병·수술 보장 기준 확인", "실손의료비 답변기": "실손 보장과 청구 기준 확인",
    "고지의무 판독기": "청약 전 고지 항목 확인", "전산답변기": "보험사 전산 업무 절차 확인",
    "프라임에셋 내부인트라넷 팜스": "프라임에셋 내부 인트라넷",
    "보험정보공유카페": "설계사 전용 자료 카페", "프리미엄 상품저장소카페": "설계사 전용 상품 자료 카페",
    "프리미엄 디비영업저장소 카페": "설계사 전용 DB영업 자료 카페", "보험설계사끼리 카페": "소식지 파일 카페(외부 설계사도 가입)",
    "프리미엄 자료검색기": "업무 자료와 근거 검색", "최신보험뉴스": "보험업계 최신 소식"
  });
  const workFor = r => Object.prototype.hasOwnProperty.call(TOOL_WORK, r.name) ? TOOL_WORK[r.name] : WORK.includes(r.work || r.category) ? (r.work || r.category) : "자료·지식";
  let renderEpoch = 0;
  async function intranetView(p, banner, epoch, storageOwner) {
    const { data: raw, error } = await sb.rpc("my_menu");
    if (epoch !== renderEpoch) return;
    if (error || !Array.isArray(raw)) return failView("메뉴 목록을 불러오지 못했습니다", error, true);
    // my_menu는 활성 메뉴만 반환합니다. active를 포함하는 응답도 같은 일반 규칙으로 처리합니다.
    const data = raw.filter(r => r.active !== false && !/승격/.test(r.name || "")); // 이사 지시 2026-11-03: 승격기준 박스 숨김
    const key = JSON.stringify([storageOwner, "intranet", p, data]);
    if (viewKey === key) return; // 같은 인증 상태의 갱신은 질문 입력과 진행 상태를 유지
    mode(true);
    const pending = p.status === "pending";
    const catalog = [
      ...data.map(r => {
        const product = r.name === "상품통합분석기";
        // 이사 승인 2026-11-04: 보험보상답변기는 홈페이지 새 화면(/members/claim/)으로. 기존 GAS 주소는 그 화면 아래 '이전 답변기'로 남김.
        const claim = /보상\s*답변|보상\s*AI|보험금\s*청구\s*답변/i.test(r.name || "") || /AKfycbzNrEdi_|AKfycbz4WjJLM6OR|1ZyOPAVHmWW65aRKq05QFk/.test(r.url || ""); // 이름이 달라도 원본 보상답변기 주소면 새 화면으로
        // 전산답변기도 새 홈페이지 화면으로 연결하고, 확인한 원본 배포 3개를 모두 인식한다.
        const it = /전산\s*답변/.test(r.name || "") || /AKfycbzVbO8_XxSq8_WZhvNBXSi0myH22g0igqhAwkz7Kf9QtDUchxIds-E7fgTi06xGSP6lvg|AKfycbxWVCohTpOA3rZUK1hpuOqq_cfarzo57S2dlKL1g3CcTevVq1h-9oG28wBUvv_tzPb8tw|AKfycbzfFExpXscK87c2F54p17YDJwdDmpk7MAZ3NQAsWJtjqAFBXSaVJ1JC52H2czeaPPDNiw/.test(r.url || "");
        // 실전상담 통합코치는 보상·전산 규칙 다음에 홈페이지 새 화면으로 연결합니다.
        const coach = /통합\s*코치|실전\s*상담|영업\s*비서/.test(r.name || "") || /AKfycbyKIz|AKfycbw6JIh|AKfycbz8vba3|1rIZRrzlYTgq5g0omTg_02q73sUi83Fp8US200QeoXQc4iPC5Wef6FHZQ/.test(r.url || "");
        // 보험뉴스 화면 이전: 메뉴 권한과 즐겨찾기 식별자는 유지합니다.
        const news = /보험\s*뉴스/.test(r.name || "") || /AKfycbyYyYaZD3zH-DReuzAH_fUdl2Xe4jU_xhgf2snq2hpgR0g-7yx68bD-xAvpaXe0hnk/.test(r.url || "");
        return { ...r, key: "menu:" + r.id, work: product || coach ? "상품·상담" : claim ? "보상·청구" : it ? "청약·전산" : workFor(r), description: TOOL_PURPOSE[r.name] || r.description || "",
          url: r.unlocked && r.url ? (product ? "/product/" : claim ? "/members/claim/" : it ? "/members/it/" : coach ? "/members/coach/" : news ? "https://test.primeasset.info/news/" : r.url) : null, internal: product || claim || it || coach || news };
      }),
      ...SITE_LINKS.filter(r => !data.some(m => m.name === r.name || m.url === r.url)).map(r => ({ ...r, unlocked: true, work: workFor(r), internal: r.url.startsWith("/") }))
    ];
    // 중복 메뉴 행은 첫 항목 한 번만 표시하고, 기존 즐겨찾기 키는 보존합니다.
    const seen = new Set(), seenKeys = new Set();
    const tools = catalog.filter(r => { const identity = r.name || r.key; if (seen.has(identity) || seenKeys.has(r.key)) return false; seen.add(identity); seenKeys.add(r.key); return true; });
    const available = r => r.unlocked && r.url;
    const works = WORK;
    const tile = r => el("article", { class: "pa-work-card" + (!r.unlocked ? " is-locked" : ""), "data-resource-key": r.key },
      available(r) ? el("a", { class: "pa-work-link", href: r.url, title: r.description || r.name, ...(r.internal ? {} : { target: "_blank", rel: "noopener noreferrer" }) }, el("b", {}, r.name), el("span", { class: "pa-open-label" }, r.internal ? el("span", { "aria-hidden": "true" }, "→") : "새 창 ↗")) : el("b", { class: "pa-locked-name" }, r.name),
      r.description ? el("p", { class: "pa-tool-purpose" }, r.description) : null,
      !r.unlocked ? el("div", { class: "pa-lock-state" }, el("span", {}, pending ? "🔒 승인 후 열림" : "🔒 이용 권한 필요"), pending ? null : r.id != null ? reqBtn(r) : null) : !r.url ? N("주소 준비 중입니다.") : null);
    const directory = el("div", { id: "pa-directory" }, ...works.map(w => {
      const items = tools.filter(r => r.work === w);
      return el("section", { class: "pa-work-group", "aria-label": w }, el("h3", {}, w), el("div", { class: "pa-work-grid" }, ...items.map(tile)), items.length ? null : N("등록된 도구가 없습니다."));
    }));
    const ask = window.PA_ASK_HOME && window.PA_ASK ? window.PA_ASK_HOME.create({ sb, approved: p.status === "active", tools, choRx, owner: storageOwner,
      onAuthFailure: () => {
        if (!ask.node.isConnected) return;
        mode(false); show(msg("로그인·이용 권한을 확인해 주세요", "이전 질문과 답변을 비웠습니다. 다시 확인하거나 로그인한 뒤 이용해 주세요."),
          el("button", { type: "button", class: "g-btn g-btn--pri", onclick: boot }, "다시 확인"), logoutBtn());
      }
    }) : { node: msg("AI 질문창을 불러오지 못했습니다", "화면을 새로고침해 주세요."), dispose: () => {} };
    let alive = true;
    const noticeBody = el("div", { class: "pa-notice-body" }, N("보험자료를 불러오는 중…"));
    const noticeBox = el("section", { class: "pa-home-notice pa-home-block", id: "news", "aria-labelledby": "pa-news-title" },
      el("div", { class: "pa-section-heading" }, el("h2", { id: "pa-news-title", tabindex: "-1" }, "최근 등록 보험자료"), el("a", { href: "/qa/" }, "전체 보기 →")), noticeBody);
    const loadNotice = async () => {
      noticeBody.replaceChildren(N("보험자료를 불러오는 중…"));
      try {
        const res = await fetch("/qa/_data/posts.json", { cache: "no-cache" });
        if (!res.ok) throw new Error("posts " + res.status);
        const records = await res.json();
        if (!Array.isArray(records)) throw new Error("invalid_posts");
        const recent = records.filter(x => x && x.slug && x.question)
          .sort((a, b) => (Date.parse(b.datePublished || b.date) || 0) - (Date.parse(a.datePublished || a.date) || 0)).slice(0, 3);
        if (!alive) return;
        noticeBody.replaceChildren(recent.length
          ? el("ul", { class: "pa-qa-new" }, ...recent.map(x => {
            const date = String(x.datePublished || x.date || "").slice(0, 10);
            return el("li", {}, el("a", { href: "/qa/" + encodeURIComponent(x.slug) + "/" }, x.question), el("time", { datetime: date }, date ? "등록일 " + date.replace(/-/g, ".") : "등록일 미정"));
          })) : el("p", { class: "pa-qa-empty" }, "등록된 보험자료가 없습니다."));
      } catch (e) {
        if (!alive) return;
        noticeBody.replaceChildren(N("보험자료를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요."), el("button", { class: "pa-text-button", type: "button", onclick: loadNotice }, "다시 시도"));
      }
    };
    const head = el("header", { class: "pa-home-head" }, el("h2", { class: "pa-home-title" }, `${p.name || "회원"}님, 안녕하세요`));
    const browse = el("section", { id: "directory", class: "pa-home-block" }, el("div", { class: "pa-section-heading" }, el("h2", { id: "pa-directory-title", tabindex: "-1" }, `업무 도구 (${tools.length})`)),
      tools.length ? directory : N("등록된 업무 도구가 없습니다."));
    show(el("section", { class: "pa-sec pa-aiqa-home", id: "home" }, head, pending ? pendingCard() : banner, ask.node, browse, noticeBox));
    disposeView = () => { alive = false; ask.dispose(); };
    viewKey = key;
    loadNotice();
    markTab();
    if (goto) { jump(goto); goto = null; }
  }

  // FUNC-FIX A4: 그린 뒤 그 칸으로(고정 메뉴 높이는 .pa-sec scroll-margin-top). 글꼴이 늦게 와 높이가 바뀌면 사용자가 안 움직였을 때만 한 번 더 맞춤
  function jump(id, moveFocus = false) {
    id = sectionFor(id) || id;
    if (id === "me") { location.assign("/members/me/"); return; }
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

  let logged = false, currentOwner = null, authTimer = null;
  async function boot() {
    const epoch = ++renderEpoch;
    const { data: { session }, error: sErr } = await sb.auth.getSession();
    if (epoch !== renderEpoch) return;
    if (!session) {
      if (sErr && isNet(sErr)) return failView("로그인 상태를 확인하지 못했습니다", sErr, false);
      logged = false; requested.clear();
      currentOwner = null; clearDrafts();
      if (goto) { saveGoto(goto); goto = null; } // 로그인 뒤 이 칸으로(이 기기에 30분)
      if (viewKey === "login") return;
      return loginView(location.hash === "#signup" ? "처음 오셨나요? 로그인 후 필수 가입 정보를 입력하면 가입 신청이 접수됩니다." : "");
    }
    const storageOwner = session.user.id || "local";
    if (currentOwner && currentOwner !== storageOwner) {
      mode(false); show(msg("가입 계정을 확인하는 중입니다"));
      clearDraft(currentOwner); logged = false; requested.clear();
    }
    currentOwner = storageOwner;
    retryOnline = null;
    if (!goto) goto = takeGoto(); // 로그인 전에 가려던 칸
    if (!logged) { logged = true; sb.rpc("record_login", { p_method: (session.user.app_metadata || {}).provider || "", p_agent: navigator.userAgent }); }
    if (location.hash && !knownSection(location.hash.slice(1))) history.replaceState(null, "", location.pathname); // 토큰·가입 주소는 지우고 섹션 주소는 둠
    const { data, error } = await sb.rpc("my_profile");
    if (epoch !== renderEpoch) return;
    let p = data && data[0];
    if (error) return failView("회원 정보를 확인하지 못했습니다", error, true);
    if (!p) return show(msg("회원 정보를 확인하지 못했습니다", "잠시 후 다시 시도해 주세요."), logoutBtn());
    try { p = await signup.resolveProfile(sb, p, session); }
    catch (error) { if (epoch === renderEpoch) return failView("가입 정보를 확인하지 못했습니다", error, true); return; }
    if (epoch !== renderEpoch) return;
    if (!signup.complete(p)) {
      p = p || { email: session.user.email || "" };
      const key = JSON.stringify([storageOwner, "signup", p.status]);
      // 창 복귀의 SIGNED_IN·토큰 갱신·세션 재확인에도 같은 가입 폼과 포커스를 유지합니다.
      if (viewKey !== key) profileView(p, storageOwner, key);
      return;
    }
    clearDraft(storageOwner);
    if (p.status === "suspended") return show(msg("이용이 정지된 계정입니다", "문의는 관리자에게 해 주세요."), logoutBtn());
    if (p.status === "pending") return intranetView(p, null, epoch, storageOwner); // 안내·요청 버튼은 intranetView 가 메뉴 목록과 함께 그림(pendingCard)
    return intranetView(p, /^(게스트|guest)$/i.test(p.grade || "") ? msg("Guest 등급입니다", "🔒 표시 메뉴는 등급이 정해지면 열립니다.") : null, epoch, storageOwner);
  }
  sb.auth.onAuthStateChange((ev, nextSession) => {
    if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"].includes(ev)) return;
    if (ev === "SIGNED_OUT" || (currentOwner && (!nextSession || !nextSession.user || nextSession.user.id !== currentOwner))) {
      mode(false); show(msg("로그인 정보를 확인하는 중입니다"));
      clearDrafts(); // 이전 폼의 초안 리스너를 중단한 뒤 삭제
    }
    // Supabase의 인증 잠금 안에서 API를 다시 호출하지 않고, 이전 비동기 화면 응답도 무효화합니다.
    renderEpoch++;
    clearTimeout(authTimer);
    authTimer = setTimeout(() => { boot(); }, 0);
  });
  boot();
})();
