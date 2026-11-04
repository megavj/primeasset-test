/* 성장 나무 — '함께하는 N개 본부' (독립 부품 · 외부 라이브러리·CDN 없음: SVG·CSS·JS 직접 작성)
   사용법: <link rel="stylesheet" href="growth-tree.css"> + <div data-growth-tree></div> + <script src="growth-tree.js" defer></script>
     본부 홈페이지 주소를 DB에서 읽으려면 이 파일보다 먼저 assets/auth-config.js(window.PA_AUTH)를 넣는다.
   · 배치: 가운데(188)에서의 거리 = 세대, 방향 = 계보(같은 상위의 하위는 상위 방향 부채꼴 안). 폭 640px 이하는 위→아래 세로 나무
   · 색: 가문(1대 본부)별 보석 톤, 하위는 같은 계열에서 밝기·채도만 조금씩 → 모두 조금씩 다른 색. 가지는 부모→자식 색 그라데이션
   · 가지: 베지어 가운데선을 따라 굵기가 줄어드는 붓 획(채운 경로). 자랄 때는 붓으로 그리듯 앞부분까지만 그림
   · 움직임: 화면에 들어오면 1회 — 승격 년월 순서로 가지가 뻗고 원이 핌(2024년부터 간격 촘촘, 같은 달은 동시에).
     다 자란 뒤에는 수액(한 번에 한 계보)·숨쉬기. 화면 밖·탭 숨김이면 멈춤. PC는 마우스, 휴대폰은 스크롤에 따라 살짝 기울어짐
   · prefers-reduced-motion: 다 자란 그림만(반복·기울기 없음)
   · 본부장 이름은 넣지 않는다(번호·승격 년월·홈페이지 주소만). 숫자 통계도 따로 보이지 않는다(그림과 움직임으로만) */
(function () {
  'use strict';

  /* ── 1. 기본 데이터: [본부, 승격(첫 실적월), 상위 본부] ── */
  const BASE = [
    ['188', '2017-03', null],
    ['227', '2019-09', '188'],
    ['242', '2020-06', '188'],
    ['249', '2020-09', '188'],
    ['255', '2021-01', '188'],
    ['338', '2024-10', '188'],
    ['345', '2025-01', '188'],
    ['246', '2020-09', '227'],
    ['320', '2024-04', '227'],
    ['350', '2025-01', '227'],
    ['375', '2026-04', '227'],
    ['236', '2020-03', '249'], // 상위(249)보다 먼저 승격(역분할) — 따로 표시하지 않음. 자랄 때 가지가 249 자리를 지나 236에 닿고, 249는 그 가지 위에서 나중에 핀다
    ['285', '2023-01', '255'],
    ['346', '2025-01', '338'],
    ['254', '2021-01', '236'],
    ['364', '2025-10', '236'],
    ['379', '2026-04', '236'],
    ['384', '2026-07', '236'],
    ['308', '2024-01', '254']
  ];
  const ROOT = '188';
  const FALLBACK_URLS = { '188': 'https://188.primeasset.info/' }; // DB를 못 읽을 때만
  const REST = '/rest/v1/branches?select=no,url&visible=eq.true';

  /* ── 2. 색: OKLCH [밝기, 채도, 색상각]. 네이비 바탕에 맞춰 채도를 낮춤(원색·형광 없음) ── */
  const TONES = {
    '188': [0.86, 0.064, 84],  // 샴페인 골드
    '227': [0.72, 0.086, 258], // 사파이어 블루
    '242': [0.77, 0.066, 196], // 청록
    '249': [0.76, 0.078, 158], // 에메랄드
    '255': [0.79, 0.088, 70],  // 호박색
    '338': [0.75, 0.076, 12],  // 로즈
    '345': [0.77, 0.066, 302]  // 라벤더
  };
  const EXTRA_TONES = [[0.8, 0.03, 250], [0.79, 0.05, 112], [0.77, 0.05, 332], [0.79, 0.04, 222]]; // 기본 데이터에 없는 새 1대 본부
  // 가문 안 순서(세대 → 형제)대로 [밝기 차, 채도 배율] — 색상각은 그대로 두고 밝기·채도만 조금씩
  const VARIANTS = [[0, 1], [0.05, 0.84], [-0.05, 1.1], [0.09, 0.74], [-0.085, 1.16], [0.025, 0.7], [-0.03, 1.24], [0.12, 0.64], [-0.11, 1.04]];
  const CARD = '#0d1220', CORE = '#0e1422'; // 카드 바탕 · 원 속(남색, 색은 아주 조금만 — 테두리와 가장자리 빛이 색을 맡음)

  /* ── 3. 시간(ms) ── */
  const TIME = {
    prologue: 900,  // 188 하나만 켜져 있는 시간
    draw: 820,      // 가지 하나가 뻗는 시간(같은 달 본부는 같은 시간이라 동시에 핀다)
    chain: 0.62,    // 236처럼 아직 안 핀 윗대 자리를 지나 뻗을 때 마디별 비율
    perMonth: 62, gapMin: 240, gapMax: 820, // 승격 사이 간격 = 실제 개월 차 × perMonth (최소·최대)
    fastFrom: 2024, fast: 0.6,              // 2024년부터 간격 촘촘 → 빨라지는 성장
    lead: 120,      // 윗대가 피는 동안 미리 뻗기 시작
    minDraw: 420,   // 윗대가 막 피어 시간이 모자랄 때 붓질을 빠르게(이보다 짧게는 안 함) — 같은 달 동시 피기·빨라지는 리듬 유지
    bloom: 760, halo: 1100, yearFade: 520,
    sapSpeed: 0.24, sapLen: 54, sapRest: 2600 // 수액: px/ms, 빛 꼬리 길이, 계보 사이 쉼
  };
  const EASE = { draw: [0.55, 0.06, 0.25, 1], in: [0.55, 0.06, 0.9, 0.6], out: [0.1, 0.4, 0.25, 1], lin: [0, 0, 1, 1] };

  const SVGNS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mq = q => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const RM = mq('(prefers-reduced-motion: reduce)');
  const NARROW = mq('(max-width: 640px)');
  const FINE = mq('(hover: hover) and (pointer: fine)');

  /* ── 4. 데이터 정리 ── */
  const cleanNo = v => { const s = String(v == null ? '' : v).trim(); return /^[0-9A-Za-z가-힣-]{1,12}$/.test(s) ? s : ''; };
  const safeUrl = v => (typeof v === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(v.trim()) ? v.trim() : ''); // http(s)만
  const toMonth = d => { const m = /^(\d{4})-(\d{2})$/.exec(d || ''); return m ? +m[1] * 12 + (+m[2] - 1) : null; };
  const dot = n => (n.date ? n.date.replace('-', '.') : '');
  const spoken = n => n.no + '본부' + (n.date ? ', ' + +n.date.slice(0, 4) + '년 ' + +n.date.slice(5) + '월' : '');

  function buildModel(rows) {
    const meta = new Map(BASE.map(([no, date, parent]) => [no, { date, parent }]));
    let list = [];
    if (Array.isArray(rows) && rows.length) { // DB 목록 = 보이는 본부(메인 목록과 같은 개수)
      const seen = new Set();
      rows.forEach(r => { const no = cleanNo(r && r.no); if (no && !seen.has(no)) { seen.add(no); list.push({ no, url: safeUrl(r.url) }); } });
      if (!seen.has(ROOT)) list.unshift({ no: ROOT, url: safeUrl(FALLBACK_URLS[ROOT]) });
      const rank = new Map(BASE.map(([no], k) => [no, k])); // 번호 순서를 DB 정렬과 무관하게(기본 데이터 순 → 새 본부는 DB 순)
      list = list.map((b, k) => [b, rank.has(b.no) ? rank.get(b.no) : BASE.length + k]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    } else {
      list = BASE.map(([no]) => ({ no, url: safeUrl(FALLBACK_URLS[no] || '') }));
    }
    const present = new Set(list.map(b => b.no));
    const nodes = list.map((b, k) => {
      const m = meta.get(b.no);
      return { i: k, no: b.no, url: b.url, date: m ? m.date : null, month: m ? toMonth(m.date) : null, extra: !m, k, parent: null, children: [] };
    });
    const byNo = new Map(nodes.map(n => [n.no, n]));
    const root = byNo.get(ROOT);
    nodes.forEach(n => {
      if (n === root) return;
      let p = n.extra ? null : meta.get(n.no).parent;
      while (p && !present.has(p)) p = (meta.get(p) || {}).parent || null; // 상위가 목록에서 빠지면(숨김) 그 윗대에 붙임
      // 새 본부(DB에는 있는데 위 BASE 에 승격일·상위 정보가 없음)는 188 아래 마지막 순서로 둔다.
      //   승격 년월을 모르므로 자라는 연출에서도 맨 끝에 피고, 말풍선 없이 번호만 보인다.
      //   승격일·상위를 알게 되면 BASE 에 한 줄 추가하면 제자리(세대·계보)로 옮겨진다.
      n.parent = byNo.get(p) || root;
      n.parent.children.push(n);
    });
    const cmp = (a, b) => {
      const an = a.month == null, bn = b.month == null;
      if (an !== bn) return an ? 1 : -1;
      if (an) return a.k - b.k;
      return a.month - b.month || a.no.localeCompare(b.no, 'en', { numeric: true });
    };
    nodes.forEach(n => n.children.sort(cmp));
    const order = []; // 계보 순서(깊이 우선) = 키보드 이동 순서
    (function walk(n, d, fam) { n.depth = d; n.family = fam; order.push(n); n.children.forEach(c => walk(c, d + 1, d === 0 ? c : fam)); })(root, 0, root);
    for (let k = order.length - 1; k >= 0; k--) { // 자기 아래 깊이별 개수(배치 폭 계산용)
      const n = order[k]; n.counts = new Map([[n.depth, 1]]);
      n.children.forEach(c => c.counts.forEach((v, d) => n.counts.set(d, (n.counts.get(d) || 0) + v)));
    }
    // 색: 1대 본부별 기준 톤 → 가문 안 순서대로 밝기·채도 변형
    let extra = 0;
    root.lch = TONES[ROOT];
    root.children.forEach(f => {
      const tone = TONES[f.no] || EXTRA_TONES[extra++ % EXTRA_TONES.length];
      const fam = order.filter(n => n.family === f).sort((a, b) => a.depth - b.depth || order.indexOf(a) - order.indexOf(b));
      fam.forEach((n, j) => { const v = VARIANTS[j % VARIANTS.length]; n.lch = [clamp(tone[0] + v[0], 0.6, 0.9), clamp(tone[1] * v[1], 0.03, 0.12), tone[2]]; });
    });
    nodes.forEach(n => {
      const lab = lchToLab(n.lch), isRoot = n === root;
      n.color = hex(lab);
      n.fill = hex(mixLab(hexToLab(CORE), lab, isRoot ? 0.07 : 0.05));
      n.label = hex(lchToLab([isRoot ? 0.9 : 0.95, isRoot ? 0.055 : Math.min(0.022, n.lch[1] * 0.3), n.lch[2]]));
      n.sap = hex(lchToLab([Math.min(0.97, n.lch[0] + 0.13), n.lch[1] * 0.55, n.lch[2]]));
      n.rel = new Set([n.i]); // 강조할 본부: 188까지 이어지는 윗대 + 자신 + 산하
      for (let p = n.parent; p; p = p.parent) n.rel.add(p.i);
    });
    order.forEach(n => { const add = c => { n.rel.add(c.i); c.children.forEach(add); }; n.children.forEach(add); });
    const chrono = nodes.slice().sort((a, b) => (a === root ? -1 : b === root ? 1 : cmp(a, b)));
    return { nodes, root, order, chrono, gen1: root.children, maxDepth: Math.max(...nodes.map(n => n.depth)) };
  }

  /* ── 5. 색 계산(OKLab) ── */
  function lchToLab([L, C, h]) { const a = (h * Math.PI) / 180; return [L, C * Math.cos(a), C * Math.sin(a)]; }
  function hexToLab(h) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function hex([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
      .map(v => { v = clamp(v, 0, 1); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'); }).join('');
  }
  const mixLab = (p, q, t) => p.map((v, k) => v + (q[k] - v) * t);

  /* ── 6. 곡선(3차 베지어)·붓 획 ── */
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  function bez(P, t) { const u = 1 - t; return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]; }
  function bezD(P, t) { const u = 1 - t; return [0, 1].map(k => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); }
  function split(P, t) {
    const ab = lerp(P[0], P[1], t), bc = lerp(P[1], P[2], t), cd = lerp(P[2], P[3], t), abc = lerp(ab, bc, t), bcd = lerp(bc, cd, t), m = lerp(abc, bcd, t);
    return [[P[0], ab, abc, m], [m, bcd, cd, P[3]]];
  }
  function trim(P, r0, r1) { // 양 끝 원 둘레(+틈)에서 자름
    let lo = 0, hi = 1;
    for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (dist(bez(P, m), P[0]) < r0) lo = m; else hi = m; }
    const t0 = hi; lo = 0; hi = 1;
    for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; if (dist(bez(P, m), P[3]) < r1) hi = m; else lo = m; }
    const t1 = lo;
    if (t1 <= t0 + 0.01) return null;
    return split(split(P, t0)[1], (t1 - t0) / (1 - t0))[0];
  }
  const f1 = v => Math.round(v * 10) / 10;
  const pathD = P => `M${f1(P[0][0])} ${f1(P[0][1])}C${f1(P[1][0])} ${f1(P[1][1])} ${f1(P[2][0])} ${f1(P[2][1])} ${f1(P[3][0])} ${f1(P[3][1])}`;
  function sample(P, n) { // 가운데선 표본: [x, y, 법선x, 법선y, 누적 길이]
    const pts = []; let s = 0, q = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, p = bez(P, t), d = bezD(P, t), m = Math.hypot(d[0], d[1]) || 1;
      if (q) s += dist(p, q);
      pts.push([p[0], p[1], -d[1] / m, d[0] / m, s]); q = p;
    }
    return { pts, len: s };
  }
  function outline(S, w0, w1, frac) { // 붓 획: 시작 w0 → 끝 w1 로 가늘어짐. frac(0~1)만큼만(자라는 중)
    const Lh = S.len * frac, pts = S.pts;
    if (Lh < 0.3) return '';
    const wAt = s => w1 + (w0 - w1) * Math.pow(1 - s / S.len, 1.4);
    const A = [], B = [];
    const put = (x, y, nx, ny, s) => { const h = wAt(s) / 2; A.push(f1(x + nx * h) + ' ' + f1(y + ny * h)); B.push(f1(x - nx * h) + ' ' + f1(y - ny * h)); };
    let k = 0;
    for (; k < pts.length && pts[k][4] <= Lh; k++) put(pts[k][0], pts[k][1], pts[k][2], pts[k][3], pts[k][4]);
    if (k < pts.length) {
      const a = pts[k - 1], b = pts[k], t = (Lh - a[4]) / (b[4] - a[4] || 1);
      put(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, Lh);
    }
    const he = f1(wAt(Lh) / 2), hs = f1(w0 / 2), Bi = B.reverse();
    return `M${A[0]}L${A.slice(1).join('L')}A${he} ${he} 0 0 0 ${Bi[0]}L${Bi.slice(1).join('L')}A${hs} ${hs} 0 0 0 ${A[0]}Z`;
  }
  function easing([x1, y1, x2, y2]) { // CSS cubic-bezier 와 같은 계산(JS 로 그리는 가지용)
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    return x => {
      let lo = 0, hi = 1, t = x;
      for (let k = 0; k < 24; k++) { const v = X(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }
  const css = e => `cubic-bezier(${e.join(',')})`;

  /* ── 7. 배치 ── */
  // 7-1. 원형(PC·태블릿): 반지름 = 세대, 각도 = 계보. 1대는 승격 순서로 시계 방향
  function radialAngles(model, R, s) {
    const N = model.nodes, need = new Array(N.length).fill(0), ang = new Array(N.length).fill(0);
    for (const n of N) n.counts.forEach((k, d) => { if (d > 0) need[n.i] = Math.max(need[n.i], (k * s) / R(d)); });
    for (let d = 1; d <= model.maxDepth; d++) { const k = N.filter(n => n.depth === d).length; if ((k * s) / R(d) > TAU * 0.96) return null; }
    const kids = model.gen1, total = kids.reduce((t, c) => t + need[c.i], 0);
    if (total > TAU) return null;
    const pad = (TAU - total) / Math.max(1, kids.length);
    let a = 0;
    kids.forEach(c => { const w = need[c.i] + pad; ang[c.i] = a + w / 2; a += w; });
    const fan = (v, fi) => { // 하위는 상위 방향 부채꼴 안(필요한 만큼만 벌림). 하나뿐이면 살짝 비켜 곡선이 살아나게
      const ch = v.children;
      if (ch.length === 1) ang[ch[0].i] = ang[v.i] + (14 / R(ch[0].depth)) * ((fi + v.depth) % 2 ? 1 : -1);
      else if (ch.length > 1) { const F = ch.reduce((t, c) => t + need[c.i], 0); let b = ang[v.i] - F / 2; ch.forEach(c => { ang[c.i] = b + need[c.i] / 2; b += need[c.i]; }); }
      ch.forEach(c => fan(c, fi));
    };
    kids.forEach((c, fi) => fan(c, fi));
    for (let d = 1; d <= model.maxDepth; d++) { // 같은 고리에서 원끼리 겹치지 않게 각도 벌리기(순서 유지)
      const ring = N.filter(n => n.depth === d).sort((p, q) => ang[p.i] - ang[q.i]);
      if (ring.length < 2) continue;
      const min = (s / R(d)) * 1.001;
      for (let it = 0; it < 400; it++) {
        let moved = false;
        for (let k = 0; k < ring.length; k++) {
          const p = ring[k], q = ring[(k + 1) % ring.length];
          let gap = ang[q.i] - ang[p.i];
          if (k === ring.length - 1) gap += TAU;
          if (gap < min) { const push = (min - gap) / 2 + 1e-4; ang[p.i] -= push; ang[q.i] += push; moved = true; }
        }
        if (!moved) break;
      }
    }
    return ang;
  }

  function layoutRadial(model, W) {
    const big = W >= 900;
    const r = big ? 25 : 23, rr = big ? 33 : 30, gap = big ? 22 : 18, s = 2 * r + gap;
    const pad = big ? 34 : 26, hMin = big ? 520 : 470, hMax = big ? 672 : 620;
    const N = model.nodes, root = model.root;
    let best = null;
    for (let D = big ? 122 : 104; D >= 60 && !best; D -= 2) {
      const R = d => (d === 0 ? 0 : D * 1.24 + (rr - r) + (d - 1) * D);
      const ang = radialAngles(model, R, s);
      if (!ang) continue;
      for (let k = 0; k < 180; k++) { // 카드 비율에 맞는 회전(폭 안에 들고, 높이 낮고, 188이 가운데에 가깝게)
        const rot = (k * Math.PI) / 90;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const n of N) {
          const q = n === root ? rr : r, rad = R(n.depth), x = rad * Math.cos(ang[n.i] + rot), y = rad * Math.sin(ang[n.i] + rot);
          x0 = Math.min(x0, x - q); x1 = Math.max(x1, x + q); y0 = Math.min(y0, y - q); y1 = Math.max(y1, y + q);
        }
        const bh = y1 - y0 + 2 * pad;
        if (x1 - x0 + 2 * pad > W || bh > hMax) continue;
        const score = bh + Math.abs(x0 + x1) * 0.3 + Math.abs(y0 + y1) * 0.3;
        if (!best || score < best.score) best = { R, ang, rot, x0, x1, y0, y1, bh, score };
      }
    }
    if (!best) return null;
    const H = Math.round(Math.max(hMin, best.bh));
    const cx = W / 2 - (best.x0 + best.x1) / 2, cy = H / 2 - (best.y0 + best.y1) / 2;
    const pos = N.map(n => {
      const th = best.ang[n.i] + best.rot, R0 = best.R(n.depth);
      return { x: cx + R0 * Math.cos(th), y: cy + R0 * Math.sin(th), rad: n === root ? rr : r, th, R: R0 };
    });
    const polar = (R0, th) => [cx + R0 * Math.cos(th), cy + R0 * Math.sin(th)];
    // 가지 곡선 후보: 첫째가 기본, 나머지는 다른 원을 비켜 가야 할 때
    const VR = [[0.36, 0.42, 0.5, 0]];
    [0.2, 0.5, 0, -0.25].forEach(sw => [0.42, 0.3, 0.56].forEach(k => VR.push([sw, k, 0.5, 0])));
    [0.5, 0.36, 0.64].forEach(m => [0, 0.12, -0.12].forEach(o => VR.push([0.36, 0.42, m, o])));
    const curve = (p, c, v = 0) => {
      const P = pos[p.i], C = pos[c.i], [sw, k, m, o] = VR[v];
      if (p === root) // 188에서 나가는 가지: 시계 방향으로 살짝 휘감아 나감
        return [[cx, cy], polar(C.R * k, C.th - sw), polar(C.R * 0.7, C.th - sw * 0.22), [C.x, C.y]];
      const rm = P.R + (C.R - P.R) * m; // 윗대에서 바깥으로 나가 자식 쪽으로 휘어 들어감
      return [[P.x, P.y], polar(rm, P.th + o), polar(rm, C.th - o), [C.x, C.y]];
    };
    const rings = [];
    for (let d = 1; d <= model.maxDepth; d++) rings.push(best.R(d));
    // 붓 획 굵기(세대별 시작 → 끝): 윗대 끝 굵기 = 아랫대 시작 굵기라 마디를 지나도 자연스럽게 이어짐
    return { mode: 'radial', W, H, pos, curve, variants: VR.length, cx, cy, rings, w0: [0, 3, 1.9, 1.4, 1.1, 0.95], w1: [0, 1.9, 1.4, 1.1, 0.95, 0.85] };
  }

  // 7-2. 세로 나무(휴대폰): 188이 위, 세대가 아래로. 같은 세대는 계보 순서로 가로에 놓고(188 둘레 고리처럼 양옆이 살짝 높은 호),
  //      좁으면 두 줄로 엇갈림. 가지는 윗대 원 아래쪽에서 부채처럼 갈라져 내려감
  function packRow(ideal, u, lo, hi) { // 순서 유지 · 최소 간격 u · [lo, hi] 안에서 이상 위치에 가장 가깝게(PAVA)
    const n = ideal.length, z = ideal.map((v, k) => v - k * u), blocks = [];
    z.forEach(v => {
      blocks.push({ s: v, c: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].s / blocks[blocks.length - 2].c > blocks[blocks.length - 1].s / blocks[blocks.length - 1].c) {
        const b = blocks.pop(); blocks[blocks.length - 1].s += b.s; blocks[blocks.length - 1].c += b.c;
      }
    });
    const out = []; blocks.forEach(b => { for (let k = 0; k < b.c; k++) out.push(b.s / b.c); });
    const zHi = hi - (n - 1) * u;
    return out.map((v, k) => clamp(v, lo, Math.max(lo, zHi)) + k * u);
  }

  function layoutVertical(model, W) {
    const r = 23, rr = 28, gap = 8, s = 2 * r + gap; // 지름 46px(터치 44px 이상)
    const side = 8, lo = side + r, hi = W - side - r, span = hi - lo, cx = W / 2;
    const N = model.nodes, root = model.root, pos = new Array(N.length);
    const bands = [];
    model.order.forEach(n => (bands[n.depth] = bands[n.depth] || []).push(n));
    const top = rr + 24;
    pos[root.i] = { x: cx, y: top, rad: rr };
    let base = top + rr + r + 74; // 1대 줄(가운데 높이)
    for (let d = 1; d < bands.length; d++) {
      const band = bands[d], n = band.length;
      const u = n < 2 ? s : Math.min(s, span / (n - 1));
      let ideal;
      const inset = d === 1 && n > 1 ? Math.min(16, Math.max(0, (span - (n - 1) * s) / 2)) : 0; // 1대는 양끝을 살짝 안으로(가장자리 계보도 양쪽으로 갈라지게)
      if (d === 1) ideal = band.map((c, k) => (n === 1 ? cx : lo + inset + ((span - 2 * inset) * k) / (n - 1)));
      else {
        ideal = [];
        let k = 0;
        while (k < n) { // 같은 상위의 하위끼리: 상위 아래에 모아서
          const p = band[k].parent; let m = 0;
          while (k + m < n && band[k + m].parent === p) m++;
          for (let j = 0; j < m; j++) ideal.push(pos[p.i].x + (m === 1 ? (d % 2 ? 14 : -14) : (j - (m - 1) / 2) * u));
          k += m;
        }
      }
      const xs = packRow(ideal, u, lo, hi);
      const zig = u < s - 0.5, dy = zig ? Math.max(0.82 * s, Math.sqrt(Math.max(0, s * s - u * u)) + 2) : 0;
      // 엇갈림: 붙어 있는(간격 < s) 묶음마다 위·아래 번갈아 — 하위가 있는 본부를 아래 줄에 두어 그 가지가 막힘없이 내려가게
      const rows = new Array(n).fill(0);
      for (let k = 0; k < n;) {
        let e = k;
        while (e + 1 < n && xs[e + 1] - xs[e] < s - 0.5) e++;
        if (e > k) {
          const score = ph => band.slice(k, e + 1).reduce((t, c, j) => t + (c.children.length ? ((j + ph) % 2 ? 1 : -1) : 0), 0);
          const ph = score(1) > score(0) ? 1 : 0;
          for (let j = k; j <= e; j++) rows[j] = (j - k + ph) % 2;
        }
        k = e + 1;
      }
      const A = d === 1 ? 30 : 16; // 188 둘레 고리처럼 양옆이 살짝 높은 호
      band.forEach((c, k) => {
        const q = (xs[k] - cx) / (span / 2);
        pos[c.i] = { x: xs[k], y: base - A * q * q + rows[k] * dy, rad: r };
      });
      base += (zig ? dy : 0) + s + 54;
    }
    const H = Math.round(Math.max(...pos.map(p => p.y + p.rad)) + 30);
    // 가지 곡선 후보: 첫째가 기본(윗대 원 아래에서 부채처럼 갈라져 내려감), 나머지는 다른 원을 비켜 가야 할 때
    const VV = [[null, 0.42, 0.52, 0]];
    [0.3, 0, 0.75, 0.9].forEach(a => [0.42, 0.25, 0.62].forEach(b => [0.52, 0.3, 0.72].forEach(e => [0, 0.3, -0.3].forEach(c2 => VV.push([a, b, e, c2])))));
    const curve = (p, c, v = 0) => {
      const P = pos[p.i], C = pos[c.i], dy = C.y - P.y, dx = C.x - P.x, [a, b, e, c2] = VV[v];
      const sway = Math.abs(dx) < 12 ? (c.depth % 2 ? 11 : -11) : 0; // 바로 아래면 곧은 선 대신 살짝 S자
      return [[P.x, P.y], [P.x + dx * (a == null ? (p === root ? 0.46 : 0.56) : a) + sway, P.y + dy * b], [C.x - dx * c2 - sway, C.y - dy * e], [C.x, C.y]];
    };
    return { mode: 'vertical', W, H, pos, curve, variants: VV.length, cx, cy: top, rings: null, w0: [0, 2.6, 1.75, 1.3, 1.05, 0.9], w1: [0, 1.75, 1.3, 1.05, 0.9, 0.8] };
  }

  // 곡선이 다른 원(양 끝 원 제외)에서 떨어진 가장 가까운 거리 — 가지가 원을 지나가지 않게
  function clearance(P, pos, ia, ib) {
    let m = Infinity;
    for (let k = 1; k < 36; k++) {
      const q = bez(P, k / 36);
      for (let j = 0; j < pos.length; j++) if (j !== ia && j !== ib) m = Math.min(m, Math.hypot(q[0] - pos[j].x, q[1] - pos[j].y) - pos[j].rad);
    }
    return m;
  }
  function route(L, p, c) { // 기본 곡선이 다른 원에 너무 가까우면 후보 중 가장 멀리 비켜 가는 곡선
    const need = 7;
    let best = L.curve(p, c, 0), bc = clearance(best, L.pos, p.i, c.i);
    for (let v = 1; v < (L.variants || 1) && bc < need; v++) {
      const P = L.curve(p, c, v), k = clearance(P, L.pos, p.i, c.i);
      if (k > bc + 0.5) { best = P; bc = k; }
    }
    return best;
  }

  /* ── 8. 자라는 순서(시간표) ── */
  function plan(model) {
    const root = model.root, T = TIME;
    const bloom = new Map([[root.i, 0]]), reach = new Map([[root.i, 0]]), edges = new Map(), bridges = new Map();
    const groups = [];
    model.chrono.forEach(n => {
      if (n === root) return;
      const g = groups[groups.length - 1];
      if (g && g.month === n.month) g.nodes.push(n); else groups.push({ month: n.month, nodes: [n] });
    });
    let prevB = 0, prevM = root.month;
    const knots = [[0, root.month]];
    groups.forEach((g, gi) => {
      let B;
      if (gi === 0) B = T.prologue + T.draw;
      else {
        const dm = g.month != null && prevM != null ? Math.max(0, g.month - prevM) : 4;
        B = prevB + clamp(dm * T.perMonth, T.gapMin, T.gapMax) * (g.month == null || g.month >= T.fastFrom * 12 ? T.fast : 1);
      }
      const jobs = g.nodes.map(n => {
        if (reach.has(n.i)) return null; // 이미 가지가 지나간 자리(236 때의 249): 원만 핀다
        const chain = [n]; let a = n.parent;
        while (a && !reach.has(a.i)) { chain.unshift(a); a = a.parent; }
        const k = chain.length, units = k + 0.25 * (k - 1); // 마디 수(+다리)
        return { chain, units, full: k > 1 ? T.draw * T.chain * units : T.draw, avail: bloom.has(a.i) ? bloom.get(a.i) - T.lead : reach.get(a.i) };
      });
      jobs.forEach(j => { if (j) B = Math.max(B, j.avail + Math.min(j.full, T.minDraw * j.units)); });
      jobs.forEach(j => {
        if (!j) return;
        const dur = Math.min(j.full, B - j.avail), seg = dur / j.units, br = seg * 0.25;
        let t = B - dur;
        j.chain.forEach((m, k) => {
          const last = k === j.chain.length - 1;
          edges.set(m.i, { start: t, dur: seg, ease: j.chain.length === 1 ? EASE.draw : k === 0 ? EASE.in : last ? EASE.out : EASE.lin });
          t += seg;
          if (!last) { bridges.set(m.i, { start: t, dur: br, next: j.chain[k + 1].i }); t += br; reach.set(m.i, t); }
        });
      });
      g.nodes.forEach(n => { bloom.set(n.i, B); reach.set(n.i, B); });
      if (g.month != null) { knots.push([B, g.month]); prevM = g.month; }
      prevB = B;
    });
    bridges.forEach((b, i) => { b.hide = bloom.get(i); });
    const end = prevB + T.halo;
    // 연도: (시각, 월) 매듭을 이어 1월을 지나는 시각에 넘김
    const years = [];
    const y0 = Math.floor(knots[0][1] / 12), y1 = Math.floor(knots[knots.length - 1][1] / 12);
    for (let y = y0; y <= y1; y++) {
      let at = 0;
      if (y > y0) {
        const m = y * 12;
        for (let k = 1; k < knots.length; k++) {
          const [ta, ma] = knots[k - 1], [tb, mb] = knots[k];
          if (m <= mb) { at = mb === ma ? tb : ta + ((tb - ta) * (m - ma)) / (mb - ma); break; }
        }
      }
      years.push({ y, at });
    }
    return { bloom, edges, bridges, years, end };
  }

  /* ── 9. DB(본부 홈페이지 주소) — 페이지당 1회. assets/branches.js 와 같은 방식(anon 키, 쿠키·세션 안 보냄) ── */
  let rowsPromise = null;
  function loadRows() {
    if (rowsPromise) return rowsPromise;
    rowsPromise = (async () => {
      const C = window.PA_AUTH || {};
      if (!C.url || !C.anonKey || typeof fetch !== 'function') return null;
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
      try {
        const res = await fetch(String(C.url).replace(/\/$/, '') + REST, {
          headers: { apikey: C.anonKey, Authorization: 'Bearer ' + C.anonKey }, credentials: 'omit', signal: ctl ? ctl.signal : undefined
        });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) && data.length ? data : null;
      } catch (e) { return null; } finally { clearTimeout(timer); }
    })();
    return rowsPromise;
  }

  /* ── 10. 부품 ── */
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const div = (cls, parent) => { const e = document.createElement('div'); e.className = cls; if (parent) parent.appendChild(e); return e; };
  let uid = 0;

  class GrowthTree {
    constructor(host) {
      this.host = host;
      this.id = 'gt' + ++uid;
      this.model = buildModel(null);
      this.state = 'idle';
      this.anims = []; this.sapAnims = []; this.edges = []; this.bridges = new Map();
      this.inView = false; this.seen = false; this.playing = false;
      this.dataReady = false; this.active = null; this.armed = null;
      this.tilt = { x: 0, y: 0, gx: 0, gy: 0, raf: 0, t: 0 };
      this.sapK = 0; this.sapBusy = false;
      host.classList.add('gt');
      host.growthTree = this;
      this.reduced = RM.matches;
      host.classList.toggle('gt-motion', !this.reduced);
      this.shell();
      this.setCount();
      if (this.reduced) this.state = 'done';
      this.render();
      this.bind();
      loadRows().then(rows => this.onRows(rows));
      setTimeout(() => { if (!this.dataReady) { this.dataReady = true; this.update(); } }, 1200); // DB가 늦으면 기본값으로 먼저 자람
    }

    shell() {
      const h = this.host;
      h.replaceChildren();
      this.year = div('gt-year', h); this.year.setAttribute('aria-hidden', 'true');
      const scene = div('gt-scene', h);
      this.tiltBox = div('gt-tilt', scene);
      this.plane = div('gt-plane', this.tiltBox);
      this.svg = el('svg', { class: 'gt-svg', role: 'group', tabindex: '-1' }, this.plane); // -1: 그림 자체는 Tab 순서에서 빼고(Chrome 이 넘치는 SVG 를 탭 정지로 잡음) 본부만 Tab
      this.tip = div('gt-tip', this.plane); this.tip.setAttribute('aria-hidden', 'true');
      this.tipText = document.createElement('span'); this.tip.appendChild(this.tipText);
      this.sr = document.createElement('ol'); this.sr.className = 'gt-sr'; this.sr.setAttribute('aria-label', '본부 승격 순서'); h.appendChild(this.sr);
    }

    setCount() {
      const n = String(this.model.nodes.length);
      document.querySelectorAll('[data-branch-count]').forEach(e => { if (e.textContent !== n) e.textContent = n; });
    }

    /* 그리기: 지금 상태(idle = 188만 / done = 다 자란 그림)로 */
    render() {
      const W = Math.floor(this.host.clientWidth);
      if (!W) return;
      this.w = W;
      const m = this.model;
      const vertical = NARROW.matches || W < 440;
      const L = (vertical ? null : layoutRadial(m, W)) || layoutVertical(m, W);
      this.L = L;
      this.cancelAll();
      this.hideTip(); this.active = null; this.armed = null;
      const h = this.host, svg = this.svg, id = this.id, pos = L.pos;
      this.plan = plan(m);
      h.classList.toggle('gt-v', L.mode === 'vertical');
      h.classList.toggle('gt-r', L.mode === 'radial');
      h.classList.remove('is-hl');
      h.style.setProperty('--gt-cx', L.cx.toFixed(1) + 'px');
      h.style.setProperty('--gt-cy', L.cy.toFixed(1) + 'px');
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${W} ${L.H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', L.H);
      svg.setAttribute('aria-label', `188본부에서 이어진 ${m.nodes.length}개 본부의 성장 나무`);
      const defs = el('defs', {}, svg);

      if (L.rings) { // 나이테: 세대 고리(아주 옅게)
        const g = el('g', { class: 'gt-rings', 'aria-hidden': 'true' }, svg);
        L.rings.forEach(R0 => el('circle', { cx: f1(L.cx), cy: f1(L.cy), r: f1(R0) }, g));
      }
      // 가지(붓 획) — 부모→자식 색 그라데이션
      const gE = el('g', { class: 'gt-edges', 'aria-hidden': 'true' }, svg);
      this.edges = [];
      const cuts = new Map();
      m.order.forEach(c => {
        if (!c.parent) return;
        const p = c.parent, P = pos[p.i], C = pos[c.i];
        const cut = trim(route(L, p, c), P.rad + 3, C.rad + 3);
        if (!cut) return;
        cuts.set(c.i, cut);
        const d = Math.min(c.depth, 5), w0 = L.w0[d], w1 = L.w1[d], S = sample(cut, 40);
        const gid = `${id}-e${c.i}`;
        const lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: f1(cut[0][0]), y1: f1(cut[0][1]), x2: f1(cut[3][0]), y2: f1(cut[3][1]) }, defs);
        el('stop', { offset: 0, 'stop-color': p.color }, lg);
        el('stop', { offset: 1, 'stop-color': c.color }, lg);
        const full = outline(S, w0, w1, 1);
        const path = el('path', { class: 'gt-edge', d: full, fill: `url(#${gid})`, 'data-from': p.no, 'data-to': c.no }, gE);
        this.edges.push({ el: path, p, c, S, w0, w1, len: S.len, d: pathD(cut), full, f: 1, grow: null });
      });
      // 다리: 236처럼 아직 안 핀 윗대 자리를 지나 뻗을 때 그 원 자리를 잇는 짧은 곡선(그 본부가 피면 사라짐)
      this.bridges = new Map();
      this.plan.bridges.forEach((b, i) => {
        const a = cuts.get(i), z = cuts.get(b.next), C = pos[i];
        if (!a || !z) return;
        const p0 = a[3], p1 = z[0], d = Math.min(m.nodes[i].depth, 5);
        const len = dist(p0, [C.x, C.y]) + dist([C.x, C.y], p1);
        const path = el('path', { class: 'gt-bridge', d: `M${f1(p0[0])} ${f1(p0[1])}Q${f1(C.x)} ${f1(C.y)} ${f1(p1[0])} ${f1(p1[1])}`, stroke: m.nodes[i].color, 'stroke-width': L.w1[d] }, gE);
        this.bridges.set(i, { el: path, len });
      });
      this.sapLayer = el('g', { class: 'gt-sap', 'aria-hidden': 'true' }, svg);
      // 본부 원
      const gN = el('g', { class: 'gt-nodes', 'aria-hidden': 'true' }, svg);
      const auraId = `${id}-aura`;
      const ag = el('radialGradient', { id: auraId }, defs);
      el('stop', { offset: 0, 'stop-color': m.root.color, 'stop-opacity': 0.2 }, ag);
      el('stop', { offset: 0.45, 'stop-color': m.root.color, 'stop-opacity': 0.06 }, ag);
      el('stop', { offset: 1, 'stop-color': m.root.color, 'stop-opacity': 0 }, ag);
      this.nodeEls = [];
      m.nodes.forEach(n => {
        const P = pos[n.i], isRoot = n === m.root;
        const lid = `${id}-l${n.i}`, hid = `${id}-h${n.i}`;
        const lg = el('radialGradient', { id: lid }, defs); // 가장자리로 갈수록 빛나는 유리구슬 느낌
        [[0, 0.05], [0.62, isRoot ? 0.12 : 0.1], [1, isRoot ? 0.38 : 0.34]].forEach(([o, a]) => el('stop', { offset: o, 'stop-color': n.color, 'stop-opacity': a }, lg));
        const hg = el('radialGradient', { id: hid }, defs);
        el('stop', { offset: 0.35, 'stop-color': n.color, 'stop-opacity': 0.5 }, hg);
        el('stop', { offset: 1, 'stop-color': n.color, 'stop-opacity': 0 }, hg);
        const g = el('g', { class: 'gt-node' + (isRoot ? ' is-root' : ''), transform: `translate(${f1(P.x)} ${f1(P.y)})`, 'data-no': n.no, 'data-x': f1(P.x), 'data-y': f1(P.y), 'data-r': P.rad }, gN);
        if (isRoot) el('circle', { class: 'gt-aura', r: P.rad * 3.4, fill: `url(#${auraId})` }, g);
        const halo = el('circle', { class: 'gt-halo', r: P.rad * 1.15, fill: `url(#${hid})` }, g);
        const bud = el('g', { class: 'gt-bud' }, g);
        el('circle', { class: 'gt-base', r: P.rad, fill: n.fill }, bud);
        const lume = el('circle', { class: 'gt-lume', r: P.rad, fill: `url(#${lid})` }, bud);
        el('circle', { class: 'gt-ring', r: P.rad - 0.7, stroke: n.color }, bud);
        const t = el('text', { class: 'gt-label', fill: n.label, dy: '0.04em' }, bud);
        t.textContent = n.no;
        if (n.no.length > 3) t.style.fontSize = '12px';
        const per = 7.5 + ((n.i * 37) % 23) / 10; // 숨쉬기: 7.5~9.7초, 위상은 서로 다르게
        lume.style.setProperty('--gt-bd', per.toFixed(2) + 's');
        lume.style.setProperty('--gt-ph', (-((n.i * 2.399) % per)).toFixed(2) + 's');
        this.nodeEls[n.i] = { g, bud, halo, lume };
      });
      // 누르기·포커스(계보 순서 = Tab 순서). url 있으면 링크(새 창), 없으면 포커스만
      const gH = el('g', { class: 'gt-hits' }, svg);
      this.hits = [];
      m.order.forEach(n => this.makeHit(n, gH));
      // 화면 읽기용 숨은 목록(승격 순서)
      this.sr.replaceChildren(...m.chrono.map(n => { const li = document.createElement('li'); li.textContent = spoken(n); return li; }));
      // 흐린 연도
      this.year.replaceChildren(...this.plan.years.map(y => { const s = document.createElement('span'); s.textContent = y.y; return s; }));
      this.placeYear();
      this.setState(this.state === 'growing' ? 'done' : this.state);
    }

    makeHit(n, layer) {
      const P = this.L.pos[n.i];
      const a = n.url
        ? el('a', { class: 'gt-hit', href: n.url, target: '_blank', rel: 'noopener', 'aria-label': spoken(n) + ', 홈페이지 새 창' }, layer)
        : el('g', { class: 'gt-hit', tabindex: '0', role: 'img', 'aria-label': spoken(n) }, layer);
      if (n === this.model.root) a.classList.add('is-root');
      a.setAttribute('transform', `translate(${f1(P.x)} ${f1(P.y)})`);
      a.setAttribute('data-i', n.i);
      el('circle', { class: 'gt-hit-area', r: P.rad + 4 }, a);
      el('circle', { class: 'gt-focus', r: P.rad + 5 }, a);
      this.hits[n.i] = a;
      return a;
    }

    placeYear() { // 원과 겹치지 않는 모서리에 둠
      const L = this.L, W = L.W, H = L.H, fs = L.mode === 'vertical' ? 40 : clamp(Math.round(W * 0.085), 64, 104);
      const w = fs * 2.45, hh = fs * 0.78, ins = L.mode === 'vertical' ? 14 : 26;
      const spots = L.mode === 'vertical' ? [[W - ins - w, ins], [ins, ins], [W - ins - w, H - ins - hh], [ins, H - ins - hh]] : [[ins, H - ins - hh], [ins, ins], [W - ins - w, H - ins - hh], [W - ins - w, ins]];
      const free = ([x, y]) => L.pos.every(p => p.x + p.rad + 14 < x || p.x - p.rad - 14 > x + w || p.y + p.rad + 14 < y || p.y - p.rad - 14 > y + hh);
      const [x, y] = spots.find(free) || spots[0];
      Object.assign(this.year.style, { left: x.toFixed(0) + 'px', top: y.toFixed(0) + 'px', fontSize: fs + 'px' });
    }

    setState(s) {
      this.state = s;
      const h = this.host;
      h.dataset.state = s;
      h.classList.toggle('gt-idle', s === 'idle');
      h.classList.toggle('gt-growing', s === 'growing');
      h.classList.toggle('gt-done', s === 'done');
      const spans = this.year.children;
      for (let k = 0; k < spans.length; k++) spans[k].classList.toggle('is-cur', s === 'done' ? k === spans.length - 1 : k === 0);
      h.classList.toggle('gt-breathe', s === 'done' && !this.reduced);
    }

    /* 자라기(1회) — 모든 움직임이 같은 시계(clock)에 맞춰 시작 → 멈춤·다시 시작도 함께 */
    grow() {
      if (this.state !== 'idle' || !this.L) return;
      this.setState('growing');
      const S = this.plan, T = TIME;
      const add = (target, kf, opt) => { const a = target.animate(kf, Object.assign({ fill: 'both' }, opt)); this.anims.push(a); return a; };
      this.clock = new Animation(new KeyframeEffect(null, null, { duration: S.end + 200 }), document.timeline);
      this.clock.play();
      this.anims.push(this.clock);
      this.edges.forEach(e => { // 가지는 JS 가 시계를 보며 붓 획 길이를 늘림(growFrame)
        const t = S.edges.get(e.c.i);
        e.grow = t ? { start: t.start, dur: t.dur, ease: easing(t.ease) } : null;
        e.f = -1;
        e.el.setAttribute('d', '');
      });
      this.bridges.forEach((b, i) => {
        const t = S.bridges.get(i);
        b.el.style.strokeDasharray = `${f1(b.len)} ${f1(b.len + 6)}`;
        add(b.el, [{ strokeDashoffset: f1(b.len + 3), opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { delay: t.start, duration: t.dur, easing: 'linear' });
        add(b.el, [{ opacity: 1 }, { opacity: 0 }], { delay: t.hide - 60, duration: 240, fill: 'forwards' });
      });
      this.model.nodes.forEach(n => {
        if (n === this.model.root) return;
        const b = S.bloom.get(n.i), E = this.nodeEls[n.i];
        add(E.bud, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.07)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { delay: b - 90, duration: T.bloom, easing: 'cubic-bezier(.2,.7,.25,1)' });
        add(E.halo, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0.9, transform: 'scale(1.25)', offset: 0.2 }, { opacity: 0, transform: 'scale(2.5)' }], { delay: b - 40, duration: T.halo, easing: 'cubic-bezier(.25,.6,.35,1)' });
        add(this.hits[n.i], [{ visibility: 'hidden' }, { visibility: 'visible' }], { delay: b - 90, duration: 1 });
      });
      const spans = this.year.children;
      S.years.forEach((y, k) => { // 앞 연도가 다 사라진 뒤 다음 연도가 떠오름(겹쳐 보이지 않게)
        const span = spans[k], next = S.years[k + 1];
        if (k > 0) add(span, [{ opacity: 0, transform: 'translateY(.12em)' }, { opacity: 1, transform: 'none' }], { delay: y.at, duration: Math.min(T.yearFade / 2, ((next ? next.at : y.at + 2000) - y.at) / 2.2), easing: 'cubic-bezier(.2,.7,.3,1)' });
        if (next) { const out = Math.min(T.yearFade / 2, (next.at - y.at) / 2.2); add(span, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-.12em)' }], { delay: next.at - out, duration: out, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }); }
      });
      const all = this.anims.slice();
      Promise.all(all.map(a => a.finished)).then(() => { if (this.state === 'growing' && this.anims.length) this.finishGrowth(); }, () => {});
      if (!this.playing) this.pauseAnims(this.anims);
      this.growFrame();
    }

    growFrame() {
      cancelAnimationFrame(this.growRaf); this.growRaf = 0;
      if (this.state !== 'growing' || !this.clock) return;
      const t = this.clock.currentTime || 0;
      let busy = false;
      this.edges.forEach(e => {
        const g = e.grow;
        if (!g) return;
        const p = clamp((t - g.start) / g.dur, 0, 1), f = p <= 0 ? 0 : p >= 1 ? 1 : g.ease(p);
        if (f !== e.f) { e.f = f; e.el.setAttribute('d', f >= 1 ? e.full : f > 0 ? outline(e.S, e.w0, e.w1, f) : ''); }
        if (p < 1) busy = true;
      });
      if (busy && this.playing) this.growRaf = requestAnimationFrame(() => this.growFrame());
    }

    finishGrowth() { // 다 자람: 애니메이션을 걷고 최종 모습(CSS 기본값)으로 → 잔잔한 반복 시작
      this.cancelAll();
      this.setState('done');
      if (this.playing) this.scheduleSap(1800);
    }

    cancelAll() {
      cancelAnimationFrame(this.growRaf); this.growRaf = 0;
      this.anims.forEach(a => a.cancel()); this.anims = []; this.clock = null;
      this.sapAnims.forEach(a => a.cancel()); this.sapAnims = [];
      if (this.sapLayer) this.sapLayer.replaceChildren();
      this.sapBusy = false;
      clearTimeout(this.sapTimer);
      this.edges.forEach(e => { if (e.f !== 1) e.el.setAttribute('d', e.full); e.f = 1; e.grow = null; });
      this.bridges.forEach(b => { b.el.style.strokeDasharray = ''; });
    }

    pauseAnims(list) { list.forEach(a => { if (a.playState === 'running') a.pause(); }); }

    /* 수액: 몇 초마다 188에서 한 계보씩 가는 빛이 가지 끝까지 */
    scheduleSap(delay) {
      clearTimeout(this.sapTimer);
      if (this.reduced || this.state !== 'done' || !this.playing || this.sapBusy) return;
      this.sapTimer = setTimeout(() => this.flow(), delay);
    }

    flow() {
      if (this.state !== 'done' || !this.playing || this.sapBusy) return;
      if (this.active != null) { this.scheduleSap(1500); return; } // 사용자가 보고 있는 동안은 쉼
      const fams = this.model.gen1;
      if (!fams.length) return;
      const fam = fams[this.sapK++ % fams.length];
      const T = TIME, byChild = new Map(this.edges.map(e => [e.c.i, e]));
      const list = [];
      const walk = (n, t0) => {
        const e = byChild.get(n.i);
        if (!e) return;
        list.push({ e, t0 });
        n.children.forEach(c => walk(c, t0 + e.len / T.sapSpeed));
      };
      walk(fam, 0);
      this.sapBusy = true;
      const anims = [];
      list.forEach(({ e, t0 }) => {
        // 혜성처럼: 앞은 짧고 밝은 빛(core), 뒤로 길고 옅은 꼬리(glow). 머리를 맞춰 같은 속도로, 양 끝 둥근 마개까지 가지 밖에서 시작·끝
        const G = T.sapLen, C = 14, pad = 4, w = (e.w0 + e.w1) / 2, dur = (e.len + G + 2 * pad) / T.sapSpeed;
        [['gt-sap-glow', w + 3, G, 0], ['gt-sap-core', Math.max(0.9, w * 0.75), C, G - C]].forEach(([cls, sw, len, lag]) => {
          const p = el('path', { class: cls, d: e.d, stroke: e.c.sap, 'stroke-width': f1(sw) }, this.sapLayer);
          p.style.strokeDasharray = `${len} ${f1(e.len + G + 4 * pad)}`;
          anims.push(p.animate([{ strokeDashoffset: f1(len + pad) }, { strokeDashoffset: f1(-e.len - pad - lag) }], { delay: t0, duration: dur, easing: 'linear', fill: 'both' }));
        });
        if (!e.c.children.length) { // 끝 본부에 닿으면 아주 옅게 한 번 밝아짐
          const halo = this.nodeEls[e.c.i].halo;
          anims.push(halo.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 0.32, transform: 'scale(1.25)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.6)' }], { delay: t0 + (e.len + pad) / T.sapSpeed, duration: 1000, easing: 'ease-out' }));
        }
      });
      this.sapAnims = anims;
      Promise.all(anims.map(a => a.finished)).then(() => {
        if (this.sapAnims !== anims) return;
        anims.forEach(a => a.cancel()); this.sapAnims = [];
        this.sapLayer.replaceChildren();
        this.sapBusy = false;
        this.scheduleSap(T.sapRest + ((this.sapK * 731) % 900));
      }, () => {});
      if (!this.playing) this.pauseAnims(anims);
    }

    /* 화면 안·탭 보임일 때만 움직임 */
    update() {
      const on = this.inView && !document.hidden;
      if (on !== this.playing) {
        this.playing = on;
        this.host.classList.toggle('gt-paused', !on);
        if (on) {
          [...this.anims, ...this.sapAnims].forEach(a => { if (a.playState === 'paused') a.play(); });
          if (this.state === 'growing') this.growFrame();
          this.scheduleSap(1600);
        } else {
          this.pauseAnims(this.anims); this.pauseAnims(this.sapAnims);
          cancelAnimationFrame(this.growRaf); this.growRaf = 0;
          clearTimeout(this.sapTimer);
          cancelAnimationFrame(this.tilt.raf); this.tilt.raf = 0;
        }
      }
      if (on && this.state === 'idle' && this.seen && this.dataReady) this.grow();
    }

    onRows(rows) {
      this.dataReady = true;
      if (rows) {
        const next = buildModel(rows);
        const shape = mm => mm.order.map(n => n.no + '<' + (n.parent ? n.parent.no : '')).join();
        const urls = mm => mm.order.map(n => n.url).join();
        if (shape(next) !== shape(this.model)) { this.model = next; this.setCount(); this.render(); } // 본부 구성이 다름: 다시 배치
        else if (urls(next) !== urls(this.model)) { this.model = next; this.relink(); } // 주소만 다름: 그림은 그대로
      }
      this.update();
    }

    relink() { // 누르기 층만 다시(자라는 중이면 아직 안 핀 본부는 같은 시각까지 숨김)
      if (!this.L || !this.hits || !this.hits[this.model.root.i]) return; // 아직 안 그려짐(숨은 자리): 다음 render 때 반영
      const layer = this.hits[this.model.root.i].parentNode;
      const f = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.gt-hit') : null;
      const fi = f && layer.contains(f) ? +f.getAttribute('data-i') : -1;
      const now = this.clock ? this.clock.currentTime : null;
      layer.replaceChildren();
      this.hits = [];
      this.model.order.forEach(n => {
        const a = this.makeHit(n, layer);
        if (this.state === 'growing' && n !== this.model.root && now != null) {
          const an = a.animate([{ visibility: 'hidden' }, { visibility: 'visible' }], { delay: this.plan.bloom.get(n.i) - 90, duration: 1, fill: 'both' });
          an.currentTime = now;
          if (!this.playing) an.pause();
          this.anims.push(an);
        }
      });
      if (fi >= 0 && this.hits[fi]) this.hits[fi].focus({ preventScroll: true });
    }

    /* 말풍선·강조 */
    activate(i) {
      const n = this.model.nodes[i];
      if (!n) return;
      this.active = i;
      this.host.classList.add('is-hl');
      this.model.nodes.forEach(m => this.nodeEls[m.i].g.classList.toggle('is-on', n.rel.has(m.i)));
      this.edges.forEach(e => e.el.classList.toggle('is-on', n.rel.has(e.c.i) && n.rel.has(e.p.i)));
      this.showTip(n);
    }

    deactivate() {
      this.active = null; this.armed = null;
      this.host.classList.remove('is-hl');
      this.hideTip();
    }

    showTip(n) {
      if (!n.date) { this.hideTip(); return; }
      const P = this.L.pos[n.i], tip = this.tip;
      this.tipText.textContent = dot(n);
      tip.classList.add('is-on');
      const tw = tip.offsetWidth || 64, th = tip.offsetHeight || 28;
      const below = P.y - P.rad - 12 - th < 4;
      const x = clamp(P.x, tw / 2 + 6, this.L.W - tw / 2 - 6);
      tip.classList.toggle('is-below', below);
      tip.style.setProperty('--tx', f1(x) + 'px');
      tip.style.setProperty('--ty', f1(below ? P.y + P.rad + 10 : P.y - P.rad - 10) + 'px');
      tip.style.setProperty('--ax', f1(P.x - x) + 'px');
    }

    hideTip() { if (this.tip) this.tip.classList.remove('is-on'); }

    bind() {
      const svg = this.svg, hitOf = e => (e.target && e.target.closest ? e.target.closest('.gt-hit') : null);
      const idx = h => +h.getAttribute('data-i');
      svg.addEventListener('pointerdown', e => { this.pt = e.pointerType; }, { passive: true });
      svg.addEventListener('pointerover', e => { const h = hitOf(e); if (h && e.pointerType === 'mouse') this.activate(idx(h)); });
      svg.addEventListener('pointerout', e => {
        const h = hitOf(e);
        if (!h || e.pointerType !== 'mouse' || (e.relatedTarget && h.contains(e.relatedTarget))) return;
        const f = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.gt-hit') : null;
        if (f && svg.contains(f) && f.matches(':focus-visible')) this.activate(idx(f)); else this.deactivate();
      });
      svg.addEventListener('focusin', e => { const h = hitOf(e); if (h) this.activate(idx(h)); });
      svg.addEventListener('focusout', e => { if (!e.relatedTarget || !svg.contains(e.relatedTarget)) { if (this.armed == null) this.deactivate(); } });
      svg.addEventListener('click', e => {
        const h = hitOf(e);
        if (!h) return;
        const i = idx(h);
        if (this.pt === 'touch' || this.pt === 'pen') { // 휴대폰: 처음 누르면 말풍선, url 있으면 한 번 더 눌렀을 때 이동
          if (this.armed !== i) { e.preventDefault(); this.armed = i; this.activate(i); }
        }
      });
      document.addEventListener('pointerdown', e => { // 나무 밖을 누르면 말풍선 닫기(휴대폰)
        if (this.active == null || e.pointerType === 'mouse') return;
        const h = e.target && e.target.closest ? e.target.closest('.gt-hit') : null;
        if (!h || !this.host.contains(h)) this.deactivate();
      }, { passive: true });
      this.host.addEventListener('keydown', e => { if (e.key === 'Escape' && this.active != null) this.deactivate(); });

      // 화면 안에 있을 때만(+탭이 보일 때만) 움직임
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => {
          es.forEach(en => {
            this.inView = en.isIntersecting;
            if (en.isIntersecting && (en.intersectionRatio >= 0.3 || en.intersectionRect.height >= window.innerHeight * 0.45)) this.seen = true;
          });
          this.update();
        }, { threshold: [0, 0.1, 0.2, 0.3, 0.45, 0.6] }).observe(this.host);
      } else { this.inView = true; this.seen = true; }
      document.addEventListener('visibilitychange', () => this.update());

      // 폭이 바뀌면 다시 배치(자라는 중이면 다 자란 그림으로)
      const relayout = () => { const w = Math.floor(this.host.clientWidth); if (w && w !== this.w) { this.render(); this.update(); if (this.state === 'done') this.scheduleSap(1800); } }; // 숨은 자리에서 처음 보일 때도 여기서 자라기 시작
      if ('ResizeObserver' in window) new ResizeObserver(() => { cancelAnimationFrame(this.ro); this.ro = requestAnimationFrame(relayout); }).observe(this.host);
      else window.addEventListener('resize', relayout);
      if (NARROW.addEventListener) NARROW.addEventListener('change', () => { this.w = 0; relayout(); });
      if (RM.addEventListener) RM.addEventListener('change', () => {
        this.reduced = RM.matches;
        this.host.classList.toggle('gt-motion', !this.reduced);
        if (this.reduced) { this.cancelAll(); this.setState('done'); this.resetTilt(); } else this.setState(this.state);
      });

      // 입체감: PC는 마우스 위치로 아주 살짝 기울임(최대 3.5°, 부드럽게 따라옴). 휴대폰은 CSS 스크롤 연동(growth-tree.css)
      window.addEventListener('pointermove', e => {
        if (this.reduced || !FINE.matches || e.pointerType !== 'mouse' || !this.inView) return;
        const r = this.host.getBoundingClientRect();
        const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.6), -1, 1);
        const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.6), -1, 1);
        this.tilt.gx = -ny * 3; this.tilt.gy = nx * 3.5;
        this.kickTilt();
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { this.tilt.gx = 0; this.tilt.gy = 0; this.kickTilt(); });
      // 스크롤 연동 CSS(animation-timeline)를 못 쓰는 휴대폰 브라우저: 스크롤 위치로 직접 계산
      const sdSupported = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');
      if (!sdSupported) {
        let q = 0;
        const onScroll = () => {
          if (q) return;
          q = requestAnimationFrame(() => {
            q = 0;
            if (this.reduced || FINE.matches || !this.inView) return;
            const r = this.host.getBoundingClientRect(), vh = window.innerHeight || 1;
            const p = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
            this.tiltBox.style.transform = `perspective(1300px) rotateX(${f1(p * 3.5)}deg)`;
          });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
      }
    }

    kickTilt() {
      if (this.tilt.raf || !this.playing) return;
      this.tilt.t = performance.now();
      const step = now => {
        const T = this.tilt, dt = Math.min(64, now - T.t); T.t = now;
        const k = 1 - Math.exp(-dt / 240); // 천천히 따라옴
        T.x += (T.gx - T.x) * k; T.y += (T.gy - T.y) * k;
        this.plane.style.transform = `perspective(1400px) rotateX(${T.x.toFixed(3)}deg) rotateY(${T.y.toFixed(3)}deg)`;
        T.raf = Math.abs(T.gx - T.x) + Math.abs(T.gy - T.y) > 0.004 && this.playing ? requestAnimationFrame(step) : 0;
      };
      this.tilt.raf = requestAnimationFrame(step);
    }

    resetTilt() { cancelAnimationFrame(this.tilt.raf); this.tilt = { x: 0, y: 0, gx: 0, gy: 0, raf: 0, t: 0 }; this.plane.style.transform = ''; this.tiltBox.style.transform = ''; }
  }

  function init(root) {
    (root || document).querySelectorAll('[data-growth-tree]').forEach(h => { if (!h.growthTree) new GrowthTree(h); });
  }
  window.GrowthTree = { init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
