/* PAGES-V1 2: 실적보드 조회·비교·공유. 원자료는 페이지의 #perf-data만 사용한다.
 * 표시용 세션 확인은 home-member.js와 동일하며 접근 권한을 부여하지 않는다.
 * 서버 요청·데이터 쓰기·자동 순위 재생 없음. */
(function () {
  'use strict';

  var doc = document;
  var numberFormat = new Intl.NumberFormat('ko-KR');
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function byId(id) { return doc.getElementById(id); }
  function all(selector, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(selector)); }
  function put(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function grouped(value) { return numberFormat.format(value); }
  function eok(value) { return (value / 100000).toFixed(2); }
  // 기존 소수 둘째 자리 억 표시의 값을 백만원 단위까지 그대로 풀어 쓴다.
  function money(value) {
    var units = Math.round(Number(eok(value)) * 100);
    var whole = Math.floor(units / 100);
    var rest = units % 100;
    var thousand = Math.floor(rest / 10);
    var hundred = rest % 10;
    var parts = [];
    if (whole) parts.push(whole + '억');
    if (rest) parts.push((thousand ? thousand + '천' : '') + (hundred ? hundred + '백' : '') + '만원');
    return parts.join(' ') || '0원';
  }
  function signed(value) { return (value > 0 ? '+' : value < 0 ? '−' : '') + grouped(Math.abs(value)); }
  function percentage(diff, base) {
    if (!base) return diff ? '기준값 0: 증감률 계산 불가' : '0.0%';
    var value = diff / base * 100;
    return (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(1) + '%';
  }
  function hasStoredSession() {
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (!/^sb-[a-z0-9]+-auth-token$/.test(key)) continue;
        var value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value && value.access_token && (!value.expires_at || value.expires_at * 1000 > Date.now() - 86400000)) return true;
      }
    } catch (error) { return false; }
    return false;
  }
  function refreshMemberDisplay() { doc.body.classList.toggle('perf-member', hasStoredSession()); }

  function start() {
    refreshMemberDisplay();
    window.addEventListener('storage', function (event) {
      if (event.key === null || /^sb-[a-z0-9]+-auth-token$/.test(event.key)) refreshMemberDisplay();
    });
    window.addEventListener('pageshow', refreshMemberDisplay);

    try {
      var data = JSON.parse(byId('perf-data').textContent);
      var length = data.months.length;
      if (!length || !Array.isArray(data.total) || !Array.isArray(data.count_total) ||
          data.total.length !== length || data.count_total.length !== length ||
          !data.total.concat(data.count_total).every(function (value) { return Number.isFinite(value) && value >= 0; })) {
        throw new Error('Invalid performance source');
      }
      var fromControl = byId('pf-from');
      var toControl = byId('pf-to');
      var baseControl = byId('pf-base');
      var monthControl = byId('pf-month');
      var chart = byId('pf-chart-bars');
      if (!fromControl || !toControl || !baseControl || !monthControl || !chart) throw new Error('Missing performance controls');
      var bars = all('.pf-month-bar', chart);
      var statusTimer = 0;
      var clearStatusTimer = 0;
      var state = { from: 1, to: length, base: Math.max(1, length - 1), month: length, focus: false };
      var inspectedMonth = length;
      var cumulative = [];
      data.total.reduce(function (sum, value, index) { cumulative[index] = sum + value; return sum + value; }, 0);

      function announce(message) {
        window.clearTimeout(statusTimer);
        window.clearTimeout(clearStatusTimer);
        put('pf-status', '');
        statusTimer = window.setTimeout(function () {
          put('pf-status', message);
          clearStatusTimer = window.setTimeout(function () { put('pf-status', ''); }, 6000);
        }, 20);
      }
      function monthNumber(value, fallback) {
        if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) return fallback;
        var month = Number(value);
        return month >= 1 && month <= length ? month : fallback;
      }
      function readLocation() {
        var params = new URL(window.location.href).searchParams;
        var next = {
          from: monthNumber(params.get('from'), 1),
          to: monthNumber(params.get('to'), length),
          base: monthNumber(params.get('base'), Math.max(1, length - 1)),
          month: monthNumber(params.get('month'), length),
          focus: params.get('view') === 'focus'
        };
        if (next.from > next.to) { next.from = 1; next.to = length; }
        return next;
      }
      function stateUrl() {
        var url = new URL(window.location.href);
        url.searchParams.set('from', state.from);
        url.searchParams.set('to', state.to);
        url.searchParams.set('base', state.base);
        url.searchParams.set('month', state.month);
        if (state.focus) url.searchParams.set('view', 'focus');
        else url.searchParams.delete('view');
        return url;
      }
      function writeLocation(replace) {
        var url = stateUrl();
        if (url.href === window.location.href) return;
        try { window.history[replace ? 'replaceState' : 'pushState'](null, '', url.href); }
        catch (error) { /* 파일 미리보기 등 History API 미지원 환경에서도 조회 기능은 유지한다. */ }
      }
      function periodLabel() { return '2026년 ' + state.from + (state.from === state.to ? '' : '~' + state.to) + '월'; }
      function selectedStats() {
        var sum = 0;
        var count = 0;
        var peak = state.from;
        for (var month = state.from; month <= state.to; month += 1) {
          sum += data.total[month - 1];
          count += data.count_total[month - 1];
          if (data.total[month - 1] > data.total[peak - 1]) peak = month;
        }
        var months = state.to - state.from + 1;
        return { sum: sum, count: count, months: months, average: sum / months, countAverage: count / months, peak: peak };
      }
      function compareStats() {
        var basePrem = data.total[state.base - 1];
        var currentPrem = data.total[state.month - 1];
        var baseCount = data.count_total[state.base - 1];
        var currentCount = data.count_total[state.month - 1];
        return { basePrem: basePrem, currentPrem: currentPrem, premDiff: currentPrem - basePrem,
          baseCount: baseCount, currentCount: currentCount, countDiff: currentCount - baseCount };
      }
      function inspect(month) {
        inspectedMonth = Math.max(state.from, Math.min(state.to, month));
        put('pf-inspect-month', inspectedMonth + '월');
        put('pf-inspect-value', grouped(data.total[inspectedMonth - 1]));
        put('pf-inspect-count', grouped(data.count_total[inspectedMonth - 1]));
        put('pf-inspect-cumulative', money(cumulative[inspectedMonth - 1]));
        bars.forEach(function (bar) {
          var active = Number(bar.dataset.month) === inspectedMonth;
          bar.classList.toggle('is-active', active);
          bar.setAttribute('aria-pressed', String(active));
        });
      }
      function renderFocus() {
        doc.body.classList.toggle('perf-focus', state.focus);
        var button = byId('pf-focus');
        if (button) {
          button.setAttribute('aria-pressed', String(state.focus));
          button.textContent = state.focus ? '전체 화면 구성 보기' : '집중 보기';
        }
      }
      function render() {
        var stats = selectedStats();
        var compare = compareStats();
        fromControl.value = String(state.from);
        toControl.value = String(state.to);
        baseControl.value = String(state.base);
        monthControl.value = String(state.month);
        put('pf-period-label', periodLabel());
        put('pf-chart-period', periodLabel());
        put('pf-total', money(stats.sum));
        put('pf-count', grouped(stats.count));
        put('pf-average', money(stats.average));
        put('pf-count-average', grouped(Math.round(stats.countAverage)));
        put('pf-months', String(stats.months));
        put('pf-peak-value', money(data.total[stats.peak - 1]));
        put('pf-peak-month', stats.peak + '월');
        bars.forEach(function (bar) {
          var month = Number(bar.dataset.month);
          var value = data.total[month - 1];
          bar.hidden = month < state.from || month > state.to;
          bar.classList.toggle('is-peak', month === stats.peak);
          var fill = bar.querySelector('.pf-bar-fill');
          var valueNode = bar.querySelector('.pf-bar-value');
          var labelNode = bar.querySelector('.pf-bar-label');
          // 화면의 세로축은 0~5억원으로 고정하여 기간을 바꿔도 같은 눈금으로 비교한다.
          var height = (value / 500000 * 100).toFixed(2) + '%';
          bar.style.setProperty('--bar-height', height);
          if (fill) fill.style.setProperty('--bar-height', height);
          if (valueNode) valueNode.textContent = eok(value);
          if (labelNode) labelNode.textContent = month + '월';
          bar.setAttribute('aria-label', month + '월 월납보험료 ' + grouped(value) + '천원, 계약 ' + grouped(data.count_total[month - 1]) + '건, 연초부터 누적 ' + grouped(cumulative[month - 1]) + '천원');
        });
        chart.style.setProperty('--pf-month-count', String(stats.months));
        if (chart.parentElement) chart.parentElement.style.minWidth = Math.max(240, stats.months * 52 + 42) + 'px';
        inspect(state.to);
        put('pf-compare-title', state.base + '월 → ' + state.month + '월 비교');
        all('.pf-compare-base-label').forEach(function (el) { el.textContent = state.base + '월'; });
        all('.pf-compare-current-label').forEach(function (el) { el.textContent = state.month + '월'; });
        put('pf-compare-prem-base', grouped(compare.basePrem) + '천원');
        put('pf-compare-prem-current', grouped(compare.currentPrem) + '천원');
        put('pf-compare-prem-diff', signed(compare.premDiff) + '천원 (' + percentage(compare.premDiff, compare.basePrem) + ')');
        put('pf-compare-count-base', grouped(compare.baseCount) + '건');
        put('pf-compare-count-current', grouped(compare.currentCount) + '건');
        put('pf-compare-count-diff', signed(compare.countDiff) + '건 (' + percentage(compare.countDiff, compare.baseCount) + ')');
        ['pf-compare-prem-diff', 'pf-compare-count-diff'].forEach(function (id, index) {
          var el = byId(id);
          if (el) el.dataset.direction = (index ? compare.countDiff : compare.premDiff) > 0 ? 'up' : (index ? compare.countDiff : compare.premDiff) < 0 ? 'down' : 'same';
        });
        all('[data-pf-preset]').forEach(function (button) {
          var preset = button.dataset.pfPreset;
          var active = preset === 'all' ? state.from === 1 && state.to === length :
            preset === 'latest' ? state.from === length && state.to === length : state.from === 7 && state.to === 9;
          button.setAttribute('aria-pressed', String(active));
        });
        put('pf-period-error', '');
        fromControl.removeAttribute('aria-invalid');
        toControl.removeAttribute('aria-invalid');
        renderFocus();
      }
      function changed(message) {
        render();
        writeLocation(false);
        var fallback = byId('pf-share-fallback');
        if (fallback) fallback.hidden = true;
        if (message) announce(message);
      }
      function focusView(enabled, moveFocus) {
        state.focus = enabled;
        renderFocus();
        writeLocation(false);
        var target = byId(enabled ? 'pf-focus-exit' : 'pf-focus');
        if (moveFocus && target) target.focus({ preventScroll: true });
        announce(enabled ? '집중 보기입니다. Escape 키 또는 전체 화면 구성 보기 버튼으로 돌아갈 수 있습니다.' : '전체 보기로 돌아왔습니다.');
      }
      function summary() {
        var stats = selectedStats();
        var compare = compareStats();
        return [
          '프리미엄사업부 실적보드',
          '조회 기간: ' + periodLabel() + ' (' + stats.months + '개월)',
          '월납보험료 합계: ' + money(stats.sum),
          '계약건수 합계: ' + grouped(stats.count) + '건',
          '월평균 월납보험료: ' + money(stats.average),
          '선택 기간 최고 월: ' + stats.peak + '월 ' + grouped(data.total[stats.peak - 1]) + '천원',
          '월 비교: 기준 ' + state.base + '월 → 비교 ' + state.month + '월',
          '월납보험료: ' + grouped(compare.basePrem) + ' → ' + grouped(compare.currentPrem) + '천원 / 차이 ' + signed(compare.premDiff) + '천원 (' + percentage(compare.premDiff, compare.basePrem) + ')',
          '계약건수: ' + grouped(compare.baseCount) + ' → ' + grouped(compare.currentCount) + '건 / 차이 ' + signed(compare.countDiff) + '건 (' + percentage(compare.countDiff, compare.baseCount) + ')',
          '팜스 마감 기준',
          '현재 화면: ' + stateUrl().href
        ].join('\n');
      }
      async function copyText(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          try { await navigator.clipboard.writeText(text); return true; } catch (error) { /* 구형/차단 환경에서는 선택 영역으로 복사한다. */ }
        }
        var previous = doc.activeElement;
        var textarea = doc.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.setAttribute('aria-label', '복사할 내용');
        textarea.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;opacity:0';
        doc.body.appendChild(textarea);
        textarea.select();
        var copied = false;
        try { copied = !!doc.execCommand('copy'); } catch (error) { copied = false; }
        textarea.remove();
        if (previous && previous.focus) previous.focus({ preventScroll: true });
        return copied;
      }
      function manualCopy(text, isSummary) {
        var fallback = byId('pf-share-fallback');
        var input = byId('pf-share-url');
        if (!fallback || !input) { announce('복사가 제한되어 있습니다. 브라우저 주소를 복사해 주세요.'); return; }
        fallback.hidden = false;
        input.value = text;
        input.hidden = false;
        var label = byId('pf-manual-copy-label');
        if (!label) {
          label = doc.createElement('p');
          label.id = 'pf-manual-copy-label';
          fallback.appendChild(label);
        }
        label.textContent = isSummary ? '요약을 선택했습니다. 복사 명령을 눌러 주세요.' : '현재 화면 링크를 선택했습니다. 복사 명령을 눌러 주세요.';
        input.rows = isSummary ? 10 : 4;
        input.setAttribute('aria-label', isSummary ? '수동 복사용 실적 요약' : '수동 복사용 현재 보기 링크');
        input.focus();
        input.select();
        announce('자동 복사가 제한되어 수동 복사란을 열었습니다.');
      }
      function action(id, fn) { var el = byId(id); if (el) el.addEventListener('click', fn); }
      function applyPeriod(event) {
        event.preventDefault();
        var from = monthNumber(fromControl.value, 0);
        var to = monthNumber(toControl.value, 0);
        if (!from || !to || from > to) {
          put('pf-period-error', '시작 월은 마지막 월보다 같거나 앞서야 합니다. 1~' + length + '월 안에서 선택해 주세요.');
          fromControl.setAttribute('aria-invalid', 'true');
          toControl.setAttribute('aria-invalid', 'true');
          fromControl.focus();
          return;
        }
        state.from = from;
        state.to = to;
        changed(periodLabel() + ' 조회 결과로 갱신했습니다.');
      }
      action('pf-apply', applyPeriod);
      var periodForm = byId('pf-period-form');
      if (periodForm) periodForm.addEventListener('submit', applyPeriod);
      all('[data-pf-preset]').forEach(function (button) {
        button.addEventListener('click', function () {
          state.from = button.dataset.pfPreset === 'latest' ? length : button.dataset.pfPreset === 'quarter' ? 7 : 1;
          state.to = button.dataset.pfPreset === 'quarter' ? 9 : length;
          changed(periodLabel() + ' 조회 결과로 갱신했습니다.');
        });
      });
      [baseControl, monthControl].forEach(function (control) {
        control.addEventListener('change', function () {
          state.base = monthNumber(baseControl.value, state.base);
          state.month = monthNumber(monthControl.value, state.month);
          changed(state.base + '월을 기준으로 ' + state.month + '월을 비교합니다.');
        });
      });
      bars.forEach(function (bar) {
        function show() { inspect(Number(bar.dataset.month)); }
        bar.addEventListener('pointerenter', show);
        bar.addEventListener('focus', show);
        bar.addEventListener('click', show);
        bar.addEventListener('keydown', function (event) {
          var month = Number(bar.dataset.month);
          if (event.key === 'ArrowRight') month = Math.min(state.to, month + 1);
          else if (event.key === 'ArrowLeft') month = Math.max(state.from, month - 1);
          else if (event.key === 'Home') month = state.from;
          else if (event.key === 'End') month = state.to;
          else if (event.key === 'Escape') { inspect(state.to); return; }
          else return;
          event.preventDefault();
          var next = bars.find(function (el) { return Number(el.dataset.month) === month; });
          if (next) next.focus();
        });
      });
      chart.addEventListener('pointerleave', function () {
        if (!chart.contains(doc.activeElement)) inspect(state.to);
      });
      action('pf-focus', function () { focusView(!state.focus, true); });
      action('pf-focus-exit', function () { focusView(false, true); });
      doc.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          inspect(state.to);
          var fallback = byId('pf-share-fallback');
          if (fallback && !fallback.hidden) {
            var returnButton = byId('pf-share');
            var heldFocus = fallback.contains(doc.activeElement);
            fallback.hidden = true;
            if (heldFocus && returnButton) returnButton.focus();
          }
          if (state.focus) focusView(false, true);
        }
      });
      action('pf-copy', async function () {
        var text = summary();
        if (await copyText(text)) announce('실적 요약을 복사했습니다.');
        else manualCopy(text, true);
      });
      action('pf-share', async function () {
        var url = stateUrl().href;
        if (navigator.share) {
          try { await navigator.share({ title: '프리미엄사업부 실적보드', text: periodLabel() + ' · 기준 ' + state.base + '월 / 비교 ' + state.month + '월', url: url }); announce('현재 화면을 공유했습니다.'); return; }
          catch (error) { if (error && error.name === 'AbortError') { announce('공유를 취소했습니다.'); return; } }
        }
        if (await copyText(url)) announce('기간·비교 월·보기 방식이 담긴 현재 화면 링크를 복사했습니다.');
        else manualCopy(url, false);
      });
      action('pf-print', function () {
        try { window.print(); } catch (error) { announce('브라우저 메뉴에서 인쇄를 선택해 주세요.'); }
      });

      function roundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        ctx.fill();
      }
      function wrapText(ctx, text, x, y, maxWidth, lineHeight, measureOnly) {
        var line = '';
        Array.from(text).forEach(function (character) {
          if (ctx.measureText(line + character).width > maxWidth && line) {
            if (!measureOnly) ctx.fillText(line, x, y);
            y += lineHeight;
            line = character;
          } else line += character;
        });
        if (line && !measureOnly) ctx.fillText(line, x, y);
        return y + lineHeight;
      }
      async function saveImage() {
        var button = byId('pf-image');
        if (button) button.disabled = true;
        announce('선택한 조회 결과를 이미지로 만들고 있습니다.');
        try {
          var stats = selectedStats();
          var compare = compareStats();
          var canvas = doc.createElement('canvas');
          canvas.width = 1600;
          canvas.height = 1400;
          var ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          var ink = '#f2eee6';
          var muted = '#aab4c4';
          var gold = '#d6b97e';
          var font = '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
          var footer = [
            { text: '팜스 마감 기준', gap: 0 },
            { text: '현재 보기: ' + stateUrl().href, gap: 10, link: true }
          ];
          // 공유 URL의 실제 줄 수부터 측정하여 긴 주소도 잘리지 않게 한다.
          var footerBottom = 1103;
          footer.forEach(function (line) {
            ctx.font = '400 ' + (line.link ? 18 : 19) + 'px ' + font;
            footerBottom = wrapText(ctx, line.text, 72, footerBottom + line.gap, 1456, line.link ? 27 : 29, true);
          });
          canvas.height = Math.max(1400, Math.ceil(footerBottom + 50));
          ctx.fillStyle = '#070a12';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = gold;
          ctx.font = '600 21px ' + font;
          ctx.fillText('PREMIUM DIVISION / PERFORMANCE', 72, 68);
          ctx.fillStyle = muted;
          ctx.font = '400 18px ' + font;
          ctx.textAlign = 'right';
          ctx.fillText('테스트 페이지 — 정식 오픈 전 확인용', 1528, 68);
          ctx.textAlign = 'left';
          ctx.fillStyle = ink;
          ctx.font = '700 48px ' + font;
          ctx.fillText('프리미엄사업부 실적보드', 72, 137);
          ctx.font = '500 25px ' + font;
          ctx.fillStyle = muted;
          ctx.fillText(periodLabel() + ' · 월납보험료 / 계약건수', 72, 183);
          var cards = [
            ['선택 기간 월납보험료', money(stats.sum), periodLabel()],
            ['계약건수 합계', grouped(stats.count) + '건', stats.months + '개월 합계'],
            ['월평균 월납보험료', money(stats.average), stats.months + '개월 평균']
          ];
          cards.forEach(function (card, index) {
            var x = 72 + index * 494;
            ctx.fillStyle = '#0c111c';
            roundedRect(ctx, x, 220, 468, 170, 18);
            ctx.fillStyle = muted;
            ctx.font = '500 22px ' + font;
            ctx.fillText(card[0], x + 28, 258);
            ctx.fillStyle = index === 0 ? gold : ink;
            ctx.font = '700 43px ' + font;
            ctx.fillText(card[1], x + 28, 318, 412);
            ctx.fillStyle = muted;
            ctx.font = '400 21px ' + font;
            ctx.fillText(card[2], x + 28, 358);
          });
          ctx.fillStyle = ink;
          ctx.font = '600 27px ' + font;
          ctx.fillText('월별 월납보험료', 72, 447);
          ctx.fillStyle = muted;
          ctx.font = '400 20px ' + font;
          ctx.fillText('단위: 억원', 72, 480);
          var max = data.total[stats.peak - 1];
          var chartX = 104;
          var chartWidth = 1380;
          var chartBase = 780;
          var chartHeight = 235;
          ctx.strokeStyle = '#30394a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(chartX, chartBase);
          ctx.lineTo(chartX + chartWidth, chartBase);
          ctx.stroke();
          for (var month = state.from; month <= state.to; month += 1) {
            var slot = chartWidth / stats.months;
            var width = Math.min(86, slot * 0.62);
            var x = chartX + slot * (month - state.from + 0.5);
            var height = max ? data.total[month - 1] / max * chartHeight : 0;
            ctx.fillStyle = month === stats.peak ? gold : '#65758b';
            roundedRect(ctx, x - width / 2, chartBase - height, width, Math.max(1, height), 6);
            ctx.textAlign = 'center';
            ctx.fillStyle = ink;
            ctx.font = '600 23px ' + font;
            ctx.fillText(eok(data.total[month - 1]), x, chartBase - height - 18);
            ctx.fillStyle = muted;
            ctx.font = '400 22px ' + font;
            ctx.fillText(month + '월', x, chartBase + 36);
          }
          ctx.textAlign = 'left';
          ctx.fillStyle = '#0c111c';
          roundedRect(ctx, 72, 854, 1456, 205, 18);
          ctx.fillStyle = ink;
          ctx.font = '600 27px ' + font;
          ctx.fillText('월 비교  ·  기준 ' + state.base + '월 → 비교 ' + state.month + '월', 100, 898);
          ctx.font = '400 23px ' + font;
          ctx.fillStyle = muted;
          ctx.fillText('월납보험료   ' + grouped(compare.basePrem) + ' → ' + grouped(compare.currentPrem) + '천원', 100, 949);
          ctx.fillText('계약건수      ' + grouped(compare.baseCount) + ' → ' + grouped(compare.currentCount) + '건', 100, 995);
          ctx.fillStyle = gold;
          ctx.fillText('차이 ' + signed(compare.premDiff) + '천원 (' + percentage(compare.premDiff, compare.basePrem) + ')', 930, 949);
          ctx.fillText('차이 ' + signed(compare.countDiff) + '건 (' + percentage(compare.countDiff, compare.baseCount) + ')', 930, 995);
          var y = 1103;
          footer.forEach(function (line) {
            ctx.fillStyle = line.link ? gold : muted;
            ctx.font = '400 ' + (line.link ? 18 : 19) + 'px ' + font;
            y = wrapText(ctx, line.text, 72, y + line.gap, 1456, line.link ? 27 : 29);
          });
          var blob = await new Promise(function (resolve, reject) {
            canvas.toBlob(function (result) { if (result) resolve(result); else reject(new Error('Image export unavailable')); }, 'image/png');
          });
          var url = URL.createObjectURL(blob);
          var anchor = doc.createElement('a');
          anchor.href = url;
          anchor.download = '프리미엄사업부_2026_' + state.from + '-' + state.to + '월_비교' + state.base + '-' + state.month + '월.png';
          doc.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
          announce('실적 PNG 이미지 저장을 시작했습니다.');
        } catch (error) {
          announce('이미지를 저장하지 못했습니다. 브라우저의 인쇄 또는 요약 복사를 이용해 주세요.');
        } finally { if (button) button.disabled = false; }
      }
      action('pf-image', saveImage);

      function initDonut(box) {
        var pct = box.querySelector('[data-pb-donut-pct]');
        var label = box.querySelector('[data-pb-donut-label]');
        if (!pct || !label) return;
        var originalPct = pct.textContent;
        var originalLabel = label.textContent;
        var parts = all('[data-key]', box);
        var pinned = null;
        function show(key) {
          var source = parts.find(function (part) { return part.dataset.key === key && part.hasAttribute('data-pct'); });
          parts.forEach(function (part) {
            part.classList.toggle('is-active', part.dataset.key === key);
            if (part.hasAttribute('data-pct')) part.setAttribute('aria-pressed', String(part.dataset.key === pinned));
          });
          box.classList.toggle('is-hover', !!key);
          pct.textContent = source ? source.dataset.pct : originalPct;
          label.textContent = source ? source.dataset.label : originalLabel;
        }
        parts.forEach(function (part) {
          var key = part.dataset.key;
          part.addEventListener('pointerenter', function () { show(key); });
          part.addEventListener('pointerleave', function () { show(pinned); });
          if (!part.hasAttribute('data-pct')) return;
          if (part.tagName !== 'BUTTON') { part.setAttribute('role', 'button'); part.tabIndex = 0; }
          part.setAttribute('aria-pressed', 'false');
          part.setAttribute('aria-label', part.dataset.label + ' ' + part.dataset.pct + '% 강조');
          part.addEventListener('focus', function () { show(key); });
          part.addEventListener('blur', function () { show(pinned); });
          part.addEventListener('click', function () { pinned = pinned === key ? null : key; show(pinned); });
          part.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') { pinned = null; show(null); }
            else if (part.tagName !== 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault(); pinned = pinned === key ? null : key; show(pinned);
            }
          });
        });
      }
      function initRank(block) {
        var list = block.querySelector('[data-pb-race-list]');
        var select = byId('pf-rank-month');
        var replay = block.querySelector('[data-pb-race-replay]');
        var months = data.detail_months;
        if (!list || !months || !months.length || !data.branches) return;
        var items = all('li[data-name]', list).map(function (row, index) {
          var series = data.branches[row.dataset.name];
          if (!Array.isArray(series) || series.length !== months.length) throw new Error('Invalid branch source');
          var sums = [];
          series.reduce(function (sum, value, i) { sums[i] = sum + value; return sum + value; }, 0);
          var rank = row.querySelector('.pb-race__rank b');
          var value = row.querySelector('.pb-race__val');
          return { row: row, sums: sums, rank: rank, value: value, order: index,
            finalRank: rank.textContent, finalValue: value.textContent,
            finalR: row.style.getPropertyValue('--r'), finalW: row.style.getPropertyValue('--w') };
        });
        var timer = 0;
        var playing = false;
        var current = months.length;
        var progress = block.querySelector('[data-pb-race-progress]');
        function setPlaying(enabled) {
          playing = enabled;
          block.classList.toggle('is-racing', enabled);
          if (replay) {
            replay.textContent = enabled ? '재생 멈추기' : '누적 흐름 재생';
            replay.setAttribute('aria-label', enabled ? '본부 누적 흐름 재생 멈추기' : '1월부터 9월까지 본부 누적 흐름 재생');
            replay.setAttribute('aria-pressed', String(enabled));
          }
        }
        function stop() { window.clearTimeout(timer); setPlaying(false); }
        function display(month) {
          current = month;
          if (select) select.value = String(month);
          var sorted = items.slice().sort(function (a, b) { return b.sums[month - 1] - a.sums[month - 1] || a.order - b.order; });
          var max = sorted.length ? sorted[0].sums[month - 1] : 0;
          sorted.forEach(function (item, index) {
            var final = month === months.length;
            item.row.style.setProperty('--r', final ? item.finalR : String(index));
            item.row.style.setProperty('--w', final ? item.finalW : (max ? item.sums[month - 1] / max * 100 : 0).toFixed(2) + '%');
            item.rank.textContent = final ? item.finalRank : String(index + 1);
            item.value.textContent = final ? item.finalValue : money(item.sums[month - 1]);
            list.appendChild(item.row);
          });
          if (progress) progress.style.width = (month / months.length * 100).toFixed(2) + '%';
          var rankPeriod = '2026년 ' + (month === 1 ? '1' : '1~' + month) + '월';
          list.setAttribute('aria-label', '본부별 ' + rankPeriod + ' 누적 월보험료 순위');
          put('pf-rank-state', rankPeriod);
        }
        if (select) select.addEventListener('change', function () {
          var value = Number(select.value);
          if (!Number.isInteger(value) || value < 1 || value > months.length) return;
          stop(); display(value);
        });
        if (replay) replay.addEventListener('click', function () {
          if (playing) { stop(); display(current); return; }
          if (motion && motion.matches) {
            stop(); display(months.length);
            announce('동작 줄이기 설정에 따라 9월 누적 최종값을 바로 표시합니다.');
            return;
          }
          setPlaying(true);
          display(1);
          function advance() {
            if (!playing) return;
            if (current >= months.length) { stop(); display(months.length); return; }
            display(current + 1);
            timer = window.setTimeout(advance, 950);
          }
          timer = window.setTimeout(advance, 950);
        });
        doc.addEventListener('visibilitychange', function () { if (doc.hidden && playing) { stop(); display(current); } });
        window.addEventListener('pagehide', stop);
        if (motion && motion.addEventListener) motion.addEventListener('change', function (event) {
          if (event.matches && playing) { stop(); display(months.length); }
        });
        setPlaying(false);
        display(months.length);
      }

      doc.documentElement.classList.remove('pb-anim');
      doc.documentElement.classList.add('pb-ready');
      all('[data-pb-play]').forEach(function (el) { el.classList.add('is-play', 'is-done'); });
      all('[data-pb-reveal]').forEach(function (el) { el.classList.add('is-in'); });
      all('[data-pb-donut]').forEach(initDonut);
      all('[data-pb-race]').forEach(initRank);
      state = readLocation();
      render();
      writeLocation(true);
      all('[data-pf-js]').forEach(function (el) { el.hidden = false; });
      var enhancements = byId('pf-enhancements');
      if (enhancements) enhancements.hidden = false;
      window.addEventListener('popstate', function () { state = readLocation(); render(); announce('이전 조회 조건을 불러왔습니다.'); });
    } catch (error) {
      var message = byId('pf-init-error');
      if (message) message.hidden = false;
      doc.body.classList.remove('perf-focus');
      doc.documentElement.classList.remove('pb-anim');
      // 정적 원자료와 이동 링크는 계속 사용할 수 있도록 그대로 남긴다.
      console.error('실적보드 조회 도구를 시작하지 못했습니다.', error);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
