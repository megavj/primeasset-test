/* 프리미엄 실전상담 통합코치: 운영 원본 Index.html의 3개 모드·문구·응답 렌더링을 이식합니다. */
(function(){
  'use strict';

  var app=document.getElementById('app'), kchat=document.getElementById('kchat'),
      input=document.getElementById('input'), send=document.getElementById('send'),
      rwrap=document.getElementById('rwrap'), rhead=document.getElementById('rhead'),
      left=document.getElementById('left'), overlay=document.getElementById('overlay'), modal=document.getElementById('modal'),
      diagform=document.getElementById('diagform');

  var MODE='coach', convo=[], attachedFiles=[], lastScripts=[], BUSY=false, filePending=0, fileGeneration=0;
  var SB=null, ME=null, guard=null;
  var SESSION=newSid();
  function newSid(){ return 'S'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

  // 로그인 안내는 홈페이지와 같게, 실제 회원·관리자 권한은 사본 GAS에서 다시 확인합니다.
  const COACH_API_URL = 'https://script.google.com/macros/s/AKfycbwCF7f9U7R7gvM4dNSGJeabSKYz2A5OBu8sqADWbKTjIMdqUTeeOTkRDooirt4JJ0l4/exec';
  const LEGACY_URL = 'https://script.google.com/macros/s/AKfycbyKIz_hvVDlcVscBdGbJ1VCZIHRSz6yrLqRxyAH8WzJfqfQwdVMC-emgg2mPTxVPIk/exec';
  function showGate(html) {
    document.getElementById('coach-gate').hidden=false;
    document.getElementById('coach-gate-msg').innerHTML=html;
    app.hidden=true;
    var panel=document.getElementById('coach-gate');
    if(window.PA_SIGNUP&&!panel.querySelector('.pa-signup-guide'))panel.append(window.PA_SIGNUP.guide());
  }
  function safeUrl(value) { try { var u=new URL(String(value||'')); return u.protocol==='https:'&&!u.username&&!u.password; } catch(e){return false;} }
  function clearSession() {
    ME=null; reset(); clearDiagnostic(); setBusy(false); LASTREQ=null; input.value=''; modal.replaceChildren(); overlay.close();
    document.getElementById('adminBtn').hidden=true;
    document.getElementById('coach-legacy-wrap').hidden=true;
    document.getElementById('coach-legacy').removeAttribute('href');
    showGate('로그인 정보가 바뀌어 입력과 답변을 지웠습니다. <a href="">화면 다시 열기</a>');
  }
  function api(action,payload,generation) { return guard.request(COACH_API_URL,action,payload,generation); }
  async function legacyLink(generation) {
    var url=LEGACY_URL;
    try {
      var r=await SB.rpc('my_menu');
      var candidates=(Array.isArray(r.data)?r.data:[]).filter(function(x){
        var other=/보상\s*답변|보상\s*AI|보험금\s*청구\s*답변|전산\s*답변/i.test(x.name||'')||/AKfycbzNrEdi_|AKfycbz4WjJLM6OR|1ZyOPAVHmWW65aRKq05QFk|AKfycbzVbO8_XxSq8|AKfycbxWVCohTpOA3|AKfycbzfFExpXscK87|\/members\/(claim|it|coach)/.test(x.url||'');
        return !other&&x.unlocked&&safeUrl(x.url);
      });
      var item=candidates.find(function(x){return /AKfycbyKIz|AKfycbw6JIh|AKfycbz8vba3|1rIZRrzlYTgq5g0omTg_02q73sUi83Fp8US200QeoXQc4iPC5Wef6FHZQ/.test(x.url||'');})||candidates.find(function(x){return /통합\s*코치|실전\s*상담|영업\s*비서/.test(x.name||'');});
      if(item)url=item.url;
    }catch(e){}
    if(generation!==guard.current())return;
    document.getElementById('coach-legacy').href=url;document.getElementById('coach-legacy-wrap').hidden=false;
  }
  async function boot() {
    try {
      SB=await window.paClient();
      guard=window.paToolSession(SB,clearSession);
      var session=await guard.initialize(),generation=guard.current();
      if(!session)return showGate('설계사 로그인 후 쓸 수 있어요. <a href="/members/#login">로그인하기</a>');
      var profile=await SB.rpc('my_profile');guard.check(generation);
      if(profile.error)throw new Error('회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
      var member=await window.PA_SIGNUP.resolveProfile(SB,profile.data&&profile.data[0],session);guard.check(generation);
      if(!window.PA_SIGNUP.complete(member))return showGate('가입 정보를 먼저 입력해 주세요. 이름·휴대폰·소속 본부와 개인정보 동의를 완료해야 가입 신청이 접수됩니다. <a href="/members/#signup">가입 정보 입력</a>');
      if(!member||member.status!=='active')return showGate(member&&member.status==='pending'?'가입 승인 대기 중이에요. 관리자가 승인하면 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>':'가입 승인된 설계사만 쓸 수 있어요. <a href="/members/#home">인트라넷으로</a>');
      legacyLink(generation);
      var memberInfo=await api('whoami',{},generation);guard.check(generation);ME=memberInfo;
      document.getElementById('coach-gate').hidden=true;app.hidden=false;
      document.getElementById('adminBtn').hidden=!(ME.user&&ME.user.admin);
      var status=document.getElementById('coach-status');status.textContent=ME.ai&&ME.ai.ready?'AI 답변 준비됨':'서비스 준비 중입니다. 잠시 후 이용해 주세요.';status.classList.toggle('is-ready',!!(ME.ai&&ME.ai.ready));
      document.getElementById('coach-limit').textContent='회원별 1시간 '+Number(ME.limits&&ME.limits.perHour||30)+'회';
      reset();applyModeUI();setChips(DEFAULTS);

    } catch(e) {if(e.code!=='stale_session')showGate(esc(e.message||'잠시 후 다시 열어 주세요.'));}
  }

  // 데스크탑/모바일
  var VIEW=window.innerWidth<860?'mob':'desk';
  var modeBtn=document.getElementById('modeBtn'), tabChat=document.getElementById('tabChat'), tabPanel=document.getElementById('tabPanel');
  function applyView(){ app.classList.toggle('mob',VIEW==='mob'); app.classList.toggle('desk',VIEW==='desk'); modeBtn.textContent=VIEW==='mob'?'🖥 데스크탑':'📱 모바일'; }
  modeBtn.onclick=function(){ VIEW=VIEW==='mob'?'desk':'mob'; applyView(); };
  function setTab(){} applyView();

  // 모드 전환
  document.getElementById('mCoach').onclick=function(){ switchMode('coach'); };
  document.getElementById('mRole').onclick=function(){ switchMode('roleplay'); };
  document.getElementById('mDiag').onclick=function(){ switchMode('diagnostic'); };
  function switchMode(m){ if(BUSY||filePending||m===MODE) return; MODE=m;
    ['mCoach','mRole','mDiag'].forEach(function(id,i){document.getElementById(id).setAttribute('aria-pressed',String(['coach','roleplay','diagnostic'][i]===m));});
    document.getElementById('mCoach').classList.toggle('act',m==='coach');
    document.getElementById('mRole').classList.toggle('act',m==='roleplay');
    document.getElementById('mDiag').classList.toggle('act',m==='diagnostic');
    reset(); applyModeUI(); }
  function applyModeUI(){ var c=MODE==='coach', r=MODE==='roleplay', d=MODE==='diagnostic';
    document.getElementById('chips').style.display=c?'flex':'none';
    document.getElementById('rolebar').style.display=r?'flex':'none';
    document.getElementById('diagbar').style.display=d?'flex':'none';
    document.getElementById('fileBtn').style.display=c?'block':'none';
    kchat.style.display=d?'none':'flex';
    document.querySelector('.inwrap').style.display=d?'none':'block';
    diagform.style.display=d?'block':'none';
    rhead.textContent=c?'분석 · 코칭':(r?'상담 피드백':'영업역량 진단결과');
    input.placeholder=c?'상황을 질문하거나 상담 내용을 붙여넣거나 파일을 첨부하세요':(r?'고객 카톡에 답할 내용을 입력하세요':'번호별 답변을 입력하세요');
    document.getElementById('hint').textContent=c?'Enter 전송 · Shift+Enter 줄바꿈 · 파일 드래그 첨부':'Enter 전송 · Shift+Enter 줄바꿈'; }

  var POOL=['비싸다고 거절할 때','자료만 달라고 할 때','배우자랑 상의한다고 할 때','다른 곳도 알아본다고 할 때','나중에 한다고 할 때','소개 요청하는 법','잠수 고객 깨우기','첫 인사 멘트','확신 주는 클로징','상담 흐름 분석','실비만 가입한다고 할 때','암보험 필요하냐고 물을 때','인터넷이 더 싸다고 할 때','병력 있어 가입 걱정할 때','전화상담으로 유도하기','가족력으로 보장 확장','상령일 임박 안내','유병자보험 권유 화법'];
  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i];a[i]=a[j];a[j]=t; } return a; }
  var DEFAULTS=shuffle(POOL).slice(0,8);
  function setChips(list){ var c=document.getElementById('chips'); c.innerHTML='';
    (list&&list.length?list:DEFAULTS).forEach(function(q){ var el=document.createElement('button'); el.type='button'; el.className='chip'; el.textContent=q; el.onclick=function(){ if(send.disabled)return; input.value=q; autosize(); submit(); }; c.appendChild(el); }); }
  document.getElementById('startBtn').onclick=function(){ startRoleplay(); };

  Array.prototype.forEach.call(document.querySelectorAll('.diaganswer'),function(a){ a.addEventListener('input',updateDiagProgress); });
  document.getElementById('diagSubmit').onclick=submitDiagnostic;
  function updateDiagProgress(){ var n=0; Array.prototype.forEach.call(document.querySelectorAll('.diaganswer'),function(a){if(a.value.trim())n++;}); document.getElementById('diagCount').textContent=n+' / 6'; }
  function clearDiagnostic(){ Array.prototype.forEach.call(document.querySelectorAll('.diaganswer'),function(a){a.value='';a.closest('.dq').classList.remove('missing');}); document.getElementById('diagErr').style.display='none'; updateDiagProgress(); }
  function submitDiagnostic(){ if(BUSY||filePending)return;var answers=[], missing=[]; Array.prototype.forEach.call(document.querySelectorAll('.diaganswer'),function(a){var v=a.value.trim();a.closest('.dq').classList.toggle('missing',!v);if(!v)missing.push(a);answers.push(v);});
    if(missing.length){document.getElementById('diagErr').style.display='block';missing[0].focus();return;}
    document.getElementById('diagErr').style.display='none';
    var text='[영업능력 진단 6문항 답변]\n'+answers.map(function(v,i){return (i+1)+'. '+v;}).join('\n\n');
    sendToServer(text,[]);
  }

  // 이름을 다시 수집하거나 별도로 저장하지 않고 승인 회원 정보를 사용합니다.
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.close();});
  overlay.addEventListener('close',function(){document.getElementById('adminBtn').focus();});

  function reset(){ convo=[]; LASTREQ=null; lastScripts=[]; SESSION=newSid(); clearAttach(); kchat.innerHTML='';
    document.getElementById('diagSubmit').textContent='진단 결과 보기';
    document.getElementById('stage').textContent='버튼을 누르면 무작위 고객이 카톡을 보냅니다';
    if(MODE==='coach'){ addBubble('sys','상황을 질문하거나 실제 상담 내용(PDF·이미지·텍스트)을 첨부하세요.\n추천 멘트는 왼쪽 카톡으로, 상세 분석·코칭은 오른쪽에 표시됩니다.');
      rwrap.innerHTML='<div class="rempty">질문하면 분석·코칭이 여기에 표시됩니다.</div>'; }
    else if(MODE==='roleplay'){ addBubble('sys','상담연습 모드\n위 "상담시작"을 누르면 무작위 고객이 카톡을 보냅니다.\n설계사처럼 답하면 점수·피드백·모범화법을 드려요.');
      rwrap.innerHTML='<div class="rempty">답변하면 점수·피드백·모범 카톡화법이 여기에 표시됩니다.</div>'; }
    else{ clearDiagnostic();
      rwrap.innerHTML='<div class="rempty">왼쪽 핵심 6문항을 작성하고 진단 결과 보기를 누르면 총점·강점·보완점·7일 실행과제를 보여드립니다.</div>'; }
  }

  // 버블
  function addReq(text,fileCount){ var d=document.createElement('div'); d.className='req'; d.textContent='요청 · '+text.slice(0,50)+(text.length>50?'…':'')+(fileCount?'  📎 '+fileCount+'개':''); kchat.appendChild(d); down(); }
  function addBubble(kind,text){
    if(kind==='you'){ lab('고객'); } if(kind==='ai'){ lab('AI 추천'); }
    var b=document.createElement('div'); b.className='kb '+kind; var sp=document.createElement('span'); sp.textContent=text; b.appendChild(sp);
    if(kind==='me'||kind==='ai'){ var c=document.createElement('button'); c.type='button'; c.className='kc'; c.textContent='복사'; c.onclick=function(){ copyText(text); }; b.appendChild(c); }
    kchat.appendChild(b); down();
  }
  function lab(t){ var l=document.createElement('div'); l.className='klabel'; l.textContent=t; kchat.appendChild(l); }
  function down(){ kchat.scrollTop=kchat.scrollHeight; }

  // 입력/전송
  function autosize(){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,130)+'px'; }
  input.addEventListener('input',autosize);
  input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();} });
  send.addEventListener('click',submit);
  document.getElementById('newChat').onclick=function(){ if(BUSY||filePending)return; reset(); (MODE==='diagnostic'?document.querySelector('.diaganswer'):input).focus(); };

  function startRoleplay(){ if(BUSY||filePending)return;convo=[]; kchat.innerHTML=''; SESSION=newSid(); addBubble('sys','🎲 새 고객을 부르는 중…'); sendToServer('상담시작', []); }

  function submit(){ if(BUSY||filePending)return;var text=input.value.trim();
    if(!text && !attachedFiles.length) return;
    if(MODE==='coach'){ if(!text&&attachedFiles.length) text='첨부한 상담 내용을 분석해 주세요.'; addReq(text, attachedFiles.length); }
    else{ addBubble('me', text); }
    var fs=attachedFiles.slice(); clearAttach(); input.value=''; autosize(); sendToServer(text,fs); }

  async function sendToServer(text,files){
    if(BUSY||filePending)return;
    var generation=guard.current();
    // 진단 재시도도 마지막 사용자 입력을 중복해서 쌓지 않습니다.
    if(convo.length&&convo[convo.length-1].role==='user')convo.pop();
    convo.push({role:'user',content:text});setBusy(true);LASTREQ={text:text,files:files};
    var t=document.createElement('div');t.className='typing';t.setAttribute('role','status');t.innerHTML='<i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><b class="tstage">질문 분석 중…</b>';
    var stg=['질문 분석 중…','상황 정리 중…','멘트 작성 중…','마무리 중…'],si=0;
    var stT=setInterval(function(){si=Math.min(si+1,stg.length-1);var el=t.querySelector('.tstage');if(el)el.textContent=stg[si];},6000);
    if(MODE!=='diagnostic'){kchat.appendChild(t);down();}else{document.getElementById('diagSubmit').textContent='진단 중…';}
    try{
      var res=await api('callClaude',{req:{mode:MODE,messages:convo,sessionId:SESSION,files:files}},generation);
      if(!ME||generation!==guard.current())return;
      if(!validResult(MODE,res.data))throw new Error('답변을 완성하지 못했습니다. 다시 받아 주세요.');
      convo.push({role:'assistant',content:JSON.stringify(res.data||{})});
      (MODE==='coach'?renderCoach:(MODE==='roleplay'?renderRole:renderDiagnostic))(res.data||{});
      if(MODE==='diagnostic')document.getElementById('diagSubmit').textContent='다시 진단하기';
    }catch(err){
      if(generation!==guard.current())return;
      if(MODE==='diagnostic'){document.getElementById('diagSubmit').textContent='다시 시도';toast(err.message||'통신 오류');}
      else{addBubble('sys','⚠ '+(err.message||'통신 오류'));addRetry();}
      if(err.code==='unauthorized'||err.code==='forbidden'){showGate(esc(err.message)+' <a href="/members/#login">로그인하기</a>');}
    }finally{clearInterval(stT);t.remove();if(generation===guard.current())setBusy(false);if(ME&&!app.hidden)(MODE==='diagnostic'?document.getElementById('diagSubmit'):input).focus({preventScroll:true});}
  }

  // v32: 실패 시 같은 질문으로 다시 받기(입력 다시 칠 필요 없음)
  var LASTREQ=null;
  function addRetry(){ if(!LASTREQ) return; var b=document.createElement('button'); b.className='retrybtn'; b.textContent='↻ 다시 받기';
    b.onclick=function(){ if(send.disabled) return; b.remove(); if(convo.length&&convo[convo.length-1].role==='user') convo.pop(); sendToServer(LASTREQ.text, LASTREQ.files||[]); };
    kchat.appendChild(b); down(); }

  function validResult(mode,d) {
    const text=(v)=>typeof v==='string'&&v.trim().length>0;
    const strings=(v)=>Array.isArray(v)&&v.length>0&&v.every(text);
    if(!d||typeof d!=='object'||Array.isArray(d)||d._parseFail)return false;
    if(mode==='coach')return Array.isArray(d.scripts)&&text(d.analysis)&&(d.scripts.length ? d.scripts.every((s)=>text(s)||(s&&text(s.text))) : /(?:도와드릴 수 없|답변할 수 없|제공할 수 없|상담.*관련|보험.*관련|안내할 수 없)/.test(d.analysis));
    if(mode==='roleplay') {
      if(d.feedback==null)return text(d.customer);
      const f=d.feedback, scripts=f.model_script||f.scripts;
      const score=typeof f.score==='number'?f.score:(typeof f.score==='string'&&/^\d{1,3}(?:\/100)?$/.test(f.score)?Number(f.score.split('/')[0]):NaN);
      return f&&typeof f==='object'&&Number.isFinite(score)&&score>=0&&score<=100&&text(f.strengths)&&text(f.weaknesses)&&strings(scripts);
    }
    if(d.status==='questions')return text(d.message)&&strings(d.questions);
    if(!Number.isFinite(d.score)||d.score<0||d.score>100||!text(d.grade)||!Array.isArray(d.scores)||!d.scores.length)return false;
    if(!d.scores.every((s)=>s&&text(s.name)&&Number.isFinite(s.score)&&Number.isFinite(s.max)&&s.max>0&&s.score>=0&&s.score<=s.max&&text(s.reason)))return false;
    return Math.abs(d.scores.reduce((n,s)=>n+s.score,0)-d.score)<0.01&&strings(d.strengths)&&strings(d.gaps)&&strings(d.actions);
  }

  // 렌더: 화법
  function normScripts(arr){ if(!Array.isArray(arr)) return []; return arr.map(function(x){ return (typeof x==='string')?{len:'',label:'',text:x}:{len:(x&&x.len||''),label:(x&&x.label||''),text:(x&&typeof x.text==='string'?x.text:'')}; }).filter(function(o){return o.text;}); }
  function addScriptBubble(o){
    if(o.len||o.label){ var l=document.createElement('div'); l.className='klabel mine'; l.textContent=(o.len?'['+o.len+'] ':'')+(o.label||''); kchat.appendChild(l); }
    var b=document.createElement('div'); b.className='kb me'; var sp=document.createElement('span'); sp.textContent=o.text; b.appendChild(sp);
    var c=document.createElement('button'); c.type='button'; c.className='kc'; c.textContent='복사'; c.onclick=function(){ copyText(o.text); }; b.appendChild(c);
    kchat.appendChild(b); down();
  }
  function renderCoach(d){
    if(d._parseFail){ addBubble('sys','답변을 받지 못했습니다. 아래 "다시 받기"를 눌러 주세요.'); addRetry(); setPanel('<div class="rempty">답변을 완성하지 못했습니다. 다시 받아 주세요.</div>'); return; }
    var sc=normScripts(d.scripts);
    if(sc.length) sc.forEach(addScriptBubble);
    else if(d.analysis) addBubble('sys', d.analysis);
    var html='';
    if(d.recommended) html+='<div class="sec">가장 추천하는 답변</div><div class="scard"><div class="stext">'+esc(d.recommended)+'</div><button class="copyrec">복사</button></div>';
    if(d.summary) html+='<div class="qsum">📝 '+esc(d.summary)+'</div>';
    if(d.analysis) html+='<div class="sec">상황 분석</div><div class="ptext">'+esc(d.analysis)+'</div>';
    if(d.coaching) html+='<div class="sec">코칭 포인트</div><div class="ptext">'+esc(d.coaching)+'</div>';
    if(d.expected_response) html+='<div class="sec">예상 고객 반응</div><div class="ptext">'+esc(d.expected_response)+'</div>';
    if(d.follow_up) html+='<div class="sec">그때 보낼 후속답변</div><div class="scard"><div class="stext">'+esc(d.follow_up)+'</div><button class="copyfollow">복사</button></div>';
    if(d.compliance) html+='<div class="compl"><b>⚖ 준법 체크</b><br>'+esc(d.compliance)+'</div>';
    setPanel(html||'<div class="rempty">표시할 내용이 없습니다.</div>');
    var cr=rwrap.querySelector('.copyrec'); if(cr)cr.onclick=function(){copyText(d.recommended||'');};
    var cf=rwrap.querySelector('.copyfollow'); if(cf)cf.onclick=function(){copyText(d.follow_up||'');}; }

  // 렌더: 상담연습
  function renderRole(d){
    if(d._parseFail){ addBubble('sys','답변을 받지 못했습니다. 아래 "다시 받기"를 눌러 주세요.'); addRetry(); setPanel('<div class="rempty">답변을 완성하지 못했습니다. 다시 받아 주세요.</div>'); return; }
    if(d.stage){ document.getElementById('stage').textContent='🎬 '+d.stage; addBubble('sys','🎬 '+d.stage); }
    var fb=d.feedback;
    if(fb){ var ms=fb.model_script||fb.scripts||[];
      var html='<div class="sec">점수</div><div class="score">'+esc(String(fb.score==null?'-':fb.score))+'</div>'
        +'<div class="sec">잘한 점</div><div class="ptext">'+esc(fb.strengths||'-')+'</div>'
        +'<div class="sec">보완할 점</div><div class="ptext">'+esc(fb.weaknesses||'-')+'</div>';
      if(fb.breakdown) html+='<div class="sec">항목별 평가</div><div class="ptext">'+Object.keys(fb.breakdown).map(function(k){return esc(k)+': '+esc(fb.breakdown[k]);}).join('<br>')+'</div>';
      if(ms.length) html+='<div class="sec">모범 카톡 화법</div>'+scards(ms)+'<button class="copyall">모범화법 전체 복사</button>';
      if(fb.compliance) html+='<div class="compl"><b>⚖ 준법 체크</b><br>'+esc(fb.compliance)+'</div>';
      setPanel(html, ms); }
    else setPanel('<div class="rempty">고객 카톡에 설계사처럼 답해보세요. 답변하면 점수·피드백·모범화법이 표시됩니다.</div>');
    if(d.customer) addBubble('you', d.customer); }

  function renderDiagnostic(d){
    if(d._parseFail){setPanel('<div class="rempty">진단 답변을 받지 못했습니다. 아래 "다시 받기"를 눌러 주세요.</div><button class="retrybtn" id="diagRetry">↻ 다시 받기</button>');document.getElementById('diagRetry').onclick=function(){if(LASTREQ&&!BUSY)sendToServer(LASTREQ.text,LASTREQ.files||[]);};return;}
    if(d.status==='questions'){
      setPanel('<div class="ptext">'+esc(d.message||'')+'</div>'+(d.questions||[]).map(function(q){return '<div class="qsum">'+esc(q)+'</div>';}).join('')+'<div class="rempty">질문에 번호별로 답해 주세요. 답변이 부족하면 빠진 번호만 다시 안내합니다.</div>');return;
    }
    var scores=d.scores||[], html='<div class="qsum">'+esc(d.summary||'영업역량 진단')+'</div>'
      +'<div class="sec">총점 · 등급</div><div class="score">'+esc(String(d.score||0))+'점</div><div class="ptext">'+esc(d.grade||'')+'</div>'
      +'<div class="sec">항목별 점수</div>'+scores.map(function(s){return '<div class="scard"><b>'+esc(s.name)+'</b> · '+esc(s.score)+'/'+esc(s.max)+'<div class="ptext">'+esc(s.reason||'')+'</div></div>';}).join('')
      +'<div class="sec">강점</div><div class="ptext">'+esc((d.strengths||[]).join('\n'))+'</div>'
      +'<div class="sec">보완이 필요한 부분</div><div class="ptext">'+esc((d.gaps||[]).join('\n'))+'</div>'
      +'<div class="sec">7일 실행과제</div>'+scards(d.actions||[])
      +'<div class="sec">코치 메시지</div><div class="ptext">'+esc(d.motivation||'')+'</div>'
      +'<div class="compl"><b>한 줄 결론</b><br>'+esc(d.one_line||'')+'</div>';
    setPanel(html,d.actions||[]);Array.prototype.forEach.call(rwrap.querySelectorAll('.suse'),function(b){b.hidden=true;}); }

  function scards(a){ return a.map(function(s,i){ return '<div class="scard"><div class="stext">'+esc(s)+'</div><button class="suse" data-i="'+i+'">이 답변 입력창에 넣기</button><button class="scopy" data-i="'+i+'">복사</button></div>'; }).join(''); }
  function setPanel(html,scripts){ rwrap.innerHTML=html; lastScripts=scripts||[];
    Array.prototype.forEach.call(rwrap.querySelectorAll('.scopy'),function(b){ b.onclick=function(){ copyText(lastScripts[+b.getAttribute('data-i')]||''); }; });
    Array.prototype.forEach.call(rwrap.querySelectorAll('.suse'),function(b){ b.onclick=function(){ input.value=lastScripts[+b.getAttribute('data-i')]||''; autosize(); input.focus(); toast('입력창에 넣었어요. 수정 후 전송하세요'); if(VIEW==='mob'){ try{document.getElementById('left').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}catch(e){} } }; });
    var ca=rwrap.querySelector('.copyall'); if(ca) ca.onclick=function(){ copyText(lastScripts.join('\n\n')); };
    rwrap.scrollTop=0; if(VIEW==='mob'){ try{ document.getElementById('right').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}); }catch(e){} } }

  // 파일
  var fileInput=document.getElementById('fileInput');
  document.getElementById('fileBtn').onclick=function(){ fileInput.click(); };
  fileInput.onchange=function(){ for(var i=0;i<fileInput.files.length;i++) handleFile(fileInput.files[i]); fileInput.value=''; };
  left.addEventListener('dragover',function(e){ e.preventDefault();if(MODE!=='coach'||BUSY)return;left.classList.add('drag'); });
  left.addEventListener('dragleave',function(e){ if(!left.contains(e.relatedTarget)) left.classList.remove('drag'); });
  left.addEventListener('drop',function(e){e.preventDefault();left.classList.remove('drag');if(MODE!=='coach'||BUSY)return;var fs=e.dataTransfer.files;for(var i=0;i<fs.length;i++)handleFile(fs[i]);});
  function handleFile(file){
    if(BUSY||MODE!=='coach'||!ME)return;
    if(attachedFiles.length+filePending>=10){toast('파일은 최대 10개까지 가능합니다');return;}
    var generation=fileGeneration;filePending++;setBusy(BUSY);
    readFile(file).then(function(f){if(generation===fileGeneration){attachedFiles.push(f);renderAttach();}}).catch(function(m){if(generation===fileGeneration)toast(m);}).finally(function(){filePending=Math.max(0,filePending-1);setBusy(BUSY);});
  }
  function renderAttach(){
    var a=document.getElementById('attach');
    if(!attachedFiles.length){ a.classList.remove('on'); a.innerHTML=''; return; }
    a.classList.add('on');
    a.innerHTML=attachedFiles.map(function(f,i){ var ic=f.kind==='pdf'?'📄':f.kind==='image'?'🖼️':'📝'; return '<span class="achip"><span class="nm">'+ic+' '+esc(f.name)+'</span><button type="button" class="x" aria-label="'+esc(f.name)+' 첨부 제거" data-i="'+i+'">✕</button></span>'; }).join('');
    Array.prototype.forEach.call(a.querySelectorAll('.x'),function(b){ b.onclick=function(){ if(BUSY)return;attachedFiles.splice(+b.getAttribute('data-i'),1); renderAttach(); }; });
  }
  function clearAttach(){ fileGeneration++;attachedFiles=[]; renderAttach(); }
  function readFile(file){ return new Promise(function(resolve,reject){
    var name=file.name||'file', type=file.type||'';
    var isImg=/^image\//.test(type)||/\.(png|jpe?g|webp|gif)$/i.test(name), isPdf=type==='application/pdf'||/\.pdf$/i.test(name), isTxt=/^text\//.test(type)||/\.(txt|csv|md)$/i.test(name);
    if((isImg||isPdf)&&file.size>10*1024*1024){ reject('파일이 너무 큽니다(약 10MB 이하).'); return; }
    var r=new FileReader();
    if(isTxt){ r.onload=function(){ resolve({kind:'text',mime:type,name:name,data:String(r.result).slice(0,200000)}); }; r.onerror=function(){reject('읽기 실패');}; r.readAsText(file); }
    else if(isImg||isPdf){ r.onload=function(){ resolve({kind:isPdf?'pdf':'image',mime:isPdf?'application/pdf':(type||'image/png'),name:name,data:String(r.result).split(',')[1]}); }; r.onerror=function(){reject('읽기 실패');}; r.readAsDataURL(file); }
    else reject('PDF · 이미지 · TXT 만 가능합니다.'); }); }

  // 공통
  async function copyText(t){
    try{if(navigator.clipboard){await navigator.clipboard.writeText(String(t));}else{var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();var copied=document.execCommand('copy');ta.remove();if(!copied)throw new Error('copy');}toast('복사되었습니다 ✓');}
    catch(e){toast('복사하지 못했어요. 내용을 직접 선택해 복사해 주세요.');}
  }
  var toastT;function toast(m){var el=document.getElementById('toast');el.textContent=m;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove('on');},6000);}
  function setBusy(b){
    BUSY=b;var locked=b||filePending>0;
    ['send','input','newChat','mCoach','mRole','mDiag','startBtn','diagSubmit'].forEach(function(id){document.getElementById(id).disabled=locked;});
    document.getElementById('fileBtn').disabled=b;
    document.querySelectorAll('.diaganswer,.chip,.attach .x').forEach(function(el){el.disabled=b;});
    app.setAttribute('aria-busy',String(b));
  }
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  // 승인된 관리자만 표시하며 서버에서도 is_admin을 확인합니다.
  document.getElementById('adminBtn').onclick=loadAdmin;
  async function loadAdmin(){
    if(!ME||!ME.user||!ME.user.admin)return;
    modal.innerHTML='<h2 id="adminTitle">관리자 모드</h2><p role="status">불러오는 중…</p><button class="ghost" id="adminClose">닫기</button>';
    document.getElementById('adminClose').onclick=function(){overlay.close();};overlay.showModal();
    var generation=guard.current();
    try{var stats=await api('adminData',{},generation);guard.check(generation);renderStats(stats);}catch(e){if(generation!==guard.current())return;modal.innerHTML='<h2 id="adminTitle">관리자 모드</h2><p role="alert">'+esc(e.message)+'</p><button class="ghost" id="adminClose">닫기</button>';document.getElementById('adminClose').onclick=function(){overlay.close();};}
  }
  function renderStats(s){
    var daily=Array.isArray(s.daily)?s.daily:[],agents=Array.isArray(s.agents)?s.agents:[],keywords=Array.isArray(s.keywords)?s.keywords:[],recent=Array.isArray(s.recent)?s.recent:[];
    var maxd=Math.max.apply(null,daily.map(function(d){return Number(d.count)||0;}).concat([1]));
    var over=s.budget>0&&s.monthCost>=s.budget,bp=s.budget>0?Math.min(100,Math.max(0,s.monthCost/s.budget*100)):0;
    var html='<h2 id="adminTitle">사용 통계 <small> · '+esc(s.model)+'</small></h2>'
      +'<div class="cards">'+card(s.total,'총 사용')+card(s.coachN,'화법')+card(s.roleN,'상담연습')+card(s.diagnosticN||0,'영업능력 진단')+card(s.today,'오늘')+card(s.sessions,'세션')+card('$'+s.cost,'누적비용')+card((s.accessStats||{}).total||0,'총 접속')+card((s.accessStats||{}).success||0,'로그인 성공')+card((s.accessStats||{}).today||0,'오늘 접속')+'</div>'
      +'<div class="sec">비용 가드레일 (이번 달)</div><div class="budget"><div>$'+esc(s.monthCost)+(s.budget>0?' / 예산 $'+esc(s.budget)+(over?'  ⚠ 초과':''):'  (예산 미설정)')+'</div>'+(s.budget>0?'<div class="bbar"><div class="bfill'+(over?' over':'')+'" style="width:'+bp+'%"></div></div>':'')+'</div>'
      +'<div class="sec">설정</div><form id="adminConfig" class="cfgrow">'
      +'<div class="field"><label for="cfgModel">클로드 모델</label><select id="cfgModel">'+['claude-opus-5-5','claude-sonnet-5-5'].map(function(m){return '<option value="'+m+'"'+(s.model===m?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div>'
      +'<div class="field"><label for="cfgBudget">월 예산($,0=무제한)</label><input id="cfgBudget" type="number" min="0" step="any" required value="'+esc(s.budget||0)+'"></div><button class="btn" id="cfgSave" type="submit">저장</button></form><p id="cfgOk" role="status"></p>'
      +'<div class="sec">최근 14일 추이</div><div class="bars" role="list" aria-label="최근 14일 사용 횟수">'+daily.map(function(d){return '<div class="bar" role="listitem" aria-label="'+esc(d.date)+' '+esc(d.count)+'회"><div class="fill" style="height:'+(Math.max(0,Number(d.count)||0)/maxd*100)+'%"></div><div class="d">'+esc(d.date)+'</div></div>';}).join('')+'</div>'
      +'<div class="sec">설계사별 사용 TOP</div><div class="kw">'+(agents.length?agents.map(function(a){return '<span>'+esc(a.name)+' <b>'+esc(a.count)+'</b></span>';}).join(''):'<span>데이터 없음</span>')+'</div>'
      +'<div class="sec">자주 묻는 키워드</div><div class="kw">'+(keywords.length?keywords.map(function(k){return '<span>'+esc(k.word)+' <b>'+esc(k.count)+'</b></span>';}).join(''):'<span>데이터 없음</span>')+'</div>'
      +'<div class="sec">최근 기록 (마스킹)</div><div class="coach-table"><table><caption class="sr-only">최근 사용 기록</caption><thead><tr><th scope="col">시각</th><th scope="col">설계사</th><th scope="col">모드</th><th scope="col">내용</th></tr></thead><tbody>'
      +(recent.length?recent.map(function(r){return '<tr><td>'+esc(r.time)+'</td><td>'+esc(r.who)+'</td><td>'+esc(r.mode)+'</td><td>'+esc(r.q)+'</td></tr>';}).join(''):'<tr><td colspan="4">데이터 없음</td></tr>')+'</tbody></table></div>'
      +'<div class="foot">'+(safeUrl(s.sheetUrl)?'<a href="'+esc(s.sheetUrl)+'" target="_blank" rel="noopener noreferrer">전체 시트 열기 ↗</a>':'<span></span>')+'<button class="ghost" id="adC2">닫기</button></div>';
    modal.innerHTML=html;
    document.getElementById('adC2').onclick=function(){overlay.close();};
    document.getElementById('adminConfig').onsubmit=async function(event){
      event.preventDefault();var save=document.getElementById('cfgSave'),out=document.getElementById('cfgOk');
      var model=document.getElementById('cfgModel').value,budget=Number(document.getElementById('cfgBudget').value);
      if(!Number.isFinite(budget)||budget<0){out.textContent='월 예산은 0 이상의 숫자로 입력해 주세요.';return;}
      save.disabled=true;save.textContent='저장 중…';out.textContent='';
      try{await api('adminSave',{model:model,budget:budget});out.textContent='저장됨 ✓';}catch(e){out.textContent=e.message;}finally{save.disabled=false;save.textContent='저장';}
    };
  }
  function card(n,l){return '<div class="card"><div class="n">'+esc(n==null?0:n)+'</div><div class="l">'+esc(l)+'</div></div>';}
  window.paToolReady=window.paToolReady||{};window.paToolReady.coach=true;
  boot();

})();
