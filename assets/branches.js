/* 메인 '함께하는 본부' — 관리자 모드에서 넣은 본부 주소를 읽어 연결. 번호·주소만 공개(이름·전화 없음)
   AUDIT-20261103: 공개 읽기 1건 때문에 Supabase SDK(약 218KB)를 받지 않도록 같은 조건을 REST로 직접 읽음(같은 anon 키, 쿠키·세션 안 보냄).
   주소는 http(s)만 링크로 만든다(그 밖의 값은 '연결 준비 중'으로 표시). */
(async function () {
  const C = window.PA_AUTH || {}, box = document.getElementById("branch-list");
  if (!box || !C.url || !C.anonKey || typeof fetch !== "function") return;
  let data;
  try {
    const res = await fetch(String(C.url).replace(/\/$/, "") + "/rest/v1/branches?select=no,url,sort&visible=eq.true&order=sort.asc",
      { headers: { apikey: C.anonKey, Authorization: "Bearer " + C.anonKey }, credentials: "omit" });
    if (!res.ok) return;
    data = await res.json();
  } catch (e) { return; }
  if (!Array.isArray(data) || !data.length) return;
  box.replaceChildren(...data.map(b => {
    const url = typeof b.url === "string" && /^https?:\/\//i.test(b.url) ? b.url : "";
    const e = document.createElement(url ? "a" : "span");
    e.className = "br" + (url ? "" : " off");
    if (url) { e.href = url; e.target = "_blank"; e.rel = "noopener"; }
    const n = document.createElement("b"); n.textContent = b.no; e.append(n, "본부");
    if (!url) { const s = document.createElement("small"); s.textContent = "연결 준비 중"; e.append(s); }
    return e;
  }));
})();
