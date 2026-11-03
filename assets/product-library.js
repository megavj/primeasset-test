/* Product reference panels. The existing question-queue API remains unchanged. */
(function () {
  'use strict';

  var ui;
  var newsLoaded = false;
  var nowLoaded = false;
  var newsSequence = 0;
  var nowSequence = 0;
  var detailSequence = 0;
  var excerptSequence = 0;
  var newsRequest = null;
  var nowRequest = null;
  var selectedInsurer = null;
  var newsletterSections = [
    ['주력·개정 상품', 'products'],
    ['시책·이벤트', 'incentives'],
    ['인수기준 변경', 'underwriting'],
    ['이달 바뀐 점·마감', 'changes'],
    ['설계사 화법 한 줄', 'agentTalk']
  ];

  function text(value) { return value == null ? '' : String(value); }
  function list(value) { return Array.isArray(value) ? value.filter(Boolean) : []; }
  function node(tag, className, value) { return ui.el(tag, className || '', text(value)); }
  function target(id) { return ui.byId(id); }
  function setText(id, value) { var item = target(id); if (item) item.textContent = text(value); }
  function notify(value) { if (ui.announce) ui.announce(value); }
  function message(host, value, error) {
    host.replaceChildren(node('p', error ? 'px-notice' : 'px-empty', value));
  }
  function errorMessage(error, fallback) {
    // Server errors can contain internal paths or provider diagnostics.
    return fallback + ' 연결 상태를 확인한 뒤 잠시 후 다시 시도해 주세요.';
  }
  function button(label, handler, className) {
    var item = node('button', 'px-btn' + (className ? ' ' + className : ''), label);
    item.type = 'button';
    item.addEventListener('click', function () {
      Promise.resolve().then(handler).catch(function () {
        notify('작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      });
    });
    return item;
  }
  function actionRow(copyText, title) {
    var row = node('div', 'px-actions');
    row.append(
      button('내용 복사', function () { return ui.copy(copyText); }),
      button('공유', function () { return ui.share(copyText, title); })
    );
    return row;
  }
  function section(title, count) {
    var wrapper = node('section', 'px-section');
    var heading = node('h3', '', title);
    if (count != null) heading.append(node('span', 'px-tag', text(count) + '건'));
    wrapper.append(heading);
    return wrapper;
  }
  function setBusy(host, busy) { host.setAttribute('aria-busy', String(busy)); }
  function processor(data) { if (data && data.processor && ui.processor) ui.processor(data.processor); }
  function clearDetail() {
    detailSequence += 1;
    var detail = target('nl-detail');
    if (detail) { detail.hidden = true; detail.replaceChildren(); setBusy(detail, false); }
    if (selectedInsurer) selectedInsurer.setAttribute('aria-pressed', 'false');
    selectedInsurer = null;
  }

  function loadNews(force) {
    if (!ui) return Promise.resolve();
    if (!force && newsRequest) return newsRequest;
    if (!force && newsLoaded) return Promise.resolve();
    var host = target('nl-list');
    if (!host) return Promise.resolve();
    var sequence = ++newsSequence;
    clearDetail();
    setBusy(host, true);
    setText('nl-month', '기준월 확인 중');
    message(host, '보험사별 소식지 정리본을 불러오는 중입니다.');
    var retry = target('news-retry');
    if (retry) retry.disabled = true;
    newsRequest = (async function () {
      try {
        var response = await ui.api('newsletter', { month: '' });
        if (sequence !== newsSequence) return;
        processor(response);
        if (!response || !response.ok) throw new Error(response && response.msg || '자료를 불러오지 못했습니다.');
        setText('nl-month', response.month ? '기준월 ' + response.month : '저장된 자료 없음');
        var insurers = list(response.insurers);
        if (!insurers.length) {
          message(host, response.msg || '저장된 소식지 정리본이 아직 없습니다. 새로고침으로 다시 확인할 수 있습니다.');
          newsLoaded = true;
          return;
        }
        var grid = node('div', 'px-grid');
        insurers.forEach(function (insurer) {
          var item = button('', function () { return openInsurer(insurer.name, response.month, item); }, 'px-card');
          item.setAttribute('aria-pressed', 'false');
          item.setAttribute('aria-controls', 'nl-detail');
          item.append(node('strong', '', insurer.name));
          var counts = insurer.counts || {};
          item.append(node('span', 'px-small px-muted', insurer.note ? '본문 텍스트 없음 · 원문 확인 필요' :
            '상품 ' + (counts.products || 0) + ' · 시책 ' + (counts.incentives || 0) + ' · 인수 ' + (counts.underwriting || 0) +
            (counts.changes ? ' · 변경 ' + counts.changes : '')));
          if (insurer.concept && insurer.concept.text) item.append(node('span', 'px-small', insurer.concept.text));
          grid.append(item);
        });
        host.replaceChildren(grid);
        newsLoaded = true;
        notify('보험사별 소식지 정리본을 불러왔습니다. 보험사를 선택해 주세요.');
      } catch (error) {
        if (sequence !== newsSequence) return;
        newsLoaded = false;
        setText('nl-month', '불러오기 실패');
        message(host, errorMessage(error, '소식지를 불러오지 못했습니다.'), true);
        host.append(button('다시 불러오기', function () { return loadNews(true); }));
      } finally {
        if (sequence === newsSequence) {
          newsRequest = null;
          setBusy(host, false);
          if (retry) retry.disabled = false;
        }
      }
    }());
    return newsRequest;
  }

  async function openInsurer(insurer, month, selectedButton) {
    var host = target('nl-detail');
    if (!host) return;
    var sequence = ++detailSequence;
    if (selectedInsurer) selectedInsurer.setAttribute('aria-pressed', 'false');
    selectedInsurer = selectedButton;
    if (selectedInsurer) selectedInsurer.setAttribute('aria-pressed', 'true');
    host.hidden = false;
    setBusy(host, true);
    message(host, text(insurer) + ' 소식지 정리본을 불러오는 중입니다.');
    ui.scroll(host);
    try {
      var response = await ui.api('newsletterInsurer', { month: month, insurer: insurer });
      if (sequence !== detailSequence) return;
      processor(response);
      if (!response || !response.ok) throw new Error(response && response.msg || '정리본을 불러오지 못했습니다.');
      renderInsurer(host, response, function () { return sequence === detailSequence && !host.hidden; });
      notify(text(response.insurer) + ' 소식지 정리본을 불러왔습니다.');
    } catch (error) {
      if (sequence !== detailSequence) return;
      message(host, errorMessage(error, '보험사 정리본을 열지 못했습니다.'), true);
      host.append(button('이 보험사 다시 불러오기', function () { return openInsurer(insurer, month, selectedButton); }));
    } finally {
      if (sequence === detailSequence) setBusy(host, false);
    }
  }

  function insurerText(response) {
    var summary = response.summary || {};
    var lines = ['【' + text(response.insurer) + ' ' + text(response.month) + ' 소식지 정리】'];
    if (summary.note) lines.push(text(summary.note));
    if (summary.concept) lines.push('한 줄 컨셉: ' + factText(summary.concept));
    newsletterSections.forEach(function (pair) {
      var items = list(summary[pair[1]]);
      if (!items.length) return;
      lines.push('', '■ ' + pair[0]);
      items.forEach(function (item) { lines.push('- ' + factText(item)); });
    });
    lines.push('', '원문 ' + (response.pages || 0) + '쪽 · 정리 ' + (response.lines || 0) + '줄');
    if (response.generatedAt) lines.push('생성 ' + response.generatedAt);
    if (list(summary.docs).length) lines.push('문서: ' + summary.docs.join(', '));
    lines.push('보험사 소식지를 Mac 내부검색에서 조회해 정리한 내용입니다. 실제 설계·고지 전에 원문과 전산을 확인하세요.');
    return lines.join('\n');
  }
  function factText(item) {
    return text(item.text) + (item.page ? ' (p.' + item.page + ')' : '') + (item.detail ? ' / ' + item.detail : '');
  }
  function renderInsurer(host, response, alive) {
    var summary = response.summary || {};
    var header = node('div', 'px-detail');
    header.append(node('h3', '', response.insurer), node('span', 'px-tag', '기준월 ' + text(response.month)));
    var metadata = ['원문 ' + (response.pages || 0) + '쪽', '정리 ' + (response.lines || 0) + '줄'];
    if (response.generatedAt) metadata.push('생성 ' + response.generatedAt);
    header.append(node('p', 'px-small px-muted', metadata.join(' · ')));
    if (list(summary.docs).length) header.append(node('p', 'px-source', '문서: ' + summary.docs.join(', ')));
    var actions = actionRow(insurerText(response), text(response.insurer) + ' 소식지 정리');
    actions.append(button('보험사 목록으로', function () {
      var previous = selectedInsurer;
      clearDetail();
      ui.scroll(target('nl-list'));
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    }));
    header.append(actions);
    host.replaceChildren(header);
    if (summary.note) host.append(node('p', 'px-notice', summary.note));
    if (summary.concept) {
      var concept = section('이달의 한 줄 컨셉');
      concept.append(fact(summary.concept, response.insurer, response.month, alive));
      host.append(concept);
    }
    newsletterSections.forEach(function (pair) {
      var items = list(summary[pair[1]]);
      if (!items.length) return;
      var group = section(pair[0], items.length);
      var facts = node('div', 'px-list');
      items.forEach(function (item) { facts.append(fact(item, response.insurer, response.month, alive)); });
      group.append(facts);
      host.append(group);
    });
    host.append(node('p', 'px-small px-muted', '보험사 소식지(' + text(response.month) + ') 기준입니다. 쪽 번호로 원문을 확인하세요.'));
  }
  function fact(item, insurer, month, alive) {
    var wrapper = node('div', 'px-source');
    wrapper.append(node('p', '', item.text));
    if (item.detail) wrapper.append(node('p', 'px-small px-muted', item.detail));
    if (item.page) addPageLookup(wrapper, insurer, month, item.page, alive);
    return wrapper;
  }

  function addPageLookup(host, insurer, month, page, alive) {
    var current = 0;
    var excerpt = null;
    var lookup = button('p.' + text(page) + ' 원문 보기', async function () {
      current += 1;
      var sequence = current;
      if (excerpt) {
        excerpt.remove();
        excerpt = null;
        lookup.setAttribute('aria-expanded', 'false');
        lookup.textContent = 'p.' + text(page) + ' 원문 보기';
        return;
      }
      excerpt = node('div', 'px-excerpt');
      excerpt.id = 'px-excerpt-' + (++excerptSequence);
      excerpt.setAttribute('role', 'status');
      excerpt.setAttribute('aria-live', 'polite');
      excerpt.textContent = 'Mac에서 원문을 조회하는 중입니다…';
      host.append(excerpt);
      lookup.setAttribute('aria-controls', excerpt.id);
      lookup.setAttribute('aria-expanded', 'true');
      lookup.textContent = '원문 접기';
      var output = excerpt;
      function active() { return sequence === current && output.isConnected && (!alive || alive()); }
      function finish(value, retry) {
        if (!active()) return;
        output.replaceChildren(node('p', '', value));
        if (retry) output.append(button('원문 다시 조회', function () {
          if (!active()) return;
          current += 1;
          output.remove();
          excerpt = null;
          lookup.setAttribute('aria-expanded', 'false');
          lookup.click();
        }));
      }
      try {
        var response = await ui.api('page', { insurer: insurer, month: month, page: page, doc: '' });
        if (!active()) return;
        processor(response);
        if (!response || !response.ok) throw new Error(response && response.msg || '원문 조회를 시작하지 못했습니다.');
        if (response.processor && !response.processor.online) {
          finish('Mac 처리기가 응답하지 않아요. 잠시 후 다시 시도해 주세요.', true);
          return;
        }
        if (!response.id) throw new Error('조회 번호를 받지 못했습니다. 다시 시도해 주세요.');
        var startedAt = Date.now();
        while (Date.now() - startedAt < 90000) {
          await new Promise(function (resolve) { window.setTimeout(resolve, 2500); });
          if (!active()) return;
          var status = await ui.api('status', { id: response.id });
          if (!active()) return;
          processor(status);
          if (!status || status.ok === false) throw new Error(status && status.msg || '조회 상태를 확인하지 못했습니다.');
          if (status.status === '완료') {
            var items = list(status.answer && status.answer.items);
            finish(items.length ? items.map(function (item) {
              return '[' + text(item.doc) + (item.page ? ' p.' + item.page : '') +
                (item.month ? ' · 기준월 ' + item.month : '') + ']\n' + text(item.text);
            }).join('\n\n') : '해당 쪽 원문을 찾지 못했습니다.', !items.length);
            return;
          }
          if (status.status === '오류') { finish('원문 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', true); return; }
          if (status.giveUp) { finish(status.notice || '잠시 후 다시 시도해 주세요.', true); return; }
        }
        finish('원문 조회에 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.', true);
      } catch (error) {
        finish(errorMessage(error, '원문을 불러오지 못했습니다.'), true);
      }
    }, 'px-small');
    lookup.setAttribute('aria-expanded', 'false');
    host.append(lookup);
  }

  function who(item) {
    var parts = item.kind === 'field' ? ['현장 · 비공식', item.date, item.source, item.insurer] :
      ['공식', item.insurer, item.page ? 'p.' + item.page : '', item.source];
    return parts.filter(Boolean).join(' · ');
  }
  function reportText(report) {
    var lines = ['【' + text(report.month) + ' 지금 중요한 내용!】', '', '■ 이번 달 바뀐 것 TOP 5'];
    list(report.top5).forEach(function (item, index) { lines.push((index + 1) + '. ' + text(item.text) + ' [' + who(item) + ']'); });
    function appendSection(title, items) {
      if (!items.length) return;
      lines.push('', '■ ' + title);
      items.forEach(function (item) { lines.push('- ' + text(item.text) + ' [' + who(item) + ']'); });
    }
    appendSection('이달의 흐름', list(report.flow));
    list(report.sections).forEach(function (item) { appendSection(text(item.title), list(item.items)); });
    appendSection('현장 소식(카톡 보험정보방)', list(report.field));
    lines.push('', reportMetadata(report), '현장 소식은 비공식 정보이므로 반드시 원수사 공지로 확인하세요.');
    return lines.join('\n');
  }
  function reportMetadata(report) {
    var counts = report.counts || {};
    return (report.generatedAt ? '생성 ' + report.generatedAt + ' · ' : '') + '소식지 ' + (counts.insurers || 0) +
      '개사 · 카톡방 자료 ' + (counts.kakao || 0) + '건';
  }
  function reportItem(item, report, alive, tagName) {
    var wrapper = node(tagName || 'div', 'px-source');
    wrapper.append(node('p', '', item.text), node('p', 'px-small px-muted', who(item)));
    if (item.kind !== 'field' && item.insurer && item.page) addPageLookup(wrapper, item.insurer, report.month, item.page, alive);
    return wrapper;
  }
  function loadNow(force) {
    if (!ui) return Promise.resolve();
    if (!force && nowRequest) return nowRequest;
    if (!force && nowLoaded) return Promise.resolve();
    var host = target('now-body');
    if (!host) return Promise.resolve();
    var sequence = ++nowSequence;
    setBusy(host, true);
    setText('now-month', '기준월 확인 중');
    message(host, '지금 중요한 내용을 불러오는 중입니다.');
    var retry = target('now-retry');
    if (retry) retry.disabled = true;
    nowRequest = (async function () {
      try {
        var response = await ui.api('now', { month: '' });
        if (sequence !== nowSequence) return;
        processor(response);
        if (!response || !response.ok) throw new Error(response && response.msg || '자료를 불러오지 못했습니다.');
        if (!response.report) {
          setText('now-month', '저장된 자료 없음');
          message(host, response.msg || '아직 생성된 지금 중요한 내용이 없습니다. 새로고침으로 다시 확인할 수 있습니다.');
          nowLoaded = true;
          return;
        }
        var report = response.report;
        setText('now-month', report.month ? '기준월 ' + report.month : '기준월 미제공');
        renderNow(host, report, function () { return sequence === nowSequence; });
        nowLoaded = true;
        notify('지금 중요한 내용을 불러왔습니다.');
      } catch (error) {
        if (sequence !== nowSequence) return;
        nowLoaded = false;
        setText('now-month', '불러오기 실패');
        message(host, errorMessage(error, '지금 중요한 내용을 불러오지 못했습니다.'), true);
        host.append(button('다시 불러오기', function () { return loadNow(true); }));
      } finally {
        if (sequence === nowSequence) {
          nowRequest = null;
          setBusy(host, false);
          if (retry) retry.disabled = false;
        }
      }
    }());
    return nowRequest;
  }
  function renderNow(host, report, alive) {
    host.replaceChildren(actionRow(reportText(report), text(report.month) + ' 지금 중요한 내용'));
    var topSection = section('이번 달 바뀐 것 TOP 5');
    var top = list(report.top5);
    if (top.length) {
      var ordered = node('ol', 'px-list');
      top.forEach(function (item) { ordered.append(reportItem(item, report, alive, 'li')); });
      topSection.append(ordered);
    } else topSection.append(node('p', 'px-empty', '저장된 핵심 변경 항목이 없습니다.'));
    host.append(topSection);
    var flow = list(report.flow);
    if (flow.length) {
      var flowSection = section('이달의 흐름');
      var flowList = node('ul', 'px-list');
      flow.forEach(function (item) { flowList.append(reportItem(item, report, alive, 'li')); });
      flowSection.append(flowList);
      host.append(flowSection);
    }
    var sections = list(report.sections).filter(function (item) { return list(item.items).length; });
    if (sections.length) {
      var official = section('공식 자료 · 소식지 횡단 비교');
      sections.forEach(function (item) {
        var group = node('section', 'px-detail');
        group.append(node('h4', 'px-detail-title', text(item.title) + ' · ' + item.items.length + '건'));
        var items = node('div', 'px-list');
        list(item.items).forEach(function (entry) { items.append(reportItem(entry, report, alive)); });
        group.append(items);
        official.append(group);
      });
      host.append(official);
    }
    var field = list(report.field);
    var fieldSection = section('현장 소식 · 카톡 보험정보방', field.length);
    fieldSection.append(node('p', 'px-notice', '현장 소식은 비공식 정보입니다. 실제 적용 전에 원수사 공지로 확인하세요.'));
    if (field.length) {
      var fieldList = node('div', 'px-list');
      field.forEach(function (item) { fieldList.append(reportItem(item, report, alive)); });
      fieldSection.append(fieldList);
    } else fieldSection.append(node('p', 'px-empty', '최근 현장 소식이 없습니다.'));
    host.append(fieldSection, node('p', 'px-small px-muted', reportMetadata(report)));
  }

  function init(interfaceObject) {
    if (ui) return;
    ui = interfaceObject;
    var newsRetry = target('news-retry');
    var nowRetry = target('now-retry');
    if (newsRetry) newsRetry.addEventListener('click', function () { loadNews(true); });
    if (nowRetry) nowRetry.addEventListener('click', function () { loadNow(true); });
  }

  window.ProductLibrary = { init: init, loadNews: loadNews, loadNow: loadNow };
}());
