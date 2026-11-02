/* 도구 허브 검색 + 회원 표시(MAIN-V3-03, 메인 index.html #tools).
   · 검색: 입력 즉시 이름·설명·묶음으로 거름. 한글 초성('ㅅㄷ' → 수당…) 지원, 띄어쓰기로 여러 낱말(모두 포함). 빈 묶음은 숨김, 결과 수는 aria-live 로 읽힘.
   · 회원: 이 기기에 인트라넷 로그인 세션(supabase-js 가 localStorage 에 두는 sb-*-auth-token)이 있으면 자물쇠를 떼고 카드 주소를 인트라넷(members/#…)으로 바꾼다.
     도구 주소·권한은 인트라넷이 서버(my_menu)에서 그대로 판정한다 — 여기서는 Supabase 를 부르지도, 권한을 판단하지도 않는다. 세션이 없으면 그대로 회원가입(members/#signup). */
(function () {
  var hub = document.querySelector('.g-hub');
  if (!hub) return;
  var q = document.getElementById('hub-q');
  var count = document.getElementById('hub-count');
  var none = document.getElementById('hub-none');
  var cards = Array.prototype.slice.call(hub.querySelectorAll('.g-hub-card'));
  var groups = Array.prototype.slice.call(hub.querySelectorAll('.g-hub-group'));
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
    card.pbText = (card.textContent + ' ' + (g ? g.getAttribute('data-group') || '' : '')).replace(/\s+/g, ' ').toLowerCase();
  });

  function filter() {
    var k = (q.value || '').trim().toLowerCase();
    hub.classList.toggle('is-q', !!k);
    if (!k) {
      cards.forEach(function (c) { c.hidden = false; });
      groups.forEach(function (g) { g.hidden = false; });
      if (count) count.textContent = base;
      if (none) none.hidden = true;
      return;
    }
    var terms = k.split(/\s+/).map(choRx);
    var found = 0;
    cards.forEach(function (c) {
      var ok = terms.every(function (rx) { return rx.test(c.pbText); });
      c.hidden = !ok; if (ok) found += 1;
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('.g-hub-card:not([hidden])');
    });
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
