/* 실적보드: #perf-data의 최신 누적 자료만 표시한다.
 * 월별 요약·그래프, 생보·손보, 보험사 Top 10. 서버 요청·원자료 변경 없음. */
(function () {
  'use strict';

  var doc = document;
  var numberFormat = new Intl.NumberFormat('ko-KR');
  function byId(id) { return doc.getElementById(id); }
  function all(selector, scope) { return Array.prototype.slice.call((scope || doc).querySelectorAll(selector)); }
  function put(id, value) { var el = byId(id); if (el) el.textContent = value; }
  function grouped(value) { return numberFormat.format(value); }
  function eok(value) { return (value / 100000).toFixed(2); }
  // 기존 금액 표시와 같은 백만원 단위 반올림을 유지한다.
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
  function validSeries(series) {
    return Array.isArray(series) && series.length > 0 && series.every(function (value) {
      return Number.isFinite(value) && value >= 0;
    });
  }
  function sum(series) { return series.reduce(function (total, value) { return total + value; }, 0); }

  function start() {
    try {
      var data = JSON.parse(byId('perf-data').textContent);
      var length = Array.isArray(data.months) ? data.months.length : 0;
      if (!length || !validSeries(data.total) || !validSeries(data.count_total) ||
          data.total.length !== length || data.count_total.length !== length) {
        throw new Error('Invalid performance source');
      }
      var chart = byId('pf-chart-bars');
      if (!chart) throw new Error('Missing performance chart');
      var year = String(data.period || '').match(/\d{4}년/);
      var period = (year ? year[0] + ' ' : '') + (length > 1 ? '1~' : '') + data.months[length - 1];
      var total = sum(data.total);
      var count = sum(data.count_total);
      var peak = data.total.indexOf(Math.max.apply(null, data.total));
      var cumulative = [];
      data.total.reduce(function (running, value, index) {
        cumulative[index] = running + value;
        return running + value;
      }, 0);

      put('pf-period-label', period);
      put('pf-chart-period', period);
      put('pf-total', money(total));
      put('pf-count', grouped(count));
      put('pf-average', money(total / length));
      put('pf-count-average', grouped(Math.round(count / length)));
      put('pf-months', String(length));
      put('pf-peak-value', money(data.total[peak]));
      put('pf-peak-month', data.months[peak]);

      // 새 월을 포함해 데이터에서 막대를 생성하고, 5억원을 넘는 값에도 눈금을 맞춘다.
      var ceiling = Math.max(500000, Math.ceil(data.total[peak] / 500000) * 500000);
      all('.pf-chart-axis span').forEach(function (label, index, labels) {
        var value = ceiling / 100000 * (labels.length - 1 - index) / (labels.length - 1);
        label.textContent = value ? grouped(value) + '억' : '0';
      });
      var fragment = doc.createDocumentFragment();
      var bars = data.months.map(function (label, index) {
        var bar = doc.createElement('button');
        bar.type = 'button';
        bar.className = 'pf-month-bar' + (index === peak ? ' is-peak' : '');
        bar.dataset.month = String(index + 1);
        // AUDIT-20261103: aria-label이 보이는 글자(막대 위 숫자·월)를 덮어써 '보이는 이름 = 읽는 이름'(WCAG 2.5.3)이 어긋나던 것을,
        // 보이는 글자는 그대로 두고 화면에 안 보이는 설명(.sr)을 뒤에 붙이는 방식으로 바꿈. 읽는 내용(월·금액·건수·누적)은 같다.
        bar.innerHTML = '<span class="pf-bar-value"></span><span class="pf-bar-track" aria-hidden="true"><span class="pf-bar-fill"></span></span><span class="pf-bar-label"></span><span class="sr"></span>';
        bar.querySelector('.pf-bar-value').textContent = eok(data.total[index]);
        bar.querySelector('.pf-bar-label').textContent = label;
        bar.querySelector('.sr').textContent = ' 월보험료 ' + grouped(data.total[index]) +
          '천원, 계약 ' + grouped(data.count_total[index]) + '건, 연초부터 누적 ' + grouped(cumulative[index]) + '천원';
        bar.querySelector('.pf-bar-fill').style.setProperty('--bar-height', (data.total[index] / ceiling * 100).toFixed(2) + '%');
        fragment.appendChild(bar);
        return bar;
      });
      chart.replaceChildren(fragment);
      chart.parentElement.style.minWidth = Math.max(240, length * 60 + 42) + 'px';

      function inspect(index) {
        put('pf-inspect-month', data.months[index]);
        put('pf-inspect-value', grouped(data.total[index]));
        put('pf-inspect-count', grouped(data.count_total[index]));
        put('pf-inspect-cumulative', money(cumulative[index]));
        bars.forEach(function (bar, barIndex) {
          bar.classList.toggle('is-active', barIndex === index);
          bar.setAttribute('aria-pressed', String(barIndex === index));
        });
      }
      bars.forEach(function (bar, index) {
        function show() { inspect(index); }
        bar.addEventListener('pointerenter', show);
        bar.addEventListener('focus', show);
        bar.addEventListener('click', show);
        bar.addEventListener('keydown', function (event) {
          var next = index;
          if (event.key === 'ArrowRight') next = Math.min(length - 1, index + 1);
          else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = length - 1;
          else if (event.key === 'Escape') { inspect(length - 1); return; }
          else return;
          event.preventDefault();
          bars[next].focus();
        });
      });
      chart.addEventListener('pointerleave', function () {
        if (!chart.contains(doc.activeElement)) inspect(length - 1);
      });
      inspect(length - 1);

      // 상세 자료는 자체 월별 배열에 있는 값만 누적한다. 없는 달의 값을 추정하지 않는다.
      function renderMix(box) {
        if (!validSeries(data.detail_life) || !validSeries(data.detail_nonlife)) return;
        var totals = { nonlife: sum(data.detail_nonlife), life: sum(data.detail_life) };
        var combined = totals.nonlife + totals.life;
        var circumference = 2 * Math.PI * 96;
        var rotation = -89.1;
        var description = [];
        ['nonlife', 'life'].forEach(function (key) {
          var button = box.querySelector('button[data-key="' + key + '"]');
          var segment = box.querySelector('circle[data-key="' + key + '"]');
          if (!button || !segment) return;
          var share = combined ? totals[key] / combined : 0;
          var pct = (share * 100).toFixed(1);
          button.dataset.pct = pct;
          button.querySelector('b').textContent = money(totals[key]);
          button.querySelector('em').textContent = pct + '%';
          var arc = Math.max(0, circumference * share - 3);
          segment.setAttribute('stroke-dasharray', arc.toFixed(2) + ' ' + circumference.toFixed(2));
          segment.setAttribute('transform', 'rotate(' + rotation.toFixed(2) + ' 120 120)');
          segment.style.setProperty('--len', arc.toFixed(2) + 'px');
          rotation += share * 360;
          description.push(button.dataset.label + ' ' + money(totals[key]) + ' ' + pct + '%');
          if (key === 'nonlife') box.querySelector('[data-pb-donut-pct]').textContent = pct;
        });
        box.querySelector('svg').setAttribute('aria-label', '생보·손보 구성: ' + description.join(', '));
      }
      function renderCarriers() {
        var list = doc.querySelector('#carriers .pb-chips');
        var template = list && list.querySelector('.pb-chip');
        if (!template || !data.carriers) return;
        var carriers = Object.keys(data.carriers).map(function (name) {
          var carrier = data.carriers[name];
          if (!validSeries(carrier.prem) || !validSeries(carrier.cnt)) throw new Error('Invalid carrier source');
          return { name: name, type: carrier.type, premium: sum(carrier.prem), count: sum(carrier.cnt) };
        }).sort(function (a, b) { return b.premium - a.premium; });
        var allPremium = carriers.reduce(function (value, carrier) { return value + carrier.premium; }, 0);
        var top = carriers.slice(0, 10);
        var topPremium = top.reduce(function (value, carrier) { return value + carrier.premium; }, 0);
        var items = doc.createDocumentFragment();
        top.forEach(function (carrier, index) {
          var item = template.cloneNode(true);
          item.classList.toggle('is-top', index < 3);
          item.style.setProperty('--i', String(index));
          item.style.setProperty('--s', (top[0].premium ? carrier.premium / top[0].premium * 100 : 0).toFixed(1) + '%');
          item.querySelector('.pb-chip__rank').textContent = String(index + 1).padStart(2, '0');
          item.querySelector('.pb-chip__name').textContent = carrier.name;
          item.querySelector('.pb-chip__val').textContent = money(carrier.premium);
          var meta = item.querySelector('.pb-chip__meta');
          var dot = meta.querySelector('i');
          var isLife = carrier.type === 'life';
          dot.className = 'pb-dot pb-dot--' + (isLife ? 'life' : 'nonlife');
          meta.replaceChildren(dot, doc.createTextNode((isLife ? '생보' : '손보') + ' · ' + grouped(carrier.count) + '건'));
          items.appendChild(item);
        });
        list.replaceChildren(items);
        doc.querySelector('[data-pb-stat="top10_eok2"]').textContent = money(topPremium);
        doc.querySelector('[data-pb-stat="top10_share"]').textContent = (allPremium ? topPremium / allPremium * 100 : 0).toFixed(1);
      }
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
          // AUDIT-20261103: 글자가 보이는 버튼은 보이는 글자(이름·금액·비율)를 그대로 읽게 하고 '강조'만 숨김 글자로 덧붙임(WCAG 2.5.3).
          // 글자가 없는 도넛 조각(SVG)은 지금처럼 aria-label.
          if (part.tagName === 'BUTTON' && part.textContent.trim()) {
            if (!part.querySelector('.sr')) { var hint = doc.createElement('span'); hint.className = 'sr'; hint.textContent = ' 강조'; part.appendChild(hint); }
          } else part.setAttribute('aria-label', part.dataset.label + ' ' + part.dataset.pct + '% 강조');
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

      all('[data-pb-donut]').forEach(function (box) { renderMix(box); initDonut(box); });
      renderCarriers();
    } catch (error) {
      var message = byId('pf-init-error');
      if (message) message.hidden = false;
      // 초기화 실패 시에도 HTML의 요약과 그래프는 남겨 둔다.
      console.error('실적보드를 불러오지 못했습니다.', error);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
