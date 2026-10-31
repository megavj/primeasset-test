# 188 사이트 방식(레이아웃·메뉴·카드·버튼) + 밝은 색감 테마 — build.py가 불러 씀
CSS = r"""
:root{--bg:#faf8f3;--bg-2:#ffffff;--bg-3:#f3efe4;--ink:#16181d;--ink-2:#3d424b;--mute:#6b7280;
--gold:#b8901f;--gold-hi:#d4ad3f;--gold-lo:#8a6d1f;--line:rgba(184,144,31,.22);--line-soft:rgba(22,24,29,.08);
--gold-fill:linear-gradient(180deg,#f3d982 0%,#d9b44a 50%,#b8901f 100%);
--font:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
--serif:Marcellus,"Pretendard Variable",Pretendard,serif;--shell:min(1240px,calc(100% - 64px));--radius:22px;--pill:9999px;
--shadow:0 1px 2px rgba(22,24,29,.04),0 12px 32px rgba(22,24,29,.06);--ease:cubic-bezier(.34,1.56,.64,1)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:var(--font);color:var(--ink);background:var(--bg);line-height:1.65;font-size:15px;-webkit-font-smoothing:antialiased;word-break:keep-all;overflow-wrap:anywhere}html,body{overflow-x:clip}
a{color:inherit}.shell{width:var(--shell);margin:0 auto}
.test-bar{background:var(--ink);color:#f5f2ea;text-align:center;font-size:12px;padding:5px;letter-spacing:.02em}
/* 상단 메뉴 (188 .nav 방식) */
.nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:24px;padding:14px max(32px,calc((100% - 1240px)/2));background:rgba(250,248,243,.82);-webkit-backdrop-filter:blur(18px) saturate(180%);backdrop-filter:blur(18px) saturate(180%);border-bottom:1px solid var(--line-soft)}
.wordmark{display:flex;align-items:center;gap:10px;text-decoration:none;white-space:nowrap}
.lux-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--gold-fill);color:#fff;font-family:var(--serif);font-size:13px;box-shadow:0 4px 14px rgba(184,144,31,.3)}
.wordmark__text{font-size:15px;color:var(--ink-2)}.wordmark__text b{color:var(--ink)}
.nav nav{display:flex;gap:4px;margin-left:auto;min-width:0;overflow-x:auto;scrollbar-width:none}.nav nav::-webkit-scrollbar{display:none}
.nav nav a{padding:8px 12px;border-radius:var(--pill);text-decoration:none;font-size:14px;color:var(--ink-2);white-space:nowrap;transition:background .2s}
.nav nav a:hover{background:var(--bg-3)}.nav nav a.on{background:var(--ink);color:#fff}
/* 버튼 (188 .lux-btn 방식) */
.lux-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border-radius:var(--pill);text-decoration:none;font-weight:700;font-size:15px;border:1px solid transparent;transition:transform .28s var(--ease),box-shadow .28s}
.lux-btn:hover{transform:translateY(-2px)}.lux-btn:active{transform:scale(.96)}
.lux-btn--gold{background:var(--gold-fill);color:#2a1f05;box-shadow:0 8px 24px rgba(184,144,31,.28)}
.lux-btn--ghost{background:var(--bg-2);color:var(--ink);border-color:var(--line-soft)}.lux-btn--ghost:hover{border-color:var(--gold)}
.lux-btn--sm{padding:9px 16px;font-size:13px}.nav-cta{flex-shrink:0}
/* 첫 화면 */
.hero{position:relative;overflow:hidden;padding:clamp(72px,9vw,128px) 0 clamp(56px,7vw,96px);background:radial-gradient(1200px 500px at 85% -10%,rgba(212,173,63,.18),transparent 60%),radial-gradient(800px 400px at -10% 110%,rgba(184,144,31,.10),transparent 60%),var(--bg)}
.lux-eyebrow,.eyebrow{font-family:var(--serif);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold-lo)}
.hero-kicker{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 20px}.hero-kicker__ko{font-size:13px;color:var(--mute)}
.hero-title{margin:0;font-size:clamp(36px,5vw,72px);line-height:1.15;letter-spacing:-.03em;font-weight:800}
.hero-title em,.section-head h2 em{font-style:normal;background:linear-gradient(100deg,#9b7a22,#d4ad3f 45%,#b8901f);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-lead{margin:20px 0 0;font-size:clamp(17px,1.4vw,21px);color:var(--ink-2);max-width:640px}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.hero-proof{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:56px}
.metric{background:var(--bg-2);border:1px solid var(--line-soft);border-radius:18px;padding:20px 22px;box-shadow:var(--shadow)}
.metric__num{font-variant-numeric:lining-nums;font-family:var(--font);font-weight:800;font-size:30px;color:var(--gold-lo)}.metric__label{font-weight:700}.metric__desc{font-size:13px;color:var(--mute)}
/* 섹션·카드 (188 .section-head / .system-card 방식) */
.section{padding:clamp(64px,8vw,112px) 0;border-top:1px solid var(--line-soft)}.section:nth-child(even){background:var(--bg-2)}
.section-head{margin-bottom:36px}.eyebrow{display:flex;gap:10px;align-items:center;margin:0 0 12px}
.eyebrow__num{display:inline-grid;place-items:center;min-width:28px;height:22px;padding:0 8px;border-radius:var(--pill);border:1px solid var(--line);font-size:11px}
.section-head h2{margin:0;font-size:clamp(28px,3.2vw,46px);line-height:1.2;letter-spacing:-.025em}.section-desc{margin:12px 0 0;color:var(--mute)}
.system-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:18px;align-items:start}.system-card.wide{grid-column:1/-1}.system-card.wide .link-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))}
.system-card{background:var(--bg-2);border:1px solid var(--line-soft);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow);transition:transform .28s var(--ease),box-shadow .28s,border-color .28s}
.section:nth-child(even) .system-card{background:var(--bg)}
.system-card:hover{transform:translateY(-3px);border-color:var(--line);box-shadow:0 20px 48px rgba(22,24,29,.09)}
.system-card__top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.system-card__icon{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--bg-3);color:var(--gold-lo);font-size:18px}
.system-card__top b{font-family:var(--font);font-variant-numeric:lining-nums;color:var(--gold);font-weight:700;font-size:13px}
.system-card h3{margin:0 0 8px;font-size:clamp(18px,1.4vw,21px)}.system-card p{margin:4px 0;color:var(--ink-2)}
.link-list{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.link-list a{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:14px;background:var(--bg-3);text-decoration:none;font-weight:600;font-size:14px;transition:background .2s}
.link-list a:hover{background:#efe6cc}.link-list a::after{content:"↗";color:var(--gold-lo)}
.pending{color:var(--mute);font-size:14px}
/* 바닥글·휴대폰 하단 고정 (188 .sticky-cta 방식) */
.footer{padding:40px 0 48px;border-top:1px solid var(--line-soft);font-size:13px;color:var(--mute)}.footer .wordmark{margin-bottom:12px}
.sticky-cta{display:none}
@media(max-width:860px){.nav{padding:12px 16px;flex-wrap:wrap;gap:10px}.nav nav{order:3;width:100%;margin:0}.nav-cta{margin-left:auto}
.hero-proof{grid-template-columns:1fr}.shell{width:calc(100% - 32px)}
.sticky-cta{display:flex;gap:8px;position:fixed;left:12px;right:12px;bottom:12px;z-index:30;padding:8px;border-radius:var(--pill);background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 10px 30px rgba(22,24,29,.15)}
.sticky-cta a{flex:1;justify-content:center}body{padding-bottom:84px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto}}
"""

ICONS = ["◆", "◇", "▲", "●", "■", "★", "✦", "◎", "✚", "❖"]

def card_html(i, h, xs, r):
    items = [x.format(r=r) for x in xs]
    links = [x for x in items if x.startswith("<a ")]
    rest = [x for x in items if not x.startswith("<a ")]
    body = "".join(f"<p class='{'pending' if '준비 중' in x or '정리 중' in x or '받는 대로' in x else ''}'>{x}</p>" for x in rest)
    if links:
        body += "<div class='link-list'>" + "".join(links) + "</div>"
    wide = " wide" if len(links) > 4 else ""
    return (f"<article class='system-card{wide}'><div class='system-card__top'><span class='system-card__icon'>{ICONS[i % len(ICONS)]}</span>"
            f"<b>{i+1:02d}</b></div><h3>{h}</h3>{body}</article>")

def page(path, title, lead, sections, MENU):
    r = "../" * path.count("/")
    nav = "".join(f"<a href='{p if p.startswith('http') else r + p}' class='{'on' if p == path else ''}'>{n}</a>" for p, n in MENU)
    eng = {"": "Prime Asset · Premium", "about/": "About Premium", "join/": "Join Us", "tools/": "Sales Support Showroom",
           "wiki/": "Insurance Wiki", "links/": "Useful Links", "members/": "Members Only", "members/admin/": "Admin", "privacy/": "Privacy Policy"}.get(path, "Prime Asset · Premium")
    cards = "".join(card_html(i, h, xs, r) for i, (h, xs) in enumerate(sections))
    proof = ""
    if path == "":
        proof = ("<div class='hero-proof'><div class='metric'><div class='metric__num'>19</div><div class='metric__label'>함께하는 본부</div><div class='metric__desc'>기준일 표기 예정</div></div>"
                 "<div class='metric'><div class='metric__num'>1,100+</div><div class='metric__label'>소속 설계사</div><div class='metric__desc'>기준일 표기 예정</div></div>"
                 "<div class='metric'><div class='metric__num'>AI</div><div class='metric__label'>영업지원 도구</div><div class='metric__desc'>회원 전용 사용</div></div></div>")
    actions = ('<div class="hero-actions"><a class="lux-btn lux-btn--gold" href="#tools">도구 바로가기 <span>↓</span></a></div>' if path == 'members/' else f'<div class="hero-actions"><a class="lux-btn lux-btn--gold" href="{r}">합류 상담 신청 <span>↗</span></a><a class="lux-btn lux-btn--ghost" href="{r}">영업지원 도구 보기 <span>→</span></a></div>')
    hero_t = title if path else "설계사의 <em>성장</em>을<br><em>설계</em>합니다"
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>{title} | 프라임에셋 프리미엄 (테스트)</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Marcellus&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="{r}assets/style.css?v=2"></head><body>
<div class="test-bar">테스트 페이지입니다 — 내용 준비 중</div>
<header class="nav"><a class="wordmark" href="{r}"><span class="lux-mark">PA</span><span class="wordmark__text">프라임에셋 <b>프리미엄</b></span></a>
<nav aria-label="주요 메뉴">{nav}</nav><a class="nav-cta lux-btn lux-btn--gold lux-btn--sm" href="{r}">합류 상담 <span>↗</span></a></header>
<main><section class="hero"><div class="shell"><p class="hero-kicker"><span class="lux-eyebrow">{eng}</span><span class="hero-kicker__ko">프라임에셋 프리미엄사업부</span></p>
<h1 class="hero-title">{hero_t}</h1><p class="hero-lead">{lead}</p>
{actions}{proof}</div></section>
<section class="section" id="tools"><div class="shell"><header class="section-head"><p class="eyebrow"><span class="eyebrow__num">01</span>{eng}</p><h2>{"바로가기" if path == "members/" else "메뉴 구성"}</h2></header>
<div class="system-grid">{cards}</div></div></section></main>
<footer class="footer"><div class="shell"><a class="wordmark" href="{r}"><span class="lux-mark">PA</span><span class="wordmark__text">프라임에셋 <b>프리미엄</b></span></a>
<p>회사·사업자 정보(준비 중) · 연락처(준비 중) · <a href="{r}privacy/">개인정보처리방침</a> · <a href="{r}members/">설계사 로그인</a></p></div></footer>
<div class="sticky-cta"><a class="lux-btn lux-btn--ghost lux-btn--sm" href="#">전화(준비 중)</a><a class="lux-btn lux-btn--gold lux-btn--sm" href="{r}">상담 신청</a></div>
</body></html>"""
