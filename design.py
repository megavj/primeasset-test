# HOME-30 디자인 시안 3개: 기존 페이지(메인 안1·인트라넷/관리자 안3)를 그대로 복사하고 색·글꼴·여백·카드 모양만 덮어씀.
# 사용: python3 design.py <site 폴더>   (build.py 다음에 실행. 기존 페이지·/product/는 읽기만 함)
import os, re, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else "site"

BASE = """
.wf-tag{display:none}
body{font-size:16px;line-height:1.7}
.wrap{max-width:1040px;padding:0 20px}
.wf,.pa-card{padding:28px 30px;margin:20px 0}
.wf-name,.pa-card h3{font-size:22px;letter-spacing:-.01em;margin:0 0 8px}
#hero p[style]{font-size:32px!important;line-height:1.35;letter-spacing:-.02em}
.wf-desc,.pa-card>p.wf-desc{font-size:13px!important;font-weight:400!important}
.wf-bar .wf-btns a,.wf-bar nav a{padding:8px 14px;font-size:14px}
.design-bar a{white-space:nowrap}.design-bar a.cur{text-decoration:none;padding:1px 6px;border:1px solid currentColor;border-radius:4px}
#numbers .wf-item b{font-size:22px;margin-bottom:4px;word-break:keep-all}
.wf-grid{gap:12px}.wf-item,.pa-list li{padding:16px 18px}
.wf-btns.big a{display:inline-block}
.design-bar{font-size:13px;padding:8px 12px;text-align:center}
.design-bar a{margin:0 6px;font-weight:700}
@media (max-width:600px){.wf,.pa-card{padding:18px 16px;margin:12px 0}#hero p[style]{font-size:25px!important}.wf-btns.big a{display:block;text-align:center}}
"""

THEMES = {
 "a": ("A 밝은 신뢰형", "흰 바탕·남색 포인트", """
:root{--bg:#ffffff;--bg-2:#f5f7fb;--bg-3:#e8edf6;--ink:#111827;--ink-2:#374151;--mute:#4b5563;--line:#dbe2ee;--line-soft:#e5eaf2;--gold:#1e3a8a;--btn:#1e3a8a;
--font:-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif}
a{color:#1e3a8a}
.wf,.pa-card{background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 1px 3px rgba(17,24,39,.06)}
.wf-item,.br,.pa-list li,.pa-card .pa-card,details.faq{border-radius:8px;border-color:var(--line)}
#hero{background:#1e3a8a;border-color:#1e3a8a;color:#fff}#hero p{color:#e0e7ff}
#hero .wf-btns a.pri{background:#fff;color:#1e3a8a;border-color:#fff}
#hero .wf-name,#hero .wf-desc{color:#e0e7ff}
#numbers .wf-item b{color:#1e3a8a}
.wf-btns a,.lux-btn,.pa-tab,.pa-in{border-radius:6px}
.wf-bar nav a,.wf-btns a{border-color:var(--line)}
.design-bar{background:#e8edf6;color:#111827}
"""),
 "b": ("B 어두운 고급형", "짙은 바탕·금색 포인트", """
:root{--bg:#111315;--bg-2:#1a1d21;--bg-3:#23272c;--ink:#f1ece2;--ink-2:#d9d2c3;--mute:#c4bcab;--line:#4a443c;--line-soft:#2c2925;--gold:#d4af5f;--btn:#d4af5f;
--font:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
body{background:var(--bg);color:var(--ink)}
a{color:#e2c27a}
.wf-name,.pa-card h3,#hero p:first-of-type,#numbers .wf-item b{font-family:"Nanum Myeongjo","AppleMyungjo","Batang",serif;font-weight:700}
.wf,.pa-card{background:var(--bg-2);border:1px solid var(--line);border-top:2px solid #d4af5f;border-radius:2px}
.wf-item,.br,.pa-list li,.pa-card .pa-card,details.faq,.pa-scroll,.pa-in,.pa-tab,.wf-bar nav a,.wf-btns a,.lux-btn,.pa-mini{background:var(--bg-3);color:var(--ink);border-color:var(--line)}
.wf-item small,.br small,.pa-note,.wf-desc,.pa-card p.wf-desc{color:var(--mute)}
.pa-card p{color:var(--ink-2)}
.wf-logo,.wf-item,.br,.pa-list a{color:var(--ink)}
.wf-btns a.pri,.lux-btn--gold,.pa-tab.on,.wf-bar nav a.on{background:#d4af5f;color:#111315;border-color:#d4af5f}
#numbers .wf-item b{color:#e2c27a}
.pa-table th,.pa-table td{border-color:var(--line);color:var(--ink)}
.pa-toast{background:#d4af5f;color:#111315}
.design-bar{background:#23272c;color:#f1ece2}
"""),
 "c": ("C 따뜻한 친근형", "밝은 베이지·주황 포인트", """
:root{--bg:#fbf6ee;--bg-2:#fffaf2;--bg-3:#f4e9d8;--ink:#2b2118;--ink-2:#4a3b2c;--mute:#5c4c3b;--line:#dcc6a6;--line-soft:#f0e3cf;--gold:#c2410c;--btn:#c2410c;
--font:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
body{background:var(--bg)}
a{color:#b4380a}
.wf,.pa-card{background:var(--bg-2);border:1px solid var(--line);border-radius:18px}
.wf-item,.br,.pa-list li,.pa-card .pa-card,details.faq{background:#fff;border-radius:14px;border-color:var(--line)}
.wf-btns a,.lux-btn,.pa-tab,.wf-bar nav a{border-radius:999px}
.pa-in{border-radius:12px}
#hero{background:#fde9d4;border-color:#f6cfa6}
#numbers .wf-item b{color:#c2410c}
.wf-btns a.pri,.lux-btn--gold,.pa-tab.on,.wf-bar nav a.on{background:#c2410c;border-color:#c2410c;color:#fff}
.design-bar{background:#f4e9d8;color:#2b2118}
"""),
}

PAGES = [("index.html", ""), ("members/index.html", "members/"), ("members/admin/index.html", "members/admin/"), ("privacy/index.html", "privacy/")]

def bar(k, path):
    other = " · ".join(f"<a class='{'cur' if x == k else ''}' href='/design-{x}/{path}'>{THEMES[x][0]}</a>" for x in THEMES)
    return (f"<div class='design-bar'>디자인 시안 {THEMES[k][0]} ({THEMES[k][1]}) — 비교용 · 내용·기능은 실제 페이지와 같음 · "
            f"시안 바꿔 보기: {other} · <a href='/{path}'>현재 페이지</a></div>")

for k, (name, desc, css) in THEMES.items():
    open(f"{OUT}/assets/design-{k}.css", "w").write(BASE + css)
    for src, path in PAGES:
        h = open(f"{OUT}/{src}").read()
        h = re.sub(r'(href|src)="(?:\.\./)*assets/', r'\1="/assets/', h)
        h = h.replace("href='story/'", "href='/story/'")
        if "noindex" not in h:
            h = h.replace("<head>", "<head><meta name='robots' content='noindex,nofollow'>", 1)
        h = h.replace("</head>", f"<link rel='stylesheet' href='/assets/design-{k}.css?v=1'></head>", 1)
        h = re.sub(r"<div class=\"test-bar\">.*?</div>", bar(k, path), h, count=1, flags=re.S)
        if "design-bar" not in h:
            h = re.sub(r"(<body[^>]*>)", r"\1" + bar(k, path), h, count=1)
        d = f"{OUT}/design-{k}/{path}"
        os.makedirs(d, exist_ok=True)
        open(d + "index.html", "w").write(h)
print("ok", len(THEMES) * len(PAGES))
