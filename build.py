# HOME-04 테스트페이지 빈 틀 생성기 (샘알트만) — 상대경로라 하위주소/정식주소 어디서든 동작
import os, sys
OUT = sys.argv[1]
MENU = [("", "홈"), ("http://wiki.primeasset.info/", "보험위키"), ("members/", "설계사 인트라넷")]
# 2026-10-31 구조 개편: 삭제한 페이지 → 메인으로 보내는 안내 파일만 남김
REMOVED = ["about/", "join/", "tools/", "links/"]

# HOME-11: 도구 주소는 이 저장소에 두지 않음 (Supabase resources 표에만)

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
sys.path.insert(0, "/Volumes/MacWorkSSD/비서작업기록/샘알트만/20261030_HOME-11_로그인적용")
import auth_pages
auth_pages.build(OUT, theme, MENU)
for p in REMOVED:
    os.makedirs(f"{OUT}/{p}", exist_ok=True)
    open(f"{OUT}/{p}index.html", "w").write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">'
        '<meta http-equiv="refresh" content="0; url=../"><link rel="canonical" href="../"><title>메인으로 이동</title>'
        '<script>location.replace("../"+location.hash)</script></head><body><a href="../">메인으로 이동</a></body></html>')
import home
open(f"{OUT}/assets/home.css", "w").write(home.CSS)
import main_a  # HOME-21: 메인은 안1 순서
open(f"{OUT}/index.html", "w").write(main_a.render(MENU))
open(f"{OUT}/README.md", "w").write("# primeasset-test\n프라임에셋 프리미엄 홈페이지 개편 테스트페이지 (test.primeasset.info 예정). 정식 사이트 아님. 전체 noindex.\n생성기: build.py (HOME-04, 샘알트만)\n")
print("ok", len(PAGES))
