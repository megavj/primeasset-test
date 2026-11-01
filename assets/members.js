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
  const D = (t) => el("p", { class: "wf-desc" }, t);
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
    const su = location.hash === "#signup";
    show(el("div", { class: "pa-card" }, el("p", { style: "font-size:18px;font-weight:700;margin:4px 0" }, "가입하면 도구 24개와 실적 자료를 쓸 수 있습니다.")),
      el("div", { class: "pa-card" }, el("h3", {}, su ? "회원가입 · 로그인" : "로그인"),
        D("섹션 설명: 구글 계정 버튼 하나로 로그인. 처음이면 로그인하는 순간 가입 신청이 됩니다."),
        el("button", { class: "lux-btn lux-btn--gold", onclick: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here } }) }, "구글 계정으로 로그인"),
        el("details", { style: "margin-top:10px" }, el("summary", {}, "구글 계정이 없으면: 이메일로 로그인"),
          el("div", { class: "pa-row" }, email,
            el("button", { class: "lux-btn lux-btn--ghost", onclick: async () => {
              if (!/^\S+@\S+\.\S+$/.test(email.value)) { out.textContent = "이메일 주소를 확인해 주세요."; return; }
              const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: here } });
              out.textContent = error ? "보내기 실패: " + error.message : "메일함에서 로그인 링크를 눌러 주세요. (스팸함도 확인)";
            } }, "인증 메일 받기"))),
        out),
      el("div", { class: "pa-card" }, el("h3", {}, "가입 · 승인 · 이용 3단계"),
        el("ol", {}, el("li", {}, el("b", {}, "가입: "), "구글로 로그인 → 이름·소속 본부·휴대폰 입력, 개인정보 동의"),
          el("li", {}, el("b", {}, "승인: "), "관리자가 확인하고 등급을 정합니다"),
          el("li", {}, el("b", {}, "이용: "), "등급에 맞는 AI 도구·실적 자료가 열립니다 (승인 전에는 🔒)"))),
      el("div", { class: "pa-card" }, el("h3", {}, "연락처"), D("섹션 설명: 가입·승인 문의."),
        el("p", {}, "프라임에셋 이사 김상현 · 전화 ", el("a", { href: "tel:010-8714-9262" }, "010-8714-9262"), " · ",
          el("a", { href: "https://open.kakao.com/o/sFMF26y", target: "_blank", rel: "noopener" }, "카카오 오픈채팅"))));
  }

  function profileView(p) {
    const n = el("input", { class: "pa-in", placeholder: "이름" });
    const b = el("input", { class: "pa-in", placeholder: "소속 본부·지사 (예: 188본부)" });
    const ph = el("input", { class: "pa-in", placeholder: "휴대폰 번호", type: "tel" });
    const ok = el("input", { type: "checkbox", id: "pa-consent" });
    const out = el("p", { class: "pa-note" });
    show(el("div", { class: "pa-card" },
      el("h3", {}, "가입 정보 입력"), D("섹션 설명: 처음 로그인한 분만 보임. 이름·소속 본부·휴대폰 번호와 [필수] 개인정보 수집 동의 체크."), el("p", {}, `로그인 계정: ${p.email || ""}`), n, b, ph,
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
    const head = el("div", { style: "display:flex;justify-content:flex-end;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;margin:0 0 6px" },
      el("span", {}, el("b", {}, `${p.name || p.email}`), ` · ${p.grade || ""}${p.is_admin ? " · 관리자" : ""} · 열린 메뉴 ${open}/${data.length}`),
      p.is_admin ? el("a", { class: "lux-btn lux-btn--gold lux-btn--sm", href: "admin/" }, "관리자 화면") : null, logoutBtn());
    const links = el("div", { class: "pa-card" }, el("h3", {}, "바로가기"), D("섹션 설명: 보험위키·188 영업지원시스템·보험노트·프라임에셋 본사·이사님 페이스북·기존 사이트 (메인 '자주 쓰는 링크'에서 옮김)."), el("ul", { class: "pa-list" },
      el("li", {}, el("a", { href: "http://wiki.primeasset.info/", target: "_blank", rel: "noopener" }, "보험위키"), el("small", {}, " — 보장·용어·청구 가이드")),
      el("li", {}, el("a", { href: "https://188.primeasset.info/", target: "_blank", rel: "noopener" }, "188 영업지원시스템")),
      el("li", {}, el("a", { href: "https://bohumnote.com/", target: "_blank", rel: "noopener" }, "보험노트")),
      el("li", {}, el("a", { href: "http://primeasset.kr/", target: "_blank", rel: "noopener" }, "프라임에셋 본사")),
      el("li", {}, el("a", { href: "https://www.facebook.com/ksh1629", target: "_blank", rel: "noopener" }, "김상현 이사 페이스북")),
      el("li", {}, el("a", { href: "https://www.primeasset.info/", target: "_blank", rel: "noopener" }, "기존 프리미엄 사이트"))));
    const cards = Object.entries(groups).map(([cat, rs]) => el("div", { class: "pa-card" }, el("h3", {}, cat), D("섹션 설명: 이 분류의 도구·링크. 등급 권한이 있으면 열리고, 없으면 🔒 잠금(주소는 내려오지 않음)."),
      el("ul", { class: "pa-list" }, ...rs.map(r => el("li", { class: r.unlocked ? "" : "pa-locked" },
        r.unlocked ? (r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.name) : el("span", {}, r.name + " (준비 중)"))
                   : el("span", { title: "승인·권한이 필요합니다" }, "🔒 " + r.name),
        r.description ? el("small", {}, " — " + r.description) : null)))));
    const FAV = /상품통합|보장분석|약관|설계|청약|AI/;
    const PRI = [/상품\s*통합/, /수당/, /상품\s*분석/, /전산\s*답변/, /보상/, /자료\s*검색/];
    const ok = data.filter(r => r.unlocked && r.url);
    const favs = [...new Set([...PRI.map(rx => ok.find(r => rx.test(r.name))).filter(Boolean), ...ok.filter(r => FAV.test(r.name) || FAV.test(r.category || "")), ...ok])].slice(0, 6);
    const fav = el("div", { class: "pa-card" }, el("h3", {}, "자주 쓰는 AI 도구"),
      D("섹션 설명: 자주 쓰는 AI 도구 6개(상품통합분석기·수당계산기·상품분석기·전산답변기·보상답변기·자료검색기 순). 권한 있는 도구만 보입니다."),
      favs.length ? el("ul", { class: "pa-list" }, ...favs.map(r => el("li", {}, el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.name), r.description ? el("small", {}, " — " + r.description) : null)))
                  : el("p", { class: "pa-note" }, "🔒 승인 후 열립니다."));
    const allHead = el("div", { class: "pa-card" }, el("h3", {}, "전체 도구 메뉴"), D("섹션 설명: 분류별 전체 메뉴. 등급 권한이 있으면 열리고, 없으면 🔒 잠금(주소는 내려오지 않음)."), ...cards);
    const news = el("div", { class: "pa-card" }, el("p", { style: "margin:2px 0" }, el("b", {}, "새 소식 "),
      ""), ...(banner ? [banner] : []));
    sb.from("site_notice").select("text").eq("id", 1).maybeSingle().then(({ data: n }) => { news.firstChild.append(n && n.text ? n.text : "새 소식이 없습니다."); });
    const q = el("input", { class: "pa-in", type: "search", placeholder: "도구 이름이나 설명으로 찾기 (예: 상품, 수당, 약관)", "aria-label": "도구 검색" });
    const hits = el("ul", { class: "pa-list" });
    q.addEventListener("input", () => {
      const k = q.value.trim().toLowerCase();
      hits.replaceChildren(...(!k ? [] : data.filter(r => (r.name + " " + (r.description || "") + " " + (r.category || "")).toLowerCase().includes(k)).map(r =>
        el("li", { class: r.unlocked ? "" : "pa-locked" }, r.unlocked && r.url ? el("a", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.name) : el("span", {}, (r.unlocked ? "" : "🔒 ") + r.name),
          el("small", {}, ` — ${r.category || ""}${r.description ? " · " + r.description : ""}`)))));
      if (k && !hits.children.length) hits.append(el("li", {}, "찾는 도구가 없습니다."));
    });
    const search = el("div", { class: "pa-card" }, el("h3", {}, "도구 검색"), D("섹션 설명: 도구 31개를 이름·설명·분류로 찾기. 권한 없는 도구는 🔒(주소 없음)."), q, hits);
    const stats = await statsCard();
    show(head, news, fav, search, links, stats, allHead, ...infoCards());
  }

  const INFO = [["교육 방향", ["프리미엄은 개개인의 전문화를 목표로 합니다. 자료 공유, 영업 방향 제시, 영업지원시스템 구성.", "이를 위해 늅늅방·정보방·카페·고무공 등을 운영합니다. 편한 영업보다 전문가가 되고 싶은 분을 지향합니다.", "Q&A: 하루에 얼마나 일하나 → 잘하는 분은 최대한 많이 하려 한다 / 초심 유지 → 생활패턴을 단순화(일-휴식 반복) / 약관 활용 → 외울 때까지 보고 적용 / 약한 세일즈 단계(AP·니즈환기·PT) → 집중 공부·연습 / 마감 앞 실적 부진 → 더 영업한다 / 힘들 때 → 더 영업에 집중한다.", "Q. 영업방법들을 보면 정말 어려운 방법도 많은데 그걸 어떻게 하죠? → 잘하는 분: ??(질문 자체가 이해가 안 됨) / 못하는 분: 쉬운 영업을 찾는다.", "Q. 영업하다 너무 힘들 땐 어떻게 해야 하나요? → 잘하는 분: 힘들지만 더 영업에 집중한다 / 못하는 분: 힘드니 쉰다."], [["https://www.primeasset.info/901c7125-6058-442d-b752-2ea048e4899c", "원문 보기"]]], ["보험정보 공유방 (단톡방)", ["프리미엄 산하 정보공유 단톡방. 누구든 필요한 자료를 공유하는 문화.", "상품자료, 리플렛, 인수기준, 주요 공지·안내, 질병 관련 자료 등. 오래 볼 자료는 정보카페로 옮겨 관리."], [["https://www.primeasset.info/81665774-c58c-409d-b515-1088b13fb755", "원문 보기"]]], ["보험정보 공유 카페", ["약 3,200여 개 보험자료 등록 (2025.12 기준).", "운영 원칙: 오래 보관할 자료 저장 / 보험·세무·보상 등 모든 자료 / 영업 방향·가이드 / 새 버전 나오면 기존 글 갱신 / 관련 글끼리 링크로 연결.", "공부자료: 보험경제뉴스, 추천견적·사례, 온라인영업, 기타영업, 강의·공부자료, 질병 자료, 보상자료, 분쟁사례, 추천강의, 영상자료, 블로그 모음, 상품자료, 기타자료.", "업무자료: 마케팅, 프라임에셋 자료, 시험 응시, 업무(+수납) 매뉴얼, 연락처, 보도자료, 리플렛, 보험이미지.", "손해보험 이슈(현대·메리츠·DB·하나·흥국·농협·한화·롯데·KB·삼성·예별·AIG 등), 생명보험 이슈."], [["https://www.primeasset.info/a2418d63-aa59-4abc-868d-0ec0fb67f6df", "원문 보기"]]], ["익명질문&답변방 (늅늅방)", ["프리미엄만의 익명 질문·답변방. 서로 누구인지 몰라도 묻고 답하는 문화가 자리 잡았습니다. 여러 번 개편을 거쳐 정착."], [["https://www.primeasset.info/9ac86671-1eca-4e19-a200-058d36a57a0c", "원문 보기"]]], ["고급정보 무한공유 (전설의 고무공)", ["리크루팅을 위한 영업지원 시스템. 수백 명의 타사 설계사와 정보 공유·소통. 그 밖의 리크루팅 제도도 준비·지원.", "참여 문의: 김상현 이사 010-8714-9262"], [["https://www.primeasset.info/979bd9c5-1680-4c63-8f6f-478ed8a55704", "원문 보기"]]], ["스탠다드 캠퍼스 (최신 교육시스템)", ["교육 → 자료 → 실행까지 연결된 내부 교육 시스템. 오프라인 강의 월 1회 실전 교육.", "상품저장소·디비저장소: 상품 / 화법 / 매뉴얼 / AI툴 / 디비 / 온라인 / 프로세스 / 이슈사항."], [["https://www.primeasset.info/32eb41e1-af69-80d2-9f2d-f40fc29a3ee5", "원문 보기"]]], ["영업규정집", ["프라임에셋은 영업규정집을 공개합니다(위촉·해촉, 관리자 승격·분할, 수수료, 준법 등). 승격 기준과 수수료 지급 기준이 투명하게 공개된다는 뜻입니다.", "다운로드: 프라임에셋_영업규정집_2024.pdf, 영업규정_요약본_2024.pdf (원문 페이지)"], [["https://www.primeasset.info/b94a8b28-d0cd-43da-9093-2aa713546115", "원문·파일 보기"]]], ["수수료 / 시책", ["수수료 총량은 원수사 판매실적·지급 방식, 대리점의 지급 방식(선지급·총량·시책)에 따라 달라집니다. 지급 방식 공개 여부, 매달 수수료표 공유, 급여 역계산 가능 여부를 확인해야 합니다.", "프라임에셋: 본사가 관리자·설계사에게 직접 급여 지급(중간관리자가 손댈 수 없음) / 매달 엑셀 수수료표·시책규정·영업규정 공개 / 상위 관리자와 지급률 협의 가능 / 본사전략시상으로 법인시상의 최대 190% 추가지급(본부장 30%, 지사장 60%, 설계사 100%) / 팜스에서 급여명세서 발행, 모든 계약 수수료·시책 원 단위 역추적 / 프라임 선지급제도.", "자료: 보험모집수수료(연동·고정지급률, 생보·손보, FC소득 예시), 증원수수료, 본부장·지사장 수수료(영업관리·분할·공헌), 시상. 수수료홍보자료(생명 2022.08, 손해 2023.09), 2023 영업규정집."], [["https://www.primeasset.info/f111be50-47d9-4f0a-97b7-922fa1af11cf", "원문·파일 보기"]]], ["승격 기준", ["직급: 설계사 - 팀장 - 지사장 - 본부장. 영업규정 조건을 만족하면 자동 승격(상위 관리자가 임의로 못 바꿈).", "팀장: 분기 전환성적 5천만 원(산하 합산 월납 약 100만 원 내외) / 지사장: 총인원 7명 이상 + 분기 전환성적 2억 원(월납 약 400만 원) / 본부장: 총인원 20명 이상 + 4분기 내 2분기 합산 전환성적 12억 원 이상(월납 약 1천만 원).", "설계사는 기본 연동지급률, 상위 관리자와 고정지급률 협의 가능. 신입·경력에 따라 직급·수수료 일부 조정 가능."], [["https://www.primeasset.info/19db7b3d-38fd-451c-a185-0b9d2670b182", "원문 보기"]]], ["프라임에셋은 어떤 곳인가요", ["초대형 GA, 1만여 명 설계사가 근무하는 독립법인. 소개·연혁·재무정보·판매회사, 공정성·투명성·지속성, 밸류체인, 수수료, CEO 메시지, 지표 및 현황."], [["https://www.primeasset.info/ee68e65a-2196-4af3-9236-0dbfba91ade7", "원문 보기"], ["http://primeasset.kr/", "프라임에셋 본사 사이트"]]], ["본사 지원 시스템", ["본사 조직도와 담당 연락처가 산하 설계사에게 공개됩니다.", "준법감시팀(금소법·심의), 인사행정팀(자격시험·협회등록·위촉), 계약관리팀(생손보 30개사 전담), 영업지원팀(복리후생·영업자료), 경영관리팀(수수료·시책 정산), 리스크관리팀, 재무관리팀, 교육지원팀(직급별·온라인 교육, 상품비교), 시스템지원팀, 미래상상팀.", "본사교육: 직급별(프라임입문·팀장리더십·지사장조직관리·본부장 본부운영), 테마별(신입 FC 입문, 인보험 마스터, 원수사별 심화, 외부강사, 보상특강), 온라인(원데이테마, 수요클래스, 유튜브 라이브 월간프라임, 관리자양성)."], [["https://www.primeasset.info/26b3958c-c24d-4767-9871-0515e8dd8d85", "원문 보기"]]], ["자료 모음", ["보험 카테고리: 보험 일을 하면서 필요한 상품·영업·지식·보상 등의 목적별 분류입니다. 이 카테고리에 있는 항목이 대부분의 보험영업에서 필요한 기초가 됩니다. 큰 분류와 작은 분류까지 실제 사례와 접목해 풀어 나갈 수 있게 하는 것이 목적이며, 책의 목차 같은 역할을 합니다. 파일: 보험 카테고리_바탕화면.zip(바탕화면용 이미지 압축파일), 보험 카테고리_화이트ver.pdf(교육용 출력 파일) — 원문 페이지에서 받습니다.", "프라임에셋 2024 브로슈어(PDF), 프라임에셋 입사설명회(2025.05), 보험 카테고리(바탕화면 이미지·출력용 PDF), 나를 돌아보는 시간(오늘의 한마디), 프리미엄 최신보험뉴스 안내, 2023 연말결산 자료."], [["https://www.primeasset.info/d6e84c39-d252-4882-b12e-1fde5e94ea76", "브로슈어"], ["https://www.primeasset.info/95e25396-d707-4032-b0b9-8353613b9556", "보험 카테고리"], ["https://www.primeasset.info/07d5cc3b-33c4-4bc5-81c5-b5d0a1064611", "나를 돌아보는 시간"], ["https://shorturl.at/byVxc", "최신보험뉴스 안내"], ["https://drive.google.com/drive/folders/1IHJs1d2D7ia48xYqrqvmngezAxyNhfgy?usp=drive_link", "2023 연말결산(구글 드라이브)"]]]];
  const fmt = (v) => /^-?\d{4,}$/.test(v) ? Number(v).toLocaleString("ko-KR") : v;
  function infoCards() {
    return [el("div", { class: "pa-card" }, el("h3", {}, "프리미엄 안내 자료"),
      D("섹션 설명: 기존 사이트(www.primeasset.info)의 교육·정보 채널·프라임에셋 제도 안내. 파일은 원문 페이지에서 받습니다."),
      ...INFO.map(([t, ps, ls]) => el("div", { class: "pa-card" }, el("h3", {}, t), ...ps.map(x => el("p", {}, x)),
        el("p", {}, ...ls.flatMap(([u, n], i) => [i ? " · " : "", el("a", { href: u, target: "_blank", rel: "noopener" }, n + " ↗")])))))];
  }
  async function statsCard() {
    const { data, error } = await sb.rpc("members_stats");
    const card = el("div", { class: "pa-card" }, el("h3", {}, "실적 요약 · 실적 표"),
      D("섹션 설명: 사업부 실적보드(188 사이트 /performance에서 옮김), 프라임에셋 전체·188본부·188계열 실적, 다른 본부 비교, 전환성적. 승인된 회원만 표가 열립니다. 설계사 개인 이름 없음."));
    if (error || !data) { card.append(el("p", { class: "pa-note" }, "자료를 불러오지 못했습니다.")); return card; }
    const dm = data.find(r => r.unlocked && r.key === "division_monthly");
    const tot = dm && dm.rows.find(x => String(x[0]).includes("합계"));
    if (tot) card.append(el("div", { class: "pa-card" }, el("h3", {}, "실적 요약"),
      el("p", {}, `사업부 2026년 1~9월 합계: 월보험료 ${fmt(tot[1])}천원 · 계약 ${fmt(tot[2])}건 (생명 ${fmt(tot[3])} · 손해 ${fmt(tot[4])}천원)`),
      el("p", { class: "pa-note" }, "아래 표를 누르면 펼쳐집니다. 2026-10은 미마감.")));
    for (const r of data) {
      if (!r.unlocked) { card.append(el("div", { class: "pa-card pa-locked" }, el("span", { title: "승인·권한이 필요합니다" }, "🔒 " + r.title))); continue; }
      const t = el("table", { class: "pa-table" }, el("thead", {}, el("tr", {}, ...r.cols.map(c => el("th", {}, c)))),
        el("tbody", {}, ...r.rows.map(row => el("tr", {}, ...row.map(v => el("td", {}, fmt(v)))))));
      card.append(el("details", { class: "pa-card" }, el("summary", {}, r.title + ` (${r.rows.length}줄)`), r.note ? el("p", { class: "pa-note" }, r.note) : null, el("div", { class: "pa-scroll" }, t)));
    }
    return card;
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
