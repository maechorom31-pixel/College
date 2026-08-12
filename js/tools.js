/* 인사이트 도구: 내 등급으로 찾기 · 전형 일정 · 연계편입 · 전문대vs일반대 · 데이터 인사이트 */
(function (global) {
  "use strict";
  const S = global.Store, C = global.Charts;
  const { $, $$, esc, NA, pct, won, catPath } = S;
  const DATA = S.DATA;
  const VM = S.VERDICT_META;
  const ORDER = ["안정", "적정", "도전", "어려움"];
  const VCOLOR = { "안정": C.STATUS.good, "적정": C.slot(0), "도전": C.STATUS.serious, "어려움": "#adb5bd" };
  const VICON = { "안정": "◎", "적정": "○", "도전": "△", "어려움": "×" };

  const state = {
    match: { my: 4.0, track: "일반고", cat1: "", regions: new Set(), employMin: 0, verdicts: new Set(["안정", "적정", "도전"]), limit: 60 },
    cal: { phase: "수시1차", regions: new Set(), kw: "" },
    tr: { target: "", kw: "" },
    vs: { my: 3.5, cat1: "간호보건", regions: new Set(), limit: 40 },
  };

  /* ============================================================ 내 등급으로 찾기 */
  function match(host) {
    const m = DATA.meta;
    const st = state.match;

    host.innerHTML = `
      <section class="panel">
        <h1>🎯 내 등급으로 찾기</h1>
        <p class="lead">내신 평균 등급을 넣으면 <b>2026학년도 최종등록자 평균·최저 등급</b>과 비교해
          안정 / 적정 / 도전으로 분류합니다. 실제 합격자 성적이 기준이라 감이 아니라 데이터로 좁힐 수 있습니다.</p>

        <div class="mform">
          <label class="mfield wide">내신 평균 등급 <b id="myOut">${st.my.toFixed(1)}</b>
            <input type="range" id="myGrade" min="1" max="9" step="0.1" value="${st.my}"></label>
          <div class="mfield"><span>전형 유형</span>
            ${S.chipList(m.tracks, st.track, null, { cls: "m-track" })}</div>
          <div class="mfield"><span>계열</span>
            ${S.chipList([{ value: "", label: "전체" }, ...Object.keys(m.cats)], st.cat1, null, { cls: "m-cat" })}</div>
          <div class="mfield"><span>권역</span>
            ${S.chipList(m.regions, [...st.regions], null, { cls: "m-region" })}</div>
          <label class="mfield">취업률 <b id="mEmpOut">${st.employMin ? st.employMin + "% 이상" : "전체"}</b>
            <input type="range" id="mEmploy" min="0" max="95" step="5" value="${st.employMin}"></label>
        </div>
        <p class="hint">전형 유형이란? <b>일반</b>=전형 제한 없음 · <b>일반고</b>=일반계 고교 출신 · <b>특성화고</b>=특성화·마이스터고 출신 ·
          <b>대학자체기준</b>=대학이 정한 별도 기준. 같은 학과라도 전형에 따라 합격 등급이 크게 다릅니다.</p>
        <div id="matchOut"></div>
      </section>`;

    const rerun = () => renderMatch();
    $("#myGrade").addEventListener("input", e => {
      st.my = +e.target.value; $("#myOut").textContent = st.my.toFixed(1);
    });
    $("#myGrade").addEventListener("change", () => { st.limit = 60; rerun(); });
    $("#mEmploy").addEventListener("input", e => {
      st.employMin = +e.target.value;
      $("#mEmpOut").textContent = st.employMin ? st.employMin + "% 이상" : "전체";
    });
    $("#mEmploy").addEventListener("change", () => { st.limit = 60; rerun(); });
    $$(".m-track .chip").forEach(b => b.addEventListener("click", () => { st.track = b.dataset.pick; st.limit = 60; match(host); }));
    $$(".m-cat .chip").forEach(b => b.addEventListener("click", () => { st.cat1 = b.dataset.pick; st.limit = 60; match(host); }));
    $$(".m-region .chip").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.pick; st.regions.has(v) ? st.regions.delete(v) : st.regions.add(v);
      st.limit = 60; match(host);
    }));
    renderMatch();
  }

  function matchRows() {
    const st = state.match;
    const out = [];
    DATA.departments.forEach(d => {
      if (st.cat1 && d.cat1 !== st.cat1) return;
      if (st.regions.size && !st.regions.has(d.region)) return;
      if (st.employMin && !(d.employ >= st.employMin)) return;
      const t = (d.tracks || {})[st.track];
      if (!t || (t.avg == null && t.min == null)) return;
      const v = S.verdict(st.my, t.avg, t.min);
      if (!v) return;
      out.push({ d, t, v });
    });
    return out;
  }

  function renderMatch() {
    const st = state.match;
    const rows = matchRows();
    const counts = {};
    ORDER.forEach(v => counts[v] = rows.filter(r => r.v === v).length);
    const shown = rows.filter(r => st.verdicts.has(r.v))
      .sort((a, b) => ORDER.indexOf(a.v) - ORDER.indexOf(b.v)
        || (b.d.employ ?? -1) - (a.d.employ ?? -1));

    $("#matchOut").innerHTML = `
      <div class="verdict-row">
        ${ORDER.map(v => `<button class="verdict ${st.verdicts.has(v) ? "on" : ""}" data-v="${v}" style="--vc:${VCOLOR[v]}">
          <i>${VICON[v]}</i><b>${counts[v].toLocaleString()}</b><span>${v}</span>
          <em>${esc(VM[v].desc)}</em></button>`).join("")}
      </div>
      <div class="res-head simple">
        <span class="res-count"><b>${shown.length.toLocaleString()}</b>개 학과</span>
        <button id="mCsv" class="ghost">CSV 내보내기</button>
      </div>
      ${shown.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>판정</th><th>학과</th><th>대학</th><th>지역</th><th>계열</th>
          <th>평균등급</th><th>최저등급</th><th>내 등급과 차이</th><th>경쟁률</th><th>모집</th><th>취업률</th><th></th></tr></thead>
        <tbody>${shown.slice(0, st.limit).map(({ d, t, v }) => {
      const diff = t.avg != null ? +(st.my - t.avg).toFixed(2) : null;
      return `<tr data-did="${d.id}">
          <td><span class="vpill" style="--vc:${VCOLOR[v]}">${VICON[v]} ${v}</span></td>
          <td class="tl"><b>${esc(d.unit)}</b></td>
          <td class="tl">${esc(d.college)}</td>
          <td>${esc(d.sido)}</td>
          <td class="tl"><span class="cat-dot sm" style="background:${global.App.catColor(d.cat1)}"></span>${esc(d.cat2 || d.cat1)}</td>
          <td>${t.avg ?? "–"}</td><td>${t.min ?? "–"}</td>
          <td class="${diff != null && diff <= 0 ? "pos" : "neg"}">${diff == null ? "–" : (diff > 0 ? "+" : "") + diff}</td>
          <td>${t.comp != null ? t.comp.toFixed(1) : "–"}</td><td>${t.quota ?? "–"}</td><td>${d.employ ?? "–"}</td>
          <td><button class="cart-toggle sm${S.CART.has("d:" + d.id) ? " on" : ""}" data-cart="d:${d.id}">${S.CART.has("d:" + d.id) ? "✓" : "＋"}</button></td>
        </tr>`;
    }).join("")}</tbody></table></div>
        ${shown.length > st.limit ? `<div class="more"><button id="mMore">더 보기 (${(shown.length - st.limit).toLocaleString()}개 남음)</button></div>` : ""}`
        : `<div class="empty">해당 조건에 맞는 학과가 없습니다. 등급을 조정하거나 조건을 풀어보세요.</div>`}
      <p class="hint">판정 기준 — <b>안정</b>: 내 등급 ≤ 최종등록자 평균 · <b>적정</b>: 평균 ~ 최저 합격선 사이 ·
        <b>도전</b>: 최저 합격선보다 1등급 이내 · <b>어려움</b>: 그 밖. 2026학년도 수시1차 실적 기준이며 해마다 변동이 있습니다.</p>`;

    $$(".verdict").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.v;
      st.verdicts.has(v) ? st.verdicts.delete(v) : st.verdicts.add(v);
      if (!st.verdicts.size) ORDER.forEach(x => st.verdicts.add(x));
      renderMatch();
    }));
    bindRows($("#matchOut"));
    const more = $("#mMore");
    if (more) more.addEventListener("click", () => { st.limit += 60; renderMatch(); });
    $("#mCsv").addEventListener("click", () => S.download("내등급_매칭.csv", S.csv([
      ["판정", "학과", "대학", "권역", "시도", "계열", "전형", "평균등급", "최저등급", "경쟁률", "모집", "취업률", "등록금(천원)"],
      ...shown.map(({ d, t, v }) => [v, d.unit, d.college, d.region, d.sido, catPath(d),
        st.track, t.avg, t.min, t.comp, t.quota, d.employ, d.tuition])
    ])));
  }

  /* ============================================================ 전형 일정 */
  function calendar(host) {
    const m = DATA.meta, st = state.cal;
    const PHASES = ["수시1차", "수시2차", "정시모집"];
    host.innerHTML = `
      <section class="panel">
        <h1>📅 전형 일정</h1>
        <p class="lead">원서접수부터 면접·실기·합격자 발표·등록·충원까지, 대학별 일정을 모집시기별로 한 표에 모았습니다.
          면접·실기 날짜가 겹치면 복수 지원을 해도 응시가 불가능하니 <b>날짜 충돌</b>을 먼저 확인하세요.</p>
        <div class="mform">
          <div class="mfield"><span>모집시기</span>${S.chipList(PHASES, st.phase, null, { cls: "c-phase" })}</div>
          <div class="mfield"><span>권역</span>${S.chipList(m.regions, [...st.regions], null, { cls: "c-region" })}</div>
          <label class="mfield wide"><span>대학 검색</span>
            <input type="search" id="calKw" value="${esc(st.kw)}" placeholder="대학명"></label>
        </div>
        <div id="calOut"></div>
      </section>`;
    $$(".c-phase .chip").forEach(b => b.addEventListener("click", () => { st.phase = b.dataset.pick; calendar(host); }));
    $$(".c-region .chip").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.pick; st.regions.has(v) ? st.regions.delete(v) : st.regions.add(v); calendar(host);
    }));
    $("#calKw").addEventListener("input", e => { st.kw = e.target.value.trim(); renderCal(); });
    renderCal();
  }

  function renderCal() {
    const st = state.cal;
    const list = DATA.colleges.filter(c => {
      if (!c.schedule[st.phase]) return false;
      if (st.regions.size && !st.regions.has(c.region)) return false;
      if (st.kw && !c.name.includes(st.kw)) return false;
      return true;
    }).sort((a, b) => {
      const x = c => (c.schedule[st.phase].result || "9999");
      return x(a).localeCompare(x(b)) || a.name.localeCompare(b.name, "ko");
    });

    // 면접/실기 실시 대학 수 요약
    const withI = list.filter(c => c.schedule[st.phase].interview).length;
    const withP = list.filter(c => c.schedule[st.phase].practical).length;

    $("#calOut").innerHTML = `
      <div class="mini-stats">
        <div><b>${list.length}</b><span>대학</span></div>
        <div><b>${withI}</b><span>면접 실시</span></div>
        <div><b>${withP}</b><span>실기 실시</span></div>
      </div>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>대학</th><th>지역</th><th>원서접수</th><th>면접</th><th>실기</th>
          <th>합격자 발표</th><th>등록</th><th>충원 발표·등록</th></tr></thead>
        <tbody>${list.map(c => {
      const x = c.schedule[st.phase];
      return `<tr data-college="${esc(c.name)}">
        <td class="tl"><b>${esc(c.name)}</b></td><td>${esc(c.sido)}</td>
        <td class="nowrap">${esc(S.dt(x.apply))}</td>
        <td class="nowrap${x.interview ? " hit" : ""}">${esc(S.dt(x.interview))}</td>
        <td class="nowrap${x.practical ? " hit" : ""}">${esc(S.dt(x.practical))}</td>
        <td class="nowrap">${esc(S.dt(x.result))}</td>
        <td class="nowrap">${esc(S.dt(x.enroll))}</td>
        <td class="nowrap">${esc(S.dt(x.extra))}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<div class="empty">일정 정보가 없습니다.</div>`}
      <div class="res-head simple"><button id="calCsv" class="ghost">CSV 내보내기</button></div>`;

    bindRows($("#calOut"));
    $("#calCsv").addEventListener("click", () => S.download(`전형일정_${st.phase}.csv`, S.csv([
      ["대학", "권역", "지역", "원서접수", "면접", "실기", "합격자발표", "등록", "충원"],
      ...list.map(c => { const x = c.schedule[st.phase];
        return [c.name, c.region, c.sido, x.apply, x.interview, x.practical, x.result, x.enroll, x.extra]; })
    ])));
  }

  /* ============================================================ 연계편입 */
  async function transfer(host) {
    const m = DATA.meta, st = state.tr;
    host.innerHTML = `
      <section class="panel">
        <h1>🎓 무시험 연계편입</h1>
        <p class="lead">전문대를 졸업하면 영어·수학 시험 없이 <b>서류(또는 서류+면접)</b>만으로 4년제 대학 3학년에 편입할 수 있는 협약 제도입니다.
          전국 전문대 중 <b>${DATA.colleges.filter(c => c.transfer.targets.length).length}곳</b>이 협약을 맺었고,
          학과 단위 편입 경로는 <b>${m.totals.transfer.toLocaleString()}건</b>입니다.</p>
        <div class="mform">
          <div class="mfield wide"><span>편입 대상 4년제</span>
            ${S.chipList([{ value: "", label: "전체" }, ...m.transferTargets], st.target, null, { cls: "t-target" })}</div>
          <label class="mfield"><span>대학·학과 검색</span>
            <input type="search" id="trKw" value="${esc(st.kw)}" placeholder="예: 간호, 동양미래대"></label>
        </div>
        <div id="trOut"><div class="loading sm">불러오는 중…</div></div>
      </section>`;
    $$(".t-target .chip").forEach(b => b.addEventListener("click", () => { st.target = b.dataset.pick; transfer(host); }));
    $("#trKw").addEventListener("input", e => { st.kw = e.target.value.trim(); renderTransfer(); });
    await S.loadExtras();
    renderTransfer();
  }

  function renderTransfer() {
    const st = state.tr, m = DATA.meta;
    const cols = m.transferTargets;
    const colleges = DATA.colleges.filter(c => {
      if (!c.transfer.targets.length) return false;
      if (st.target && !c.transfer.targets.includes(st.target)) return false;
      if (st.kw && !c.name.includes(st.kw)) return false;
      return true;
    });
    const detail = (DATA.extras.transfer || []).filter(t => {
      if (st.kw && !(t.college.includes(st.kw) || (t.unit || "").includes(st.kw) || (t.targets || "").includes(st.kw))) return false;
      if (st.target && !(t.targets || "").includes(st.target.split("(")[0])) return false;
      return true;
    });
    // 대상 대학별 협약 전문대 수
    const byTarget = cols.map(t => ({
      label: t, value: DATA.colleges.filter(c => c.transfer.targets.includes(t)).length, color: C.slot(0)
    })).sort((a, b) => b.value - a.value);

    $("#trOut").innerHTML = `
      <figure class="wide-fig">
        <figcaption>편입 대상 4년제별 협약 전문대 수</figcaption>
        ${C.hbars(byTarget, { padL: 34, rowH: 8, fmt: v => v + "곳" })}
      </figure>

      <h2>대학별 협약 현황 <small>${colleges.length}곳</small></h2>
      <div class="tbl-wrap"><table class="tbl matrix">
        <thead><tr><th class="tl">전문대</th><th>지역</th>${cols.map(t =>
      `<th class="vert"><span>${esc(t)}</span></th>`).join("")}<th>학과 경로</th></tr></thead>
        <tbody>${colleges.map(c => `<tr data-college="${esc(c.name)}">
          <td class="tl"><b>${esc(c.name)}</b></td><td>${esc(c.sido)}</td>
          ${cols.map(t => `<td class="${c.transfer.targets.includes(t) ? "yes" : ""}">${c.transfer.targets.includes(t) ? "●" : ""}</td>`).join("")}
          <td>${c.transfer.count || "–"}</td></tr>`).join("")}</tbody></table></div>

      <h2>학과별 편입 경로 <small>${detail.length.toLocaleString()}건</small></h2>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>전문대</th><th>학과</th><th>편입 가능 대학(학과)</th><th>전형방법</th></tr></thead>
        <tbody>${detail.slice(0, 200).map(t => `<tr${t.did ? ` data-did="${t.did}"` : ""}>
          <td class="tl nowrap">${esc(t.college)}</td><td class="tl">${esc(t.unit || "–")}</td>
          <td class="tl small">${esc(t.targets)}</td><td class="tl small">${esc(t.method || "–")}</td></tr>`).join("")}</tbody></table></div>
      ${detail.length > 200 ? `<p class="hint">상위 200건만 표시했습니다. 검색어로 좁혀보세요.</p>` : ""}`;
    bindRows($("#trOut"));
  }

  /* ============================================================ 전문대 vs 일반대 */
  async function vs(host) {
    const m = DATA.meta, st = state.vs;
    host.innerHTML = `
      <section class="panel">
        <h1>🆚 전문대 vs 일반대</h1>
        <p class="lead">자료집에는 전문대와 함께 <b>중위권 일반대 ${m.totals.univColleges}곳</b>의 학생부교과 전형 입결이 실려 있습니다.
          같은 등급대에서 두 선택지를 나란히 놓고 비교해 보세요.</p>
        <div class="mform">
          <label class="mfield wide">내신 평균 등급 <b id="vsOut">${st.my.toFixed(1)}</b>
            <input type="range" id="vsGrade" min="1" max="9" step="0.1" value="${st.my}"></label>
          <div class="mfield"><span>계열</span>${S.chipList(Object.keys(m.cats), st.cat1, null, { cls: "v-cat" })}</div>
          <div class="mfield"><span>권역</span>${S.chipList(m.regions, [...st.regions], null, { cls: "v-region" })}</div>
        </div>
        <div id="vsBody"><div class="loading sm">불러오는 중…</div></div>
      </section>`;
    $("#vsGrade").addEventListener("input", e => { st.my = +e.target.value; $("#vsOut").textContent = st.my.toFixed(1); });
    $("#vsGrade").addEventListener("change", () => renderVs());
    $$(".v-cat .chip").forEach(b => b.addEventListener("click", () => { st.cat1 = b.dataset.pick; vs(host); }));
    $$(".v-region .chip").forEach(b => b.addEventListener("click", () => {
      const v = b.dataset.pick; st.regions.has(v) ? st.regions.delete(v) : st.regions.add(v); vs(host);
    }));
    await S.loadUniv();
    renderVs();
  }

  function renderVs() {
    const st = state.vs, m = DATA.meta;
    const rows = DATA.univ.filter(u => {
      if (st.cat1 && u.cat1 !== st.cat1) return false;
      if (st.regions.size && !st.regions.has(u.region)) return false;
      return true;
    });
    const near = k => rows.filter(u => u.kind === k)
      .map(u => ({ u, gap: Math.abs((u.avg ?? u.min) - st.my) }))
      .filter(x => x.gap <= 1.0)
      .sort((a, b) => a.gap - b.gap).slice(0, 30);
    const junior = near("전문대"), uni = near("일반대");

    // 계열별 평균 등급 (전문대 vs 일반대) — 같은 축, 2개 차트를 나란히
    const cats = Object.keys(m.cats);
    const agg = kind => cats.map((c, i) => {
      const vals = DATA.univ.filter(u => u.kind === kind && u.cat1 === c && u.avg != null).map(u => u.avg);
      return { label: c, value: vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null, color: C.slot(i) };
    }).filter(x => x.value != null);
    const aj = agg("전문대"), au = agg("일반대");
    const maxG = Math.max(...[...aj, ...au].map(x => x.value), 1);

    const card = (u) => `<li>
      <b>${esc(u.unit)}</b><span>${esc(u.college)} · ${esc(u.sido)} · ${u.level ? u.level + "년제" : ""}</span>
      <dl><div><dt>평균</dt><dd>${u.avg ?? "–"}</dd></div>
        <div><dt>최저</dt><dd>${u.min ?? "–"}</dd></div>
        <div><dt>모집</dt><dd>${u.quota ?? "–"}</dd></div>
        <div><dt>취업률</dt><dd>${u.employ != null ? u.employ + "%" : "–"}</dd></div></dl>
      <p class="small">${esc(u.track || u.type || "")}${u.minStd ? ` · 수능최저 ${esc(u.minStd)}` : ""}</p></li>`;

    $("#vsBody").innerHTML = `
      <div class="chart-row two">
        <figure><figcaption>계열별 평균 등급 — <b>전문대</b></figcaption>
          ${C.hbars(aj, { max: maxG, fmt: v => v.toFixed(2) + "등급" })}</figure>
        <figure><figcaption>계열별 평균 등급 — <b>일반대</b> <small>(같은 축)</small></figcaption>
          ${C.hbars(au, { max: maxG, fmt: v => v.toFixed(2) + "등급" })}</figure>
      </div>
      <p class="hint">두 차트는 <b>같은 축(0~${maxG.toFixed(1)}등급)</b>을 씁니다. 등급은 숫자가 작을수록 성적이 우수하므로,
        <b>막대가 짧을수록 합격자 성적이 높다</b>(들어가기 어렵다)는 뜻입니다. 모든 계열에서 일반대 막대가 더 짧습니다.</p>

      <h2>내 등급 ±1.0 안에 드는 모집단위</h2>
      <div class="vs-cols">
        <div><h3>전문대 <small>${junior.length}개</small></h3>
          ${junior.length ? `<ul class="vs-list">${junior.map(x => card(x.u)).join("")}</ul>`
        : `<div class="empty sm">해당 없음</div>`}</div>
        <div><h3>일반대 <small>${uni.length}개</small></h3>
          ${uni.length ? `<ul class="vs-list">${uni.map(x => card(x.u)).join("")}</ul>`
        : `<div class="empty sm">해당 없음</div>`}</div>
      </div>
      <p class="hint">일반대 입결은 자료집에 실린 <b>학생부교과 전형</b> 기준입니다. 전문대는 학제(2·3년제)와 실무 중심 교육과정,
        일반대는 4년제 학위와 전공 심화라는 차이가 있으니 등급만이 아니라 진로 계획과 함께 보세요.</p>`;
  }

  /* ============================================================ 데이터 인사이트 */
  function insight(host) {
    const m = DATA.meta, ins = m.insights;
    const cats = Object.keys(ins.byCat);
    const catBar = (pick, fmt, o) => C.hbars(
      cats.map((c, i) => ({ label: c, value: ins.byCat[c][pick], color: C.slot(i) }))
        .filter(x => x.value != null).sort((a, b) => (o && o.asc ? a.value - b.value : b.value - a.value)),
      { padL: 26, fmt });

    const tracks = m.tracks.filter(t => ins.byTrack[t]);
    const trackBar = (pick, fmt, asc) => C.hbars(
      tracks.map(t => ({
        label: t, value: ins.byTrack[t][pick], color: global.Detail.trackColor(t),
        note: `${ins.byTrack[t].n.toLocaleString()}개 전형 · 모집 ${ins.byTrack[t].quota.toLocaleString()}명`
      })).filter(x => x.value != null).sort((a, b) => asc ? a.value - b.value : b.value - a.value),
      { padL: 32, rowH: 10, fmt });

    // 지역별 등록금·취업률
    const sidos = m.sidoOrder.filter(sd => m.sidoStats[sd].colleges);
    const sidoAgg = fn => sidos.map(sd => {
      const cs = DATA.colleges.filter(c => c.sido === sd);
      const vals = cs.map(fn).filter(v => v != null);
      return { label: sd, value: vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null };
    }).filter(x => x.value != null);

    host.innerHTML = `
      <section class="panel">
        <h1>📊 데이터 인사이트</h1>
        <p class="lead">2027 자료집 전체(대학 ${m.totals.colleges}곳 · 학과 ${m.totals.depts.toLocaleString()}개 ·
          전형 ${m.totals.admissions.toLocaleString()}건)를 집계해 지원 전략에 쓸 만한 패턴을 정리했습니다.</p>
      </section>

      <section class="panel">
        <h2>① 전형 유형이 등급을 가른다</h2>
        <p class="lead sm">같은 학과라도 어떤 전형으로 지원하느냐에 따라 합격 등급이 크게 달라집니다.
          <b>특성화고 전형</b>은 지원 자격이 있는 학생끼리만 경쟁해 평균 ${ins.byTrack["특성화고"] ? ins.byTrack["특성화고"].grade : "–"}등급으로 가장 높고,
          <b>대학자체기준 전형</b>은 경쟁률 ${ins.byTrack["대학자체기준"] ? ins.byTrack["대학자체기준"].comp : "–"}:1로 가장 낮습니다.</p>
        <div class="chart-row">
          <figure><figcaption>전형별 평균 최종등록 등급 <small>(짧을수록 문턱이 높음)</small></figcaption>
            ${trackBar("grade", v => v.toFixed(1) + "등급", true)}</figure>
          <figure><figcaption>전형별 평균 경쟁률</figcaption>${trackBar("comp", v => v.toFixed(1) + ":1", false)}</figure>
          <figure><figcaption>전형별 총 모집인원</figcaption>${trackBar("quota", v => v.toLocaleString() + "명", false)}</figure>
        </div>
        ${C.legend(tracks.map(t => ({ label: t, color: global.Detail.trackColor(t) })))}
        <div class="tbl-wrap"><table class="tbl sm">
          <thead><tr><th>전형</th><th>전형 수</th><th>총 모집인원</th><th>평균 등급</th><th>평균 경쟁률</th></tr></thead>
          <tbody>${tracks.map(t => `<tr><td class="tl">${esc(t)}</td>
            <td>${ins.byTrack[t].n.toLocaleString()}</td><td>${ins.byTrack[t].quota.toLocaleString()}</td>
            <td>${ins.byTrack[t].grade ?? "–"}</td><td>${ins.byTrack[t].comp ?? "–"}</td></tr>`).join("")}</tbody></table></div>
      </section>

      <section class="panel">
        <h2>② 계열 지형도</h2>
        <p class="lead sm">간호보건은 등급·경쟁률 모두 가장 높지만 취업률도 가장 높습니다. 예체능은 경쟁률이 높은 대신 등급 부담은 상대적으로 낮습니다.</p>
        <div class="chart-row">
          <figure><figcaption>평균 최종등록 등급 <small>(짧을수록 합격자 성적이 우수)</small></figcaption>${catBar("grade", v => v.toFixed(1) + "등급", { asc: true })}</figure>
          <figure><figcaption>평균 경쟁률</figcaption>${catBar("comp", v => v.toFixed(1) + ":1")}</figure>
          <figure><figcaption>평균 취업률(%)</figcaption>${catBar("employ", v => v.toFixed(0) + "%")}</figure>
          <figure><figcaption>평균 연간 등록금(만원)</figcaption>${C.hbars(
      cats.map((c, i) => ({ label: c, value: ins.byCat[c].tuition ? Math.round(ins.byCat[c].tuition / 10) : null, color: C.slot(i) }))
        .filter(x => x.value != null).sort((a, b) => b.value - a.value), { padL: 26, fmt: v => v.toLocaleString() })}</figure>
        </div>
      </section>

      <section class="panel">
        <h2>③ 경쟁률이 내려가는 학과</h2>
        <p class="lead sm">2024년 대비 2026년 경쟁률이 25% 이상 떨어진 학과입니다(모집 10명 이상).
          경쟁률 하락은 곧 합격선 하락으로 이어지는 경우가 많아 <b>노려볼 만한 자리</b>가 됩니다. 다만 학과 개편·정원 조정이 원인일 수도 있으니 모집요강을 함께 확인하세요.</p>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>학과</th><th>대학</th><th>지역</th><th>계열</th>
            <th>2024</th><th>2025</th><th>2026</th><th>변화</th></tr></thead>
          <tbody>${ins.falling.map(x => `<tr data-did="${x.id}">
            <td class="tl"><b>${esc(x.unit)}</b></td><td class="tl">${esc(x.college)}</td>
            <td>${esc(x.sido)}</td>
            <td class="tl"><span class="cat-dot sm" style="background:${global.App.catColor(x.cat1)}"></span>${esc(x.cat1)}</td>
            <td>${x.comp[2] ?? "–"}</td><td>${x.comp[1] ?? "–"}</td><td><b>${x.comp[0] ?? "–"}</b></td>
            <td class="pos">▼ ${Math.abs(Math.round(x.trend))}%</td></tr>`).join("")}</tbody></table></div>
      </section>

      <section class="panel">
        <h2>④ 등급 대비 취업률이 좋은 학과</h2>
        <p class="lead sm">취업률 80% 이상이면서 최종등록 등급 부담이 낮은 순으로 정렬했습니다(모집 10명 이상).</p>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>학과</th><th>대학</th><th>지역</th><th>계열</th><th>평균등급</th><th>취업률</th></tr></thead>
          <tbody>${ins.value.map(x => `<tr data-did="${x.id}">
            <td class="tl"><b>${esc(x.unit)}</b></td><td class="tl">${esc(x.college)}</td>
            <td>${esc(x.sido)}</td>
            <td class="tl"><span class="cat-dot sm" style="background:${global.App.catColor(x.cat1)}"></span>${esc(x.cat1)}</td>
            <td>${x.avg}</td><td><b>${x.employ}%</b></td></tr>`).join("")}</tbody></table></div>
      </section>

      <section class="panel">
        <h2>⑤ 지역별 비교</h2>
        <div class="chart-row two">
          <figure><figcaption>시·도별 평균 취업률(%)</figcaption>
            ${C.hbars(sidoAgg(c => c.employRate["2024"]).sort((a, b) => b.value - a.value)
        .map(x => ({ ...x, color: C.slot(0) })), { padL: 22, rowH: 7, fmt: v => v.toFixed(0) })}</figure>
          <figure><figcaption>시·도별 평균 연간 등록금(만원)</figcaption>
            ${C.hbars(sidoAgg(c => c.tuition["평균"]).map(x => ({ ...x, value: Math.round(x.value / 10), color: C.slot(1) }))
          .sort((a, b) => b.value - a.value), { padL: 22, rowH: 7, fmt: v => v.toLocaleString() })}</figure>
        </div>
      </section>`;

    bindRows(host);
  }

  /* ---------- 공통 ---------- */
  function bindRows(root) {
    if (!root) return;
    $$("[data-cart]", root).forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      const k = b.dataset.cart;
      S.CART.has(k) ? S.CART.delete(k) : S.CART.add(k);
      S.saveCart(); global.App.updateCartBar();
      b.classList.toggle("on", S.CART.has(k));
      b.textContent = S.CART.has(k) ? "✓" : "＋";
    }));
    $$("[data-did]", root).forEach(el => el.addEventListener("click", () => global.Detail.dept(+el.dataset.did)));
    $$("[data-college]", root).forEach(el => el.addEventListener("click", () =>
      location.hash = "#/college/" + encodeURIComponent(el.dataset.college)));
  }

  global.Tools = { match, calendar, transfer, vs, insight };
})(window);
