/* 관리자 운영 설정. 인증·권한 판단과 변경 처리는 admin.js의 공용 컨텍스트를 사용합니다. */
(function () {
  "use strict";

  window.PA_ADMIN_SETTINGS = function (ctx) {
    const { sb, S, el, button, field, input, select, table, empty, toast, mutate, go, fmt, gname, confirmAction, errorText, remember } = ctx;
    const note = (text) => el("p", { class: "adm-note" }, text);
    const actions = (...children) => el("div", { class: "adm-actions" }, ...children);
    const panel = (...children) => el("div", { class: "adm-panel adm-stack" }, ...children);
    const cell = (...children) => el("td", {}, ...children);
    const check = (label, checked) => el("input", { type: "checkbox", "aria-label": label, "data-draft": "true", checked: !!checked });
    const sameId = (a, b) => String(a) === String(b);
    const changedFields = (before, after) => Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== before[key]));
    const unchanged = () => { toast("변경한 내용이 없습니다."); return false; };
    const numberValue = (control) => control.value.trim() !== "" && Number.isSafeInteger(Number(control.value)) ? Number(control.value) : null;
    const nextSort = (rows) => Math.max(0, ...rows.map((row) => Number(row.sort) || 0)) + 10;
    const validUrl = (value) => {
      if (!value) return true;
      if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return true;
      try { return ["https:", "http:"].includes(new URL(value).protocol); } catch (_) { return false; }
    };
    const report = (message, control) => { toast(message, true); if (control) control.focus(); return false; };
    const failedRead = (error) => errorText(error) || "불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

    function notice() {
      const content = input("새 소식 내용", "", { maxlength: "200", placeholder: "회원에게 전할 소식을 200자 이내로 입력하세요.", disabled: true });
      const info = el("p", { class: "adm-note", role: "status" }, "현재 새 소식을 불러오는 중입니다.");
      const count = el("span", { class: "adm-note", "aria-live": "polite" }, "0 / 200자");
      const preview = el("p", { class: "adm-notice-preview" }, "새 소식을 불러오면 미리보기가 표시됩니다.");
      let loaded = false;
      let original = "";
      let saving = false;
      const updatePreview = () => {
        count.textContent = `${content.value.length} / 200자`;
        if (loaded) preview.textContent = content.value.trim() || "회원에게 전할 새 소식을 입력해 주세요.";
        save.disabled = !loaded || saving || !content.value.trim() || content.value.trim() === original;
      };
      const save = button("새 소식 저장", async () => {
        if (!loaded || saving) return;
        const text = content.value.trim();
        if (!text || text.length > 200) return report("새 소식은 1자 이상 200자 이내로 입력해 주세요.", content);
        saving = true;
        content.disabled = true;
        retry.disabled = true;
        updatePreview();
        try {
          const saved = await mutate(async () => {
            const result = await sb.auth.getUser();
            if (result.error) return { error: result.error };
            if (!result.data || !result.data.user) return { error: new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.") };
            const response = await sb.from("site_notice").update({ text, updated_at: new Date().toISOString(), updated_by: result.data.user.email || null }).eq("id", 1).select("id").maybeSingle();
            if (!response.error && !response.data) return { error: new Error("저장할 새 소식 항목을 찾지 못했습니다. 다시 불러온 뒤 확인해 주세요.") };
            return response;
          }, "새 소식을 저장했습니다.", { reload: false });
          if (saved) { original = text; await read(); }
        } finally {
          saving = false;
          content.disabled = !loaded;
          retry.disabled = false;
          updatePreview();
        }
      }, "primary", { disabled: true });
      const retry = button("다시 불러오기", () => {
        if (loaded && content.value.trim() !== original && !confirmAction("입력한 내용을 버리고 저장된 새 소식을 다시 불러올까요?")) return;
        read();
      });
      async function read() {
        loaded = false;
        content.disabled = true;
        retry.disabled = true;
        updatePreview();
        info.textContent = "현재 새 소식을 불러오는 중입니다.";
        try {
          const { data, error } = await sb.from("site_notice").select("*").eq("id", 1).maybeSingle();
          if (error) throw error;
          if (!data) {
            info.textContent = "저장할 새 소식 항목이 없습니다. 서버의 기존 새 소식 설정을 확인한 뒤 다시 불러와 주세요.";
            preview.textContent = "새 소식을 사용할 수 없습니다.";
            return;
          }
          original = (data.text || "").trim();
          content.value = data.text || "";
          remember(content);
          loaded = true;
          info.textContent = data.updated_at ? `마지막 수정 ${fmt(data.updated_at)}${data.updated_by ? " · " + data.updated_by : ""}` : "아직 수정 기록이 없습니다.";
          updatePreview();
        } catch (error) {
          info.textContent = failedRead(error);
          preview.textContent = "불러오지 못했습니다. 다시 불러오기를 눌러 주세요.";
        } finally {
          content.disabled = !loaded || saving;
          retry.disabled = saving;
          updatePreview();
        }
      }
      content.addEventListener("input", updatePreview);
      const view = el("div", { class: "adm-stack" },
        field("새 소식 내용", content, "인트라넷 상단에 표시됩니다. 저장하면 변경 기록에 남습니다."),
        actions(save, retry, count), info,
        panel(el("h3", {}, "회원 화면 미리보기"), el("span", { class: "adm-badge" }, "새 소식"), preview));
      read();
      return view;
    }

    function admins() {
      const list = S.members.filter((m) => m.is_admin);
      const candidates = S.members.filter((m) => !m.is_admin && m.status === "active");
      const pick = select("추가할 관리자", [["", "회원을 선택하세요"], ...candidates.map((m) => [m.id, `${m.name || "이름 없음"} · ${m.email || "이메일 없음"}`])], "");
      const add = button("관리자 추가", async () => {
        const member = candidates.find((m) => sameId(m.id, pick.value));
        if (!member) return report("추가할 회원을 선택해 주세요.", pick);
        if (!confirmAction(`${member.name || member.email} 회원에게 관리자 권한을 부여할까요? 회원·등급·메뉴 설정을 관리할 수 있습니다.`)) return;
        await mutate(() => sb.from("members").update({ is_admin: true }).eq("id", member.id), "관리자로 지정했습니다.");
      }, "primary", { disabled: !candidates.length });
      pick.disabled = !candidates.length;
      return el("div", { class: "adm-stack" },
        note(`관리자 ${list.length}명`),
        note("관리자 권한은 등급과 별개입니다. 등급을 바꿔도 유지되며, 마지막 관리자 1명은 해제할 수 없습니다."),
        list.length ? table(["이름", "이메일", "등급", "관리"], list.map((m) => el("tr", {},
          cell(m.name || "이름 없음", m.email && m.email === S.profile.email ? el("span", { class: "adm-badge" }, "내 계정") : null), cell(m.email || "—"), cell(gname(m.grade_id)),
          cell(button("관리자 해제", async () => {
            const own = m.email && m.email === S.profile.email;
            if (!confirmAction(`${m.name || m.email} 회원의 관리자 권한을 해제할까요?${own ? " 내 계정의 관리자 화면 접근도 종료됩니다." : ""}`)) return;
            await mutate(() => sb.from("members").update({ is_admin: false }).eq("id", m.id), "관리자 권한을 해제했습니다.");
          }, "danger", { disabled: list.length <= 1, "aria-label": `${m.name || m.email} 관리자 권한 해제` }))
        )), "관리자 목록") : empty("등록된 관리자가 없습니다", "새로고침해 현재 상태를 확인해 주세요."),
        panel(el("h3", {}, "관리자 추가"), field("사용 중인 회원", pick), actions(add),
          candidates.length ? null : note("관리자로 추가할 사용 중인 회원이 없습니다.")));
    }

    function grades() {
      const name = input("새 등급 이름", "", { maxlength: "100", placeholder: "새 등급 이름" });
      const rows = S.grades.map((g) => {
        const nameInput = input(`${g.name} 등급 이름`, g.name || "", { maxlength: "100" });
        const sortInput = input(`${g.name} 표시 순서`, String(g.sort ?? 0), { type: "number", step: "1" });
        const original = { name: (g.name || "").trim(), sort: Number(g.sort ?? 0) };
        const memberCount = S.members.filter((m) => sameId(m.grade_id, g.id)).length;
        return el("tr", {}, cell(sortInput), cell(nameInput), cell(String(memberCount) + "명"),
          cell(g.is_default ? el("span", { class: "adm-badge" }, "가입 기본") : button("기본 등급 지정", async () => {
            if (!confirmAction(`신규 가입자에게 '${g.name}' 등급을 기본으로 지정할까요? 기존 회원의 등급은 유지됩니다.`)) return;
            await mutate(() => sb.from("grades").update({ is_default: true }).eq("id", g.id), "가입 기본 등급을 바꿨습니다.");
          }, "secondary", { "aria-label": `${g.name} 등급을 가입 기본으로 지정` })),
          cell(actions(button("저장", async () => {
            const value = nameInput.value.trim(), sort = numberValue(sortInput);
            const patch = changedFields(original, { name: value, sort });
            if (!Object.keys(patch).length) return unchanged();
            if ("name" in patch && !value) return report("등급 이름을 입력해 주세요.", nameInput);
            if ("sort" in patch && sort === null) return report("표시 순서는 정수로 입력해 주세요.", sortInput);
            if ("name" in patch && S.grades.some((other) => !sameId(other.id, g.id) && other.name === value)) return report("이미 있는 등급 이름입니다.", nameInput);
            await mutate(() => sb.from("grades").update(patch).eq("id", g.id), "등급 변경을 저장했습니다.");
          }, "primary", { "aria-label": `${g.name} 등급 변경 저장` }), button("삭제", async () => {
            if (!confirmAction(`'${g.name}' 등급을 삭제할까요? 이 등급에 지정한 메뉴 권한도 함께 확인해 주세요.`)) return;
            await mutate(() => sb.from("grades").delete().eq("id", g.id), "등급을 삭제했습니다.");
          }, "danger", { disabled: memberCount > 0, "aria-label": `${g.name} 등급 삭제` }))));
      });
      return el("div", { class: "adm-stack" },
        note("이름·순서를 편집한 뒤 해당 행의 저장을 눌러 주세요. 가입 기본 등급은 새 회원에게 적용됩니다. 회원이 있는 등급은 다른 등급으로 옮긴 후 삭제할 수 있습니다."),
        rows.length ? table(["표시 순서", "등급 이름", "회원 수", "가입 기본", "관리"], rows, "회원 등급 설정") : empty("등록된 등급이 없습니다", "새 등급을 추가해 주세요."),
        panel(el("h3", {}, "등급 추가"), field("새 등급 이름", name), actions(button("등급 추가", async () => {
          const value = name.value.trim();
          if (!value) return report("새 등급 이름을 입력해 주세요.", name);
          if (S.grades.some((g) => g.name === value)) return report("이미 있는 등급 이름입니다.", name);
          await mutate(() => sb.from("grades").insert({ name: value, sort: nextSort(S.grades) }), "새 등급을 추가했습니다.");
        }, "primary"), button("등급별 메뉴 권한 설정", () => go("matrix")))));
    }

    function branches() {
      const no = input("추가할 본부 번호", "", { inputmode: "numeric", maxlength: "20", placeholder: "예: 227" });
      const url = input("추가할 본부 주소", "", { placeholder: "https://…", inputmode: "url" });
      const list = S.branches || [];
      return el("div", { class: "adm-stack" },
        note("메인 '함께하는 본부'에는 번호만 표시됩니다. 주소를 비우면 '연결 준비 중'으로 보입니다. 이름·전화번호는 입력하지 않습니다."),
        list.length ? table(["본부", "연결 주소", "표시 순서", "메인 표시", "관리"], list.map((branch) => {
          const link = input(`${branch.no}본부 연결 주소`, branch.url || "", { placeholder: "연결 준비 중", inputmode: "url" });
          const sort = input(`${branch.no}본부 표시 순서`, String(branch.sort ?? 0), { type: "number", step: "1" });
          const visible = check(`${branch.no}본부 메인 표시`, branch.visible);
          const original = { url: (branch.url || "").trim() || null, sort: Number(branch.sort ?? 0), visible: !!branch.visible };
          return el("tr", {}, cell(`${branch.no}본부`), cell(link), cell(sort), cell(field("표시", visible)),
            cell(actions(button("저장", async () => {
              const address = link.value.trim(), order = numberValue(sort);
              const patch = changedFields(original, { url: address || null, sort: order, visible: visible.checked });
              if (!Object.keys(patch).length) return unchanged();
              if ("url" in patch && !validUrl(address)) return report("주소는 https:// 또는 http://로 시작하거나 /로 시작하는 사이트 경로를 입력해 주세요.", link);
              if ("sort" in patch && order === null) return report("표시 순서는 정수로 입력해 주세요.", sort);
              await mutate(() => sb.from("branches").update({ ...patch, updated_at: new Date().toISOString() }).eq("no", branch.no), "본부 설정을 저장했습니다.");
            }, "primary", { "aria-label": `${branch.no}본부 설정 저장` }), button("삭제", async () => {
              if (!confirmAction(`${branch.no}본부를 목록에서 삭제할까요?`)) return;
              await mutate(() => sb.from("branches").delete().eq("no", branch.no), "본부를 삭제했습니다.");
            }, "danger", { "aria-label": `${branch.no}본부 삭제` }))));
        }), "본부 표시 설정") : empty("등록된 본부가 없습니다", "아래에서 본부 번호와 연결 주소를 추가해 주세요."),
        panel(el("h3", {}, "본부 추가"), el("div", { class: "adm-form-grid" }, field("본부 번호", no), field("연결 주소", url, "비워 두면 연결 준비 중으로 표시됩니다.")),
          actions(button("본부 추가", async () => {
            const number = no.value.trim(), address = url.value.trim();
            if (!/^\d+$/.test(number)) return report("본부 번호는 숫자로 입력해 주세요.", no);
            if (list.some((branch) => String(branch.no) === number)) return report("이미 있는 본부입니다. 위 목록에서 수정해 주세요.", no);
            if (!validUrl(address)) return report("올바른 본부 페이지 주소를 입력해 주세요.", url);
            await mutate(() => sb.from("branches").upsert({ no: number, url: address || null, sort: nextSort(list) }), "본부를 추가했습니다.");
          }, "primary"))));
    }

    function resources() {
      const search = input("페이지·도구 검색", "", { type: "search", placeholder: "이름·분류·설명·주소 검색", "data-draft": "false" });
      const kindFilter = select("종류 필터", [["", "모든 종류"], ["tool", "도구"], ["page", "페이지"]], "");
      const activeFilter = select("표시 상태 필터", [["", "모든 표시 상태"], ["active", "사용 중"], ["hidden", "숨김"]], "");
      kindFilter.setAttribute("data-draft", "false");
      activeFilter.setAttribute("data-draft", "false");
      const count = el("p", { class: "adm-note", role: "status" });
      const body = el("div", { class: "adm-stack" });
      const createFields = (resource, prefix) => ({
        kind: select(`${prefix} 종류`, [["tool", "도구"], ["page", "페이지"]], resource.kind || "tool"),
        category: input(`${prefix} 분류`, resource.category || "", { maxlength: "100", placeholder: "예: 영업 지원" }),
        name: input(`${prefix} 이름`, resource.name || "", { maxlength: "200" }),
        url: input(`${prefix} 주소`, resource.url || "", { placeholder: "https://… 또는 /사이트경로/", inputmode: "url" }),
        description: el("textarea", { class: "adm-input", "aria-label": `${prefix} 설명`, "data-draft": "true", rows: "2", value: resource.description || "" }),
        active: check(`${prefix} 회원 메뉴 표시`, resource.active !== false)
      });
      const fieldsView = (f) => el("div", { class: "adm-form-grid" }, field("종류", f.kind), field("분류", f.category), field("이름", f.name), field("주소", f.url), field("설명", f.description), field("회원 메뉴에 표시", f.active));
      const values = (f, original) => {
        const name = f.name.value.trim(), url = f.url.value.trim();
        const next = { kind: f.kind.value, category: f.category.value.trim() || "기타", name, url: url || null, description: f.description.value.trim() || null, active: f.active.checked };
        const patch = original ? changedFields(original, next) : next;
        if (!Object.keys(patch).length) return unchanged();
        if ("name" in patch && !name) return report("페이지·도구 이름을 입력해 주세요.", f.name);
        if ("url" in patch && !validUrl(url)) return report("주소는 https:// 또는 http://로 시작하거나 /로 시작하는 사이트 경로를 입력해 주세요.", f.url);
        return patch;
      };
      // 필터를 바꿔도 카드의 입력 상태를 유지합니다.
      // TASK-ADM: 'AI 질문' 줄은 메뉴 권한 화면에서만 관리합니다(종류를 바꾸면 질문 권한이 풀리지 않게 여기서는 제외).
      const cards = S.resources.filter((resource) => resource.kind !== "ai").map((resource) => {
        const f = createFields(resource, resource.name || "메뉴");
        const original = {
          kind: resource.kind || "tool", category: (resource.category || "").trim() || "기타", name: (resource.name || "").trim(),
          url: (resource.url || "").trim() || null, description: (resource.description || "").trim() || null, active: resource.active !== false
        };
        const detail = el("details", { class: "adm-panel" },
          el("summary", {}, el("strong", {}, resource.name || "이름 없음"), " ", el("span", { class: "adm-badge" }, resource.kind === "tool" ? "도구" : "페이지"), " ", el("span", { class: "adm-badge" }, resource.active ? "사용 중" : "숨김"), " · ", resource.category || "기타"),
          el("div", { class: "adm-stack" }, fieldsView(f), actions(button("변경 저장", async () => {
            const value = values(f, original);
            if (!value) return;
            await mutate(() => sb.from("resources").update(value).eq("id", resource.id), "페이지·도구 설정을 저장했습니다.");
          }, "primary", { "aria-label": `${resource.name} 변경 저장` }), button("메뉴 권한 설정", () => go("matrix")))));
        return { resource, detail };
      });
      const draw = () => {
        const query = search.value.trim().toLocaleLowerCase("ko-KR");
        const matches = cards.filter(({ resource: r }) => (!query || [r.name, r.category, r.description, r.url].join(" ").toLocaleLowerCase("ko-KR").includes(query)) && (!kindFilter.value || r.kind === kindFilter.value) && (!activeFilter.value || (activeFilter.value === "active" ? !!r.active : !r.active)));
        count.textContent = `${matches.length}개 표시 · 전체 ${cards.length}개 · AI 질문은 메뉴 권한 화면에서 관리`;
        body.replaceChildren(...(matches.length ? matches.map((item) => item.detail) : [empty("조건에 맞는 메뉴가 없습니다", "검색어나 필터를 바꿔 다시 확인해 주세요.")]));
      };
      search.addEventListener("input", draw);
      kindFilter.addEventListener("change", draw);
      activeFilter.addEventListener("change", draw);
      draw();
      const f = createFields({}, "새 페이지·도구");
      return el("div", { class: "adm-stack" },
        note("편집 후 저장하세요. 새 메뉴는 이용 등급도 지정하세요."),
        el("div", { class: "adm-toolbar" }, field("페이지·도구 검색", search), field("종류", kindFilter), field("표시 상태", activeFilter)), count, body,
        el("details", { class: "adm-panel" }, el("summary", {}, "새 페이지·도구 추가"), el("div", { class: "adm-stack" }, fieldsView(f), actions(button("페이지·도구 추가", async () => {
          const value = values(f);
          if (!value) return;
          await mutate(() => sb.from("resources").insert({ ...value, sort: nextSort(S.resources) }), "페이지·도구를 추가했습니다. 메뉴 권한에서 사용할 등급을 지정해 주세요.");
        }, "primary")))));
    }

    function audit() {
      const body = el("div", { class: "adm-stack" });
      const count = el("p", { class: "adm-note", role: "status" }, "변경 기록을 불러오는 중입니다.");
      const search = input("변경 기록 검색", "", { type: "search", placeholder: "처리자·대상·변경 내용 검색", "data-draft": "false" });
      const target = select("변경 기록 대상", [["", "모든 대상"], ["members", "회원"], ["grades", "등급"], ["grade_permissions", "메뉴 권한"], ["resources", "페이지·도구"], ["branches", "본부"], ["site_notice", "새 소식"], ["articles", "작성글모음"], ["article_claims", "작성글 보관 기록"]], "");
      target.setAttribute("data-draft", "false");
      let records = [];
      const tableNames = { members: "회원", grades: "등급", grade_permissions: "메뉴 권한", resources: "페이지·도구", branches: "본부", site_notice: "새 소식", articles: "작성글모음", article_claims: "작성글 보관 기록" };
      const actionNames = { insert: "추가", update: "변경", delete: "삭제", reject: "가입 거절", export: "내려받기" };
      const fieldNames = { name: "이름", branch: "소속", phone: "연락처", email: "이메일", grade_id: "등급 ID", status: "상태", is_admin: "관리자", memo: "메모", suspend_reason: "정지 사유", suspended_at: "정지 시각", kind: "종류", category: "분류", description: "설명", url: "주소", active: "사용", sort: "순서", is_default: "가입 기본", no: "본부 번호", visible: "메인 표시", text: "새 소식", grade_permissions: "메뉴 권한", resource_id: "메뉴 ID", ask_daily_limit: "AI 하루 질문 횟수", export_kind: "내려받은 파일", export_count: "인원 수", article_titles: "지운 글", claimed_count: "그중 보관된 글" };
      const printable = (value) => value == null ? "없음" : typeof value === "object" ? JSON.stringify(value) : String(value);
      const changes = (record) => {
        const detail = record.detail || {}, before = detail.before || {}, after = detail.after || {};
        return [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((key) => !["updated_at", "approved_at", "approved_by"].includes(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
          .map((key) => `${fieldNames[key] || key}: ${printable(before[key])} → ${printable(after[key])}`).join("\n") || "상세 변경 내용이 없습니다.";
      };
      const draw = () => {
        const query = search.value.trim().toLocaleLowerCase("ko-KR");
        const shown = records.filter((record) => (!target.value || record.target_table === target.value) && (!query || [record.actor_email, tableNames[record.target_table] || record.target_table, record.target_id, changes(record)].join(" ").toLocaleLowerCase("ko-KR").includes(query)));
        count.textContent = `최근 ${records.length}건 중 ${shown.length}건 표시 · 최대 300건`;
        body.replaceChildren(shown.length ? table(["시각", "처리자", "대상", "작업", "변경 내용"], shown.map((record) => {
          const detail = record.detail || {}, before = detail.before || {}, after = detail.after || {};
          return el("tr", {}, cell(fmt(record.at)), cell(record.actor_email || "시스템"), cell(`${tableNames[record.target_table] || record.target_table || "—"} · ${after.email || after.name || before.email || before.name || record.target_id || ""}`),
            cell(actionNames[record.action] || record.action || "—"), cell(el("details", {}, el("summary", {}, "변경 내용"), el("p", { class: "adm-audit-detail" }, changes(record)))));
        }), "최근 변경 기록") : empty(records.length ? "조건에 맞는 기록이 없습니다" : "아직 변경 기록이 없습니다", records.length ? "검색어나 대상을 바꿔 주세요." : "관리자가 설정을 변경하면 기록이 표시됩니다."));
      };
      const reload = button("기록 새로고침", read);
      async function read() {
        reload.disabled = true;
        search.disabled = true;
        target.disabled = true;
        count.textContent = "변경 기록을 불러오는 중입니다.";
        try {
          const { data, error } = await sb.from("audit_log").select("*").order("id", { ascending: false }).limit(300);
          if (error) throw error;
          records = data || [];
          draw();
        } catch (error) {
          count.textContent = "변경 기록을 불러오지 못했습니다.";
          body.replaceChildren(empty("기록을 확인할 수 없습니다", failedRead(error)), button("다시 시도", read));
        } finally {
          reload.disabled = false;
          search.disabled = false;
          target.disabled = false;
        }
      }
      search.addEventListener("input", draw);
      target.addEventListener("change", draw);
      const view = el("div", { class: "adm-stack" }, el("div", { class: "adm-toolbar" }, field("기록 검색", search), field("변경 대상", target), reload), count, body);
      read();
      return view;
    }

    function backup() {
      // 헤더(등급 이름 포함)와 값 모두 동일하게 처리합니다. 탭·CR/LF·수식 선행 문자는 엑셀 실행을 막습니다.
      const csvCell = (value) => {
        let text = String(value ?? "");
        if (/^[\t\r\n]/.test(text) || /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
      };
      const csv = (headers, rows) => "\ufeff" + [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
      const download = (name, content) => {
        let objectUrl;
        let anchor;
        try {
          objectUrl = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
          anchor = el("a", { href: objectUrl, download: name, hidden: true });
          document.body.append(anchor);
          anchor.click();
          toast("CSV 파일 다운로드를 시작했습니다.");
        } catch (_) {
          toast("다운로드를 시작하지 못했습니다. 브라우저의 다운로드 설정을 확인해 주세요.", true);
        } finally {
          if (anchor) anchor.remove();
          if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
      };
      const date = new Date().toISOString().slice(0, 10);
      return el("div", { class: "adm-stack" },
        panel(el("h3", {}, "회원 CSV"), note("이름·소속·연락처·이메일·등급·승인 상태와 관리 메모를 내려받습니다. 개인정보가 포함되므로 접근이 제한된 장소에 보관해 주세요."),
          actions(button("회원 CSV 내려받기", () => {
            const columns = ["name", "branch", "phone", "email", "grade", "status", "is_admin", "suspend_reason", "suspended_at", "approved_at", "created_at", "memo"];
            download(`회원_${date}.csv`, csv(columns, S.members.map((member) => columns.map((key) => key === "grade" ? gname(member.grade_id) : member[key]))));
            sb.rpc("log_admin_export", { p_kind: "backup_members_csv", p_count: S.members.length }).then(() => {}, () => {}); // TASK-ADM: 내려받은 기록 남김
          }, "primary"))),
        panel(el("h3", {}, "등급별 메뉴 권한 CSV"), note("전체 페이지·도구와 등급별 메뉴 권한을 내려받습니다. 허용한 항목은 O로 표시됩니다."),
          actions(button("권한표 CSV 내려받기", () => {
            const headers = ["category", "name", ...S.grades.map((grade) => grade.name)];
            const rows = S.resources.map((resource) => [resource.category, resource.name, ...S.grades.map((grade) => S.perms.has(grade.id + ":" + resource.id) ? "O" : "")]);
            download(`권한표_${date}.csv`, csv(headers, rows));
          }))),
        panel(el("h3", {}, "자동 백업 안내"), note("기존 운영 안내: Mac mini가 매일 새벽 회원·등급·권한 전체를 NAS 접근제한 폴더에 암호 파일로 저장하며 30일치를 보관합니다."),
          note("이 화면에는 자동 백업의 최근 실행 결과가 연결되어 있지 않습니다.")));
    }

    return { notice, admins, grades, branches, resources, audit, backup };
  };
})();
