# HOME-16 구조 적용(와이어프레임) 공통 틀 — 섹션마다 단색 박스 1개 + 섹션 이름 + 들어갈 내용 설명.
# 이미지·애니메이션·그라데이션·장식 없음. 디자인은 구조 확정 뒤 별도 작업. build.py / auth_pages.py / home.py 가 불러 씀.
CSS = r"""
:root{--bg:#ffffff;--bg-2:#f1f3f6;--bg-3:#e6e9ee;--ink:#1f2937;--ink-2:#374151;--mute:#6b7280;--line:#c9ced6;--line-soft:#c9ced6;
--gold:#1f3a5f;--btn:#1f3a5f;--radius:0;--shadow:none;--font:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
*{box-sizing:border-box}body{margin:0;font-family:var(--font);color:var(--ink);background:var(--bg);line-height:1.6;font-size:15px;word-break:keep-all;overflow-wrap:anywhere}
a{color:#1f3a5f}.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.test-bar{background:#fde68a;color:#000;text-align:center;font-size:12px;padding:4px}
.wf{background:var(--bg-2);border:1px solid var(--line);padding:18px 20px;margin:12px 0}
.wf-name{margin:0 0 4px;font-size:18px}.wf-tag{display:inline-block;font-size:12px;color:var(--mute);margin:0 0 4px}
.wf-desc{margin:0 0 10px;color:var(--mute);font-size:14px}
.wf-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.wf-bar nav{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}
.wf-bar nav a,.wf-btns a{padding:6px 12px;border:1px solid var(--line);background:#fff;text-decoration:none;color:var(--ink);font-size:14px}
.wf-bar nav a.on{background:var(--btn);color:#fff;border-color:var(--btn)}.wf-logo{font-weight:700;text-decoration:none;color:var(--ink)}
.wf-btns{display:flex;gap:8px;flex-wrap:wrap}.wf-btns a.pri{background:var(--btn);color:#fff;border-color:var(--btn)}
.wf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.wf-item{display:block;background:#fff;border:1px solid var(--line);padding:10px 12px;text-decoration:none;color:var(--ink)}
.wf-item b{display:block}.wf-item small{color:var(--mute)}
.branches{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}
.br{display:block;background:#fff;border:1px solid var(--line);padding:8px;text-align:center;text-decoration:none;color:var(--ink)}
.br b{margin-right:2px}.br small{display:block;color:var(--mute);font-size:12px}.br.off{color:var(--mute)}
.lux-btn{display:inline-block;padding:9px 16px;border:1px solid var(--btn);background:#fff;color:var(--btn);font:inherit;font-size:14px;text-decoration:none;cursor:pointer}
.lux-btn--gold{background:var(--btn);color:#fff}.lux-btn--sm{padding:5px 10px;font-size:13px}
"""

def _nav(path, MENU, r):
    return "".join(f"<a href='{p if p.startswith('http') else (r + p) or './'}' class='{'on' if p == path else ''}'>{n}</a>" for p, n in MENU)

def box(n, name, desc, inner="", bid=""):
    i = f" id='{bid}'" if bid else ""
    return (f"<section class='wf'{i}><span class='wf-tag'>섹션 {n}</span><h2 class='wf-name'>{name}</h2>"
            f"<p class='wf-desc'>{desc}</p>{inner}</section>")

def frame(path, title, MENU, body, head_extra="", scripts="", login_btns=True):
    r = "../" * path.count("/")
    btns = (f"<div class='wf-btns'><a href='{r}members/#login'>로그인</a><a class='pri' href='{r}members/#signup'>회원가입</a></div>"
            if login_btns else "")
    top = box(1, "상단 메뉴", "로고(누르면 메인), 메뉴 3개(홈·보험위키·설계사 인트라넷), 로그인·회원가입 버튼.",
              f"<div class='wf-bar'><a class='wf-logo' href='{r or './'}'>프라임에셋 프리미엄</a><nav aria-label='주요 메뉴'>{_nav(path, MENU, r)}</nav>{btns}</div>")
    foot = (f"<footer class='wf'><span class='wf-tag'>맨 아래</span><h2 class='wf-name'>바닥글</h2>"
            f"<p class='wf-desc'>사업부 이름과 작은 개인정보처리방침 링크.</p><p>프라임에셋 프리미엄사업부 · <small><a href='{r}privacy/'>개인정보처리방침</a></small></p></footer>")
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>{title} | 프라임에셋 프리미엄 (테스트)</title>
<link rel="stylesheet" href="{r}assets/style.css?v=3">{head_extra}</head><body>
<div class="test-bar">테스트 페이지 — 구조 확인용(디자인 전)</div>
<div class="wrap">{top}<main>{body}</main>{foot}</div>{scripts}</body></html>"""

def page(path, title, lead, sections, MENU):
    body = "".join(box(i + 2, h, " ".join(xs)) for i, (h, xs) in enumerate(sections))
    return frame(path, title, MENU, body)
