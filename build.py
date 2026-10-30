# HOME-04 테스트페이지 빈 틀 생성기 (샘알트만) — 상대경로라 하위주소/정식주소 어디서든 동작
import os, sys
OUT = sys.argv[1]
MENU = [("", "홈"), ("about/", "프리미엄 소개"), ("join/", "합류 안내"), ("tools/", "영업지원 쇼룸"),
        ("wiki/", "보험위키"), ("links/", "영업지원 사이트"), ("members/", "설계사 인트라넷")]

import json
_CHK = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "members_links_check.json")))
TOOLS = [(x["name"], x["url"]) for x in _CHK if x["ok"] and "script.google.com" in x["url"] and "통합페이지" not in x["name"]]
PORTALS = [(x["name"], x["url"]) for x in _CHK if x["ok"] and x["name"] in ("AI 영업도구 통합페이지", "MY포털")]

PAGES = {
 "": ("프라임에셋 프리미엄", "19개 본부 · 약 1,100명 설계사가 함께하는 프리미엄사업부", [
    ("첫 화면", ["한 줄 문구 + [합류 상담 신청] [도구 체험하기] 버튼 + 이사님 전화 (내용 준비 중)"]),
    ("숫자 띠", ["19개 본부 · 약 1,100명 (기준일 표기 예정, 실적 금액은 준법 확인 후)"]),
    ("왜 프리미엄", ["188 Operating Standard 5가지 (준비 중)"]),
    ("영업지원 쇼룸 미리보기", ["→ <a href='{r}tools/'>영업지원 쇼룸</a>"]),
    ("사람", ["김상현 이사 소개 · 본부장(본인 동의분만) (준비 중)"]),
    ("합류 안내", ["신입 / 경력 / 팀·지점 → <a href='{r}join/'>합류 안내</a>"]),
    ("자주 묻는 질문", ["(준비 중)"]),
    ("상담 신청", ["신청 배너 자리 (메일 연결은 별도 승인 후)"]),
 ]),
 "about/": ("프리미엄 소개", "프라임에셋 프리미엄사업부 소개 (내용 준비 중)", [
    ("김상현 이사 소개", ["(준비 중)"]), ("성장 스토리", ["(준비 중)"]), ("방향과 목표", ["(준비 중)"]),
    ("우리는 이렇게 일해요", ["(준비 중)"]), ("함께하는 본부 (19개)", ["(준비 중)"]), ("MVP · 연도대상 히스토리", ["(준비 중)"]),
 ]),
 "join/": ("합류 안내", "나에게 맞는 합류 경로를 확인하세요.", [
    ("신입", ["(준비 중)"]), ("경력", ["(준비 중)"]), ("팀 · 지점 단위", ["(준비 중)"]),
    ("자주 묻는 질문", ["(준비 중)"]),
    ("상담 신청", ["이름 · 연락처 · 희망(신입/경력/팀) + 개인정보 수집 동의 — 신청 칸은 별도 승인 후 연결"]),
 ]),
 "tools/": ("영업지원 쇼룸", "프리미엄 설계사가 쓰는 AI 영업지원 도구를 소개합니다. 실제 사용은 회원 전용입니다.", [
    ("도구 소개", ["수당계산기 · 상품분석기 · 전산답변기 · 자료검색기 · 소식지 분석기 · 보험보상답변기 · 최신보험뉴스 · AI영업비서 (소개 내용 준비 중)"]),
    ("1회 체험", ["가상 고객 예시로 체험 (준비 중)"]),
    ("정식 사용", ["<a href='{r}members/'>설계사 인트라넷</a>에서 사용 · <a href='{r}join/'>합류 상담 신청</a>"]),
 ]),
 "wiki/": ("보험위키", "보험위키는 별도 사이트에서 운영됩니다.", [
    ("보험위키 바로가기", ["<a href='http://wiki.primeasset.info/' target='_blank' rel='noopener'>wiki.primeasset.info</a>"]),
 ]),
 "links/": ("영업지원 사이트", "프리미엄 설계사가 자주 쓰는 사이트 모음", [
    ("프라임에셋 · 188본부", ["<a href='https://188.primeasset.info/' target='_blank' rel='noopener'>188본부</a>", "프라임에셋 본사 (링크 정리 중)"]),
    ("보험노트", ["<a href='https://bohumnote.com/' target='_blank' rel='noopener'>프리미엄 보험노트 (bohumnote.com)</a>"]),
    ("보험정보 공유", ["보험정보 공유 카페 · 익명질문방(늅늅방) · 고급정보 무한공유(전설의고무공) (링크 정리 중)"]),
    ("교육", ["스탠다드 캠퍼스 (링크 정리 중)"]),
    ("보험사 · 협회 공시", ["(링크 정리 중)"]),
 ]),
 "members/": ("설계사 인트라넷", "로그인한 승인 회원만 사용하는 공간입니다. (테스트 단계: 로그인 기능 연결 전)", [
    ("AI 영업도구 (GAS)", [f"<a href='{u}' target='_blank' rel='noopener'>{n}</a>" for n, u in TOOLS]),
    ("포털 · 통합", [f"<a href='{u}' target='_blank' rel='noopener'>{n}</a>" for n, u in PORTALS]),
    ("Gemini Gem", [f"<a href='{u}' target='_blank' rel='noopener'>{n}</a>" for n, u in [
        ("상담연습도우미", "https://gemini.google.com/gem/1RBqgRTkrr4LzMr3JnKgyijYhJurkz1lE?usp=sharing"),
        ("실전 질병정보·화법도우미", "https://gemini.google.com/gem/101-BxFLO4jPay9sHh_Hi5tLDW-QeGTC1?usp=sharing"),
        ("실전 DB영업 화법도우미", "https://gemini.google.com/gem/1O_fcD2VnwdValqYZE_IIaoCbAglL69M5?usp=sharing")]]),
    ("NotebookLM", [f"<a href='{u}' target='_blank' rel='noopener'>{n}</a>" for n, u in [
        ("N대·종수술 답변기", "https://notebooklm.google.com/notebook/55b40b2f-1242-4604-ac3a-b6609d376cac/preview"),
        ("실손의료비 답변기", "https://notebooklm.google.com/notebook/38f4aa7f-a85c-4163-8404-15eb6ed51f9b/preview"),
        ("전산매뉴얼 자동답변기", "https://notebooklm.google.com/notebook/6e0f60d8-6892-44b6-ac85-f8dbf5d76935"),
        ("고지의무 판독기", "https://notebooklm.google.com/notebook/d4bc7ea8-f637-47ca-b9b5-a0e0784d620f")]] + ["구글 로그인 화면이 먼저 뜨는 것이 정상입니다"]),
    ("GPT · 업무 · 리크루팅", [f"<a href='{u}' target='_blank' rel='noopener'>{n}</a>" for n, u in [
        ("영업능력진단 봇 (GPT)", "https://chatgpt.com/g/g-69e87fb518608191afca2514b1f88ded"),
        ("업무보드", "https://script.google.com/macros/s/AKfycbw_U7A7EvGQ8KbZIVBQHlaEzMHC-yUhMTZ36x02qk6F7e7wzpllQYQBiiAu2OCGsxn0/exec"),
        ("양규철 리크루팅", "https://script.google.com/macros/s/AKfycbxn35qhPOkWcqsuzfPToyZRKoGnMFTsScGvO93e2_pfHpSDqauPM7HDYNBc3BVdHwfQiA/exec")]]),
    ("자료실", ["영업규정집 · 수수료/시책 · 승격 기준 · 브로슈어 (준비 중)"]),
    ("교육", ["(준비 중)"]), ("일정 · 공지", ["(준비 중)"]), ("우리 본부 (188 전용)", ["(준비 중)"]),
    ("관리 (관리자 전용)", ["회원 승인 · 유입 통계 (준비 중)"]),
 ]),
}

CSS = """*{box-sizing:border-box}body{margin:0;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1d2433;background:#f6f7fb;line-height:1.6}
.test{background:#ffb703;color:#000;text-align:center;font-size:13px;padding:4px}
header{background:#0b2545;color:#fff;position:sticky;top:0;z-index:5}.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.bar{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px;flex-wrap:wrap}.logo{color:#fff;font-weight:800;text-decoration:none;font-size:18px}
nav a{color:#cfd8e8;text-decoration:none;margin-left:16px;font-size:15px}nav a.on,nav a:hover{color:#fff;font-weight:700}
.hero{background:linear-gradient(135deg,#0b2545,#13315c 60%,#1b4b8f);color:#fff;padding:56px 0}.hero h1{margin:0 0 8px;font-size:32px}.hero p{margin:0;opacity:.85}
main{padding:32px 0 80px}.card{background:#fff;border-radius:14px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}.card h2{margin:0 0 6px;font-size:19px;color:#0b2545}
.card p{margin:4px 0;color:#4a5568}a{color:#1b4b8f}footer{background:#0b2545;color:#9fb0c8;font-size:13px;padding:24px 0}footer a{color:#cfd8e8}
.mob{display:none}@media(max-width:720px){nav a{margin:0 12px 0 0;font-size:14px}nav{padding-bottom:10px;overflow-x:auto;white-space:nowrap;width:100%}.hero h1{font-size:24px}
.mob{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:9}.mob a{flex:1;text-align:center;padding:14px;color:#fff;text-decoration:none;font-weight:700}.mob a:first-child{background:#13315c}.mob a:last-child{background:#e85d04}}"""

def page(path, title, lead, sections):
    depth = path.count("/")
    r = "../" * depth
    nav = "".join(f"<a href='{r}{p}' class='{'on' if p==path else ''}'>{n}</a>" for p, n in MENU)
    body = "".join("<section class='card'><h2>%s</h2>%s</section>" % (h, "".join(f"<p>{x.format(r=r)}</p>" for x in xs)) for h, xs in sections)
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>{title} | 프라임에셋 프리미엄 (테스트)</title><link rel="stylesheet" href="{r}assets/style.css"></head><body>
<div class="test">테스트 페이지입니다 — 내용 준비 중</div>
<header><div class="wrap bar"><a class="logo" href="{r}">PRIME ASSET PREMIUM</a><nav>{nav}</nav></div></header>
<div class="hero"><div class="wrap"><h1>{title}</h1><p>{lead}</p></div></div>
<main class="wrap">{body}</main>
<footer><div class="wrap">프라임에셋 프리미엄사업부 · 회사·사업자 정보(준비 중) · 연락처(준비 중) · 개인정보처리방침(준비 중) · <a href="{r}members/">설계사 로그인</a></div></footer>
<div class="mob"><a href="#">전화(준비 중)</a><a href="{r}join/">상담 신청</a></div></body></html>"""

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import theme
os.makedirs(f"{OUT}/assets", exist_ok=True)
open(f"{OUT}/assets/style.css", "w").write(theme.CSS)
for p, (t, l, s) in PAGES.items():
    os.makedirs(f"{OUT}/{p}", exist_ok=True)
    open(f"{OUT}/{p}index.html", "w").write(theme.page(p, t, l, s, MENU))
open(f"{OUT}/robots.txt", "w").write("User-agent: *\nAllow: /\n")  # noindex 메타를 검색엔진이 읽을 수 있게 막지 않음
open(f"{OUT}/.nojekyll", "w").write("")
import home
open(f"{OUT}/assets/home.css", "w").write(home.CSS)
open(f"{OUT}/index.html", "w").write(home.home(MENU))
open(f"{OUT}/README.md", "w").write("# primeasset-test\n프라임에셋 프리미엄 홈페이지 개편 테스트페이지 (test.primeasset.info 예정). 정식 사이트 아님. 전체 noindex.\n생성기: build.py (HOME-04, 샘알트만)\n")
print("ok", len(PAGES))
