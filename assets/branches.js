/* '함께하는 본부' 공통 — 메인(/)과 성장스토리(/story/)가 이 파일 하나를 같이 씀(2026-11-04 연동).
   ① 아래 기본 목록을 먼저 그림 → ② 관리자 모드(Supabase branches, visible·sort)에 값이 있으면 그것으로 바꿈.
   본부를 추가·변경할 때는 관리자 모드에서 바꾸면 두 페이지가 같이 바뀜(기본 목록은 서버를 못 읽을 때만 쓰임).
   [data-branch-count] 숫자도 같이 바뀜. 번호·주소만 공개(이름·전화 없음). 주소는 http(s)만 링크.
   2026-11-04 성장 나무: 메인·성장스토리는 목록(#branch-list) 대신 assets/growth-tree.js 가 그림 → 목록 칸이 없어도 개수는 여기서 계속 갱신.
   TASK43: PA_BRANCHES.subscribe(즉시 목록 + 갱신), load(공유 Promise)를 제공. 성장 나무·고정 버튼도 같은 REST 결과 사용.
   AUDIT-20261103: SDK 없이 REST 1건(같은 anon 키, 쿠키·세션 안 보냄). */
(function () {
  'use strict';
  const FALLBACK = [
    { no: "188", url: "https://188.primeasset.info/" }, { no: "227" }, { no: "236" }, { no: "242" }, { no: "246" },
    { no: "249" }, { no: "254" }, { no: "255", url: "https://prime255.com/" }, { no: "285" }, { no: "308" }, { no: "320" }, { no: "338" },
    { no: "345" }, { no: "346" }, { no: "350" }, { no: "364" }, { no: "375" }, { no: "379" }, { no: "384" }
  ];
  function safeUrl(value) {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return "";
    try {
      const url = new URL(value.trim());
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
    } catch (e) { return ""; }
  }
  function normalize(rows) {
    const seen = new Set();
    return Object.freeze(rows.filter(b => b && b.visible !== false).flatMap(b => {
      const no = String(b.no == null ? "" : b.no).trim();
      if (!/^[0-9A-Za-z가-힣-]{1,12}$/.test(no) || seen.has(no)) return [];
      seen.add(no);
      // 기존 규칙 유지: 주소가 비어 있으면 기본 주소(188·255)를 사용.
      const fallback = FALLBACK.find(f => f.no === no);
      return [Object.freeze({ no, url: safeUrl(b.url || (fallback && fallback.url)) })];
    }));
  }
  let current = normalize(FALLBACK);
  let request = null;
  const listeners = new Set();
  function publish(list) {
    current = list;
    listeners.forEach(listener => listener(current));
  }
  window.PA_BRANCHES = Object.freeze({
    subscribe(listener) {
      listeners.add(listener);
      listener(current);
      return () => listeners.delete(listener);
    },
    load
  });
  function render(list) {
    document.querySelectorAll("[data-branch-count]").forEach(el => { el.textContent = String(list.length); }); // 목록 칸이 없어도 개수는 갱신
    const box = document.getElementById("branch-list");
    if (!box) return;
    box.replaceChildren(...list.map(b => {
      const url = b.url;
      const e = document.createElement(url ? "a" : "span");
      e.className = "br" + (url ? "" : " off");
      if (url) { e.href = url; e.target = "_blank"; e.rel = "noopener"; e.setAttribute("aria-label", b.no + "본부 (새 창)"); }
      const n = document.createElement("b"); n.textContent = b.no; e.append(n, "본부");
      return e;
    }));
  }
  function load() {
    if (request) return request;
    request = (async () => {
      const C = window.PA_AUTH || {};
      if (!C.url || !C.anonKey || typeof fetch !== "function") return current;
      const ctl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
      try {
        const res = await fetch(String(C.url).replace(/\/$/, "") + "/rest/v1/branches?select=no,url,sort&visible=eq.true&order=sort.asc",
          { headers: { apikey: C.anonKey, Authorization: "Bearer " + C.anonKey }, credentials: "omit", signal: ctl ? ctl.signal : undefined });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length) {
            const list = normalize(data);
            if (list.length) publish(list);
          }
        }
      } catch (e) { /* 기본 목록 유지 */ }
      finally { clearTimeout(timer); }
      return current;
    })();
    return request;
  }
  function init() { window.PA_BRANCHES.subscribe(render); load(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
