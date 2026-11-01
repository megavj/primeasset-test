# HOME-16 메인(/) 구조 적용 — 승인된 구조(2026-10-31 지시) 섹션 순서 그대로, 단색 박스+설명만.
# 공개 메인에는 도구 실제 주소를 넣지 않는다. 도구 카드는 회원가입 화면으로 보냄.
import theme
CSS = ""  # 메인도 공통 style.css 하나만 사용

TOOLS = ["상품통합분석기", "수당계산기", "상품분석기", "전산답변기", "자료검색기", "보상답변기", "소식지 분석기", "최신보험뉴스", "AI 영업비서"]
BRANCHES = ['188', '227', '236', '242', '246', '249', '254', '255', '285', '308', '320', '338', '345', '346', '350', '364', '375', '379', '384']

def home(MENU):
    b = theme.box
    tools = "".join(f"<a class='wf-item' href='members/#signup' data-tool><b>{t}</b><small>회원 전용 · 누르면 회원가입</small></a>" for t in TOOLS)
    links = ("<a class='wf-item' href='http://wiki.primeasset.info/'><b>보험위키</b><small>wiki.primeasset.info</small></a>"
             "<a class='wf-item' href='https://188.primeasset.info/' target='_blank' rel='noopener'><b>188 영업지원시스템</b><small>188.primeasset.info</small></a>"
             "<a class='wf-item' href='https://bohumnote.com/' target='_blank' rel='noopener'><b>보험노트</b><small>bohumnote.com</small></a>"
             "<a class='wf-item' href='members/#signup' data-tool><b>영업지원 사이트 모음</b><small>카페·교육·공시 등 · 회원 전용</small></a>")
    brs = "".join((f"<a class='br' data-no='{n}' href='https://188.primeasset.info/' target='_blank' rel='noopener'><b>{n}</b>본부</a>" if n == "188"
                   else f"<span class='br off' data-no='{n}'><b>{n}</b>본부<small>연결 준비 중</small></span>") for n in BRANCHES)
    body = (
        b(2, "로그인 / 회원가입", "맨 위 큰 버튼 2개. 로그인하면 바로 인트라넷(/members)으로 들어감.",
          "<div class='wf-btns'><a href='members/#login'>로그인</a><a class='pri' href='members/#signup'>회원가입</a></div>", "join")
        + b(3, "소개", "프리미엄사업부 소개(예전 /about 일부): 김상현 이사, 19개 본부·약 1,100명 설계사, 2026년 10월 기준. (소개 문구 준비 중)",
            "<p>숫자 4개: 함께하는 본부 19 · 소속 설계사 1,100+ · AI 영업도구 20+ · 서비스 채널 4 (2026년 10월 기준)</p>", "about")
        + b(4, "도구 간단 소개", "회원 전용 도구 이름과 한 줄 설명. 로그인 안 한 상태에서 누르면 회원가입 화면으로 이동.",
            f"<div class='wf-grid'>{tools}</div>", "tools")
        + b(5, "보험위키 · 자주 쓰는 링크", "도구와 함께 보험위키와 자주 쓰는 사이트를 간단히 소개.", f"<div class='wf-grid'>{links}</div>", "links")
        + b(6, "함께하는 본부", "19개 본부 번호. 누르면 해당 본부 페이지로 이동(지금은 188본부만 연결, 나머지는 관리자 화면에서 주소 등록).",
            f"<div class='branches' id='branch-list'>{brs}</div>", "branches")
        + b(7, "회원가입 · 문의 연락처", "가입·합류 문의 담당과 전화번호 공개, 회원가입 버튼.",
            "<p>담당: 본부장 김상현 · 전화: <a href='tel:010-8714-9262'>010-8714-9262</a></p>"
            "<div class='wf-btns'><a class='pri' href='members/#signup'>회원가입</a><a href='members/#login'>로그인</a></div>", "contact")
    )
    s = ('<script src="assets/vendor/supabase-2.118.0.js"></script><script src="assets/auth-config.js?v=2"></script>'
         '<script src="assets/branches.js?v=1"></script>')
    return theme.frame("", "프라임에셋 프리미엄", MENU, body, scripts=s)
