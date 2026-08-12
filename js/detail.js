/* 학과 상세 모달 · 대학 상세 페이지 */
(function (global) {
  "use strict";
  const S = global.Store, C = global.Charts;
  const { $, $$, esc, NA, pct, grade, comp, won, feeWon, catPath } = S;
  const DATA = S.DATA;

  const TRACK_SLOT = { "일반": 0, "일반고": 1, "특성화고": 2, "대학자체기준": 3, "대학자체": 3, "고른기회": 4 };
  const trackColor = t => C.slot(TRACK_SLOT[t] ?? 5);

  /* ---------- 모달 셸 ---------- */
  function openModal(html) {
    const host = $("#modalHost");
    host.innerHTML = `<div class="modal-back" id="modalBack">
      <div class="modal" role="dialog" aria-modal="true">
        <button class="modal-x" id="modalX" aria-label="닫기">✕</button>
        <div class="modal-body" id="modalBody">${html}</div>
      </div></div>`;
    document.body.classList.add("no-scroll");
    const close = () => { host.innerHTML = ""; document.body.classList.remove("no-scroll"); };
    $("#modalX").addEventListener("click", close);
    $("#modalBack").addEventListener("click", e => { if (e.target.id === "modalBack") close(); });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); }
    });
    return { close, body: $("#modalBody") };
  }

  /* ================= 학과 상세 ================= */
  async function dept(id) {
    const d = DATA.byId[id];
    if (!d) return;
    const c = DATA.byName[d.college];
    const inCart = S.CART.has("d:" + d.id);
    const ip = d.ipgyeol || {};

    const m = openModal(`
      <header class="md-head">
        <span class="cat-dot lg" style="background:${global.App.catColor(d.cat1)}"></span>
        <div>
          <h2>${esc(d.unit)}</h2>
          <p>${esc(d.college)} · ${esc(d.location || d.sido)} · ${d.level ? d.level + "년제" : ""}
            ${d.change ? `<span class="tag new">${esc(d.change)}</span>` : ""}</p>
          <p class="md-cat">${esc(catPath(d))}</p>
        </div>
        <button class="btn-cart${inCart ? " on" : ""}" id="mdCart">${inCart ? "✓ 비교함에 담김" : "＋ 비교함"}</button>
      </header>

      <section class="md-kpis">
        <div><b>${ip.avg && ip.avg[0] != null ? ip.avg[0] : "–"}</b><span>최종등록 평균등급</span></div>
        <div><b>${ip.min && ip.min[0] != null ? ip.min[0] : "–"}</b><span>최종등록 최저등급</span></div>
        <div><b>${ip.comp && ip.comp[0] != null ? ip.comp[0] + ":1" : "–"}</b><span>2026 경쟁률</span></div>
        <div><b>${d.employ != null ? d.employ + "%" : "–"}</b><span>취업률(2024)</span></div>
        <div><b>${d.tuition ? won(d.tuition) : "–"}</b><span>연간 등록금</span></div>
      </section>

      <section class="md-sec">
        <h3>3개년 추이</h3>
        <div class="chart-row">
          <figure><figcaption>경쟁률</figcaption>
            ${C.trend([{ label: "2024", value: (ip.comp || [])[2] }, { label: "2025", value: (ip.comp || [])[1] },
      { label: "2026", value: (ip.comp || [])[0] }], { fmt: v => v.toFixed(1) })}</figure>
          <figure><figcaption>최종등록자 평균등급 <small>(위로 갈수록 우수)</small></figcaption>
            ${C.trend([{ label: "2024", value: (ip.avg || [])[2] }, { label: "2025", value: (ip.avg || [])[1] },
        { label: "2026", value: (ip.avg || [])[0] }], { invert: true, color: C.slot(2), fmt: v => v.toFixed(2) })}</figure>
          <figure><figcaption>등급 분포 <small>(●평균 ○최저)</small></figcaption>
            ${C.gradeBand((ip.avg || [])[0], (ip.min || [])[0], null)}</figure>
        </div>
      </section>

      <section class="md-sec" id="mdTracks"><h3>전형별 입결</h3><div class="loading sm">불러오는 중…</div></section>
      <section class="md-sec" id="mdInfo"><h3>학과 정보</h3><div class="loading sm">불러오는 중…</div></section>
      <section class="md-sec" id="mdExtra"></section>

      <section class="md-sec">
        <h3>${esc(d.college)} 지표</h3>
        ${c ? `<div class="chart-row">
          <figure><figcaption>취업률(%)</figcaption>${C.bars([
      { label: "22", value: c.employRate["2022"] }, { label: "23", value: c.employRate["2023"] },
      { label: "24", value: c.employRate["2024"] }], { max: 100, color: C.slot(0), fmt: v => Math.round(v) })}</figure>
          <figure><figcaption>신입생 충원율(%)</figcaption>${C.bars([
        { label: "23", value: c.fillRate["2023"] }, { label: "24", value: c.fillRate["2024"] },
        { label: "25", value: c.fillRate["2025"] }], { max: 100, color: C.slot(2), fmt: v => Math.round(v) })}</figure>
          <figure><figcaption>계열별 연간 등록금(만원)</figcaption>${C.bars(
          ["인문사회", "자연과학", "공학", "예체능"].map((k, i) => ({
            label: k.slice(0, 2), value: c.tuition[k] ? Math.round(c.tuition[k] / 10) : null, color: C.slot(3)
          })), { fmt: v => v.toLocaleString() })}</figure>
        </div>
        <p class="md-links"><a class="btn sm" href="#/college/${encodeURIComponent(c.name)}">${esc(c.name)} 상세 보기 →</a></p>`
        : `<div class="empty sm">대학 지표 정보 없음</div>`}
      </section>`);

    $("#mdCart").addEventListener("click", e => {
      const k = "d:" + d.id;
      S.CART.has(k) ? S.CART.delete(k) : S.CART.add(k);
      S.saveCart(); global.App.updateCartBar();
      e.target.classList.toggle("on", S.CART.has(k));
      e.target.textContent = S.CART.has(k) ? "✓ 비교함에 담김" : "＋ 비교함";
      if (location.hash.startsWith("#/browse")) global.App.renderResults();
    });

    // ---- 지연 로드: 전형별 입결
    const [admIdx, jsIdx, info, ex] = await Promise.all([
      S.loadAdmissions(), S.loadJeongsi(), S.loadInfo(), S.loadExtras()
    ]);
    const box = $("#mdTracks");
    if (!box) return;                                    // 모달이 닫힘
    const adms = (admIdx[d.id] || []).slice().sort((a, b) =>
      (a.phase || "").localeCompare(b.phase || "") ||
      (TRACK_SLOT[a.track] ?? 9) - (TRACK_SLOT[b.track] ?? 9));
    const js = (jsIdx[d.id] || []).filter(j => j.phase === "정시모집");

    box.innerHTML = `<h3>전형별 입결 <small>수시 ${adms.length}건${js.length ? " · 정시 있음" : ""}</small></h3>`
      + (adms.length ? admTable(adms) : `<div class="empty sm">전형별 입결 정보 없음</div>`)
      + (adms.length ? trackCompare(adms) : "")
      + (js.length ? jeongsiTable(js) : "")
      + sbBlock(adms);

    // ---- 학과 정보
    const inf = info[d.id];
    $("#mdInfo").innerHTML = `<h3>학과 정보</h3>` + (inf ? `
      <dl class="md-info">
        ${inf.intro ? `<div><dt>학과 소개</dt><dd>${esc(inf.intro)}</dd></div>` : ""}
        ${inf.jobs ? `<div><dt>취업 분야</dt><dd>${esc(inf.jobs)}</dd></div>` : ""}
        ${inf.certs ? `<div><dt>취득 자격증</dt><dd>${esc(inf.certs)}</dd></div>` : ""}
        ${inf.support ? `<div><dt>지원·혜택</dt><dd>${esc(inf.support)}</dd></div>` : ""}
      </dl>` : `<div class="empty sm">학과 소개 정보 없음</div>`);

    // ---- 연계편입 / 채용약정 / 지원자격
    const tr = ex.transferByDept[d.id] || [];
    const od = ex.orderByDept[d.id] || [];
    const qual = (ex.x.qualify || {})[d.college] || {};
    const qkeys = Object.keys(qual).slice(0, 8);
    $("#mdExtra").innerHTML = `
      ${tr.length ? `<h3>🎓 무시험 연계편입</h3>
        ${tr.map(t => `<div class="note-box"><b>${esc(t.unit || d.unit)}</b>
          <p>${esc(t.targets)}</p>${t.method ? `<p class="hint">전형방법: ${esc(t.method)}</p>` : ""}</div>`).join("")}` : ""}
      ${od.length ? `<h3>🏢 채용약정형(주문식) 교육과정</h3>
        ${od.map(o => `<div class="note-box"><p>${esc(o.firms)}</p></div>`).join("")}` : ""}
      ${qkeys.length ? `<h3>📋 ${esc(d.college)} 전형별 지원자격</h3>
        <div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>전형</th><th>지원자격</th></tr></thead>
        <tbody>${qkeys.map(k => `<tr><td class="tl nowrap">${esc(k)}</td>
          <td class="tl">${esc(qual[k].who || qual[k].detail || "–")}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
  }

  function admTable(adms) {
    return `<div class="tbl-wrap"><table class="tbl sm">
      <thead><tr><th>시기</th><th>전형</th><th>구분</th><th>모집</th>
        <th>경쟁률<small>26·25·24</small></th><th>평균등급<small>26·25·24</small></th>
        <th>최저등급<small>26·25·24</small></th><th>반영비율</th></tr></thead>
      <tbody>${adms.map(a => `<tr>
        <td class="nowrap">${esc(a.phase)}</td>
        <td class="tl nowrap"><span class="cat-dot sm" style="background:${trackColor(a.track)}"></span>${esc(a.track || "–")}</td>
        <td class="nowrap">${esc(a.type || "–")}</td>
        <td>${a.quota ?? "–"}</td>
        <td class="series">${a.comp.map(v => v == null ? "–" : v).join(" · ")}</td>
        <td class="series">${a.avg.map(v => v == null ? "–" : v).join(" · ")}</td>
        <td class="series">${a.min.map(v => v == null ? "–" : v).join(" · ")}</td>
        <td class="tl">${Object.entries(a.w).map(([k, v]) => `${k} ${v}%`).join(" + ") || "–"}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  /** 같은 학과 안에서 전형 트랙별 등급 차이 — 어떤 전형이 유리한가 */
  function trackCompare(adms) {
    const rows = adms.filter(a => a.phase === "수시1차" && a.track && a.avg[0] != null);
    if (rows.length < 2) return "";
    const short = rows.slice().sort((a, b) => a.avg[0] - b.avg[0])[0];
    return `<figure class="track-cmp">
      <figcaption>수시1차 전형별 최종등록자 평균등급
        <small>막대가 길수록 성적 부담이 적습니다 (등급 숫자가 큼)</small></figcaption>
      ${C.hbars(rows.map(a => ({
      label: a.track, value: a.avg[0], color: trackColor(a.track),
      note: `모집 ${a.quota ?? "–"}명 · 경쟁률 ${a.comp[0] ?? "–"}`
    })), { max: 9, fmt: v => v.toFixed(2) + "등급" })}
      <p class="hint">이 학과에서 합격선이 가장 높은 전형은 <b>${esc(short.track)}</b>(평균 ${short.avg[0]}등급)입니다.
        지원 자격이 되는 전형이 여러 개라면 등급 부담이 적은 쪽을 택하는 것이 유리합니다.</p>
    </figure>`;
  }

  function jeongsiTable(js) {
    const rows = [];
    js.forEach(j => Object.entries(j.tracks).forEach(([t, v]) => rows.push([t, v, j.quota])));
    if (!rows.length) return "";
    return `<h4 class="md-sub">정시모집</h4>
      <div class="tbl-wrap"><table class="tbl sm">
      <thead><tr><th>전형</th><th>경쟁률</th><th>교과등급 평균</th><th>교과등급 최저</th>
        <th>수능백분위 평균</th><th>수능백분위 최저</th></tr></thead>
      <tbody>${rows.map(([t, v]) => `<tr>
        <td class="tl nowrap">${esc(t)}</td><td>${v.comp ?? "–"}</td><td>${v.gAvg ?? "–"}</td>
        <td>${v.gMin ?? "–"}</td><td>${v.sAvg ?? "–"}</td><td>${v.sMin ?? "–"}</td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  /** 학생부 반영방법 (전형마다 거의 같으므로 대표 1건) */
  function sbBlock(adms) {
    const a = adms.find(x => x.sb && (x.sb.useTerm || x.sb.index));
    if (!a) return "";
    const sb = a.sb;
    const g = sb.grade || [], it = sb.item || [];
    return `<h4 class="md-sub">학생부 반영방법</h4>
      <dl class="kv">
        ${sb.index ? `<div><dt>활용지표</dt><dd>${esc(sb.index)}</dd></div>` : ""}
        ${sb.baseTerm ? `<div><dt>기준학기</dt><dd>${esc(sb.baseTerm)}</dd></div>` : ""}
        ${sb.useTerm ? `<div><dt>반영학기</dt><dd>${esc(sb.useTerm)}</dd></div>` : ""}
        ${sb.subject ? `<div><dt>반영과목</dt><dd>${esc(sb.subject)}</dd></div>` : ""}
        ${sb.career ? `<div><dt>진로선택</dt><dd>${esc(sb.career)}</dd></div>` : ""}
        ${g.some(v => v) ? `<div><dt>학년별 비율</dt><dd>1학년 ${g[0] ?? "–"}% · 2학년 ${g[1] ?? "–"}% · 3학년 ${g[2] ?? "–"}%</dd></div>` : ""}
        ${it.some(v => v) ? `<div><dt>항목별 비율</dt><dd>교과 ${it[0] ?? "–"}% · 출결 ${it[1] ?? "–"}% · 기타 ${it[2] ?? "–"}%</dd></div>` : ""}
        ${a.minStd ? `<div><dt>수능 최저학력기준</dt><dd>${esc(a.minStd)}</dd></div>` : ""}
      </dl>`;
  }

  /* ================= 대학 상세 페이지 ================= */
  async function collegePage(host, name) {
    const c = DATA.byName[name];
    if (!c) { host.innerHTML = `<div class="empty">대학을 찾을 수 없습니다.</div>`; return; }
    const depts = DATA.departments.filter(d => d.college === name);
    const cats = Object.entries(c.cats || {}).sort((a, b) => b[1] - a[1]);
    const PHASES = ["수시1차", "수시2차", "정시모집"];

    host.innerHTML = `
      <nav class="crumb"><a href="#/browse">탐색</a> › <span>${esc(c.name)}</span></nav>
      <section class="panel college-head">
        <div>
          <h1>${esc(c.name)}${c.campusOf ? ` <small>(${esc(c.campusOf)} 캠퍼스)</small>` : ""}</h1>
          <p class="sub">${esc(c.location || c.sido)} · ${esc(c.region)} · 학과 ${c.deptCount}개</p>
          <div class="tags">
            ${c.nurse ? '<span class="tag">간호학과 개설</span>' : ""}
            ${c.teaching ? '<span class="tag">교직과정</span>' : ""}
            ${c.ptChange ? '<span class="tag">물리치료 학제변경</span>' : ""}
            ${c.suneungMin ? '<span class="tag">수능최저 적용</span>' : ""}
            ${c.fee.free ? '<span class="tag good">전형료 무료</span>' : ""}
            ${c.inherited ? '<span class="tag">본교 지표 준용</span>' : ""}
          </div>
        </div>
        <div class="md-kpis">
          <div><b>${c.employRate["2024"] ?? "–"}</b><span>취업률(2024)</span></div>
          <div><b>${c.fillRate["2025"] ?? "–"}</b><span>충원율(2025)</span></div>
          <div><b>${c.tuition["평균"] ? Math.round(c.tuition["평균"] / 10).toLocaleString() : "–"}</b><span>평균 등록금(만원)</span></div>
          <div><b>${c.fee.min ? Math.round(c.fee.min / 1000) : "–"}</b><span>전형료(천원)</span></div>
        </div>
      </section>

      <section class="panel">
        <h2>3개년 지표</h2>
        <div class="chart-row">
          <figure><figcaption>취업률(%)</figcaption>${C.bars([
      { label: "2022", value: c.employRate["2022"] }, { label: "2023", value: c.employRate["2023"] },
      { label: "2024", value: c.employRate["2024"] }], { max: 100, color: C.slot(0), fmt: v => Math.round(v) })}</figure>
          <figure><figcaption>신입생 충원율(%)</figcaption>${C.bars([
        { label: "2023", value: c.fillRate["2023"] }, { label: "2024", value: c.fillRate["2024"] },
        { label: "2025", value: c.fillRate["2025"] }], { max: 100, color: C.slot(2), fmt: v => Math.round(v) })}</figure>
          <figure><figcaption>계열별 연간 등록금(만원)</figcaption>${C.bars(
          ["인문사회", "자연과학", "공학", "예체능"].map(k => ({
            label: k.slice(0, 2), value: c.tuition[k] ? Math.round(c.tuition[k] / 10) : null, color: C.slot(3)
          })), { fmt: v => v.toLocaleString() })}</figure>
        </div>
      </section>

      <section class="panel">
        <h2>📅 전형 일정</h2>
        ${Object.keys(c.schedule).length ? `<div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>모집시기</th><th>원서접수</th><th>면접</th><th>실기</th><th>합격자 발표</th><th>등록</th><th>충원 발표·등록</th></tr></thead>
          <tbody>${PHASES.filter(p => c.schedule[p]).map(p => {
        const x = c.schedule[p];
        return `<tr><td class="nowrap"><b>${esc(p)}</b></td><td class="nowrap">${esc(S.dt(x.apply))}</td>
          <td class="nowrap">${esc(S.dt(x.interview))}</td><td class="nowrap">${esc(S.dt(x.practical))}</td>
          <td class="nowrap">${esc(S.dt(x.result))}</td><td class="nowrap">${esc(S.dt(x.enroll))}</td>
          <td class="nowrap">${esc(S.dt(x.extra))}</td></tr>`;
      }).join("")}</tbody></table></div>` : `<div class="empty sm">일정 정보 없음</div>`}
      </section>

      <section class="panel two-col">
        <div>
          <h2>💳 전형료</h2>
          ${c.fee.list.length ? `<ul class="plain">${c.fee.list.map(f =>
        `<li>${esc(f.type || "전형")} <b>${f.won.toLocaleString()}원</b></li>`).join("")}</ul>` : `<div class="empty sm">정보 없음</div>`}
          ${c.fee.free ? `<p class="good-note">✔ 전형료 무료 제도 있음${c.fee.freeNote ? ` — ${esc(c.fee.freeNote)}` : ""}</p>` : ""}
        </div>
        <div>
          <h2>🔁 복수지원 규정</h2>
          ${c.dup ? `<p class="note-box">${esc(c.dup.note || "–")}</p>
            <p class="hint">${c.dup.blocked ? "복수지원 제한 있음" : "복수지원 가능"}
            ${c.dup.times ? ` · 지원 가능 횟수 ${esc(c.dup.times)}` : ""}</p>` : `<div class="empty sm">정보 없음</div>`}
        </div>
      </section>

      <section class="panel two-col">
        <div>
          <h2>🎓 무시험 연계편입</h2>
          ${c.transfer.targets.length ? `<div class="tags big">${c.transfer.targets.map(t =>
        `<span class="tag good">${esc(t)}</span>`).join("")}</div>
            ${c.transfer.note ? `<p class="hint">${esc(c.transfer.note)}</p>` : ""}
            <p class="hint">학과별 편입 경로 ${c.transfer.count}건 — 학과 상세에서 확인</p>`
        : `<div class="empty sm">연계편입 협약 정보 없음</div>`}
        </div>
        <div>
          <h2>🏷️ 개설 주요학과</h2>
          ${c.majorList.length ? `<div class="tags big">${c.majorList.map(t =>
          `<button class="tag pick" data-major="${esc(t)}">${esc(t)}</button>`).join("")}</div>`
        : `<div class="empty sm">정보 없음</div>`}
        </div>
      </section>

      ${c.tie.length ? `<section class="panel"><h2>🤝 동점자 처리 기준</h2>
        <div class="tbl-wrap"><table class="tbl sm"><thead><tr><th>전형</th><th>순위별 기준</th></tr></thead>
        <tbody>${c.tie.map(t => `<tr><td class="nowrap tl">${esc(t.type || "–")}</td>
          <td class="tl"><ol class="ranks">${t.ranks.map(x => `<li>${esc(x)}</li>`).join("")}</ol></td></tr>`).join("")}
        </tbody></table></div></section>` : ""}

      <section class="panel">
        <div class="panel-head"><h2>학과 ${depts.length}개</h2>
          <div class="panel-tools">${cats.map(([k, v]) =>
          `<span class="legend-item"><i style="background:${global.App.catColor(k)}"></i>${esc(k)} ${v}</span>`).join("")}</div>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>학과</th><th>계열</th><th>학제</th><th>평균등급</th><th>최저등급</th>
            <th>경쟁률</th><th>모집</th><th>취업률</th><th>편입</th></tr></thead>
          <tbody>${depts.map(d => {
            const ip = d.ipgyeol || {};
            return `<tr data-did="${d.id}">
              <td class="tl"><b>${esc(d.unit)}</b>${d.change ? ` <span class="tag new">${esc(d.change)}</span>` : ""}</td>
              <td class="tl"><span class="cat-dot sm" style="background:${global.App.catColor(d.cat1)}"></span>${esc(d.cat2 || d.cat1)}</td>
              <td>${d.level ?? "–"}</td>
              <td>${(ip.avg || [])[0] ?? "–"}</td>
              <td>${(ip.min || [])[0] ?? "–"}</td>
              <td>${(ip.comp || [])[0] ?? "–"}</td>
              <td>${ip.quota ?? "–"}</td>
              <td>${d.employ ?? "–"}</td>
              <td>${d.transfer || "–"}</td></tr>`;
          }).join("")}</tbody></table></div>
      </section>`;

    $$("[data-did]", host).forEach(el => el.addEventListener("click", () => dept(+el.dataset.did)));
    $$("[data-major]", host).forEach(el => el.addEventListener("click", () =>
      global.App.gotoBrowse(F => F.majors.add(el.dataset.major))));
  }

  global.Detail = { dept, collegePage, openModal, trackColor };
})(window);
