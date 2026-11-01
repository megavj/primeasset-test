# HOME-20 재배치 비교안 3개 생성기 (샘알트만). 지금 사이트는 그대로 두고 /layout-a|b|c/ 에만 씀.
# 단색 박스+글자만. 스크립트 없음(로그인 기능 미사용). 로그인 후 실적 자료·GAS 주소는 넣지 않고 박스 이름만.
import os, sys, re, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme, home
OUT = sys.argv[1]
MENU = [("", "홈"), ("http://wiki.primeasset.info/", "보험위키"), ("members/", "설계사 인트라넷")]

# 1) 메인 섹션을 현재 home.py 에서 그대로 가져와 단위별로 나눔
cap = []
orig = theme.box
theme.box = lambda n, name, desc, inner="", bid="": cap.append((bid, name, desc, inner)) or ""
home.home(MENU)
theme.box = orig
S = {bid: (name, desc, inner) for bid, name, desc, inner in cap}
U = {}
U["join"] = ("로그인 / 회원가입 버튼", "큰 버튼 2개. 누르면 실제 /members 로그인 화면으로 감.", S["join"][2])
parts = re.split(r"(?=<h3>)", S["about"][2])
U["intro"] = ("소개", "19개 본부 연합 브랜드, 1,100명 설계사, 설계사의 가치 최우선.", parts[0])
keymap = {"큰 숫자": "numbers", "김상현 이사 소개": "ceo", "성장 스토리 (연혁)": "history", "방향과 목표": "goals",
          "우리는 이렇게 일해요": "work", "프라임에셋은요": "prime", "자주 묻는 질문": "faq"}
for p in parts[1:]:
    t = re.match(r"<h3>(.*?)</h3>", p).group(1)
    U[keymap[t]] = (t, {"numbers": "로그인 전 공개용 큰 숫자 6개(마감된 기간 기준).", "ceo": "이사님 소개와 주요 이력.",
        "history": "2017.03~2026.04 연혁 26개.", "goals": "방향과 목표 10개.", "work": "설계사의 하루(기존 사이트 글 요약).",
        "prime": "프라임에셋 제도 요약(규정·수수료·승격·본사 지원).", "faq": "자주 묻는 질문 8개."}[keymap[t]], p[len(f"<h3>{t}</h3>"):])
for k in ["tools", "links", "branches", "contact"]:
    U[k] = S[k]
def fix(h):  # 비교 페이지 안에서도 버튼은 실제 사이트 주소로
    return h.replace("href='members/", "href='/members/").replace('href="members/', 'href="/members/')

MAIN = {
 "a": ["join", "numbers", "tools", "contact", "intro", "branches", "history", "ceo", "prime", "goals", "work", "faq", "links"],
 "b": ["intro", "ceo", "goals", "work", "numbers", "history", "branches", "prime", "tools", "links", "faq", "contact", "join"],
 "c": ["intro+join", "numbers", "tools", "branches", "ceo", "history", "faq", "goals", "work", "prime", "links", "contact+join"],
}
# 2) 로그인·회원가입 / 인트라넷 / 관리자: 실제 화면 요소 이름만(데이터·스크립트 없음)
L = {"google": ("구글 계정으로 로그인", "버튼 하나로 로그인. 처음이면 바로 가입 신청."),
     "email": ("이메일 인증 로그인", "이메일 주소 입력 → 인증 메일의 링크를 눌러 로그인."),
     "login": ("구글·이메일 로그인 (한 박스)", "구글 버튼을 크게, 아래에 이메일 인증 칸."),
     "profile": ("가입 정보 입력 + 개인정보 동의", "처음 로그인한 분만: 이름·소속 본부·휴대폰, [필수] 개인정보 수집·이용 동의(방침 링크)."),
     "why": ("가입하면 쓸 수 있는 것", "AI 영업도구·정보 채널·실적 자료 안내. 승인 전에는 메뉴 이름만 보이고 🔒."),
     "flow": ("가입 후 순서", "① 로그인 → ② 가입 정보 입력 → ③ 관리자 승인 → ④ 등급에 맞는 도구 열림."),
     "ask": ("문의", "가입·승인 문의 연락처(이사님 공개 번호)." )}
LOGIN = {"a": ["google", "email", "profile", "flow", "ask"], "b": ["why", "flow", "google", "email", "profile", "ask"],
         "c": ["login", "flow", "profile", "ask"]}
M = {"status": ("승인 상태 안내", "승인 대기·Guest일 때만: 🔒 메뉴는 승인 후 열린다는 안내."),
     "me": ("내 정보", "이름·등급·관리자 여부·열린 메뉴 수, 관리자 화면 버튼(관리자만), 로그아웃."),
     "me+status": ("내 정보 + 승인 상태 (한 박스)", "이름·등급·열린 메뉴 수와 승인 상태를 한 줄로. 로그아웃."),
     "quick": ("바로가기", "보험위키·188 영업지원시스템·보험노트."),
     "tools": ("도구 메뉴 (분류 8개, 31개)", "AI 영업도구(GAS)·Gem·GPT·NotebookLM·교육·자료실·리크루팅·업무 등. 권한 없으면 🔒. (도구 주소는 로그인 후 서버가 권한 있는 것만 보냄 — 이 비교 페이지에는 없음)"),
     "tools-ai": ("자주 쓰는 AI 도구 (상품통합분석기 등)", "가장 많이 쓰는 도구 몇 개를 맨 위에 크게. 나머지는 아래 분류별 메뉴."),
     "stats": ("실적 자료 (승인 회원 전용)", "사업부 실적보드·팜스 합계 표 12개가 들어가는 칸. 이 비교 페이지에는 숫자를 넣지 않음."),
     "stats-sum": ("실적 요약 → 표 12개 (승인 회원 전용)", "맨 위 요약 숫자 몇 개, 누르면 표가 펼쳐짐. 이 비교 페이지에는 숫자를 넣지 않음."),
     "info": ("프리미엄 안내 자료 (12개)", "교육 방향·정보 채널·영업규정·수수료·승격 기준·본사 지원·자료 모음.")}
MEM = {"a": ["me", "tools", "stats", "quick", "info"], "b": ["status", "me", "info", "quick", "tools", "stats"],
       "c": ["me+status", "tools-ai", "quick", "tools", "stats-sum", "info"]}
A = {"pending": ("대기 회원", "가입 신청 후 승인 대기 회원. 승인·등급 지정·거절."), "members": ("회원 목록", "등급 변경·정지·해제."),
     "admins": ("관리자", "관리자 추가·해제(등급과 따로)."), "grades": ("등급 관리", "등급 이름·순서."),
     "branches": ("본부", "메인 '함께하는 본부'의 번호·주소·순서·숨김."), "matrix": ("권한 체크표", "등급별로 열 페이지·도구 체크."),
     "resources": ("페이지·도구", "인트라넷 메뉴 이름·분류·주소 관리(주소는 이 비교 페이지에 없음)."),
     "audit": ("변경 기록", "누가 무엇을 바꿨는지."), "backup": ("백업", "회원 정보 백업 받기(30일 보관)."),
     "summary": ("오늘 요약", "대기 회원 수·전체 회원 수·최근 변경 3건을 맨 위 한 박스로."),
     "g-member": ("[묶음] 회원", "대기 회원 · 회원 목록 · 관리자"), "g-perm": ("[묶음] 권한", "등급 관리 · 권한 체크표 · 페이지·도구"),
     "g-site": ("[묶음] 사이트", "본부"), "g-log": ("[묶음] 기록·보관", "변경 기록 · 백업")}
ADM = {"a": ["pending", "members", "matrix", "grades", "admins", "resources", "branches", "backup", "audit"],
       "b": ["pending", "members", "grades", "matrix", "admins", "resources", "branches", "audit", "backup"],
       "c": ["summary", "g-member", "g-perm", "g-site", "g-log"]}
NAME = {"a": "안1 · 중요한 것 위로", "b": "안2 · 방문자 흐름대로", "c": "안3 · 샘알트만 추천"}
WHY = {"a": "가입 버튼과 실적 숫자를 맨 위에. 바로 결정하는 방문자에게 빠름.",
       "b": "소개 → 신뢰(이사님·방향·숫자·연혁) → 도구 → 가입 순. 처음 온 방문자가 읽어 내려가며 납득.",
       "c": "첫 화면에 '무엇인지 + 가입 버튼'을 함께, 바로 숫자·도구로 증명하고, 깊은 내용은 아래로. 가입 버튼은 맨 위와 맨 아래 두 번."}
PAGES = [("", "메인 (/)"), ("login/", "로그인·회원가입"), ("members/", "인트라넷 (/members)"), ("admin/", "관리자 (/members/admin)")]

def banner(k, sub):
    r = "../" * (1 + sub.count("/"))
    others = " · ".join(f"<a href='{r}layout-{x}/{sub}'>{NAME[x]}</a>" for x in "abc" if x != k)
    pages = " · ".join(f"<a href='{r}layout-{k}/{p}'>{n}</a>" for p, n in PAGES)
    return (f"<section class='wf'><span class='wf-tag'>비교용 페이지 (실제 사이트 아님)</span><h2 class='wf-name'>{NAME[k]}</h2>"
            f"<p class='wf-desc'>{WHY[k]}</p><p>이 안의 페이지: {pages}</p><p>다른 안 같은 페이지: {others} · <a href='/'>지금 사이트</a></p></section>")

def boxes(order, D):
    out = []
    for i, key in enumerate(order, 2):
        if key in ("intro+join", "contact+join"):
            a, b = key.split("+")
            n1, d1, h1 = U[a]; out.append(theme.box(i, f"{U[a][0]} + 가입 버튼", d1 + " 같은 박스에 로그인·회원가입 버튼.", fix(h1 + U["join"][2]))); continue
        n, d, *h = D[key]
        out.append(theme.box(i, n, d, fix(h[0]) if h else ""))
    return "".join(out)

def write(path, title, body):
    os.makedirs(f"{OUT}/{path}", exist_ok=True)
    h = theme.frame(path, title, MENU, body)
    h = h.replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="noindex,nofollow,noarchive">')
    open(f"{OUT}/{path}index.html", "w").write(h)

for k in "abc":
    base = f"layout-{k}/"
    write(base, f"{NAME[k]} — 메인", banner(k, "") + boxes(MAIN[k], U))
    write(base + "login/", f"{NAME[k]} — 로그인·회원가입", banner(k, "login/") + boxes(LOGIN[k], L))
    write(base + "members/", f"{NAME[k]} — 인트라넷", banner(k, "members/") + boxes(MEM[k], M))
    write(base + "admin/", f"{NAME[k]} — 관리자", banner(k, "admin/") + boxes(ADM[k], A))
assert set(MAIN["a"]) == set(MAIN["b"]) == set(U) - set(), (set(U) ^ set(MAIN["a"]))
print("ok layouts")
