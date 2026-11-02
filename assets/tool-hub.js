/* 도구 허브 검색 + 회원 표시(MAIN-V3-03, 메인 index.html #tools).
   · 검색: 입력 즉시 이름·설명·묶음으로 거름. 한글 초성('ㅅㄷ' → 수당…) 지원, 띄어쓰기로 여러 낱말(모두 포함). 빈 묶음은 숨김, 결과 수는 aria-live 로 읽힘.
   · DESIGN-DARK-03: 대표 도구 6개(.g-hub-key, 원래 묶음 이름은 data-group)와 '전체 도구 보기'(details.g-hub-all) 안 18개를 함께 찾는다.
     검색하는 동안은 접힌 목록을 펼쳐 두고, 검색어를 지우면 검색 전 접힘 상태로 되돌린다.
   · 회원: 이 기기에 인트라넷 로그인 세션(supabase-js 가 localStorage 에 두는 sb-*-auth-token)이 있으면 자물쇠를 떼고 카드 주소를 인트라넷(members/#…)으로 바꾼다.
     도구 주소·권한은 인트라넷이 서버(my_menu)에서 그대로 판정한다 — 여기서는 Supabase 를 부르지도, 권한을 판단하지도 않는다. 세션이 없으면 그대로 회원가입(members/#signup).
   · FUNC-FIX A4: 세션이 없을 때 자물쇠 카드를 누르면 가려던 칸을 localStorage 'pa_goto' 에 잠시 저장(로그인 후 인트라넷이 그 칸으로). */
(function () {
  var hub = document.querySelector('.g-hub');
  if (!hub) return;
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  var none = document.getElementById('hub-none');
  var cards = Array.prototype.slice.call(hub.querySelectorAll('.g-hub-card'));
  var groups = Array.prototype.slice.call(hub.querySelectorAll('.g-hub-group'));
  var keyBox = hub.querySelector('.g-hub-key'); // 대표 도구 6개(아래 세션 확인의 key 와 다른 이름)
  var all = hub.querySelector('.g-hub-all');   // '전체 도구 보기'(details) — 검색 중에는 펼침
  var wasOpen = null;                          // 검색 시작 전 접힘 상태(검색어를 지우면 되돌림)
  var total = cards.length;
  var base = count ? count.textContent : '';

  // 한글 초성 검색: 초성 글자는 그 초성으로 시작하는 모든 음절과 맞음, 나머지 글자는 그대로
  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  function choRx(word) {
    var out = '';
    for (var i = 0; i < word.length; i += 1) {
      var c = word[i], k = CHO.indexOf(c);
      if (k < 0) out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      else { var a = 0xAC00 + k * 588; out += '[' + c + String.fromCharCode(a) + '-' + String.fromCharCode(a + 587) + ']'; }
    }
    return new RegExp(out, 'i');
  }
  cards.forEach(function (card) {
    var g = card.closest('.g-hub-group');
    var gname = card.getAttribute('data-group') || (g ? g.getAttribute('data-group') || '' : ''); // 대표 카드는 원래 묶음 이름을 data-group 으로 가짐
    card.pbText = (card.textContent + ' ' + gname).replace(/\s+/g, ' ').toLowerCase();
  });

  function filter() {
    var k = (q.value || '').trim().toLowerCase();
    hub.classList.toggle('is-q', !!k);
    if (!k) {
      cards.forEach(function (c) { c.hidden = false; });
      groups.forEach(function (g) { g.hidden = false; });
      if (keyBox) keyBox.hidden = false;
      if (all && wasOpen !== null) { all.open = wasOpen; wasOpen = null; }
      if (count) count.textContent = base;
      if (none) none.hidden = true;
      return;
    }
    if (all && wasOpen === null) { wasOpen = all.open; all.open = true; }
    var terms = k.split(/\s+/).map(choRx);
    var found = 0;
    cards.forEach(function (c) {
      var ok = terms.every(function (rx) { return rx.test(c.pbText); });
      c.hidden = !ok; if (ok) found += 1;
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('.g-hub-card:not([hidden])');
    });
    if (keyBox) keyBox.hidden = !keyBox.querySelector('.g-hub-card:not([hidden])');
    if (count) count.textContent = found ? found + '개 찾음 (전체 ' + total + '개)' : '찾는 도구가 없습니다 (전체 ' + total + '개)';
    if (none) none.hidden = !!found;
  }
  if (q) {
    q.addEventListener('input', filter);
    q.addEventListener('search', filter);
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; filter(); } });
    if (q.value) filter();
  }

  // 로그인 세션이 이 기기에 있으면(인트라넷에서 로그인한 뒤) 자물쇠 없이 인트라넷으로
  var member = false;
  try {
    for (var i = 0; i < localStorage.length; i += 1) {
      var key = localStorage.key(i);
      if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
      var v = JSON.parse(localStorage.getItem(key) || 'null');
      if (v && v.access_token && (!v.expires_at || v.expires_at * 1000 > Date.now() - 86400000)) { member = true; break; }
    }
  } catch (e) { member = false; }
  // FUNC-FIX A4: 로그인 전 자물쇠 카드를 누르면 가려던 인트라넷 칸(data-in 의 #stats·#info…)을 이 기기에 잠시 저장 → 로그인 후 인트라넷이 그 칸으로 이동(30분 지나면 무시)
  if (!member) {
    cards.forEach(function (c) {
      var to = (c.getAttribute('data-in') || '').split('#')[1];
      if (!c.hasAttribute('data-member') || !to) return;
      c.addEventListener('click', function () { try { localStorage.setItem('pa_goto', JSON.stringify({ s: to, t: Date.now() })); } catch (e) {} });
    });
  }
  if (member) {
    hub.classList.add('is-member');
    cards.forEach(function (c) {
      if (!c.hasAttribute('data-member')) return;
      c.setAttribute('href', c.getAttribute('data-in') || 'members/');
      var sr = c.querySelector('.sr'); if (sr) sr.textContent = '인트라넷에서 열기';
    });
    var intro = hub.querySelector('.g-hub-intro');
    if (intro) {
      var p = intro.querySelector('p:not(.g-hub-intro__n)'); if (p) p.textContent = '로그인 세션이 있습니다. 누르면 인트라넷에서 엽니다.';
      var b = intro.querySelector('.g-btn'); if (b) { b.textContent = '인트라넷 열기'; b.setAttribute('href', 'members/'); }
    }
  }
})();
