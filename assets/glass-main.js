/* 메인(index.html) 후기·사진 그리기 — 데이터 파일이 비어 있으면 섹션은 숨긴 채(hidden) 둡니다.
   데이터 파일(저장소 안, JSON 배열):
     assets/testimonials.json  항목 {"quote":"후기 본문", "name":"이름(이니셜 가능)", "role":"소속·역할", "since":"합류 시기", "consent":true}
                               → consent 가 true 인 항목만, 최대 3개 표시
     assets/photos.json        항목 {"src":"assets/photos/파일명.jpg", "alt":"사진 설명", "caption":"사진 아래 글", "width":1200, "height":900}
                               → 최대 6장, width/height 는 선택(있으면 자리 흔들림 방지)
   넣는 방법: ../reports/S2-후기사진-넣는법.md 참고. 외부 주소·추적 스크립트 없음. 파일을 못 읽거나 형식이 틀려도 조용히 넘어갑니다.
   하네스용: <script data-testimonials="…" data-photos="…"> 로 다른 파일을 가리킬 수 있음(저장소 밖 예시 캡처용). */
(function () {
  var ds = (document.currentScript && document.currentScript.dataset) || {};
  function load(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v) { return typeof v === "string" ? v.trim() : ""; }

  load(ds.testimonials || "assets/testimonials.json").then(function (list) {
    var sec = document.getElementById("reviews"), box = document.getElementById("review-list");
    if (!sec || !box || !Array.isArray(list)) return;
    var items = list.filter(function (t) { return t && t.consent === true && str(t.quote); }).slice(0, 3);
    if (!items.length) return;
    items.forEach(function (t) {
      var fig = el("figure", "g-tile g-review");
      var bq = el("blockquote"); bq.appendChild(el("p", null, str(t.quote))); fig.appendChild(bq);
      var cap = el("figcaption");
      if (str(t.name)) cap.appendChild(el("b", null, str(t.name)));
      var meta = [str(t.role), str(t.since)].filter(Boolean).join(" · ");
      if (meta) cap.appendChild(document.createTextNode(meta));
      if (cap.childNodes.length) fig.appendChild(cap);
      box.appendChild(fig);
    });
    sec.hidden = false;
  });

  load(ds.photos || "assets/photos.json").then(function (list) {
    var sec = document.getElementById("photos"), box = document.getElementById("photo-list");
    if (!sec || !box || !Array.isArray(list)) return;
    var items = list.filter(function (p) { return p && str(p.src); }).slice(0, 6);
    if (!items.length) return;
    items.forEach(function (p) {
      var fig = el("figure", "g-photo");
      var img = el("img"); img.src = str(p.src); img.alt = str(p.alt); img.loading = "lazy"; img.decoding = "async";
      if (p.width > 0 && p.height > 0) { img.width = p.width; img.height = p.height; }
      fig.appendChild(img);
      if (str(p.caption)) fig.appendChild(el("figcaption", null, str(p.caption)));
      box.appendChild(fig);
    });
    sec.hidden = false;
  });
})();
