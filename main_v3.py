# HOME-22 메인(/) = 웹 조사 기반 배치안(이사님 결정 2026-11-01). 내용 원본은 home.py, 순서·묶음만 새로. (샘알트만)
# 전체 연혁·방향과 목표 10개·일하는 방식 원문은 /story/ 별도 페이지로. 자주 쓰는 링크는 인트라넷 바로가기로 옮김.
import re, html
import theme, home

KAKAO = "https://open.kakao.com/o/sFMF26y"
TEL = "010-8714-9262"
def join_btn(label="합류 문의 (카카오 오픈채팅)"):
    return f"<div class='wf-btns big'><a class='pri' href='{KAKAO}' target='_blank' rel='noopener'>{label}</a></div>"
SMALL_TOP = "<style>.wf-bar .wf-btns a{padding:3px 8px;font-size:12px}.wf-btns.big a{padding:14px 26px;font-size:18px;font-weight:700}" \
            "details.faq{border:1px solid var(--line);padding:8px 12px;margin:6px 0;background:#fff}details.faq summary{cursor:pointer;font-weight:700}</style>"

TOP4 = ["2017.03", "2019.10", "2021.07", "2025.12", "2026.03"]
NUMS = [("19개", "함께하는 본부 (2026년 10월)"), ("1,123명", "CY'25 실가동 설계사 · 전국 사무실 62개"),
        ("50억 2,332만 원", "CY'25 장기 인보장성 월 보험료 · 계약 77,000건"), ("2021년부터 1위", "188계열 합계, 프라임에셋 본부 단위 비교 (팜스)")]
WHY = [("경력자", "수수료가 투명합니다", "본사가 설계사에게 직접 지급하고, 매달 수수료표·시책·영업규정을 공개합니다. 팜스에서 계약별 수수료를 원 단위로 확인할 수 있습니다. 몸값 선지급 대신 공개된 규정으로 대우합니다."),
       ("경력자", "규정대로 승격되고, 설계사가 먼저인 본부", "설계사 → 팀장 → 지사장 → 본부장. 규정을 채우면 자동 승격되고, 누구나 노력하면 관리자가 될 수 있습니다. 조직에 충성을 요구하지 않고, 설계사의 성공을 조직의 성공으로 봅니다."),
       ("신입", "전문가로 키우는 교육", "보상·온라인영업 등 교육을 매뉴얼로 만들어 분야별 전문가가 함께합니다. 월 1회 실전 강의, 익명 질문방(늅늅방), 바른 영업을 지향합니다."),
       ("신입", "AI 도구와 자료가 준비돼 있습니다", "회원 전용 AI 영업도구와 보험정보 카페 자료 3,200여 건. 출퇴근 자유·아침 조회 없이, 설계·심사 지원을 받아 스스로 성과를 만듭니다.")]
PRIME3 = ["초대형 GA 프라임에셋(설계사 1만여 명)의 독립 법인 구조, 영업규정집 공개.",
          "수수료는 본사가 직접 지급하고 매달 수수료표·시책을 공개합니다.",
          "규정 충족 시 자동 승격, 본사 조직도·담당 연락처와 직급별 교육 지원."]

def render(MENU):
    cap, frm = [], {}
    ob, of = theme.box, theme.frame
    theme.box = lambda n, name, desc, inner="", bid="": cap.append((bid, name, desc, inner)) or ""
    theme.frame = lambda path, title, M, body, **kw: frm.update(path=path, title=title, kw=kw) or ""
    try:
        home.home(MENU)
    finally:
        theme.box, theme.frame = ob, of
    S = {bid: (name, desc, inner) for bid, name, desc, inner in cap}
    parts = {re.match(r"<h3>(.*?)</h3>", p).group(1): p for p in re.split(r"(?=<h3>)", S["about"][2])[1:]}
    tl = re.findall(r"<li><b>([\d.]+)</b> (.*?)</li>", parts["성장 스토리 (연혁)"])
    faq = re.findall(r"<dt><b>Q\. (.*?)</b></dt><dd>A\. (.*?)</dd>", parts["자주 묻는 질문"])
    tools = re.findall(r"<a class='wf-item'[^>]*>.*?</a>", S["tools"][2])
    assert len(tl) == 26 and len(faq) == 8 and len(tools) == 15, (len(tl), len(faq), len(tools))
    contact = S["contact"][2]
    contact = re.sub(r"<div class='wf-btns'>.*?</div>$", "", contact)
    contact = contact.replace("<br>이직 및 기타 문의", f"<br>카카오 오픈채팅: <a href='{KAKAO}' target='_blank' rel='noopener'>{KAKAO}</a><br>이직 및 기타 문의")
    assert KAKAO in contact and f"tel:{TEL}" in contact
    b = theme.box
    n = iter(range(2, 40))
    body = (
        b(next(n), "첫 화면", "한 줄 문구와 큰 '합류 문의' 버튼(카카오 오픈채팅 새 창).",
          "<p style='font-size:24px;font-weight:700;margin:8px 0'>19개 본부, 1,100명 설계사가 함께 성장하는 곳</p>"
          "<p>프라임에셋 프리미엄사업부 · 설계사의 가치를 최우선으로 생각합니다.</p>" + join_btn(), "hero")
        + b(next(n), "큰 숫자", "공개용 큰 숫자 4개(마감된 기간 기준). 세부 표는 로그인 후 인트라넷.",
            "<div class='wf-grid'>" + "".join(f"<div class='wf-item'><b>{a}</b><small>{c}</small></div>" for a, c in NUMS) + "</div>", "numbers")
        + b(next(n), "왜 우리인가", "일하는 방식·방향과 목표를 혜택 4개로 합침. 경력자용(수수료·제도) 먼저, 신입용(교육·AI 도구) 다음.",
            "".join(f"<div class='wf-item' style='margin:6px 0'><small>{who}에게</small><b>{t}</b><p>{d}</p></div>" for who, t, d in WHY)
            + "<p><a href='story/'>방향과 목표 10개 · 일하는 방식 원문 보기 →</a></p>" + join_btn("합류 문의하기"), "why")
        + b(next(n), "도구 소개", "대표 4개 + 전부 보기(누르면 펼침). 누르면 회원가입.",
            "<div class='wf-grid'>" + "".join(tools[:4]) + "</div>"
            "<details class='faq'><summary>전부 보기 (AI 도구 9개 · 교육·정보 채널 6개)</summary><div class='wf-grid'>" + "".join(tools[4:]) + "</div></details>", "tools")
        + b(next(n), "프라임에셋 제도 요약", "3줄 요약. 영업규정·수수료·승격 기준 세부 자료는 로그인 후 인트라넷.",
            "<ul>" + "".join(f"<li>{x}</li>" for x in PRIME3) + "</ul><p class='wf-desc'>자세한 자료: 로그인 후 인트라넷 '프리미엄 안내 자료'.</p>", "prime")
        + b(next(n), "설계사 후기", "함께하는 설계사의 이야기가 들어갈 자리.", "<p>준비 중입니다.</p>", "reviews")
        + b(next(n), "김상현 이사 소개", "짧은 소개 + 대표 연혁 5개(전체 연혁은 별도 페이지).",
            "<p>프라임에셋 이사, 프리미엄사업부 대표. 2017년 188본부를 시작으로 19개 본부 연합으로 키웠습니다. 2021·2022년 MVP 2년 연속, 2021년 명예이사.</p>"
            "<ul>" + "".join(f"<li><b>{d}</b> {t}</li>" for d, t in tl if d in TOP4) + "</ul><p><a href='story/'>전체 연혁 26개 보기 →</a></p>", "ceo")
        + b(next(n), "함께하는 본부", S["branches"][1], S["branches"][2], "branches")
        + b(next(n), "자주 묻는 질문", "질문을 누르면 답이 펼쳐집니다.",
            "".join(f"<details class='faq'><summary>Q. {q}</summary><p>A. {a}</p></details>" for q, a in faq), "faq")
        + b(next(n), "합류 문의 · 연락처", "마지막 합류 문의 버튼, 전화(누르면 전화)·카카오 오픈채팅, 주소·사업자 정보.",
            join_btn() + contact, "contact")
    )
    main = theme.frame(frm["path"], frm["title"], MENU, body, head_extra=SMALL_TOP, **{k: v for k, v in frm["kw"].items() if k != "head_extra"})
    # /story/ : 전체 연혁 + 방향과 목표 + 일하는 방식 원문
    sb = (b(2, "성장 스토리 (전체 연혁)", "2017.03~2026.04 연혁 26개.", "<ul>" + "".join(f"<li><b>{d}</b> {t}</li>" for d, t in tl) + "</ul>", "history")
          + b(3, "방향과 목표", "10개.", parts["방향과 목표"][len("<h3>방향과 목표</h3>"):], "goals")
          + b(4, "우리는 이렇게 일해요", "설계사의 하루(기존 사이트 글 요약).", parts["우리는 이렇게 일해요"][len("<h3>우리는 이렇게 일해요</h3>"):], "work")
          + b(5, "합류 문의", "카카오 오픈채팅 새 창 · 전화.", join_btn() + f"<p>전화 <a href='tel:{TEL}'>{TEL}</a></p>", "contact"))
    story = theme.frame("story/", "성장 스토리 · 방향과 목표 — 프라임에셋 프리미엄", MENU, sb, head_extra=SMALL_TOP)
    return main, story
