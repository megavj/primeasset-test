/* 메인 '함께하는 본부' — 관리자 모드에서 넣은 본부 주소를 읽어 연결. 번호·주소만 공개(이름·전화 없음) */
(async function () {
  const C = window.PA_AUTH || {}, box = document.getElementById("branch-list");
  if (!box || !C.url || !C.anonKey || !window.supabase) return;
  const { data, error } = await window.supabase.createClient(C.url, C.anonKey).from("branches").select("no,url,sort").eq("visible", true).order("sort");
  if (error || !data || !data.length) return;
  box.replaceChildren(...data.map(b => {
    const e = document.createElement(b.url ? "a" : "span");
    e.className = "br" + (b.url ? "" : " off");
    if (b.url) { e.href = b.url; e.target = "_blank"; e.rel = "noopener"; }
    const n = document.createElement("b"); n.textContent = b.no; e.append(n, "본부");
    if (!b.url) { const s = document.createElement("small"); s.textContent = "연결 준비 중"; e.append(s); }
    return e;
  }));
})();
