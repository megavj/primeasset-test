# assets/three — 첫 화면 실시간 3D 로고 (HOME-PLUS-20261102)

| 파일 | 내용 |
|---|---|
| `logo3d-loader.js` | index.html 이 부르는 작은 스크립트. WebGL·움직임 줄이기·데이터 절약을 검사한 뒤 page load 후 `logo3d.min.js` 를 느리게 불러옴. 조건이 안 맞으면 기존 정지 WebP 그대로. `?no3d` 를 주소에 붙이면 강제로 끔. |
| `logo3d.min.js` | three.js **r187 (0.187.0, MIT)** 중 쓰는 부분 + `logo3d.src.js` 를 esbuild 로 묶어 압축한 ES 모듈(외부 요청 없음). |
| `logo3d.src.js` | 장면 소스(로고 돌출·금속 재질·가감속 회전·파티클 64개·화면 밖 정지). 고칠 때는 이 파일을 고치고 아래 명령으로 다시 묶는다. |
| `LICENSE.three.txt` | three.js MIT 라이선스 원문. |

다시 묶기(저장소 밖 임시 폴더에서):
```
npm install three@0.187.0 esbuild@0.25.0
cp <저장소>/assets/three/logo3d.src.js . && npx esbuild logo3d.src.js --bundle --minify --format=esm --target=es2020 --legal-comments=none --outfile=<저장소>/assets/three/logo3d.min.js
```
`assets/vendor/` 는 건드리지 않는다(별도 규칙).
