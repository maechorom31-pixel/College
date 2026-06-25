/* 전문대 진학 탐색 - 메인 앱 (의존성 없는 바닐라 JS) */
(function () {
  "use strict";
  const $ = sel => document.querySelector(sel);
  const view = $("#view");
  const REGION_COLORS = {
    "수도권": "var(--r-수도권)", "중부권": "var(--r-중부권)",
    "영남권": "var(--r-영남권)", "호남권": "var(--r-호남권)"
  };
  const CAT_COLORS = {
    "공학": "#4263eb", "간호보건": "#0ca678", "예체능": "#e8590c",
    "인문사회": "#7048e8", "자연": "#1098ad", "자율전공": "#868e96"
  };

  const DATA = { meta: null, colleges: [], departments: [], byName: {} };
  const F = newFilters();
  let entity = "dept";          // dept | college
  let viewMode = "cards";       // cards | table
  let sortKey = "employ";

  /* ---------- 장바구니(비교함) ---------- */
  const CART = loadCart();
  function loadCart() { try { return new Set(JSON.parse(localStorage.getItem("cart") || "[]")); } catch (e) { return new Set(); } }
  function saveCart() { localStorage.setItem("cart", JSON.stringify([...CART])); }
  function toggleCart(key) { CART.has(key) ? CART.delete(key) : CART.add(key); saveCart(); updateCartBar(); }
  function updateCartBar() {
    const bar = $("#cartBar");
    const nav = $("#navCount");
    if (nav) { nav.textContent = CART.size; nav.classList.toggle("zero", CART.size === 0); }
    if (!bar) return;
    $("#cartCount").textContent = CART.size;
    bar.classList.toggle("hidden", CART.size === 0);
  }
  function cartItem(key) {
    if (key[0] === "d") {
      const d = DATA.departments.find(x => x.id === +key.slice(2)); if (!d) return null;
      const c = DATA.byName[d.college];
      return { key, type: "학과", title: d.unit, college: d.college, region: d.region, sido: d.sido,
        cat: [d.cat1, d.cat2, d.cat3].filter(Boolean).join(" › "), track: d.track26 || d.track25,
        comp: d.comp26 ?? d.comp25, avg: d.avg26 ?? d.avg25, employ: d.employ,
        fill: c ? c.fillRate["2025"] : null, tuition: c ? c.tuition["평균"] : null,
        level: d.level, deepen: d.deepen };
    }
    const c = DATA.byName[key.slice(2)]; if (!c) return null;
    return { key, type: "대학", title: c.name, college: c.name, region: c.region, sido: c.sido,
      cat: Object.keys(c.cats).join(", "), track: null, comp: null, avg: null, employ: c.employRate["2024"],
      fill: c.fillRate["2025"], tuition: c.tuition["평균"], level: null, deepen: null };
  }

  function newFilters() {
    return { regions: new Set(), sidos: new Set(), cat1: "", cat2: "", cat3: "",
             employMin: 0, tuitionMax: 0, compMax: 0, keyword: "" };
  }

  /* ---------- 부트 ---------- */
  async function init() {
    try {
      const [meta, colleges, departments] = await Promise.all([
        fetch("data/meta.json").then(r => r.json()),
        fetch("data/colleges.json").then(r => r.json()),
        fetch("data/departments.json").then(r => r.json())
      ]);
      DATA.meta = meta; DATA.colleges = colleges; DATA.departments = departments;
      colleges.forEach(c => DATA.byName[c.name] = c);
    } catch (e) {
      view.innerHTML = `<div class="empty">데이터를 불러오지 못했습니다. 로컬에서 열 때는 간단한 서버가 필요합니다.<br><code>python3 -m http.server</code></div>`;
      return;
    }
    $("#globalSearch").addEventListener("input", e => {
      F.keyword = e.target.value.trim();
      entity = "dept";            // 검색하면 해당 학과만 보이도록 학과 뷰로
      sortKey = "employ";
      if (!location.hash.startsWith("#/browse")) location.hash = "#/browse";
      else renderResults();
    });
    $("#cartOpen").addEventListener("click", () => location.hash = "#/compare");
    $("#cartClear").addEventListener("click", () => { CART.clear(); saveCart(); updateCartBar(); if (location.hash.startsWith("#/browse")) renderResults(); else if (location.hash.startsWith("#/compare")) renderCompare(); });
    updateCartBar();
    window.addEventListener("hashchange", route);
    route();
  }

  function route() {
    const h = location.hash || "#/";
    if (h.startsWith("#/browse")) renderBrowse();
    else if (h.startsWith("#/compare")) renderCompare();
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ---------- 홈 ---------- */
  function renderHome() {
    const m = DATA.meta, t = m.totals;
    view.innerHTML = `
      <section class="hero">
        <h1>지도에서 찾는 나의 전문대</h1>
        <p>권역을 클릭하거나 조건으로 좁혀 전국 전문대학과 학과를 탐색하세요.</p>
        <div class="stat-row">
          <div class="stat"><b>${t.colleges}</b><span>전문대학</span></div>
          <div class="stat"><b>${t.depts.toLocaleString()}</b><span>학과(모집단위)</span></div>
          <div class="stat"><b>${Object.keys(m.cats).length}</b><span>계열</span></div>
          <div class="stat"><b>4</b><span>권역</span></div>
        </div>
      </section>
      <div class="home-grid">
        <div class="map-panel">
          <h2>시·도 지도</h2>
          <p class="hint">시·도를 클릭하면 해당 지역 대학으로 이동합니다 · 색은 권역</p>
          <div id="mapHost"></div>
          <div class="map-legend">
            ${m.regions.map(rg => `<span><i style="background:${REGION_COLORS[rg]}"></i>${rg}</span>`).join("")}
          </div>
        </div>
        <div class="region-cards" id="regionCards"></div>
      </div>`;

    const sidoCounts = {};
    DATA.colleges.forEach(c => { if (c.sido) sidoCounts[c.sido] = (sidoCounts[c.sido] || 0) + 1; });
    const mapEl = buildKoreaMap(m, sidoCounts, gotoSido);
    $("#mapHost").appendChild(mapEl);

    $("#regionCards").innerHTML = m.regions.map(rg => {
      const st = m.regionStats[rg];
      return `<div class="rcard" data-region="${rg}" style="border-left-color:${REGION_COLORS[rg]}">
        <h3><span style="width:11px;height:11px;border-radius:3px;background:${REGION_COLORS[rg]};display:inline-block"></span>${rg}</h3>
        <div class="nums"><b>${st.colleges}</b>개 대학 · <b>${st.depts}</b>개 학과</div>
        <div class="sidos">${st.sidos.map(s => `<span>${s}</span>`).join("")}</div>
      </div>`;
    }).join("");
    $("#regionCards").querySelectorAll(".rcard").forEach(el =>
      el.addEventListener("click", () => gotoRegion(el.dataset.region)));
  }

  function gotoRegion(region) {
    Object.assign(F, newFilters());
    F.regions.add(region);
    entity = "college";
    location.hash = "#/browse";
  }
  function gotoSido(sido, region) {
    Object.assign(F, newFilters());
    F.regions.add(region);
    F.sidos.add(sido);
    entity = "college";
    location.hash = "#/browse";
  }

  /* ---------- 탐색(필터+결과) ---------- */
  function renderBrowse() {
    view.innerHTML = `
      <div class="browse">
        <aside class="filters" id="filters"></aside>
        <div class="results"><div id="resultsHead"></div><div id="resultsBody"></div></div>
      </div>`;
    renderFilters();
    renderResults();
  }

  function renderFilters() {
    const m = DATA.meta;
    const regionChips = m.regions.map(rg =>
      `<button class="chip ${F.regions.has(rg) ? "on" : ""}" data-region="${rg}">${rg}</button>`).join("");
    const sidoSet = new Set();
    m.regions.forEach(rg => { if (!F.regions.size || F.regions.has(rg)) m.regionStats[rg].sidos.forEach(s => sidoSet.add(s)); });
    const sidoChips = [...sidoSet].map(sd =>
      `<button class="chip ${F.sidos.has(sd) ? "on" : ""}" data-sido="${sd}">${sd}</button>`).join("");
    const cat1Opts = `<option value="">전체 계열</option>` +
      Object.keys(m.cats).map(c => `<option ${F.cat1 === c ? "selected" : ""}>${c}</option>`).join("");
    const cat2Opts = F.cat1 ? `<option value="">중분류 전체</option>` +
      Object.keys(m.cats[F.cat1] || {}).map(c => `<option ${F.cat2 === c ? "selected" : ""}>${c}</option>`).join("") : "";
    const cat3Opts = (F.cat1 && F.cat2) ? `<option value="">소분류 전체</option>` +
      (m.cats[F.cat1][F.cat2] || []).map(c => `<option ${F.cat3 === c ? "selected" : ""}>${c}</option>`).join("") : "";

    $("#filters").innerHTML = `
      <h2>필터 <button class="reset" id="resetF">초기화</button></h2>
      <div class="fgroup"><label>권역</label><div class="chips" id="cRegions">${regionChips}</div></div>
      <div class="fgroup"><label>시·도</label><div class="chips" id="cSidos">${sidoChips || '<span class="muted" style="font-size:12px">권역을 먼저 선택</span>'}</div></div>
      <div class="fgroup"><label>계열</label>
        <select id="cat1">${cat1Opts}</select>
        ${F.cat1 ? `<select id="cat2" style="margin-top:6px">${cat2Opts}</select>` : ""}
        ${F.cat2 ? `<select id="cat3" style="margin-top:6px">${cat3Opts}</select>` : ""}
      </div>
      <div class="fgroup"><label>취업률 <span class="range-val">${F.employMin ? F.employMin + "% ↑" : "전체"}</span></label>
        <input type="range" id="employMin" min="0" max="90" step="5" value="${F.employMin}"></div>
      <div class="fgroup"><label>등록금 평균 <span class="range-val">${F.tuitionMax ? "≤ " + (F.tuitionMax / 1000).toFixed(0) + "백만" : "전체"}</span></label>
        <input type="range" id="tuitionMax" min="0" max="10000" step="500" value="${F.tuitionMax}"></div>
      <div class="fgroup"><label>경쟁률 <span class="range-val">${F.compMax ? "≤ " + F.compMax + ":1" : "전체"}</span></label>
        <input type="range" id="compMax" min="0" max="20" step="1" value="${F.compMax}"></div>
      <div class="fgroup"><label>키워드</label>
        <input type="search" id="kw" value="${escAttr(F.keyword)}" placeholder="학과·대학명" style="width:100%;height:38px;border:1px solid var(--line);border-radius:9px;padding:0 10px"></div>`;

    // 바인딩
    $("#cRegions").querySelectorAll(".chip").forEach(b => b.onclick = () => {
      toggle(F.regions, b.dataset.region); F.sidos.clear(); renderFilters(); renderResults();
    });
    $("#cSidos").querySelectorAll(".chip").forEach(b => b.onclick = () => {
      toggle(F.sidos, b.dataset.sido); renderFilters(); renderResults();
    });
    $("#cat1").onchange = e => { F.cat1 = e.target.value; F.cat2 = ""; F.cat3 = ""; renderFilters(); renderResults(); };
    if ($("#cat2")) $("#cat2").onchange = e => { F.cat2 = e.target.value; F.cat3 = ""; renderFilters(); renderResults(); };
    if ($("#cat3")) $("#cat3").onchange = e => { F.cat3 = e.target.value; renderResults(); };
    bindRange("employMin"); bindRange("tuitionMax"); bindRange("compMax");
    $("#kw").oninput = e => { F.keyword = e.target.value.trim(); if (F.keyword) entity = "dept"; renderResults(); };
    $("#resetF").onclick = () => { Object.assign(F, newFilters()); $("#globalSearch").value = ""; renderFilters(); renderResults(); };
  }

  function bindRange(id) {
    const el = $("#" + id); if (!el) return;
    el.oninput = e => { F[id] = +e.target.value; const v = e.target.parentNode.querySelector(".range-val");
      // 라벨 즉시 갱신 위해 전체 재렌더(가벼움)
      renderFilters(); renderResults(); };
  }
  function toggle(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

  /* ---------- 결과 ---------- */
  function filteredDepts() {
    return DATA.departments.filter(d => {
      if (F.regions.size && !F.regions.has(d.region)) return false;
      if (F.sidos.size && !F.sidos.has(d.sido)) return false;
      if (F.cat1 && d.cat1 !== F.cat1) return false;
      if (F.cat2 && d.cat2 !== F.cat2) return false;
      if (F.cat3 && d.cat3 !== F.cat3) return false;
      if (F.employMin && !(d.employ >= F.employMin)) return false;
      const comp = d.comp26 ?? d.comp25;
      if (F.compMax && !(comp != null && comp <= F.compMax)) return false;
      if (F.tuitionMax) { const c = DATA.byName[d.college]; const t = c && c.tuition["평균"];
        if (!(t != null && t <= F.tuitionMax)) return false; }
      if (F.keyword && !matchKw(d)) return false;
      return true;
    });
  }
  function filteredColleges() {
    const depts = filteredDepts();
    const names = new Set(depts.map(d => d.college));
    return DATA.colleges.filter(c => {
      if (F.regions.size && !F.regions.has(c.region)) return false;
      if (F.sidos.size && !F.sidos.has(c.sido)) return false;
      if (F.tuitionMax) { const t = c.tuition["평균"]; if (!(t != null && t <= F.tuitionMax)) return false; }
      if (F.employMin) { const e = c.employRate["2024"]; if (!(e != null && e >= F.employMin)) return false; }
      // 계열/경쟁률/키워드는 학과 매칭 결과로 제한
      if ((F.cat1 || F.compMax || F.keyword) && !names.has(c.name)) return false;
      return true;
    });
  }
  function matchKw(d) {
    const k = F.keyword.toLowerCase();
    return d.college.toLowerCase().includes(k) || d.unit.toLowerCase().includes(k) ||
      (d.cat3 || "").toLowerCase().includes(k);
  }

  function renderResults() {
    const isDept = entity === "dept";
    const list = isDept ? sortDepts(filteredDepts()) : sortColleges(filteredColleges());
    $("#resultsHead").innerHTML = `
      <div class="results-head">
        <div class="count"><b>${list.length.toLocaleString()}</b> ${isDept ? "개 학과" : "개 대학"}</div>
        <div class="toolbar">
          <span class="seg ent">
            <button data-ent="dept" class="${isDept ? "on" : ""}">학과</button>
            <button data-ent="college" class="${!isDept ? "on" : ""}">대학</button>
          </span>
          <select id="sortSel">${sortOptions(isDept)}</select>
          <span class="seg">
            <button data-vm="cards" class="${viewMode === "cards" ? "on" : ""}">카드</button>
            <button data-vm="table" class="${viewMode === "table" ? "on" : ""}">표</button>
          </span>
        </div>
      </div>`;
    $("#resultsHead").querySelectorAll("[data-ent]").forEach(b => b.onclick = () => {
      entity = b.dataset.ent; sortKey = entity === "dept" ? "employ" : "employ"; renderResults();
    });
    $("#resultsHead").querySelectorAll("[data-vm]").forEach(b => b.onclick = () => { viewMode = b.dataset.vm; renderResults(); });
    $("#sortSel").onchange = e => { sortKey = e.target.value; renderResults(); };

    if (!list.length) { $("#resultsBody").innerHTML = `<div class="empty">조건에 맞는 결과가 없습니다.<br>필터를 완화해 보세요.</div>`; return; }
    $("#resultsBody").innerHTML = viewMode === "cards"
      ? (isDept ? deptCards(list) : collegeCards(list))
      : (isDept ? deptTable(list) : collegeTable(list));
    bindResultClicks(isDept);
  }

  function sortOptions(isDept) {
    const opts = isDept
      ? [["employ", "취업률 높은순"], ["compAsc", "경쟁률 낮은순"], ["compDesc", "경쟁률 높은순"], ["avg", "입결 등급 좋은순"], ["name", "가나다순"]]
      : [["employ", "취업률 높은순"], ["fill", "충원율 높은순"], ["tuitionAsc", "등록금 낮은순"], ["dept", "학과 많은순"], ["name", "가나다순"]];
    return opts.map(([v, t]) => `<option value="${v}" ${sortKey === v ? "selected" : ""}>${t}</option>`).join("");
  }
  const cmpNum = (a, b, dir = 1) => { if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1; return (a - b) * dir; };
  function sortDepts(l) {
    const s = l.slice();
    const k = sortKey;
    s.sort((a, b) => {
      if (k === "employ") return cmpNum(a.employ, b.employ, -1);
      if (k === "compAsc") return cmpNum(a.comp26 ?? a.comp25, b.comp26 ?? b.comp25, 1);
      if (k === "compDesc") return cmpNum(a.comp26 ?? a.comp25, b.comp26 ?? b.comp25, -1);
      if (k === "avg") return cmpNum(a.avg26 ?? a.avg25, b.avg26 ?? b.avg25, 1);
      return a.college.localeCompare(b.college, "ko") || a.unit.localeCompare(b.unit, "ko");
    });
    return s;
  }
  function sortColleges(l) {
    const s = l.slice(), k = sortKey;
    s.sort((a, b) => {
      if (k === "employ") return cmpNum(a.employRate["2024"], b.employRate["2024"], -1);
      if (k === "fill") return cmpNum(a.fillRate["2025"], b.fillRate["2025"], -1);
      if (k === "tuitionAsc") return cmpNum(a.tuition["평균"], b.tuition["평균"], 1);
      if (k === "dept") return cmpNum(a.deptCount, b.deptCount, -1);
      return a.name.localeCompare(b.name, "ko");
    });
    return s;
  }

  const naMetric = (label, val, suffix = "") => `<div class="metric">${label}<b class="${val == null ? "na" : ""}">${val == null ? "정보없음" : val + suffix}</b></div>`;

  function deptCards(list) {
    return `<div class="cards">` + list.slice(0, 300).map(d => {
      const comp = d.comp26 ?? d.comp25, avg = d.avg26 ?? d.avg25;
      const ck = "d:" + d.id;
      const track = d.track26 || d.track25;
      return `<div class="card" data-dept="${d.id}">
        <div class="ctop"><div><div class="unit">${d.unit}</div><div class="col">${d.college} · ${d.sido}</div></div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <button class="cart-add ${CART.has(ck) ? "on" : ""}" data-add="${ck}" title="비교함에 담기">${CART.has(ck) ? "✓" : "+"}</button>
            <span class="tag" style="background:${CAT_COLORS[d.cat1] || "#868e96"}">${d.cat1 || "-"}</span></div></div>
        <div class="badge-row">${d.cat3 ? `<span class="badge">${d.cat3}</span>` : ""}${d.level ? `<span class="badge">${d.level}년제</span>` : ""}${track ? `<span class="badge">${track} 전형</span>` : ""}${d.deepen === "O" ? `<span class="badge">전공심화</span>` : ""}</div>
        <div class="metrics">${naMetric("경쟁률", comp, ":1")}${naMetric("평균등급", avg)}${naMetric("취업률", d.employ, "%")}</div>
      </div>`;
    }).join("") + `</div>` + (list.length > 300 ? `<p class="muted" style="text-align:center;margin-top:14px">상위 300개만 표시됩니다. 필터로 좁혀 보세요.</p>` : "");
  }
  function collegeCards(list) {
    return `<div class="cards">` + list.map(c => `
      <div class="card" data-college="${escAttr(c.name)}">
        <div class="ctop"><div><div class="unit">${c.name}</div><div class="col">${c.location || c.sido}</div></div>
          <span class="tag" style="background:${REGION_COLORS[c.region]}">${c.region}</span></div>
        <div class="badge-row"><span class="badge">학과 ${c.deptCount}개</span>${Object.keys(c.cats).slice(0, 3).map(k => `<span class="badge">${k}</span>`).join("")}</div>
        <div class="metrics">${naMetric("취업률", c.employRate["2024"], "%")}${naMetric("충원율", c.fillRate["2025"], "%")}${naMetric("등록금", c.tuition["평균"] ? (c.tuition["평균"] / 1000).toFixed(1) : null, "백만")}</div>
      </div>`).join("") + `</div>`;
  }
  function deptTable(list) {
    const rows = list.slice(0, 500).map(d => `<tr data-dept="${d.id}">
      <td>${d.college}</td><td>${d.unit}</td><td>${d.sido}</td><td>${d.cat1 || "-"}</td>
      <td class="num">${fmt(d.comp26 ?? d.comp25)}</td><td class="num">${fmt(d.avg26 ?? d.avg25)}</td><td class="num">${fmt(d.employ, "%")}</td></tr>`).join("");
    return `<div class="tbl-wrap"><table><thead><tr><th>대학</th><th>학과</th><th>지역</th><th>계열</th><th>경쟁률</th><th>평균등급</th><th>취업률</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function collegeTable(list) {
    const rows = list.map(c => `<tr data-college="${escAttr(c.name)}">
      <td>${c.name}</td><td>${c.sido}</td><td>${c.region}</td><td class="num">${c.deptCount}</td>
      <td class="num">${fmt(c.employRate["2024"], "%")}</td><td class="num">${fmt(c.fillRate["2025"], "%")}</td><td class="num">${c.tuition["평균"] ? (c.tuition["평균"] / 1000).toFixed(1) + "백만" : "–"}</td></tr>`).join("");
    return `<div class="tbl-wrap"><table><thead><tr><th>대학</th><th>지역</th><th>권역</th><th>학과수</th><th>취업률</th><th>충원율</th><th>등록금</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function bindResultClicks(isDept) {
    view.querySelectorAll("[data-dept]").forEach(el => el.onclick = () => openDept(+el.dataset.dept));
    view.querySelectorAll("[data-college]").forEach(el => el.onclick = () => openCollege(el.dataset.college));
    view.querySelectorAll(".cart-add[data-add]").forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      toggleCart(btn.dataset.add);
      const on = CART.has(btn.dataset.add);
      btn.classList.toggle("on", on); btn.textContent = on ? "✓" : "+";
    });
  }

  /* ---------- 상세 모달 ---------- */
  function openCollege(name) {
    const c = DATA.byName[name]; if (!c) return;
    const depts = DATA.departments.filter(d => d.college === name);
    const tu = c.tuition;
    const tuItems = ["인문사회", "자연과학", "공학", "예체능"].map(k => ({ label: k.slice(0, 2), value: tu[k] ? Math.round(tu[k] / 1000 * 10) / 10 : null, color: "#4263eb" }));
    const body = `
      <section><h3>핵심 지표</h3><div class="kv">
        ${kv("권역 · 지역", `${c.region} · ${c.location || c.sido}`)}
        ${kv("개설 학과", c.deptCount + "개")}
        ${kv("취업률(2024)", fmt(c.employRate["2024"], "%"))}
        ${kv("신입생 충원율(2025)", fmt(c.fillRate["2025"], "%"))}
        ${kv("평균 등록금", tu["평균"] ? (tu["평균"] / 1000).toFixed(1) + "백만원" : "정보없음")}
      </div></section>
      <section><h3>취업률 추이</h3><div class="chart-box">${Charts.trend([
        { label: "'22", value: c.employRate["2022"] }, { label: "'23", value: c.employRate["2023"] }, { label: "'24", value: c.employRate["2024"] }
      ], { color: "#0ca678", fmt: v => v.toFixed(0) })}</div></section>
      <section><h3>신입생 충원율 추이</h3><div class="chart-box">${Charts.trend([
        { label: "'23", value: c.fillRate["2023"] }, { label: "'24", value: c.fillRate["2024"] }, { label: "'25", value: c.fillRate["2025"] }
      ], { color: "#4263eb", fmt: v => v.toFixed(0) })}</div></section>
      <section><h3>계열별 등록금 (백만원)</h3><div class="chart-box">${Charts.bars(tuItems, { fmt: v => v.toFixed(1) })}</div></section>
      <section><h3>개설 학과 (${depts.length})</h3>
        ${depts.slice(0, 40).map(d => `<div class="dept-link" data-dept="${d.id}"><span>${d.unit}</span><span class="muted">${d.cat1 || ""} ${d.employ != null ? "· 취업 " + d.employ + "%" : ""}</span></div>`).join("")}
      </section>`;
    showModal(c.name, `${c.region} · ${c.location || c.sido}`, body);
  }

  function openDept(id) {
    const d = DATA.departments.find(x => x.id === id); if (!d) return;
    const c = DATA.byName[d.college];
    const ck = "d:" + d.id;
    const body = `
      <button class="modal-add ${CART.has(ck) ? "on" : ""}" data-toggleadd="${ck}">${CART.has(ck) ? "✓ 비교함에 담김" : "＋ 비교함에 담기"}</button>
      <section><h3>학과 정보</h3><div class="kv">
        ${kv("대학", d.college)}${kv("계열", [d.cat1, d.cat2, d.cat3].filter(Boolean).join(" › "))}
        ${kv("지역", `${d.region} · ${d.location || d.sido}`)}${kv("학제", d.level ? d.level + "년제" : "정보없음")}
        ${kv("전공심화과정", d.deepen === "O" ? "개설" : "정보없음")}${kv("취업률(2024)", fmt(d.employ, "%"))}
      </div></section>
      <section><h3>입결 비교 (수시1차 · 2025 vs 2026)</h3><div class="kv">
        ${kv("대표 전형", `${d.track25 || "-"} → ${d.track26 || "-"}`)}
        ${kv("경쟁률", `${fmt(d.comp25)} → ${fmt(d.comp26)}`)}
        ${kv("평균 교과등급", `${fmt(d.avg25)} → ${fmt(d.avg26)}`)}
        ${kv("최저 교과등급", `${fmt(d.min25)} → ${fmt(d.min26)}`)}
        ${kv("모집인원(2027)", fmt(d.quota26 ?? d.quota25))}
      </div>
      <div class="chart-box" style="margin-top:12px">${Charts.bars([
        { label: "'25경쟁", value: d.comp25, color: "#adb5bd" }, { label: "'26경쟁", value: d.comp26, color: "#4263eb" },
        { label: "'25등급", value: d.avg25, color: "#ffd8a8" }, { label: "'26등급", value: d.avg26, color: "#e8590c" }
      ], { fmt: v => v.toFixed(1) })}</div></section>
      <section><h3>내신 반영</h3><div class="kv">
        ${kv("반영 학기", d.reflectTerm || "정보없음")}${kv("반영 과목", d.reflectSubj || "정보없음")}
      </div></section>
      ${c ? `<section><h3>소속 대학</h3><div class="dept-link" data-college="${escAttr(c.name)}"><span>${c.name}</span><span class="muted">취업 ${fmt(c.employRate["2024"], "%")} · 충원 ${fmt(c.fillRate["2025"], "%")}</span></div></section>` : ""}`;
    showModal(d.unit, `${d.college} · ${d.sido}`, body);
  }

  function showModal(title, sub, bodyHtml) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${title}</h2><div class="sub">${sub}</div>
        <button class="modal-close" aria-label="닫기">×</button></div>
      <div class="modal-body">${bodyHtml}</div></div>`;
    document.body.appendChild(bg);
    document.body.style.overflow = "hidden";
    const close = () => { bg.remove(); document.body.style.overflow = ""; };
    bg.addEventListener("click", e => { if (e.target === bg) close(); });
    bg.querySelector(".modal-close").onclick = close;
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });
    bg.querySelectorAll("[data-dept]").forEach(el => el.onclick = () => { close(); openDept(+el.dataset.dept); });
    bg.querySelectorAll("[data-college]").forEach(el => el.onclick = () => { close(); openCollege(el.dataset.college); });
    bg.querySelectorAll("[data-toggleadd]").forEach(btn => btn.onclick = () => {
      toggleCart(btn.dataset.toggleadd);
      const on = CART.has(btn.dataset.toggleadd);
      btn.classList.toggle("on", on); btn.textContent = on ? "✓ 비교함에 담김" : "＋ 비교함에 담기";
    });
    bg._close = close;
    return bg;
  }

  /* ---------- 비교함 전용 페이지 ---------- */
  const COMPARE_ROWS = [
    { label: "대학", get: i => i.college },
    { label: "지역", get: i => `${i.region} · ${i.sido}` },
    { label: "계열", get: i => i.cat || "-" },
    { label: "전형", get: i => i.track || "-" },
    { label: "경쟁률", get: i => fmt(i.comp, ":1") },
    { label: "평균 교과등급", get: i => fmt(i.avg), num: i => i.avg, dir: "low" },
    { label: "취업률", get: i => fmt(i.employ, "%"), num: i => i.employ, dir: "high" },
    { label: "충원율", get: i => fmt(i.fill, "%"), num: i => i.fill, dir: "high" },
    { label: "평균 등록금", get: i => i.tuition ? (i.tuition / 1000).toFixed(1) + "백만" : "정보없음", num: i => i.tuition, dir: "low" },
    { label: "전공심화", get: i => i.deepen === "O" ? "개설" : "정보없음" },
  ];
  function compareTableHtml(items) {
    const rows = COMPARE_ROWS;
    const head = `<tr><th class="rowh">항목</th>` + items.map(i =>
      `<th><div class="cname" data-open="${escAttr(i.key)}">${i.title}</div><div class="csub">${i.college}</div>
        <button class="rm" data-rm="${escAttr(i.key)}">✕ 제거</button></th>`).join("") + `</tr>`;
    const body = rows.map(r => {
      let best = null;
      if (r.dir) {
        const vals = items.map(r.num).filter(v => v != null);
        if (vals.length > 1) best = r.dir === "high" ? Math.max(...vals) : Math.min(...vals);
      }
      const cells = items.map(i => {
        const isBest = r.dir && r.num(i) != null && r.num(i) === best;
        return `<td class="${isBest ? "best" : ""}">${r.get(i)}</td>`;
      }).join("");
      return `<tr><td class="rowh">${r.label}</td>${cells}</tr>`;
    }).join("");
    return `<div class="cmp-wrap"><table class="cmp"><thead>${head}</thead><tbody>${body}</tbody></table></div>
      <p class="cmp-x" style="margin-top:12px">초록색은 항목 중 가장 우수한 값입니다 · 경쟁률·등급은 낮을수록 합격 가능성이 높습니다. 이름을 누르면 상세가 열립니다.</p>`;
  }

  function renderCompare() {
    const items = [...CART].map(cartItem).filter(Boolean);
    if (!items.length) {
      view.innerHTML = `<div class="empty">
        🛒 비교함이 비어 있습니다.<br><br>
        학과 카드 오른쪽 위의 <b style="color:var(--brand)">＋</b> 버튼을 눌러 담으면<br>여기서 나란히 비교할 수 있어요.<br><br>
        <a class="chip on" href="#/browse" style="padding:8px 16px">탐색하러 가기</a></div>`;
      return;
    }
    view.innerHTML = `
      <div class="hero" style="padding:24px 0 6px;text-align:left">
        <h1 style="font-size:24px">🛒 내 비교함</h1>
        <p>담아둔 학과 <b>${items.length}개</b>를 나란히 비교합니다.</p>
      </div>
      <div class="results-head">
        <div class="count"><b>${items.length}</b> 개 담음</div>
        <div class="toolbar">
          <a class="chip" href="#/browse">＋ 더 담으러 가기</a>
          <button class="chip" id="cmpCsv">⬇ CSV 내보내기</button>
          <button class="chip" id="cmpPrint">🖨 인쇄 / PDF</button>
          <button class="cart-clear" id="cmpClear" style="color:#c0392b">전체 비우기</button>
        </div>
      </div>
      <div id="cmpExport">${compareTableHtml(items)}</div>`;
    view.querySelectorAll("[data-rm]").forEach(btn => btn.onclick = () => { toggleCart(btn.dataset.rm); renderCompare(); });
    view.querySelectorAll("[data-open]").forEach(el => { el.style.cursor = "pointer";
      el.onclick = () => { const k = el.dataset.open; k[0] === "d" ? openDept(+k.slice(2)) : openCollege(k.slice(2)); }; });
    const cc = $("#cmpClear"); if (cc) cc.onclick = () => { CART.clear(); saveCart(); updateCartBar(); renderCompare(); };
    $("#cmpCsv").onclick = () => exportCompareCSV(items);
    $("#cmpPrint").onclick = () => window.print();
  }

  function exportCompareCSV(items) {
    const esc = v => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [];
    lines.push(["항목", ...items.map(i => `${i.title} (${i.college})`)].map(esc).join(","));
    COMPARE_ROWS.forEach(r => lines.push([r.label, ...items.map(i => r.get(i))].map(esc).join(",")));
    // BOM 추가 → 엑셀에서 한글 깨짐 방지
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `전문대_비교_${items.length}개.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- 유틸 ---------- */
  function kv(k, v) { return `<div><div class="k">${k}</div><div class="v">${v}</div></div>`; }
  function fmt(v, suffix = "") { return v == null ? "정보없음" : v + suffix; }
  function escAttr(s) { return String(s).replace(/"/g, "&quot;"); }

  init();
})();
