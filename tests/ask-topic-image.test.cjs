const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/ask-images.js'), 'utf8'), { window, URL });
const get = (answer, question, sources = []) => window.PA_ASK_IMAGES.forAnswer({ answer, sources }, question);
const answer = '치아 보험 비교 시 청약서 고지사항, 크라운 치료 및 면책 기간을 확인하세요.';

test('related topic gets an original explainer, not a numbered evidence asset', () => {
  for (const question of ['간편고지 치아보험 추천', '치과 보험은 어떤 상품이 좋나요? 비교 부탁합니다', '유병자 치아 보험 알아봐줘']) {
    const images = get(answer, question);
    assert.equal(images.length, 1);
    assert.equal(images[0].sourceIndex, undefined);
    assert.match(images[0].caption, /참고용/);
    assert.match(fs.readFileSync(path.join(__dirname, '..', images[0].url.slice(1)), 'utf8'), /^<svg /);
  }
});
test('no unrelated decorative image when question or answer does not match', () => {
  assert.equal(get(answer, '실손보험 추천').length, 0);
  assert.equal(get('치아보험 자료를 찾지 못했습니다.', '간편고지 치아보험 추천').length, 0);
  assert.equal(get('실손보험 고지와 면책 기간 안내입니다.', '간편고지 치아보험 추천').length, 0);
  assert.equal(get(answer, '치아보험 청구서류는?').length, 0);
  assert.equal(get(answer, undefined).length, 0);
});
test('exact cited images remain available and take precedence over topic illustrations', () => {
  const sources = [{ url:'https://www.law.go.kr/LSW/flDownload.do?flSeq=169643557', page:1 }];
  const images = get(answer, '간편고지 치아보험 추천', sources);
  assert.equal(images.length, 1);
  assert.equal(images[0].sourceIndex, 1);
  assert.match(images[0].url, /nhis-form-169643557-p1.webp$/);
});
