/* 프라임에셋 프리미엄 — 첫 화면 실시간 3D 로고 (HOME-PLUS-20261102, 1번 항목)
   · 로고 SVG(assets/logo.svg와 같은 path)를 돌출(extrude)한 금속 재질 + 회전 속도가 느렸다 빨랐다 변하는 회전(부드러운 가감속)
   · 64개 서로 다른 색 반짝이는 파티클: 절반은 기울어진 궤도를 돌고, 절반은 로고 주위를 떠다님(모두 GPU 셰이더에서 계산)
   · 성능: 픽셀비 상한(휴대폰 1.5, PC 2), 화면 밖·다른 탭이면 멈춤, 첫 프레임이 그려진 뒤에만 정지 WebP를 숨김
   · 라이브러리: three.js r187 (MIT, assets/three/LICENSE.three.txt). 이 파일을 esbuild로 묶은 것이 logo3d.min.js (assets/three/README.md)
   · 켜는 조건(assets/three/logo3d-loader.js): WebGL 됨 + 움직임 줄이기 아님 + 데이터 절약 아님. 아니면 기존 WebP 그대로. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, ExtrudeGeometry, MeshPhysicalMaterial, Color,
  PMREMGenerator, Points, BufferGeometry, Float32BufferAttribute, ShaderMaterial, NormalBlending,
  DirectionalLight, ACESFilmicToneMapping, Box3, Vector3
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// assets/logo.svg 와 같은 외곽선(방패 + R 모노그램, evenodd 구멍 2개)
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212.5 235.73"><path fill="#000" fill-rule="evenodd" d="M0 0 L212.5 0 L212.5 174 L106.25 235.73 L65.7 212.17 L65.7 185.67 L106.25 209.23 L157.26 179.77 L121.72 136.6 L55.2 136.6 L55.2 206.07 L0 174 Z M22.2 21.5 L22.2 160.4 L32.5 166.38 L32.5 114.5 L103.53 114.5 L34.31 30.4 L123.4 30.4 A52.9 52.9 0 0 1 146.37 130.95 L177.08 168.26 L190.6 160.4 L190.6 21.5 Z M81.8 52.5 L131.59 112.99 A30.8 30.8 0 0 0 123.4 52.5 Z"/></svg>';

const PARTICLE_COUNT = 64;
// 서로 다른 색(밝은 바탕에서도 보이게 채도 높은 색만): 남색·파랑·하늘·보라·분홍·금·청록·주황
const PALETTE = [0x1e3a8a, 0x2563eb, 0x0ea5e9, 0x7c3aed, 0xec4899, 0xf59e0b, 0x14b8a6, 0xf97316, 0x8b5cf6, 0x06b6d4, 0xd946ef, 0xeab308];

const CSS = `
.g-hero-logo{position:relative}
.g-hero-logo canvas.g-hero-3d{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .6s ease;display:block}
@media (min-width:721px){.g-hero-logo canvas.g-hero-3d{filter:drop-shadow(0 24px 40px rgba(15,23,42,.18))}}
.g-hero-logo.is-3d canvas.g-hero-3d{opacity:1}
.g-hero-logo.is-3d img{opacity:0;transition:opacity .5s ease;animation:none}
@media (prefers-reduced-motion:reduce){.g-hero-logo canvas.g-hero-3d{display:none}.g-hero-logo.is-3d img{opacity:1}}
`;

function mulberry32(seed) { // 고정 난수: 새로 고쳐도 같은 파티클 배치
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function buildLogo() {
  const data = new SVGLoader().parse(LOGO_SVG);
  const shapes = [];
  data.paths.forEach((p) => { p.toShapes().forEach((s) => shapes.push(s)); }); // evenodd 구멍 처리(ShapePath.toShapes)
  const geo = new ExtrudeGeometry(shapes, { depth: 18, bevelEnabled: true, bevelThickness: 5, bevelSize: 4, bevelOffset: 0, bevelSegments: 5, curveSegments: 28 });
  geo.center();
  const box = new Box3().setFromBufferAttribute(geo.attributes.position);
  const size = new Vector3(); box.getSize(size);
  const s = 2.6 / size.y;           // 높이 2.6 단위로 정규화
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  const mat = new MeshPhysicalMaterial({
    color: new Color(0xd6b25c), metalness: 1.0, roughness: 0.24,
    clearcoat: 0.55, clearcoatRoughness: 0.06, envMapIntensity: 1.15, reflectivity: 0.9
  });
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = Math.PI;        // SVG 좌표(y 아래)를 화면 좌표(y 위)로
  return mesh;
}

function buildParticles() {
  const rnd = mulberry32(20261102);
  const n = PARTICLE_COUNT;
  const pos = new Float32Array(n * 3), orbit = new Float32Array(n * 4), phase = new Float32Array(n * 4), color = new Float32Array(n * 3), mode = new Float32Array(n), seed = new Float32Array(n * 3);
  const c = new Color();
  for (let i = 0; i < n; i++) {
    const isOrbit = i % 2 === 0;
    mode[i] = isOrbit ? 0 : 1;
    // 궤도: 반지름 1.6~2.9, 기울기 2축, 각속도 0.25~0.75 rad/s(방향 섞음)
    orbit[i * 4] = isOrbit ? 1.6 + rnd() * 1.3 : 0.35 + rnd() * 0.5;
    orbit[i * 4 + 1] = (rnd() - 0.5) * 2.4;
    orbit[i * 4 + 2] = (rnd() - 0.5) * 2.4;
    orbit[i * 4 + 3] = (0.25 + rnd() * 0.5) * (rnd() < 0.5 ? 1 : -1) * (isOrbit ? 1 : 1.6);
    phase[i * 4] = rnd() * Math.PI * 2;       // 시작 각
    phase[i * 4 + 1] = 1.5 + rnd() * 4.5;     // 반짝임 빠르기
    phase[i * 4 + 2] = rnd() * Math.PI * 2;   // 반짝임 위상
    phase[i * 4 + 3] = 16 + rnd() * 22;       // 크기(캔버스 크기에 비례해 셰이더에서 환산)
    c.setHex(PALETTE[i % PALETTE.length]);
    color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    // 떠다니는 쪽의 기준 위치(로고 주위 공 모양 껍질)
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), rr = 1.5 + rnd() * 1.3;
    seed[i * 3] = Math.sin(ph) * Math.cos(th) * rr; seed[i * 3 + 1] = Math.cos(ph) * rr * 0.8; seed[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * rr;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aOrbit', new Float32BufferAttribute(orbit, 4));
  geo.setAttribute('aPhase', new Float32BufferAttribute(phase, 4));
  geo.setAttribute('aColor', new Float32BufferAttribute(color, 3));
  geo.setAttribute('aMode', new Float32BufferAttribute(mode, 1));
  geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 3));
  geo.boundingSphere = null; geo.computeBoundingSphere(); geo.boundingSphere.radius = 4; // 셰이더에서 움직이므로 컬링 방지
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uScale: { value: 300 } },
    vertexShader: `
      uniform float uTime; uniform float uPixelRatio; uniform float uScale;
      attribute vec4 aOrbit; attribute vec4 aPhase; attribute vec3 aColor; attribute float aMode; attribute vec3 aSeed;
      varying vec3 vColor; varying float vTw;
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
      void main(){
        float r = aOrbit.x; float sp = aOrbit.w; float ang = aPhase.x + uTime * sp;
        vec3 p;
        if (aMode < 0.5) {
          p = vec3(cos(ang) * r, sin(ang) * r * 0.55, 0.0);
          p = rotX(aOrbit.y) * rotZ(aOrbit.z) * p;
          p.y += 0.12 * sin(uTime * 0.8 + aPhase.x);
        } else {
          p = aSeed + vec3(sin(uTime * sp + aPhase.x), sin(uTime * sp * 0.77 + aPhase.x * 1.7), sin(uTime * sp * 1.31 + aPhase.x * 0.6)) * r;
        }
        float tw = 0.5 + 0.5 * sin(uTime * aPhase.y + aPhase.z);
        tw = tw * tw * tw;
        vTw = tw; vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aPhase.w * (0.4 + 1.0 * tw) * uPixelRatio * (uScale / -mv.z) / 60.0;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      precision mediump float;
      varying vec3 vColor; varying float vTw;
      void main(){
        vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float core = smoothstep(0.5, 0.0, d); core *= core;
        float star = max(exp(-abs(uv.x) * 12.0) * exp(-abs(uv.y) * 70.0), exp(-abs(uv.y) * 12.0) * exp(-abs(uv.x) * 70.0));
        float halo = smoothstep(0.5, 0.12, d) * 0.35;
        float a = clamp(core * 1.3 + halo + star * vTw * 1.2, 0.0, 1.0);
        vec3 col = mix(vColor, vec3(1.0), core * core * 0.85 * vTw);
        gl_FragColor = vec4(col, a * (0.45 + 0.55 * vTw));
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: NormalBlending
  });
  return new Points(geo, mat);
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
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 7.4); camera.lookAt(0, 0, 0);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  const key = new DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const rim = new DirectionalLight(0xfff1c4, 0.9); rim.position.set(-4, -2, 3); scene.add(rim);
  const group = new Group(); const logo = buildLogo(); group.add(logo); scene.add(group);
  const particles = buildParticles(); scene.add(particles);
  const pMat = particles.material;

  // 크기: 그림(WebP) 표시 폭의 1.5배 정사각형(파티클이 로고 밖까지 돌 자리). 픽셀비 상한.
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
    pMat.uniforms.uPixelRatio.value = dpr;
    pMat.uniforms.uScale.value = size * 0.62;
  }
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(box); else window.addEventListener('resize', resize);

  // 회전: 각속도 w(t) = 0.22 + 1.5·s², s는 0~1 사이를 천천히 오가는 값 → 느렸다(약 29초/바퀴) 빨랐다(약 3.7초/바퀴) 부드럽게
  let t = 0, angle = 0, last = 0, running = false, visible = true, frames = 0, started = 0, raf = 0;
  const stats = { frames: 0, seconds: 0, fps: 0, ready: false, angle: 0, dpr: 0, size: 0, renderMs: 0 }; // renderMs: 최근 60프레임 평균 렌더 호출 시간(ms, CPU 쪽)
  let msAcc = 0, msN = 0;
  window.__logo3d = stats;
  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now; t += dt;
    const s = 0.5 + 0.5 * Math.sin(t * 0.42 + 0.8 * Math.sin(t * 0.19));
    const w = 0.22 + 1.5 * s * s;
    angle += w * dt;
    group.rotation.y = angle;
    group.rotation.x = 0.10 * Math.sin(t * 0.7);
    group.rotation.z = 0.04 * Math.sin(t * 0.53 + 1.0);
    group.position.y = 0.07 * Math.sin(t * 0.9);
    pMat.uniforms.uTime.value = t;
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
