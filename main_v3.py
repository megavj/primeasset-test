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
        ("50억 2,332만 원", "CY'25 장기 인보장성 월 보험료 · 계약 77,000건"), ("프리미엄사업부 1위", "2021년부터 · 사업부(188계열 본부 연합) 합계 기준, 프라임에셋 본부 단위 비교 (팜스)")]
WHY = [("경력자", "수수료가 투명합니다", "본사가 설계사에게 직접 지급하고, 매달 수수료표·시책·영업규정을 공개합니다. 팜스에서 계약별 수수료를 원 단위로 확인할 수 있습니다. 몸값 선지급 대신 공개된 규정으로 대우합니다."),
       ("경력자", "규정대로 승격되고, 설계사가 먼저인 본부", "설계사 → 팀장 → 지사장 → 본부장. 규정을 채우면 자동 승격되고, 누구나 노력하면 관리자가 될 수 있습니다. 조직에 충성을 요구하지 않고, 설계사의 성공을 조직의 성공으로 봅니다."),
       ("신입", "전문가로 키우는 교육", "보상·온라인영업 등 교육을 매뉴얼로 만들어 분야별 전문가가 함께합니다. 월 1회 실전 강의, 익명 질문방(늅늅방), 바른 영업을 지향합니다."),
       ("신입", "AI 도구와 자료가 준비돼 있습니다", "회원 전용 AI 영업도구와 보험정보 카페 자료 3,200여 건. 출퇴근 자유·아침 조회 없이, 설계·심사 지원을 받아 스스로 성과를 만듭니다.")]
PRIME3 = ["초대형 GA 프라임에셋(설계사 1만여 명)의 독립 법인 구조, 영업규정집 공개.",
          "수수료는 본사가 직접 지급하고 매달 수수료표·시책을 공개합니다.",
          "규정 충족 시 자동 승격, 본사 조직도·담당 연락처와 직급별 교육 지원."]

PARTNER = "<div class='wf-item' style='margin:6px 0'><b>저와 이직미팅 한번 하시죠!</b><p>저희는 준비된 동행자입니다. 많은 과정을 겪고, 결과물들을 만든 경험이 있는 조직입니다. 어떤 부분이 준비되어 있고, 어떤 비전을 가질 수 있는지 이야기드리겠습니다.</p><p>수수료 얼마 줄게, 디비 얼마 줄게 이런 이야기를 드리고 싶지 않습니다. 다만, 최선을 다해 환경을 제공할 것이며, 최고의 대우를 하도록 노력하겠습니다.</p><p>당신이 다니는 회사나 타 조직을 깎아내리며 저를 포장하고 싶지 않습니다. 다만, 저와 당신의 이야기를 하고 싶습니다. 우리가 보험설계사로서 10년 20년 그 이상을 보고 매년 성장할 수 있는 이야기를 하고 싶습니다.</p><p>무엇이 중요한지 우리는 알고 있습니다. 나의 성장이 아니라 우리의 성장을 목표로 합니다. 당신의 열정에 불을 붙이겠습니다. 그러니 우리 진지하게 이직미팅 한번 하시죠 ^^</p><p style='text-align:right'>프라임에셋 이사 김상현</p></div>"
B188 = "<div class='wf-item' style='margin:8px 0'><b>188본부</b><ul><li>같이의 가치로, 함께 성장합시다</li><li>온라인영업 플랫폼 제공</li><li>격에 맞는 수수료와 시책 제공</li></ul></div>"
EVENT = "<p>CY'25 프리미엄 연도대상: 2026.03.13(금) 서울 그랜드힐 컨벤션에서 프리미엄사업부 연도대상 행사를 열었습니다.</p>"
CEO_SHORT = '<p><b>말보다 데이터와 시스템으로 일하는 보험영업가</b> — 프라임에셋 188본부 본부장 · 프리미엄사업부</p><p>2009년 현장에서 보험 영업을 시작했습니다. 보험 소비자가 아니라 보험설계사를 돕는 일을 합니다. 우수한 인재를 발굴하고, 설계사가 실제로 성과를 올릴 수 있는 영업 환경을 만드는 것이 제 일입니다.</p>'
CEO_FULL = '<p><b>말보다 데이터와 시스템으로 일하는 보험영업가</b> — 프라임에셋 188본부 본부장 · 프리미엄사업부</p><p>2009년 현장에서 보험 영업을 시작했습니다. 보험 소비자가 아니라 보험설계사를 돕는 일을 합니다. 우수한 인재를 발굴하고, 설계사가 실제로 성과를 올릴 수 있는 영업 환경을 만드는 것이 제 일입니다.</p><p>현장에서 직접 검증한 방식만 시스템으로 옮깁니다. 말로 설득하기보다 조건·수수료·규정을 그대로 공개하고, 직접 비교해 판단하도록 합니다.</p><h3>걸어온 길</h3><ul><li><b>2009.10</b> PCA생명에서 보험 영업 시작 — 현장에서 출발</li><li><b>2012</b> 교보생명·교보생명 전속대리점을 거쳐 프라임에셋 입사 (보험설계사)</li><li><b>2017.3</b> 본부장 승격 · 188본부 출범 (온라인영업 특화)</li><li><b>2021.1</b> MVP · 명예이사 · 프리미엄사업부 수장</li><li><b>2026~</b> AI·자동화 기반 설계사 지원 시스템 구축</li></ul><h3>일하는 방식</h3><ul><li><b>정직·직설</b> — 모호한 수식어 대신 문서와 수치로 말합니다.</li><li><b>사람 중심 시스템</b> — 이익보다 사람이 먼저인 구조를 설계합니다.</li><li><b>데이터 우선</b> — 감정 호소가 아닌 근거 기반으로 판단합니다.</li><li><b>조용한 럭셔리</b> — 요란함 없이, 본질과 결과로 증명합니다.</li></ul><p>"성공하고 싶다면, 말이 아니라 조건과 시스템을 직접 확인하십시오."</p><h3>만드는 시스템 — 설계사가 성과를 올릴 환경</h3><ul><li><b>자료</b> 수천 건 자료를 한 번에 찾는 통합 자료검색기</li><li><b>콘텐츠</b> 최신 보험뉴스·상품비교·소식지 분석 도구</li><li><b>AI</b> 화법·상담·DB영업을 돕는 AI 영업비서</li><li><b>교육</b> 스탠다드 캠퍼스 · 표준 영업 매뉴얼 체계</li><li><b>운영</b> 수수료·규정·시책을 투명하게 공개하는 운영 구조</li></ul><p>프리미엄사업부 · 온라인영업 특화 188본부</p><p class=\'wf-desc\'>출처: 기존 사이트 \'김상현 이사를 소개합니다\' 소개 화면 글.</p>'

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
    assert len(tl) == 26 and len(faq) == 9 and len(tools) == 15, (len(tl), len(faq), len(tools))
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
            "<div class='wf-grid'>" + "".join(f"<div class='wf-item'><b>{a}</b><small>{c}</small></div>" for a, c in NUMS) + "</div>" + EVENT, "numbers")
        + b(next(n), "왜 우리인가", "일하는 방식·방향과 목표를 혜택 4개로 합침. 경력자용(수수료·제도) 먼저, 신입용(교육·AI 도구) 다음.",
            "".join(f"<div class='wf-item' style='margin:6px 0'><small>{who}에게</small><b>{t}</b><p>{d}</p></div>" for who, t, d in WHY)
            + "<p><a href='story/'>소개·숫자 더 보기 · 방향과 목표 10개 · 일하는 방식 원문 →</a></p>" + join_btn("합류 문의하기"), "why")
        + b(next(n), "도구 소개", "대표 4개 + 전부 보기(누르면 펼침). 누르면 회원가입.",
            "<div class='wf-grid'>" + "".join(tools[:4]) + "</div>"
            "<details class='faq'><summary>전부 보기 (AI 도구 9개 · 교육·정보 채널 6개)</summary><div class='wf-grid'>" + "".join(tools[4:]) + "</div></details>", "tools")
        + b(next(n), "프라임에셋 제도 요약", "3줄 요약. 영업규정·수수료·승격 기준 세부 자료는 로그인 후 인트라넷.",
            "<ul>" + "".join(f"<li>{x}</li>" for x in PRIME3) + "</ul><p class='wf-desc'>자세한 자료: 로그인 후 인트라넷 '프리미엄 안내 자료'.</p>", "prime")
        + b(next(n), "설계사 후기", "함께하는 설계사의 이야기가 들어갈 자리.", "<p>준비 중입니다.</p>", "reviews")
        + b(next(n), "김상현 이사 소개", "짧은 소개 + 대표 연혁 5개(전체 연혁은 별도 페이지).",
            "<p>프라임에셋 이사, 프리미엄사업부 대표. 2017년 188본부를 시작으로 19개 본부 연합으로 키웠습니다. 2021·2022년 MVP 2년 연속, 2021년 명예이사.</p>" + CEO_SHORT +
            "<ul>" + "".join(f"<li><b>{d}</b> {t}</li>" for d, t in tl if d in TOP4) + "</ul><p><a href='story/'>이사님 소개 전체 · 전체 연혁 26개 보기 →</a></p>", "ceo")
        + b(next(n), "함께하는 본부", S["branches"][1] + " 188본부 소개 3줄은 기존 사이트 원문 그대로.", S["branches"][2] + B188, "branches")
        + b(next(n), "자주 묻는 질문", "질문을 누르면 답이 펼쳐집니다.",
            "".join(f"<details class='faq'><summary>Q. {q}</summary><p>A. {a}</p></details>" for q, a in faq), "faq")
        + b(next(n), "합류 문의 · 연락처", "마지막 합류 문의 버튼, 전화(누르면 전화)·카카오 오픈채팅, 주소·사업자 정보.",
            join_btn() + PARTNER + contact, "contact")
    )
    main = theme.frame(frm["path"], frm["title"], MENU, body, head_extra=SMALL_TOP, **{k: v for k, v in frm["kw"].items() if k != "head_extra"})
    # /story/ : 전체 연혁 + 방향과 목표 + 일하는 방식 원문
    intro = re.split(r"(?=<h3>)", S["about"][2])[0]
    sb = (b(2, "소개 · 숫자 더 보기", "사업부 소개 원문과 공개 숫자 전체(성장률·188본부 순위 포함, 마감된 기간 기준).",
            intro + parts["큰 숫자"][len("<h3>큰 숫자</h3>"):] + parts["김상현 이사 소개"][len("<h3>김상현 이사 소개</h3>"):] + parts["프라임에셋은요"][len("<h3>프라임에셋은요</h3>"):], "about")
          + b(3, "김상현 이사 소개 (원문)", "기존 사이트 소개 화면에 적힌 글 그대로.", CEO_FULL, "ceo")
          + b(3, "성장 스토리 (전체 연혁)", "2017.03~2026.04 연혁 26개.", "<ul>" + "".join(f"<li><b>{d}</b> {t}</li>" for d, t in tl) + "</ul>", "history")
          + b(4, "방향과 목표", "10개.", parts["방향과 목표"][len("<h3>방향과 목표</h3>"):], "goals")
          + b(5, "우리는 이렇게 일해요", "설계사의 하루(기존 사이트 글 요약).", parts["우리는 이렇게 일해요"][len("<h3>우리는 이렇게 일해요</h3>"):], "work")
          + b(6, "합류 문의", "카카오 오픈채팅 새 창 · 전화.", join_btn() + f"<p>전화 <a href='tel:{TEL}'>{TEL}</a></p>", "contact"))
    story = theme.frame("story/", "성장 스토리 · 방향과 목표 — 프라임에셋 프리미엄", MENU, sb, head_extra=SMALL_TOP)
    return main, story
