/* 관리자 업무 공간. 권한은 기존 my_profile + 서버 RLS/트리거로 판정한다.
   승인·권한 변경은 기존 테이블/API, 요청 완료는 기존 RPC를 사용한다. */
/* AUDIT-20261103: 다른 사이트가 이 화면을 보이지 않는 액자(iframe)로 띄워 클릭을 유도하는 것(클릭재킹) 방지.
   GitHub Pages는 X-Frame-Options 헤더를 못 주므로, 다른 출처 액자 안이면 화면을 숨긴다. 같은 사이트 안 액자는 허용. */
(function () { try { if (window.top !== window.self && window.top.location.origin !== window.location.origin) throw 0; } catch (e) { document.documentElement.style.display = 'none'; } })();
(function () {
  'use strict';
  const C = window.PA_AUTH || {}, box = document.getElementById('pa-app');
  const originals = new WeakMap(), edited = new Set();
  let actionScope = null, savesDraft = false;
  const controlValue = e => e.type === 'checkbox' ? e.checked : e.value;
  const el = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (['checked', 'selected', 'value', 'disabled', 'indeterminate'].includes(k)) e[k] = v;
      else e.setAttribute(k, v);
    });
    kids.flat().forEach(k => { if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k))); });
    if (e.matches('input,select,textarea')) originals.set(e, controlValue(e));
    return e;
  };
  const button = (text, onclick, variant = 'secondary', attrs = {}) => el('button', {type:'button', class:'adm-button adm-button--' + variant, onclick, ...attrs}, text);
  const input = (label, value = '', attrs = {}) => el('input', {class:'adm-input', 'aria-label':label, 'data-draft':'true', value, ...attrs});
  const select = (label, options, value) => el('select', {class:'adm-input', 'aria-label':label, 'data-draft':'true'}, ...options.map(([v, t]) => el('option', {value:String(v), selected:String(v) === String(value)}, t)));
  const filter = e => { e.classList.add('adm-filter'); e.removeAttribute('data-draft'); return e; };
  const field = (label, control, help) => el('label', {class:'adm-field'}, el('span', {}, label), control, help ? el('small', {class:'adm-note'}, help) : null);
  const empty = (title, desc) => el('div', {class:'adm-empty'}, el('h3', {}, title), desc ? el('p', {}, desc) : null);
  const fmt = t => t && !Number.isNaN(Date.parse(t)) ? new Date(t).toLocaleString('ko-KR', {dateStyle:'short',timeStyle:'short'}) : '—';
  const num = n => Number(n || 0).toLocaleString('ko-KR');
  const table = (heads, rows, caption = '관리 목록') => {
    rows.forEach(row => [...row.children].forEach((cell,i) => cell.setAttribute('data-label', typeof heads[i] === 'string' ? heads[i] : '')));
    return el('div', {class:'adm-table-scroll', tabindex:'0', role:'region', 'aria-label':caption + ' · 표는 좌우로 스크롤할 수 있습니다'},
      el('table', {class:'adm-table'}, el('caption', {class:'sr'}, caption), el('thead', {}, el('tr', {}, ...heads.map(h => el('th', {scope:'col'}, h)))), el('tbody', {}, ...rows)));
  };
  const toast = (text, bad = false) => {
    const region = document.getElementById('admin-feedback');
    region.setAttribute('role', bad ? 'alert' : 'status');
    region.replaceChildren(el('div', {class:'adm-feedback' + (bad ? ' adm-feedback--error' : '')}, el('span',{},text), button('닫기',() => region.replaceChildren(),'secondary',{'aria-label':'알림 닫기'})));
  };
  const errorText = e => {
    const m = String(e?.message || e || '');
    if (/fetch|network|timeout|abort|Failed/i.test(m)) return '연결을 확인하고 다시 시도해 주세요.';
    if (e?.hint === 'pa-menu' && /[가-힣]/.test(m)) return m; // TASK-MENU: 메뉴 관리 서버 함수의 안내 문구는 그대로 보여 줌
    if (/JWT|token|session|401/i.test(m)) return '로그인이 만료되었습니다. 인트라넷에서 다시 로그인해 주세요.';
    if (/permission|denied|42501|관리자|권한/i.test(m)) return '관리자 권한을 확인하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.';
    if (/가입 정보|정보 미입력/i.test(m)) return '이름·휴대폰·소속 본부·개인정보 동의를 모두 입력한 회원만 승인할 수 있습니다.';
    if (/duplicate|unique|23505/i.test(m)) return '이미 등록된 내용입니다. 목록을 새로고침해 확인해 주세요.';
    if (/마지막|기본 등급|회원이|pending|대기/i.test(m)) return '현재 상태에서는 처리할 수 없습니다. 마지막 관리자·기본 등급·소속 회원 여부를 확인해 주세요.';
    if (/23503|foreign key/i.test(m)) return '다른 자료에서 사용 중입니다. 연결된 회원과 권한을 먼저 확인해 주세요.';
    return '처리하지 못했습니다. 입력 내용과 연결 상태를 확인하고 다시 시도해 주세요.';
  };
  if (!C.url || !C.anonKey || !window.supabase) { box.replaceChildren(empty('로그인 서버를 연결하지 못했습니다', '잠시 후 새로고침해 주세요.')); return; }
  const sb = window.supabase.createClient(C.url, C.anonKey);
  window.PA_SB = sb; // 공통 상단 메뉴도 기존 인증 클라이언트를 재사용합니다.
  const S = {grades:[],members:[],resources:[],trash:[],groups:[],branches:[],perms:new Set(),profile:null,requests:[],requestError:null,loadedAt:null}; // TASK-MENU: resources=지우지 않은 메뉴, trash=지운 메뉴함(30일), groups=묶음
  const gname = id => S.grades.find(g => g.id === id)?.name || '등급 없음';
  let askClient = null, sessionOwner;
  let tab = 'tasks', busy = false, dirty = false, ready = false, loadVersion = 0;
  const filters = {members:{q:'',grade:'',status:'',page:1},pending:{q:'',complete:'yes',page:1},requests:{q:'',page:1},matrix:{q:'',grade:''},resources:{q:'',view:'list',open:null}};
  const TABS = {tasks:['업무 요약','승인할 회원과 필요한 관리 업무를 한눈에 확인하세요.'],pending:['가입 승인','가입 정보를 확인하고 등급을 지정해 승인합니다.'],requests:['지난 요청','예전에 회원이 보낸 이용 요청 중 아직 정리하지 않은 것입니다. 이제 회원 화면에는 요청 버튼이 없습니다.'],members:['회원 관리','이름을 누르면 상세 창이 열리고, 여러 명을 고르면 등급 변경·정지·정지 풀기를 한 번에 할 수 있습니다.'],matrix:['메뉴 권한','등급마다 회원이 볼 수 있는 메뉴와 AI 질문 횟수를 정합니다.'],grades:['등급 관리','가입 기본 등급과 등급 이름·순서를 관리합니다.'],admins:['관리자 관리','관리자 권한은 회원 등급과 별도로 관리합니다.'],notice:['새 소식','인트라넷 상단에 표시할 한 줄 소식을 작성합니다.'],hits:['방문 합계','날짜별 방문·문의 클릭 현황'],resources:['메뉴 관리','회원 업무 도구 화면의 메뉴를 추가·수정·숨김·삭제하고, 지운 메뉴를 30일 안에 되살립니다.'],branches:['본부 관리','함께하는 본부의 번호·주소·표시 순서를 관리합니다.'],audit:['변경 기록','최근 변경 내역을 확인합니다.'],articles:['작성글모음','AI가 쓴 글의 남은 수·보관 기록을 보고, 필요 없는 글을 지웁니다.'],backup:['백업','회원과 권한표를 파일로 내려받습니다.']};

  const confirmAction = message => window.confirm(message);
  const discard = () => !dirty || confirmAction('저장하지 않은 변경이 있습니다. 변경을 버리고 이동할까요?');
  function go(next, values = {}) {
    if (busy || !TABS[next] || !discard()) return false;
    dirty = false; edited.clear(); tab = next;
    if (filters[next]) {
      if (values.q !== undefined && next === 'members') Object.assign(filters[next],{grade:'',status:''});
      // 숫자·전체 목록·개별 검토 어느 경로든 이전 검색 조건을 물려받지 않는다.
      if (next === 'pending') Object.assign(filters[next], {q:'',complete:'yes'});
      Object.assign(filters[next], {page:1}, values);
    }
    history.replaceState(null, '', '#' + tab); render(true); return true;
  }
  function setBusy(value) {
    busy = value; box.setAttribute('aria-busy', String(value));
    const lock = document.getElementById('admin-lock'); if (lock) lock.disabled = value;
  }
  async function mutate(action, success, options = {}) {
    if (busy) return false;
    if (dirty && [...edited].some(e => !savesDraft || !actionScope?.contains(e)) && !confirmAction('다른 항목에 저장하지 않은 입력이 있습니다. 이 작업을 진행하면 다른 입력은 저장되지 않습니다. 계속할까요?')) return false;
    setBusy(true);
    let saved = false;
    try {
      const result = await action();
      if (result?.error) throw result.error;
      saved = true; dirty = false; edited.clear();
      if (options.reload !== false) await load();
      document.getElementById('admin-view-title')?.focus({preventScroll:true});
      if (success) toast(success);
      return true;
    } catch(e) {
      if (saved) { gate('저장은 완료됐지만 목록을 다시 확인하지 못했습니다','새로 불러온 뒤 결과를 확인해 주세요. 같은 작업을 다시 저장하지 않아도 됩니다.',true); }
      else toast(errorText(e), true);
      return saved;
    }
    finally { setBusy(false); }
  }
  async function checkedUpdate(id, values, pending = false) {
    const member = S.members.find(m => m.id === id);
    if (values.status === 'active' && !profileComplete(member)) return {error:{message:'가입 정보 미입력'}};
    let query = sb.from('members').update(values).eq('id', id);
    // 확인 뒤 다른 창에서 가입 정보가 바뀌면 승인하지 않는다. 서버 제약은 별도 SQL 초안 참조.
    if (values.status === 'active') ['name','phone','branch','consent_at'].forEach(key => { query = query.eq(key,member[key]); });
    if (pending) query = query.eq('status', 'pending');
    const r = await query.select('id');
    if (!r.error && !r.data?.length) return {error:{message:'상태 변경: 대기 회원을 새로 확인해 주세요'}};
    return r;
  }
  async function readAll(name, orders = []) {
    const rows = [];
    for (let start = 0; ; start += 1000) {
      let q = sb.from(name).select('*');
      orders.forEach(([key, opt]) => { q = q.order(key, opt); });
      const r = await q.range(start, start + 999);
      if (r.error) throw r.error;
      rows.push(...(r.data || []));
      if ((r.data || []).length < 1000) return rows;
    }
  }
  async function requestData() {
    try {
      const r = await sb.rpc('list_access_requests');
      if (r.error) throw r.error;
      if (!Array.isArray(r.data)) throw new Error('invalid response');
      // 예전 서버에 남은 미입력 가입 요청도 실제 승인 요청 수에서 제외한다.
      S.requests = r.data.filter(r => {
        const member = S.members.find(m => m.email && m.email === r.member_email);
        return member && member.status !== 'incomplete' && (member.status !== 'pending' || profileComplete(member));
      }); S.requestError = null;
    } catch (e) { S.requests = []; S.requestError = e; }
  }
  async function load(recheck = true) {
    const version = ++loadVersion;
    if (recheck) {
      const p = await sb.rpc('my_profile');
      if (version !== loadVersion) return;
      if (p.error) throw p.error;
      if (!p.data?.[0]?.is_admin || p.data[0].status !== 'active') { gate('관리자만 볼 수 있습니다','현재 계정은 이 화면에 접근할 수 없습니다.'); return; }
      const session = await sb.auth.getSession();
      const profile = await window.PA_SIGNUP.resolveProfile(sb,p.data[0],session.data?.session);
      if (version !== loadVersion) return;
      if (!window.PA_SIGNUP.complete(profile)) { gate('가입 정보를 먼저 입력해 주세요','이름·휴대폰·소속 본부와 개인정보 동의를 입력한 뒤 이용해 주세요.',false,true); return; }
      S.profile = profile;
    }
    const [grades,members,allMenus,perms,branches,groups] = await Promise.all([
      readAll('grades',[['sort'],['id']]),readAll('members',[['created_at',{ascending:false}],['id']]),
      readAll('resources',[['kind'],['category'],['sort'],['id']]),readAll('grade_permissions',[['grade_id'],['resource_id']]),readAll('branches',[['sort'],['no']]),readAll('menu_groups',[['sort'],['name']])]);
    if (version !== loadVersion) return;
    // TASK-MENU: 지운 메뉴(deleted_at)는 모든 관리 화면에서 빼고 '지운 메뉴'함에만 보인다.
    Object.assign(S,{grades,members,resources:allMenus.filter(r => !r.deleted_at),trash:allMenus.filter(r => r.deleted_at),groups,branches,perms:new Set(perms.map(p => p.grade_id + ':' + p.resource_id))});
    await requestData();
    if (version !== loadVersion) return;
    S.loadedAt = new Date(); ready = true; render();
  }
  function gate(title, description, retry = false, signup = false) {
    if (askClient) { askClient.dispose(); askClient = null; }
    loadVersion++; ready = false; dirty = false; edited.clear(); S.profile = null;
    Object.assign(S,{grades:[],members:[],resources:[],trash:[],groups:[],branches:[],perms:new Set(),requests:[],requestError:null});
    document.getElementById('admin-feedback')?.replaceChildren();
    document.querySelectorAll('.admin-command,.adm-dialog,.adm-drawer').forEach(d => { if (d.open) d.close(); d.remove(); });
    box.replaceChildren(el('section',{class:'adm-gate'},empty(title,description),el('div',{class:'adm-actions'},el('a',{class:'adm-button',href:signup ? '/members/#signup' : '/members/#login'},signup ? '가입 정보 입력' : '인트라넷 로그인'),retry ? button('다시 시도',boot,'primary') : null),window.PA_SIGNUP?.guide()));
  }
  async function boot() {
    if (busy) return;
    const attempt = ++loadVersion;
    setBusy(true);
    try {
      const session = await sb.auth.getSession();
      if (attempt !== loadVersion) return;
      if (session.error) throw session.error;
      sessionOwner = session.data?.session?.user?.id || null;
      if (!session.data?.session) { gate('로그인이 필요합니다','인트라넷에서 로그인한 뒤 관리자 화면을 열어 주세요.'); return; }
      const p = await sb.rpc('my_profile');
      if (attempt !== loadVersion) return;
      if (p.error) throw p.error;
      const profile = await window.PA_SIGNUP.resolveProfile(sb,p.data?.[0],session.data.session);
      if (attempt !== loadVersion) return;
      if (!window.PA_SIGNUP.complete(profile)) { gate('가입 정보를 먼저 입력해 주세요','이름·휴대폰·소속 본부와 개인정보 동의를 입력한 뒤 이용해 주세요.',false,true); return; }
      if (!profile?.is_admin || profile.status !== 'active') { gate('관리자만 볼 수 있습니다','현재 계정은 이 화면에 접근할 수 없습니다.'); return; }
      S.profile = profile;
      const hash = location.hash.slice(1).split('?')[0]; if (TABS[hash]) tab = hash; // #members?filter=… 처럼 화면 조건이 붙을 수 있음
      await load(false);
    } catch(e) { gate('관리 화면을 불러오지 못했습니다',errorText(e),true); }
    finally { setBusy(false); }
  }
  const badge = text => el('span',{class:'adm-badge'},text);
  // 신규/기존 미입력 계정은 승인할 신청과 구분한다. DB 원본에는 profile_done 열이 없다.
  const profileComplete = m => !!window.PA_SIGNUP?.complete(m);
  const unapprovedMembers = () => S.members.filter(m => ['pending','incomplete'].includes(m.status)).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)));
  const pendingMembers = () => unapprovedMembers().filter(m => m.status === 'pending' && profileComplete(m));
  const incompleteMembers = () => unapprovedMembers().filter(m => m.status === 'incomplete' || !profileComplete(m));
  function render(focus = false) {
    const pending = pendingMembers().length;
    const count = key => key === 'pending' ? pending : key === 'requests' ? (S.requestError ? '—' : S.requests.length) : null;
    const nav = window.PA_ADMIN_NAV.create(tab, go, {pending:count('pending'), requests:count('requests')});
    const view = (modules[tab] || views[tab] || settings[tab])();
    const main = el('section',{class:'adm-content','aria-labelledby':'admin-view-title','data-admin-view':tab},
      el('div',{class:'adm-section-head'},el('div',{},el('h2',{id:'admin-view-title',tabindex:'-1'},TABS[tab][0]),el('p',{class:'adm-note'},TABS[tab][1])),button('새로고침',() => { if (discard()) { dirty = false; edited.clear(); boot(); } },'secondary',{'aria-label':'관리 자료 새로고침'})),el('p',{id:'admin-draft-note',class:'adm-draft-note',role:'status',hidden:true},'저장하지 않은 변경이 있습니다. 이 화면의 저장 버튼으로 적용해 주세요.'),view);
    box.replaceChildren(el('fieldset',{id:'admin-lock',class:'adm-lock adm-shell',disabled:busy},el('legend',{class:'sr'},'관리자 업무'),nav,el('div',{class:'adm-layout'},main)));
    if (tab === 'tasks' && window.PA_ADMIN_SUMMARY && window.PA_ASK) {
      if (!askClient) askClient = window.PA_ASK.create(sb);
      window.PA_ADMIN_SUMMARY.mount(document.getElementById('admin-ai-summary'), askClient);
    }
    if (focus) document.getElementById('admin-view-title').focus({preventScroll:false});
    document.getElementById('admin-updated').textContent = S.loadedAt ? '마지막 확인 ' + S.loadedAt.toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '';
  }
  const matches = (q, ...values) => values.join(' ').toLocaleLowerCase().replace(/\s/g,'').includes(q.toLocaleLowerCase().replace(/\s/g,''));
  function pager(list, f, draw) {
    const pages = Math.max(1,Math.ceil(list.length / 20)); f.page = Math.min(f.page,pages);
    const move = step => {if(!discard())return;dirty=false;edited.clear();f.page+=step;draw();};
    return el('div',{class:'adm-pagination'},el('span',{class:'adm-note','role':'status'},`${num(list.length)}건 · ${f.page} / ${pages}페이지`),button('이전',() => move(-1),'secondary',{disabled:f.page <= 1}),button('다음',() => move(1),'secondary',{disabled:f.page >= pages}));
  }
  const pageRows = (rows,f) => rows.slice((f.page - 1) * 20,f.page * 20);
  function person(m) { return el('div',{class:'adm-person'},el('strong',{},m.name || '이름 미입력'),el('span',{},m.branch || '소속 미입력'),el('span',{},m.phone || '연락처 미입력'),el('small',{},m.email || '이메일 없음')); }
  function check(label, checked, onchange) { return el('label',{class:'adm-check'},el('input',{type:'checkbox',checked,'aria-label':label,onchange}),el('span',{class:'sr'},label)); }
  const defaultGrade = () => S.grades.find(g => g.name === '설계사')?.id || S.grades[0]?.id || '';
  function gradeSelect(label, value) { return select(label,S.grades.map(g => [g.id,g.name]),value); }
  async function bulk(items, action, label, after) {
    if (!items.length || busy || !confirmAction(`${items.length}건을 ${label}할까요?\n${items.map(x => x.name || x.member_name || x.email || '회원').slice(0,8).join(', ')}${items.length > 8 ? ' 외' : ''}`)) return;
    setBusy(true); let done = 0; const failed = [];
    toast(`${label} 처리 중… 화면을 닫지 말고 기다려 주세요.`);
    for (const item of items) {
      try { const r = await action(item); if (r?.error) throw r.error; done++; }
      catch(e) { failed.push(item); }
    }
    dirty = false;
    try { await load(); document.getElementById('admin-view-title')?.focus({preventScroll:true}); if (after) after(failed); }
    catch(e) { gate('처리 후 목록을 확인하지 못했습니다','일부 처리가 반영되었을 수 있습니다. 새로 불러온 뒤 확인해 주세요.',true); }
    finally { setBusy(false); }
    toast(`${label}: 성공 ${done}건${failed.length ? ` · 실패 ${failed.length}건. 목록에서 상태를 확인하고 실패한 항목만 다시 처리해 주세요.` : ''}`,!!failed.length);
  }
  const views = {
    tasks() {
      const pending = pendingMembers(), preview = pending.slice(0,20), incomplete = incompleteMembers();
      const stat = (label,value,next,detail,values = {}) => {
        const card = button(el('span',{class:'adm-stat-inner'},el('span',{},label),el('strong',{},num(value)),el('small',{},detail)),() => go(next,values),'stat');
        card.classList.toggle('adm-button--stat-empty', value === 0);
        return card;
      };
      const featured = el('div',{class:'adm-task-panel' + (pending.length ? '' : ' adm-task-panel--empty')},el('div',{class:'adm-panel-heading'},el('div',{},el('p',{class:'adm-eyebrow'},'먼저 확인하세요'),el('h3',{},pending.length ? '가입을 기다리는 회원이 있습니다' : '가입 승인 대기를 모두 확인했습니다')),button('가입 승인 열기',() => go('pending'),pending.length ? 'primary' : 'secondary')),
        pending.length ? el('div',{},el('p',{class:'adm-note',role:'status'},`가입 승인 대기 전체 ${num(pending.length)}명 · 현재 ${num(preview.length)}명 표시${pending.length > preview.length ? ` · 나머지 ${num(pending.length - preview.length)}명은 가입 승인 전체 목록에서 확인할 수 있습니다(첫 화면 최대 20명).` : ''}`),el('div',{class:'adm-task-list'},...preview.map(m => el('div',{class:'adm-task-row'},person(m),el('div',{class:'adm-task-meta'},badge(profileComplete(m) ? '정보 입력 완료' : '정보 미입력'),el('span',{class:'adm-note'},fmt(m.created_at)),button('검토',() => go('pending',{q:m.email || m.name}))))))) : el('p',{class:'adm-note'},'새 가입 신청이 도착하면 이곳에서 확인할 수 있습니다.'));
      return el('div',{class:'adm-stack adm-overview'},el('div',{class:'adm-stats'},stat('가입 승인 대기',pending.length,'pending','가입 정보를 확인하고 승인'),stat('사용 중인 회원',S.members.filter(m => m.status === 'active').length,'members',`전체 회원 ${num(S.members.length)}명`,{status:'active',q:'',grade:''}),stat('정보 미입력',incomplete.length,'pending','정보 입력 후 승인 가능',{complete:'no'})),featured,incomplete.length ? el('section',{class:'adm-panel'},el('h3',{},`정보 미입력 ${num(incomplete.length)}명`),el('p',{class:'adm-note'},'가입 정보를 아직 완료하지 않은 계정입니다. 승인 대기 인원에 포함하지 않으며 승인할 수 없습니다.'),button('미입력 계정 보기',() => go('pending',{complete:'no'}))) : null,
        // TASK-ADM: 회원 요청 버튼을 없앴으므로 요청 카드 대신, 예전 요청이 남아 있을 때만 정리 안내를 보여 준다.
        S.requests.length ? el('p',{class:'adm-callout'},`정리하지 않은 지난 이용 요청 ${num(S.requests.length)}건이 남아 있습니다. `,button('지난 요청 정리',() => go('requests'))) : null,
        el('section',{id:'admin-ai-summary',class:'adm-panel','aria-label':'이번 달 AI 이용 현황'}),el('div',{},el('section',{class:'adm-panel'},el('h3',{},'자주 하는 관리'),el('div',{class:'adm-quick-links'},...[[ 'matrix','메뉴 권한 조정','등급별 페이지·도구 접근'],['resources','메뉴 추가·정리','이름·주소·순서·지운 메뉴'],['articles','작성글모음 현황','남은 글·보관 기록'],['notice','새 소식 작성','인트라넷에 보일 한 줄'],['hits','방문 합계 확인','날짜별 방문·문의 클릭']].map(([key,title,detail]) => button(el('span',{},el('strong',{},title),el('small',{},detail)),() => go(key),'quick'))))));
    },
    pending() {
      const f = filters.pending, selected = new Set(), rowGrades = new Map();
      const q = filter(input('대기 회원 검색',f.q,{type:'search',placeholder:'이름 · 소속 · 이메일 · 연락처'}));
      const complete = filter(select('가입 정보 입력 여부',[['yes','가입 승인 대기 · 입력 완료'],['no','정보 미입력 · 승인 불가'],['','전체 계정']],f.complete));
      const grade = filter(gradeSelect('일괄 승인 등급',defaultGrade()));
      const body = el('div'), summary = el('span',{class:'adm-note','role':'status'});
      const approve = button('선택 회원 승인',() => {
        const chosen = pendingMembers().filter(m => selected.has(m.id));
        if (!grade.value) return toast('승인 등급을 먼저 선택해 주세요.',true);
        if (chosen.length !== selected.size) return toast('정보 미입력 계정은 승인할 수 없습니다. 목록을 새로고침해 주세요.',true);
        bulk(chosen,m => checkedUpdate(m.id,{status:'active',grade_id:+grade.value},true),`${gname(+grade.value)} 등급으로 승인`);
      },'primary',{disabled:true});
      const sync = () => { summary.textContent = `${selected.size}명 선택`; approve.disabled = !selected.size || !grade.value; };
      const draw = () => {
        const pending = pendingMembers(), incomplete = incompleteMembers(), allMembers = unapprovedMembers();
        const canApprove = m => m.status === 'pending' && profileComplete(m);
        const list = allMembers.filter(m => matches(f.q,m.name,m.branch,m.email,m.phone) && (!f.complete || (f.complete === 'yes') === canApprove(m)));
        const paging = pager(list,f,() => {selected.clear();draw();});
        const slice = pageRows(list,f), eligible = slice.filter(canApprove);
        const all = check('현재 페이지 승인 가능한 회원 모두 선택',eligible.length > 0 && eligible.every(m => selected.has(m.id)),e => { eligible.forEach(m => e.target.checked ? selected.add(m.id) : selected.delete(m.id)); draw(); });
        all.querySelector('input').disabled = !eligible.length;
        const shown = list.length ? `${num((f.page - 1) * 20 + 1)}~${num((f.page - 1) * 20 + slice.length)}번째` : '0명';
        const countNote = `가입 승인 대기 ${num(pending.length)}명 · 정보 미입력 ${num(incomplete.length)}명(승인 불가) · 검색·필터 결과 ${num(list.length)}명 · 현재 ${shown} 표시`;
        body.replaceChildren(el('p',{class:'adm-note',role:'status'},countNote),list.length ? el('div',{class:'adm-select-page'},all,el('span',{},'현재 페이지 승인 가능한 회원 선택')) : el('span'),list.length ? table(['선택','가입 정보','가입일·정보 입력','승인 등급','처리'],slice.map(m => {
          const eligibleMember = canApprove(m);
          const gs = filter(gradeSelect(`${m.name || m.email} 승인 등급`,rowGrades.get(m.id) ?? defaultGrade()));
          gs.disabled = !eligibleMember;
          gs.addEventListener('change',()=>rowGrades.set(m.id,gs.value));
          const selection = check(`${m.name || m.email} 선택`,selected.has(m.id),e => {e.target.checked ? selected.add(m.id) : selected.delete(m.id);sync();all.querySelector('input').checked = eligible.length > 0 && eligible.every(x => selected.has(x.id));});
          selection.querySelector('input').disabled = !eligibleMember;
          return el('tr',{'data-signup-state':eligibleMember ? 'ready' : 'incomplete'},el('td',{},selection),el('td',{},person(m)),el('td',{},el('span',{},fmt(m.created_at)),el('br'),badge(eligibleMember ? '정보 입력 완료' : '정보 미입력'),!eligibleMember ? el('small',{class:'adm-note'},'본인 정보 입력 후 승인 가능') : null),el('td',{},gs),el('td',{},el('div',{class:'adm-actions'},button('승인',() => { if (!canApprove(m)) return toast('정보 미입력 계정은 승인할 수 없습니다.',true); if (confirmAction(`${m.name || m.email} (${m.email || m.id}) 님을 ${gname(+gs.value)} 등급으로 가입 승인할까요?\n변경 범위: 승인 대기 → 사용 중, 선택한 등급 적용`)) mutate(() => checkedUpdate(m.id,{status:'active',grade_id:+gs.value},true),'가입을 승인했습니다.'); },'primary',{disabled:!eligibleMember || !S.grades.length}),m.status === 'pending' ? button('거절',() => { if (confirmAction(`${m.name || m.email} 님의 가입을 거절하고 계정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) mutate(() => sb.rpc('reject_member',{p_id:m.id}),'가입을 거절했습니다.'); },'danger') : null)));
        }),'가입 승인 및 정보 미입력 계정') : empty('조건에 맞는 계정이 없습니다','검색어나 정보 입력 필터를 확인해 주세요.'),paging);
        sync();
      };
      q.addEventListener('input',() => { f.q = q.value; f.page = 1; selected.clear(); draw(); }); complete.addEventListener('change',() => {f.complete = complete.value;f.page = 1;selected.clear();draw();});
      draw();
      return el('div',{class:'adm-stack'},el('div',{class:'adm-toolbar'},field('대기 회원 검색',q),field('가입 정보',complete),button('검색·필터 초기화',() => go('pending'))),el('p',{class:'adm-note'},'이름·휴대폰·소속 본부·개인정보 동의를 모두 확인한 신청만 승인할 수 있습니다. 정보 미입력 계정은 별도로 분류합니다.'),el('div',{class:'adm-bulk'},summary,field('선택 회원에게 부여할 등급',grade),approve),body);
    },
    requests() {
      if (S.requestError) return el('div',{class:'adm-panel'},empty('승인 요청을 불러오지 못했습니다','연결 상태 또는 승인 요청 기능의 서버 설정을 확인해 주세요. 다른 관리 기능은 계속 사용할 수 있습니다.'),button('요청 다시 불러오기',() => mutate(async () => {await requestData();if(S.requestError)throw S.requestError;render();return {};},'요청 목록을 확인했습니다.',{reload:false})));
      const f = filters.requests, chosen = new Set();
      const q = filter(input('승인 요청 검색',f.q,{type:'search',placeholder:'회원 · 소속 · 등급 · 요청 메뉴'}));
      const body = el('div'), note = el('span',{class:'adm-note','role':'status'},'0건 선택');
      const done = button('선택 요청 완료 표시',() => bulk(S.requests.filter(r => chosen.has(r.id)),r => sb.rpc('resolve_access_request',{p_id:r.id}),'완료 표시 (메뉴 권한은 변경되지 않음)'),'primary',{disabled:true});
      const sync = () => {done.disabled = !chosen.size;note.textContent = `${chosen.size}건 선택`;};
      const draw = () => {
        const list = S.requests.filter(r => matches(f.q,r.member_name,r.member_email,r.member_branch,r.grade,r.resource_name,r.resource_category)).sort((a,b) => String(a.created_at).localeCompare(String(b.created_at)));
        const paging = pager(list,f,() => {chosen.clear();draw();});
        const slice = pageRows(list,f), all = check('현재 페이지 요청 모두 선택',slice.length > 0 && slice.every(r => chosen.has(r.id)),e => {slice.forEach(r => e.target.checked ? chosen.add(r.id) : chosen.delete(r.id));draw();});
        body.replaceChildren(list.length ? el('div',{class:'adm-select-page'},all,el('span',{},'현재 페이지 모두 선택')) : el('span'),list.length ? table(['선택','요청 회원','요청 내용','접수일','처리'],slice.map(r => {
          const member = S.members.find(m => m.email && m.email === r.member_email);
          return el('tr',{},el('td',{},check(`${r.member_name || '회원'} ${r.resource_name || '가입'} 요청 선택`,chosen.has(r.id),e => {e.target.checked ? chosen.add(r.id) : chosen.delete(r.id);sync();all.querySelector('input').checked=slice.every(a=>chosen.has(a.id));})),el('td',{},person({name:r.member_name,branch:r.member_branch,email:r.member_email,phone:member?.phone}),badge(r.grade || '등급 미지정')),el('td',{},el('strong',{},r.resource_name || '가입 승인 요청'),el('small',{class:'adm-note'},r.resource_category || '가입')),el('td',{},fmt(r.created_at)),el('td',{},el('div',{class:'adm-actions'},button(member?.status === 'pending' ? '가입 검토' : '권한 검토',() => member?.status === 'pending' ? go('pending',{q:r.member_email}) : go('matrix',{q:r.resource_name || '',grade:member?.grade_id || ''})),button('회원 보기',() => go('members',{q:r.member_email || r.member_name})),button('완료 표시',() => {if(confirmAction('이 요청을 완료로 표시할까요? 메뉴 권한은 바뀌지 않습니다.'))mutate(() => sb.rpc('resolve_access_request',{p_id:r.id}),'요청을 완료로 표시했습니다.');}))));
        }),'열린 승인 요청') : empty('열린 요청이 없습니다','권한이 열린 요청은 서버에서 자동으로 정리됩니다.'),paging);sync();
      };
      q.addEventListener('input',() => {f.q=q.value;f.page=1;chosen.clear();draw();});draw();
      return el('div',{class:'adm-stack'},el('p',{class:'adm-callout'},'이제 회원 화면에는 요청 버튼이 없고, 이용 범위는 등급으로만 정합니다. 남은 옛 요청은 확인한 뒤 완료 표시로 정리하세요. 완료 표시는 권한을 바꾸지 않습니다.'),field('승인 요청 검색',q),el('div',{class:'adm-bulk'},note,done),body,el('p',{class:'adm-note'},'서버에서 반환한 열린 요청을 최대 300건 표시합니다. 처리한 뒤 새로고침하면 다음 요청을 확인할 수 있습니다.'));
    },
    hits() {
      const body=el('div'),days=filter(select('방문 집계 기간',[[7,'최근 7일'],[30,'최근 30일'],[90,'최근 90일']],30));let sequence=0;
      const draw=async()=>{
        const seq=++sequence,period=+days.value;body.replaceChildren(el('div',{class:'adm-loading',role:'status'},'방문 합계를 불러오는 중…'));
        try{
          const r=await sb.rpc('site_hit_summary',{p_days:period});if(r.error)throw r.error;if(seq!==sequence)return;
          if(!Array.isArray(r.data))throw new Error('invalid response');
          const rows=r.data; if(!rows.length){body.replaceChildren(empty('집계 자료가 없습니다','기록이 쌓이면 이곳에서 확인할 수 있습니다.'));return;}
          const views=rows.reduce((a,x)=>a+(+x.views||0),0),joins=rows.reduce((a,x)=>a+(+x.join_clicks||0),0);
          const chart=(key,label,total)=>{
            const max=Math.max(1,...rows.map(x=>+x[key]||0));
            return el('div',{class:'adm-hit-chart',role:'img','aria-label':`최근 ${period}일 날짜별 ${label}. 합계 ${num(total)}회. 아래 날짜별 표에서 모든 값을 확인할 수 있습니다.`},...rows.map(r=>el('span',{class:'adm-hit-bar',style:`--bar:${Math.max(0,+r[key]||0)/max*100}%`,title:`${r.day} · ${label} ${num(r[key])}`})));
          };
          body.replaceChildren(el('div',{class:'adm-stack'},
            el('div',{class:'adm-hit-summary'},el('div',{class:'adm-panel'},el('span',{},'방문 합계'),el('strong',{},num(views))),el('div',{class:'adm-panel'},el('span',{},'합류 문의 클릭'),el('strong',{},num(joins)))),
            ...[['views','방문',views],['join_clicks','합류 문의 클릭',joins]].map(([key,label,total])=>el('section',{class:'adm-panel'},el('h3',{},`날짜별 ${label} · 최근 ${period}일`),chart(key,label,total),el('div',{class:'adm-chart-range'},el('span',{},rows[0].day),el('span',{},rows.at(-1).day)))),
            el('details',{class:'adm-panel adm-edit'},el('summary',{},'날짜별 방문·문의 클릭 표'),table(['날짜','방문','합류 문의 클릭'],rows.map(r=>el('tr',{},el('td',{},r.day),el('td',{},num(r.views)),el('td',{},num(r.join_clicks)))),'날짜별 방문 합계'))));
        }catch(e){if(seq!==sequence)return;body.replaceChildren(empty('방문 합계를 불러오지 못했습니다','연결 상태 또는 방문 집계 기능의 서버 설정을 확인해 주세요.'),button('다시 불러오기',draw));}
      };days.addEventListener('change',draw);draw();
      return el('div',{class:'adm-stack'},el('div',{class:'adm-toolbar'},field('집계 기간',days)),el('p',{class:'adm-note'},'메인·성장 스토리·인트라넷·개인정보처리방침의 페이지 방문 횟수입니다. 방문자 수와 다르며, IP·쿠키·기기 식별값은 저장하지 않습니다.'),body);
    }
  };
  const updateDraftNotice = () => { const note = document.getElementById('admin-draft-note'); if (note) note.hidden = !dirty; };
  const remember = control => {originals.set(control,controlValue(control));edited.delete(control);dirty=edited.size>0;updateDraftNotice();};
  // TASK-ADM: 메뉴 권한(admin-matrix.js)·회원 관리(admin-members.js)는 따로 둔 화면 모듈이 같은 공용 도구를 씁니다.
  const ctx = {sb,S,el,button,field,input,select,table,empty,toast,mutate,go,fmt,gname,confirmAction,errorText,remember,num,badge,person,filters,profileComplete,checkedUpdate,load,
    setDirty:value => { dirty = !!value; updateDraftNotice(); }, isBusy:() => busy, askClient:() => { if (!askClient && window.PA_ASK) askClient = window.PA_ASK.create(sb); return askClient; }};
  const settings = window.PA_ADMIN_SETTINGS ? window.PA_ADMIN_SETTINGS(ctx) : {};
  const modules = Object.assign({}, window.PA_ADMIN_MATRIX ? window.PA_ADMIN_MATRIX(ctx) : {}, window.PA_ADMIN_MEMBERS ? window.PA_ADMIN_MEMBERS(ctx) : {}, window.PA_ADMIN_ARTICLES ? window.PA_ADMIN_ARTICLES(ctx) : {}, window.PA_ADMIN_MENUS ? window.PA_ADMIN_MENUS(ctx) : {}); // TASK-ART: 작성글모음(admin-articles.js) · TASK-MENU: 메뉴 관리(admin-menus.js)
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(b){actionScope=b.closest('tr,details,.adm-panel') || b.closest('.adm-content');savesDraft=/저장|추가/.test(b.textContent);}},true);
  const trackDraft = e => {if(e.target.matches('[data-draft="true"]:not(.adm-filter)')){controlValue(e.target)===originals.get(e.target)?edited.delete(e.target):edited.add(e.target);dirty=edited.size>0;updateDraftNotice();}};
  box.addEventListener('input',trackDraft);
  box.addEventListener('change',trackDraft);
  window.addEventListener('beforeunload',e=>{if(dirty || busy){e.preventDefault();e.returnValue='';}});
  document.addEventListener('keydown',e=>{if(e.key==='/' && ready && !e.isComposing && !document.querySelector('dialog[open]') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,select,[contenteditable]')){const q=box.querySelector('input[type="search"]');if(q){e.preventDefault();q.focus();}}});
  window.addEventListener('hashchange', () => { const next = location.hash.slice(1).split('?')[0]; if (ready && TABS[next] && next !== tab) { go(next); if (tab !== next) history.replaceState(null,'','#' + tab); } });
  sb.auth.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'||(event!=='INITIAL_SESSION'&&sessionOwner!==undefined&&(session?.user?.id||null)!==sessionOwner)){loadVersion++;setBusy(false);gate('로그인 정보가 바뀌었습니다','다른 계정의 관리 정보가 남지 않도록 화면을 비웠습니다. 인트라넷에서 다시 로그인해 주세요.');}});
  boot();
})();
