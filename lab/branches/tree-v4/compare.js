/* 시안 페이지(tree-v4) 전용 — '이전 시안 (v3)' 비교 섹션에 v3 부품(../tree-v3/growth-tree-v3.js)을 함께 그림
   두 부품 모두 [data-growth-tree] 자리를 찾아 그리므로 순서로 나눈다:
   ① growth-tree-v4.js 가 먼저 실행되어 위 자리만 차지 → ② 이 파일이 비교 자리에 data-growth-tree 를 붙임 → ③ growth-tree-v3.js 가 그 자리만 그림
   (v4 는 내부 이름이 gt4-, v3 는 gt3- 라서 스타일이 섞이지 않음). 이 파일은 index.html 에서 두 스크립트 사이에 둔다 */
document.querySelectorAll('[data-growth-tree-v3]').forEach(el => { el.setAttribute('data-growth-tree', ''); });
