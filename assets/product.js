/* Product UI uses the existing public question-queue JSONP interface.
   GAS deployment, API actions/arguments and polling intervals are unchanged. */
(function () {
  'use strict';
  const APP_URL = 'https://script.google.com/macros/s/AKfycbxjEXyJ7QvZvnncESLVU86_Qantb8Z_uAef9aK9Alsz17YjbK3iyJuVio0HQlwQaW4L/exec?v2=1';
  const HISTORY_KEY = 'pa-product-questions-v1';
  const byId = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = String(text); return n; };
  const arr = v => Array.isArray(v) ? v : [];
  const str = v => v == null ? '' : String(v);
  const sourceList = answer => arr(answer.sources).filter(source => source && typeof source === 'object' && !Array.isArray(source));
  const scroll = node => { node.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); };
  let sequence = 0, active = null, toastTimer, metaBusy = false, metaSignature = '', history = [], answers = new Map();
  byId('original-app').href = APP_URL;

  function api(action, params) {
    return new Promise((resolve, reject) => {
      const callback = 'paProduct_' + Date.now() + '_' + (++sequence);
      const url = new URL(APP_URL);
      url.search = '';
      url.searchParams.set('api', 'pq');
      url.searchParams.set('action', action);
      Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, str(v)));
      url.searchParams.set('callback', callback);
      const script = document.createElement('script');
      let finished = false;
      const timeout = setTimeout(() => finish(null, new Error('연결 시간이 초과되었습니다.')), ['submit','status','page'].includes(action) ? 120000 : 30000);
      function finish(data, error) {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        script.remove();
        // Ignore a response that arrives after timeout without touching a newer request.
        window[callback] = () => {};
        setTimeout(() => { delete window[callback]; }, 180000);
        if (error) reject(error); else resolve(data || {});
      }
      window[callback] = data => finish(data);
      script.onerror = () => finish(null, new Error('분석기에 연결하지 못했습니다.'));
      script.referrerPolicy = 'no-referrer';
      script.src = url.href;
      document.head.appendChild(script);
    });
  }
  function announce(text) {
    const node = byId('toast');
    clearTimeout(toastTimer); node.textContent = text; node.hidden = false;
    toastTimer = setTimeout(() => { node.hidden = true; }, 5000);
  }
  async function copy(text) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error();
      await navigator.clipboard.writeText(text); announce('출처를 포함해 복사했습니다.');
    } catch (_) {
      byId('copy-content').value = text;
      const dialog = byId('copy-dialog');
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      byId('copy-content').focus(); byId('copy-content').select();
    }
  }
  async function share(text, title) {
    if (navigator.share) {
      try { await navigator.share({title:title || '상품 통합 분석기', text}); return; }
      catch (error) { if (error.name === 'AbortError') return; }
    }
    await copy(text);
  }
  function processor(p) {
    if (!p) return;
    const online = p.online === true;
    document.querySelector('.px-connection').dataset.state = online ? 'online' : 'offline';
    byId('processor-state').textContent = online ? '자료 조회 연결됨' : '처리기 응답 없음';
    byId('connection-notice').hidden = online;
    byId('connection-notice').textContent = online ? '' : '자료 처리기가 응답하지 않습니다. 질문은 접수되며 처리기가 다시 연결되면 이어서 처리됩니다.';
  }
  const fallbackExamples = [
    '메리츠화재와 KB손보 암보험의 가입조건과 주의점을 비교해줘',
    '유병자(간편심사) 암보험의 가입조건을 확인해줘',
    '현대해상 운전자보험 이번 달 변경점을 정리해줘',
    '삼성화재 이번 달 소식지의 주력상품과 시책을 정리해줘'
  ];
  function fillExamples(examples) {
    byId('examples').replaceChildren();
    (examples.length ? examples : fallbackExamples).forEach(q => {
      const b = el('button','px-example',q); b.type = 'button';
      b.addEventListener('click', () => {
        byId('question').value = str(q).slice(0,600);
        // Examples are self-contained: do not silently inherit a previous filter.
        byId('insurer').value = ''; byId('category').value = '';
        updateComposer(); byId('question').focus(); scroll(byId('question-form'));
      });
      byId('examples').append(b);
    });
  }
  function fillOptions(id, values) {
    const select = byId(id), previous = select.value;
    const first = select.firstElementChild;
    select.replaceChildren(first);
    values.forEach(value => { const option = el('option','',value); option.value = value; select.append(option); });
    if (values.includes(previous)) select.value = previous;
  }
  async function loadMeta() {
    if (metaBusy) return;
    metaBusy = true; byId('connection-retry').disabled = true;
    try {
      const m = await api('meta');
      if (!m.ok) throw new Error();
      processor(m.processor);
      const lists = [m.insurers,m.categories,m.examples].map(values => arr(values).filter(value => typeof value === 'string' && value.trim()));
      const signature = JSON.stringify(lists);
      // A heartbeat must not remove the example button a keyboard user is on.
      if (signature !== metaSignature) {
        metaSignature = signature;
        fillOptions('insurer',lists[0]); fillOptions('category',lists[1]);
        fillExamples(lists[2]); updateComposer();
      }
    } catch (_) {
      document.querySelector('.px-connection').dataset.state = 'unknown';
      byId('processor-state').textContent = '연결 확인 불가';
      byId('connection-notice').hidden = false;
      byId('connection-notice').textContent = '분석기에 연결하지 못했습니다. 연결을 다시 확인하거나 상단의 기존 분석기를 열어 주세요.';
    } finally { metaBusy = false; byId('connection-retry').disabled = false; }
  }
  function composedQuestion() {
    let q = byId('question').value.trim();
    const insurer = byId('insurer').value, product = byId('category').value;
    if (insurer && !q.includes(insurer) && !q.includes(insurer.replace(/(손해보험|생명)$/,''))) q = insurer + ' ' + q;
    if (product && !q.includes(product.replace(/\(.*\)/,''))) q += ' (' + product + ')';
    return {q, insurer, product, raw:byId('question').value.trim()};
  }
  function updateComposer() {
    const q = composedQuestion();
    byId('question-count').textContent = q.q.length + ' / 600';
    byId('filter-summary').textContent = [q.insurer,q.product].filter(Boolean).join(' · ') || '선택 사항';
    byId('question-error').hidden = true; byId('question').removeAttribute('aria-invalid');
  }
  function setStep(n) {
    [1,2,3].forEach(i => {
      const node = byId('step-' + i); node.dataset.done = i < n ? 'true' : 'false';
      if (i === n) node.setAttribute('aria-current','step'); else node.removeAttribute('aria-current');
    });
  }
  function timeText(start) {
    const s = Math.max(0,Math.floor((Date.now()-start)/1000));
    return s >= 60 ? Math.floor(s/60) + '분 ' + (s%60) + '초' : s + '초';
  }
  function stopTimers(job) {
    if (!job) return;
    clearInterval(job.pollTimer); clearInterval(job.clockTimer);
  }
  function setBusy(value) {
    byId('ask-button').disabled = value;
    byId('ask-button').textContent = value ? '답변 기다리는 중' : '질문 보내기 ↗';
  }
  function beginWaiting(job) {
    job.paused = false;
    byId('progress').hidden = false; byId('stop-waiting').hidden = false; byId('stop-waiting').disabled = false;
    byId('resume-waiting').hidden = true; setBusy(true);
    job.clockTimer = setInterval(() => { if (active === job) byId('progress-time').textContent = timeText(job.started); },1000);
    job.pollTimer = setInterval(() => poll(job),2500);
    poll(job);
  }
  function pauseWaiting(message) {
    if (!active || !active.id) return;
    const job = active; job.paused = true; stopTimers(job); setBusy(false);
    byId('progress-title').textContent = '답변 확인을 멈췄습니다';
    byId('progress-message').textContent = message || '질문은 접수되어 있습니다. 같은 질문을 다시 보내지 않고 답변을 다시 확인할 수 있습니다.';
    byId('stop-waiting').hidden = true; byId('resume-waiting').hidden = false;
    remember(job, '확인 멈춤');
  }
  function remember(job, status) {
    if (!job.id || job.forget) return;
    const entry = {id:job.id,q:job.q,raw:job.raw,insurer:job.insurer,product:job.product,status,date:job.started};
    history = [entry,...history.filter(item => item.id !== job.id)].slice(0,8);
    for (const id of answers.keys()) if (!history.some(item => item.id === id)) answers.delete(id);
    saveHistory(); renderHistory();
  }
  function saveHistory() {
    try { sessionStorage.setItem(HISTORY_KEY,JSON.stringify(history)); }
    catch (_) { byId('storage-notice').hidden = false; }
  }
  function loadHistory() {
    try {
      history = arr(JSON.parse(sessionStorage.getItem(HISTORY_KEY)||'[]')).filter(x => x && typeof x.id==='string' && typeof x.q==='string' && x.q.length<=600 && Number.isFinite(x.date)).slice(0,8);
    } catch (_) { history=[]; byId('storage-notice').hidden=false; }
    renderHistory();
  }
  function renderHistory() {
    const host = byId('recent-questions'); host.replaceChildren();
    byId('clear-history').disabled = history.length === 0;
    if (!history.length) { host.append(el('div','px-empty','아직 질문이 없습니다.\n첫 질문을 보내면 여기에 남습니다.')); return; }
    history.forEach(item => {
      const b = el('button','px-recent'); b.type='button'; b.append(el('span','',item.q));
      b.append(el('small','',new Date(item.date).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · '+item.status));
      b.addEventListener('click',() => {
        if (active && !active.paused && !active.ended) { announce('진행 중인 답변을 확인하거나 기다림을 멈춘 뒤 기록을 열어 주세요.'); return; }
        byId('question').value=item.raw || item.q;
        byId('insurer').value=item.insurer||''; byId('category').value=item.product||''; updateComposer();
        const saved = answers.get(item.id);
        if (saved) { stopTimers(active); active=null; byId('progress').hidden=true; renderAnswer(saved.job,saved.response,false); return; }
        stopTimers(active);
        active={...item,started:item.date,paused:true,inFlight:false};
        byId('answer').hidden=true; byId('progress').hidden=false;
        byId('progress-title').textContent='최근 질문의 답변 확인';
        byId('progress-time').textContent='기존 접수 건';
        byId('progress-message').textContent=item.q;
        setStep(1); byId('stop-waiting').hidden=true; byId('resume-waiting').hidden=false;
        scroll(byId('progress')); byId('progress-title').focus({preventScroll:true});
      });
      host.append(b);
    });
  }
  async function ask(event) {
    if (event) event.preventDefault();
    if (active && !active.paused && !active.ended) return;
    const data = composedQuestion();
    let error='';
    if (data.raw.length<2) error='질문을 두 글자 이상 입력해 주세요.';
    if (data.q.length>600) error='선택한 조건을 포함해 600자 이내로 질문을 줄여 주세요.';
    if (error) { byId('question-error').textContent=error; byId('question-error').hidden=false; byId('question').setAttribute('aria-invalid','true'); byId('question').focus(); return; }
    stopTimers(active);
    const job={...data,started:Date.now(),id:null,paused:false,ended:false,inFlight:false}; active=job;
    setBusy(true); byId('answer').hidden=true; byId('progress').hidden=false;
    byId('progress-title').textContent='질문을 전송하고 있습니다'; byId('progress-message').textContent='접수가 확인되면 진행 상태를 표시합니다.';
    byId('progress-time').textContent='0초'; setStep(1);
    byId('stop-waiting').hidden=false; byId('stop-waiting').disabled=true; byId('resume-waiting').hidden=true;
    job.clockTimer=setInterval(() => {if(active===job) byId('progress-time').textContent=timeText(job.started);},1000);
    scroll(byId('progress')); byId('progress-title').focus({preventScroll:true});
    try {
      const r=await api('submit',{q:job.q,insurer:job.insurer,product:job.product,screen:window.innerWidth<700?'mobile':'desktop'});
      if(active!==job) return;
      if(!r.ok || !r.id) { job.rejected=true; throw new Error(); }
      job.id=str(r.id); processor(r.processor); remember(job,'접수 완료');
      byId('progress-title').textContent='접수 완료 · 처리 차례를 기다립니다';
      byId('progress-message').textContent=(r.ahead?'앞에 '+r.ahead+'건 대기 중. ':'')+(r.notice||'자료 조회가 시작되면 상태가 바뀝니다.');
      stopTimers(job); beginWaiting(job);
    } catch (_) {
      if(active!==job) return;
      stopTimers(job); job.ended=true; setBusy(false); byId('stop-waiting').hidden=true;
      byId('progress-title').textContent=job.rejected?'질문을 접수하지 못했습니다':'접수 여부를 확인하지 못했습니다';
      byId('progress-message').textContent=job.rejected?'질문 내용을 확인한 뒤 다시 보내 주세요.':'연결이 끊겼습니다. 질문이 이미 접수되었을 수 있으므로 잠시 기다린 뒤 다시 시도해 주세요. 자동으로 재전송하지 않습니다.';
    }
  }
  async function poll(job) {
    if(active!==job||job.paused||job.ended||job.inFlight||!job.id) return;
    job.inFlight=true;
    try {
      const r=await api('status',{id:job.id});
      if(active!==job||job.paused||job.ended) return;
      if(r.processor) processor(r.processor);
      if(!r.ok) { pauseWaiting('접수된 질문의 상태를 확인하지 못했습니다. 답변 다시 확인을 눌러 재확인해 주세요.'); return; }
      if(r.status==='완료') {
        stopTimers(job); job.ended=true; setBusy(false); byId('progress').hidden=true;
        if(!job.forget) answers.set(job.id,{job,response:r}); remember(job,'답변 도착'); renderAnswer(job,r,true); return;
      }
      if(r.status==='오류') {
        stopTimers(job); job.ended=true; setBusy(false); remember(job,'처리 오류');
        byId('progress-title').textContent='답변을 완료하지 못했습니다';
        byId('progress-message').textContent='자료 처리 중 오류가 발생했습니다. 질문을 수정한 뒤 다시 보내 주세요.';
        byId('stop-waiting').hidden=true; byId('resume-waiting').hidden=true; return;
      }
      if(r.status==='대기') { setStep(1); byId('progress-title').textContent='접수 완료 · 처리 차례 대기'; byId('progress-message').textContent=(r.ahead?'앞에 '+r.ahead+'건 대기 중. ':'')+(r.notice||'자료 처리기가 질문을 가져갈 때까지 기다립니다.'); rememberStatus(job,'대기 중'); }
      else if(r.status==='처리중') { setStep(2); byId('progress-title').textContent='자료를 조회하고 있습니다'; byId('progress-message').textContent=r.notice||'접수된 질문에 맞는 내부 자료를 찾고 있습니다.'; rememberStatus(job,'자료 조회 중'); }
      else if(r.status==='근거완료'||r.status==='답변중') { setStep(3); byId('progress-title').textContent='근거를 바탕으로 답변 작성 중'; byId('progress-message').textContent=r.notice||'조회한 자료를 상담에 활용할 수 있도록 정리하고 있습니다.'; rememberStatus(job,'답변 작성 중'); }
      else { byId('progress-title').textContent='답변 상태를 확인하고 있습니다'; byId('progress-message').textContent='처리 상태가 확인되면 이곳에 표시합니다.'; }
      if(r.giveUp) pauseWaiting(r.notice||'처리가 지연되어 자동 확인을 멈췄습니다. 잠시 후 답변을 다시 확인해 주세요.');
    } catch (_) {
      if(active===job&&!job.paused&&!job.ended) byId('progress-message').textContent='연결이 불안정합니다. 같은 접수 건의 답변을 다시 확인하고 있습니다.';
    } finally { job.inFlight=false; }
  }
  function rememberStatus(job,status) { const item=history.find(x=>x.id===job.id); if(!item||item.status!==status) remember(job,status); }
  function sourceText(s) { return [s.insurer,s.doc,s.page?'p.'+s.page:'',s.month?'기준월 '+s.month:'',s.date,s.docType].filter(Boolean).join(' · '); }
  function answerText(job,r) {
    const a=r.answer||{}, lines=['【질문】 '+job.q,'【결론】 '+(a.headline||'답변')+(a.basisMonth?' (기준월 '+a.basisMonth+')':'')];
    function section(label,items) { if(arr(items).length) lines.push('\n■ '+label,...items.map(x=>'- '+str(x))); }
    section('핵심 요약',a.summary);
    if(a.comparison&&arr(a.comparison.columns).length&&arr(a.comparison.rows).length) { lines.push('\n■ 비교',a.comparison.columns.join(' | ')); a.comparison.rows.forEach(row=>lines.push(arr(row).join(' | '))); }
    section('장점·경쟁력',a.pros); section('단점·주의점',a.cons); section('가입조건·인수기준',a.conditions); section('이달 시책·변경점',a.thisMonth);
    if(a.talk) lines.push('\n■ 설계사 화법\n'+a.talk);
    section('자료 없음·확인 필요',a.gaps);
    if(a.followup) lines.push('\n■ 추가 확인\n'+a.followup);
    if(sourceList(a).length) lines.push('\n■ 출처',...sourceList(a).map(s=>'['+str(s.n)+'] '+sourceText(s)));
    else lines.push('\n■ 출처\n제공된 출처가 없습니다. 근거를 추가 확인해 주세요.');
    if(a.noData) lines.push('\n관련 자료가 부족합니다.');
    lines.push('\n상품 통합 분석기 · 내부검색 자료 기준 자동 생성 답변입니다. 실제 설계·고지 전 원문과 전산을 확인하세요.');
    return lines.join('\n');
  }
  function citeText(host,text,sources) {
    const parts=str(text).split(/(\[\d{1,2}\])/g);
    parts.forEach(part=>{
      const match=part.match(/^\[(\d{1,2})\]$/);
      if(!match||!sources.some(s=>str(s.n)===match[1])) {host.append(document.createTextNode(part));return;}
      const b=el('button','px-cite',part); b.type='button'; b.setAttribute('aria-label','출처 '+match[1]+' 확인');
      b.addEventListener('click',()=>{const node=byId('source-'+match[1]); if(node) {scroll(node);node.focus({preventScroll:true});}});host.append(b);
    });
  }
  function renderAnswer(job,r,arrived) {
    const a=r.answer||{}, sources=sourceList(a), host=byId('answer');
    host.replaceChildren(); host.hidden=false;
    host.append(el('div','px-answer-question','질문 · '+job.q));
    const top=el('div','px-section-top'); top.append(el('span','px-eyebrow',arrived?'ANSWER READY':'RECENT ANSWER'));
    const actions=el('div','px-actions');
    [['답변 복사',()=>copy(answerText(job,r))],['공유',()=>share(answerText(job,r),'상품 분석 답변')],['새 질문',()=>{byId('question').value='';updateComposer();byId('question').focus();scroll(byId('question-form'));}]].forEach(([label,fn])=>{const b=el('button','px-btn',label);b.type='button';b.addEventListener('click',fn);actions.append(b);});
    top.append(actions);host.append(top);
    const title=el('h2'); title.id='answer-title';title.tabIndex=-1;citeText(title,a.headline||'분석 답변',sources);host.append(title);
    const tags=el('div','px-actions');if(a.basisMonth) tags.append(el('span','px-tag','기준월 '+a.basisMonth)); tags.append(el('span','px-tag',a.noData?'관련 자료 부족':'제공된 출처 '+sources.length+'건'));host.append(tags);
    if(a.noData||!sources.length) host.append(el('p','px-notice','확인할 수 있는 자료가 부족합니다. 아래의 확인 필요 항목과 원문을 검토해 주세요.'));
    function section(label,items) { if(!arr(items).length)return;const block=el('section','px-section');block.append(el('h3','',label));const ul=el('ul','px-list');items.forEach(text=>{const li=el('li');citeText(li,text,sources);ul.append(li);});block.append(ul);host.append(block); }
    section('핵심 요약',a.summary);
    if(a.comparison&&arr(a.comparison.columns).length&&arr(a.comparison.rows).length) {
      const section=el('section','px-section');section.append(el('h3','','상품 비교'),el('p','px-small','표가 넓으면 좌우로 이동해 확인하세요.'));
      const wrap=el('div','px-table-wrap');wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','상품 비교표 · 좌우 스크롤');
      const table=el('table'),caption=el('caption','sr','상품별 비교'),thead=el('thead'),tr=el('tr');a.comparison.columns.forEach(c=>{const th=el('th','',c);th.scope='col';tr.append(th);});thead.append(tr);table.append(caption,thead);
      const tbody=el('tbody');a.comparison.rows.forEach(row=>{const tr=el('tr');arr(row).forEach((cell,i)=>{const td=el(i===0?'th':'td');if(i===0)td.scope='row';citeText(td,cell,sources);tr.append(td);});tbody.append(tr);});table.append(tbody);wrap.append(table);section.append(wrap);host.append(section);
    }
    section('장점·경쟁력',a.pros);section('단점·주의점',a.cons);section('가입조건·인수기준',a.conditions);section('이달 시책·변경점',a.thisMonth);
    if(a.talk) {const block=el('section','px-talk');block.append(el('h3','','설계사 화법'));const p=el('p');citeText(p,a.talk,sources);block.append(p);host.append(block);}
    section('자료 없음 · 확인 필요',a.gaps);
    if(a.followup) host.append(el('p','px-notice','추가 확인 · '+a.followup));
    const src=el('section','px-sources');src.append(el('h3','','답변의 근거'),el('p','px-small','문서명 · 쪽 · 기준월을 확인하세요. 출처 번호는 아래 근거로 이동합니다.'));
    sources.forEach(s=>{const div=el('div','px-source','['+str(s.n)+'] '+sourceText(s));if(/^\d{1,2}$/.test(str(s.n)))div.id='source-'+s.n;div.tabIndex=-1;src.append(div);});
    if(!sources.length)src.append(el('p','px-small','제공된 출처가 없습니다.'));host.append(src);
    const timing=el('details','px-detail'),summary=el('summary','px-small','처리 정보');timing.append(summary,el('p','px-small',[r.searchSec!=null?'검색 '+Math.round(r.searchSec)+'초':'',r.answerSec!=null?'답변 '+Math.round(r.answerSec)+'초':'',r.model?'처리 모델 '+str(r.model).replace(/^openai:/,''):''].filter(Boolean).join(' · ')||'제공된 처리 정보가 없습니다.'));host.append(timing);
    host.append(el('p','px-small','내부검색 자료 기준 자동 생성 답변입니다. 실제 설계·고지 전 원문과 전산을 확인하세요.'));
    scroll(host);title.focus({preventScroll:true});announce(arrived?'답변이 도착했습니다. 근거를 함께 확인하세요.':'최근 답변을 열었습니다.');
  }
  function showTab(name,focus) {
    ['product','news','now'].forEach(key=>{
      const on=key===name,tab=byId('tab-'+key);tab.setAttribute('aria-selected',str(on));tab.tabIndex=on?0:-1;byId('panel-'+key).hidden=!on;
      if(on&&focus)tab.focus();
    });
    if(name==='news')window.ProductLibrary.loadNews();
    if(name==='now')window.ProductLibrary.loadNow();
  }
  ['product','news','now'].forEach((name,index,keys)=>{
    const tab=byId('tab-'+name);tab.addEventListener('click',()=>showTab(name,false));
    tab.addEventListener('keydown',event=>{let next=index;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();showTab(keys[next],true);});
  });
  byId('question-form').addEventListener('submit',ask);
  byId('question').addEventListener('input',updateComposer);
  byId('question').addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.isComposing){event.preventDefault();ask();}});
  ['insurer','category'].forEach(id=>byId(id).addEventListener('change',updateComposer));
  byId('stop-waiting').addEventListener('click',()=>pauseWaiting());
  byId('resume-waiting').addEventListener('click',()=>{if(active&&active.id&&active.paused){byId('progress-title').textContent='접수된 답변을 다시 확인합니다';beginWaiting(active);}});
  byId('connection-retry').addEventListener('click',loadMeta);
  byId('clear-history').addEventListener('click',()=>{history=[];answers.clear();if(active)active.forget=true;saveHistory();renderHistory();announce('이 탭의 최근 질문을 지웠습니다.');});
  window.ProductLibrary.init({api,el,byId,copy,share,processor,announce,scroll});
  loadHistory();fillExamples(fallbackExamples);loadMeta();
  let heartbeat=setInterval(loadMeta,30000);
  window.addEventListener('pagehide',()=>{stopTimers(active);clearInterval(heartbeat);});
  window.addEventListener('pageshow',event=>{
    if(!event.persisted)return;
    loadMeta();clearInterval(heartbeat);heartbeat=setInterval(loadMeta,30000);
    if(active&&active.id&&!active.paused&&!active.ended){stopTimers(active);beginWaiting(active);}
  });
})();
