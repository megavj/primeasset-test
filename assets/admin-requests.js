/* 프라임에셋 프리미엄 — 관리자 화면 덧붙임 (assets/admin.js 는 그대로 둠). 서버 함수가 있을 때만 '오늘 요약' 아래에 카드 두 개:
   (1) 승인 요청 목록 list_access_requests()  → 회원이 인트라넷 🔒 도구 옆 '승인 요청'을 누른 것. 승인은 기존 권한 체크표에서.
   (2) 방문 합계 site_hit_summary(p_days)     → 최근 30일 날짜별 방문 수·'합류 문의' 클릭 수 합계(막대, assets/glass-chart.js).
   함수가 없으면(SQL 적용 전) 아무것도 그리지 않음. admin.js 가 탭을 바꿔 화면을 다시 그려도 카드는 다시 끼워 넣음. */
(function () {
  const C = window.PA_AUTH || {};
  if (!C.url || !C.anonKey || !window.supabase) return;
  const box = document.getElementById("pa-app"); if (!box) return;
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const sb = window.supabase.createClient(C.url, C.anonKey);
  const toast = (t, bad) => { const n = el("div", { class: "pa-toast" + (bad ? " bad" : "") }, t); document.body.append(n); setTimeout(() => n.remove(), 3500); };
  const table = (heads, rows) => el("div", { class: "pa-scroll" }, el("table", { class: "pa-table" }, el("thead", {}, el("tr", {}, ...heads.map(h => el("th", {}, h)))), el("tbody", {}, ...rows)));
  const when = (t) => t ? new Date(t).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";
  const n = (v) => Number(v || 0).toLocaleString("ko-KR");
  const cards = [];
  // '오늘 요약' 카드 바로 뒤에 순서대로 끼움(이미 그 자리면 그대로)
  function place() {
    if (!cards.length) return;
    const anchor = [...box.children].find(c => c.querySelector && /오늘 요약/.test((c.querySelector("h3") || {}).textContent || ""));
    if (!anchor) return;
    let after = anchor;
    for (const c of cards) { if (c.previousElementSibling !== after) after.after(c); after = c; }
  }
  new MutationObserver(place).observe(box, { childList: true });

  async function requestsCard() {
    const { data, error } = await sb.rpc("list_access_requests");
    if (error || !Array.isArray(data)) return null; // 함수 없음·권한 없음 → 안 그림
    const card = el("div", { class: "pa-card pa-req-card" });
    const reload = async () => { const r = await sb.rpc("list_access_requests"); if (!r.error && Array.isArray(r.data)) draw(r.data); };
    const draw = (list) => card.replaceChildren(el("h3", {}, `승인 요청 (${list.length})`),
      el("p", { class: "pa-note" }, "회원이 인트라넷의 🔒 도구 옆 '승인 요청'을 누르면 여기에 쌓입니다. 열어 주려면 '회원·등급 관리 → 권한 체크표'에서 그 등급에 체크하거나 회원 등급을 바꿔 주세요. 권한이 열리면 목록에서 자동으로 빠집니다."),
      list.length ? table(["요청일", "이름", "소속", "등급", "요청한 메뉴", ""], list.map(a => el("tr", {},
        el("td", {}, when(a.created_at)), el("td", {}, a.member_name || ""), el("td", {}, a.member_branch || ""), el("td", {}, a.grade || ""),
        el("td", {}, el("small", {}, a.resource_category || ""), " ", a.resource_name || ""),
        el("td", {}, el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: async () => {
          const { error: e } = await sb.rpc("resolve_access_request", { p_id: a.id });
          if (e) { toast(e.message, true); return; } toast("완료로 표시했습니다"); reload();
        } }, "완료 표시")))))
      : el("p", { class: "pa-note" }, "열린 요청이 없습니다."),
      el("div", { class: "pa-row" }, el("button", { class: "lux-btn lux-btn--sm", onclick: reload }, "새로고침")));
    draw(data);
    return card;
  }

  async function hitsCard() {
    const { data, error } = await sb.rpc("site_hit_summary", { p_days: 30 });
    if (error || !Array.isArray(data) || !window.PA_CHART) return null;
    const labels = data.map(r => String(r.day || "").slice(5)); // 'MM-DD'
    const views = data.map(r => +r.views || 0), joins = data.map(r => +r.join_clicks || 0);
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    const chart = (name, vals) => window.PA_CHART.bars({ labels, series: [{ name, values: vals }], orient: "v", fmt: window.PA_CHART.int, title: name + " — 날짜별(최근 30일)", height: 190 });
    return el("div", { class: "pa-card pa-hits-card" }, el("h3", {}, "방문 합계 (최근 30일)"),
      el("p", { class: "pa-note" }, "페이지 방문 수와 '합류 문의' 버튼 클릭 수의 날짜별 합계입니다. 누가 방문했는지는 저장하지 않습니다(IP·쿠키·기기 식별값 없음)."),
      el("div", { class: "wf-grid pa-hit-sum" }, el("div", { class: "wf-item" }, el("b", {}, n(sum(views))), el("small", {}, "방문 · 30일 합계")), el("div", { class: "wf-item" }, el("b", {}, n(sum(joins))), el("small", {}, "합류 문의 클릭 · 30일 합계"))),
      el("div", { class: "pa-hit-charts" }, chart("방문", views), chart("합류 문의 클릭", joins)),
      el("details", { class: "pa-fold" }, el("summary", {}, "날짜별 표 보기"), table(["날짜", "방문", "합류 문의 클릭"], data.map(r => el("tr", {}, el("td", {}, String(r.day)), el("td", {}, n(r.views)), el("td", {}, n(r.join_clicks)))))));
  }

  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const [rq, ht] = await Promise.all([requestsCard(), hitsCard()]);
    for (const c of [rq, ht]) if (c) cards.push(c);
    place();
  })();
})();
