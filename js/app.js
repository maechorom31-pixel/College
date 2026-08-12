/* 전문대 진학 탐색 — 라우터 · 홈 · 탐색 · 비교함 */
(function (global) {
  "use strict";
  const S = global.Store, C = global.Charts;
  const { $, $$, esc, NA, pct, grade, comp, won, n1, catPath, deptGrade, deptComp } = S;
  const DATA = S.DATA, CART = S.CART;
  const view = () => $("#view");

  /* ================= 필터 상태 ================= */
  function newFilters() {
    return {
      regions: new Set(), sidos: new Set(), cat1: "", cat2: "", cat3: "",
      majors: new Set(), levels: new Set(), flags: new Set(),
      employMin: 0, tuitionMax: 0, compMax: 0, gradeMax: 0,
      keyword: "", deep: false,
    };
  }
  const F = newFilters();
  let entity = "dept";     // dept | college
  let viewMode = "cards";  // cards | table
  let sortKey = "employ";
  let limit = 60;
  let filtersOpen = !(global.matchMedia && global.matchMedia("(max-width:900px)").matches);

  const CAT_SLOT = {};     // 계열 -> 고정 색 슬롯 (순환 금지)
  const catColor = c => CAT_SLOT[c] || "#868e96";

  /* ================= 부트 ================= */
  async function init() {
    try {
      await S.boot();
    } catch (e) {
      view().innerHTML = `<div class="empty"><b>데이터를 불러오지 못했습니다.</b><br>
        로컬에서 열 때는 간단한 서버가 필요합니다.<br><code>python3 -m http.server 8000</code></div>`;
      return;
    }
    Object.keys(DATA.meta.cats).forEach((k, i) => CAT_SLOT[k] = C.slot(i));
    global.CatColor = catColor;

    $("#globalSearch").addEventListener("input", e => {
      F.keyword = e.target.value.trim();
      entity = "dept"; limit = 60;
      if (!location.hash.startsWith("#/browse")) location.hash = "#/browse";
      else { const fk = $("#fKeyword"); if (fk) fk.value = e.target.value; renderResults(); }
    });
    $("#navToggle").addEventListener("click", () => {
      const nav = $("#siteNav"), on = nav.classList.toggle("open");
      $("#navToggle").setAttribute("aria-expanded", String(on));
    });
    $("#cartOpen").addEventListener("click", () => location.hash = "#/compare");
    $("#cartClear").addEventListener("click", () => {
      CART.clear(); S.saveCart(); updateCartBar(); route();
    });
    updateCartBar();
    global.addEventListener("hashchange", () => { $("#siteNav").classList.remove("open"); route(); });
    route();
  }

  const ROUTES = {
    "browse": renderBrowse, "compare": renderCompare,
    "match": () => global.Tools.match(view()),
    "calendar": () => global.Tools.calendar(view()),
    "transfer": () => global.Tools.transfer(view()),
    "vs": () => global.Tools.vs(view()),
    "insight": () => global.Tools.insight(view()),
  };

  function route() {
    const h = (location.hash || "#/").slice(2);
    const seg = h.split("?")[0].split("/");
    const name = seg[0];
    $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === name));
    if (name === "college") { global.Detail.collegePage(view(), decodeURIComponent(seg.slice(1).join("/"))); }
    else if (ROUTES[name]) ROUTES[name]();
    else renderHome();
    global.scrollTo(0, 0);
  }

  /* ================= 홈 ================= */
  function renderHome() {
    const m = DATA.meta, t = m.totals;
    const sidoDepts = {};
    DATA.departments.forEach(d => { if (d.sido) sidoDepts[d.sido] = (sidoDepts[d.sido] || 0) + 1; });
    const regionOf = {};
    Object.entries(m.sidoStats).forEach(([k, v]) => regionOf[k] = v.region);
    const maxD = Math.max(...Object.values(sidoDepts));

    view().innerHTML = `
      <section class="hero">
        <h1>지도에서 찾는 나의 전문대</h1>
        <p>전국 전문대학 ${t.colleges}곳 · 학과 ${t.depts.toLocaleString()}개 · 전형 ${t.admissions.toLocaleString()}건을
           3개년 입결, 전형별 등급, 취업률, 연계편입까지 한 화면에서 비교하세요.</p>
        <div class="stat-row">
          <div class="stat"><b>${t.colleges}</b><span>전문대학</span></div>
          <div class="stat"><b>${t.depts.toLocaleString()}</b><span>학과(모집단위)</span></div>
          <div class="stat"><b>${t.admissions.toLocaleString()}</b><span>수시 전형</span></div>
          <div class="stat"><b>${t.univColleges}</b><span>비교용 일반대</span></div>
        </div>
      </section>

      <section class="tool-grid">
        <a class="tool" href="#/match"><i>🎯</i><b>내 등급으로 찾기</b>
          <span>내신 등급을 넣으면 최종등록자 평균·최저 등급과 비교해 안정/적정/도전으로 분류합니다.</span></a>
        <a class="tool" href="#/calendar"><i>📅</i><b>전형 일정</b>
          <span>원서접수·면접·실기·합격발표·등록까지 대학별 일정을 한 표로.</span></a>
        <a class="tool" href="#/transfer"><i>🎓</i><b>무시험 연계편입</b>
          <span>전문대 졸업 후 시험 없이 4년제로 가는 ${t.transfer.toLocaleString()}개 편입 경로.</span></a>
        <a class="tool" href="#/vs"><i>🆚</i><b>전문대 vs 일반대</b>
          <span>같은 등급대에서 중위권 일반대 ${t.univColleges}곳과 나란히 비교.</span></a>
        <a class="tool" href="#/insight"><i>📊</i><b>데이터 인사이트</b>
          <span>계열·전형별 등급 지형, 경쟁률이 내려가는 학과, 가성비 학과.</span></a>
        <a class="tool" href="#/browse"><i>🔎</i><b>조건 탐색</b>
          <span>지역·계열·취업률·등록금·등급 등 15가지 조건으로 좁혀보기.</span></a>
      </section>

      <div class="home-grid">
        <div class="map-panel">
          <h2>시·도별 학과 수</h2>
          <p class="hint">시·도를 클릭하면 그 지역 학과 목록으로 이동합니다.</p>
          <div id="mapHost"></div>
          ${global.mapLegend(maxD, "학과 수")}
        </div>
        <div class="region-cards" id="regionCards"></div>
      </div>

      <section class="panel">
        <h2>계열 한눈에 보기</h2>
        <p class="hint">계열별 평균 최종등록자 등급 · 평균 경쟁률 · 평균 취업률 (2026 수시1차 기준)</p>
        <div class="cat-grid">
          ${Object.entries(m.insights.byCat).map(([k, v]) => `
            <button class="cat-card" data-cat="${esc(k)}" style="--cc:${catColor(k)}">
              <b>${esc(k)}</b><em>${v.n.toLocaleString()}개 학과</em>
              <dl>
                <div><dt>평균 등급</dt><dd>${v.grade == null ? "–" : v.grade}</dd></div>
                <div><dt>경쟁률</dt><dd>${v.comp == null ? "–" : v.comp + ":1"}</dd></div>
                <div><dt>취업률</dt><dd>${v.employ == null ? "–" : v.employ + "%"}</dd></div>
              </dl>
            </button>`).join("")}
        </div>
      </section>`;

    const host = $("#mapHost");
    host.appendChild(global.buildKoreaMap(sidoDepts, sido => {
      Object.assign(F, newFilters());
      F.sidos.add(sido); entity = "dept"; limit = 60;
      location.hash = "#/browse";
    }, { label: "학과", regionOf }));

    $("#regionCards").innerHTML = m.regions.map(rg => {
      const st = m.regionStats[rg];
      return `<button class="region-card" data-region="${esc(rg)}">
        <b>${esc(rg)}</b>
        <span>대학 ${st.colleges} · 학과 ${st.depts.toLocaleString()}</span>
        <em>${st.sidos.join(" · ")}</em>
      </button>`;
    }).join("");
    $$("#regionCards .region-card").forEach(b => b.addEventListener("click", () => {
      Object.assign(F, newFilters());
      F.regions.add(b.dataset.region); entity = "dept"; limit = 60;
      location.hash = "#/browse";
    }));
    $$(".cat-card").forEach(b => b.addEventListener("click", () => {
      Object.assign(F, newFilters());
      F.cat1 = b.dataset.cat; entity = "dept"; limit = 60;
      location.hash = "#/browse";
    }));
  }

  /* ================= 탐색 ================= */
  function renderBrowse() {
    view().innerHTML = `
      <div class="browse">
        <button id="filtToggle" class="filt-toggle">조건 필터 <b id="filtCount"></b></button>
        <aside class="filters${filtersOpen ? "" : " collapsed"}" id="filters"></aside>
        <section class="results" id="results"></section>
      </div>`;
    $("#filtToggle").addEventListener("click", () => {
      filtersOpen = !filtersOpen;
      $("#filters").classList.toggle("collapsed", !filtersOpen);
    });
    renderFilters();
    renderResults();
  }

  function renderFilters() {
    const m = DATA.meta;
    const cat2s = F.cat1 ? Object.keys(m.cats[F.cat1] || {}) : [];
    const cat3s = F.cat1 && F.cat2 ? (m.cats[F.cat1][F.cat2] || []) : [];
    const sidos = [...new Set(
      (F.regions.size ? [...F.regions] : m.regions).flatMap(r => m.regionStats[r].sidos))];

    $("#filters").innerHTML = `
      <div class="f-head"><b>조건 필터</b><button id="fReset" class="link">초기화</button></div>

      <div class="f-block"><h4>검색</h4>
        <input type="search" id="fKeyword" class="f-search" value="${esc(F.keyword)}"
          placeholder="대학·학과명 (예: 간호, 동양미래대)"></div>

      <div class="f-block"><h4>권역</h4>${S.chipList(m.regions, [...F.regions], null, { cls: "f-region" })}</div>
      <div class="f-block"><h4>시·도</h4>${S.chipList(sidos, [...F.sidos], null, { cls: "f-sido" })}</div>

      <div class="f-block"><h4>계열</h4>
        ${S.chipList(Object.keys(m.cats), F.cat1, null, { cls: "f-cat1" })}
        ${cat2s.length ? `<div class="sub">${S.chipList(cat2s, F.cat2, null, { cls: "f-cat2" })}</div>` : ""}
        ${cat3s.length ? `<div class="sub">${S.chipList(cat3s, F.cat3, null, { cls: "f-cat3" })}</div>` : ""}
      </div>

      <div class="f-block"><h4>인기 학과</h4>
        ${S.chipList(m.majors, [...F.majors], null, { cls: "f-major" })}</div>

      <div class="f-block"><h4>학제</h4>
        ${S.chipList([{ value: "2", label: "2년제" }, { value: "3", label: "3년제" }, { value: "4", label: "4년제" }],
      [...F.levels], null, { cls: "f-level" })}</div>

      <div class="f-block"><h4>특성</h4>
        ${S.chipList([
        { value: "jeongsi", label: "정시 선발" },
        { value: "transfer", label: "연계편입 가능" },
        { value: "order", label: "채용약정 과정" },
        { value: "new", label: "신설·변경 학과" },
        { value: "free", label: "전형료 무료" },
        { value: "nurse", label: "간호학과 보유교" },
        { value: "teaching", label: "교직과정 보유교" },
      ], [...F.flags], null, { cls: "f-flag" })}</div>

      <div class="f-block"><h4>수치 조건</h4>
        <label class="range">취업률 <b>${F.employMin ? F.employMin + "% 이상" : "전체"}</b>
          <input type="range" id="rEmploy" min="0" max="95" step="5" value="${F.employMin}"></label>
        <label class="range">등록금 <b>${F.tuitionMax ? won(F.tuitionMax) + " 이하" : "전체"}</b>
          <input type="range" id="rTuition" min="0" max="9000" step="250" value="${F.tuitionMax}"></label>
        <label class="range">경쟁률 <b>${F.compMax ? F.compMax + ":1 이하" : "전체"}</b>
          <input type="range" id="rComp" min="0" max="30" step="1" value="${F.compMax}"></label>
        <label class="range">최종등록자 평균등급 <b>${F.gradeMax ? F.gradeMax + "등급까지" : "전체"}</b>
          <input type="range" id="rGrade" min="0" max="9" step="0.5" value="${F.gradeMax}"></label>
      </div>

      <div class="f-block"><h4>검색 범위</h4>
        <label class="check"><input type="checkbox" id="fDeep" ${F.deep ? "checked" : ""}>
          학과소개·취업분야·자격증까지 검색 <small>(추가 데이터를 내려받습니다)</small></label>
      </div>`;

    const pick = (sel, fn) => $$(`${sel} .chip`, $("#filters")).forEach(b =>
      b.addEventListener("click", () => { fn(b.dataset.pick); limit = 60; renderFilters(); renderResults(); }));
    const toggleSet = (set, v) => { set.has(v) ? set.delete(v) : set.add(v); };

    pick(".f-region", v => {
      toggleSet(F.regions, v);
      [...F.sidos].forEach(sd => { if (F.regions.size && !F.regions.has(DATA.meta.sidoStats[sd].region)) F.sidos.delete(sd); });
    });
    pick(".f-sido", v => toggleSet(F.sidos, v));
    pick(".f-cat1", v => { F.cat1 = F.cat1 === v ? "" : v; F.cat2 = F.cat3 = ""; });
    pick(".f-cat2", v => { F.cat2 = F.cat2 === v ? "" : v; F.cat3 = ""; });
    pick(".f-cat3", v => { F.cat3 = F.cat3 === v ? "" : v; });
    pick(".f-major", v => toggleSet(F.majors, v));
    pick(".f-level", v => toggleSet(F.levels, v));
    pick(".f-flag", v => toggleSet(F.flags, v));

    const rng = (id, key, fmt) => {
      const el = $("#" + id);
      el.addEventListener("input", () => {
        F[key] = +el.value;
        el.closest("label").querySelector("b").textContent = fmt(+el.value);
      });
      el.addEventListener("change", () => { limit = 60; renderResults(); updateFiltCount(); });
    };
    rng("rEmploy", "employMin", v => v ? v + "% 이상" : "전체");
    rng("rTuition", "tuitionMax", v => v ? won(v) + " 이하" : "전체");
    rng("rComp", "compMax", v => v ? v + ":1 이하" : "전체");
    rng("rGrade", "gradeMax", v => v ? v + "등급까지" : "전체");

    // 필터 안 검색창 — 모바일에서는 헤더 검색창이 숨겨지므로 이쪽이 유일한 진입점
    const fkw = $("#fKeyword");
    fkw.addEventListener("input", () => {
      F.keyword = fkw.value.trim();
      $("#globalSearch").value = fkw.value;
      limit = 60; renderResults();
    });

    $("#fDeep").addEventListener("change", async e => {
      F.deep = e.target.checked;
      if (F.deep) { e.target.disabled = true; await S.loadInfo(); e.target.disabled = false; }
      renderResults();
    });
    $("#fReset").addEventListener("click", () => {
      Object.assign(F, newFilters());
      $("#globalSearch").value = "";
      limit = 60; renderFilters(); renderResults();
    });
    updateFiltCount();
  }

  function activeCount() {
    return F.regions.size + F.sidos.size + F.majors.size + F.levels.size + F.flags.size
      + (F.cat1 ? 1 : 0) + (F.cat2 ? 1 : 0) + (F.cat3 ? 1 : 0)
      + (F.employMin ? 1 : 0) + (F.tuitionMax ? 1 : 0) + (F.compMax ? 1 : 0) + (F.gradeMax ? 1 : 0);
  }
  function updateFiltCount() {
    const el = $("#filtCount"); if (!el) return;
    const n = activeCount();
    el.textContent = n ? n : ""; el.classList.toggle("on", !!n);
  }

  /* ---------- 필터링 ---------- */
  function matchDept(d) {
    if (F.regions.size && !F.regions.has(d.region)) return false;
    if (F.sidos.size && !F.sidos.has(d.sido)) return false;
    if (F.cat1 && d.cat1 !== F.cat1) return false;
    if (F.cat2 && d.cat2 !== F.cat2) return false;
    if (F.cat3 && d.cat3 !== F.cat3) return false;
    if (F.levels.size && !F.levels.has(String(d.level))) return false;
    if (F.employMin && !(d.employ >= F.employMin)) return false;
    if (F.tuitionMax && !(d.tuition && d.tuition <= F.tuitionMax)) return false;
    if (F.compMax) { const c = deptComp(d); if (!(c != null && c <= F.compMax)) return false; }
    if (F.gradeMax) { const g = deptGrade(d); if (!(g != null && g <= F.gradeMax)) return false; }

    const c = DATA.byName[d.college];
    if (F.majors.size && !(c && [...F.majors].every(mj => (c.majorList || []).includes(mj)))) return false;
    for (const f of F.flags) {
      if (f === "jeongsi" && !d.jeongsi) return false;
      if (f === "transfer" && !d.transfer) return false;
      if (f === "order" && !d.order) return false;
      if (f === "new" && !d.change) return false;
      if (f === "free" && !(c && c.fee.free)) return false;
      if (f === "nurse" && !(c && c.nurse)) return false;
      if (f === "teaching" && !(c && c.teaching)) return false;
    }
    if (F.keyword) {
      const k = F.keyword.toLowerCase();
      let hay = `${d.unit} ${d.college} ${d.cat1} ${d.cat2} ${d.cat3} ${d.sido} ${d.location || ""}`;
      if (F.deep && DATA.info) {
        const inf = DATA.info[d.id];
        if (inf) hay += ` ${inf.intro || ""} ${inf.jobs || ""} ${inf.certs || ""}`;
      }
      if (!hay.toLowerCase().includes(k)) return false;
    }
    return true;
  }

  function matchCollege(c) {
    if (F.regions.size && !F.regions.has(c.region)) return false;
    if (F.sidos.size && !F.sidos.has(c.sido)) return false;
    if (F.majors.size && ![...F.majors].every(mj => (c.majorList || []).includes(mj))) return false;
    if (F.employMin && !(c.employRate["2024"] >= F.employMin)) return false;
    if (F.tuitionMax && !(c.tuition["평균"] && c.tuition["평균"] <= F.tuitionMax)) return false;
    for (const f of F.flags) {
      if (f === "free" && !c.fee.free) return false;
      if (f === "nurse" && !c.nurse) return false;
      if (f === "teaching" && !c.teaching) return false;
      if (f === "transfer" && !c.transfer.targets.length) return false;
      if (f === "order" && !c.orderCount) return false;
    }
    if (F.cat1 && !(c.cats || {})[F.cat1]) return false;
    if (F.keyword) {
      const k = F.keyword.toLowerCase();
      if (!`${c.name} ${c.sido} ${c.location || ""}`.toLowerCase().includes(k)) return false;
    }
    return true;
  }

  const SORTS = {
    employ: { label: "취업률 높은 순", fn: (a, b) => (b.employ ?? -1) - (a.employ ?? -1) },
    gradeAsc: { label: "등급 높은 순(우수)", fn: (a, b) => (deptGrade(a) ?? 99) - (deptGrade(b) ?? 99) },
    gradeDesc: { label: "등급 낮은 순(여유)", fn: (a, b) => (deptGrade(b) ?? -1) - (deptGrade(a) ?? -1) },
    compAsc: { label: "경쟁률 낮은 순", fn: (a, b) => (deptComp(a) ?? 999) - (deptComp(b) ?? 999) },
    compDesc: { label: "경쟁률 높은 순", fn: (a, b) => (deptComp(b) ?? -1) - (deptComp(a) ?? -1) },
    trend: { label: "경쟁률 하락 폭 순", fn: (a, b) => ((a.ipgyeol || {}).trend ?? 999) - ((b.ipgyeol || {}).trend ?? 999) },
    tuition: { label: "등록금 낮은 순", fn: (a, b) => (a.tuition ?? 1e9) - (b.tuition ?? 1e9) },
    quota: { label: "모집인원 많은 순", fn: (a, b) => ((b.ipgyeol || {}).quota ?? -1) - ((a.ipgyeol || {}).quota ?? -1) },
    name: { label: "가나다 순", fn: (a, b) => (a.college + a.unit).localeCompare(b.college + b.unit, "ko") },
  };
  const CSORTS = {
    employ: { label: "취업률 높은 순", fn: (a, b) => (b.employRate["2024"] ?? -1) - (a.employRate["2024"] ?? -1) },
    fill: { label: "충원율 높은 순", fn: (a, b) => (b.fillRate["2025"] ?? -1) - (a.fillRate["2025"] ?? -1) },
    tuition: { label: "등록금 낮은 순", fn: (a, b) => (a.tuition["평균"] ?? 1e9) - (b.tuition["평균"] ?? 1e9) },
    depts: { label: "학과 많은 순", fn: (a, b) => b.deptCount - a.deptCount },
    name: { label: "가나다 순", fn: (a, b) => a.name.localeCompare(b.name, "ko") },
  };

  function renderResults() {
    const box = $("#results"); if (!box) return;
    const isDept = entity === "dept";
    const sorts = isDept ? SORTS : CSORTS;
    if (!sorts[sortKey]) sortKey = "employ";
    const list = isDept
      ? DATA.departments.filter(matchDept).sort(sorts[sortKey].fn)
      : DATA.colleges.filter(matchCollege).sort(sorts[sortKey].fn);

    box.innerHTML = `
      <div class="res-head">
        <div class="entity-switch">
          <button data-ent="dept" class="${isDept ? "on" : ""}">학과</button>
          <button data-ent="college" class="${isDept ? "" : "on"}">대학</button>
        </div>
        <span class="res-count"><b>${list.length.toLocaleString()}</b>${isDept ? "개 학과" : "개 대학"}</span>
        <div class="res-tools">
          <select id="sortSel">${Object.entries(sorts).map(([k, v]) =>
      `<option value="${k}"${k === sortKey ? " selected" : ""}>${v.label}</option>`).join("")}</select>
          <div class="view-switch">
            <button data-vm="cards" class="${viewMode === "cards" ? "on" : ""}">카드</button>
            <button data-vm="table" class="${viewMode === "table" ? "on" : ""}">표</button>
          </div>
          <button id="exportCsv" class="ghost">CSV</button>
        </div>
      </div>
      ${activeChips()}
      <div id="resBody"></div>`;

    $$(".entity-switch button", box).forEach(b => b.addEventListener("click", () => {
      entity = b.dataset.ent; sortKey = "employ"; limit = 60; renderResults();
    }));
    $$(".view-switch button", box).forEach(b => b.addEventListener("click", () => {
      viewMode = b.dataset.vm; renderResults();
    }));
    $("#sortSel").addEventListener("change", e => { sortKey = e.target.value; limit = 60; renderResults(); });
    $("#exportCsv").addEventListener("click", () => exportCsv(list, isDept));
    $$(".active-chips .chip", box).forEach(b => b.addEventListener("click", () => {
      clearChip(b.dataset.kind, b.dataset.pick); renderFilters(); renderResults();
    }));

    const body = $("#resBody");
    if (!list.length) {
      // 자격증·취업분야는 기본 검색 대상이 아니므로, 키워드가 있으면 심화 검색을 권한다
      const suggestDeep = isDept && F.keyword && !F.deep;
      body.innerHTML = `<div class="empty">
        <b>조건에 맞는 결과가 없습니다.</b>
        ${suggestDeep ? `<p>“${esc(F.keyword)}”은(는) 학과명·대학명에 없습니다.
            <b>학과소개·취업분야·취득자격증</b>까지 찾아볼까요?</p>
          <button class="btn" id="goDeep">학과 내용까지 검색하기</button>`
          : `<p>조건을 조금 풀어보세요.</p>
             ${activeCount() ? `<button class="btn" id="clearAll">조건 초기화</button>` : ""}`}
      </div>`;
      const gd = $("#goDeep");
      if (gd) gd.addEventListener("click", async () => {
        gd.disabled = true; gd.textContent = "불러오는 중…";
        F.deep = true; await S.loadInfo();
        renderFilters(); renderResults();
      });
      const ca = $("#clearAll");
      if (ca) ca.addEventListener("click", () => {
        Object.assign(F, newFilters());
        $("#globalSearch").value = "";
        limit = 60; renderFilters(); renderResults();
      });
      return;
    }
    const page = list.slice(0, limit);
    body.innerHTML = (viewMode === "cards"
      ? `<div class="cards">${page.map(isDept ? deptCard : collegeCard).join("")}</div>`
      : (isDept ? deptTable(page) : collegeTable(page)))
      + (list.length > limit
        ? `<div class="more"><button id="moreBtn">더 보기 (${(list.length - limit).toLocaleString()}개 남음)</button></div>` : "");

    bindResultEvents(body);
    const mb = $("#moreBtn");
    if (mb) mb.addEventListener("click", () => { limit += 60; renderResults(); });
    updateFiltCount();
  }

  function activeChips() {
    const parts = [];
    F.regions.forEach(v => parts.push(["regions", v, v]));
    F.sidos.forEach(v => parts.push(["sidos", v, v]));
    if (F.cat1) parts.push(["cat1", F.cat1, F.cat1]);
    if (F.cat2) parts.push(["cat2", F.cat2, F.cat2]);
    if (F.cat3) parts.push(["cat3", F.cat3, F.cat3]);
    F.majors.forEach(v => parts.push(["majors", v, v]));
    F.levels.forEach(v => parts.push(["levels", v, v + "년제"]));
    F.flags.forEach(v => parts.push(["flags", v, {
      jeongsi: "정시 선발", transfer: "연계편입", order: "채용약정", new: "신설·변경",
      free: "전형료 무료", nurse: "간호학과", teaching: "교직과정"
    }[v] || v]));
    if (F.employMin) parts.push(["employMin", "", `취업률 ${F.employMin}%↑`]);
    if (F.tuitionMax) parts.push(["tuitionMax", "", `등록금 ${won(F.tuitionMax)}↓`]);
    if (F.compMax) parts.push(["compMax", "", `경쟁률 ${F.compMax}:1↓`]);
    if (F.gradeMax) parts.push(["gradeMax", "", `${F.gradeMax}등급까지`]);
    if (F.keyword) parts.push(["keyword", "", `"${F.keyword}"`]);
    if (!parts.length) return "";
    return `<div class="active-chips">${parts.map(([k, v, label]) =>
      `<button class="chip on" data-kind="${k}" data-pick="${esc(v)}">${esc(label)} ✕</button>`).join("")}</div>`;
  }
  function clearChip(kind, val) {
    if (F[kind] instanceof Set) F[kind].delete(val);
    else if (kind === "keyword") { F.keyword = ""; $("#globalSearch").value = ""; }
    else if (typeof F[kind] === "number") F[kind] = 0;
    else F[kind] = "";
    if (kind === "cat1") F.cat2 = F.cat3 = "";
    if (kind === "cat2") F.cat3 = "";
    limit = 60;
  }

  /* ---------- 카드 / 표 ---------- */
  function trendBadge(t) {
    if (t == null) return "";
    const down = t < 0;
    return `<span class="tbadge ${down ? "down" : "up"}" title="2024년 대비 2026년 경쟁률 변화">
      ${down ? "▼" : "▲"} ${Math.abs(Math.round(t))}%</span>`;
  }

  function deptCard(d) {
    const ip = d.ipgyeol || {};
    const inCart = CART.has("d:" + d.id);
    const tags = [];
    if (d.change) tags.push(`<span class="tag new">${esc(d.change)}</span>`);
    if (d.transfer) tags.push(`<span class="tag">🎓 편입 ${d.transfer}</span>`);
    if (d.order) tags.push(`<span class="tag">🏢 채용약정</span>`);
    if (d.jeongsi) tags.push(`<span class="tag">정시</span>`);
    return `<article class="card" data-did="${d.id}">
      <div class="card-top">
        <span class="cat-dot" style="background:${catColor(d.cat1)}" title="${esc(d.cat1)}"></span>
        <h3>${esc(d.unit)}</h3>
        <button class="cart-toggle${inCart ? " on" : ""}" data-cart="d:${d.id}"
          aria-label="비교함 담기">${inCart ? "✓" : "＋"}</button>
      </div>
      <p class="card-sub">${esc(d.college)} · ${esc(d.location || d.sido)} · ${d.level ? d.level + "년제" : ""}</p>
      <p class="card-cat">${esc(catPath(d))}</p>
      <dl class="card-metrics">
        <div><dt>최종등록 평균</dt><dd>${ip.avg && ip.avg[0] != null ? ip.avg[0] + "등급" : "–"}</dd></div>
        <div><dt>경쟁률</dt><dd>${ip.comp && ip.comp[0] != null ? ip.comp[0] + ":1" : "–"} ${trendBadge(ip.trend)}</dd></div>
        <div><dt>취업률</dt><dd>${d.employ != null ? d.employ + "%" : "–"}</dd></div>
        <div><dt>등록금</dt><dd>${d.tuition ? won(d.tuition) : "–"}</dd></div>
      </dl>
      ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
      ${ip.track ? `<p class="card-note">대표 전형: ${esc(ip.phase || "")} ${esc(ip.track)}${ip.nTrack > 1 ? ` 외 ${ip.nTrack - 1}개` : ""}${ip.quota ? ` · 모집 ${ip.quota}명` : ""}</p>` : ""}
    </article>`;
  }

  function collegeCard(c) {
    return `<article class="card college" data-college="${esc(c.name)}">
      <div class="card-top"><h3>${esc(c.name)}</h3></div>
      <p class="card-sub">${esc(c.location || c.sido)} · ${esc(c.region)} · 학과 ${c.deptCount}개</p>
      <dl class="card-metrics">
        <div><dt>취업률 24</dt><dd>${pct(c.employRate["2024"])}</dd></div>
        <div><dt>충원율 25</dt><dd>${pct(c.fillRate["2025"])}</dd></div>
        <div><dt>평균 등록금</dt><dd>${won(c.tuition["평균"])}</dd></div>
        <div><dt>전형료</dt><dd>${c.fee.free ? "무료 전형 있음" : S.feeWon(c.fee.min)}</dd></div>
      </dl>
      <div class="cat-bar">${C.stack(Object.entries(c.cats || {}).map(([k, v]) =>
      ({ label: k, value: v, color: catColor(k) })), { height: 10 })}</div>
      <div class="tags">
        ${c.nurse ? '<span class="tag">간호</span>' : ""}
        ${c.teaching ? '<span class="tag">교직</span>' : ""}
        ${c.transfer.targets.length ? `<span class="tag">🎓 편입 ${c.transfer.targets.length}곳</span>` : ""}
        ${c.orderCount ? `<span class="tag">🏢 채용약정 ${c.orderCount}</span>` : ""}
        ${c.suneungMin ? '<span class="tag">수능최저</span>' : ""}
      </div>
    </article>`;
  }

  function deptTable(list) {
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>학과</th><th>대학</th><th>지역</th><th>계열</th>
        <th>평균등급</th><th>최저등급</th><th>경쟁률</th><th>3년 추이</th>
        <th>모집</th><th>취업률</th><th>등록금</th><th></th></tr></thead>
      <tbody>${list.map(d => {
      const ip = d.ipgyeol || {};
      return `<tr data-did="${d.id}">
        <td class="tl"><b>${esc(d.unit)}</b>${d.change ? ` <span class="tag new">${esc(d.change)}</span>` : ""}</td>
        <td class="tl">${esc(d.college)}</td>
        <td>${esc(d.sido)}</td>
        <td class="tl"><span class="cat-dot sm" style="background:${catColor(d.cat1)}"></span>${esc(d.cat2 || d.cat1)}</td>
        <td>${ip.avg && ip.avg[0] != null ? ip.avg[0] : "–"}</td>
        <td>${ip.min && ip.min[0] != null ? ip.min[0] : "–"}</td>
        <td>${ip.comp && ip.comp[0] != null ? ip.comp[0] : "–"}</td>
        <td>${ip.trend != null ? trendBadge(ip.trend) : "–"}</td>
        <td>${ip.quota ?? "–"}</td>
        <td>${d.employ ?? "–"}</td>
        <td>${d.tuition ? Math.round(d.tuition / 10).toLocaleString() : "–"}</td>
        <td><button class="cart-toggle sm${CART.has("d:" + d.id) ? " on" : ""}" data-cart="d:${d.id}">${CART.has("d:" + d.id) ? "✓" : "＋"}</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function collegeTable(list) {
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>대학</th><th>소재지</th><th>권역</th><th>학과</th>
        <th>취업률 24</th><th>충원율 25</th><th>평균 등록금</th><th>전형료</th><th>편입</th></tr></thead>
      <tbody>${list.map(c => `<tr data-college="${esc(c.name)}">
        <td class="tl"><b>${esc(c.name)}</b></td>
        <td class="tl">${esc(c.location || "–")}</td>
        <td>${esc(c.region)}</td>
        <td>${c.deptCount}</td>
        <td>${c.employRate["2024"] ?? "–"}</td>
        <td>${c.fillRate["2025"] ?? "–"}</td>
        <td>${c.tuition["평균"] ? Math.round(c.tuition["평균"] / 10).toLocaleString() : "–"}</td>
        <td>${c.fee.free ? "무료 있음" : (c.fee.min ? Math.round(c.fee.min / 1000) + "천" : "–")}</td>
        <td>${c.transfer.targets.length || "–"}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function bindResultEvents(root) {
    $$("[data-cart]", root).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const k = b.dataset.cart;
      CART.has(k) ? CART.delete(k) : CART.add(k);
      S.saveCart(); updateCartBar();
      b.classList.toggle("on", CART.has(k));
      b.textContent = CART.has(k) ? "✓" : "＋";
    }));
    $$("[data-did]", root).forEach(el => el.addEventListener("click", () =>
      global.Detail.dept(+el.dataset.did)));
    $$("[data-college]", root).forEach(el => el.addEventListener("click", () =>
      location.hash = "#/college/" + encodeURIComponent(el.dataset.college)));
  }

  function exportCsv(list, isDept) {
    const rows = isDept
      ? [["학과", "대학", "권역", "시도", "소재지", "계열대", "계열중", "계열소", "학제",
        "대표전형", "모집인원", "경쟁률26", "경쟁률25", "경쟁률24", "평균등급26", "최저등급26",
        "취업률", "충원율", "등록금(천원)", "연계편입", "채용약정", "정시"],
      ...list.map(d => {
        const ip = d.ipgyeol || {};
        return [d.unit, d.college, d.region, d.sido, d.location, d.cat1, d.cat2, d.cat3, d.level,
          ip.track, ip.quota, ip.comp && ip.comp[0], ip.comp && ip.comp[1], ip.comp && ip.comp[2],
          ip.avg && ip.avg[0], ip.min && ip.min[0], d.employ, d.fill, d.tuition,
          d.transfer, d.order, d.jeongsi ? "O" : ""];
      })]
      : [["대학", "권역", "시도", "소재지", "학과수", "취업률24", "취업률23", "충원율25", "충원율24",
        "등록금평균(천원)", "전형료최소", "전형료무료", "간호", "교직", "연계편입대학수", "채용약정"],
      ...list.map(c => [c.name, c.region, c.sido, c.location, c.deptCount,
        c.employRate["2024"], c.employRate["2023"], c.fillRate["2025"], c.fillRate["2024"],
        c.tuition["평균"], c.fee.min, c.fee.free ? "O" : "", c.nurse ? "O" : "", c.teaching ? "O" : "",
        c.transfer.targets.length, c.orderCount])];
    S.download(isDept ? "전문대_학과.csv" : "전문대_대학.csv", S.csv(rows));
  }

  /* ================= 비교함 ================= */
  function updateCartBar() {
    const bar = $("#cartBar"), nav = $("#navCount");
    if (nav) { nav.textContent = CART.size; nav.classList.toggle("zero", CART.size === 0); }
    if (!bar) return;
    $("#cartCount").textContent = CART.size;
    bar.classList.toggle("hidden", CART.size === 0);
  }

  function renderCompare() {
    const items = [...CART].map(k => DATA.byId[+k.slice(2)]).filter(Boolean);
    if (!items.length) {
      view().innerHTML = `<section class="panel"><h2>⚖️ 비교함</h2>
        <div class="empty">담은 학과가 없습니다. 탐색에서 <b>＋</b> 버튼으로 학과를 담아보세요.
        <br><br><a class="btn" href="#/browse">학과 탐색하기</a></div></section>`;
      return;
    }
    const ROWS = [
      ["대학", d => esc(d.college)],
      ["소재지", d => esc(d.location || d.sido)],
      ["계열", d => esc(catPath(d))],
      ["학제", d => d.level ? d.level + "년제" : NA],
      ["대표 전형", d => esc([(d.ipgyeol || {}).phase, (d.ipgyeol || {}).track].filter(Boolean).join(" ")) || NA],
      ["모집인원", d => (d.ipgyeol || {}).quota ?? NA],
      ["경쟁률 2026", d => comp(((d.ipgyeol || {}).comp || [])[0]), "lo"],
      ["경쟁률 3년 추이", d => {
        const cp = (d.ipgyeol || {}).comp || [];
        return C.trend([{ label: "24", value: cp[2] }, { label: "25", value: cp[1] }, { label: "26", value: cp[0] }],
          { height: 44, fmt: v => v.toFixed(1) });
      }],
      // 등급은 숫자가 클수록 낮은 성적으로도 합격 = 지원자 부담이 적음
      ["최종등록 평균등급", d => grade(((d.ipgyeol || {}).avg || [])[0]), "hi"],
      ["최종등록 최저등급", d => grade(((d.ipgyeol || {}).min || [])[0]), "hi"],
      ["등급 분포", d => {
        const ip = d.ipgyeol || {};
        return C.gradeBand((ip.avg || [])[0], (ip.min || [])[0], null);
      }],
      ["취업률", d => pct(d.employ), "hi"],
      ["충원율", d => pct(d.fill), "hi"],
      ["등록금(연간)", d => won(d.tuition), "lo"],
      ["연계편입 경로", d => d.transfer ? `${d.transfer}건` : "–"],
      ["채용약정 과정", d => d.order ? `${d.order}건` : "–"],
      ["정시 선발", d => d.jeongsi ? "있음" : "–"],
    ];
    // 최고/최저 강조 대상 계산
    const best = {};
    ROWS.forEach(([label, fn, dir]) => {
      if (!dir) return;
      const vals = items.map(d => {
        const ip = d.ipgyeol || {};
        if (label.startsWith("경쟁률")) return (ip.comp || [])[0];
        if (label.includes("평균등급")) return (ip.avg || [])[0];
        if (label.includes("최저등급")) return (ip.min || [])[0];
        if (label === "취업률") return d.employ;
        if (label === "충원율") return d.fill;
        if (label.startsWith("등록금")) return d.tuition;
        return null;
      });
      const nums = vals.filter(v => v != null);
      if (nums.length < 2) return;
      const target = dir === "hi" ? Math.max(...nums) : Math.min(...nums);
      best[label] = vals.map(v => v != null && v === target);
    });

    view().innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>⚖️ 학과 비교 <small>${items.length}개</small></h2>
          <div class="panel-tools">
            <button id="cmpCsv" class="ghost">CSV 내보내기</button>
            <button id="cmpPrint" class="ghost">인쇄 · PDF</button>
            <button id="cmpClear" class="ghost">비우기</button>
          </div>
        </div>
        <div class="tbl-wrap cmp">
          <table class="tbl compare">
            <thead><tr><th class="rowhead"></th>${items.map(d =>
      `<th><b>${esc(d.unit)}</b><small>${esc(d.college)}</small>
         <button class="cart-toggle on sm" data-cart="d:${d.id}">✓</button></th>`).join("")}</tr></thead>
          <tbody>${ROWS.map(([label, fn]) => `<tr>
            <th class="rowhead">${esc(label)}</th>
            ${items.map((d, i) => `<td${best[label] && best[label][i] ? ' class="best"' : ""}>${fn(d)}</td>`).join("")}
          </tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="hint">초록 배경은 담은 학과 중 <b>지원자에게 유리한 값</b>입니다 —
          경쟁률·등록금은 낮을수록, 취업률·충원율은 높을수록, 등급은 숫자가 클수록(= 낮은 성적으로도 합격) 유리하게 표시했습니다.</p>
      </section>`;

    $("#cmpClear").addEventListener("click", () => { CART.clear(); S.saveCart(); updateCartBar(); renderCompare(); });
    $("#cmpPrint").addEventListener("click", () => global.print());
    $("#cmpCsv").addEventListener("click", () => {
      const head = ["항목", ...items.map(d => `${d.college} ${d.unit}`)];
      const plain = [
        ["대학", d => d.college], ["소재지", d => d.location || d.sido], ["계열", catPath],
        ["학제", d => d.level], ["모집인원", d => (d.ipgyeol || {}).quota],
        ["경쟁률2026", d => ((d.ipgyeol || {}).comp || [])[0]],
        ["경쟁률2025", d => ((d.ipgyeol || {}).comp || [])[1]],
        ["경쟁률2024", d => ((d.ipgyeol || {}).comp || [])[2]],
        ["평균등급", d => ((d.ipgyeol || {}).avg || [])[0]],
        ["최저등급", d => ((d.ipgyeol || {}).min || [])[0]],
        ["취업률", d => d.employ], ["충원율", d => d.fill], ["등록금(천원)", d => d.tuition],
        ["연계편입", d => d.transfer], ["채용약정", d => d.order],
      ];
      S.download("학과비교.csv", S.csv([head, ...plain.map(([l, f]) => [l, ...items.map(f)])]));
    });
    $$("[data-cart]", view()).forEach(b => b.addEventListener("click", () => {
      CART.delete(b.dataset.cart); S.saveCart(); updateCartBar(); renderCompare();
    }));
  }

  /* 다른 모듈에서 필터를 세팅해 탐색으로 보낼 때 사용 */
  function gotoBrowse(setup) {
    Object.assign(F, newFilters());
    if (setup) setup(F);
    entity = "dept"; limit = 60;
    const already = (location.hash || "").startsWith("#/browse");
    location.hash = "#/browse";
    if (already) route();          // 해시가 그대로면 hashchange 가 안 뜨므로 직접 렌더
  }

  global.App = { gotoBrowse, updateCartBar, catColor, renderResults };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
