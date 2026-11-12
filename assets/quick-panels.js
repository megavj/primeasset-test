/* 설계사 인트라넷 빠른 확인 창: 손생보 연락망 · 원수사 전산접속 (2026-11-12 이사님 승인)
   연락망 내용은 사이트 파일에 두지 않고 로그인한 활성 회원만 받는 서버 함수(my_shared_doc)에서 읽습니다. */
(function () {
  'use strict';
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach(k => { if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k))); });
    return n;
  };
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const BRANCH_KEY = 'pa_qp_branch_v1', FAV_KEY = 'pa_qp_portal_fav_v1';
  const TOKEN = /(\b0\d{1,3}-\d{3,4}-\d{4}(?:~\d+)?|\b1[5-9]\d{2}-\d{4}\b|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|https?:\/\/[^\s]+|www\.[^\s]+)/g;
  let contactsCache = null, dlg = null;

  function toast(msg) {
    const t = el('div', { class: 'pa-qp-toast', role: 'status' }, msg);
    (dlg || document.body).append(t); setTimeout(() => t.remove(), 1600);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast(text + ' 복사했습니다'); }
    catch (_) { toast('복사하지 못했습니다. 길게 눌러 복사해 주세요.'); }
  }
  // 한 줄 안의 전화·팩스·메일·주소를 누를 수 있게 바꿉니다. 팩스는 복사, 전화는 바로 걸기.
  function richLine(line, isFax, terms) {
    const out = []; let last = 0;
    line.replace(TOKEN, (m, _1, idx) => {
      if (idx > last) out.push(...marked(line.slice(last, idx), terms));
      if (m.includes('@')) out.push(el('button', { type: 'button', class: 'pa-qp-chip', onclick: () => copy(m), title: '눌러서 복사' }, m));
      else if (/^(https?:|www\.)/.test(m)) out.push(el('a', { class: 'pa-qp-link', href: m.startsWith('www.') ? 'https://' + m : m, target: '_blank', rel: 'noopener noreferrer' }, m));
      else if (isFax) out.push(el('button', { type: 'button', class: 'pa-qp-chip', onclick: () => copy(m.replace(/~\d+$/, '')), title: '팩스번호 복사' }, m));
      else out.push(el('a', { class: 'pa-qp-tel', href: 'tel:' + m.replace(/~\d+$/, '').replace(/-/g, '') }, m));
      last = idx + m.length; return m;
    });
    if (last < line.length) out.push(...marked(line.slice(last), terms));
    return out;
  }
  function marked(text, terms) {
    if (!terms.length) return [text];
    const rx = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return text.split(rx).map((p, i) => i % 2 ? el('mark', {}, p) : p);
  }
  // 매니저 칸처럼 ▼본부 묶음이 있는 값은 묶음으로 나눠, 내 본부 묶음을 맨 위에 강조합니다.
  function valueNode(row, branch, terms) {
    const isFax = /팩스|FAX/i.test(row.label);
    const blocks = row.value.split(/\n\s*\n|(?=▼)/).map(b => b.trim()).filter(Boolean);
    const mine = b => branch && new RegExp('(^|[^0-9])' + branch + '([^0-9]|$)').test((b.match(/▼[^\n]*/) || [''])[0]);
    const ordered = branch ? [...blocks.filter(mine), ...blocks.filter(b => !mine(b))] : blocks;
    return el('div', { class: 'pa-qp-val' }, ordered.map(b => el('div', { class: 'pa-qp-block' + (mine(b) ? ' is-mine' : '') },
      mine(b) ? el('span', { class: 'pa-qp-mine' }, '내 본부') : null,
      b.split('\n').map(l => el('div', { class: 'pa-qp-line' }, richLine(l, isFax, terms))))));
  }

  function shell(title, sub) {
    if (dlg) dlg.remove();
    const body = el('div', { class: 'pa-qp-body', tabindex: '-1' });
    const search = el('input', { class: 'pa-qp-search', type: 'search', placeholder: '보험사·본부·이름 검색', 'aria-label': title + ' 검색', autocomplete: 'off' });
    const tabs = el('div', { class: 'pa-qp-tabs', role: 'tablist' }, ['전체', '손해', '생명'].map((t, i) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(i === 0), 'data-kind': t }, t === '전체' ? t : t + '보험')));
    const tools = el('div', { class: 'pa-qp-tools' });
    const foot = el('div', { class: 'pa-qp-foot' });
    dlg = el('dialog', { class: 'pa-qp', 'aria-label': title },
      el('header', { class: 'pa-qp-head' }, el('div', {}, el('h2', {}, title), sub ? el('p', {}, sub) : null),
        el('button', { type: 'button', class: 'pa-qp-close', 'aria-label': '닫기', onclick: () => dlg.close() }, '✕')),
      el('div', { class: 'pa-qp-bar' }, search, tabs, tools), body, foot);
    dlg.addEventListener('close', () => { dlg.remove(); dlg = null; });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg); dlg.showModal();
    setTimeout(() => { if (!matchMedia('(max-width: 760px)').matches) search.focus(); }, 30);
    let kind = '전체';
    tabs.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      kind = b.dataset.kind; tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x === b))); dlg.dispatchEvent(new Event('redraw'));
    });
    search.addEventListener('input', () => dlg.dispatchEvent(new Event('redraw')));
    return { body, foot, tools, terms: () => search.value.trim().toLowerCase().split(/\s+/).filter(Boolean), kind: () => kind, on: f => dlg.addEventListener('redraw', f) };
  }

  async function openContacts(sb, profile) {
    const ui = shell('손생보 연락망', '전화번호를 누르면 바로 걸리고, 팩스·메일은 눌러서 복사됩니다.');
    const def = String((profile && profile.branch) || '').match(/\d{3}/);
    let branch = read(BRANCH_KEY, def ? def[0] : '');
    const bInput = el('input', { class: 'pa-qp-branch', inputmode: 'numeric', maxlength: '3', placeholder: '내 본부', value: branch, 'aria-label': '내 본부 번호' });
    bInput.addEventListener('input', () => { branch = bInput.value.replace(/\D/g, '').slice(0, 3); write(BRANCH_KEY, branch); draw(); });
    ui.tools.append(el('label', { class: 'pa-qp-branch-wrap' }, '내 본부', bInput));
    ui.body.append(el('p', { class: 'pa-qp-note' }, '연락망을 불러오는 중…'));
    let doc = contactsCache;
    if (!doc) {
      const { data, error } = await sb.rpc('my_shared_doc', { p_key: 'contacts' });
      if (error || !data) { ui.body.replaceChildren(el('p', { class: 'pa-qp-note' }, '연락망을 불러오지 못했습니다. 다시 로그인한 뒤 열어 주세요.')); return; }
      doc = contactsCache = data;
    }
    function draw() {
      const terms = ui.terms(), k = ui.kind();
      const list = doc.insurers.filter(x => (k === '전체' || x.kind === k) &&
        terms.every(t => (x.name + ' ' + x.rows.map(r => r.label + ' ' + r.value).join(' ')).toLowerCase().includes(t)));
      ui.body.replaceChildren(...(list.length ? list.map(x => el('article', { class: 'pa-qp-card' },
        el('h3', {}, ...marked(x.name, terms), el('span', { class: 'pa-qp-kind' }, x.kind)),
        el('dl', {}, x.rows.map(r => [el('dt', {}, r.label), el('dd', {}, valueNode(r, branch, terms))]))))
        : [el('p', { class: 'pa-qp-note' }, '맞는 내용이 없습니다.')]));
    }
    ui.on(draw); draw();
    ui.foot.append(el('span', {}, '기준일 ' + doc.asof),
      doc.has_file ? el('button', { type: 'button', class: 'pa-qp-dl', onclick: async e => {
        e.currentTarget.disabled = true;
        const { data, error } = await sb.rpc('my_shared_file', { p_key: 'contacts' });
        e.currentTarget.disabled = false;
        if (error || !data) return toast('내려받지 못했습니다.');
        const bin = Uint8Array.from(atob(data.b64), c => c.charCodeAt(0));
        const a = el('a', { href: URL.createObjectURL(new Blob([bin], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), download: data.name });
        document.body.append(a); a.click(); a.remove();
      } }, '원본 엑셀 내려받기') : null);
  }

  function openPortals() {
    const ui = shell('원수사 전산접속', '버튼을 누르면 새 탭으로 열립니다. ☆를 누르면 맨 위에 고정됩니다.');
    let fav = read(FAV_KEY, []);
    const all = window.PA_PORTALS || [];
    const btn = p => el('div', { class: 'pa-qp-portal' + (fav.includes(p.name) ? ' is-fav' : '') },
      el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', title: p.url },
        el('span', { class: 'pa-qp-pname' }, p.name), el('span', { class: 'pa-qp-pkind' }, p.kind + (p.url.startsWith('http:') ? ' · 보안연결 아님' : ''))),
      el('button', { type: 'button', class: 'pa-qp-star', 'aria-label': p.name + (fav.includes(p.name) ? ' 고정 해제' : ' 맨 위 고정'), 'aria-pressed': String(fav.includes(p.name)),
        onclick: () => { fav = fav.includes(p.name) ? fav.filter(n => n !== p.name) : [...fav, p.name]; write(FAV_KEY, fav); draw(); } }, fav.includes(p.name) ? '★' : '☆'));
    function draw() {
      const terms = ui.terms(), k = ui.kind();
      const list = all.filter(p => (k === '전체' || p.kind === k) && terms.every(t => p.name.toLowerCase().includes(t)));
      const top = list.filter(p => fav.includes(p.name)), rest = list.filter(p => !fav.includes(p.name));
      ui.body.replaceChildren(
        top.length ? el('section', { class: 'pa-qp-group' }, el('h3', {}, '고정'), el('div', { class: 'pa-qp-grid' }, top.map(btn))) : '',
        rest.length ? el('section', { class: 'pa-qp-group' }, top.length ? el('h3', {}, '전체') : null, el('div', { class: 'pa-qp-grid' }, rest.map(btn))) : '',
        list.length ? '' : el('p', { class: 'pa-qp-note' }, '맞는 보험사가 없습니다.'));
    }
    ui.on(draw); draw();
    ui.foot.append(el('span', {}, '보험사 ' + all.length + '곳 · 인트라넷 안에서는 보험사 보안 정책상 바로 열 수 없어 새 탭으로 엽니다.'));
  }

  window.PA_QUICK = Object.freeze({ openContacts, openPortals });
})();
