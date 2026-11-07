/* Interactive presentation only: no requests, accounts or persistent storage. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const D = window.BOHUM_DEMO, params = new URLSearchParams(location.search);
  const page = document.body.dataset.page, member = document.body.dataset.auth === 'member';
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const company = id => D.companies.find(c => c.id === id) || D.companies[0];
  const channel = id => D.channels.find(c => c.id === id) || D.channels[0];
  const selected = D.posts.find(p => p.id === params.get('id')) || D.posts[0];
  const selectedCompany = company(params.get('company'));
  const postURL = (post, authenticated = member) => (authenticated ? 'post.html' : 'post-guest.html') + '?id=' + encodeURIComponent(post.id);
  const companyURL = (id, hash = '') => 'company.html?company=' + encodeURIComponent(id) + hash;
  const icon = name => '<i data-icon="' + name + '"></i>';
  const author = post => esc(company(post.company).name) + ' · ' + esc(post.nickname);
  const popular = D.posts.slice().sort((a,b) => b.likes-a.likes);
  const note = document.createElement('div');
  note.className = 'demo-notice';
  note.innerHTML = '<div><span>테스트 견본 — 저장되지 않습니다</span><nav aria-label="견본 화면"><a href="me.html">내 정보</a><a href="admin.html">관리자</a></nav></div>';
  $('[data-site-header]').prepend(note);

  function feed(post, options = {}) {
    const ch = channel(post.channel);
    return '<article class="feed-item" data-post-id="'+post.id+'" data-kind="post" data-date="'+post.order+'" data-likes="'+post.likes+'" data-comments="3">'+
      (options.channel === false ? '' : '<a class="feed-channel" href="channel.html?channel='+ch.id+'"><span class="topic-disc mini '+ch.id+'">'+ch.symbol+'</span>'+ch.name+'</a>')+
      '<a href="'+postURL(post, options.member == null ? member : options.member)+'" data-post-id="'+post.id+'"><h2 class="feed-title">'+esc(post.title)+'</h2><p class="feed-excerpt">'+esc(post.excerpt)+'</p></a>'+
      '<p class="author"><span class="company-name">'+esc(company(post.company).name)+'</span> · '+esc(post.nickname)+'</p>'+
      '<div class="meta"><span>'+icon('eye')+post.views+'</span><span>'+icon('heart')+post.likes+'</span><span>'+icon('comment')+'3</span><time>'+post.date.slice(5)+'</time><button type="button" data-toggle="bookmark" aria-pressed="false" aria-label="'+esc(post.title)+' 북마크">'+icon('bookmark')+'</button></div></article>';
  }
  function compact(post, rank) {
    const ch=channel(post.channel);
    return '<article class="feed-item"><a class="feed-channel" href="channel.html?channel='+ch.id+'"><span class="topic-disc mini '+ch.id+'">'+ch.symbol+'</span>'+ch.name+'</a><a class="feed-title" data-post-id="'+post.id+'" href="'+postURL(post,false)+'">'+(rank?'<span class="feed-rank">'+rank+'</span>':'')+esc(post.title)+'</a><div class="meta"><span>'+icon('heart')+post.likes+'</span><span>'+icon('comment')+'3</span><span>'+author(post)+'</span></div></article>';
  }
  function links(posts) {
    return posts.map(post => '<li><a data-post-id="'+post.id+'" href="'+postURL(post)+'">'+esc(post.title)+'</a></li>').join('');
  }

  if (page === 'home') {
    $('.primary').innerHTML = '<section class="home-section"><h1 class="section-title">토픽 베스트</h1>'+popular.slice(0,8).map((p,i)=>compact(p,i+1)).join('')+'<a class="more-row" href="search.html?sort=popular">전체 글 둘러보기 '+icon('chevron')+'</a></section><div class="divider"></div>'+
      '<section class="home-section"><h2 class="section-title">지금 많이 읽는 글</h2>'+D.posts.slice().sort((a,b)=>b.views-a.views).slice(0,5).map(p=>'<article class="feed-item compact-item"><a class="feed-title" data-post-id="'+p.id+'" href="'+postURL(p,false)+'">'+esc(p.title)+'</a><div class="meta"><span>'+icon('eye')+p.views+'</span><span>'+esc(channel(p.channel).name)+'</span></div></article>').join('')+'</section><div class="divider"></div>'+
      D.channels.map(ch=>'<section class="home-section"><div class="home-channel-heading"><h2 class="section-title">'+ch.name+'</h2><a href="channel.html?channel='+ch.id+'">더보기 '+icon('chevron')+'</a></div>'+D.posts.filter(p=>p.channel===ch.id).slice(0,3).map(p=>compact(p)).join('')+'</section><div class="divider"></div>').join('');
  }

  if (page === 'channel') {
    const key = D.channels.some(c=>c.id===params.get('channel')) ? params.get('channel') : 'career';
    const ch = channel(key), tag=params.get('tag');
    const tagged = tag==='exam' ? D.posts.filter(p=>p.keywords.includes('시험')) : tag==='weekly' ? D.posts.filter(p=>p.id.endsWith('-1')) : D.posts.filter(p=>p.channel===key);
    const label = tag==='exam'?'시험·자격':tag==='weekly'?'주간에 함께 읽은 글':ch.name;
    document.querySelectorAll('[data-channel-name]').forEach(el=>el.textContent=label);
    $('#channel-symbol').textContent=ch.symbol;
    $('#channel-description').textContent=tag==='weekly'?'6개 채널에서 함께 읽을 만한 질문을 모았습니다. 모두 테스트용 창작 글입니다.':ch.description;
    $('#channel-write').href='write.html?channel='+key;
    document.title=label+' 채널 | 보험라이브';
    $('#channel-public-note').textContent='회사명은 그대로, 닉네임은 첫 글자만 표시해요. 실무·커리어 본문은 전체 공개, 댓글과 AI 참고 답변은 회원 화면에서 볼 수 있어요.';
    let sort=params.get('sort')==='best'?'popular':'latest';
    function render() {
      let items=tagged.slice().sort((a,b)=>sort==='popular'?b.likes-a.likes:b.order-a.order);
      if(sort==='unanswered')items=items.filter(p=>p.comments.length===0);
      $('#channel-feed').innerHTML=items.map(p=>feed(p,{channel:false,member:true})).join('');
      $('#channel-empty').hidden=items.length>0;
      $('#channel-result').textContent=sort==='unanswered'?'사람 답변을 기다리는 견본 글 '+items.length+'개':'견본 글 '+items.length+'개를 모두 확인했어요.';
      if(sort==='unanswered')$('#channel-feed').querySelectorAll('.meta span:nth-child(3)').forEach(el=>el.innerHTML=icon('comment')+'0');
      document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===sort);b.setAttribute('aria-pressed',String(b.dataset.filter===sort));});
      window.renderIcons($('#channel-feed'));
    }
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{sort=b.dataset.filter;render();}));
    render();
  }

  if (page === 'post' || page === 'post-guest') {
    const p=selected, ch=channel(p.channel), guest=page==='post-guest';
    document.title=p.title+' | 보험라이브';
    $('.post-header h1').textContent=p.title;
    $('.post-author').textContent=company(p.company).name+' · '+p.nickname;
    const trail=$('.breadcrumb a:nth-of-type(2)');
    if(trail){trail.textContent=ch.name;trail.href='channel.html?channel='+ch.id;}
    const view=$('.post-header .meta span:nth-child(2)');if(view)view.innerHTML=icon('eye')+p.views;
    const date=$('.post-header .meta span:first-child');if(date)date.innerHTML=icon('clock')+p.date;
    const paragraphs=guest&&p.kind==='experience' ? p.body.join('\n\n').slice(0,300).split('\n\n') : p.body;
    $('.post-body').innerHTML=paragraphs.map(t=>'<p>'+esc(t)+'</p>').join('')+'<p class="small muted">'+(p.kind==='experience'?'경험 글 · 방문자에게 앞부분 최대 300자 공개':'본문 전체 공개 · '+(p.kind==='career'?'커리어 질문':'실무 이야기'))+'</p><div class="post-company-tag"><span>@</span><a class="tag" href="'+companyURL(p.company)+'">'+esc(company(p.company).name)+'</a></div>';
    const like=$('.post-actions [data-count]');if(like)like.textContent=p.likes;
    $('.related-companies').innerHTML='<h2>연관 보험사</h2>'+[company(p.company),company(p.comments[0].company)].map(c=>'<a href="'+companyURL(c.id)+'" class="related-company"><span class="company-mark">'+esc(c.name)+'</span><p>'+esc(c.name)+'<br><span class="stars">★</span> 3.8 <span class="muted small">견본 평점</span></p>'+icon('chevron')+'</a>').join('');
    if(!guest){
      const originals=[$('#answer-1'),$('#answer-2')];
      originals.forEach((node,index)=>{const comment=p.comments[index];node.querySelector('.comment-author').innerHTML='<span class="company-name">'+esc(company(comment.company).name)+'</span> · '+esc(comment.nickname);node.querySelector('p').textContent=comment.body;});
      const reply=$('.comment-reply');reply.querySelector('.comment-author').innerHTML='<span class="company-name">'+esc(company(p.company).name)+'</span> · '+esc(p.nickname)+' <span class="author-badge">작성자</span>';reply.querySelector('p').textContent=p.reply;
      $('#ai-answer > p').textContent=p.ai;
      $('#ai-answer .source-note').textContent='AI가 작성한 형식을 보여 주는 견본입니다. 실제 AI 호출은 하지 않았습니다. 최신 약관·회사 공지를 직접 확인하세요.\n자료 기준일 2026.11.07. · 근거: 운영팀 견본 자료 「'+ch.name+' 확인 질문 목록」\n생성일 2026.11.07. · 실제 검증 자료가 아닌 화면 예시';
      const text=$('#comment-body');text.placeholder='동료에게 경험을 나눠 주세요. 20자 이상 · 저장되지 않습니다';
    }else{
      document.querySelectorAll('.guest-lock a').forEach((a,i)=>{a.href=i===0?'join.html?returnTo='+encodeURIComponent(postURL(p,true)+'#comments'):postURL(p,true)+'#comments';if(i===1)a.textContent='회원 화면 바로 체험하기';});
    }
    const recommendations=document.querySelectorAll('.recommendations');
    if(recommendations[0]){recommendations[0].querySelector('h2').textContent=ch.name+' 추천 글';recommendations[0].querySelector('ul').innerHTML=links(D.posts.filter(x=>x.channel===p.channel&&x.id!==p.id));}
    if(recommendations[1])recommendations[1].querySelector('ul').innerHTML=links(popular.slice(0,7));
  }

  if (page === 'search') {
    let active=['post','company','channel'].includes(params.get('type'))?params.get('type'):'all';
    const input=$('#search-query');input.value=(params.get('q')||'').slice(0,80);
    const keywordLinks=document.createElement('nav');keywordLinks.className='chips search-keyword-links';keywordLinks.setAttribute('aria-label','키워드 모음');keywordLinks.innerHTML=['수수료','교육','전산','심사','이직'].map(word=>'<a class="chip" href="browse.html?company=samsung&keyword='+encodeURIComponent(word)+'">'+word+' 모음</a>').join('');$('#content-search').after(keywordLinks);
    const normalize=value=>value.toLocaleLowerCase('ko').replace(/\s+/g,' ').trim();
    function update() {
      const query=input.value.trim(), invalid=query.length===1||query.length>80;
      $('#search-error').hidden=!invalid;input.setAttribute('aria-invalid',String(invalid));
      if(invalid){$('#search-error').textContent='검색어는 2~80자로 입력해 주세요.';$('#search-results').replaceChildren();$('#search-summary').textContent='검색어를 확인해 주세요.';$('#search-empty').hidden=true;return;}
      const words=normalize(query).split(' ').filter(Boolean), matches=value=>words.every(w=>normalize(value).includes(w));
      let posts=D.posts.filter(p=>matches(p.title+' '+p.excerpt+' '+p.keywords.join(' ')+' '+company(p.company).name+' '+channel(p.channel).name));
      posts.sort((a,b)=>$('#search-order').value==='title' ? Number(b.title.includes(query))-Number(a.title.includes(query))||b.order-a.order : params.get('sort')==='popular'?b.likes-a.likes:b.order-a.order);
      const companies=D.companies.filter(c=>matches(c.name+' '+c.type+' 보험사 리뷰'));
      const channels=D.channels.filter(c=>matches(c.name+' '+c.description));
      const counts={post:posts.length,company:companies.length,channel:channels.length,all:posts.length+companies.length+channels.length};
      $('#search-results').innerHTML=(active==='all'||active==='post'?posts.map(p=>feed(p,{member:false})).join(''):'')+
        (active==='all'||active==='company'?companies.map(c=>'<article class="feed-item" data-kind="company"><a class="company-result row" href="'+companyURL(c.id)+'"><span class="company-mark">'+esc(c.name)+'</span><div><h2 class="feed-title">'+esc(c.name)+'</h2><p>'+c.type+' · 리뷰와 평점은 테스트용 예시</p></div></a></article>').join(''):'')+
        (active==='all'||active==='channel'?channels.map(c=>'<article class="feed-item" data-kind="channel"><a class="company-result row" href="channel.html?channel='+c.id+'"><span class="topic-disc '+c.id+'">'+c.symbol+'</span><div><h2 class="feed-title">'+c.name+'</h2><p>'+c.description+'</p></div></a></article>').join(''):'');
      document.querySelectorAll('[data-count-kind]').forEach(el=>el.textContent=counts[el.dataset.countKind]);
      document.querySelectorAll('[data-result-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.resultKind===active);b.setAttribute('aria-pressed',String(b.dataset.resultKind===active));});
      $('#search-summary').textContent=(query?'“'+query+'”':'공개 콘텐츠')+' 검색 결과 '+counts[active]+'개';
      $('#search-empty').hidden=counts[active]>0;$('#search-end').hidden=counts[active]===0;
      document.title=(query?query+' 검색':'검색')+' | 보험라이브';
      window.renderIcons($('#search-results'));
    }
    $('#content-search').addEventListener('submit',event=>{event.preventDefault();update();const url=new URL(location.href);url.searchParams.set('q',input.value.trim());url.searchParams.set('type',active);history.replaceState(null,'',url);});
    document.querySelectorAll('[data-result-kind]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.resultKind;update();}));
    $('#search-order').addEventListener('change',update);
    $('#reset-search').addEventListener('click',()=>{input.value='';active='all';update();input.focus();});
    update();
  }

  if(page==='company'||page==='browse') {
    // Real company names are labels; every review and rating remains explicitly fictional.
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let text;
    while((text=walker.nextNode()))if(!['SCRIPT','STYLE'].includes(text.parentElement.tagName))text.data=text.data.replace(/삼성생명/g,selectedCompany.name);
    document.title=(page==='company'?selectedCompany.name+' 보험사 리뷰':selectedCompany.name+' 키워드 모음')+' | 보험라이브';
    document.querySelectorAll('a[href*="browse.html"]').forEach(a=>{const url=new URL(a.getAttribute('href'),location.href);url.searchParams.set('company',selectedCompany.id);a.href=url.pathname.split('/').pop()+url.search;});
    if(page==='company') {
      const hero=$('.company-hero');
      const picker=document.createElement('label');picker.className='company-picker';picker.innerHTML='<span>보험사 선택</span><select aria-label="보험사 선택">'+D.companies.map(c=>'<option value="'+c.id+'"'+(c.id===selectedCompany.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select>';hero.prepend(picker);picker.querySelector('select').addEventListener('change',event=>{location.href=companyURL(event.target.value);});
      const type=$('#intro .company-info p:first-child');if(type)type.innerHTML='<span>회사 유형</span>'+selectedCompany.type;
      const description=$('#intro .company-intro');if(description)description.textContent='실제 회사명으로 탐색하는 테스트 화면입니다. 아래 경험담·리뷰·평점은 모두 창작 예시이며 '+selectedCompany.name+'의 실제 서비스나 근무 환경을 평가한 내용이 아닙니다.';
      const summary=hero.querySelector('p');if(summary)summary.textContent=selectedCompany.type+' · 설계사 관점의 견본 리뷰';
      const postSection=$('#posts');
      postSection.querySelectorAll('.feed-item').forEach(n=>n.remove());
      const group=document.createElement('div');group.className='company-post-feed';group.innerHTML=D.posts.filter(p=>p.company===selectedCompany.id).map(p=>feed(p,{member:false})).join('');
      const more=postSection.querySelector('a.btn');postSection.insertBefore(group,more||null);if(more)more.href='search.html?q='+encodeURIComponent(selectedCompany.name);
      $('.company-search input').placeholder=selectedCompany.name+' 관련 내용을 검색해 보세요';
      $('.company-search').addEventListener('submit',event=>{event.preventDefault();const query=$('.company-search input').value.trim();location.href='search.html?q='+encodeURIComponent(selectedCompany.name+(query?' '+query:''));});
      $('.metrics>div:last-child strong').textContent=D.posts.filter(p=>p.company===selectedCompany.id).length;
      const otherCompanies=D.companies.filter(c=>c.id!==selectedCompany.id).slice(0,2);
      document.querySelectorAll('.primary>.section:last-child .related-company').forEach((a,index)=>{const c=otherCompanies[index];if(!c)return;a.href=companyURL(c.id);a.querySelector('.company-mark').textContent=c.name;a.querySelector('strong').textContent=c.name;});
      document.querySelectorAll('a').forEach(a=>{if(/리뷰하기|리뷰 쓰기/.test(a.textContent))a.addEventListener('click',event=>{event.preventDefault();reviewDialog();});});
    }else{
      const keyword=params.get('keyword')||'수수료';
      $('#keyword-heading').textContent=selectedCompany.name+' '+keyword;
      let items=D.posts.filter(p=>p.company===selectedCompany.id&&p.keywords.some(k=>k.includes(keyword)||keyword.includes(k)));
      const render=()=>{$('#browse-feed').innerHTML=items.length?items.slice().sort((a,b)=>$('#browse-sort').value==='latest'?b.order-a.order:b.likes-a.likes).map(p=>feed(p,{member:false})).join(''):'<div class="empty"><strong>이 회사의 해당 키워드 글을 준비하고 있어요.</strong><p>'+esc(selectedCompany.name)+' · '+esc(keyword)+'에 맞는 견본 글은 아직 없습니다.</p><a class="text-link" href="search.html?q='+encodeURIComponent(keyword)+'">모든 회사의 '+esc(keyword)+' 글 검색하기</a></div>';window.renderIcons($('#browse-feed'));};
      $('#browse-sort').addEventListener('change',render);render();
      $('#keyword-search').href='search.html?q='+encodeURIComponent(keyword);
    }
  }

  function reviewDialog(){
    const dialog=document.createElement('dialog');dialog.className='demo-dialog';
    dialog.innerHTML='<h2>'+esc(selectedCompany.name)+' 견본 리뷰 작성</h2><p class="small muted">현재 화면에서만 미리 봅니다. 리뷰가 저장되거나 회사 평점에 반영되지 않습니다.</p><form><label class="field"><span>별점</span><select aria-label="리뷰 별점"><option>5.0</option><option>4.0</option><option>3.0</option><option>2.0</option><option>1.0</option></select></label><label class="field"><span>경험 나누기</span><textarea required minlength="20" placeholder="개인정보 없이 20자 이상 적어 주세요"></textarea></label><div class="form-actions"><button type="button" class="btn" data-cancel>취소</button><button class="btn btn-primary">리뷰 미리보기</button></div></form><div class="review-preview" hidden></div>';
    document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    dialog.querySelector('form').onsubmit=event=>{event.preventDefault();const preview=dialog.querySelector('.review-preview');preview.hidden=false;preview.replaceChildren();const label=document.createElement('p');label.className='small muted';label.textContent=selectedCompany.name+' · 바*** · '+dialog.querySelector('select').value+'점 · 저장되지 않는 견본';const body=document.createElement('p');body.textContent=dialog.querySelector('textarea').value;preview.append(label,body);window.showToast('리뷰를 현재 화면에서 미리 보고 있어요. 저장되지 않습니다.');};
  }

  if(page==='write'){
    if(D.channels.some(c=>c.id===params.get('channel')))$('#write-channel').value=params.get('channel');
    $('#write-form').addEventListener('submit',()=>{if(!$('#write-form').hidden)return;let preview=$('#submitted-preview');if(!preview){preview=document.createElement('article');preview.id='submitted-preview';preview.className='submitted-preview';$('#write-complete').append(preview);}preview.replaceChildren();const title=document.createElement('h2');title.textContent=$('#write-title').value;const meta=document.createElement('p');meta.className='small muted';meta.textContent=channel($('#write-channel').value).name+' · 삼성생명 · 바*** · 이 화면에서만 표시';const body=document.createElement('p');body.style.whiteSpace='pre-wrap';body.textContent=$('#write-body').value;preview.append(title,meta,body);});
  }

  // Keep all original form/control selectors while filling the company choices.
  ['#write-company','#verify-company','#new-affiliation'].forEach(selector=>{
    const select=$(selector);if(!select)return;
    D.companies.forEach(c=>{if(![...select.options].some(o=>o.value===c.name)){const option=document.createElement('option');option.textContent=c.name;option.value=c.name;select.append(option);}});
  });

  // Resolve legacy mockup links to genuine article IDs and keep visible titles in sync.
  let fallback=0;
  document.querySelectorAll('a[href]').forEach(a=>{
    const raw=a.getAttribute('href');
    if(/^post(?:-guest)?\.html(?:[?#]|$)/.test(raw)&&!a.dataset.postId){
      const label=a.textContent.trim();
      let p=D.posts.find(p=>p.id===new URL(raw,location.href).searchParams.get('id'))||D.posts.find(p=>p.title===label);
      const titleNode=a.querySelector('.feed-title')||(a.classList.contains('feed-title')?a:null);
      const titleLink=Boolean(titleNode||a.closest('.simple-list,.side-list'));
      if(!p&&titleLink){const tokens=label.split(/[\s,?]+/).filter(t=>t.length>1);p=D.posts.slice().sort((x,y)=>tokens.filter(t=>y.title.includes(t)).length-tokens.filter(t=>x.title.includes(t)).length)[0];}
      if(!p)p=(page==='post'||page==='post-guest')?selected:D.posts[fallback++%D.posts.length];
      a.href=postURL(p,raw.startsWith('post.html'))+(raw.includes('#')?'#'+raw.split('#')[1]:'');a.dataset.postId=p.id;
      if(titleNode)titleNode.textContent=p.title;
      else if(titleLink){const rank=a.querySelector('.muted');a.replaceChildren(...(rank?[rank]:[]),document.createTextNode(p.title));}
      const excerpt=a.querySelector('.feed-excerpt');if(excerpt)excerpt.textContent=p.excerpt;
    }
    if(/^company\.html(?:[?#]|$)/.test(raw)){
      const url=new URL(raw,location.href);if(!url.searchParams.has('company')){const c=D.companies.find(c=>a.textContent.includes(c.name))||selectedCompany;a.href=companyURL(c.id,url.hash);}
    }
  });
  window.renderIcons(document);
});
