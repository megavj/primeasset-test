/* 성장 나무 v3(시안) — '함께하는 N개 본부' 화려한 버전. 공용 assets/growth-tree.js(v2)를 복사해 고친 것(독립 부품 · 외부 라이브러리·CDN 없음)
   사용법은 v2와 같다: <link rel="stylesheet" href="…/growth-tree-v3.css"> + <div data-growth-tree></div> + <script src="…/growth-tree-v3.js" defer></script>
     본부 홈페이지 주소를 DB에서 읽으려면 이 파일보다 먼저 assets/auth-config.js(window.PA_AUTH)를 넣는다.
     승인되면 assets/growth-tree.js·css 를 이 두 파일 내용으로 바꾸면 된다(메인·성장스토리는 '188본부에서 이어진 성장입니다.' 줄만 지움).
     내부 클래스·id 이름은 gt3- — 시안 페이지에서 v2(공용 파일)와 한 페이지에 나란히 놓아도 서로 섞이지 않게(사용법과는 무관)
     인라인 스크립트·eval 없음(CSP script-src 'self' 로 충분). 스타일은 CSSOM(el.style)·Web Animations 만 씀
   · 배치·색·가지·말풍선·키보드·DB 는 v2와 같다(휴대폰 세로 나무만 위에 연도 자리 52px)
   · v2 대비 더한 것(OPINION15 추천 패키지, 이사님 승인)
     - 빛 안개: 카드 뒤 넓은 청록·남청 빛 2겹이 천천히 옮겨 감 + 188 뒤 샴페인 후광(휴대폰은 1겹, 다 자란 뒤 15초 조작 없으면 멈춤)
     - 자주 흐르는 빛: PC 약 2초마다 다음 계보 출발(동시에 최대 2계보), 휴대폰은 한 계보가 끝나면 0.7~1초 쉼. 속도 +25%. 닿는 본부가 반응(빛 번짐·테두리·입자)
     - 진한 연도: 불투명한 회청색·굵게(450). PC 64 · 태블릿 52 · 휴대폰 36px. 200ms 겹쳐 바뀜
     - 입자: 본부가 필 때(+빛이 닿을 때·마우스를 댈 때 소량). 동시에 살아 있는 입자 상한 PC 30 · 휴대폰 14(피는 본부마다 최소 2 · 1개)
     - 다 자란 순간 한 번: 188에서 바깥으로 퍼지는 빛 파동(휴대폰은 위에서 아래로) — 지나는 가지에 빛이 흐르고 테두리가 밝아짐
     - 처음 등장: 배경 빛이 올라오고 장면이 0.97 → 1 로 놓임(PC). 가지가 자랄 때 붓끝에 작은 빛
     - 고른 본부: 테두리 1 → 1.4px + 둘레 20% 길이의 빛 조각이 한 번 지나감
     - 움직임 멈춤/켜기 버튼(카드 아래 오른쪽): 멈추면 다 자란 그림으로, 모든 움직임이 함께 멈춤
     - 기울기는 PC 마우스만 최대 약 2°(휴대폰 스크롤 기울기는 뺌)
   · 넣지 않은 것: 별가루 배경, 반복 나이테 파동
   · prefers-reduced-motion: 다 자란 그림만(배경 이동·빛·입자·파동·확대·기울기 없음, 버튼 숨김)
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
  // 가문 안 순서(세대 → 계보)대로 [밝기 차, 채도 배율, 색상 차(°)] — 밝기·채도·색상을 함께 벌려 이웃 본부끼리도 한눈에 다른 색.
  //   색상 차는 ±12° 안이라 가문은 그대로 알아본다. + 방향은 가문마다 '가장 가까운 다른 가문 색'의 반대쪽(이웃 가문과 섞여 보이지 않게).
  //   표는 19개 전체에서 비슷한 두 색의 차이(OKLab)가 가장 커지도록 고른 값 — 나란히 놓이는 형제·부모자식 사이를 더 엄격하게(밝고 어두움·색상 쪽이 번갈아)
  const VARIANTS = [[0, 1, 0], [-0.12, 1, 8], [0.12, 1, 8], [0.03, 1.3, -12], [-0.03, 1.3, 10], [0.06, 1, 8], [-0.06, 1, -8], [0.09, 0.85, -12], [-0.09, 1.15, 12]];
  const L_RANGE = [0.63, 0.875], C_MIN = 0.05, cMax = L => 0.11 - 0.17 * Math.max(0, L - 0.72); // 밝을수록 채도 상한을 낮춤(파스텔 사탕색·형광 방지)
  const ROOT_FACE = '#151b2b'; // 188 원의 면: 카드보다 한 단계 밝은 남색 — 금색 테두리만으로 '시작점'이 드러나게
  const WARM = '#f6ecd8';      // 입자의 따뜻한 오프화이트(약 25%)

  /* ── 3. 시간(ms)·효과량 ── */
  const TIME = {
    prologue: 900,  // 188 하나만 켜져 있는 시간
    draw: 820,      // 가지 하나가 뻗는 시간(같은 달 본부는 같은 시간이라 동시에 핀다)
    chain: 0.62,    // 236처럼 아직 안 핀 윗대 자리를 지나 뻗을 때 마디별 비율
    perMonth: 62, gapMin: 240, gapMax: 820, // 승격 사이 간격 = 실제 개월 차 × perMonth (최소·최대)
    fastFrom: 2024, fast: 0.6,              // 2024년부터 간격 촘촘 → 빨라지는 성장
    lead: 120,      // 윗대가 피는 동안 미리 뻗기 시작
    minDraw: 420,   // 윗대가 막 피어 시간이 모자랄 때 붓질을 빠르게(이보다 짧게는 안 함) — 같은 달 동시 피기·빨라지는 리듬 유지
    bloom: 760, halo: 1100,
    open: 1200, fogIn: 1600, // 처음 등장: 장면이 0.97 → 1 로 놓임(PC) · 배경 빛이 올라옴
    yearFade: 200,           // 연도: 겹쳐 바뀜(위로 4px)
    waveWait: 300, wave: 1400, // 마지막 본부가 핀 뒤 300ms 기다렸다가 한 번
    sapFirst: 600,           // 파동이 끝나고 첫 빛까지
    sapSpeed: 0.3, sapTail: 44, sapCore: 12, // 흐르는 빛: px/ms(v2 0.24의 +25%) · 꼬리 · 밝은 머리
    sapEvery: 2000, sapJitter: 200,          // PC: 다음 계보 출발 간격(±)
    sapRest: [700, 1000],                    // 휴대폰: 한 계보가 다 흐른 뒤 쉼
    arrive: 560, cool: 1500,                 // 빛이 닿을 때 반응 · 같은 본부 반짝임 재발생 막기
    calm: 15000                              // 휴대폰: 다 자란 뒤 조작이 없으면 배경 이동 멈춤
  };
  const EASE = { draw: [0.55, 0.06, 0.25, 1], in: [0.55, 0.06, 0.9, 0.6], out: [0.1, 0.4, 0.25, 1], lin: [0, 0, 1, 1], wave: [0.22, 0.5, 0.3, 1] };
  // 기기별 효과량: pc = 원형(PC·태블릿), m = 세로 나무(휴대폰)
  //   입자 상한은 OPINION 시작값(PC 18 · 휴대폰 8)에서 올림 + 피는 본부마다 최소 개수(min)는 보장:
  //   2020~21년·2025~26년처럼 몇 달 사이에 여럿이 필 때 뒤에 피는 본부만 입자가 빠지지 않게
  const FX = {
    pc: { flows: 2, bloom: 4, root: 6, arrive: 2, touch: 2, cap: 30, min: 2 },
    m: { flows: 1, bloom: 2, root: 4, arrive: 1, touch: 1, cap: 14, min: 1 }
  };
  // 입자: 지름 · 테두리 밖으로 퍼지는 거리 · 시간 · 최대 불투명도 · 피기 시작 뒤. 가운데가 밝고 가장자리가 번지는 작은 빛 점(별·색종이 모양 아님)
  const SPARK = { size: [3.2, 5.2], dist: [10, 22], dur: [700, 950], peak: 0.95, at: 110 };
  const GLOW = { bloom: 0.48, arrive: 0.32, pass: 0.22, wave: 0.26, root: 0.5 };   // 빛 번짐 최대 불투명도: 필 때 · 빛이 끝 본부에 닿을 때 · 지나는 본부 · 파동 · 188

  const SVGNS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mq = q => (window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener() {} });
  const RM = mq('(prefers-reduced-motion: reduce)');
  const NARROW = mq('(max-width: 640px)');
  const FINE = mq('(hover: hover) and (pointer: fine)');
  const seeded = s => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // 입자 흩어짐(매번 같은 모양)

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
    // 색: 1대 본부별 기준 톤 → 가문 안 순서대로 밝기·채도·색상 변형
    let extra = 0;
    root.lch = TONES[ROOT];
    const toneHues = Object.values(TONES).map(t => t[2]);
    root.children.forEach(f => {
      const tone = TONES[f.no] || EXTRA_TONES[extra++ % EXTRA_TONES.length];
      let near = 180; // 가장 가까운 다른 가문 색상각까지의 차(부호 있음)
      toneHues.forEach(h => { const d = ((h - tone[2] + 540) % 360) - 180; if (d && Math.abs(d) < Math.abs(near)) near = d; });
      const away = near > 0 ? -1 : 1;
      const fam = order.filter(n => n.family === f).sort((a, b) => a.depth - b.depth || order.indexOf(a) - order.indexOf(b));
      fam.forEach((n, j) => {
        if (!j) { n.lch = tone; return; }
        const v = VARIANTS[1 + ((j - 1) % (VARIANTS.length - 1))], L = clamp(tone[0] + v[0], L_RANGE[0], L_RANGE[1]);
        n.lch = [L, clamp(tone[1] * v[1], Math.min(C_MIN, tone[1]), cMax(L)), tone[2] + away * v[2]];
      });
    });
    nodes.forEach(n => {
      const isRoot = n === root, [L, C, h] = n.lch;
      n.color = hex(lchToLab(n.lch));
      n.face = isRoot ? ROOT_FACE : hex(lchToLab([0.24 + (L - 0.75) * 0.2, Math.min(0.055, C * 0.55), h])); // 원의 면: 같은 색의 깊은 톤 한 가지(평평하게 — 광택·그라데이션 없음)
      n.label = hex(lchToLab([isRoot ? 0.93 : 0.96, isRoot ? 0.05 : Math.min(0.02, C * 0.25), h]));
      n.core = hex(lchToLab([Math.min(0.97, L + 0.16), C * 0.42, h])); // 흐르는 빛의 밝은 머리·빛 조각: 가문 색에 오프화이트를 섞은 색
      n.rel = new Set([n.i]); // 강조할 본부: 188까지 이어지는 윗대 + 자신 + 산하
      for (let p = n.parent; p; p = p.parent) n.rel.add(p.i);
    });
    order.forEach(n => { const add = c => { n.rel.add(c.i); c.children.forEach(add); }; n.children.forEach(add); });
    const chrono = nodes.slice().sort((a, b) => (a === root ? -1 : b === root ? 1 : cmp(a, b)));
    return { nodes, root, order, chrono, gen1: root.children, maxDepth: Math.max(...nodes.map(n => n.depth)) };
  }

  /* ── 5. 색 계산(OKLab) ── */
  function lchToLab([L, C, h]) { const a = (h * Math.PI) / 180; return [L, C * Math.cos(a), C * Math.sin(a)]; }
  function hex([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
      .map(v => { v = clamp(v, 0, 1); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'); }).join('');
  }

  /* ── 6. 곡선(3차 베지어)·붓 획 ── */
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  function bez(P, t) { const u = 1 - t; return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]; }
  function bezD(P, t) { const u = 1 - t; return [0, 1].map(k => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])); }
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
  function pointAt(S, s) { // 가운데선에서 길이 s 인 곳(자라는 붓끝 빛 자리)
    const pts = S.pts;
    let k = 1;
    while (k < pts.length - 1 && pts[k][4] < s) k++;
    const a = pts[k - 1], b = pts[k], t = clamp((s - a[4]) / (b[4] - a[4] || 1), 0, 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
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
  function easing([x1, y1, x2, y2]) { // CSS cubic-bezier 와 같은 계산(JS 로 그리는 가지·파동용)
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
    return x => {
      let lo = 0, hi = 1, t = x;
      for (let k = 0; k < 24; k++) { const v = X(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return Y(t);
    };
  }

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
    const rings = [];
    for (let d = 1; d <= model.maxDepth; d++) rings.push(best.R(d));
    // 붓 획 굵기(세대별 시작 → 끝): 윗대 끝 굵기 = 아랫대 시작 굵기라 마디를 지나도 자연스럽게 이어짐
    return { mode: 'radial', W, H, pos, cx, cy, rings, w0: [0, 3, 1.9, 1.4, 1.1, 0.95], w1: [0, 1.9, 1.4, 1.1, 0.95, 0.85] };
  }

  // 7-2. 세로 나무(휴대폰): 188이 위, 세대가 아래로. 같은 세대는 계보 순서로 가로에 놓고(188 둘레 고리처럼 양옆이 살짝 높은 호),
  //      좁으면 위·아래 두 줄로 나눔. 줄 나누기는 경우를 모두 따져(한 세대 10개 이상이면 한 원씩 바꿔 보며) 고름:
  //      형제 가지가 부채처럼 고르게 벌어지고, 가지가 다른 원·형제 가지를 비켜 가고(실제 그릴 곡선으로 확인),
  //      하위가 있는 본부는 아래 줄(그 가지가 막힘없이 내려가게), 원래 자리(윗대 바로 아래)에서 덜 벗어나게
  //      v3: 카드 위 YEAR_BAND(52px)는 연도 자리 — 나무는 그 아래에서 시작
  const YEAR_BAND = 52;
  function packRow(ideal, u, lo, hi) { // 순서 유지 · 최소 간격 u · [lo, hi] 안에서 이상 위치에 가장 가깝게(PAVA)
    return packMixed(ideal, ideal.map(() => 0), u, u, 0, lo, hi) || ideal.map((v, k) => lo + k * u);
  }
  // 두 줄일 때 j < k 두 원 사이에 필요한 가로 간격: 같은 줄 s, 다른 줄 dxo.
  // 위 줄 두 원 사이로 아래 줄 원의 가지가 내려가면 그 둘은 lane 만큼 더 벌림(가지가 지나갈 길)
  function needGap(rows, s, dxo, lane, j, k) {
    if (rows[j] !== rows[k]) return dxo;
    if (lane && !rows[j]) for (let q = j + 1; q < k; q++) if (rows[q]) return s + lane;
    return s;
  }
  function packMixed(ideal, rows, s, dxo, lane, lo, hi) { // packRow 의 두 줄판(순서 유지 · 간격 needGap). 못 들어가면 null
    const n = ideal.length, off = new Array(n).fill(0);
    for (let k = 1; k < n; k++) for (let j = 0; j < k; j++) off[k] = Math.max(off[k], off[j] + needGap(rows, s, dxo, lane, j, k));
    if (off[n - 1] > hi - lo + 1e-6) return null;
    const blocks = [];
    ideal.forEach((v, k) => {
      blocks.push({ s: v - off[k], c: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].s / blocks[blocks.length - 2].c > blocks[blocks.length - 1].s / blocks[blocks.length - 1].c) {
        const b = blocks.pop(); blocks[blocks.length - 1].s += b.s; blocks[blocks.length - 1].c += b.c;
      }
    });
    const out = []; blocks.forEach(b => { for (let k = 0; k < b.c; k++) out.push(b.s / b.c); });
    return out.map((v, k) => clamp(v, lo, hi - off[n - 1]) + off[k]);
  }

  function layoutVertical(model, W) {
    const tiny = W < 274; // 320px 보다 좁은 화면: 원을 터치 최소 크기(44px)로, 간격도 조금 좁게
    const r = tiny ? 22 : 23, rr = tiny ? 27 : 28, gap = tiny ? 6 : 8, s = 2 * r + gap; // 지름 46px(아주 좁으면 44px) — 터치 44px 이상
    const side = 8, lo = side + r, hi = W - side - r, span = hi - lo, cx = W / 2;
    const dy = 0.9 * s, dxo = Math.sqrt(s * s - dy * dy) + 1; // 두 줄일 때 아래 줄 내림 · 위아래로 엇갈린 이웃끼리 가로 간격
    const W0 = [0, 2.6, 1.75, 1.3, 1.05, 0.9], W1 = [0, 1.75, 1.3, 1.05, 0.9, 0.8]; // 붓 획 굵기(세대별 시작 → 끝)
    const N = model.nodes, root = model.root, pos = new Array(N.length);
    // 1대 순서: 승격 순서 그대로 두되 하위 없는 본부는 가까운 쪽 끝으로(순서 유지) → 하위가 많은 본부(227)가 가장자리에 붙지 않아
    //   가지가 양쪽으로 펼쳐짐. 새 본부(맨 끝 순서)는 그대로 오른쪽 끝
    const G1 = model.gen1, half = (G1.length - 1) / 2, leaf = c => !c.children.length;
    const g1 = G1.filter((c, k) => leaf(c) && k < half).concat(G1.filter(c => !leaf(c)), G1.filter((c, k) => leaf(c) && k >= half));
    const top = YEAR_BAND + 12 + rr;
    pos[root.i] = { x: cx, y: top, rad: rr };
    let base = top + rr + r + 74, band = g1; // 1대 줄(가운데 높이)
    for (let d = 1; band.length; d++) {
      const n = band.length, A = d === 1 ? 30 : 16; // A: 188 둘레 고리처럼 양옆이 살짝 높은 호
      let ideal;
      if (d === 1) { // 고르게 펼치되 양끝을 살짝 안으로(가장자리 계보도 양쪽으로 갈라지게)
        const inset = n > 1 ? Math.min(16, Math.max(0, (span - (n - 1) * s) / 2)) : 0;
        ideal = band.map((c, k) => (n === 1 ? cx : lo + inset + ((span - 2 * inset) * k) / (n - 1)));
      } else { // 같은 상위의 하위끼리 상위 아래에 모아서(하나뿐이면 살짝 비켜 곡선이 살아나게)
        ideal = [];
        for (let k = 0; k < n;) {
          const p = band[k].parent; let m = 0;
          while (k + m < n && band[k + m].parent === p) m++;
          for (let j = 0; j < m; j++) ideal.push(pos[p.i].x + (m === 1 ? (d % 2 ? 14 : -14) : (j - (m - 1) / 2) * s * 0.95));
          k += m;
        }
      }
      const prev = band.map(c => c.parent).filter((p, k, a) => a.indexOf(p) === k);
      // 한 배치(가로 위치 xs · 줄 rows · 호 arc · 길 lane)의 점수(낮을수록 좋음). 규칙을 어기면 null.
      // exact: 그릴 때와 같은 곡선 고르기(route)까지 — 느려서 추린 후보에만
      const score = (xs, rows, arc, lane, exact) => {
        for (let k = 0; k < n; k++) {
          if (xs[k] < lo - 1e-6 || xs[k] > hi + 1e-6) return null;
          for (let j = 0; j < k; j++) if (xs[k] - xs[j] < needGap(rows, s, dxo, lane, j, k) - 1e-6) return null;
        }
        const two = rows.some(v => v);
        const P = band.map((c, k) => { const q = (xs[k] - cx) / (span / 2); return { x: xs[k], y: base - arc * q * q + rows[k] * dy }; });
        for (let k = 0; k < n; k++) for (let j = 0; j < k; j++) if (Math.hypot(P[j].x - P[k].x, P[j].y - P[k].y) < s - 0.01) return null; // 호 때문에 줄 사이가 줄어든 곳까지 실제 간격으로
        // 실제로 그릴 가지(포트·곡선)로 따짐: 다른 원을 넉넉히 비켜 가는지, 형제 가지끼리 붙지 않는지
        const tmp = pos.slice();
        band.forEach((c, k) => { tmp[c.i] = { x: P[k].x, y: P[k].y, rad: r }; });
        const Lt = { mode: 'vertical', pos: tmp, w0: W0, w1: W1 }, ports = new Map();
        prev.forEach(p => portsOf(Lt, p, ports));
        const curves = band.map(c => (exact ? route(Lt, c.parent, c, ports.get(c.i)) : edgeCurve(Lt, c.parent, c, ports.get(c.i), 0)));
        let sc = 0, near = Infinity; // near: 가지와 다른 원·형제 가지 사이 가장 가까운 거리
        band.forEach((c, k) => {
          sc += ((xs[k] - ideal[k]) / s) ** 2;
          if (rows[k] && !c.children.length) sc += 0.15; // 필요 없으면 한 줄로
          const clr = clearance(curves[k], tmp, c.parent.i, c.i, exact ? 36 : 18);
          near = Math.min(near, clr);
          if (clr < 12) sc += 3 * ((12 - clr) / 5) ** 2 + (clr < 6 ? 60 + 10 * (6 - clr) : 0); // 6px 보다 가까우면 사실상 쓰지 않음
          for (let j = k + 1; j < n; j++) if (band[j].parent === c.parent) { // 형제 가지 사이(윗대 원 가까이 빼고) 가장 가까운 거리
            let m2 = Infinity;
            const st = exact ? 1 : 2;
            for (let u = 6; u <= 24; u += st) { const q = bez(curves[k], u / 24); for (let v = 6; v <= 24; v += st) { const w = bez(curves[j], v / 24); m2 = Math.min(m2, Math.hypot(q[0] - w[0], q[1] - w[1])); } }
            if (m2 < 10) sc += 2 * ((10 - m2) / 4) ** 2;
            near = Math.min(near, m2);
          }
        });
        prev.forEach(p => { // 형제 가지가 부채처럼 고르게: 윗대에서 본 방향이 20°보다 가까우면 벌점
          const ang = band.map((c, k) => (c.parent === p ? Math.atan2(P[k].y - pos[p.i].y, P[k].x - pos[p.i].x) : null)).filter(v => v != null).sort((x, y) => x - y);
          for (let j = 1; j < ang.length; j++) { const g = ((ang[j] - ang[j - 1]) * 180) / Math.PI; if (g < 20) sc += 0.02 * (20 - g) ** 2; }
        });
        const kidsDown = !two || band.every((c, k) => rows[k] || !c.children.length); // 하위가 있는 본부는 아래 줄(그 가지가 위 줄에 막히지 않게)
        return { sc, near, P, extra: two ? dy : 0, xs, rows, arc, lane, kidsDown };
      };
      let best = null, soft = null; // best: 하위가 있는 본부가 모두 아래 줄(두 줄일 때) · soft: 그렇지 못한 것(달리 방법이 없을 때만)
      const pick = c => { if (c) { if (c.kidsDown) { if (!best || c.sc < best.sc - 1e-9) best = c; } else if (!soft || c.sc < soft.sc - 1e-9) soft = c; } };
      // 좋은 배치가 없을 때만 차례로 양보: 호를 낮춤(위아래 줄 간격이 줄지 않게) → 가지가 지나갈 길(lane)을 좁힘
      const fine = c => c && c.near >= 8; // 가지가 원·형제 가지와 8px 이상 떨어짐
      for (const [arc, lane] of [[A, 26], [A / 2, 26], [0, 26], [0, 12], [0, 0]]) {
        if (fine(best)) break;
        const found = [];
        const consider = rows => {
          const xs = packMixed(ideal, rows, s, dxo, lane, lo, hi), c = xs && score(xs, rows, arc, lane, false);
          if (c) found.push(c);
          return c ? c.sc + (c.kidsDown ? 0 : 1000) : Infinity;
        };
        if (n <= 9) for (let mask = 0; mask < 1 << n; mask++) consider(band.map((_, k) => (mask >> k) & 1)); // 모든 경우
        else for (const start of [band.map((_, k) => k % 2), band.map((_, k) => (k + 1) % 2), band.map(() => 0)]) { // 많으면: 출발점에서 한 원씩 줄을 바꿔 가며 나아질 때까지
          let cur = start, cs = consider(cur);
          for (let it = 0, up = true; up && it < 3 * n; it++) {
            up = false;
            for (let k = 0; k < n; k++) { const t = cur.slice(); t[k] ^= 1; const v = consider(t); if (v < cs - 1e-9) { cur = t; cs = v; up = true; } }
          }
        }
        found.sort((a, b) => (a.kidsDown === b.kidsDown ? a.sc - b.sc : a.kidsDown ? -1 : 1)); // 빠른 점수로 추린 앞 6개만 정밀하게
        found.slice(0, 6).forEach(c => pick(score(c.xs, c.rows, arc, lane, true)));
      }
      best = best || soft;
      // 아직 아쉬우면(가지가 원에 가깝거나 형제 가지가 붙음) 가로 위치를 몇 px씩 옮겨 보며 다듬음(한 원 · 오른쪽 묶음 · 왼쪽 묶음)
      for (let pass = 0; best && !fine(best) && pass < 4; pass++) {
        let moved = false;
        for (let k = 0; k < n; k++) for (const dl of [-12, -6, -3, 3, 6, 12]) for (let mode = 0; mode < 3; mode++) {
          const xs = best.xs.map((x, j) => ((mode === 0 ? j === k : mode === 1 ? j >= k : j <= k) ? x + dl : x));
          const c = score(xs, best.rows, best.arc, best.lane, true);
          if (c && c.sc < best.sc - 0.01) { best = c; moved = true; }
        }
        if (!moved) break;
      }
      if (!best) { // 너무 좁음: 줄을 늘려 고르게 엇갈림(원끼리는 언제나 s 이상 · 하위가 있는 본부가 맨 아래 줄에 많이 오게)
        const u = n > 1 ? Math.min(s, span / (n - 1)) : 0, R = Math.max(2, Math.ceil(s / Math.max(u, 1))), dR = Math.max(dy, Math.sqrt(Math.max(0, s * s - u * u)) + 1);
        let ph = 0, bestN = -1;
        for (let q = 0; q < R; q++) { const k2 = band.filter((c, k) => c.children.length && (k + q) % R === R - 1).length; if (k2 > bestN) { bestN = k2; ph = q; } }
        best = { extra: (R - 1) * dR, P: band.map((c, k) => ({ x: n > 1 ? lo + k * u : cx, y: base + ((k + ph) % R) * dR })) };
      }
      band.forEach((c, k) => { pos[c.i] = { x: best.P[k].x, y: best.P[k].y, rad: r }; });
      base += best.extra + s + 54;
      band = band.flatMap(c => c.children);
    }
    const H = Math.round(Math.max(...pos.map(p => p.y + p.rad)) + 30);
    return { mode: 'vertical', W, H, pos, cx, cy: top, rings: null, w0: W0, w1: W1 };
  }

  // 7-3. 가지가 원에 붙는 자리(포트)와 곡선
  //   · 형제 가지는 윗대 원 둘레의 서로 다른 자리에서 떠난다(한 점에 몰려 빗자루처럼 보이지 않게). 자리 순서 = 자식 방향 순서라 서로 엇갈리지 않음
  //   · 가지는 원에 수직으로 나가고 들어온다 → 가지 끝(둥근 마개 포함)과 원 테두리 사이 틈이 어디서나 GAP 으로 같다
  const GAP = 4;
  const SWIRL = 0.3, SWIRL_IN = 0.18; // 원형: 188에서 시계 방향으로 살짝 휘감아 나가는 정도
  const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
  // 곡선 후보 [출발 쪽 손잡이 배율, 도착 쪽 손잡이 배율, 도착 자리 비틀기(rad)]: 첫째가 기본, 나머지는 다른 원을 비켜 가야 할 때
  const EDGE_VARIANTS = [[1, 1, 0], [0.7, 1, 0], [1, 0.7, 0], [1.3, 1.2, 0], [1, 1, 0.3], [1, 1, -0.3], [0.6, 1.3, 0.2], [0.6, 1.3, -0.2], [1.4, 0.6, 0], [1, 1, 0.55], [1, 1, -0.55], [0.5, 0.5, 0]];

  function edgePorts(L, model) { // 자식 i → 윗대 원에서 떠나는 각도
    const out = new Map();
    model.order.forEach(p => portsOf(L, p, out));
    return out;
  }
  function portsOf(L, p, out) { // 윗대 p 의 자식들 → out(자식 i → p 원에서 떠나는 각도)
    const pos = L.pos, radial = L.mode === 'radial', kids = p.children;
    if (!kids.length) return out;
    const P = pos[p.i], isRoot = !p.parent;
    const base = radial ? (isRoot ? 0 : P.th) : Math.PI / 2; // 기준 방향: 원형은 바깥, 세로는 아래
    const items = kids.map(c => {
      const C = pos[c.i];
      if (radial && isRoot) return { c, rel: C.th - SWIRL }; // 188: 자식 방향보다 조금 앞에서 떠나 시계 방향으로 휘감아 감
      let rel = wrapA(Math.atan2(C.y - P.y, C.x - P.x) - base) * (radial ? 0.6 : isRoot ? 0.9 : 0.5); // 바깥(아래)쪽으로 기울여 떠남(세로: 윗대 원 아래쪽에 고르게)
      if (!radial && kids.length === 1 && Math.abs(C.x - P.x) < 12) rel = c.depth % 2 ? 0.22 : -0.22; // 바로 아래 하나면 곧은 선 대신 살짝 S자
      return { c, rel };
    });
    if (!(radial && isRoot)) { // 형제끼리 최소 간격(각도)을 두고 원하는 방향에 가장 가깝게
      items.sort((x, y) => x.rel - y.rel);
      const lim = radial ? 1.2 : isRoot ? 1.25 : 1.05, sep = radial ? 0.42 : isRoot ? 0.36 : 0.38;
      const n = items.length, u = n > 1 ? Math.min(sep, (2 * lim) / (n - 1)) : 0;
      const r = n > 1 ? packRow(items.map(x => x.rel), u, -lim, lim) : [clamp(items[0].rel, -lim, lim)];
      items.forEach((x, k) => { x.rel = r[k]; });
    }
    items.forEach(({ c, rel }) => out.set(c.i, base + rel));
    return out;
  }

  function edgeCurve(L, p, c, a, v) { // 윗대 p 의 각도 a 자리에서 떠나 자식 c 로 들어가는 3차 베지어(양 끝은 이미 틈만큼 떨어져 있음)
    const P = L.pos[p.i], C = L.pos[c.i], d = Math.min(c.depth, 5), [ka, kb, db] = EDGE_VARIANTS[v];
    const r0 = P.rad + GAP + L.w0[d] / 2, r1 = C.rad + GAP + L.w1[d] / 2;
    const S = [P.x + r0 * Math.cos(a), P.y + r0 * Math.sin(a)];
    const toS = Math.atan2(S[1] - C.y, S[0] - C.x);
    let b, k0a, k0b;
    if (L.mode === 'radial') {
      const inward = C.th + Math.PI;
      if (!p.parent) { b = inward + SWIRL_IN; k0a = 0.42; k0b = 0.36; } // 188 가지: 바깥으로 뻗으며 자식에 닿음
      else { b = inward + 0.5 * wrapA(toS - inward); k0a = 0.4; k0b = 0.4; } // 윗대에서 바깥으로 나가 자식 쪽으로 휘어 들어감
    } else {
      const up = -Math.PI / 2;
      b = up + clamp(0.45 * wrapA(toS - up), -0.7, 0.7); // 위에서 내려와 자식 원 윗부분에 닿음
      k0a = 0.36; k0b = 0.45;
    }
    b += db;
    const E = [C.x + r1 * Math.cos(b), C.y + r1 * Math.sin(b)], D = dist(S, E);
    const la = Math.min(ka * k0a * D, 64), lb = Math.min(kb * k0b * D, 90); // 손잡이가 너무 길면 옆으로 크게 휘어 다른 원 쪽으로 감
    return [S, [S[0] + la * Math.cos(a), S[1] + la * Math.sin(a)], [E[0] + lb * Math.cos(b), E[1] + lb * Math.sin(b)], E];
  }

  // 곡선이 다른 원(양 끝 원 제외)에서 떨어진 가장 가까운 거리 — 가지가 원을 지나가지 않게
  function clearance(P, pos, ia, ib, steps = 36) {
    let m = Infinity;
    for (let k = 1; k < steps; k++) {
      const q = bez(P, k / steps);
      for (let j = 0; j < pos.length; j++) if (j !== ia && j !== ib && pos[j]) m = Math.min(m, Math.hypot(q[0] - pos[j].x, q[1] - pos[j].y) - pos[j].rad);
    }
    return m;
  }
  function route(L, p, c, a) { // 기본 곡선이 다른 원에 너무 가까우면 후보 중 가장 멀리 비켜 가는 곡선
    const need = 8;
    let best = edgeCurve(L, p, c, a, 0), bc = clearance(best, L.pos, p.i, c.i);
    for (let v = 1; v < EDGE_VARIANTS.length && bc < need; v++) {
      const P = edgeCurve(L, p, c, a, v), k = clearance(P, L.pos, p.i, c.i);
      if (k > bc + 0.5) { best = P; bc = k; }
    }
    return best;
  }

  /* ── 8. 자라는 순서(시간표) — 가지·피기·연도·입자·완성 파동이 한 시계를 씀 ── */
  function plan(model, prof) {
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
    // 완성 파동: 마지막 본부가 다 핀 뒤 waveWait 기다렸다가 한 번
    const waveAt = prevB - 90 + T.bloom + T.waveWait;
    const end = Math.max(prevB + T.halo, waveAt + T.wave + 80);
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
    // 피어날 때 입자: 동시에 살아 있는 입자가 상한을 넘지 않게(같은 달 여럿이 함께 필 때는 장식 입자만 줄임 — 피는 순서·동시 피기는 그대로)
    const sparks = new Map(), live = [], life = SPARK.dur[1] + 80;
    [[root, 260], ...model.chrono.filter(n => n !== root).map(n => [n, bloom.get(n.i) + SPARK.at])].forEach(([n, at]) => {
      const alive = live.reduce((s, [e, c]) => s + (e > at ? c : 0), 0);
      const want = n === root ? prof.root : prof.bloom, count = Math.max(Math.min(want, prof.cap - alive), Math.min(want, prof.min));
      sparks.set(n.i, { at, count });
      if (count) live.push([at + life, count]);
    });
    return { bloom, edges, bridges, years, end, waveAt, sparks };
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
  const stop = (parent, offset, color, opacity) => el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }, parent);
  let uid = 0;

  class GrowthTree {
    constructor(host) {
      this.host = host;
      this.id = 'gt3-' + ++uid;
      this.model = buildModel(null);
      this.state = 'idle';
      this.anims = []; this.fx = []; this.flows = []; this.edges = []; this.bridges = new Map();
      this.inView = false; this.seen = false; this.playing = false;
      this.dataReady = false; this.active = null; this.armed = null;
      this.still = false; // 움직임 멈춤 버튼
      this.tilt = { x: 0, y: 0, gx: 0, gy: 0, raf: 0, t: 0 };
      this.sapK = 0; this.sapWait = false;
      this.burst = new Map(); // 본부별 마지막(또는 예약된) 입자 시각 — 입자가 겹쳐 나지 않게
      this.selAt = new Map(); // 본부별 마지막 선택 효과 시각 — 같은 본부를 빠르게 오가도 1.5초 안에 다시 하지 않게
      this.rng = seeded(1729);
      host.classList.add('gt3');
      host.growthTree = this;
      this.reduced = RM.matches;
      this.shell();
      this.syncMotion();
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
      this.card = div('gt3-card', h);
      this.fog = div('gt3-fog', this.card); this.fog.setAttribute('aria-hidden', 'true'); // 빛 안개: 넓은 색 번짐 2겹 + 188 뒤 후광
      div('gt3-fog-a', this.fog); div('gt3-fog-b', this.fog); div('gt3-glow', this.fog);
      this.year = div('gt3-year', this.card); this.year.setAttribute('aria-hidden', 'true');
      this.scene = div('gt3-scene', this.card);
      this.tiltBox = div('gt3-tilt', this.scene);
      this.plane = div('gt3-plane', this.tiltBox);
      this.svg = el('svg', { class: 'gt3-svg', role: 'group', tabindex: '-1' }, this.plane); // -1: 그림 자체는 Tab 순서에서 빼고(Chrome 이 넘치는 SVG 를 탭 정지로 잡음) 본부만 Tab
      this.tip = div('gt3-tip', this.plane); this.tip.setAttribute('aria-hidden', 'true');
      this.tipText = document.createElement('span'); this.tip.appendChild(this.tipText);
      // 움직임 멈춤/켜기(카드 아래 오른쪽) — 자동으로 계속 움직이는 장식을 사용자가 멈출 수 있게(W3C Pause, Stop, Hide)
      this.ctl = div('gt3-ctl', h);
      this.btn = document.createElement('button');
      this.btn.type = 'button'; this.btn.className = 'gt3-toggle';
      this.btnText = document.createElement('span'); this.btn.appendChild(this.btnText);
      this.ctl.appendChild(this.btn);
      this.btn.addEventListener('click', () => this.setStill(!this.still));
      this.sr = document.createElement('ol'); this.sr.className = 'gt3-sr'; this.sr.setAttribute('aria-label', '본부 승격 순서'); h.appendChild(this.sr);
    }

    setCount() {
      const n = String(this.model.nodes.length);
      document.querySelectorAll('[data-branch-count]').forEach(e => { if (e.textContent !== n) e.textContent = n; });
    }

    /* 그리기: 지금 상태(idle = 188만 / done = 다 자란 그림)로 */
    render() {
      const W = Math.floor(this.card.clientWidth);
      if (!W) return;
      this.w = W;
      const m = this.model;
      const vertical = NARROW.matches || W < 440;
      const L = (vertical ? null : layoutRadial(m, W)) || layoutVertical(m, W);
      this.L = L;
      this.prof = L.mode === 'radial' ? FX.pc : FX.m;
      this.cancelAll();
      this.hideTip(); this.active = null; this.armed = null;
      const h = this.host, svg = this.svg, id = this.id, pos = L.pos;
      this.plan = plan(m, this.prof);
      h.classList.toggle('gt3-v', L.mode === 'vertical');
      h.classList.toggle('gt3-r', L.mode === 'radial');
      h.classList.remove('is-hl');
      this.card.style.setProperty('--gt3-cx', L.cx.toFixed(1) + 'px');
      this.card.style.setProperty('--gt3-cy', L.cy.toFixed(1) + 'px');
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${W} ${L.H}`);
      svg.setAttribute('width', W); svg.setAttribute('height', L.H);
      svg.setAttribute('aria-label', `188본부에서 이어진 ${m.nodes.length}개 본부의 성장 나무`);
      const defs = el('defs', {}, svg);
      // 완성 파동의 빛 띠: 바깥 가장자리가 밝은 고리
      const wb = el('radialGradient', { id: `${id}-wb` }, defs);
      stop(wb, 0.93, '#e8cf9c', 0); stop(wb, 0.985, '#e8cf9c', 0.18); stop(wb, 1, '#e8cf9c', 0); // 고리 바로 안쪽만 얇게(유리구슬처럼 보이지 않게)
      const tg = el('radialGradient', { id: `${id}-tipg` }, defs); // 붓끝 빛
      stop(tg, 0, '#fff7e6', 0.9); stop(tg, 0.4, '#fff7e6', 0.35); stop(tg, 1, '#fff7e6', 0);
      const spark = (key, color) => { const g = el('radialGradient', { id: `${id}-sp${key}` }, defs); stop(g, 0, '#fffaf0', 1); stop(g, 0.32, color, 0.95); stop(g, 1, color, 0); };
      spark('w', WARM);
      m.nodes.forEach(n => spark(n.i, n.color));

      if (L.rings) { // 나이테: 세대 고리(아주 옅게, 반복 파동 없음)
        const g = el('g', { class: 'gt3-rings', 'aria-hidden': 'true' }, svg);
        L.rings.forEach(R0 => el('circle', { cx: f1(L.cx), cy: f1(L.cy), r: f1(R0) }, g));
      }
      this.backLayer = el('g', { class: 'gt3-back', 'aria-hidden': 'true' }, svg); // 완성 파동(가지·본부 뒤로 지나감)
      // 가지(붓 획) — 부모→자식 색 그라데이션
      const gE = el('g', { class: 'gt3-edges', 'aria-hidden': 'true' }, svg);
      this.edgeLayer = gE;
      this.edges = [];
      const cuts = new Map(), ports = edgePorts(L, m);
      m.order.forEach(c => {
        if (!c.parent) return;
        const p = c.parent, cut = route(L, p, c, ports.get(c.i));
        cuts.set(c.i, cut);
        const d = Math.min(c.depth, 5), w0 = L.w0[d], w1 = L.w1[d], S = sample(cut, 40);
        const gid = `${id}-e${c.i}`;
        const lg = el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: f1(cut[0][0]), y1: f1(cut[0][1]), x2: f1(cut[3][0]), y2: f1(cut[3][1]) }, defs);
        el('stop', { offset: 0, 'stop-color': p.color }, lg);
        el('stop', { offset: 1, 'stop-color': c.color }, lg);
        const full = outline(S, w0, w1, 1);
        const path = el('path', { class: 'gt3-edge', d: full, fill: `url(#${gid})`, 'data-from': p.no, 'data-to': c.no }, gE);
        this.edges.push({ el: path, p, c, S, w0, w1, len: S.len, d: pathD(cut), cut, full, f: 1, grow: null, tipEl: null });
      });
      this.byChild = new Map(this.edges.map(e => [e.c.i, e]));
      // 다리: 236처럼 아직 안 핀 윗대 자리를 지나 뻗을 때 그 원 자리를 잇는 짧은 곡선(그 본부가 피면 사라짐)
      this.bridges = new Map();
      this.plan.bridges.forEach((b, i) => {
        const a = cuts.get(i), z = cuts.get(b.next), C = pos[i];
        if (!a || !z) return;
        const p0 = a[3], p1 = z[0], d = Math.min(m.nodes[i].depth, 5);
        const len = dist(p0, [C.x, C.y]) + dist([C.x, C.y], p1);
        const path = el('path', { class: 'gt3-bridge', d: `M${f1(p0[0])} ${f1(p0[1])}Q${f1(C.x)} ${f1(C.y)} ${f1(p1[0])} ${f1(p1[1])}`, stroke: m.nodes[i].color, 'stroke-width': L.w1[d] }, gE);
        this.bridges.set(i, { el: path, len });
      });
      this.sapLayer = el('g', { class: 'gt3-sap', 'aria-hidden': 'true' }, svg);  // 흐르는 빛(계보)
      this.fxLayer = el('g', { class: 'gt3-fx', 'aria-hidden': 'true' }, svg);    // 붓끝 빛 · 파동이 지나는 가지의 빛
      // 본부 원: 평평한 면(깊은 톤 한 가지) + 얇은 테두리. 광택·내부 그라데이션 없음
      const gN = el('g', { class: 'gt3-nodes', 'aria-hidden': 'true' }, svg);
      const auraId = `${id}-aura`;
      const ag = el('radialGradient', { id: auraId }, defs); // 188 둘레 빛 번짐
      stop(ag, 0, m.root.color, 0.1); stop(ag, 0.5, m.root.color, 0.032); stop(ag, 1, m.root.color, 0);
      this.nodeEls = [];
      m.nodes.forEach(n => {
        const P = pos[n.i], isRoot = n === m.root;
        const hid = `${id}-h${n.i}`;
        const hg = el('radialGradient', { id: hid }, defs); // 필 때·빛이 닿을 때만 잠깐 보이는 빛 번짐
        stop(hg, 0.35, n.color, 0.5); stop(hg, 1, n.color, 0);
        const g = el('g', { class: 'gt3-node' + (isRoot ? ' is-root' : ''), transform: `translate(${f1(P.x)} ${f1(P.y)})`, 'data-no': n.no, 'data-x': f1(P.x), 'data-y': f1(P.y), 'data-r': P.rad }, gN);
        if (isRoot) el('circle', { class: 'gt3-aura', r: P.rad * 3.2, fill: `url(#${auraId})` }, g);
        const halo = el('circle', { class: 'gt3-halo', r: P.rad * 1.15, fill: `url(#${hid})` }, g);
        const bud = el('g', { class: 'gt3-bud' }, g);
        el('circle', { class: 'gt3-base', r: P.rad, fill: n.face }, bud);
        const lume = el('circle', { class: 'gt3-lume', r: P.rad, fill: n.color }, bud); // 숨쉬기: 면 전체가 고르게 아주 조금 밝아짐(평평함 유지)
        const ring = el('circle', { class: 'gt3-ring', r: P.rad - 0.5, stroke: n.color }, bud);
        const t = el('text', { class: 'gt3-label', fill: n.label, dy: '0.04em' }, bud);
        t.textContent = n.no;
        if (n.no.length > 3) t.style.fontSize = '12px';
        const per = 7.5 + ((n.i * 37) % 23) / 10; // 숨쉬기: 7.5~9.7초, 위상은 서로 다르게
        lume.style.setProperty('--gt3-bd', per.toFixed(2) + 's');
        lume.style.setProperty('--gt3-ph', (-((n.i * 2.399) % per)).toFixed(2) + 's');
        this.nodeEls[n.i] = { g, bud, halo, lume, ring, sw: isRoot ? 1.25 : 1 };
      });
      this.sparkLayer = el('g', { class: 'gt3-sparks', 'aria-hidden': 'true' }, svg); // 입자(번호·말풍선을 가리지 않게 원 바깥에서만)
      this.glintEl = el('g', { class: 'gt3-glint', 'aria-hidden': 'true' }, svg); // 고른 본부 테두리의 빛 조각(옅은 번짐 + 밝은 호)
      el('circle', { class: 'gt3-glint-glow', r: 1 }, this.glintEl); el('circle', { class: 'gt3-glint-core', r: 1 }, this.glintEl);
      // 누르기·포커스(계보 순서 = Tab 순서). url 있으면 링크(새 창), 없으면 포커스만
      const gH = el('g', { class: 'gt3-hits' }, svg);
      this.hits = [];
      m.order.forEach(n => this.makeHit(n, gH));
      // 화면 읽기용 숨은 목록(승격 순서)
      this.sr.replaceChildren(...m.chrono.map(n => { const li = document.createElement('li'); li.textContent = spoken(n); return li; }));
      // 연도
      this.year.replaceChildren(...this.plan.years.map(y => { const s = document.createElement('span'); s.textContent = y.y; return s; }));
      this.placeYear();
      this.setState(this.state === 'growing' ? 'done' : this.state);
    }

    makeHit(n, layer) {
      const P = this.L.pos[n.i];
      const a = n.url
        ? el('a', { class: 'gt3-hit', href: n.url, target: '_blank', rel: 'noopener', 'aria-label': spoken(n) + ', 홈페이지 새 창' }, layer)
        : el('g', { class: 'gt3-hit', tabindex: '0', role: 'img', 'aria-label': spoken(n) }, layer);
      if (n === this.model.root) a.classList.add('is-root');
      a.setAttribute('transform', `translate(${f1(P.x)} ${f1(P.y)})`);
      a.setAttribute('data-i', n.i);
      el('circle', { class: 'gt3-hit-area', r: P.rad + 4 }, a);
      el('circle', { class: 'gt3-focus', r: P.rad + 5 }, a);
      this.hits[n.i] = a;
      return a;
    }

    placeYear() { // PC: 원과 겹치지 않는 모서리(왼쪽 아래 먼저) · 휴대폰: 카드 위 전용 자리 오른쪽
      const L = this.L, W = L.W, H = L.H, v = L.mode === 'vertical';
      const fs = v ? 36 : W >= 900 ? 64 : 52, ys = this.year.style;
      this.year.classList.toggle('is-right', v);
      ys.fontSize = fs + 'px';
      if (v) { ys.left = ''; ys.right = '18px'; ys.top = Math.round((YEAR_BAND - fs) / 2 + 2) + 'px'; return; }
      const w = fs * 2.5, hh = fs * 0.8, ins = 28;
      const spots = [[ins, H - ins - hh], [ins, ins], [W - ins - w, H - ins - hh], [W - ins - w, ins]];
      const free = ([x, y]) => L.pos.every(p => p.x + p.rad + 14 < x || p.x - p.rad - 14 > x + w || p.y + p.rad + 14 < y || p.y - p.rad - 14 > y + hh);
      const [x, y] = spots.find(free) || spots[0];
      ys.right = ''; ys.left = x.toFixed(0) + 'px'; ys.top = (y - fs * 0.1).toFixed(0) + 'px';
    }

    setState(s) {
      this.state = s;
      const h = this.host;
      h.dataset.state = s;
      h.classList.toggle('gt3-idle', s === 'idle');
      h.classList.toggle('gt3-growing', s === 'growing');
      h.classList.toggle('gt3-done', s === 'done');
      const spans = this.year.children;
      for (let k = 0; k < spans.length; k++) spans[k].classList.toggle('is-cur', s === 'done' ? k === spans.length - 1 : k === 0);
      h.classList.toggle('gt3-breathe', s === 'done' && !this.reduced);
    }

    /* 움직임을 쓸 수 있는지(움직임 줄이기·멈춤 버튼) → 클래스·버튼 글자 */
    syncMotion() {
      const still = this.reduced || this.still, h = this.host;
      h.classList.toggle('gt3-motion', !still);
      h.classList.toggle('gt3-still', still);
      this.ctl.hidden = this.reduced; // 움직임 줄이기면 멈출 것이 없음
      this.btn.dataset.still = this.still ? '1' : '0';
      this.btnText.textContent = this.still ? '움직임 켜기' : '움직임 멈춤';
    }

    setStill(v) { // 멈춤: 자라는 중이면 다 자란 그림으로 · 모든 움직임(배경·빛·입자·파동·숨쉬기·기울기)을 함께 멈춤
      if (this.still === v) return;
      this.still = v;
      if (v) { this.cancelAll(); if (this.state !== 'done') this.setState('done'); this.resetTilt(); }
      this.syncMotion();
      this.update();
    }

    /* 자라기(1회) — 모든 움직임이 같은 시계(clock)에 맞춰 시작 → 멈춤·다시 시작도 함께 */
    grow() {
      if (this.state !== 'idle' || !this.L) return;
      this.setState('growing');
      const S = this.plan, T = TIME, L = this.L, root = this.model.root;
      const add = (target, kf, opt) => { const a = target.animate(kf, Object.assign({ fill: 'both' }, opt)); this.anims.push(a); return a; };
      this.clock = new Animation(new KeyframeEffect(null, null, { duration: S.end }), document.timeline);
      this.clock.play();
      this.anims.push(this.clock);
      // 처음 등장: 배경 빛이 올라오고, PC는 장면이 0.97 → 1 로 제자리에 놓임
      add(this.fog, [{ opacity: 0.35 }, { opacity: 1 }], { duration: T.fogIn, easing: 'cubic-bezier(.3,.1,.3,1)' });
      if (L.mode === 'radial') add(this.scene, [{ transform: 'scale(.97)' }, { transform: 'none' }], { duration: T.open, easing: 'cubic-bezier(.2,.65,.25,1)' });
      add(this.nodeEls[root.i].halo, [{ opacity: 0, transform: 'scale(.8)' }, { opacity: GLOW.root, transform: 'scale(1.3)', offset: 0.25 }, { opacity: 0, transform: 'scale(2.2)' }], { delay: 200, duration: T.halo, easing: 'cubic-bezier(.25,.6,.35,1)', fill: 'none' });
      const now = performance.now();
      S.sparks.forEach((sp, i) => { this.spark(this.model.nodes[i], sp.count, sp.at, this.anims); this.burst.set(i, now + sp.at); });
      // 가지는 JS 가 시계를 보며 붓 획 길이를 늘림(growFrame) — 붓끝에 작은 빛
      this.edges.forEach(e => {
        const t = S.edges.get(e.c.i);
        e.grow = t ? { start: t.start, dur: t.dur, ease: easing(t.ease) } : null;
        e.f = -1;
        e.el.setAttribute('d', '');
        if (e.grow) {
          e.tipEl = el('g', { class: 'gt3-brush', opacity: 0 }, this.fxLayer);
          el('circle', { r: 7, fill: `url(#${this.id}-tipg)` }, e.tipEl);
          el('circle', { r: 1.5, fill: e.c.core }, e.tipEl);
        }
      });
      this.bridges.forEach((b, i) => {
        const t = S.bridges.get(i);
        b.el.style.strokeDasharray = `${f1(b.len)} ${f1(b.len + 6)}`;
        add(b.el, [{ strokeDashoffset: f1(b.len + 3), opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { delay: t.start, duration: t.dur, easing: 'linear' });
        add(b.el, [{ opacity: 1 }, { opacity: 0 }], { delay: t.hide - 60, duration: 240, fill: 'forwards' });
      });
      this.model.nodes.forEach(n => {
        if (n === root) return;
        const b = S.bloom.get(n.i), E = this.nodeEls[n.i];
        add(E.bud, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.07)', offset: 0.55 }, { opacity: 1, transform: 'scale(1)' }], { delay: b - 90, duration: T.bloom, easing: 'cubic-bezier(.2,.7,.25,1)' });
        add(E.halo, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: GLOW.bloom, transform: 'scale(1.25)', offset: 0.2 }, { opacity: 0, transform: 'scale(2.3)' }], { delay: b - 40, duration: T.halo, easing: 'cubic-bezier(.25,.6,.35,1)' });
        add(this.hits[n.i], [{ visibility: 'hidden' }, { visibility: 'visible' }], { delay: b - 90, duration: 1 });
      });
      // 연도: 바뀌는 순간 200ms 겹쳐 바뀜(앞 연도는 위로 사라지고 다음 연도가 아래에서 올라옴 — 비는 순간 없음)
      const spans = this.year.children, F = T.yearFade;
      S.years.forEach((y, k) => {
        const span = spans[k], next = S.years[k + 1];
        if (k > 0) add(span, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { delay: y.at - F / 2, duration: F, easing: 'cubic-bezier(.2,.6,.3,1)' });
        if (next) add(span, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-4px)' }], { delay: next.at - F / 2, duration: F, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
      });
      this.setupWave(S.waveAt, add);
      const all = this.anims.slice();
      Promise.all(all.map(a => a.finished)).then(() => { if (this.state === 'growing' && this.anims.length) this.finishGrowth(); }, () => {});
      if (!this.playing) this.pauseAnims(this.anims);
      this.growFrame();
    }

    // 완성 파동: 188에서 바깥으로 한 번(휴대폰은 188이 위라 위에서 아래로 내려감). 파동이 지나는 가지에 빛이 흐르고, 닿는 본부 테두리가 잠깐 밝아짐
    setupWave(at, add) {
      const L = this.L, T = TIME, root = this.model.root, R = L.pos[root.i], radial = L.mode === 'radial';
      const ease = easing(EASE.wave);
      const inv = v => { let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (ease(mid) < v) lo = mid; else hi = mid; } return (lo + hi) / 2; };
      // 원형·세로 모두 188에서 퍼지는 고리 하나 — 세로 나무(휴대폰)는 188이 맨 위라 고리의 아래 호가 위에서 아래로 내려감
      const g = el('g', { class: 'gt3-wave', opacity: 0, transform: `translate(${f1(R.x)} ${f1(R.y)})` }, this.backLayer);
      const from = R.rad + 4, to = Math.max(...L.pos.map(p => Math.hypot(p.x - R.x, p.y - R.y) + p.rad)) + (radial ? 90 : 60);
      const measure = (x, y) => Math.hypot(x - R.x, y - R.y);
      this.wave = { at, from, to, ease, g, band: el('circle', { class: 'gt3-wave-band', r: from, fill: `url(#${this.id}-wb)` }, g), line: el('circle', { class: 'gt3-wave-line', r: from }, g) };
      const tAt = v => at + T.wave * inv(clamp((v - from) / (to - from), 0, 1));
      this.edges.forEach(e => {
        const t0 = tAt(measure(e.cut[0][0], e.cut[0][1])), t1 = tAt(measure(e.cut[3][0], e.cut[3][1]));
        const sp = e.len / Math.max(120, t1 - t0); // 파동과 같은 빠르기로 가지를 따라 바깥으로
        this.streak(e, t0, sp, { anims: this.anims, els: null }, this.fxLayer, 56);
      });
      this.model.nodes.forEach(n => {
        const P = L.pos[n.i], E = this.nodeEls[n.i], t = n === root ? at : tAt(measure(P.x, P.y) - P.rad);
        add(E.ring, [{ strokeWidth: E.sw + 'px' }, { strokeWidth: E.sw + 1.1 + 'px', offset: 0.3 }, { strokeWidth: E.sw + 'px' }], { delay: t, duration: 700, easing: 'ease-out', fill: 'none' });
        add(E.halo, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: GLOW.wave, transform: 'scale(1.2)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.6)' }], { delay: t, duration: 900, easing: 'ease-out', fill: 'none' });
      });
      // 가지 층 전체도 잠깐 진해짐(0.8 → 0.9 → 0.8)
      add(this.edgeLayer, [{ opacity: 0.8 }, { opacity: 0.92, offset: 0.4 }, { opacity: 0.8 }], { delay: at, duration: 600, easing: 'ease-in-out', fill: 'none' });
    }

    waveFrame(t) {
      const W = this.wave;
      if (!W) return;
      const p = (t - W.at) / TIME.wave;
      if (p <= 0 || p >= 1) { if (W.on) { W.g.setAttribute('opacity', 0); W.on = false; } return; }
      const v = W.from + (W.to - W.from) * W.ease(p), o = Math.min(1, p / 0.06) * Math.pow(1 - p, 1.3);
      W.on = true;
      W.g.setAttribute('opacity', o.toFixed(3));
      W.line.setAttribute('r', f1(v)); W.band.setAttribute('r', f1(v));
    }

    growFrame() {
      cancelAnimationFrame(this.growRaf); this.growRaf = 0;
      if (this.state !== 'growing' || !this.clock) return;
      const t = this.clock.currentTime || 0;
      this.edges.forEach(e => {
        const g = e.grow;
        if (!g) return;
        const p = clamp((t - g.start) / g.dur, 0, 1), f = p <= 0 ? 0 : p >= 1 ? 1 : g.ease(p);
        if (f !== e.f) {
          e.f = f; e.el.setAttribute('d', f >= 1 ? e.full : f > 0 ? outline(e.S, e.w0, e.w1, f) : '');
          if (e.tipEl) { // 붓끝 빛: 자라는 동안만
            const on = f > 0 && f < 1;
            e.tipEl.setAttribute('opacity', on ? 1 : 0);
            if (on) { const q = pointAt(e.S, e.len * f); e.tipEl.setAttribute('transform', `translate(${f1(q[0])} ${f1(q[1])})`); }
          }
        }
      });
      this.waveFrame(t);
      if (t < this.plan.end && this.playing) this.growRaf = requestAnimationFrame(() => this.growFrame());
    }

    finishGrowth() { // 다 자람: 애니메이션을 걷고 최종 모습(CSS 기본값)으로 → 잔잔한 반복 시작
      this.cancelAll();
      this.setState('done');
      this.calmLater();
      if (this.playing) this.scheduleSap(TIME.sapFirst);
    }

    cancelAll() {
      cancelAnimationFrame(this.growRaf); this.growRaf = 0;
      this.anims.forEach(a => a.cancel()); this.anims = []; this.clock = null;
      this.fx.forEach(a => a.cancel()); this.fx = [];
      this.flows.forEach(f => f.anims.forEach(a => a.cancel())); this.flows = [];
      this.sapWait = false; this.wave = null;
      this.burst.clear(); this.selAt.clear(); // 예약만 되고 취소된 반짝임 시각이 남아 다음 효과를 막지 않게
      [this.sapLayer, this.fxLayer, this.backLayer, this.sparkLayer].forEach(g => { if (g) g.replaceChildren(); });
      if (this.glintAnim) { this.glintAnim.forEach(a => a.cancel()); this.glintAnim = null; }
      clearTimeout(this.sapTimer); clearTimeout(this.calmTimer);
      this.edges.forEach(e => { if (e.f !== 1) e.el.setAttribute('d', e.full); e.f = 1; e.grow = null; e.tipEl = null; });
      this.bridges.forEach(b => { b.el.style.strokeDasharray = ''; });
    }

    pauseAnims(list) { list.forEach(a => { if (a.playState === 'running') a.pause(); }); }
    allAnims() { return [...this.anims, ...this.fx, ...this.flows.flatMap(f => f.anims), ...(this.glintAnim || [])]; }

    /* 흐르는 빛: 가지를 따라 부모 → 자식으로 가는 혜성. 길고 가는 꼬리(가문 색) → 짧고 굵은 몸 → 밝은 머리(가문 색 + 오프화이트) + 머리의 둥근 번짐.
       대시는 끝이 가늘어지지 않으므로 길수록 가늘고 옅게 겹쳐 꼬리가 자연스럽게 가늘어지게. 머리 번짐도 크기가 다른 둥근 점 두 겹(가장자리가 부드럽게) */
    streak(e, delay, speed, sink, layer, tail) {
      const pad = 4, G = tail, C = TIME.sapCore, M = Math.round((G + C) / 2.6), w = (e.w0 + e.w1) / 2;
      const dur = (e.len + G + 2 * pad) / speed;
      [['gt3-s-tail', w + 1, G, e.c.color], ['gt3-s-mid', w + 3, M, e.c.color], ['gt3-s-core', Math.max(1.6, w * 1.1), C, e.c.core], ['gt3-s-halo', w + 7, 0.1, e.c.core], ['gt3-s-head', w + 3.6, 0.1, e.c.core]].forEach(([cls, sw, len, color]) => {
        const p = el('path', { class: cls, d: e.d, stroke: color, 'stroke-width': f1(sw) }, layer);
        p.style.strokeDasharray = `${len} ${f1(e.len + G + 4 * pad)}`;
        // 머리를 맞춰 같은 빠르기로, 양 끝 둥근 마개까지 가지 밖에서 시작·끝
        const a = p.animate([{ strokeDashoffset: f1(len + pad) }, { strokeDashoffset: f1(-e.len - pad - (G - len)) }], { delay, duration: dur, easing: 'linear', fill: 'both' });
        sink.anims.push(a);
        if (sink.els) sink.els.push(p);
      });
      return delay + (e.len + pad) / speed; // 머리가 가지 끝에 닿는 시각
    }

    scheduleSap(delay) {
      clearTimeout(this.sapTimer);
      if (this.reduced || this.state !== 'done' || !this.playing || !this.edges.length) return;
      this.sapTimer = setTimeout(() => this.sapTick(), delay);
    }

    // PC: 약 2초(±0.2초)마다 다음 계보 출발 — 이미 2계보가 흐르는 중이면 하나가 끝날 때까지 늦춤. 휴대폰: 한 계보씩(끝나면 0.7~1초 쉬고 다음)
    sapTick() {
      if (this.reduced || this.state !== 'done' || !this.playing) return;
      if (this.active != null) { this.scheduleSap(1500); return; } // 사용자가 보고 있는 동안은 쉼
      if (this.flows.length >= this.prof.flows) { this.sapWait = true; return; }
      this.startFlow();
      if (this.prof.flows > 1) this.scheduleSap(TIME.sapEvery + (this.rng() * 2 - 1) * TIME.sapJitter);
    }

    startFlow() {
      const fams = this.model.gen1;
      if (!fams.length) return;
      const fam = fams[this.sapK++ % fams.length], T = TIME;
      const flow = { anims: [], els: [], extra: [] };
      const walk = (n, t0) => { // 갈림길에서는 그 가문의 하위 가지로 나뉨
        const e = this.byChild.get(n.i);
        if (!e) return;
        const hit = this.streak(e, t0, T.sapSpeed, flow, this.sapLayer, T.sapTail);
        this.arrive(n, hit, !n.children.length, flow);
        const through = (2 * this.L.pos[n.i].rad) / T.sapSpeed * 0.35; // 빛이 본부를 지나는 짧은 틈
        n.children.forEach(c => walk(c, hit + through));
      };
      walk(fam, 0);
      this.flows.push(flow);
      Promise.all(flow.anims.map(a => a.finished)).then(() => this.endFlow(flow), () => {});
      if (!this.playing) this.pauseAnims(flow.anims);
    }

    endFlow(flow) {
      const k = this.flows.indexOf(flow);
      if (k < 0) return;
      this.flows.splice(k, 1);
      flow.anims.forEach(a => a.cancel()); flow.els.forEach(p => p.remove());
      if (this.prof.flows > 1) { if (this.sapWait) { this.sapWait = false; this.scheduleSap(250); } }
      else this.scheduleSap(TIME.sapRest[0] + this.rng() * (TIME.sapRest[1] - TIME.sapRest[0]));
    }

    // 빛이 본부에 닿을 때: 바깥 빛 번짐 + 테두리 잠깐 밝게(번호 밝기는 그대로). 끝 본부는 입자 소량
    arrive(n, at, leaf, flow) {
      const E = this.nodeEls[n.i];
      this.fxAnim(E.halo, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: leaf ? GLOW.arrive : GLOW.pass, transform: 'scale(1.22)', offset: 0.32 }, { opacity: 0, transform: 'scale(1.55)' }], { delay: at, duration: TIME.arrive, easing: 'ease-out' }, flow.extra);
      this.fxAnim(E.ring, [{ strokeWidth: E.sw + 'px' }, { strokeWidth: E.sw + 0.8 + 'px', offset: 0.3 }, { strokeWidth: E.sw + 'px' }], { delay: at, duration: TIME.arrive + 100, easing: 'ease-out' }, flow.extra);
      if (leaf) this.sparkFx(n, this.prof.arrive, at + 30, 900, flow.extra);
    }

    fxAnim(target, kf, opt, group) { // 반복 장식(빛 흐름의 도착 반응·입자·선택): 화면 밖이면 함께 멈추고, 끝나면 목록에서 빠짐
      const a = target.animate(kf, Object.assign({ fill: 'none' }, opt));
      this.fx.push(a);
      if (group) group.push(a);
      const done = () => { const k = this.fx.indexOf(a); if (k >= 0) this.fx.splice(k, 1); };
      a.finished.then(done, done);
      if (!this.playing) a.pause();
      return a;
    }

    // 입자: 원 테두리 바깥에서 작은 빛 점이 퍼지며 사라짐(가문 색 약 75% · 따뜻한 오프화이트 약 25%, 188은 샴페인 골드와 오프화이트)
    spark(n, count, delay, list) {
      if (!count) return 0;
      const P = this.L.pos[n.i], isRoot = n === this.model.root, rnd = this.rng, a0 = rnd() * TAU;
      for (let k = 0; k < count; k++) {
        const a = a0 + (k * TAU) / count + (rnd() - 0.5) * 0.8, dx = Math.cos(a), dy = Math.sin(a);
        const r0 = P.rad + 2 + rnd() * 2, d = SPARK.dist[0] + rnd() * (SPARK.dist[1] - SPARK.dist[0]);
        const size = SPARK.size[0] + rnd() * (SPARK.size[1] - SPARK.size[0]), dur = SPARK.dur[0] + rnd() * (SPARK.dur[1] - SPARK.dur[0]);
        const warm = k % 4 === 3 || (count === 2 && k === 1);
        const c = el('circle', { class: 'gt3-spark', r: f1(size / 2), fill: `url(#${this.id}-sp${warm ? 'w' : n.i})` }, this.sparkLayer);
        const at = (k2, sc) => `translate(${f1(P.x + dx * (r0 + d * k2))}px,${f1(P.y + dy * (r0 + d * k2))}px) scale(${sc})`;
        const a1 = c.animate([ // 테두리에서 밝게 피어 바깥으로 느려지며 사라짐
          { transform: at(0, 0.4), opacity: 0 },
          { transform: at(0.42, 1), opacity: SPARK.peak, offset: 0.18 },
          { transform: at(0.85, 0.8), opacity: SPARK.peak * 0.55, offset: 0.6 },
          { transform: at(1, 0.35), opacity: 0 }
        ], { delay, duration: dur, easing: 'linear', fill: 'both' });
        list.push(a1);
        if (list === this.fx) { const done = () => { const j = this.fx.indexOf(a1); if (j >= 0) this.fx.splice(j, 1); c.remove(); }; a1.finished.then(done, done); } // 끝나거나 취소되면 지움
        if (!this.playing) a1.pause();
      }
      return count;
    }

    // 다 자란 뒤의 입자(빛 도착·마우스): 같은 본부에서 gap 안에 다시 나지 않게 + 동시에 살아 있는 입자 상한
    sparkFx(n, want, delay, gap, group) {
      const t = performance.now() + delay, last = this.burst.get(n.i);
      if (last != null && t - last < gap) return;
      const room = this.prof.cap - this.sparkLayer.childElementCount, count = Math.min(want, room);
      if (count <= 0) return;
      this.burst.set(n.i, t);
      const before = this.fx.length;
      this.spark(n, count, delay, this.fx);
      if (group) group.push(...this.fx.slice(before));
    }

    // 고른 본부: 둘레 20% 길이의 밝은 호가 450ms 동안 한 바퀴 지나감(끝나면 굵어진 테두리만 남음) + 입자 소량
    selectFx(n) {
      if (!this.playing) return; // 멈춤·움직임 줄이기·화면 밖: 정적인 강조만
      const now = performance.now(), last = this.selAt.get(n.i);
      if (last != null && now - last < TIME.cool) return; // 같은 본부를 빠르게 오가면 다시 하지 않음
      this.selAt.set(n.i, now);
      const P = this.L.pos[n.i], r = P.rad - 0.5, C = TAU * r, g = this.glintEl;
      g.setAttribute('transform', `translate(${f1(P.x)} ${f1(P.y)}) rotate(-90)`);
      if (this.glintAnim) this.glintAnim.forEach(a => a.cancel());
      this.glintAnim = [...g.children].map(c => {
        c.setAttribute('r', f1(r)); c.setAttribute('stroke', n.core);
        c.style.strokeDasharray = `${f1(C * 0.2)} ${f1(C)}`;
        return c.animate([{ strokeDashoffset: f1(C * 0.2), opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.72 }, { strokeDashoffset: f1(-C), opacity: 0 }], { duration: 450, easing: 'cubic-bezier(.3,.15,.35,1)' });
      });
      this.sparkFx(n, this.prof.touch, 40, 900);
    }

    // 사용자가 본부를 보는 동안: 흐르던 빛을 180ms 에 걸쳐 정리(아직 시작 안 한 도착 반응·입자는 취소)
    clearFlows(fade) {
      clearTimeout(this.sapTimer); this.sapWait = false;
      const flows = this.flows, now = performance.now();
      this.flows = [];
      this.burst.forEach((t, i) => { if (t > now) this.burst.delete(i); }); // 취소되는 도착 입자의 예약 시각도 지움
      flows.forEach(f => {
        f.extra.forEach(a => { // 아직 시작 안 한 반응·입자는 취소, 이미 나온 입자도 거둠(흐려진 본부 옆에 밝은 점이 남지 않게)
          const d = a.effect ? a.effect.getTiming().delay : 0, tg = a.effect && a.effect.target;
          if ((a.currentTime || 0) < d || (tg && tg.classList.contains('gt3-spark'))) a.cancel();
        });
        const kill = () => { f.anims.forEach(a => a.cancel()); f.els.forEach(p => p.remove()); };
        if (fade && this.playing) { f.els.forEach(p => p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-out', fill: 'forwards' })); setTimeout(kill, 200); } else kill();
      });
    }

    // 휴대폰: 다 자란 뒤 15초 동안 조작이 없으면 넓은 배경 이동을 멈춤(가지의 빛은 계속). 다음 조작 때 그 자리에서 다시 천천히(갑자기 밝아지지 않음)
    calmLater() {
      clearTimeout(this.calmTimer);
      this.host.classList.remove('gt3-calm');
      if (!this.L || this.L.mode !== 'vertical' || this.state !== 'done' || !this.playing) return;
      this.calmTimer = setTimeout(() => this.host.classList.add('gt3-calm'), TIME.calm);
    }

    /* 화면 안·탭 보임·움직임 허용일 때만 움직임 */
    update() {
      const on = this.inView && !document.hidden && !this.reduced && !this.still;
      if (on !== this.playing) {
        this.playing = on;
        this.host.classList.toggle('gt3-paused', !on);
        if (on) {
          this.allAnims().forEach(a => { if (a.playState === 'paused') a.play(); });
          if (this.state === 'growing') this.growFrame();
          this.scheduleSap(1600); // 숨어 있던 동안의 빛·입자를 몰아서 내지 않음
          this.calmLater();
        } else {
          this.pauseAnims(this.allAnims());
          cancelAnimationFrame(this.growRaf); this.growRaf = 0;
          clearTimeout(this.sapTimer); clearTimeout(this.calmTimer);
          cancelAnimationFrame(this.tilt.raf); this.tilt.raf = 0;
        }
      }
      if (this.state === 'idle' && this.seen && this.dataReady) {
        if (on) this.grow();
        else if (this.reduced || this.still) this.setState('done');
      }
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
      const f = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.gt3-hit') : null;
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
      const again = this.active === i;
      this.active = i;
      this.host.classList.add('is-hl');
      this.model.nodes.forEach(m => { const g = this.nodeEls[m.i].g; g.classList.toggle('is-on', n.rel.has(m.i)); g.classList.toggle('is-sel', m.i === i); });
      this.edges.forEach(e => e.el.classList.toggle('is-on', n.rel.has(e.c.i) && n.rel.has(e.p.i)));
      this.showTip(n);
      if (!again) { this.clearFlows(true); this.selectFx(n); }
    }

    deactivate() {
      const was = this.active != null;
      this.active = null; this.armed = null;
      this.host.classList.remove('is-hl');
      if (this.nodeEls) this.nodeEls.forEach(E => E.g.classList.remove('is-sel'));
      this.hideTip();
      if (was) this.scheduleSap(1200);
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
      const svg = this.svg, hitOf = e => (e.target && e.target.closest ? e.target.closest('.gt3-hit') : null);
      const idx = h => +h.getAttribute('data-i');
      svg.addEventListener('pointerdown', e => { this.pt = e.pointerType; }, { passive: true });
      svg.addEventListener('pointerover', e => { const h = hitOf(e); if (h && e.pointerType === 'mouse') this.activate(idx(h)); });
      svg.addEventListener('pointerout', e => {
        const h = hitOf(e);
        if (!h || e.pointerType !== 'mouse' || (e.relatedTarget && h.contains(e.relatedTarget))) return;
        const f = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.gt3-hit') : null;
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
        const h = e.target && e.target.closest ? e.target.closest('.gt3-hit') : null;
        if (!h || !this.host.contains(h)) this.deactivate();
      }, { passive: true });
      this.host.addEventListener('pointerdown', () => this.calmLater(), { passive: true }); // 조작하면 배경이 그 자리에서 다시 천천히
      this.host.addEventListener('keydown', e => { if (e.key === 'Escape' && this.active != null) this.deactivate(); });

      // 화면 안에 있을 때만(+탭이 보일 때만) 움직임
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(es => {
          es.forEach(en => {
            this.inView = en.isIntersecting;
            if (en.isIntersecting && (en.intersectionRatio >= 0.3 || en.intersectionRect.height >= window.innerHeight * 0.45)) this.seen = true;
          });
          this.update();
        }, { threshold: [0, 0.1, 0.2, 0.3, 0.45, 0.6] }).observe(this.card);
      } else { this.inView = true; this.seen = true; }
      document.addEventListener('visibilitychange', () => this.update());

      // 폭이 바뀌면 다시 배치(자라는 중이면 다 자란 그림으로)
      const relayout = () => { const w = Math.floor(this.card.clientWidth); if (w && w !== this.w) { this.render(); this.update(); if (this.state === 'done') { this.scheduleSap(1800); this.calmLater(); } } }; // 숨은 자리에서 처음 보일 때도 여기서 자라기 시작
      if ('ResizeObserver' in window) new ResizeObserver(() => { cancelAnimationFrame(this.ro); this.ro = requestAnimationFrame(relayout); }).observe(this.card);
      else window.addEventListener('resize', relayout);
      if (NARROW.addEventListener) NARROW.addEventListener('change', () => { // 배치 방식(원형 ↔ 세로)이 실제로 바뀔 때만(잠깐 흔들린 알림에 자라는 연출이 끊기지 않게)
        if (this.L && (NARROW.matches || this.w < 440) !== (this.L.mode === 'vertical')) { this.w = 0; relayout(); }
      });
      if (RM.addEventListener) RM.addEventListener('change', () => { // 페이지를 연 채로 설정을 바꿔도 바로 따름
        this.reduced = RM.matches;
        if (this.reduced) { this.cancelAll(); this.setState('done'); this.resetTilt(); } else this.setState(this.state);
        this.syncMotion();
        this.update();
      });

      // 입체감: PC 마우스 위치로 아주 살짝 기울임(최대 약 2°, 부드럽게 따라옴). 휴대폰은 기울이지 않음
      window.addEventListener('pointermove', e => {
        if (!this.playing || !FINE.matches || e.pointerType !== 'mouse') return;
        const r = this.card.getBoundingClientRect();
        const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.6), -1, 1);
        const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.6), -1, 1);
        this.tilt.gx = -ny * 1.6; this.tilt.gy = nx * 2;
        this.kickTilt();
      }, { passive: true });
      document.documentElement.addEventListener('pointerleave', () => { this.tilt.gx = 0; this.tilt.gy = 0; this.kickTilt(); });
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

    resetTilt() { cancelAnimationFrame(this.tilt.raf); this.tilt = { x: 0, y: 0, gx: 0, gy: 0, raf: 0, t: 0 }; this.plane.style.transform = ''; }
  }

  function init(root) {
    (root || document).querySelectorAll('[data-growth-tree]').forEach(h => { if (!h.growthTree) new GrowthTree(h); });
  }
  window.GrowthTree = { init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
