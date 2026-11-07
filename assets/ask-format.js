/* Answers are untrusted input. Only freshly constructed allowlisted DOM leaves this module. */
(() => {
  'use strict';

  const allowed = new Set(['b', 'strong', 'mark', 'span', 'br', 'p', 'ul', 'li']);
  const discard = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'svg', 'math', 'object',
    'embed', 'applet', 'template', 'noscript', 'noembed', 'noframes', 'head',
    'title', 'textarea', 'xmp', 'plaintext', 'canvas', 'audio', 'video'
  ]);
  const htmlNamespace = 'http://www.w3.org/1999/xhtml';
  const blockWrappers = new Set(['div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'tr', 'td', 'th',
    'dl', 'dt', 'dd', 'address', 'figure', 'figcaption', 'ol']);
  const residentPattern = /(^|[^\d])(\d{6})[\s.\-\u2010-\u2015\u200b-\u200d\u2060\ufeff]*(\d(?:[\s\u200b-\u200d\u2060\ufeff]*\d){6})(?!\d)/g;

  function maskPlain(value) {
    return value.replace(residentPattern, '$1$2-*******');
  }

  // Browsers can report CSP errors for hostile attributes even in an inert template.
  // Remove source attributes before parsing; the DOM allowlist below remains the security gate.
  // Only a literal known class value may be emitted, never a source attribute value.
  function withoutSourceAttributes(value) {
    let result = '', cursor = 0;
    while (cursor < value.length) {
      const opening = value.indexOf('<', cursor);
      if (opening === -1) { result += value.slice(cursor); break; }
      result += value.slice(cursor, opening);
      if (value.startsWith('<!--', opening)) {
        const closing = /--!?>/g;
        closing.lastIndex = opening + 4;
        const match = closing.exec(value);
        cursor = match ? closing.lastIndex : value.length;
        continue;
      }
      const token = /^<(\/)?([a-z][a-z0-9:-]*)/i.exec(value.slice(opening));
      if (!token) {
        // Unrecognized less-than characters stay text and cannot introduce an unfiltered tag.
        result += '&lt;';
        cursor = opening + 1;
        continue;
      }
      let end = opening + token[0].length, quote = '';
      for (; end < value.length; end++) {
        const character = value[end];
        if (quote) { if (character === quote) quote = ''; }
        else if (character === '"' || character === "'") quote = character;
        else if (character === '>') break;
      }
      if (end === value.length) break;
      const tag = token[2].toLowerCase();
      const closing = Boolean(token[1]);
      let className = '';
      if (!closing && (tag === 'span' || tag === 'mark')) {
        const attributes = value.slice(opening + token[0].length, end);
        const match = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(attributes);
        const classes = new Set((match ? match[1] || match[2] || match[3] || '' : '').split(/\s+/));
        if (classes.has('pa-hl-warning')) className = ' class="pa-hl-warning"';
        else if (classes.has('pa-hl-key')) className = ' class="pa-hl-key"';
      }
      result += '<' + (closing ? '/' : '') + tag + className + '>';
      cursor = end + 1;
    }
    return result;
  }

  // Strip the destination without ever creating a link, including nested parentheses.
  function plainLinks(value) {
    let out = '';
    for (let i = 0; i < value.length;) {
      const image = value[i] === '!' && value[i + 1] === '[';
      const start = image ? i + 1 : i;
      if (value[start] === '[') {
        const labelEnd = value.indexOf(']', start + 1);
        if (labelEnd !== -1 && value[labelEnd + 1] === '(') {
          let end = labelEnd + 2, depth = 1;
          for (; end < value.length && depth; end++) {
            if (value[end] === '\\') { end++; continue; }
            if (value[end] === '(') depth++;
            if (value[end] === ')') depth--;
          }
          if (!depth) {
            out += value.slice(start + 1, labelEnd);
            i = end;
            continue;
          }
        }
        if (labelEnd !== -1 && value[labelEnd + 1] === '[') {
          const refEnd = value.indexOf(']', labelEnd + 2);
          if (refEnd !== -1) {
            out += value.slice(start + 1, labelEnd);
            i = refEnd + 1;
            continue;
          }
        }
      }
      out += value[i++];
    }
    return out;
  }

  function plainMarkdown(value) {
    return plainLinks(value.replace(/\r\n?/g, '\n'))
      .replace(/^[ \t]*\[[^\]\n]+\]:[ \t]*\S+.*$/gm, '')
      .replace(/^[ \t]*(?:`{3,}|~{3,}).*$/gm, '')
      .replace(/^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/gm, '')
      .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, '')
      .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, '')
      .replace(/[ \t]+#{1,6}[ \t]*$/gm, '')
      .replace(/^[ \t]*(?:>[ \t]*)+/gm, '')
      .replace(/^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/gm, '')
      .replace(/\|/g, '  ')
      .replace(/`+/g, '')
      .replace(/~~/g, '')
      .replace(/\\([\\`*{}[\]()#+\-.!_>|~])/g, '$1');
  }

  function unmark(value) {
    // Keep ordinary word separators, but remove incomplete emphasis delimiters.
    return value.replace(/\*+/g, '').replace(/__+/g, '')
      .replace(/(^|\s)_([^_\n]+)_([\s.,!?;:]|$)/g, '$1$2$3')
      .replace(/\uE000/g, '*******');
  }

  function appendText(target, value) {
    // Existing privacy masks must survive Markdown emphasis cleanup, even in a separate tag.
    const clean = plainMarkdown(value.replace(/\*{7}(?!\*)/g, '\uE000'));
    const bold = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;
    let cursor = 0, match;
    while ((match = bold.exec(clean))) {
      target.append(document.createTextNode(unmark(clean.slice(cursor, match.index))));
      const strong = document.createElement('strong');
      strong.textContent = unmark(match[2]);
      target.append(strong);
      cursor = bold.lastIndex;
    }
    target.append(document.createTextNode(unmark(clean.slice(cursor))));
  }

  function copySafe(source, target) {
    for (const node of source.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        appendText(target, node.data);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.localName.toLowerCase();
      if (node.namespaceURI !== htmlNamespace || discard.has(tag)) continue;
      if (!allowed.has(tag)) {
        if (blockWrappers.has(tag)) target.append(document.createTextNode('\n'));
        copySafe(node, target);
        if (blockWrappers.has(tag)) target.append(document.createTextNode('\n'));
        continue;
      }
      const clean = document.createElement(tag);
      if (tag === 'mark' || tag === 'span') {
        const classes = new Set((node.getAttribute('class') || '').split(/\s+/));
        if (classes.has('pa-hl-warning')) clean.className = 'pa-hl-warning';
        else if (classes.has('pa-hl-key')) clean.className = 'pa-hl-key';
      }
      copySafe(node, clean);
      target.append(clean);
    }
  }

  // Read all final text nodes together so tags cannot split an identifier to evade masking.
  function maskTree(root) {
    const nodes = [], breaks = [];
    let value = '';
    function boundary() { if (value && !value.endsWith('\n')) value += '\n'; }
    function collect(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        nodes.push({ node, start: value.length, end: value.length + node.data.length });
        value += node.data;
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'br') {
        breaks.push({ node, position: value.length });
        value += '\n';
        return;
      }
      const block = node.nodeType === Node.ELEMENT_NODE && ['p', 'ul', 'li'].includes(node.localName);
      if (block) boundary();
      for (const child of node.childNodes) collect(child);
      if (block) boundary();
    }
    collect(root);
    const matches = [];
    residentPattern.lastIndex = 0;
    let match;
    while ((match = residentPattern.exec(value))) {
      matches.push({ start: match.index + match[1].length, end: residentPattern.lastIndex, text: match[2] + '-*******' });
    }
    for (const item of matches.reverse()) {
      for (const line of breaks) {
        if (line.position > item.start && line.position < item.end) line.node.remove();
      }
      let inserted = false;
      for (const entry of nodes) {
        if (entry.end <= item.start || entry.start >= item.end) continue;
        const start = Math.max(0, item.start - entry.start);
        const end = Math.min(entry.end - entry.start, item.end - entry.start);
        entry.node.data = entry.node.data.slice(0, start) + (inserted ? '' : item.text) + entry.node.data.slice(end);
        inserted = true;
      }
    }
  }

  function trimBlockSpacing(root) {
    const blocks = new Set(['p', 'ul', 'li']);
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const remove = []; let node;
    while ((node = walk.nextNode())) {
      if (!/^[\s]*$/.test(node.data) || !/[\r\n]/.test(node.data)) continue;
      const before = node.previousSibling, after = node.nextSibling;
      if (blocks.has(node.parentNode.localName) || (before && blocks.has(before.localName)) || (after && blocks.has(after.localName))) {
        if (before && after && !blocks.has(before.localName) && !blocks.has(after.localName) && node.parentNode.localName !== 'ul') node.data = ' ';
        else remove.push(node);
      }
    }
    remove.forEach(node => node.remove());
  }

  function fragment(raw) {
    // The detached document has no browsing context; its template supplies an inert parse tree.
    const detached = document.implementation.createHTMLDocument('');
    const template = detached.createElement('template');
    // This is the only HTML parse. Neither the source document nor its nodes are inserted.
    template.innerHTML = withoutSourceAttributes(maskPlain(String(raw == null ? '' : raw)));
    const safe = document.createDocumentFragment();
    copySafe(template.content, safe);
    trimBlockSpacing(safe);
    maskTree(safe);
    return safe;
  }

  function text(raw) {
    const root = fragment(raw);
    let value = '';
    function newline() { if (value && !value.endsWith('\n')) value += '\n'; }
    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) { value += node.data; return; }
      const block = node.nodeType === Node.ELEMENT_NODE && ['p', 'ul', 'li'].includes(node.localName);
      if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'br') { value += '\n'; return; }
      if (block) newline();
      for (const child of node.childNodes) visit(child);
      if (block) newline();
    }
    visit(root);
    return maskPlain(value).replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  window.PA_ASK_FORMAT = Object.freeze({ fragment, text });
})();
