/* 프라임에셋 프리미엄 — 관리자 화면. 모든 권한 확인은 서버(RLS·트리거)가 함. 이 화면은 관리자가 아니면 빈 결과만 받음 */
(function () {
  const C = window.PA_AUTH || {};
  const $ = (s) => document.querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "checked" || k === "selected" || k === "value") e[k] = v; else e.setAttribute(k, v);
    }
    for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const box = $("#pa-app");
  const show = (...n) => box.replaceChildren(...n);
  if (!C.url || !C.anonKey || !window.supabase) { show(el("div", { class: "pa-card" }, el("h3", {}, "로그인 서버 설정 전입니다"))); return; }
  const sb = window.supabase.createClient(C.url, C.anonKey);
  const S = { grades: [], members: [], resources: [], perms: new Set() };
  const toast = (t, bad) => { const n = el("div", { class: "pa-toast" + (bad ? " bad" : "") }, t); document.body.append(n); setTimeout(() => n.remove(), 3500); };
  const run = async (p, okText) => { const { error } = await p; if (error) { toast(error.message, true); return false; } if (okText) toast(okText); await load(); return true; };
  const gname = (id) => (S.grades.find(g => g.id === id) || {}).name || "-";
  const gradeSelect = (cur) => el("select", { class: "pa-in pa-sm" }, ...S.grades.map(g => el("option", { value: String(g.id), selected: g.id === cur }, g.name)));
  const fmt = (t) => t ? new Date(t).toLocaleString("ko-KR") : "";

  async function load() {
    const [g, m, r, p, b] = await Promise.all([
      sb.from("grades").select("*").order("sort"),
      sb.from("members").select("*").order("created_at", { ascending: false }),
      sb.from("resources").select("*").order("kind").order("category").order("sort"),
      sb.from("grade_permissions").select("*"), sb.from("branches").select("*").order("sort")]);
    S.branches = (b && b.data) || []; S.grades = g.data || []; S.members = m.data || []; S.resources = r.data || [];
    S.perms = new Set((p.data || []).map(x => x.grade_id + ":" + x.resource_id));
    render();
  }

  const TABS = [["notice", "새 소식"], ["pending", "대기 회원"], ["members", "회원 목록"], ["admins", "관리자"], ["grades", "등급 관리"],
                ["branches", "본부"], ["matrix", "권한 체크표"], ["resources", "페이지·도구"], ["audit", "변경 기록"], ["backup", "백업"]];
  const TAB_DESC = { notice: "인트라넷 맨 위 '새 소식' 한 줄. 관리자만 고칠 수 있고, 고치면 변경 기록에 남습니다.", pending: "가입 신청 후 승인 대기 중인 회원. 승인·등급 지정·거절.", members: "전체 회원 목록. 등급 변경·정지·해제.",
    admins: "관리자 추가·해제(관리자 권한은 등급과 따로).", grades: "등급 이름·순서 관리.", branches: "메인 '함께하는 본부'의 번호·주소·순서·숨김.",
    matrix: "등급별로 어떤 페이지·도구를 열지 체크.", resources: "인트라넷 메뉴(페이지·도구) 이름·분류·주소 관리.", audit: "누가 무엇을 바꿨는지 기록.", backup: "회원 정보 백업 받기(30일 보관)." };
  // HOME-22: 승인 대기(승인 버튼) 맨 위 → 오늘 요약 숫자 → 회원·등급 관리 → 변경 기록 → 설정
  const GROUPS = [["회원·등급 관리", ["members", "grades", "matrix", "admins"]], ["변경 기록", ["audit"]], ["설정", ["notice", "resources", "branches", "backup"]]];
  let tab = "members";
  function summary() {
    const c = (f) => S.members.filter(f).length;
    return el("div", { class: "pa-card" }, el("h3", {}, "오늘 요약"),
      el("div", { class: "wf-grid" }, ...[["승인 대기", c(m => m.status === "pending")], ["전체 회원", S.members.length], ["승인 회원", c(m => m.status === "active")],
        ["관리자", c(m => m.is_admin)], ["도구·메뉴", S.resources.length]].map(([k, v]) => el("div", { class: "wf-item" }, el("b", {}, String(v)), el("small", {}, k)))));
  }
  function render() {
    const g = GROUPS.find(x => x[1].includes(tab)) || GROUPS[0];
    const pend = el("div", { class: "pa-card" }, el("h3", {}, `승인 대기 (${S.members.filter(m => m.status === "pending").length})`),
      el("p", { class: "wf-desc" }, "섹션 설명: " + TAB_DESC.pending), VIEWS.pending());
    const gnav = el("div", { class: "pa-tabs" }, ...GROUPS.map(([gn, ks]) => el("button", { class: "pa-tab" + (g[0] === gn ? " on" : ""), onclick: () => { tab = ks[0]; render(); } }, gn)));
    const sub = g[1].length > 1 ? el("div", { class: "pa-tabs" }, ...g[1].map(k => el("button", { class: "pa-tab" + (k === tab ? " on" : ""), onclick: () => { tab = k; render(); } },
      (TABS.find(x => x[0] === k) || [, k])[1]))) : null;
    const name = (TABS.find(x => x[0] === tab) || [, ""])[1];
    show(pend, summary(), gnav, el("div", { class: "pa-card" }, el("h3", {}, g[0]), sub,
      el("div", { class: "pa-card" }, el("h3", {}, name), el("p", { class: "wf-desc" }, "섹션 설명: " + (TAB_DESC[tab] || "")), VIEWS[tab]())));
  }
  const table = (heads, rows) => el("div", { class: "pa-scroll" }, el("table", { class: "pa-table" },
    el("thead", {}, el("tr", {}, ...heads.map(h => el("th", {}, h)))), el("tbody", {}, ...rows)));

  const VIEWS = {
    notice() {
      const inp = el("input", { class: "pa-in", maxlength: "200", placeholder: "인트라넷 맨 위에 보일 한 줄 (200자 이내)" });
      const info = el("p", { class: "pa-note" }, "불러오는 중…");
      sb.from("site_notice").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
        if (error) { info.textContent = "불러오지 못했습니다: " + error.message; return; }
        inp.value = (data && data.text) || ""; info.textContent = data ? `마지막 수정: ${fmt(data.updated_at)}${data.updated_by ? " · " + data.updated_by : ""}` : "";
      });
      return el("div", {}, el("div", { class: "pa-row" }, inp, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: async () => {
        const t = inp.value.trim(); if (!t) { toast("내용을 입력해 주세요.", true); return; }
        const me = (await sb.auth.getUser()).data.user;
        if (await run(sb.from("site_notice").update({ text: t, updated_at: new Date().toISOString(), updated_by: me ? me.email : null }).eq("id", 1), "새 소식을 저장했습니다")) { tab = "notice"; render(); }
      } }, "저장")), info);
    },
    branches() {
      const no = el("input", { class: "pa-in pa-sm", placeholder: "본부 번호 (예: 227)" }), url = el("input", { class: "pa-in", placeholder: "본부 페이지 주소 (https://…, 비우면 '연결 준비 중')" });
      const add = el("div", { class: "pa-row" }, no, url, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: () =>
        run(sb.from("branches").upsert({ no: no.value.trim(), url: url.value.trim() || null, sort: (S.branches.length + 1) * 10 }), "저장했습니다") }, "추가·저장"));
      return el("div", {}, el("p", { class: "pa-note" }, "메인 '함께하는 본부'에 번호만 보입니다. 주소를 넣으면 누를 때 그 페이지로 이동합니다. 이름·전화는 넣지 않습니다."), add,
        table(["번호", "주소", "순서", "메인 표시", ""], S.branches.map(x => {
          const u = el("input", { class: "pa-in pa-sm", value: x.url || "", placeholder: "연결 준비 중" });
          u.addEventListener("change", () => run(sb.from("branches").update({ url: u.value.trim() || null, updated_at: new Date().toISOString() }).eq("no", x.no), "주소 저장"));
          const o = el("input", { class: "pa-in pa-xs", value: String(x.sort) });
          o.addEventListener("change", () => run(sb.from("branches").update({ sort: +o.value || 0 }).eq("no", x.no), "순서 저장"));
          const v = el("input", { type: "checkbox", checked: x.visible });
          v.addEventListener("change", () => run(sb.from("branches").update({ visible: v.checked }).eq("no", x.no), "표시 변경"));
          return el("tr", {}, el("td", {}, x.no + "본부"), el("td", {}, u), el("td", {}, o), el("td", { class: "c" }, v),
            el("td", {}, el("button", { class: "pa-mini", onclick: () => confirm(x.no + "본부를 목록에서 지울까요?") && run(sb.from("branches").delete().eq("no", x.no), "삭제했습니다") }, "삭제")));
        })));
    },
    pending() {
      const list = S.members.filter(m => m.status === "pending");
      if (!list.length) return el("p", { class: "pa-note" }, "대기 중인 회원이 없습니다.");
      return table(["가입일", "이름", "소속", "연락처", "이메일", "정보입력", "등급", ""], list.map(m => {
        const s = gradeSelect(S.grades.find(g => g.name === "설계사")?.id);
        return el("tr", {}, el("td", {}, fmt(m.created_at)), el("td", {}, m.name || ""), el("td", {}, m.branch || ""), el("td", {}, m.phone || ""),
          el("td", {}, m.email || ""), el("td", {}, m.consent_at ? "완료" : "미입력"), el("td", {}, s),
          el("td", {}, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: () =>
              run(sb.from("members").update({ status: "active", grade_id: +s.value }).eq("id", m.id), "승인했습니다") }, "승인"), " ",
            el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () =>
              confirm(`${m.email} 가입을 거절하고 계정을 지울까요?`) && run(sb.rpc("reject_member", { p_id: m.id }), "거절했습니다") }, "거절")));
      }));
    },
    members() {
      const q = el("input", { class: "pa-in", placeholder: "이름·소속·이메일 검색" });
      const f = el("select", { class: "pa-in pa-sm" }, el("option", { value: "" }, "전체 등급"), ...S.grades.map(g => el("option", { value: String(g.id) }, g.name)));
      const st = el("select", { class: "pa-in pa-sm" }, ...[["", "전체 상태"], ["active", "사용 중"], ["suspended", "정지"], ["pending", "대기"]].map(([v, t]) => el("option", { value: v }, t)));
      const body = el("div");
      const draw = () => {
        const k = q.value.trim();
        const list = S.members.filter(m => (!k || [m.name, m.branch, m.email].join(" ").includes(k)) && (!f.value || m.grade_id === +f.value) && (!st.value || m.status === st.value));
        body.replaceChildren(table(["이름", "소속", "이메일", "등급", "상태", "메모", ""], list.map(m => {
          const s = gradeSelect(m.grade_id);
          s.addEventListener("change", () => run(sb.from("members").update({ grade_id: +s.value }).eq("id", m.id), "등급을 바꿨습니다"));
          const memo = el("input", { class: "pa-in pa-sm", value: m.memo || "" });
          memo.addEventListener("change", () => run(sb.from("members").update({ memo: memo.value }).eq("id", m.id), "메모 저장"));
          const act = m.status === "suspended"
            ? el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () => run(sb.from("members").update({ status: "active" }).eq("id", m.id), "정지를 풀었습니다") }, "정지 해제")
            : el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () => { const why = prompt("정지 사유 (예: 퇴사)", "퇴사"); if (why !== null) run(sb.from("members").update({ status: "suspended", suspend_reason: why }).eq("id", m.id), "정지했습니다"); } }, "정지");
          return el("tr", { class: m.status }, el("td", {}, m.name || ""), el("td", {}, m.branch || ""), el("td", {}, m.email || ""), el("td", {}, s),
            el("td", {}, { active: "사용 중", suspended: "정지 " + (m.suspend_reason || "") + " " + fmt(m.suspended_at), pending: "대기" }[m.status]),
            el("td", {}, memo), el("td", {}, act));
        })));
      };
      [q, f, st].forEach(x => x.addEventListener("input", draw)); draw();
      return el("div", {}, el("div", { class: "pa-row" }, q, f, st, el("span", { class: "pa-note" }, `총 ${S.members.length}명`)), body);
    },
    admins() {
      const admins = S.members.filter(m => m.is_admin);
      const pick = el("select", { class: "pa-in" }, ...S.members.filter(m => !m.is_admin && m.status === "active").map(m => el("option", { value: m.id }, `${m.name || ""} ${m.email}`)));
      return el("div", {},
        el("p", { class: "pa-note" }, "관리자는 인원 제한이 없습니다. 등급과 별개라 등급을 바꿔도 관리자 권한은 유지됩니다. 마지막 1명은 해제할 수 없습니다."),
        table(["이름", "이메일", "등급", ""], admins.map(m => el("tr", {}, el("td", {}, m.name || ""), el("td", {}, m.email), el("td", {}, gname(m.grade_id)),
          el("td", {}, el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () => confirm(`${m.email} 관리자 권한을 해제할까요?`) && run(sb.from("members").update({ is_admin: false }).eq("id", m.id), "해제했습니다") }, "관리자 해제"))))),
        el("div", { class: "pa-row" }, pick, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: () => pick.value && run(sb.from("members").update({ is_admin: true }).eq("id", pick.value), "관리자로 지정했습니다") }, "관리자 추가")));
    },
    grades() {
      const name = el("input", { class: "pa-in", placeholder: "새 등급 이름" });
      return el("div", {},
        el("p", { class: "pa-note" }, "★ 표시 등급이 가입 직후 자동으로 받는 등급입니다. 회원이 있는 등급은 삭제되지 않습니다(다른 등급으로 옮긴 뒤 삭제)."),
        table(["순서", "이름", "회원 수", "가입 기본", ""], S.grades.map(g => {
          const n = el("input", { class: "pa-in pa-sm", value: g.name }); n.addEventListener("change", () => run(sb.from("grades").update({ name: n.value.trim() }).eq("id", g.id), "이름을 바꿨습니다"));
          const s = el("input", { class: "pa-in pa-xs", type: "number", value: String(g.sort) }); s.addEventListener("change", () => run(sb.from("grades").update({ sort: +s.value }).eq("id", g.id)));
          return el("tr", {}, el("td", {}, s), el("td", {}, n), el("td", {}, S.members.filter(m => m.grade_id === g.id).length),
            el("td", {}, g.is_default ? "★" : el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () => run(sb.from("grades").update({ is_default: true }).eq("id", g.id), "기본 등급을 바꿨습니다") }, "기본으로")),
            el("td", {}, el("button", { class: "lux-btn lux-btn--ghost lux-btn--sm", onclick: () => confirm(`'${g.name}' 등급을 삭제할까요?`) && run(sb.from("grades").delete().eq("id", g.id), "삭제했습니다") }, "삭제")));
        })),
        el("div", { class: "pa-row" }, name, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: () => name.value.trim() && run(sb.from("grades").insert({ name: name.value.trim(), sort: S.grades.length + 1 }), "추가했습니다") }, "등급 추가")));
    },
    matrix() {
      const want = new Set(S.perms);
      const rows = S.resources.map(r => el("tr", { class: r.active ? "" : "off" },
        el("td", {}, el("small", {}, r.category)), el("td", {}, r.name + (r.active ? "" : " (숨김)")),
        ...S.grades.map(g => { const k = g.id + ":" + r.id; const c = el("input", { type: "checkbox", checked: want.has(k) });
          c.addEventListener("change", () => c.checked ? want.add(k) : want.delete(k)); return el("td", { class: "c" }, c); })));
      const allCol = S.grades.map(g => el("th", { class: "c" }, g.name, el("br"),
        el("button", { class: "pa-mini", onclick: () => { box.querySelectorAll(`td:nth-child(${3 + S.grades.indexOf(g)}) input`).forEach(c => { c.checked = true; c.dispatchEvent(new Event("change")); }); } }, "전체"),
        el("button", { class: "pa-mini", onclick: () => { box.querySelectorAll(`td:nth-child(${3 + S.grades.indexOf(g)}) input`).forEach(c => { c.checked = false; c.dispatchEvent(new Event("change")); }); } }, "해제")));
      const save = async () => {
        const add = [...want].filter(k => !S.perms.has(k)).map(k => { const [g, r] = k.split(":"); return { grade_id: +g, resource_id: +r }; });
        const del = [...S.perms].filter(k => !want.has(k));
        for (const k of del) { const [g, r] = k.split(":"); const { error } = await sb.from("grade_permissions").delete().eq("grade_id", +g).eq("resource_id", +r); if (error) return toast(error.message, true); }
        if (add.length) { const { error } = await sb.from("grade_permissions").insert(add); if (error) return toast(error.message, true); }
        toast(`저장했습니다 (추가 ${add.length}, 해제 ${del.length})`); load();
      };
      return el("div", {}, el("p", { class: "pa-note" }, "칸을 체크한 뒤 [저장]을 눌러야 반영됩니다. 관리자는 체크와 관계없이 모두 보입니다."),
        el("button", { class: "lux-btn lux-btn--gold", onclick: save }, "저장"),
        el("div", { class: "pa-scroll" }, el("table", { class: "pa-table pa-matrix" }, el("thead", {}, el("tr", {}, el("th", {}, "분류"), el("th", {}, "페이지·도구"), ...allCol)), el("tbody", {}, ...rows))),
        el("button", { class: "lux-btn lux-btn--gold", onclick: save }, "저장"));
    },
    resources() {
      const f = { kind: el("select", { class: "pa-in pa-sm" }, el("option", { value: "tool" }, "도구"), el("option", { value: "page" }, "페이지")),
        category: el("input", { class: "pa-in pa-sm", placeholder: "분류" }), name: el("input", { class: "pa-in pa-sm", placeholder: "이름" }),
        url: el("input", { class: "pa-in", placeholder: "주소 (https://…)" }) };
      return el("div", {},
        el("p", { class: "pa-note" }, "도구 주소는 여기에만 저장되고, 권한 있는 회원에게만 내려갑니다. 주소가 바뀌면 이 칸만 고치면 됩니다."),
        table(["종류", "분류", "이름", "주소", "설명", "사용"], S.resources.map(r => {
          const inp = (k, cls) => { const i = el("input", { class: "pa-in " + (cls || "pa-sm"), value: r[k] || "" }); i.addEventListener("change", () => run(sb.from("resources").update({ [k]: i.value.trim() || null }).eq("id", r.id), "저장했습니다")); return i; };
          const a = el("input", { type: "checkbox", checked: r.active }); a.addEventListener("change", () => run(sb.from("resources").update({ active: a.checked }).eq("id", r.id), a.checked ? "다시 보이게 했습니다" : "숨겼습니다"));
          return el("tr", {}, el("td", {}, r.kind === "tool" ? "도구" : "페이지"), el("td", {}, inp("category")), el("td", {}, inp("name")), el("td", {}, inp("url", "")), el("td", {}, inp("description")), el("td", { class: "c" }, a));
        })),
        el("div", { class: "pa-row" }, f.kind, f.category, f.name, f.url, el("button", { class: "lux-btn lux-btn--gold lux-btn--sm", onclick: () => f.name.value.trim() &&
          run(sb.from("resources").insert({ kind: f.kind.value, category: f.category.value.trim() || "기타", name: f.name.value.trim(), url: f.url.value.trim() || null, sort: S.resources.length + 1 }), "추가했습니다 — 권한 체크표에서 등급을 체크해 주세요") }, "추가")));
    },
    audit() {
      const body = el("div", {}, el("p", { class: "pa-note" }, "불러오는 중…"));
      sb.from("audit_log").select("*").order("id", { ascending: false }).limit(300).then(({ data, error }) => {
        if (error) return body.replaceChildren(el("p", {}, error.message));
        const W = { members: "회원", grades: "등급", grade_permissions: "권한", resources: "페이지·도구" };
        body.replaceChildren(table(["시각", "누가", "대상", "작업", "내용"], data.map(a => {
          const d = a.detail || {}; const b = d.before || {}, n = d.after || {};
          const ch = Object.keys(n).filter(k => !["updated_at", "approved_at", "approved_by"].includes(k) && JSON.stringify(n[k]) !== JSON.stringify(b[k])).map(k => `${k}: ${b[k] ?? ""}→${n[k] ?? ""}`).join(", ");
          return el("tr", {}, el("td", {}, fmt(a.at)), el("td", {}, a.actor_email || "시스템"), el("td", {}, (W[a.target_table] || a.target_table) + " " + (n.email || n.name || b.email || b.name || a.target_id || "")),
            el("td", {}, { insert: "추가", update: "변경", delete: "삭제", reject: "가입 거절" }[a.action] || a.action), el("td", {}, el("small", {}, ch.slice(0, 200))));
        })));
      });
      return body;
    },
    backup() {
      const csv = (rows, cols) => "\ufeff" + [cols.join(","), ...rows.map(r => cols.map(c => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
      const dl = (name, text) => { const a = el("a", { href: URL.createObjectURL(new Blob([text], { type: "text/csv" })), download: name }); a.click(); };
      const day = new Date().toISOString().slice(0, 10);
      return el("div", { class: "pa-card" }, el("h3", {}, "회원 백업"),
        el("p", {}, "자동 백업: Mac mini가 매일 새벽 회원·등급·권한 전체를 NAS 접근제한 폴더에 암호 파일로 저장합니다(30일치)."),
        el("p", {}, "수동 백업: 아래 버튼으로 엑셀에서 열리는 파일(CSV)을 받습니다. 개인정보가 들어 있으니 공유 폴더에 두지 마세요."),
        el("button", { class: "lux-btn lux-btn--gold", onclick: () => dl(`회원_${day}.csv`, csv(S.members.map(m => ({ ...m, grade: gname(m.grade_id) })),
          ["name", "branch", "phone", "email", "grade", "status", "is_admin", "suspend_reason", "suspended_at", "approved_at", "created_at", "memo"])) }, "회원 엑셀 내려받기"), " ",
        el("button", { class: "lux-btn lux-btn--ghost", onclick: () => dl(`권한표_${day}.csv`, csv(S.resources.map(r => Object.fromEntries([["category", r.category], ["name", r.name], ...S.grades.map(g => [g.name, S.perms.has(g.id + ":" + r.id) ? "O" : ""])])),
          ["category", "name", ...S.grades.map(g => g.name)])) }, "권한표 내려받기"));
    },
  };

  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = "../"; return; }
    const { data } = await sb.rpc("my_profile");
    if (!data || !data[0] || !data[0].is_admin || data[0].status !== "active") { show(el("div", { class: "pa-card" }, el("h3", {}, "관리자만 볼 수 있습니다"), el("a", { href: "../" }, "← 인트라넷으로"))); return; }
    load();
  })();
})();
