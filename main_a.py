# HOME-21 메인(/) 실제 배치 = 안1(layout-a). 내용은 home.py 그대로, 순서만 바꿈. (샘알트만)
import re
import theme, home

ORDER = ["join", "numbers", "tools", "contact", "intro", "branches", "history", "ceo", "prime", "goals", "work", "faq", "links"]
DESC = {"numbers": "로그인 전 공개용 큰 숫자 6개(마감된 기간 기준). 세부 표는 로그인 후 인트라넷.", "ceo": "이사님 소개와 주요 이력.",
        "history": "2017.03~2026.04 연혁 26개.", "goals": "방향과 목표 10개.", "work": "설계사의 하루(기존 사이트 글 요약).",
        "prime": "프라임에셋 제도 요약(규정·수수료·승격·본사 지원). 자세한 자료는 로그인 후 인트라넷.", "faq": "자주 묻는 질문 8개."}
KEY = {"큰 숫자": "numbers", "김상현 이사 소개": "ceo", "성장 스토리 (연혁)": "history", "방향과 목표": "goals",
       "우리는 이렇게 일해요": "work", "프라임에셋은요": "prime", "자주 묻는 질문": "faq"}

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
    U = {"join": S["join"]}
    parts = re.split(r"(?=<h3>)", S["about"][2])
    U["intro"] = ("소개", "19개 본부 연합 브랜드, 1,100명 설계사, 설계사의 가치 최우선.", parts[0])
    for p in parts[1:]:
        t = re.match(r"<h3>(.*?)</h3>", p).group(1)
        U[KEY[t]] = (t, DESC[KEY[t]], p[len(f"<h3>{t}</h3>"):])
    for k in ["tools", "links", "branches", "contact"]:
        U[k] = S[k]
    assert sorted(U) == sorted(ORDER), set(U) ^ set(ORDER)
    body = "".join(theme.box(i, U[k][0], U[k][1], U[k][2], "about" if k == "intro" else k) for i, k in enumerate(ORDER, 2))
    return theme.frame(frm["path"], frm["title"], MENU, body, **frm["kw"])
