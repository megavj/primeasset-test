/* TASK-ART 작성글모음 공용(2026-11-09): 글 본문 안전하게 그리기 · [HTML 복사] · [서식 그대로 복사] · [그림 내려받기] · 게시 전 안내.
   작성글모음(/members/articles/)·내 정보 보관함(/members/me/)·관리자 화면이 같은 코드를 쓴다.
   본문은 생성기가 만든 HTML이지만 그대로 넣지 않고 허용한 태그·속성만 다시 만든다(그림은 우리 저장소 주소만).
   서식 그대로 복사: 네이버 블로그 편집기(스마트에디터 ONE)는 붙여넣은 HTML의 class·<style>을 버리고 일부 인라인 서식만 살리므로
   제목은 굵은 큰 글자, 표는 테두리 인라인, 그림은 공개 주소 <img>로 만든다(근거: 작업 폴더 evidence/research-naver-paste.md). */
(function () {
  'use strict';
  const STORE = 'https://ztypllzgjivutzorhayz.supabase.co/storage/v1/object/public/articles/';
  const TAGS = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'STRONG', 'B', 'EM', 'I', 'U', 'BR', 'HR', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'CAPTION', 'FIGURE', 'FIGCAPTION', 'IMG', 'A', 'SMALL', 'SPAN', 'MARK']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'LINK', 'META']);
  const ATTRS = { IMG: ['src', 'alt', 'width', 'height'], A: ['href'], TH: ['colspan', 'rowspan', 'scope'], TD: ['colspan', 'rowspan'] };
  const safeHref = v => { try { const u = new URL(v, location.href); return /^https?:$/.test(u.protocol) ? u.href : null; } catch (_) { return null; } };
  const safeImg = v => typeof v === 'string' && v.startsWith(STORE) && !/[\s"'<>]/.test(v) ? v : null;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : String(v));
    });
    kids.flat().forEach(k => { if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); });
    return e;
  }

  // 허용한 것만 다시 만든 본문(DocumentFragment)
  function sanitize(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + String(html || ''), 'text/html');
    const out = document.createDocumentFragment();
    const walk = (src, dst) => {
      src.childNodes.forEach(n => {
        if (n.nodeType === 3) { dst.append(document.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1 || DROP.has(n.tagName)) return;
        if (!TAGS.has(n.tagName)) { walk(n, dst); return; } // 모르는 태그는 글자만 살림
        const e = document.createElement(n.tagName.toLowerCase());
        (ATTRS[n.tagName] || []).forEach(a => {
          let v = n.getAttribute(a); if (v == null) return;
          if (a === 'href') v = safeHref(v);
          if (a === 'src') v = safeImg(v);
          if ((a === 'width' || a === 'height' || a === 'colspan' || a === 'rowspan') && !/^\d{1,4}$/.test(v)) v = null;
          if (a === 'scope' && !/^(row|col)$/.test(v)) v = null;
          if (v != null) e.setAttribute(a, a === 'alt' ? v.slice(0, 300) : v);
        });
        if (n.tagName === 'IMG' && !e.getAttribute('src')) return; // 우리 저장소가 아닌 그림은 버림
        if (n.tagName === 'A') { if (!e.getAttribute('href')) { walk(n, dst); return; } e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer'); }
        walk(n, e); dst.append(e);
      });
    };
    walk(doc.body, out);
    return out;
  }
  function render(article) {
    const body = el('div', { class: 'art-body' });
    body.append(sanitize(article.body_html));
    body.querySelectorAll('img').forEach(img => { img.loading = 'lazy'; img.decoding = 'async'; });
    body.querySelectorAll('table').forEach(t => { const wrap = el('div', { class: 'art-table-wrap', tabindex: '0', role: 'region', 'aria-label': '표 · 좌우로 밀어 볼 수 있습니다' }); t.replaceWith(wrap); wrap.append(t); });
    return body;
  }

  // ── 복사용 HTML ──
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 홈페이지·워드프레스용: 뜻이 분명한 기본 태그 + 그림 주소(alt·크기·늦게 불러오기)
  function webHtml(article) {
    const frag = sanitize(article.body_html), lines = [`<h1>${esc(article.title)}</h1>`];
    const ser = (n, depth) => {
      if (n.nodeType === 3) return esc(n.nodeValue);
      const t = n.tagName.toLowerCase(), kids = [...n.childNodes].map(c => ser(c, depth + 1)).join('');
      if (t === 'br') return '<br>';
      if (t === 'hr') return '<hr>';
      if (t === 'img') return `<img src="${esc(n.getAttribute('src'))}" alt="${esc(n.getAttribute('alt') || '')}"${n.getAttribute('width') ? ` width="${n.getAttribute('width')}" height="${n.getAttribute('height') || ''}"` : ''} loading="lazy">`;
      if (t === 'a') return `<a href="${esc(n.getAttribute('href'))}" target="_blank" rel="noopener">${kids}</a>`;
      const attrs = ['colspan', 'rowspan', 'scope'].filter(a => n.getAttribute(a)).map(a => ` ${a}="${esc(n.getAttribute(a))}"`).join('');
      return `<${t}${attrs}>${kids}</${t}>`;
    };
    [...frag.childNodes].forEach(n => { const s = ser(n, 0).trim(); if (s) lines.push(s); });
    return lines.join('\n');
  }
  // 네이버 블로그 편집기용: 인라인 서식만(편집기가 class·style 묶음을 버림). 제목은 굵은 큰 글자 문단, 표는 테두리 인라인.
  const NV = {
    p: 'font-size:16px;line-height:1.8;color:#222;margin:0 0 16px',
    h2: 'font-size:24px;font-weight:bold;color:#111;line-height:1.5;margin:32px 0 12px',
    h3: 'font-size:19px;font-weight:bold;color:#111;line-height:1.5;margin:24px 0 8px',
    table: 'border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:15px',
    th: 'border:1px solid #bbbbbb;background:#f2f4f7;padding:8px 10px;text-align:left;font-weight:bold',
    td: 'border:1px solid #bbbbbb;padding:8px 10px;vertical-align:top',
    blockquote: 'border-left:4px solid #c9a227;background:#faf7ec;margin:16px 0;padding:12px 16px;font-size:16px;line-height:1.7',
    figcaption: 'font-size:13px;color:#777;text-align:center;margin:6px 0 18px',
    small: 'font-size:13px;color:#666;line-height:1.7'
  };
  function naverHtml(article) {
    const frag = sanitize(article.body_html);
    const ser = n => {
      if (n.nodeType === 3) return esc(n.nodeValue);
      const t = n.tagName.toLowerCase(), kids = [...n.childNodes].map(ser).join('');
      switch (t) {
        case 'h2': return `<p style="${NV.p}"><br></p><p style="${NV.h2}"><span style="font-size:24px"><b>${kids}</b></span></p>`;
        case 'h3': case 'h4': return `<p style="${NV.h3}"><span style="font-size:19px"><b>${kids}</b></span></p>`;
        case 'p': return `<p style="${NV.p}"><span style="font-size:16px">${kids}</span></p>`;
        case 'strong': case 'b': return `<b>${kids}</b>`;
        case 'em': case 'i': return `<i>${kids}</i>`;
        case 'mark': return `<span style="background-color:#fff3b0">${kids}</span>`;
        case 'small': return `<span style="${NV.small}">${kids}</span>`;
        case 'ul': case 'ol': return `<${t} style="font-size:16px;line-height:1.8;margin:0 0 16px">${kids}</${t}>`;
        case 'li': return `<li style="margin:0 0 6px"><span style="font-size:16px">${kids}</span></li>`;
        case 'blockquote': return `<blockquote style="${NV.blockquote}">${kids}</blockquote>`;
        case 'table': return `<table style="${NV.table}" border="1" cellpadding="8" cellspacing="0">${kids}</table>`;
        case 'th': case 'td': return `<${t} style="${NV[t]}"${n.getAttribute('colspan') ? ` colspan="${n.getAttribute('colspan')}"` : ''}>${kids}</${t}>`;
        case 'figure': return `<div style="text-align:center;margin:20px 0">${kids}</div>`;
        case 'figcaption': return `<p style="${NV.figcaption}">${kids}</p>`;
        case 'img': return `<img src="${esc(n.getAttribute('src'))}" alt="${esc(n.getAttribute('alt') || '')}" style="max-width:100%;height:auto"${n.getAttribute('width') ? ` width="${Math.min(+n.getAttribute('width'), 900)}"` : ''}>`;
        case 'a': return `<a href="${esc(n.getAttribute('href'))}">${kids}</a>`;
        case 'hr': return '<hr>';
        case 'br': return '<br>';
        default: return `<${t}>${kids}</${t}>`;
      }
    };
    return `<div style="font-size:16px;line-height:1.8;color:#222">${[...frag.childNodes].map(ser).join('')}</div>`;
  }
  // 글자만(붙여넣기 대체용): 줄 바꿈을 살린 순수 글
  function plainText(article) {
    const frag = sanitize(article.body_html), out = [article.title, ''];
    const block = new Set(['p', 'h2', 'h3', 'h4', 'li', 'blockquote', 'figcaption', 'caption', 'tr']);
    const walk = (n, acc) => {
      if (n.nodeType === 3) { acc.push(n.nodeValue); return; }
      const t = n.tagName.toLowerCase();
      if (t === 'img') return;
      if (t === 'br') { acc.push('\n'); return; }
      if (t === 'td' || t === 'th') { const s = []; n.childNodes.forEach(c => walk(c, s)); acc.push(s.join('').trim() + ' | '); return; }
      const s = []; n.childNodes.forEach(c => walk(c, s));
      let text = s.join('');
      if (t === 'li') text = '• ' + text.trim();
      if (t === 'h2' || t === 'h3') text = '\n■ ' + text.trim();
      if (t === 'tr') text = '| ' + text.trim();
      acc.push(block.has(t) ? text.trim() + '\n' : text);
    };
    frag.childNodes.forEach(n => { const s = []; walk(n, s); const v = s.join('').replace(/\n{3,}/g, '\n\n'); if (v.trim()) out.push(v.trimEnd()); });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ── 클립보드: 버튼을 누른 순간에 쓰기 시작(사파리는 누른 직후가 아니면 막음). 글을 아직 안 받았으면 약속(Promise)으로 넘김 ──
  // rich=true: 서식(text/html)+글자(text/plain), false: 글자만(HTML 원문 복사)
  async function writeClipboard(getParts, rich) {
    const parts = typeof getParts === 'function' ? null : getParts;
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      try {
        const p = parts ? Promise.resolve(parts) : Promise.resolve().then(getParts);
        const item = { 'text/plain': p.then(x => new Blob([x.text], { type: 'text/plain' })) };
        if (rich) item['text/html'] = p.then(x => new Blob([x.html], { type: 'text/html' }));
        await navigator.clipboard.write([new ClipboardItem(item)]);
        return 'clipboard';
      } catch (e) { console.debug('[art clipboard]', e && e.name); }
    }
    // 대체: 화면 밖에 그려 선택한 뒤 복사(서식 포함 복사가 되는 오래된 방식)
    const x = parts || await getParts();
    const box = el('div', { contenteditable: 'true', 'aria-hidden': 'true', style: 'position:fixed;left:-99999px;top:0;width:800px;opacity:0' });
    if (rich && x.html) box.append(sanitizeForCopy(x.html)); else { box.style.whiteSpace = 'pre'; box.textContent = x.text; }
    document.body.append(box);
    const sel = getSelection(), range = document.createRange(); range.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(range);
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    sel.removeAllRanges(); box.remove();
    if (!ok) throw new Error('copy_failed');
    return 'execCommand';
  }
  // 대체 복사용: 우리가 만든 HTML 문자열을 그대로 붙이되 스크립트 실행 경로는 없음(태그·인라인 style만 존재)
  function sanitizeForCopy(html) { const t = document.createElement('template'); t.innerHTML = html; t.content.querySelectorAll('script,iframe,object,embed').forEach(n => n.remove()); return t.content; }

  function fileBase(article) { return String(article.title || '글').replace(/[\\/:*?"<>|#%]/g, '').replace(/\s+/g, '_').slice(0, 40) || '글'; }
  function copyHtml(getArticle) { return writeClipboard(() => Promise.resolve(getArticle()).then(a => ({ text: webHtml(a) + '\n' })), false); }
  function copyRich(getArticle) { return writeClipboard(() => Promise.resolve(getArticle()).then(a => ({ html: naverHtml(a), text: plainText(a) })), true); }
  async function downloadImages(article, onStep) {
    const imgs = (article.images || []).filter(i => safeImg(i.url));
    let n = 0;
    for (const [i, img] of imgs.entries()) {
      if (onStep) onStep(i + 1, imgs.length);
      const r = await fetch(img.url, { mode: 'cors', credentials: 'omit' });
      if (!r.ok) throw new Error('image_' + r.status);
      const blob = await r.blob(), ext = /png/.test(blob.type) ? 'png' : /webp/.test(blob.type) ? 'webp' : 'jpg';
      const url = URL.createObjectURL(blob), a = el('a', { href: url, download: `${fileBase(article)}_그림${i + 1}.${ext}`, hidden: true });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); n++;
      await new Promise(res => setTimeout(res, 400)); // 여러 장을 연달아 받을 때 브라우저가 막지 않게
    }
    return n;
  }

  // 보관한 글 위에 붙이는 '게시 전 안내'(근거: 금소법·광고심의 자료, STANDARD-ART.md)
  function postingGuide() {
    return el('section', { class: 'art-guide', 'aria-labelledby': 'art-guide-title' },
      el('h3', { id: 'art-guide-title' }, '게시 전에 꼭 확인하세요'),
      el('ol', {},
        el('li', {}, el('b', {}, '본인 경험 한두 줄을 더하세요. '), '상담하며 실제로 겪은 일이나 고객이 자주 묻는 점을 한두 문장 넣으면 글이 더 믿음직하고, 다른 글과 겹치지 않습니다(고객 이름·연락처 등 개인정보는 넣지 마세요).'),
        el('li', {}, el('b', {}, '고친 뒤 광고심의를 받고 게시하세요. '), '블로그·홈페이지 글도 업무광고입니다. 회사 광고심의 절차로 심의를 받은 뒤, 받은 심의필 번호를 글 아래에 적어 게시하세요.'),
        el('li', {}, el('b', {}, '보험사 이름·상품 이름은 넣지 마세요. '), '넣으면 상품광고가 되어 심의 기준이 달라집니다. 숫자·제도는 게시 시점 기준으로 한 번 더 확인하세요.'),
        el('li', {}, el('b', {}, '글 아래 안내 문구는 지우지 마세요. '), '[대리점명·등록번호]·[심의필 번호] 자리는 본인 정보로 채우세요.')));
  }
  function tagChips(tags) {
    const t = tags || {}, list = [t.insurance, t.format, t.length].filter(v => typeof v === 'string' && v);
    return list.length ? el('ul', { class: 'art-tags', 'aria-label': '글 분류' }, ...list.map(v => el('li', {}, v))) : null;
  }
  const kDate = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }); };
  const daysLeft = v => { const d = Date.parse(v); return Number.isNaN(d) ? null : Math.max(0, Math.ceil((d - Date.now()) / 86400000)); };

  // 버튼 묶음: [HTML 복사] [서식 그대로 복사] [그림 내려받기]. getArticle: 글을 돌려주는 함수(필요할 때 받아 옴)
  function actionButtons(getArticle, status, opts) {
    const o = opts || {}, locked = !!o.locked;
    const say = t => { if (status) status.textContent = t; };
    const mk = (label, title, fn) => el('button', { type: 'button', class: 'g-btn g-btn--ghost art-act', disabled: locked, title, onclick: async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try { await fn(b); } catch (e) { console.debug('[art action]', e); say(/image_/.test(e && e.message) ? '그림을 받지 못했습니다. 잠시 후 다시 눌러 주세요.' : '하지 못했습니다. 다시 눌러 주세요. 계속 안 되면 글을 직접 선택해 복사해 주세요.'); }
      finally { b.disabled = locked; }
    } }, label);
    const a = mk('HTML 복사', '홈페이지·워드프레스의 HTML(코드) 편집 칸에 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyHtml(getArticle); say('HTML을 복사했습니다. 홈페이지·워드프레스의 HTML(코드) 편집 칸에 붙여 넣으세요. 그림 주소도 들어 있습니다.'); });
    const b = mk('서식 그대로 복사', '네이버 블로그 편집기에 그대로 붙여 넣는 형식', async () => { say('복사하는 중…'); await copyRich(getArticle); say('서식째 복사했습니다. 네이버 블로그 글쓰기 화면 본문에 붙여 넣으세요. 그림이 안 붙으면 [그림 내려받기]로 받아 직접 올려 주세요.'); });
    const c = mk('그림 내려받기', '글에 들어간 그림 파일을 모두 내려받기', async () => { const art = await getArticle(); const n = await downloadImages(art, (i, all) => say(`그림 ${i}/${all}장 내려받는 중…`)); say(n ? `그림 ${n}장을 내려받았습니다.` : '이 글에는 내려받을 그림이 없습니다.'); });
    return el('div', { class: 'art-actions', role: 'group', 'aria-label': '글 가져가기' }, a, b, c);
  }

  window.PA_ART_CORE = { STORE, el, sanitize, render, webHtml, naverHtml, plainText, writeClipboard, copyHtml, copyRich, downloadImages, postingGuide, tagChips, actionButtons, kDate, daysLeft, fileBase };
})();
