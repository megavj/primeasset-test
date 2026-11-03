(function(){
"use strict";
var LOCK='<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
var REDUCED=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js-rv');

/* ================= DATA ================= */
var STEPS=WIKI.steps, CATS=WIKI.cats, GLOSS=WIKI.gloss;
var GROUP_KO={PRODUCT:"상품",RULES:"제도",SALES:"영업"};
var GMAP={};GLOSS.forEach(function(g){GMAP[g[0]]=g;});
function T(k,label){var g=GMAP[k];return '<span class="term" tabindex="0" data-t="'+k+'">'+(label||g[1].split(' (')[0])+'</span>';}

/* ================= STATE ================= */
var member=false;
// Private material is never shipped in this preview.
var pendingTarget=null, observers=[];
var app=document.getElementById('app');
var staticBody=window.WIKI_STATIC?app.innerHTML:null;

function findChild(id){for(var i=0;i<CATS.length;i++){var c=CATS[i];for(var j=0;j<c.children.length;j++){if(c.children[j].id===id)return {cat:c,doc:c.children[j]};}}return null;}
function catById(id){for(var i=0;i<CATS.length;i++){if(CATS[i].id===id)return CATS[i];}return null;}
function docHref(ch){return ch.step?'#sales" data-target="step-'+ch.step:'#doc-'+ch.id;}
function totalDocs(){var n=0;CATS.forEach(function(c){if(!c.route)n+=c.children.length;});return n+1;}

/* ================= LOCK ================= */
function lockBlock(title,desc,inner){
  if(member){return '<div class="unlocked"><span class="badge-m">'+LOCK+' MEMBERS</span>'+inner+'</div>';}
  var ghost='';for(var i=0;i<5;i++){ghost+='<i style="width:'+(60+((i*37)%38))+'%"></i>';}
  return '<div class="locked"><div class="ghosttext">'+ghost+'</div><div class="over"><b>'+LOCK+title+'</b><span>'+desc+'</span><button class="btn sm" type="button" data-login>로그인하고 보기</button></div></div>';
}

/* ================= ATLAS (보험카테고리 지도) ================= */
/* 노드: [label, kind, route, target, children]  kind: M=main pill, S=sub pill, s=small pill, t=text */
function N(t,k,to,tg,ch){return {t:t,k:k,to:to,tg:tg||null,ch:ch||[]};}
var MAP={
 left:[
  N('병원비보험','M','cat-hospital',null,[
    N('1. 실손의료비','S','doc-silson',null,[
      N('일반실비/유병자실비/노후실비','t','doc-silson','s0'),
      N('가입시기별 조건','t','doc-silson','s3',[
        N('보상조건','t','doc-silson','s1',[N('입원/통원, 상해/질병 면책사항','t','doc-silson','s1')]),
        N('유지조건','t','doc-silson','s2',[N('실비의 갱신 및 재가입조건, 전환실비','t','doc-silson','s2')])]),
      N('국민건강보험과 상품의구조','t','doc-silson','s4')]),
    N('2. 3대진단비','S','doc-diag',null,[
      N('a. 암','s','doc-diag','s0',[
        N('일반암','t','doc-diag','s0'),
        N('소액암','t','doc-diag','s0',[N('갑상선 · 기타피부 · 경계성 · 제자리','t','doc-diag','s0'),N('그 밖의 별도 분류는 담보별 확인','t','doc-diag','s0')]),
        N('고액암','t','doc-diag','s1',[N('고액암의 범위는 담보별 확인','t','doc-diag','s1')]),
        N('재진단암과 이차암','t','doc-diag','s2'),
        N('암수술과 암입원일당','t','doc-diag','s3')]),
      N('b. 뇌질환','s','doc-diag','s4',[
        N('뇌혈관질환','t','doc-diag','s4'),
        N('뇌졸중','t','doc-diag','s4',[N('뇌출혈','t','doc-diag','s4'),N('뇌경색','t','doc-diag','s4')])]),
      N('c. 심장질환','s','doc-diag','s5',[N('허혈성심장질환','t','doc-diag','s5')])]),
    N('3. 후유장해','S','doc-disab',null,[N('질병후유장해','t','doc-disab','s0'),N('상해후유장해','t','doc-disab','s1'),N('장해분류표','t','doc-disab','s2')]),
    N('4. 배상책임','S','doc-liab',null,[N('자녀/일상/가족배상책임보험','t','doc-liab','s0'),N('배상책임 사례','t','doc-liab','s1')]),
    N('5. 운전자보험','S','doc-driver',null,[N('교통사고처리지원비 형사합의금','t','doc-driver','s0'),N('벌금','t','doc-driver','s1'),N('변호사비용','t','doc-driver','s2'),N('교통사고부상치료비','t','doc-driver','s3')]),
    N('6. 수술비','S','doc-surg',null,[N('수술의 정의와 사례','t','doc-surg','s0'),N('생손보 종수술비 및 특정수술','t','doc-surg','s1')]),
    N('7. 기타','S','doc-hosp-etc',null,[N('입원일당','t','doc-hosp-etc','s0'),N('기타','t','doc-hosp-etc','s1')])]),
  N('화재보험','M','cat-fire',null,[N('화재보험의 의의','t','doc-fire-basic','s0'),N('화재보험의 구조 및 종류','t','doc-fire-basic','s1'),N('화재보험의 담보구성','t','doc-fire-cover','s0')]),
  N('자동차보험','M','cat-auto',null,[N('대인보상','t','doc-auto-cover','s0'),N('대물보상','t','doc-auto-cover','s1'),N('자상/자손 차이','t','doc-auto-cover','s2'),N('자동차보험 약관','t','doc-auto-terms','s0'),N('기타 추가가능한 특약 및 자동차보험 가입 팁','t','doc-auto-terms','s1')]),
  N('약관','M','cat-terms',null,[N('상법과 보험업법','t','doc-law','s0'),N('보통약관','t','doc-general',null,[N('부담보/실효/부활/납입면제/철회/통지의무','t','doc-general','s0')]),N('특별약관','t','doc-special','s0'),N('분쟁사례 및 판례','t','doc-dispute','s0')])
 ],
 right:[
  N('사망보험','M','cat-death',null,[
    N('1. 종신보험','S','doc-whole',null,[N('CI보험','t','doc-whole','s1',[N('중대한의 의미와 컨셉','t','doc-whole','s2')]),N('GI보험','t','doc-whole','s1')]),
    N('2. 정기보험','S','doc-termlife'),
    N('3. 재해사망과 상해사망','S','doc-accdeath',null,[N('재해사망과 상해사망의 차이점','t','doc-accdeath','s0')]),
    N('4. 질병사망과 일반사망','S','doc-disdeath'),
    N('5. 알아야할 내용','S','cat-death',null,[N('상해의 입증요소 3가지: 외래성/우연성/급격성','t','doc-accdeath','s1'),N('사망의 원인 및 확률, 보장범위','t','doc-disdeath','s1'),N('종신보험의 구조','t','doc-whole','s0'),N('보상 조건, 납입면제/추가납입/중도인출/납입정지, 연금전환','t','doc-whole','s3')])]),
  N('저축(연금)보험','M','cat-annuity',null,[
    N('공시이율형 상품','S','doc-fixed',null,[
      N('a. 연금저축','s','doc-fixed','s0',[N('세액공제의개념 및 장단점','t','doc-fixed','s0'),N('연금펀드','t','doc-fixed','s1')]),
      N('b. 연금보험','s','doc-fixed','s2'),N('c. 저축보험','s','doc-fixed','s3'),N('d. 종신보험을 이용한 저축플랜','s','doc-fixed','s4')]),
    N('변액투자형 상품','S','doc-variable',null,[N('a. 변액유니버셜저축보험 VUL','s','doc-variable','s0'),N('b. 변액연금보험 VA','s','doc-variable','s1')]),
    N('알아야 할 내용','S','doc-taxfree',null,[N('비과세 및 비과세 조건','t','doc-taxfree','s0'),N('변액상품에서의 펀드 개념, 관리방법','t','doc-variable','s2'),N('상품적인 기능에 대한 차이점','t','doc-taxfree','s1')])]),
  N('판매채널','M','cat-channel',null,[
    N('원수사','t','doc-ga','s0'),
    N('대리점(GA)','t','doc-ga','s1',[N('연합','t','doc-ga','s1'),N('독립','t','doc-ga','s1')]),
    N('영업규정/수수료/근무환경','t','doc-ga','s2'),
    N('영업방식','t','cat-channel',null,[
      N('대면영업','t','doc-offline',null,[
        N('지인/DB/브리핑/개척/법인영업 등','t','doc-offline','s0'),
        N('재무설계','t','doc-offline','s1',[N('수입/지출/상품관리','t','doc-offline','s1'),N('금융기초','t','doc-offline','s2',[N('은행/증권사/보험사','t','doc-offline','s2')]),N('정보받기-재무목표 설정-상품 제안','t','doc-offline','s3')])]),
      N('비대면영업','t','doc-online',null,[
        N('카페/댓글/광고/SNS/블로그','t','doc-online','s0'),
        N('블로그 관련','t','doc-online','s1',[
          N('포스팅 기본 양식','t','doc-online','s1',[N('상위노출 조건-로직','t','doc-online','s1'),N('블로그 컨셉 잡기','t','doc-online','s2')]),
          N('로열키워드란?','t','doc-online','s2'),
          N('포스팅방식','t','doc-online','s3',[N('검색량/포스팅수/제한키워드/노출기준확인 등','t','doc-online','s3'),N('고객의 입장에서 찾기','t','doc-online','s3')])]),
        N('유튜브 및 네이버TV','t','doc-online','s4'),
        N('SNS를 활용한 마케팅','t','doc-online','s4')])])])
 ],
 far:[
  N('일반 고지의무','M','doc-disclosure','d2',[
    N('최근 진단·치료·의심소견과\n질문서에서 정한 확인 기간','t','doc-disclosure','d2'),
    N('추가검사·재검사 이력과 질문 기간','t','doc-disclosure','d2'),
    N('입원·수술·치료·투약 이력\n기간과 계속 여부는 질문서 확인','t','doc-disclosure','d2'),
    N('질문서에 열거된 질병의 진단·치료\n상품별 질문 범위를 직접 확인','t','doc-disclosure','d2'),
    N('직업/위험취미/키-몸무게','t','doc-disclosure','d2')]),
  N('간편고지의무','M','doc-disclosure','d3',[
    N('간편보험도 상품마다 질문이 다름','t','doc-disclosure','d3'),
    N('입원·수술·추가검사 필요소견\n질문서에서 정한 기간 확인','t','doc-disclosure','d3'),
    N('입원·수술 이력과 질문 기간','t','doc-disclosure','d3'),
    N('질문에 포함된 질병의 진단·치료','t','doc-disclosure','d3')]),
  N('그외','M','cat-basics',null,[
    N('보험금청구 및 절차','t','doc-claim','s0',[N('고지의무 위반시 프로세스','t','doc-disclosure','d4')]),
    N('고지의무 적용방법 및 보상','t','doc-claim','s1'),
    N('수익자 지정 및 케이스','t','doc-benef','s0'),
    N('환급형과 순수보장형, 적립보험료','t','doc-refund','s0'),
    N('갱신형과 비갱신형','t','doc-renew','s0'),
    N('80세만기와 100세만기','t','doc-maturity','s0'),
    N('납입기간과 무해지상품','t','doc-nonrefund','s0'),
    N('주요 질병의 원인/통계/치료법/인수기준','t','doc-disease','s0'),
    N('화법과 컨셉','t','sales','step-2'),
    N('세일즈프로세스','t','sales','step-1')])
 ],
 chain:'가망고객 발굴 - AP(접근, 자기소개 및 분위기 전환) - 니즈환기(필요성 느끼기) - FF(팩트 파인딩, 정보요청) - PT(견적 제안 및 절차 안내) - CL(클로징, 마무리멘트, 결정시키기) - 계약 - 관리(꾸준한 연락 및 보상관리) - 소개받기(소개받은 고객은 가망고객으로)',
 boxes:[
  ['가망고객',['지인영업','DB영업','온라인영업','개척영업','브리핑영업','가망고객관리방식']],
  ['AP',['신뢰도 높이기','- 자기소개','- 명함전달','- 상담과정안내','분위기전환','- 아이스브레이킹','- 칭찬하기','- 공통관심사찾기']],
  ['니즈환기',['감성자극하기','객관적인 안내하기','보상사례 안내']],
  ['FF',['인적정보 및 병력정보','기가입보험증권','가족관계 및 가족력','기존 누락된 보상건 찾기','그외 특이사항']],
  ['PT',['카테고리를 이용한 제안','상품비교를 통한','제안분석프로그램의 활용']],
  ['클로징',['AP~PT까지의 반복','마무리 화법']],
  ['관리',['3대기본지키기','고객정보 정리','관리일정 정리']],
  ['소개',['캘린더를 이용한','정보전달/리뷰','보상관리']]]
};

var AT={W:1876,ROW:22,FS:{M:20,S:15,s:14,t:13.5},H:{M:46,S:30,s:26},PAD:{M:36,S:20,s:18},GAP:{pill:24,txt:13},CX:795,CR:62,LX:765,RX:825,FX:1404,TOP:64};
var _mctx=null,_mcache={};
function tw(s,fs,bold){
  var key=fs+'|'+(bold?'b':'n')+'|'+s;if(_mcache[key])return _mcache[key];
  if(!_mctx){var cv=document.createElement('canvas');_mctx=cv.getContext('2d');}
  _mctx.font=(bold?'700 ':'400 ')+fs+'px '+getComputedStyle(document.documentElement).getPropertyValue('--font').trim();
  var w=_mctx.measureText(s).width;_mcache[key]=w;return w;
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function aLayout(n){
  var k=n.k,fs=AT.FS[k];n.fs=fs;n.lines=n.t.split('\n');
  var maxw=0;n.lines.forEach(function(l){maxw=Math.max(maxw,tw(l,fs,k!=='t'));});
  n.w=k==='t'?maxw+4:maxw+AT.PAD[k];
  n.h=k==='t'?AT.ROW*n.lines.length:AT.H[k];
  var total=0,gap=0;
  n.ch.forEach(function(c){aLayout(c);total+=c.sh;if(c.k!=='t')gap=8;});
  if(n.ch.length>1)total+=gap*(n.ch.length-1);
  n.sh=Math.max(total,n.h+(k==='t'?0:10));
  var y=-total/2;n.ch.forEach(function(c){c.ry=y+c.sh/2;y+=c.sh+gap;});
}
function aPlace(n,x,cy,dir){
  n.cy=cy;n.dir=dir;
  if(dir==='R'){n.x0=x;n.x1=x+n.w;}else{n.x1=x;n.x0=x-n.w;}
  n.base=n.k==='t'?cy+(n.lines.length-1)*AT.ROW/2+AT.ROW/2-1:cy;
  var gap=n.k==='t'?AT.GAP.txt:AT.GAP.pill;
  n.ch.forEach(function(c){aPlace(c,dir==='R'?n.x1+gap:n.x0-gap,cy+c.ry,dir);});
}
function elbow(x1,y1,sx,y2,x2){
  if(Math.abs(y1-y2)<.5)return 'M'+x1+' '+y1+'H'+x2;
  var r=Math.min(7,Math.abs(y2-y1)/2),dx=sx>x1?1:-1,dy=y2>y1?1:-1,dx2=x2>sx?1:-1;
  return 'M'+x1+' '+y1+'H'+(sx-dx*r)+'Q'+sx+' '+y1+' '+sx+' '+(y1+dy*r)+'V'+(y2-dy*r)+'Q'+sx+' '+y2+' '+(sx+dx2*r)+' '+y2+'H'+x2;
}
var _aid=0,ANODES={};
function aRender(n,parent){
  var id='a'+(_aid++),dir=n.dir,s='';ANODES[id]=n;
  s+='<g class="nd k'+n.k+'" data-id="'+id+'" tabindex="0" role="link" aria-label="'+esc(n.t.replace(/\n/g,' '))+'">';
  if(parent){
    var gap=parent.k==='t'?AT.GAP.txt:AT.GAP.pill;
    var sx=dir==='R'?parent.x1+gap*.55:parent.x0-gap*.55;
    var py=parent.k==='t'?parent.base+3:parent.cy, px=dir==='R'?parent.x1:parent.x0;
    var cy=n.k==='t'?n.base+3:n.cy, ex=n.k==='t'?(dir==='R'?n.x1:n.x0):(dir==='R'?n.x0:n.x1);
    s+='<path class="ln" d="'+elbow(px,py,sx,cy,ex)+'"/>';
  }
  s+='<g class="lbl">';
  if(n.k==='t'){
    var ax=dir==='R'?n.x0+2:n.x1-2,anchor=dir==='R'?'start':'end';
    s+='<text class="tx" x="'+ax+'" y="'+(n.cy-(n.lines.length-1)*AT.ROW/2+n.fs*.36)+'" text-anchor="'+anchor+'" font-size="'+n.fs+'">';
    n.lines.forEach(function(l,i){s+='<tspan x="'+ax+'"'+(i?' dy="'+AT.ROW+'"':'')+'>'+esc(l)+'</tspan>';});
    s+='</text>';
  } else {
    s+='<rect class="sh" x="'+n.x0+'" y="'+(n.cy-n.h/2)+'" width="'+n.w+'" height="'+n.h+'" rx="'+(n.k==='M'?12:8)+'"/>';
    s+='<text class="tx" x="'+(n.x0+n.w/2)+'" y="'+(n.cy+n.fs*.36)+'" text-anchor="middle" font-size="'+n.fs+'">'+esc(n.t)+'</text>';
  }
  s+='</g>';
  n.ch.forEach(function(c){s+=aRender(c,n);});
  return s+'</g>';
}
function aStack(list,dir,x,top){
  var y=top,cys=[];
  list.forEach(function(n){aLayout(n);var cy=y+n.sh/2;aPlace(n,x,cy,dir);cys.push(cy);y+=n.sh+34;});
  return {bottom:y-34,cys:cys};
}
function buildAtlas(){
  _aid=0;ANODES={};
  var L=aStack(MAP.left,'L',AT.LX,AT.TOP),R=aStack(MAP.right,'R',AT.RX,AT.TOP),F=aStack(MAP.far,'R',AT.FX,AT.TOP+120);
  var mid=(AT.TOP+Math.max(L.bottom,R.bottom))/2,allc=L.cys.concat(R.cys).sort(function(a,b){return a-b;}),need=AT.CR*2+70;
  var best=null;for(var i=0;i<=allc.length;i++){var g0=i?allc[i-1]:AT.TOP-200,g1=i<allc.length?allc[i]:Math.max(L.bottom,R.bottom)+200,sz=g1-g0,c=(g0+g1)/2;if(sz<need)continue;var d=Math.abs(c-mid);if(!best||d<best.d)best={c:c,d:d};}
  var cy=Math.round(best?best.c:mid);
  var salesY=Math.max(L.bottom,R.bottom,F.bottom)+54;
  var H=salesY+70+22+172+40;
  var s='<svg class="atlas-svg" viewBox="0 0 '+AT.W+' '+H+'" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="보험 카테고리 지식지도">';
  s+='<defs><linearGradient id="gM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6b97e"/><stop offset="1" stop-color="#d6b97e"/></linearGradient>'+
     '<radialGradient id="gC" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#d6b97e"/><stop offset=".45" stop-color="#d6b97e"/><stop offset="1" stop-color="#d6b97e"/></radialGradient>'+
     '<radialGradient id="gHalo"><stop offset="0" stop-color="#d6b97e" stop-opacity="0"/><stop offset="1" stop-color="#d6b97e" stop-opacity="0"/></radialGradient>'+
     '<linearGradient id="gChain" x1="0" x2="1"><stop offset="0" stop-color="#d6b97e"/><stop offset=".5" stop-color="#d6b97e"/><stop offset="1" stop-color="#d6b97e"/></linearGradient></defs>';
  /* trunk */
  var ymin=Math.min.apply(null,allc.concat([cy])),ymax=Math.max.apply(null,allc.concat([cy]));
  s+='<g class="trunk"><line x1="'+AT.CX+'" y1="'+ymin+'" x2="'+AT.CX+'" y2="'+ymax+'"/>';
  L.cys.forEach(function(y){s+='<line x1="'+AT.LX+'" y1="'+y+'" x2="'+AT.CX+'" y2="'+y+'"/>';});
  R.cys.forEach(function(y){s+='<line x1="'+AT.CX+'" y1="'+y+'" x2="'+AT.RX+'" y2="'+y+'"/>';});
  s+='</g>';
  /* title block */
  s+='<g class="atlas-title"><text class="eyeb" x="60" y="'+(AT.TOP-22)+'">Prime Asset Premium · Insurance Wiki</text></g>';
  /* branches */
  var g='';MAP.left.forEach(function(n){g+=aRender(n,null);});MAP.right.forEach(function(n){g+=aRender(n,null);});MAP.far.forEach(function(n){g+=aRender(n,null);});
  s+='<g class="nodes">'+g+'</g>';
  /* center */
  s+='<g class="center" tabindex="0" role="button" aria-label="검색 열기"><circle cx="'+AT.CX+'" cy="'+cy+'" r="'+(AT.CR*2.1)+'" fill="url(#gHalo)"/><circle class="ring" cx="'+AT.CX+'" cy="'+cy+'" r="'+(AT.CR+8)+'"/><circle class="ring r2" cx="'+AT.CX+'" cy="'+cy+'" r="'+(AT.CR+8)+'"/>'+
     '<circle class="core" cx="'+AT.CX+'" cy="'+cy+'" r="'+AT.CR+'" fill="url(#gC)"/>'+
     '<text class="ct" x="'+AT.CX+'" y="'+(cy-6)+'" text-anchor="middle">보험</text><text class="ct" x="'+AT.CX+'" y="'+(cy+22)+'" text-anchor="middle">카테고리</text><text class="cs" x="'+AT.CX+'" y="'+(cy-30)+'" text-anchor="middle">PRIME · v3.0</text></g>';
  /* sales process */
  var bx=60,by=salesY,bw=236,bh=66;
  s+='<g class="sales"><g class="nd kB" data-id="sp" tabindex="0" role="link" aria-label="세일즈 프로세스"><g class="lbl"><rect class="sh" x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" rx="12"/><text class="tx" x="'+(bx+bw/2)+'" y="'+(by+28)+'" text-anchor="middle" font-size="17">세일즈 프로세스</text><text class="tx2" x="'+(bx+bw/2)+'" y="'+(by+50)+'" text-anchor="middle" font-size="12.5">Sales Process</text></g></g>';
  s+='<line class="chain-ln" x1="'+(bx+bw)+'" y1="'+(by+bh/2)+'" x2="'+(bx+bw+18)+'" y2="'+(by+bh/2)+'"/>';
  s+='<text class="chain" x="'+(bx+bw+26)+'" y="'+(by+bh/2+5)+'" font-size="13.5">'+esc(MAP.chain)+'</text>';
  ANODES.sp={t:'세일즈 프로세스',to:'sales',tg:'step-1'};
  var x=bx+bw+26,w=170,gapx=8,y0=by+bh+20;
  MAP.boxes.forEach(function(b,i){
    var id='sb'+i;ANODES[id]={t:b[0],to:'sales',tg:'step-'+(i+1)};
    s+='<g class="nd kX" data-id="'+id+'" tabindex="0" role="link" aria-label="'+(i+1)+'단계 '+esc(b[0])+'"><g class="lbl"><rect class="sh" x="'+x+'" y="'+y0+'" width="'+w+'" height="172" rx="12"/>';
    s+='<text class="bn" x="'+(x+14)+'" y="'+(y0+22)+'" font-size="11">STEP '+(i+1)+' · '+esc(b[0]).toUpperCase()+'</text>';
    b[1].forEach(function(l,j){s+='<text class="bl'+(l.charAt(0)==='-'?' sub':'')+'" x="'+(x+14+(l.charAt(0)==='-'?10:0))+'" y="'+(y0+44+j*16.5)+'" font-size="12.5">'+esc(l.replace(/^- /,''))+'</text>';});
    s+='</g></g>';x+=w+gapx;
  });
  s+='</g></svg>';
  return s;
}
/* mobile tree list */
function aList(n){
  var label=esc(n.t.replace(/\n/g,' '));
  if(!n.ch.length)return '<a class="al-item" href="#'+n.to+'"'+(n.tg?' data-target="'+n.tg+'"':'')+'>'+label+'</a>';
  return '<details class="al-'+n.k+'"><summary><span>'+label+'</span><a class="al-go" href="#'+n.to+'"'+(n.tg?' data-target="'+n.tg+'"':'')+' aria-label="'+label+' 열기">열기 →</a></summary><div class="al-kids">'+n.ch.map(aList).join('')+'</div></details>';
}
function buildAtlasList(){
  var all=MAP.left.concat(MAP.right,MAP.far);
  var sales='<details class="al-M"><summary><span>세일즈 프로세스</span><a class="al-go" href="#sales">열기 →</a></summary><div class="al-kids">'+MAP.boxes.map(function(b,i){return '<a class="al-item" href="#sales" data-target="step-'+(i+1)+'">'+(i+1)+'. '+esc(b[0])+'</a>';}).join('')+'</div></details>';
  return '<div class="atlas-list">'+all.map(aList).join('')+sales+'</div>';
}
function wireAtlas(){
  var box=document.getElementById('atlas');if(!box)return;
  var svg=box.querySelector('svg');if(!svg)return;
  var hov=null;
  function setHov(el){if(hov===el)return;if(hov)hov.classList.remove('hv');hov=el;if(hov){hov.classList.add('hv');svg.classList.add('hov');}else svg.classList.remove('hov');}
  svg.addEventListener('mouseover',function(e){var nd=e.target.closest('.nd');setHov(nd);});
  svg.addEventListener('mouseleave',function(){setHov(null);});
  svg.addEventListener('focusin',function(e){var nd=e.target.closest('.nd');setHov(nd);});
  svg.addEventListener('focusout',function(){setHov(null);});
  var dragging=false,moved=false,sx=0,sy=0,vb=[0,0,AT.W,0],base=[0,0,AT.W,0],scale=1;
  var vbs=svg.getAttribute('viewBox').split(' ').map(Number);vb=vbs.slice();base=vbs.slice();
  function apply(){svg.setAttribute('viewBox',vb.join(' '));box.classList.toggle('zoomed',scale>1.01);}
  function zoomTo(ns,cx,cy){ns=Math.max(1,Math.min(3,ns));var w=base[2]/ns,h=base[3]/ns;
    var fx=cx==null?.5:(cx-vb[0])/vb[2],fy=cy==null?.5:(cy-vb[1])/vb[3];
    var nx=(cx==null?vb[0]+vb[2]/2:cx)-fx*w,ny=(cy==null?vb[1]+vb[3]/2:cy)-fy*h;
    scale=ns;vb=[clamp(nx,0,base[2]-w),clamp(ny,0,base[3]-h),w,h];apply();}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function pt(e){var r=svg.getBoundingClientRect();return [vb[0]+(e.clientX-r.left)/r.width*vb[2],vb[1]+(e.clientY-r.top)/r.height*vb[3]];}
  box.querySelector('[data-z="in"]').addEventListener('click',function(){zoomTo(scale*1.35);});
  box.querySelector('[data-z="out"]').addEventListener('click',function(){zoomTo(scale/1.35);});
  box.querySelector('[data-z="reset"]').addEventListener('click',function(){zoomTo(1);});
  svg.addEventListener('wheel',function(e){if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();var p=pt(e);zoomTo(scale*(e.deltaY<0?1.15:1/1.15),p[0],p[1]);},{passive:false});
  svg.addEventListener('pointerdown',function(e){if(scale<=1.01||e.button!==0)return;dragging=true;moved=false;sx=e.clientX;sy=e.clientY;svg.setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',function(e){if(!dragging)return;var r=svg.getBoundingClientRect(),dx=(e.clientX-sx)/r.width*vb[2],dy=(e.clientY-sy)/r.height*vb[3];if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>4)moved=true;vb[0]=clamp(vb[0]-dx,0,base[2]-vb[2]);vb[1]=clamp(vb[1]-dy,0,base[3]-vb[3]);sx=e.clientX;sy=e.clientY;apply();});
  svg.addEventListener('pointerup',function(){dragging=false;});
  svg.addEventListener('click',function(e){
    if(moved){moved=false;return;}
    if(e.target.closest('.center')){openPal();return;}
    var nd=e.target.closest('.nd');if(!nd)return;var n=ANODES[nd.getAttribute('data-id')];if(n&&n.to)go(n.to,n.tg);
  });
  svg.addEventListener('keydown',function(e){if(e.key!=='Enter'&&e.key!==' ')return;var nd=e.target.closest('.nd');if(nd){e.preventDefault();var n=ANODES[nd.getAttribute('data-id')];if(n&&n.to)go(n.to,n.tg);}else if(e.target.closest('.center')){e.preventDefault();openPal();}});
}

/* ================= VIEWS ================= */
function categoryCards(){return CATS.map(function(c){return '<a class="category-card glass" href="'+WIKI.base+'categories/'+c.id+'/"><span class="eyebrow">'+GROUP_KO[c.g]+'</span><h3>'+esc(c.name)+'</h3><p>'+esc(c.desc)+'</p><span class="card-link">살펴보기 <span aria-hidden="true">↗</span></span></a>';}).join('');}
function viewHome(){return '<section class="wrap wiki-intro"><div><span class="eyebrow">PRIME ASSET · INSURANCE WIKI</span><h1>보험을 이해하는<br><span class="gt">하나의 지도.</span></h1><p>상품의 구조부터 고지의무와 보상까지.<br>상담에 필요한 기본을 차근차근 연결합니다.</p><button class="btn" data-pal>궁금한 내용 찾기 <span aria-hidden="true">↗</span></button></div><div class="intro-guide"><span class="eyebrow">어디부터 살펴볼까요</span><a href="'+WIKI.base+'topics/silson/"><b>치료비 보장의 기본</b><span>실손의료비와 진단비를 구분해 보세요 ↗</span></a><a href="'+WIKI.base+'topics/disclosure/"><b>계약 전, 꼭 확인할 내용</b><span>고지 질문과 답변 기록을 점검하세요 ↗</span></a><a href="'+WIKI.base+'sales/"><b>상담의 흐름을 만드는 순서</b><span>가망고객부터 사후관리까지 살펴보세요 ↗</span></a></div></section><div class="wrap"><div class="wiki-stats"><span><b>10</b> 지식 분류</span><span><b>88</b> 공개 항목</span><span><b>8</b> 세일즈 단계</span><span><b>18</b> 핵심 용어</span></div></div><section class="wrap atlas" id="atlas"><div class="atlas-head"><div><span class="eyebrow">KNOWLEDGE ATLAS</span><h2>보험 지식지도</h2><p>가지를 누르면 설명으로 이어집니다. 작은 화면에서는 목록으로 살펴보세요.</p></div><div class="atlas-tools"><button class="ztool" data-z="out" aria-label="축소">−</button><button class="ztool" data-z="reset">맞춤</button><button class="ztool" data-z="in" aria-label="확대">+</button></div></div><div class="atlas-frame">'+buildAtlas()+'</div>'+buildAtlasList()+'</section><section class="wrap knowledge-section"><div class="sec-head"><div><span class="eyebrow">EXPLORE THE BASICS</span><h2>분야별로 깊이 읽기</h2></div><p>정의와 핵심 설명, 실무 점검 항목을 함께 담았습니다.</p></div><div class="category-grid">'+categoryCards()+'</div></section><section class="wrap lounge-banner"><div><span class="eyebrow">MEMBERS ONLY</span><h2>경험이 쌓이는 설계사 라운지</h2><p>실전 화법 · 상품 비교 · 시책 · 고객관리 원문</p></div><button class="btn ghost" data-login>설계사 로그인</button></section>';}
function viewCat(c){
  var cards=c.children.map(function(ch){
    return '<a class="dcard glass rv" href="'+docHref(ch)+'"><h3>'+ch.name+'</h3><ul>'+(ch.items||[]).slice(0,4).map(function(it){return '<li>'+it+'</li>';}).join('')+'</ul><div class="foot">'+'<span class="tag cy">공개 지식</span>'+'<span class="tag">'+(ch.items?ch.items.length:0)+' 섹션</span></div></a>';
  }).join('');
  return '<section class="pagehead"><div class="wrap"><div class="crumbs"><a href="#home">지식지도</a><span>/</span><span>'+GROUP_KO[c.g]+'</span></div><h1>'+c.name+'</h1><p>'+c.desc+'</p><div class="meta"><span class="tag cy">'+c.children.length+' 문서</span><span class="tag">공개 지식</span></div></div></section>'+
    '<div class="wrap"><div class="docs">'+cards+'</div></div>';
}

function sideTree(curId){
  return CATS.map(function(c){
    var open=c.children.some(function(x){return x.id===curId;});
    return '<details'+(open?' open':'')+'><summary>'+c.name+'</summary>'+c.children.map(function(ch){return '<a href="'+docHref(ch)+'"'+(ch.id===curId?' class="on"':'')+'>'+ch.name+'</a>';}).join('')+'</details>';
  }).join('');
}
function docShell(f,toc,body){
  return '<section class="pagehead"><div class="wrap"><div class="crumbs"><a href="#home">지식지도</a><span>/</span><a href="#cat-'+f.cat.id+'">'+f.cat.name+'</a></div><h1>'+f.doc.name+'</h1>'+body.head+'</div></section>'+
  '<div class="wrap doc"><aside class="side glass" aria-label="문서 목록">'+sideTree(f.doc.id)+'</aside><article class="article">'+body.main+'</article>'+
  '<nav class="toc" aria-label="이 문서의 목차"><span class="pill"><i></i>On this page</span>'+toc.map(function(t){return '<a href="#'+t[0]+'" data-jump="'+t[0]+'">'+t[1]+'</a>';}).join('')+'</nav></div>';
}
function viewDocument(f){
  var rows=WIKI.items.filter(function(it){return it.doc===f.doc.id;});
  var toc=rows.map(function(it){return ['s'+it.index,it.title];});
  var main=rows.map(function(it){return '<section class="entry" id="s'+it.index+'">'+(it.doc==='disclosure'?'<span id="d'+(it.index+1)+'"></span>':'')+'<div class="entry-heading"><h2>'+esc(it.title)+'</h2><a class="permalink" href="'+WIKI.base+it.path+'">개별 페이지 ↗</a></div>'+entryBody(it)+'</section>';}).join('');
  main+='<h2 id="sm">설계사 전용 자료</h2>'+lockBlock('Members only','실전 화법 · 상품 비교 · 시책 · 고객관리 원문은 로그인 후 열람합니다.','');
  return docShell(f,toc,{head:'<p>'+esc(f.cat.desc)+'</p><div class="meta"><span class="tag cy">'+rows.length+'개 항목</span></div>',main:main});
}
function entryBody(it){
  var out='<p class="definition">'+esc(it.definition)+'</p><h3>핵심 설명</h3>'+it.explanation.map(function(x){return '<p>'+esc(x)+'</p>';}).join('');
  out+='<div class="practice"><h3>설계사 실무 포인트</h3><ul>'+it.practical.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  if(it.faq&&it.faq.length)out+='<div class="faq"><h3>자주 묻는 질문</h3>'+it.faq.map(function(x){return '<details><summary>'+esc(x.q)+'</summary><p>'+esc(x.a)+'</p></details>';}).join('')+'</div>';
  return out;
}
function viewSales(){
  var rail=STEPS.map(function(s){return '<a href="#sales" data-target="step-'+s.n+'" data-rail="'+s.n+'"><span class="d">'+s.n+'</span>'+s.short+'</a>';}).join('');
  var steps=STEPS.map(function(s){
    var checks=s.checks.length?'<div class="checks">'+s.checks.map(function(c){return '<div class="check"><b>'+c[0]+'</b><span>'+c[1]+'</span></div>';}).join('')+'</div>':'';
    var diag=s.diag?'<div class="diag" id="diag"><div class="diag-q">고객이 마지막에 망설인다면, 어떤 말에 가깝나요?</div><div class="diag-opts">'+
      '<button type="button" data-d="2">"설계사는 좋은데, 아직 믿고 맡겨도 될지 모르겠다"</button>'+
      '<button type="button" data-d="3">"좋은 건 알겠는데, 지금 당장 꼭 해야 하나?"</button>'+
      '<button type="button" data-d="4">"내 상황(예산, 병력)이랑 조금 안 맞는 것 같다"</button>'+
      '<button type="button" data-d="5">"다른 데가 더 좋지 않을까? 더 비교해보고 싶다"</button>'+
      '</div><div class="diag-out" id="diagOut">하나를 고르면 다시 점검할 단계를 알려드립니다.</div></div>':'';
    var scripts='';
    if(s.n>=2&&s.n<=7){
      var inner='<div class="scripts">'+s.scripts.map(function(x){return '<div class="script"><b>'+x[0]+'</b><p>'+x[1]+'</p></div>';}).join('')+'</div>';
      scripts=lockBlock('실전 화법 · Members only','설계사 전용 · 통합페이지 로그인 후 열람',inner);
    }
    return '<section class="step glass rv" id="step-'+s.n+'" data-step="'+s.n+'"><span class="bgnum" aria-hidden="true">'+(s.n<10?'0':'')+s.n+'</span>'+
      '<span class="step-k">Step '+s.n+' · '+s.k+'</span><h2>'+s.name+'</h2><div class="quote"><span class="gt">'+s.quote+'</span></div><p class="intro">'+s.intro+'</p>'+checks+diag+scripts+
      '<div class="tip"><b>TIP</b>'+s.tip+'</div></section>';
  }).join('');
  return '<section class="pagehead"><div class="wrap"><div class="crumbs"><a href="#home">지식지도</a><span>/</span><span>영업</span></div><h1>세일즈 프로세스 <span class="gt">8단계</span></h1><p>고객을 이해하고, 필요한 보장을 설명하고, 계약 이후를 돌보는 상담의 흐름입니다.</p>'+
    '<div class="meta"><span class="tag cy">'+T('AP')+' · 니즈 · '+T('FF')+' · '+T('PT')+' · '+T('CL')+'</span><span class="tag">상담 흐름</span></div></div></section>'+
    '<div class="wrap sales"><nav class="rail" aria-label="단계 이동">'+rail+'</nav><div class="steps">'+steps+'</div></div>';
}

function viewGlossary(){
  return '<section class="pagehead"><div class="wrap"><div class="crumbs"><a href="#home">지식지도</a><span>/</span><span>용어사전</span></div><h1>용어사전</h1><p>문서 본문의 밑줄 용어에 마우스를 올리면 같은 뜻풀이가 바로 뜹니다.</p></div></section>'+
  '<div class="wrap"><div class="gtools"><input id="gq" type="search" placeholder="용어 찾기 (초성 가능)" aria-label="용어 찾기"></div><div class="glist" id="glist">'+
  GLOSS.map(function(g){return '<div class="gitem glass rv" id="g-'+g[0]+'" data-s="'+g[1]+' '+g[2]+'"><h3>'+g[1]+'</h3><p>'+g[2]+'</p></div>';}).join('')+'</div></div>';
}

function viewLounge(){
  var items=[['고객관리 자료','세팅부터 소개 창출까지. 로그인 후 열람하는 관리 자료.','PDF 원문 연결 예정'],['실전 화법 모음','세일즈 8단계 화법 전문과 상황별 응대.','세일즈 페이지와 연동'],['상품 비교 · 시책','보험사별 비교표와 이달의 시책.','통합페이지 연동 예정'],['프리미엄 자료검색기','보유 자료 수천 건 통합 검색.','기존 검색기 연결 예정']];
  var tiles=items.map(function(t){return '<div class="tile glass rv'+(member?' open':'')+'"'+(member?'':' data-login')+'><h3>'+t[0]+'</h3><p>'+t[1]+'</p><span class="st">'+LOCK+(member?t[2]:'로그인 후 열람')+'</span></div>';}).join('');
  var top=member?'<div class="note"><b>설계사 화면 미리보기 중</b> 운영 버전에서는 통합페이지 로그인 정보로 자동 인증됩니다. <button class="btn ghost sm" type="button" data-logout style="margin-left:8px">미리보기 끄기</button></div>'
    :'<div class="note"><b>소속 설계사 전용</b> 통합페이지 로그인 후 이용할 수 있습니다. <button class="btn sm" type="button" data-login style="margin-left:8px">로그인</button></div>';
  return '<section class="pagehead"><div class="wrap"><div class="crumbs"><a href="#home">지식지도</a><span>/</span><span>설계사 라운지</span></div><h1>설계사 라운지</h1><p>공개 위키 위에 얹히는 소속 설계사 전용 영역입니다.</p></div></section>'+
    '<div class="wrap" style="padding-block:28px 80px">'+top+'<div class="tiles" style="margin-top:20px">'+tiles+'</div></div>';
}

/* ================= ROUTER ================= */
function go(r,target){
  var hash='#'+r+(target?'~'+target:'');pendingTarget=target||null;
  if(location.hash===hash){render();}else{location.hash=hash;}
}
function render(){
  observers.forEach(function(o){o.disconnect();});observers=[];
  hideTip();
  if(window.WIKI_STATIC&&!location.hash&&!window.WIKI_INITIAL_ROUTE){
    if(app.innerHTML!==staticBody)app.innerHTML=staticBody;
    pendingTarget=null;updateAuthBtn();wireReveal();wireGloss();return;
  }
  var h=(location.hash||'#'+(window.WIKI_INITIAL_ROUTE||'home')).slice(1)||'home', navKey='home';
  try{h=decodeURIComponent(h);}catch(e){}
  // Native anchors belong to the current document, not to the hash router.
  if(/^(app|s\d+|d\d+|step-\d+|g-[A-Za-z0-9_-]+)$/.test(h)){
    var anchor=document.getElementById(h);
    if(anchor){
      pendingTarget=null;updateAuthBtn();wireReveal();wireGloss();
      setTimeout(function(){anchor.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});if(h==='app')focusMain();},0);
      return;
    }
  }
  if(h.indexOf('~')>0){var _p=h.split('~');h=_p[0];if(!pendingTarget)pendingTarget=_p[1];}
  if(h==='home'){app.innerHTML=viewHome();wireHome();}
  else if(h==='sales'){app.innerHTML=viewSales();wireSales();navKey='sales';}
  else if(h==='glossary'){app.innerHTML=viewGlossary();wireGloss();navKey='glossary';}
  else if(h==='lounge'){app.innerHTML=viewLounge();navKey='lounge';}
  else if(h.indexOf('cat-')===0&&catById(h.slice(4))){app.innerHTML=viewCat(catById(h.slice(4)));navKey='cat';}
  else if(h.indexOf('doc-')===0&&findChild(h.slice(4))){
    var f=findChild(h.slice(4));
    app.innerHTML=viewDocument(f);
    navKey=f.doc.id==='disclosure'?'doc':'cat';

  } else {app.innerHTML=viewHome();wireHome();}
  document.querySelectorAll('#nav a').forEach(function(a){a.classList.toggle('on',a.getAttribute('data-r')===navKey);});
  updateAuthBtn();wireReveal();
  if(pendingTarget){var t=document.getElementById(pendingTarget);pendingTarget=null;if(t){setTimeout(function(){t.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});},40);return;}}
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',render);

/* ================= WIRING ================= */
function wireReveal(){
  var els=[].slice.call(document.querySelectorAll('.rv'));
  if(!('IntersectionObserver' in window)||REDUCED){els.forEach(function(e){e.classList.add('in');});return;}
  var io=new IntersectionObserver(function(ents){ents.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -8% 0px'});
  els.forEach(function(e){var r=e.getBoundingClientRect();if(r.top<window.innerHeight*.95)e.classList.add('in');else io.observe(e);});
  observers.push(io);
}
var fontsDone=false;
function wireHome(){
  wireAtlas();
  if(!fontsDone&&document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){if(fontsDone)return;fontsDone=true;_mcache={};if(!location.hash||location.hash==='#home'){var y=window.scrollY;render();window.scrollTo(0,y);}});}
}
function wireSales(){
  var steps=[].slice.call(document.querySelectorAll('.step'));
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(ents){ents.forEach(function(e){if(e.isIntersecting){markStep(+e.target.getAttribute('data-step'));}});},{rootMargin:'-45% 0px -50% 0px'});
    steps.forEach(function(s){io.observe(s);});observers.push(io);
  }
  markStep(1);
  var out=document.getElementById('diagOut');
  document.querySelectorAll('[data-d]').forEach(function(b){
    b.addEventListener('click',function(){
      document.querySelectorAll('[data-d]').forEach(function(x){x.classList.toggle('on',x===b);});
      var n=+b.getAttribute('data-d'),s=STEPS[n-1];
      out.innerHTML='<b style="color:var(--fg)">'+n+'단계 '+s.name+'</b>에 구멍이 있다는 신호입니다. '+s.checks.map(function(c){return c[0];}).join(', ')+'을(를) 다시 채우세요. <a href="#sales" data-target="step-'+n+'">'+n+'단계로 이동 →</a>';
    });
  });
}
function markStep(n){
  document.querySelectorAll('.step').forEach(function(s){s.classList.toggle('on',+s.getAttribute('data-step')===n);});
  document.querySelectorAll('[data-rail]').forEach(function(a){var k=+a.getAttribute('data-rail');a.classList.toggle('on',k===n);a.classList.toggle('done',k<n);});
}
function wireGloss(){
  var q=document.getElementById('gq');if(!q)return;
  if(q.dataset.wikiBound)return;q.dataset.wikiBound='1';
  q.addEventListener('input',function(){var v=q.value.trim();document.querySelectorAll('.gitem').forEach(function(it){it.hidden=v&&!match(it.getAttribute('data-s'),v);});});
}

/* ================= SEARCH ================= */
var CHO=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function cho(s){var o='';for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);o+=(c>=0xAC00&&c<=0xD7A3)?CHO[Math.floor((c-0xAC00)/588)]:s[i];}return o;}
function isCho(q){return /^[ㄱ-ㅎ\s]+$/.test(q);}
function norm(s){return s.toLowerCase().replace(/\s+/g,'');}
function match(text,q){q=norm(q);if(!q)return true;return isCho(q)?norm(cho(text)).indexOf(q)>-1:norm(text).indexOf(q)>-1;}
var INDEX=[];
CATS.forEach(function(c){
  INDEX.push({t:c.name,s:'분야',r:c.route?'sales':'cat-'+c.id});
  c.children.forEach(function(ch){
    if(ch.step){INDEX.push({t:ch.name.replace(/^\d+\. /,ch.step+'단계 '),s:'세일즈 프로세스',r:'sales',tg:'step-'+ch.step});return;}
    INDEX.push({t:ch.name,s:c.name,r:'doc-'+ch.id});
    (ch.items||[]).forEach(function(it,i){INDEX.push({t:it,s:c.name+' › '+ch.name,r:'doc-'+ch.id,tg:'s'+i});});
  });
});
STEPS.forEach(function(s){s.checks.forEach(function(c){INDEX.push({t:c[0],s:s.n+'단계 '+s.name,r:'sales',tg:'step-'+s.n});});});
GLOSS.forEach(function(g){INDEX.push({t:g[1],s:'용어',r:'glossary',tg:'g-'+g[0]});});
INDEX.push({t:'설계사 라운지',s:'전용',r:'lounge'});

var palScrim=document.getElementById('palScrim'),palInput=document.getElementById('palInput'),palRes=document.getElementById('palRes'),sel=0,results=[];
function hl(t,q){if(!q||isCho(q))return t;var i=t.toLowerCase().indexOf(q.toLowerCase());return i<0?t:t.slice(0,i)+'<mark>'+t.slice(i,i+q.length)+'</mark>'+t.slice(i+q.length);}
function runSearch(){
  var q=palInput.value.trim();
  results=q?INDEX.filter(function(x){return match(x.t+' '+x.s,q);}).slice(0,14):INDEX.filter(function(x){return x.s==='분야';});
  sel=0;
  palRes.innerHTML=results.length?results.map(function(x,i){return '<a href="#'+x.r+'" data-pi="'+i+'"'+(i===0?' class="sel"':'')+'>'+hl(x.t,q)+'<span>'+x.s+'</span></a>';}).join(''):'<div class="pal-empty">"'+q.replace(/</g,'&lt;')+'"에 맞는 문서가 없습니다. 다른 단어나 초성으로 찾아보세요.</div>';
}
function openPal(){palInput.value='';runSearch();openDialog(palScrim);}
function closePal(){closeDialog(palScrim);}
function pick(i){var x=results[i];if(!x)return;closePal();go(x.r,x.tg);if(x.tg&&x.tg.indexOf('g-')===0){setTimeout(function(){var el=document.getElementById(x.tg);if(el){el.classList.add('hl');setTimeout(function(){el.classList.remove('hl');},2200);}},120);}}
palInput.addEventListener('input',runSearch);
palInput.addEventListener('keydown',function(e){
  var links=palRes.querySelectorAll('a');
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!links.length)return;sel=(sel+(e.key==='ArrowDown'?1:-1)+links.length)%links.length;links.forEach(function(a,i){a.classList.toggle('sel',i===sel);});links[sel].scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){e.preventDefault();pick(sel);}
});
palRes.addEventListener('click',function(e){var a=e.target.closest('a[data-pi]');if(!a)return;e.preventDefault();pick(+a.getAttribute('data-pi'));});
palScrim.addEventListener('click',function(e){if(e.target===palScrim)closePal();});
document.getElementById('openPal').addEventListener('click',openPal);

/* ================= AUTH (demo) ================= */
var loginScrim=document.getElementById('loginScrim');
function updateAuthBtn(){var b=document.getElementById('authBtn');b.innerHTML=member?'<span class="member-dot"></span>설계사 모드':'설계사 로그인';b.classList.toggle('ghost',member);}
function setMember(){member=false;toast('전용 자료는 승인된 설계사 로그인 후 열립니다.');}
document.getElementById('authBtn').addEventListener('click',function(){if(member)go('lounge');else openDialog(loginScrim);});
document.getElementById('demoLogin').addEventListener('click',function(){closeDialog(loginScrim);go('lounge');});
loginScrim.addEventListener('click',function(e){if(e.target===loginScrim||e.target.hasAttribute('data-close'))closeDialog(loginScrim);});

/* ================= TOOLTIP ================= */
var tipPop=document.getElementById('tipPop'),tipFor=null;
function showTip(el){var g=GMAP[el.getAttribute('data-t')];if(!g)return;tipFor=el;tipPop.innerHTML='<b>'+g[1]+'</b>'+g[2];tipPop.hidden=false;
  var r=el.getBoundingClientRect(),w=tipPop.offsetWidth,h=tipPop.offsetHeight;
  var x=Math.min(Math.max(12,r.left+r.width/2-w/2),window.innerWidth-w-12),y=r.top-h-10;if(y<76)y=r.bottom+10;
  tipPop.style.left=x+'px';tipPop.style.top=y+'px';}
function hideTip(){tipPop.hidden=true;tipFor=null;}
document.addEventListener('mouseover',function(e){var t=e.target.closest&&e.target.closest('.term');if(t)showTip(t);});
document.addEventListener('mouseout',function(e){var t=e.target.closest&&e.target.closest('.term');if(t)hideTip();});
document.addEventListener('focusin',function(e){if(e.target.classList&&e.target.classList.contains('term'))showTip(e.target);});
document.addEventListener('focusout',function(e){if(e.target.classList&&e.target.classList.contains('term'))hideTip();});
window.addEventListener('scroll',function(){if(tipFor)hideTip();},{passive:true});

/* ================= GLOBAL CLICKS / KEYS ================= */
document.addEventListener('click',function(e){
  var t=e.target.closest('.term');if(t){showTip(t);return;}
  if(tipFor)hideTip();
  var a=e.target.closest('a[data-target]');if(a){e.preventDefault();go(a.getAttribute('href').slice(1),a.getAttribute('data-target'));return;}
  var j=e.target.closest('a[data-jump]');if(j){e.preventDefault();var el=document.getElementById(j.getAttribute('data-jump'));if(el)el.scrollIntoView({behavior:REDUCED?'auto':'smooth'});return;}
  if(e.target.closest('[data-login]')){openDialog(loginScrim);return;}
  if(e.target.closest('[data-logout]')){setMember(false);return;}
  if(e.target.closest('[data-pal]')){openPal();return;}
  if(e.target.closest('#copyPhone')){var num=document.getElementById('phone').textContent;
    try{navigator.clipboard.writeText(num).then(function(){toast('번호를 복사했습니다');},function(){selectPhone();});}catch(err){selectPhone();}}
});
function selectPhone(){var r=document.createRange();r.selectNodeContents(document.getElementById('phone'));var s=window.getSelection();s.removeAllRanges();s.addRange(r);toast('번호를 선택했습니다. Ctrl+C로 복사하세요');}
document.addEventListener('keydown',function(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();palScrim.hidden?openPal():closePal();}
  else if(e.key==='Escape'){closePal();closeDialog(loginScrim);hideTip();}
  else if(e.key==='/'&&palScrim.hidden&&!/input|textarea/i.test(document.activeElement.tagName)){e.preventDefault();openPal();}
});
var toastT;function toast(m){var t=document.getElementById('toast');t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},2200);}

var navToggle=document.getElementById('menuToggle');
navToggle.addEventListener('click',function(){var open=navToggle.getAttribute('aria-expanded')!=='true';navToggle.setAttribute('aria-expanded',String(open));document.querySelector('.topbar').classList.toggle('menu-open',open);});
document.querySelector('#nav').addEventListener('click',function(e){if(e.target.closest('a,button')){navToggle.setAttribute('aria-expanded','false');document.querySelector('.topbar').classList.remove('menu-open');}});
var returnFocus=null,activeDialog=null;
function focusMain(){app.setAttribute('tabindex','-1');app.focus({preventScroll:true});}
function visibleFocusTarget(el){
  if(!el||!el.isConnected)return false;
  for(var node=el;node&&node.nodeType===1;node=node.parentElement){if(node.hidden||getComputedStyle(node).display==='none'||getComputedStyle(node).visibility==='hidden')return false;}
  return true;
}
function openDialog(dialog){
  if(activeDialog&&activeDialog!==dialog)activeDialog.hidden=true;
  else if(!activeDialog)returnFocus=document.activeElement;
  activeDialog=dialog;dialog.hidden=false;
  var first=dialog.querySelector('input,button,a[href]');if(first)first.focus();
}
function closeDialog(dialog){
  dialog.hidden=true;if(activeDialog!==dialog)return;activeDialog=null;
  var target=returnFocus;returnFocus=null;
  if(visibleFocusTarget(target))target.focus();
  else if(visibleFocusTarget(navToggle))navToggle.focus();
  else focusMain();
}
[palScrim,loginScrim].forEach(function(dialog){dialog.addEventListener('keydown',function(e){if(e.key!=='Tab')return;var nodes=Array.from(dialog.querySelectorAll('input,button,a[href]')).filter(visibleFocusTarget);if(!nodes.length)return;var first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});});
render();
})();
