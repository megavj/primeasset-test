/* 프라임에셋 프리미엄 — 순수 SVG 막대그래프 (외부 차트 라이브러리 없음).
   쓰는 곳: 인트라넷 실적(assets/glass-members.js), 관리자 방문 합계(assets/admin-requests.js).
   원칙: 막대는 얇게(최대 24px), 데이터 쪽 끝만 4px 둥글게, 쌓은 막대 사이 2px 흰 틈, 격자는 가는 실선.
   값 글씨는 막대에 다 붙이지 않고 가장 큰 것·마지막 것만. 나머지는 마우스를 올리면(title) 보이고 표에 있음.
   색 2개는 dataviz 색 검사(명도대·채도·색각이상 분리·3:1 대비) 통과: 파랑 #2a5bd7, 주황 #d97706. 글씨는 항상 14px 이상, 진한 회색.
   PA_CHART.bars({ labels:[], series:[{name, values:[]}], orient:'v'|'h', fmt, title, note, short }) → <figure class="pa-chart"> */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["#2a5bd7", "#d97706"];
  const sv = (tag, attrs, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === "class") e.className = v; else e.setAttribute(k, v); } for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
  const won = (v) => v >= 1e8 ? (Math.round(v / 1e7) / 10).toLocaleString("ko-KR") + "억" : v >= 1e4 ? Math.round(v / 1e4).toLocaleString("ko-KR") + "만" : Math.round(v).toLocaleString("ko-KR");
  const int = (v) => Math.round(v).toLocaleString("ko-KR");
  const tw = (s) => [...String(s)].reduce((a, ch) => a + (/[가-힣ㄱ-ㅎ]/.test(ch) ? 14 : /[A-Z]/.test(ch) ? 10 : 8), 0); // 14px 글씨의 대략 폭
  const nice = (x) => { if (!(x > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(x))); const f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const ticks = (max, n) => { const step = nice(max / n); const out = []; for (let v = 0; v <= max + step * 1e-6; v += step) out.push(v); if (out[out.length - 1] < max - 1e-9) out.push(out.length * step); return out.length > 1 ? out : [0, step]; };
  const cut = (s, maxW) => { s = String(s); if (tw(s) <= maxW) return s; let t = s; while (t.length > 1 && tw(t + "…") > maxW) t = t.slice(0, -1); return t + "…"; };
  // 막대 경로: 바닥(또는 왼쪽)은 직각, 데이터 쪽 끝만 둥글게
  const up = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h)); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const right = (x, y, w, h, r) => { r = Math.max(0, Math.min(r, h / 2, w)); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  const f2 = (v) => Math.round(v * 100) / 100;

  // 세로 막대(월·연도별). 여러 series면 위로 쌓음
  function drawV(o, W) {
    const n = o.labels.length, S = o.series.length, fmt = o.fmt || int, disp = (s) => o.short ? String(s).slice(0, o.short) : String(s);
    const TOP = 26, AXIS = 30, H = o.height || 230, plotH = H - TOP - AXIS;
    const totals = o.labels.map((_, i) => o.series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
    const max = Math.max(0, ...totals); const T = ticks(max, 4); const top = T[T.length - 1] || 1;
    const yw = Math.max(...T.map(t => tw(fmt(t)))) + 12;
    const x0 = yw, plotW = Math.max(40, W - x0 - 6), band = plotW / n, bw = Math.min(24, Math.max(5, band * 0.62));
    const y = (v) => TOP + plotH - (v / top) * plotH, cx = (i) => x0 + band * i + band / 2;
    const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title || "" });
    for (const t of T) { const yy = f2(y(t)); svg.append(sv("line", { x1: x0, x2: x0 + plotW, y1: yy, y2: yy, class: "pa-grid" }), sv("text", { x: x0 - 6, y: yy + 5, "text-anchor": "end", class: "pa-tick" }, fmt(t))); }
    for (let i = 0; i < n; i++) {
      const g = sv("g", { class: "pa-bar", tabindex: "0" });
      g.append(sv("title", {}, `${o.labels[i]} · ` + o.series.map(s => `${s.name} ${fmt(s.values[i] || 0)}`).join(" · ")));
      g.append(sv("rect", { x: f2(x0 + band * i), y: TOP, width: f2(band), height: plotH, fill: "transparent" })); // 넓은 hover 영역
      let acc = 0, placed = 0;
      o.series.forEach((s, k) => {
        const v = Math.max(0, s.values[i] || 0); if (!v) return;
        const yTop = y(acc + v), yBot = y(acc); const h = Math.max(0, yBot - yTop - (placed ? 2 : 0)); // 2px 흰 틈
        const isTop = o.series.slice(k + 1).every(t => !(t.values[i] > 0));
        g.append(sv("path", { d: up(f2(cx(i) - bw / 2), f2(yTop), f2(bw), f2(h), isTop ? 4 : 0), fill: COLORS[k % COLORS.length] }));
        acc += v; placed++;
      });
      svg.append(g);
    }
    // 값 글씨: 가장 큰 막대 + 마지막 막대(겹치면 생략)
    const iMax = totals.indexOf(max); const want = [iMax]; if (n - 1 !== iMax) want.push(n - 1);
    let lastX = -1e9;
    for (const i of want) { if (!(totals[i] > 0)) continue; const w = tw(fmt(totals[i])); const x = cx(i); if (Math.abs(x - lastX) < w + 6) continue; lastX = x;
      svg.append(sv("text", { x: f2(x), y: f2(y(totals[i]) - 7), "text-anchor": "middle", class: "pa-val" }, fmt(totals[i]))); }
    // 가로축 글씨: 겹치지 않게 건너뛰되 마지막 것은 항상
    const lw = Math.max(...o.labels.map(l => tw(disp(l)))) + 8; const every = Math.max(1, Math.ceil(lw / band));
    for (let i = n - 1; i >= 0; i -= every) svg.append(sv("text", { x: f2(cx(i)), y: H - 9, "text-anchor": "middle", class: "pa-tick" }, disp(o.labels[i])));
    svg.append(sv("line", { x1: x0, x2: x0 + plotW, y1: f2(y(0)), y2: f2(y(0)), class: "pa-axis" }));
    return svg;
  }

  // 가로 막대(본부·보험사 순위). series 1개
  function drawH(o, W) {
    const n = o.labels.length, fmt = o.fmt || int, vals = o.series[0].values.map(v => Math.max(0, v || 0));
    const RH = 26, BH = 16, TOP = 4, AXIS = 26, H = TOP + n * RH + AXIS;
    const max = Math.max(0, ...vals); const T = ticks(max, 3); const top = T[T.length - 1] || 1;
    const lw = Math.min(Math.max(...o.labels.map(tw)) + 10, Math.round(W * 0.34)); const vw = tw(fmt(max)) + 10;
    const x0 = lw, plotW = Math.max(40, W - x0 - vw); const x = (v) => x0 + (v / top) * plotW;
    const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.title || "" });
    for (const t of T) { const xx = f2(x(t)); svg.append(sv("line", { x1: xx, x2: xx, y1: TOP, y2: TOP + n * RH, class: "pa-grid" }), sv("text", { x: xx, y: H - 7, "text-anchor": t === 0 ? "start" : "middle", class: "pa-tick" }, fmt(t))); }
    const iMax = vals.indexOf(max);
    for (let i = 0; i < n; i++) {
      const yy = TOP + i * RH; const g = sv("g", { class: "pa-bar", tabindex: "0" });
      g.append(sv("title", {}, `${o.labels[i]} · ${o.series[0].name} ${fmt(vals[i])}`), sv("rect", { x: 0, y: yy, width: W, height: RH, fill: "transparent" }),
        sv("text", { x: x0 - 8, y: yy + RH / 2 + 5, "text-anchor": "end", class: "pa-cat" }, cut(o.labels[i], lw - 10)));
      if (vals[i] > 0) g.append(sv("path", { d: right(x0, yy + (RH - BH) / 2, f2(x(vals[i]) - x0), BH, 4), fill: COLORS[0] }));
      if (i === iMax || i === n - 1) g.append(sv("text", { x: f2(x(vals[i]) + 6), y: yy + RH / 2 + 5, class: "pa-val" }, fmt(vals[i])));
      svg.append(g);
    }
    svg.append(sv("line", { x1: x0, x2: x0, y1: TOP, y2: TOP + n * RH, class: "pa-axis" }));
    return svg;
  }

  function bars(o) {
    const fig = el("figure", { class: "pa-chart" + (o.orient === "h" ? " pa-chart--h" : "") });
    if (o.series.length > 1) fig.append(el("div", { class: "pa-legend", "aria-hidden": "true" }, ...o.series.map((s, k) => el("span", {}, el("i", { style: `background:${COLORS[k % COLORS.length]}` }), s.name))));
    const holder = el("div", { class: "pa-chart-svg" }); fig.append(holder);
    if (o.title || o.note) fig.append(el("figcaption", {}, o.title ? el("b", {}, o.title) : null, o.note ? " · " + o.note : null));
    let last = 0;
    const draw = () => { const W = Math.floor(holder.clientWidth); if (!W || W === last) return; last = W; holder.replaceChildren(o.orient === "h" ? drawH(o, W) : drawV(o, W)); };
    if (typeof ResizeObserver === "function") new ResizeObserver(draw).observe(holder); else { window.addEventListener("resize", draw); setTimeout(draw, 0); }
    return fig;
  }
  window.PA_CHART = { bars, won, int, COLORS };
})();
