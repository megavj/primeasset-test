const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../assets/ask-images.js'), 'utf8');
const window = {};
vm.runInNewContext(script, { window, URL });
const resolve = sources => JSON.parse(JSON.stringify(window.PA_ASK_IMAGES.forSources(sources)));
const form = 'https://www.law.go.kr/LSW/flDownload.do?flSeq=169643557';
const oxygen = 'https://law.go.kr/flDownload.do?bylClsCd=110202&flSeq=167381107';
const paths = items => items.map(i => i.url.split('/').at(-1));

test('only exact versioned cited forms: original pages are stored and ordered', () => {
  const items = resolve([{url: form, page: ''}, {url: oxygen, page: ''}, {url: form}]);
  assert.deepEqual(paths(items), ['nhis-form-169643557-p1.webp', 'nhis-form-169643557-p2.webp', 'nhis-form-167381107-p1.webp', 'nhis-form-167381107-p2.webp']);
  assert.deepEqual(items.map(i => i.sourceIndex), [1,1,2,2]);
  for (const {url} of items) assert.equal(fs.readFileSync(path.join(__dirname, '..', url.slice(1))).subarray(8,12).toString(), 'WEBP');
});
test('exact page or entire cited PDF, never approximation or unknown materials', () => {
  assert.deepEqual(paths(resolve([{url: form, page: 2}])), ['nhis-form-169643557-p2.webp']);
  assert.deepEqual(paths(resolve([{url: form + '#page=2'}])), ['nhis-form-169643557-p2.webp']);
  const rejected = [null, {}, {url: form, page:'3'}, {url: form+'#page=2', page:'1'},
    {url: form+'#unrelated'}, {url: form.replace('169643557','167643557')}, {url: form+'&flSeq=111'},
    {url: form+'&redirect=https://example.invalid'}, {url: form.replace('www.law.go.kr','law.go.kr.example.invalid')},
    {url: form.replace('/LSW/flDownload.do','/other')}, {url: form.replace('https:','http:')},
    {url: form.replace('www.law.go.kr','any@www.law.go.kr')}, {url:'', title:'요양비 지급청구서'}];
  assert.deepEqual(resolve(rejected), []);
  assert.deepEqual(resolve(undefined), []);
});
