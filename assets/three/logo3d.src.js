/* 프라임에셋 프리미엄 — 첫 화면 실시간 3D 로고 (HOME-PLUS-20261102 1번 + CHANGE1 고급화 01b)
   · 로고 SVG(assets/logo.svg와 같은 path)를 돌출(extrude)한 금 금속 재질(스튜디오 환경 반사 + 코팅), 회전 속도가 느렸다 빨랐다 부드럽게 변함(과하지 않게)
   · 파티클 없음. 대신 로고 표면 모서리에 붙은 글린트 9개×앞·뒤면(로고와 함께 회전): 빛이 모서리를 스치는 각도에서만 짧게 반짝이고,
     약 8초마다 지나가는 은은한 빛줄기(스윕 하이라이트)가 닿을 때 차례로 켜짐. 색은 금·샴페인·흰빛 + 아주 옅은 보석 반사. 동시에 1~3개만.
   · 성능: 픽셀비 상한(휴대폰 1.5, PC 2), 화면 밖·다른 탭이면 멈춤, 첫 프레임을 그린 뒤에만 정지 WebP를 숨김
   · 라이브러리: three.js r187 (MIT, assets/three/LICENSE.three.txt). 이 파일을 esbuild로 묶은 것이 logo3d.min.js (assets/three/README.md)
   · 켜는 조건(assets/three/logo3d-loader.js): WebGL 됨 + 움직임 줄이기 아님 + 데이터 절약 아님. 아니면 기존 WebP 그대로. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, ExtrudeGeometry, MeshPhysicalMaterial, Color,
  PMREMGenerator, Points, BufferGeometry, BufferAttribute, Float32BufferAttribute, ShaderMaterial, AdditiveBlending,
  DirectionalLight, ACESFilmicToneMapping, Box3, Vector3
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// assets/logo.svg 와 같은 외곽선(방패 + R 모노그램, evenodd 구멍 2개). 좌표계 0~212.5 × 0~235.73
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212.5 235.73"><path fill="#000" fill-rule="evenodd" d="M0 0 L212.5 0 L212.5 174 L106.25 235.73 L65.7 212.17 L65.7 185.67 L106.25 209.23 L157.26 179.77 L121.72 136.6 L55.2 136.6 L55.2 206.07 L0 174 Z M22.2 21.5 L22.2 160.4 L32.5 166.38 L32.5 114.5 L103.53 114.5 L34.31 30.4 L123.4 30.4 A52.9 52.9 0 0 1 146.37 130.95 L177.08 168.26 L190.6 160.4 L190.6 21.5 Z M81.8 52.5 L131.59 112.99 A30.8 30.8 0 0 0 123.4 52.5 Z"/></svg>';
const SVG_W = 212.5, SVG_H = 235.73, BEVEL = 4; // 베벨만큼 외곽이 넓어짐
// 글린트 자리(SVG 좌표): 방패 꼭짓점·R 모서리·바울 바깥 가장자리 — 빛이 걸리는 모서리들
const GLINT_PTS = [[0, 0], [212.5, 0], [106.25, 235.73], [176.3, 83.3], [157.26, 179.77], [55.2, 206.07], [81.8, 52.5], [0, 174], [103.53, 114.5]];

const CSS = `
.g-hero-logo{position:relative}
.g-hero-logo canvas.g-hero-3d{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .6s ease;display:block}
@media (min-width:721px){.g-hero-logo canvas.g-hero-3d{filter:drop-shadow(0 24px 40px rgba(15,23,42,.18))}}
.g-hero-logo.is-3d canvas.g-hero-3d{opacity:1}
.g-hero-logo.is-3d img{opacity:0;transition:opacity .5s ease;animation:none}
@media (prefers-reduced-motion:reduce){.g-hero-logo canvas.g-hero-3d{display:none}.g-hero-logo.is-3d img{opacity:1}}
`;

function buildLogo() {
  const data = new SVGLoader().parse(LOGO_SVG);
  const shapes = [];
  data.paths.forEach((p) => { p.toShapes().forEach((s) => shapes.push(s)); }); // evenodd 구멍 처리
  const geo = new ExtrudeGeometry(shapes, { depth: 18, bevelEnabled: true, bevelThickness: 5, bevelSize: BEVEL, bevelOffset: 0, bevelSegments: 6, curveSegments: 32 });
  geo.center();
  const box = new Box3().setFromBufferAttribute(geo.attributes.position);
  const size = new Vector3(); box.getSize(size);
  const s = 2.6 / size.y;           // 높이 2.6 단위로 정규화
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  box.min.multiplyScalar(s); box.max.multiplyScalar(s);
  // 재질: 금 금속 + 유리 같은 코팅. 환경맵(스튜디오 룸)이 반사를 만든다. 빛줄기(스윕)는 셰이더에 emissive 띠로 추가
  const mat = new MeshPhysicalMaterial({
    color: new Color(0xd9b65e), metalness: 1.0, roughness: 0.20,
    clearcoat: 0.8, clearcoatRoughness: 0.05, envMapIntensity: 1.25, reflectivity: 1.0
  });
  const sweep = { value: -99 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSweep = sweep;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSweepPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSweepPos = (modelViewMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSweep; varying vec3 vSweepPos;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ float d = abs(vSweepPos.x * 0.82 + vSweepPos.y * 0.57 - uSweep); float band = smoothstep(0.42, 0.0, d); totalEmissiveRadiance += vec3(1.0, 0.94, 0.80) * band * 0.42; }');
  };
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = Math.PI;        // SVG 좌표(y 아래)를 화면 좌표(y 위)로. 이 회전 뒤 카메라 쪽 면 = 원래 z 최소 면
  return { mesh, box, sweep, scale: (box.max.x - box.min.x) / (SVG_W + 2 * BEVEL) };
}

// 글린트: 로고 메시의 자식 Points. 앞면(원래 z 최소 쪽) 9개 + 뒷면 9개. 밝기는 CPU에서 매 프레임 계산해 attribute 로 넘김(18개뿐이라 가벼움)
function buildGlints(box, scale) {
  const n = GLINT_PTS.length * 2;
  const pos = new Float32Array(n * 3), inten = new Float32Array(n), seed = new Float32Array(n);
  const cx = SVG_W / 2, cy = SVG_H / 2;
  const items = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < GLINT_PTS.length; i++) {
      const k = side * GLINT_PTS.length + i;
      const [sx, sy] = GLINT_PTS[i];
      const x = (sx - cx) * scale, y = (sy - cy) * scale;
      const z = side === 0 ? box.min.z - 0.012 : box.max.z + 0.012;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      seed[k] = (i * 0.618 + side * 0.31) % 1;
      // 빛이 스치는 회전 각(한 바퀴에 한 번): 9개를 원둘레에 고르게 + 살짝 어긋나게 → 동시에 1~3개
      const theta = (i / GLINT_PTS.length) * Math.PI * 2 + side * 0.35 + ((i * 7) % 5) * 0.06;
      items.push({ k, theta, side, local: new Vector3(x, y, z), normal: new Vector3(0, 0, side === 0 ? -1 : 1), amp: 0.7 + 0.3 * ((i * 3) % 4) / 3 });
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aI', new BufferAttribute(inten, 1)); // 복사 없이 같은 배열을 씀(매 프레임 CPU에서 밝기 갱신 → needsUpdate)
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  geo.computeBoundingSphere();
  const mat = new ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 }, uScale: { value: 300 } },
    vertexShader: `
      uniform float uPixelRatio; uniform float uScale;
      attribute float aI; attribute float aSeed;
      varying float vI; varying float vSeed;
      void main(){
        vI = aI; vSeed = aSeed;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (34.0 + 18.0 * aSeed) * (0.3 + 1.0 * aI) * uPixelRatio * (uScale / -mv.z) / 60.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision mediump float;
      varying float vI; varying float vSeed;
      void main(){
        if (vI < 0.01) discard;
        vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float core = exp(-d * d * 42.0);                       // 부드러운 빛번짐
        float ray = max(exp(-abs(uv.x) * 9.0) * exp(-abs(uv.y) * 90.0), exp(-abs(uv.y) * 9.0) * exp(-abs(uv.x) * 90.0)); // 가는 십자 광채
        float ray2 = 0.35 * max(exp(-abs(uv.x + uv.y) * 14.0) * exp(-abs(uv.x - uv.y) * 110.0), exp(-abs(uv.x - uv.y) * 14.0) * exp(-abs(uv.x + uv.y) * 110.0));
        float a = clamp(core * 1.3 + (ray + ray2) * 0.95, 0.0, 1.0) * vI;
        vec3 champagne = vec3(1.0, 0.93, 0.72);
        vec3 gem = 0.5 + 0.5 * cos(6.2832 * (d * 2.2 + vSeed + vec3(0.0, 0.33, 0.67))); // 아주 옅은 보석 반사(무지개)
        vec3 col = mix(champagne, vec3(1.0), core * 0.8);
        col = mix(col, gem, 0.10 * (1.0 - core));
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: AdditiveBlending
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  return { points, items, inten };
}

export function init() {
  const box = document.querySelector('.g-hero-logo');
  const img = box && box.querySelector('img');
  if (!box || !img || box.querySelector('canvas.g-hero-3d')) return null;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const canvas = document.createElement('canvas'); canvas.className = 'g-hero-3d'; canvas.setAttribute('aria-hidden', 'true');
  box.appendChild(canvas);
  const isMobile = window.matchMedia('(max-width:720px)').matches || /Mobi|Android/i.test(navigator.userAgent);
  const maxDpr = isMobile ? 1.5 : 2;
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
  } catch (e) { canvas.remove(); return null; }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 7.4); camera.lookAt(0, 0, 0);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();   // 스튜디오 룸(소프트박스) 반사
  const key = new DirectionalLight(0xfff6e0, 1.4); key.position.set(3, 4, 5); scene.add(key);
  const rim = new DirectionalLight(0xfff1c4, 0.7); rim.position.set(-4, -2, 3); scene.add(rim);
  const group = new Group(); const logo = buildLogo(); group.add(logo.mesh); scene.add(group);
  const gl = buildGlints(logo.box, logo.scale); logo.mesh.add(gl.points);
  const gMat = gl.points.material;

  // 크기: 그림(WebP) 표시 폭의 1.5배 정사각형(그림자·글린트 여유). 픽셀비 상한.
  let cssSize = 0;
  function resize() {
    const w = img.getBoundingClientRect().width || img.clientWidth || 300;
    const size = Math.round(w * 1.5);
    if (size === cssSize) return;
    cssSize = size;
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    gMat.uniforms.uPixelRatio.value = dpr;
    gMat.uniforms.uScale.value = size * 0.62;
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box); else window.addEventListener('resize', resize);

  // 회전: 각속도 w(t) = 0.16 + 1.0·s², s는 0~1 사이를 천천히 오가는 값 → 느릴 때 약 39초/바퀴, 빠를 때 약 5.4초/바퀴
  let t = 0, angle = 0, last = 0, running = false, visible = true, frames = 0, started = 0, raf = 0;
  const stats = { frames: 0, seconds: 0, fps: 0, ready: false, angle: 0, dpr: 0, size: 0, renderMs: 0, glints: gl.items.length, lit: 0, sweep: false, debug: { litAll: false, sweepAt: null, freeze: false } }; // debug: 검증 캡처용(평소 비활성)
  let msAcc = 0, msN = 0;
  window.__logo3d = stats;
  stats.debug.api = { renderer, scene, camera, logo, gl }; // 진단용(검증 스크립트가 읽음)
  const SWEEP_PERIOD = 8.0, SWEEP_DUR = 1.6; // 8초마다 1.6초 동안 왼쪽 아래→오른쪽 위로 빛줄기
  const tmpP = new Vector3(), tmpN = new Vector3();
  function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
  function updateGlints() {
    const sweepT = (t + 2.0) % SWEEP_PERIOD;
    let sweeping = sweepT < SWEEP_DUR;
    let sweepPos = sweeping ? -2.4 + 4.8 * (sweepT / SWEEP_DUR) : -99;
    if (stats.debug.sweepAt !== null) { sweeping = true; sweepPos = stats.debug.sweepAt; }
    logo.sweep.value = sweepPos;
    let lit = 0;
    const yaw = angle % (Math.PI * 2);
    for (const it of gl.items) {
      // 카메라 쪽을 보는 면만
      tmpP.copy(it.local); logo.mesh.localToWorld(tmpP); camera.worldToLocal(tmpP);           // 뷰 좌표
      tmpN.copy(it.local).add(it.normal); logo.mesh.localToWorld(tmpN); camera.worldToLocal(tmpN); tmpN.sub(tmpP);
      const facing = Math.max(0, Math.min(1, tmpN.z * 2.2));
      // 1) 빛이 모서리를 스치는 각도(한 바퀴에 한 번, 짧게): 폭 0.11 rad
      const d = angDiff(yaw, it.theta);
      const graze = Math.exp(-(d * d) / (0.11 * 0.11)) * it.amp * (0.75 + 0.25 * Math.sin(t * 0.17 + it.k));
      // 2) 빛줄기가 닿는 순간
      const sw = sweeping ? Math.max(0, 1 - Math.abs(tmpP.x * 0.82 + tmpP.y * 0.57 - sweepPos) / 0.5) : 0;
      const I = Math.min(1, Math.max(stats.debug.litAll ? 0.9 : graze, sw * sw * 0.95) * facing);
      gl.inten[it.k] = I; if (I > 0.25) lit++;
    }
    gl.points.geometry.attributes.aI.needsUpdate = true;
    stats.lit = lit; stats.sweep = sweeping;
  }
  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = (last && !stats.debug.freeze) ? Math.min((now - last) / 1000, 0.05) : 0; last = now; t += dt;
    const s = 0.5 + 0.5 * Math.sin(t * 0.38 + 0.8 * Math.sin(t * 0.17));
    const w = 0.16 + 1.0 * s * s;
    angle += w * dt;
    group.rotation.y = angle;
    group.rotation.x = 0.07 * Math.sin(t * 0.6);
    group.rotation.z = 0.03 * Math.sin(t * 0.47 + 1.0);
    group.position.y = 0.05 * Math.sin(t * 0.8);
    group.updateMatrixWorld(true);
    updateGlints();
    const r0 = performance.now();
    renderer.render(scene, camera);
    msAcc += performance.now() - r0; msN++; if (msN >= 60) { stats.renderMs = +(msAcc / msN).toFixed(2); msAcc = 0; msN = 0; }
    frames++; stats.frames = frames; stats.angle = angle; stats.seconds = (now - started) / 1000; stats.fps = stats.seconds > 0 ? frames / stats.seconds : 0; stats.dpr = renderer.getPixelRatio(); stats.size = cssSize;
    if (!stats.ready) { stats.ready = true; box.classList.add('is-3d'); }
    raf = requestAnimationFrame(frame);
  }
  function update() {
    const should = visible && document.visibilityState !== 'hidden';
    if (should && !running) { running = true; last = 0; if (!started) started = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }
  if (window.IntersectionObserver) {
    new IntersectionObserver((es) => { es.forEach((e) => { visible = e.isIntersecting; }); update(); }, { threshold: 0 }).observe(box);
  } else { visible = true; update(); }
  document.addEventListener('visibilitychange', update);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); running = false; box.classList.remove('is-3d'); }, false);
  canvas.addEventListener('webglcontextrestored', () => { update(); }, false);
  update();
  return { renderer, scene, stats };
}

init();
