# HOME-07 메인 리디자인 (화려한 버전) — Vercel(제품 흐름·벤토) + Runway(전면 미디어 첫 화면·가로 쇼룸) 구조만 참고
# 공개 메인에는 GAS 실제 주소를 넣지 않는다(이사님 ③). 모든 카드는 사이트 내부 페이지·보험노트·위키로만 연결.

CSS = r"""
:root{--bg:#07060f;--bg2:#0e0c1d;--ink:#f6f4ff;--ink2:rgba(246,244,255,.74);--mute:#9b98b8;--line:rgba(255,255,255,.1);
--v:#7c3aed;--p:#ff2e93;--o:#ff8a00;--c:#00e5ff;--y:#ffd60a;--g:#2bff88;
--grad:linear-gradient(100deg,#00e5ff 0%,#7c3aed 35%,#ff2e93 65%,#ff8a00 100%);
--font:"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
--shell:min(1240px,calc(100% - 48px));--r:22px}
*{box-sizing:border-box}html{scroll-behavior:smooth;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);word-break:keep-all;overflow-x:clip;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}.shell{width:var(--shell);margin:0 auto}
.test-bar{position:relative;z-index:40;background:var(--grad);color:#fff;text-align:center;font-size:12px;font-weight:700;padding:5px 8px;letter-spacing:.02em}
/* nav */
.nav{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:20px;padding:14px max(24px,calc((100% - 1240px)/2));background:rgba(7,6,15,.55);-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);border-bottom:1px solid var(--line)}
.wordmark{display:flex;align-items:center;gap:10px;font-weight:800;white-space:nowrap}
.mark{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:13px;font-weight:900;background:var(--grad);background-size:200% 100%;animation:slide 6s linear infinite;color:#fff}
.nav nav{display:flex;gap:4px;margin-left:auto;overflow-x:auto;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 85%,transparent);mask-image:linear-gradient(90deg,#000 85%,transparent);padding-right:24px}.nav nav::-webkit-scrollbar{display:none}
.nav nav a{padding:8px 13px;border-radius:999px;font-size:14px;color:var(--ink2);white-space:nowrap;transition:.2s}.nav nav a:hover{color:#fff;background:rgba(255,255,255,.08)}
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 24px;border-radius:999px;font-weight:800;font-size:15px;white-space:nowrap;transition:transform .25s,box-shadow .25s}
.btn:hover{transform:translateY(-2px)}
.btn-hot{background:var(--grad);background-size:200% 100%;animation:slide 5s linear infinite;color:#fff;box-shadow:0 10px 40px rgba(255,46,147,.45)}
.btn-ghost{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);color:#fff}
.btn-sm{padding:9px 16px;font-size:13px}
@keyframes slide{to{background-position:200% 0}}
/* hero */
.hero{position:relative;min-height:min(calc(100vh - 30px),960px);min-height:min(calc(100svh - 30px),960px);display:flex;align-items:center;overflow:hidden;isolation:isolate}
#fx{position:absolute;inset:0;width:100%;height:100%;z-index:-2}
.blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.75;z-index:-3;animation:float 14s ease-in-out infinite alternate}
.b1{width:46vw;height:46vw;background:#7c3aed;top:-12vw;left:-8vw}.b2{width:38vw;height:38vw;background:#ff2e93;bottom:-14vw;right:-6vw;animation-delay:-4s}
.b3{width:30vw;height:30vw;background:#00e5ff;top:20%;right:18%;opacity:.45;animation-delay:-8s}.b4{width:26vw;height:26vw;background:#ff8a00;bottom:5%;left:25%;opacity:.4;animation-delay:-2s}
@keyframes float{0%{transform:translate(0,0) scale(1)}50%{transform:translate(6vw,-4vw) scale(1.15)}100%{transform:translate(-4vw,5vw) scale(.92)}}
.grid-floor{position:absolute;left:-50%;right:-50%;bottom:-10%;height:55%;z-index:-1;background-image:linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px);background-size:64px 64px;transform:perspective(600px) rotateX(62deg);transform-origin:top;animation:floor 3s linear infinite;-webkit-mask-image:linear-gradient(transparent,#000 40%);mask-image:linear-gradient(transparent,#000 40%)}
@keyframes floor{to{background-position:0 64px}}
.hero-inner{position:relative;text-align:center;padding:90px 0 120px}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 14px 7px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);font-size:13px;color:var(--ink2);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.pill b{background:var(--grad);color:#fff;border-radius:999px;padding:3px 9px;font-size:11px}
.hero h1{font-size:clamp(42px,8vw,118px);line-height:1.12;letter-spacing:-.045em;margin:26px 0 22px;font-weight:900}
.hero h1 .glow{background:var(--grad);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:slide 6s linear infinite;filter:drop-shadow(0 0 30px rgba(255,46,147,.35))}
.rot{display:inline-block;position:relative;height:1.12em;line-height:1.12;vertical-align:bottom;overflow:hidden;clip-path:inset(0)}
.rot span{display:block;line-height:1.12;animation:rot 12s cubic-bezier(.7,0,.3,1) infinite}
@keyframes rot{0%,20%{transform:translateY(0)}25%,45%{transform:translateY(-100%)}50%,70%{transform:translateY(-200%)}75%,95%{transform:translateY(-300%)}100%{transform:translateY(-400%)}}
.hero p.lead{text-shadow:0 2px 18px rgba(7,6,15,.9);font-size:clamp(17px,1.6vw,22px);color:var(--ink2);max-width:720px;margin:0 auto 34px;line-height:1.6}
.hero .acts{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.orbit{position:absolute;inset:0;pointer-events:none;z-index:-1}
.chip{position:absolute;padding:9px 15px;border-radius:14px;font-size:13px;font-weight:700;background:rgba(14,12,29,.6);border:1px solid rgba(255,255,255,.14);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,0,0,.35);animation:bob 6s ease-in-out infinite alternate;white-space:nowrap}
.chip i{font-style:normal;margin-right:6px}
@keyframes bob{to{transform:translateY(-18px) rotate(-2deg)}}
.scroll-hint{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);font-size:12px;color:var(--mute);letter-spacing:.2em}
/* marquee */
.marquee{-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);border-block:1px solid var(--line);background:rgba(255,255,255,.02);overflow:hidden;padding:18px 0}
.mq{display:flex;gap:48px;width:max-content;animation:mq 38s linear infinite;font-weight:800;font-size:clamp(18px,2vw,26px);color:rgba(255,255,255,.4)}
.mq span:nth-child(3n+1){color:#fff}.mq em{font-style:normal;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes mq{to{transform:translateX(-50%)}}
/* sections */
section.sec{padding:clamp(80px,10vw,140px) 0}
.eyebrow{font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sec h2{font-size:clamp(34px,5vw,68px);line-height:1.08;letter-spacing:-.035em;margin:14px 0 16px;font-weight:900}
.sec .desc{color:var(--ink2);font-size:18px;max-width:640px;line-height:1.6;margin:0}
/* bento */
.bento{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px;margin-top:48px}
.card{position:relative;overflow:hidden;border-radius:var(--r);padding:72px 28px 28px;min-height:260px;background:var(--bg2);border:1px solid var(--line);display:flex;flex-direction:column;justify-content:flex-end;transition:transform .35s,border-color .35s;isolation:isolate}
.card:hover{transform:translateY(-6px);border-color:rgba(255,255,255,.3)}
.card::before{content:"";position:absolute;inset:0;z-index:-1;background:var(--art);opacity:.9;transition:transform .8s}
.card:hover::before{transform:scale(1.08)}
.card::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 30%,rgba(7,6,15,.92))}
.card .tag{position:absolute;top:22px;left:24px;font-size:12px;font-weight:800;padding:5px 11px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.card .big{position:absolute;top:10px;right:18px;font-size:clamp(70px,8vw,120px);font-weight:900;opacity:.22;line-height:1}
.card h3{font-size:clamp(22px,2.2vw,30px);margin:0 0 8px;letter-spacing:-.02em}
.card p{margin:0;color:var(--ink2);font-size:15px;line-height:1.55}
.card .go{margin-top:14px;font-weight:800;font-size:14px}
.c1{grid-column:span 4;min-height:380px;--art:radial-gradient(circle at 80% 20%,#ff2e93,transparent 50%),radial-gradient(circle at 20% 30%,#7c3aed,transparent 55%),radial-gradient(circle at 60% 90%,#00e5ff,transparent 50%),#120a2a}
.c2{grid-column:span 2;min-height:380px;--art:radial-gradient(circle at 50% 20%,#ff8a00,transparent 60%),radial-gradient(circle at 10% 90%,#ff2e93,transparent 55%),#1c0d10}
.c3{grid-column:span 2;--art:radial-gradient(circle at 70% 30%,#2bff88,transparent 55%),radial-gradient(circle at 10% 80%,#00a3ff,transparent 55%),#061a17}
.c4{grid-column:span 2;--art:radial-gradient(circle at 30% 20%,#ffd60a,transparent 55%),radial-gradient(circle at 90% 90%,#ff8a00,transparent 50%),#1d1606}
.c5{grid-column:span 2;--art:radial-gradient(circle at 70% 20%,#00e5ff,transparent 55%),radial-gradient(circle at 20% 90%,#7c3aed,transparent 55%),#07142a}
.c6{grid-column:span 3;--art:radial-gradient(circle at 80% 30%,#7c3aed,transparent 55%),radial-gradient(circle at 10% 70%,#00e5ff,transparent 50%),#0d0a24}
.c7{grid-column:span 3;--art:radial-gradient(circle at 20% 30%,#ff2e93,transparent 55%),radial-gradient(circle at 90% 80%,#ffd60a,transparent 45%),#220a18}
.toolrow{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.toolrow span{font-size:13px;font-weight:700;padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}
/* feature rows (Vercel style) */
.rows{display:grid;gap:22px;margin-top:48px}
.row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:40px;align-items:center;padding:36px;border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01));border:1px solid var(--line)}
.row:nth-child(even) .mock{order:-1}
.row .num{font-size:14px;font-weight:900;color:var(--accent)}
.row h3{font-size:clamp(26px,3vw,42px);margin:10px 0 12px;letter-spacing:-.03em}
.row p{color:var(--ink2);line-height:1.65;margin:0 0 18px}
.mock{position:relative;aspect-ratio:16/10;border-radius:20px;background:#0b0a18;border:1px solid rgba(255,255,255,.12);overflow:hidden;box-shadow:0 30px 80px -20px var(--accent)}
.mock .top{display:flex;gap:6px;padding:12px 14px;border-bottom:1px solid var(--line)}.mock .top i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.2)}
.mock .body{padding:18px;display:grid;gap:10px}
.bar{height:12px;border-radius:6px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
.bar::after{content:"";position:absolute;inset:0;width:var(--w);background:var(--accent);border-radius:6px;transform-origin:left;animation:grow 2.8s cubic-bezier(.2,.8,.2,1) infinite alternate}
@keyframes grow{from{transform:scaleX(.15)}to{transform:scaleX(1)}}
.bubble{max-width:78%;padding:10px 14px;border-radius:14px;font-size:13px;line-height:1.45;background:rgba(255,255,255,.07);animation:pop 6s ease-in-out infinite}
.bubble.me{margin-left:auto;background:var(--accent);color:#0b0a18;font-weight:700}
.bubble:nth-child(2){animation-delay:.6s}.bubble:nth-child(3){animation-delay:1.2s}.bubble:nth-child(4){animation-delay:1.8s}
@keyframes pop{0%,8%{opacity:0;transform:translateY(8px)}15%,85%{opacity:1;transform:none}100%{opacity:0}}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kpis div{padding:12px;border-radius:12px;background:rgba(255,255,255,.06);font-size:12px;color:var(--mute)}.kpis b{display:block;font-size:22px;color:#fff}
/* showroom (Runway style horizontal) */
.show{display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-left:max(24px,calc((100% - 1240px)/2));padding:48px max(24px,calc((100% - 1240px)/2)) 20px;scrollbar-width:thin}
.show a{flex:0 0 clamp(250px,26vw,340px);aspect-ratio:3/4;scroll-snap-align:start;border-radius:22px;position:relative;overflow:hidden;padding:24px;display:flex;flex-direction:column;justify-content:flex-end;border:1px solid var(--line);isolation:isolate;transition:transform .3s}
.show a:hover{transform:translateY(-6px) rotate(-.5deg)}
.show a::before{content:"";position:absolute;inset:-20%;z-index:-1;background:conic-gradient(from var(--a,0deg),var(--c1),var(--c2),var(--c3),var(--c1));filter:blur(30px) saturate(140%);animation:spin 12s linear infinite}
.show a::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,transparent 35%,rgba(7,6,15,.9))}
@keyframes spin{to{transform:rotate(360deg)}}
.show .ico{position:absolute;top:22px;left:22px;font-size:40px}
.show h4{font-size:22px;margin:0 0 6px}.show p{margin:0;color:var(--ink2);font-size:14px}
.show small{display:inline-block;margin-top:12px;font-weight:800;font-size:12px;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.35)}
/* stats + cta */
.branches{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:28px}
.br{display:block;padding:16px;border-radius:16px;background:var(--bg2);border:1px solid var(--line);color:var(--ink);text-decoration:none;text-align:center}
.br b{display:block;font-size:22px}.br small{display:block;color:var(--mute);font-size:12px}.br.off{opacity:.6}
.stats-asof{margin:14px 0 0;text-align:right;font-size:13px;color:var(--mute)}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:40px}
.stat{padding:28px;border-radius:22px;background:var(--bg2);border:1px solid var(--line)}
.stat b{display:block;font-size:clamp(40px,5vw,64px);font-weight:900;letter-spacing:-.04em;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.stat small{word-break:break-all}.stat span{color:var(--ink2);font-weight:700}.stat small{display:block;color:var(--mute);margin-top:6px}
.cta{position:relative;overflow:hidden;border-radius:36px;padding:clamp(48px,7vw,96px) 32px;text-align:center;background:var(--grad);background-size:200% 100%;animation:slide 10s linear infinite;isolation:isolate}
.cta::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,.35),transparent 40%),radial-gradient(circle at 80% 80%,rgba(0,0,0,.35),transparent 50%)}
.cta h2{font-size:clamp(34px,5.4vw,76px);margin:0 0 14px;letter-spacing:-.04em;font-weight:900;line-height:1.05}
.cta p{margin:0 0 30px;font-size:18px;color:rgba(255,255,255,.9)}
.cta .btn-w{background:#fff;color:#0b0a18}.cta .btn-ghost{border-color:rgba(255,255,255,.6)}
footer{padding:48px 0 60px;color:var(--mute);font-size:13px;border-top:1px solid var(--line);margin-top:100px}
footer .wordmark{color:#fff;margin-bottom:12px}
.sticky{display:none}
.reveal{opacity:0;transform:translateY(30px);transition:opacity .9s,transform .9s cubic-bezier(.2,.8,.2,1)}.reveal.in{opacity:1;transform:none}
@media(max-width:900px){.bento{grid-template-columns:minmax(0,1fr)}.bento .card{grid-column:auto;min-height:240px}.row{grid-template-columns:minmax(0,1fr);padding:22px}.row:nth-child(even) .mock{order:0}
.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.nav{flex-wrap:wrap;gap:10px;padding:12px 16px}.nav nav{order:3;width:100%;margin:0}.nav .btn-sm{margin-left:auto}
.mock{aspect-ratio:auto;min-height:260px}.show{padding-left:16px;scroll-padding-left:16px}.stat{padding:20px}.chip{display:none}.chip.keep{display:block;font-size:12px}.hero-inner{padding:70px 0 110px}
.sticky{display:flex;gap:8px;position:fixed;left:12px;right:12px;bottom:12px;z-index:50;padding:8px;border-radius:999px;background:rgba(14,12,29,.85);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);border:1px solid var(--line)}
.sticky .btn{flex:1;justify-content:center;padding:12px}body{padding-bottom:84px}.shell{width:calc(100% - 32px)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1;transform:none}}
"""

JS = r"""
(()=>{const c=document.getElementById('fx');if(!c)return;const x=c.getContext('2d');let w,h,pts=[],dpr=Math.min(devicePixelRatio||1,2);
const cols=['#00e5ff','#7c3aed','#ff2e93','#ff8a00','#ffd60a'];
function rs(){w=c.clientWidth;h=c.clientHeight;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);
const n=Math.min(90,Math.floor(w*h/16000));pts=[...Array(n)].map(()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,c:cols[Math.random()*cols.length|0],r:Math.random()*2+1}))}
let mx=-999,my=-999;addEventListener('pointermove',e=>{const b=c.getBoundingClientRect();mx=e.clientX-b.left;my=e.clientY-b.top});
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
function f(){x.clearRect(0,0,w,h);for(const p of pts){if(!still){p.x+=p.vx;p.y+=p.vy}if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
const d=Math.hypot(p.x-mx,p.y-my);if(d<140){p.x+=(p.x-mx)/d;p.y+=(p.y-my)/d}
x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle=p.c;x.shadowBlur=12;x.shadowColor=p.c;x.fill()}
x.shadowBlur=0;for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const a=pts[i],b=pts[j],d=Math.hypot(a.x-b.x,a.y-b.y);
if(d<130){x.strokeStyle=a.c;x.globalAlpha=(1-d/130)*.35;x.lineWidth=1;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}}x.globalAlpha=1;
if(!still)requestAnimationFrame(f)}
rs();addEventListener('resize',rs);f()})();
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>/shot/.test(location.search)?el.classList.add('in'):io.observe(el));
"""

def home(MENU):
    nav = "".join(f"<a href='{p or './'}'>{n}</a>" for p, n in MENU)
    tools = ["상품통합분석기", "수당계산기", "상품분석기", "전산답변기", "자료검색기", "보상답변기", "소식지 분석기", "최신보험뉴스", "AI영업비서"]
    mq_items = ["AI 영업도구", "<em>보험노트</em>", "보험위키", "188 영업지원시스템", "<em>Gemini Gem</em>", "NotebookLM 답변기",
                "실적보드", "<em>합류 상담</em>", "수당계산기", "상품분석기", "고지의무 판독기", "최신보험뉴스"]
    mq = "".join(f"<span>{s}</span><span>✦</span>" for s in mq_items) * 2
    chips = [("🧮", "수당계산기", "top:18%;left:7%", "0s", ""), ("📊", "상품분석기", "top:24%;right:8%", "-1s", ""),
             ("🛡️", "보상답변기", "bottom:26%;left:10%", "-2s", ""), ("📚", "보험위키", "bottom:20%;right:11%", "-3s", ""),
             ("✍️", "보험노트", "top:58%;left:3%", "-4s", ""), ("🤖", "AI 영업비서", "top:12%;left:38%", "-2.5s", ""),
             ("⚡", "AI 도구 20+", "bottom:9%;left:8%", "-1.5s", " keep")]
    chip_html = "".join(f"<div class='chip{k}' style='{pos};animation-delay:{d}'><i>{i}</i>{t}</div>" for i, t, pos, d, k in chips)
    show = [("🧮", "프라임 수당계산기", "내 수당을 바로 계산", "#ff8a00", "#ff2e93", "#ffd60a"),
            ("📊", "상품분석기", "상품 비교·분석을 한 번에", "#7c3aed", "#00e5ff", "#ff2e93"),
            ("💻", "전산답변기", "전산 질문에 즉시 답변", "#00e5ff", "#2bff88", "#7c3aed"),
            ("🛡️", "보험보상답변기", "보상 상담을 근거와 함께", "#ff2e93", "#7c3aed", "#ff8a00"),
            ("🔎", "자료검색기", "흩어진 자료를 한 곳에서", "#2bff88", "#00e5ff", "#ffd60a"),
            ("📰", "최신보험뉴스", "매일 업데이트되는 업계 소식", "#ffd60a", "#ff8a00", "#7c3aed"),
            ("🤖", "AI 영업비서", "화법 연습·상담 시뮬레이션", "#7c3aed", "#ff2e93", "#00e5ff"),
            ("🧠", "NotebookLM 답변기", "N대수술·실손·고지의무", "#00e5ff", "#7c3aed", "#2bff88")]
    show_html = "".join(f"<a href='./' style='--c1:{a};--c2:{b};--c3:{c}'><span class='ico'>{i}</span><h4>{t}</h4><p>{d}</p><small>체험·소개 보기 →</small></a>"
                        for i, t, d, a, b, c in show)
    toolrow = "".join(f"<span>{t}</span>" for t in tools)
    BRANCHES = ['188', '227', '236', '242', '246', '249', '254', '255', '285', '308', '320', '338', '345', '346', '350', '364', '375', '379', '384']
    branch_html = "".join((f"<a class='br' data-no='{n}' href='https://188.primeasset.info/' target='_blank' rel='noopener'><b>{n}</b>본부</a>" if n == "188"
                           else f"<span class='br off' data-no='{n}'><b>{n}</b>본부<small>연결 준비 중</small></span>") for n in BRANCHES)
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#07060f"><title>프라임에셋 프리미엄 (테스트)</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="assets/home.css?v=1"></head><body>
<div class="test-bar">테스트 페이지입니다 — 콘텐츠는 준비 중</div>
<header class="nav"><a class="wordmark" href="./"><span class="mark">PA</span>프라임에셋 프리미엄</a><nav aria-label="주요 메뉴">{nav}</nav>
<a class="btn btn-ghost btn-sm" href="members/#login">로그인</a><a class="btn btn-hot btn-sm" href="members/#signup">회원가입</a></header>
<main>
<section class="hero"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="blob b4"></div>
<canvas id="fx" aria-hidden="true"></canvas><div class="grid-floor" aria-hidden="true"></div><div class="orbit" aria-hidden="true">{chip_html}</div>
<div class="shell hero-inner"><span class="pill"><b>NEW</b>설계사를 위한 AI 영업지원 플랫폼</span>
<h1>설계사의 영업,<br><span class="glow">AI로 <span class="rot"><span>계산하고<br>분석하고<br>답변하고<br>성장하고<br>계산하고</span></span></span></h1>
<p class="lead">AI 영업도구, 영업지원시스템, 보험노트, 보험위키까지.<br>프라임에셋 프리미엄의 모든 서비스를 한곳에서 만나보세요.</p>
<div class="acts"><a class="btn btn-hot" href="members/#login">로그인</a><a class="btn btn-ghost" href="members/#signup">회원가입</a></div></div>
<div class="scroll-hint">SCROLL</div></section>
<div class="marquee" aria-hidden="true"><div class="mq">{mq}</div></div>

<!-- 2. 소개 (예전 /about 일부) -->
<section class="sec" id="about"><div class="shell"><div class="reveal"><div class="eyebrow">About Premium</div>
<h2>프라임에셋 프리미엄사업부</h2><p class="desc">김상현 이사가 이끄는 프리미엄사업부는 19개 본부, 1,100명 이상의 설계사가 함께합니다. (소개 문구 준비 중)</p></div>
<div class="stats"><div class="stat reveal"><b>19</b><span>함께하는 본부</span><small>19개 본부</small></div>
<div class="stat reveal"><b>1,100+</b><span>소속 설계사</span><small>1,100명 이상</small></div>
<div class="stat reveal"><b>20+</b><span>AI 영업도구</span><small>AI 도구 20개 이상 · GAS · Gem · NotebookLM · GPT</small></div>
<div class="stat reveal"><b>4</b><span>서비스 채널</span><small>도구·시스템·보험노트·위키</small></div></div>
<p class="stats-asof">2026년 10월 기준</p></div></section>

<!-- 3·4. 도구 간단 소개 + 보험위키·자주 쓰는 링크 (도구는 비로그인 시 회원가입으로) -->
<section class="sec" id="services"><div class="shell"><div class="reveal"><div class="eyebrow">Tools &amp; Links</div>
<h2>영업에 필요한 도구와 링크</h2><p class="desc">도구는 회원 전용입니다. 누르면 회원가입·로그인 화면으로 이동합니다.</p></div>
<div class="bento">
<a class="card c1 reveal" href="members/#signup" data-tool><span class="tag">AI 영업도구 · GAS</span><span class="big">AI</span><h3>AI 영업도구</h3>
<p>수당 계산, 상품 분석, 전산·보상 답변 등 현장에서 쓰는 도구.</p><div class="toolrow">{toolrow}</div><span class="go">회원가입하고 사용 →</span></a>
<a class="card c6 reveal" href="members/#signup" data-tool><span class="tag">영업지원시스템 · NEW</span><span class="big">∑</span><h3>상품통합분석기</h3>
<p>여러 보험사 상품을 한 번에 비교·분석하는 웹 도구 (테스트 중).</p><span class="go">회원가입하고 사용 →</span></a>
<a class="card c5 reveal" href="members/#signup" data-tool><span class="tag">Gem · NotebookLM · GPT</span><span class="big">✦</span><h3>AI 어시스턴트</h3>
<p>상담연습·질병화법·고지의무 판독까지 대화로.</p><span class="go">회원가입하고 사용 →</span></a>
<a class="card c4 reveal" href="http://wiki.primeasset.info/"><span class="tag">보험위키</span><span class="big">W</span><h3>보험위키</h3>
<p>보장·용어·청구 가이드를 정리한 지식 베이스.</p><span class="go">wiki.primeasset.info →</span></a>
<a class="card c3 reveal" href="https://bohumnote.com/" target="_blank" rel="noopener"><span class="tag">자주 쓰는 링크</span><span class="big">✍</span><h3>보험노트</h3>
<p>보험 콘텐츠 채널.</p><span class="go">bohumnote.com ↗</span></a>
<a class="card c2 reveal" href="https://188.primeasset.info/" target="_blank" rel="noopener"><span class="tag">자주 쓰는 링크</span><span class="big">188</span><h3>188 영업지원시스템</h3>
<p>운영 기준·실적보드·시스템 안내.</p><span class="go">188.primeasset.info ↗</span></a>
<a class="card c6 reveal" href="members/#signup" data-tool><span class="tag">자주 쓰는 링크</span><span class="big">↗</span><h3>영업지원 사이트 모음</h3>
<p>카페·교육·공시 등 (회원 전용, 링크 정리 중).</p><span class="go">회원가입하고 보기 →</span></a>
</div></div></section>

<!-- 5. 함께하는 본부 (번호만 공개. 주소는 관리자 모드 '본부'에서 추가) -->
<section class="sec" id="branches"><div class="shell"><div class="reveal"><div class="eyebrow">Branches</div>
<h2>함께하는 본부</h2><p class="desc">본부를 누르면 해당 본부 페이지로 이동합니다.</p></div>
<div class="branches reveal" id="branch-list">{branch_html}</div>
<p class="stats-asof">2026년 10월 기준 · 19개 본부</p></div></section>

<!-- 6. 회원가입·문의 연락처 -->
<section class="sec" id="contact"><div class="shell">
<div class="cta reveal"><h2>회원가입 · 문의</h2><p>담당: 본부장 김상현 · 전화: <a href="tel:010-8714-9262" style="color:inherit;font-weight:800">010-8714-9262</a></p>
<div class="acts" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn btn-w" href="members/#signup">회원가입 ↗</a><a class="btn btn-ghost" href="members/#login">로그인 →</a></div></div>
</div></section>
</main>
<footer><div class="shell"><a class="wordmark" href="./"><span class="mark">PA</span>프라임에셋 프리미엄</a>
<p><small><a href="privacy/">개인정보처리방침</a></small></p></div></footer>
<div class="sticky"><a class="btn btn-ghost" href="tel:010-8714-9262">전화 문의</a><a class="btn btn-hot" href="members/#signup">회원가입</a></div>
<script>{JS}</script><script src="assets/vendor/supabase-2.118.0.js"></script><script src="assets/auth-config.js?v=1"></script><script src="assets/branches.js?v=1"></script></body></html>"""
