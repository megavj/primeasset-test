/* 보험뉴스: 기존 GAS의 공개 읽기 응답만 사용합니다. 모든 표시값은 textContent로 작성합니다. */
(() => {
  'use strict';
  const API = 'https://script.google.com/macros/s/AKfycbyYyYaZD3zH-DReuzAH_fUdl2Xe4jU_xhgf2snq2hpgR0g-7yx68bD-xAvpaXe0hnk/exec';
  const $ = id => document.getElementById(id);
  const text = value => value == null ? '' : String(value);
  const node = (tag, className, value) => { const item = document.createElement(tag); if (className) item.className = className; if (value != null) item.textContent = text(value); return item; };
  const categories = ['전체', '뉴스포트', '금융당국', '협회자료', '설계사·GA', '상품·약관', '보험금·보상', '판례·분쟁', '질병·의학', '기타'];
  let data = null, category = '전체', insurerType = '전체', cardView = false, loading = false, failed = false;
  const mobile = window.matchMedia('(max-width: 768px)');
  let loadId = 0;
  const safeUrl = value => { try { const url = new URL(text(value)); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = text(value); };
  function link(value, label, className) {
    const url = safeUrl(value), item = node(url ? 'a' : 'span', className, label);
    if (url) { item.href = url; item.target = '_blank'; item.rel = 'noopener noreferrer'; }
    return item;
  }
  function filterGroup(id, values, selected, change) {
    $(id).replaceChildren(...values.map(value => {
      const button = node('button', '', value); button.type = 'button'; button.setAttribute('aria-pressed', String(selected === value));
      button.addEventListener('click', () => { change(value); filterGroup(id, values, value, change); }); return button;
    }));
  }
  function activateTab(name, focus) {
    document.querySelectorAll('[data-panel]').forEach(button => {
      const selected = button.dataset.panel === name; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      $('panel-' + button.dataset.panel).hidden = !selected; if (selected && focus) button.focus();
    });
  }
  const tabs = Array.from(document.querySelectorAll('[data-panel]'));
  tabs.forEach((button, index) => {
    button.addEventListener('click', () => activateTab(button.dataset.panel));
    button.addEventListener('keydown', event => {
      let next; if (event.key === 'ArrowRight') next = (index + 1) % tabs.length; else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = tabs.length - 1; else return;
      event.preventDefault(); activateTab(tabs[next].dataset.panel, true);
    });
  });
  function importance(item) {
    if (item.isPromo === true) return node('span', 'nw-badge', '추천자료');
    const score = Math.min(5, Math.max(1, parseInt(item.importance, 10) || 3));
    const stars = node('span', 'nw-stars', '★'.repeat(score) + '☆'.repeat(5 - score)); stars.setAttribute('aria-label', '중요도 5점 중 ' + score + '점'); return stars;
  }
  const badge = item => node('span', 'nw-badge', item.isPromo === true ? '추천자료' : item.category || '기타');
  const title = item => link(item.link, item.title || '제목 없음', 'nw-news-title');
  const original = item => link(item.link, safeUrl(item.link) ? (item.isPromo === true ? '추천글 보기 ↗' : '원문 보기 ↗') : '원문 주소 없음', 'nw-original');
  const summary = item => node('p', 'nw-news-summary', item.content || '');
  function newsCard(item) {
    const card = node('article', 'nw-news-card' + (item.isPromo === true ? ' nw-promo' : ''));
    const meta = node('div', 'nw-card-meta'); meta.append(badge(item), node('span', 'nw-source', item.source || ''), node('span', 'nw-date', item.isPromo === true ? '' : item.date || ''));
    const heading = node('h3', ''); heading.append(title(item));
    const bottom = node('div', 'nw-card-bottom'); bottom.append(importance(item), original(item)); card.append(meta, heading, summary(item), bottom); return card;
  }
  function newsTable(items) {
    const table = node('table', 'nw-news-table'), head = node('thead'), row = node('tr'), body = node('tbody');
    const caption = node('caption', 'sr', '최신 보험뉴스 목록'); table.append(caption);
    ['출처', '분류', '내용', '중요도', '날짜 / 이동'].forEach(label => { const th = node('th', '', label); th.scope = 'col'; row.append(th); }); head.append(row);
    items.forEach(item => {
      const tr = node('tr', item.isPromo === true ? 'nw-promo' : '');
      const source = node('td', 'nw-source', item.source || ''), cat = node('td'), content = node('td'), score = node('td'), date = node('td');
      cat.append(badge(item)); content.append(title(item), summary(item)); score.append(importance(item)); date.append(node('span', 'nw-date', item.isPromo === true ? '추천글' : item.date || ''), original(item));
      tr.append(source, cat, content, score, date); body.append(tr);
    }); table.append(head, body); return table;
  }
  function renderNews() {
    const host = $('news-list');
    host.setAttribute('aria-busy', String(loading));
    if (!data) { setText('news-count', loading ? '불러오는 중' : '연결 확인 필요'); host.replaceChildren(node('p', 'nw-empty', loading ? '최신 보험뉴스를 불러오는 중입니다.' : '뉴스를 불러오지 못했습니다. 위의 다시 불러오기 버튼을 눌러 주세요.')); return; }
    const query = $('news-search').value.toLowerCase().trim();
    const matched = data.news.filter(item => (category === '전체' || (category === '뉴스포트' ? item.newsSource === 'newsport' : (item.category || '기타') === category)) && (!query || [item.title, item.source, item.category].some(value => text(value).toLowerCase().includes(query))));
    const promos = matched.filter(item => item.isPromo === true), items = matched.filter(item => item.isPromo !== true).sort((a, b) => text(b.date).localeCompare(text(a.date)));
    if (promos.length) items.splice(Math.min(3, items.length), 0, promos[0]);
    setText('news-count', items.length + '건 · 최신순' + (failed ? ' · 이전 표시 자료' : ''));
    if (!items.length) { host.replaceChildren(node('p', 'nw-empty', data.news.length ? '검색 조건에 맞는 뉴스가 없습니다. 검색어나 분류를 바꿔 보세요.' : '아직 등록된 뉴스가 없습니다. 잠시 후 새로고침해 주세요.')); return; }
    if (mobile.matches || cardView) { const grid = node('div', 'nw-card-grid'); grid.append(...items.map(newsCard)); host.replaceChildren(grid); } else host.replaceChildren(newsTable(items));
  }
  function renderInsurers() {
    const query = $('insurer-search').value.toLowerCase().trim(), insurers = data && data.insurers || {};
    const all = [...(insurers.손해보험 || []).map(item => ({ ...item, type: '손해보험' })), ...(insurers.생명보험 || []).map(item => ({ ...item, type: '생명보험' }))];
    const items = all.filter(item => (insurerType === '전체' || item.type === insurerType) && (!query || text(item.name).toLowerCase().includes(query)));
    setText('insurer-count', data ? items.length + '개 보험사 · 전체 ' + all.length + '개' : loading ? '불러오는 중' : '자료 연결 확인 필요');
    const rows = items.map(item => { const row = node('tr'); [item.type, item.name, item.tel, item.fax, item.helpdesk, item.incall || '-', item.card, item.cardAuto ? '자동이체O' : '-', item.multiChild || '-', item.iDate || '-'].forEach(value => row.append(node('td', '', value || '-'))); return row; });
    if (!rows.length) { const row = node('tr'), cell = node('td', '', !data ? (loading ? '보험사 정보를 불러오는 중입니다.' : '보험사 정보를 불러오지 못했습니다.') : all.length ? '검색 조건에 맞는 보험사가 없습니다.' : '등록된 보험사 정보가 없습니다.'); cell.colSpan = 10; row.append(cell); rows.push(row); }
    $('insurer-rows').replaceChildren(...rows);
  }
  function renderExtras() {
    const tip = data && data.tip, disease = data && data.disease, stats = data && data.stats;
    setText('tip-situation', tip ? '상황: ' + text(tip.situation) : loading ? '자료를 불러오는 중입니다.' : !data && failed ? '영업 팁을 불러오지 못했습니다.' : '등록된 영업 팁이 없습니다.'); setText('tip-speech', tip && tip.speech);
    setText('disease-name', disease && disease.name || (loading ? '불러오는 중입니다' : !data && failed ? '질병정보를 불러오지 못했습니다' : '등록된 질병정보가 없습니다'));
    setText('disease-date', data && data.diseaseDate ? text(data.diseaseDate) + ' 기준' : ''); setText('disease-summary', disease && disease.summary);
    $('disease-tags').replaceChildren(...(disease && Array.isArray(disease.tags) ? disease.tags : []).map(tag => node('span', '', tag)));
    for (const [period, id] of [['today', 'stat-today'], ['week', 'stat-week'], ['month', 'stat-month']]) setText(id, stats && stats.ok && stats[period] && stats[period].uv != null ? Number(stats[period].uv).toLocaleString('ko-KR') : '—');
    setText('stat-news', data ? data.news.filter(item => !item.isPromo).length.toLocaleString('ko-KR') : '—');
    setText('stats-updated', stats && stats.ok ? '방문 현황은 자료를 불러온 시점을 기준으로 표시합니다.' : loading ? '방문 현황을 확인하는 중입니다.' : '방문 현황을 불러오지 못했습니다.');
  }
  function validData(value) {
    return value && value.ok === true && Array.isArray(value.news) && value.news.every(item => item && typeof item === 'object') && value.insurers && ['손해보험', '생명보험'].every(key => Array.isArray(value.insurers[key]) && value.insurers[key].every(item => item && typeof item === 'object'));
  }
  async function load() {
    if (loading) return;
    const sequence = ++loadId; loading = true; failed = false; $('refresh-data').disabled = true; $('retry-data').hidden = true; $('data-state').hidden = false; $('data-state').classList.remove('is-error'); setText('data-message', data ? '최신 자료를 다시 확인하는 중입니다.' : '뉴스와 업무 자료를 불러오는 중입니다.'); renderNews();
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(API + '?format=json', { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('request_failed');
      const value = await response.json(); if (!validData(value)) throw new Error('invalid_data');
      if (sequence !== loadId) return; data = value; $('data-state').hidden = true; setText('updated-at', value.updatedAt ? '최종 업데이트 · ' + text(value.updatedAt) : '최신 자료를 불러왔습니다.');
    } catch (_) {
      if (sequence !== loadId) return; failed = true; $('data-state').classList.add('is-error'); $('retry-data').hidden = false; setText('data-message', data ? '새 자료를 받지 못해 이전에 불러온 내용을 표시합니다. 연결 상태를 확인하고 다시 시도해 주세요.' : '뉴스와 업무 자료를 불러오지 못했습니다. 인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.');
      if (!data) setText('updated-at', '연결을 확인해 주세요.');
    } finally { clearTimeout(timeout); if (sequence === loadId) { loading = false; $('refresh-data').disabled = false; renderNews(); renderInsurers(); renderExtras(); } }
  }
  // 원래 포털의 날짜 해석 및 보험나이 계산식을 유지합니다.
  function todayYmd() { const date = new Date(); return '' + date.getFullYear() + String(date.getMonth() + 1).padStart(2, '0') + String(date.getDate()).padStart(2, '0'); }
  function parseDate(raw, birth) {
    const value = text(raw).replace(/[^0-9]/g, ''); let year, month, day;
    if (value.length === 8) { year = +value.slice(0, 4); month = +value.slice(4, 6); day = +value.slice(6, 8); }
    else if (value.length === 6) { const yy = +value.slice(0, 2); year = birth ? (yy <= new Date().getFullYear() % 100 ? 2000 : 1900) + yy : 2000 + yy; month = +value.slice(2, 4); day = +value.slice(4, 6); } else return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day); return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  $('age-form').addEventListener('submit', event => {
    event.preventDefault(); const birth = parseDate($('birth-date').value, true), ref = parseDate($('reference-date').value.trim() || todayYmd(), false);
    $('age-error').hidden = true; $('age-result').hidden = true; $('birth-date').removeAttribute('aria-invalid'); $('reference-date').removeAttribute('aria-invalid');
    const invalid = !birth ? ['birth-date', '생년월일을 확인해 주세요. 예: 19800101 또는 800101'] : !ref ? ['reference-date', '기준일을 확인해 주세요. 예: ' + todayYmd()] : birth > ref ? ['birth-date', '생년월일은 기준일보다 이전이어야 합니다.'] : null;
    if (invalid) { setText('age-error', invalid[1]); $('age-error').hidden = false; $(invalid[0]).setAttribute('aria-invalid', 'true'); $(invalid[0]).focus(); return; }
    let age = ref.getFullYear() - birth.getFullYear(); const md = ref.getMonth() - birth.getMonth(), dd = ref.getDate() - birth.getDate(); if (md < 0 || (md === 0 && dd < 0)) age--;
    const thisYearBirth = new Date(ref.getFullYear(), birth.getMonth(), birth.getDate()), nextBirth = new Date(ref.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const halfPoint = new Date(thisYearBirth.getTime() + (nextBirth - thisYearBirth) / 2), insuranceAge = ref >= halfPoint ? age + 1 : age, daysToHalf = Math.round((halfPoint - ref) / 86400000);
    setText('age-main', '만 ' + age + '세 → 보험나이 ' + insuranceAge + '세'); setText('age-tip', ref >= halfPoint ? '생일 6개월 이후 — 현재 보험나이 ' + insuranceAge + '세 적용 중' : '생일 6개월 이전 — ' + daysToHalf + '일 후 ' + (insuranceAge + 1) + '세로 올라갑니다'); $('age-result').hidden = false;
  });
  function recordVisit() {
    // 로컬 검증에서 실제 방문 기록을 늘리지 않습니다. 기존과 같은 네 항목만 전송합니다.
    if (location.hostname !== 'test.primeasset.info') return;
    try {
      const key = 'premiumPortalVisitorId'; let visitorId = localStorage.getItem(key);
      if (!visitorId) { visitorId = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2); localStorage.setItem(key, visitorId); }
      fetch(API, { method: 'POST', mode: 'no-cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action: 'visit', payload: { visitorId, pageUrl: location.href || '', referrer: document.referrer || '', userAgent: navigator.userAgent || '' } }), keepalive: true }).catch(() => {});
    } catch (_) { /* 저장 또는 통계 연결이 제한되어도 뉴스는 이용할 수 있습니다. */ }
  }
  filterGroup('news-filters', categories, category, value => { category = value; renderNews(); });
  filterGroup('insurer-filters', ['전체', '손해보험', '생명보험'], insurerType, value => { insurerType = value; renderInsurers(); });
  $('news-search').addEventListener('input', renderNews); $('insurer-search').addEventListener('input', renderInsurers);
  $('view-toggle').addEventListener('click', () => { cardView = !cardView; $('view-toggle').setAttribute('aria-pressed', String(cardView)); setText('view-toggle', cardView ? '표형으로 보기' : '카드형으로 보기'); renderNews(); });
  mobile.addEventListener('change', renderNews); $('refresh-data').addEventListener('click', load); $('retry-data').addEventListener('click', load);
  $('reference-date').value = todayYmd(); $('admin-stats').href = API + '?view=admin'; renderInsurers(); recordVisit(); load();
})();
