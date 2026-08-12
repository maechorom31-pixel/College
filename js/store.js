/* 전역 데이터 저장소 + 공통 유틸 (의존성 없음) */
(function (global) {
  "use strict";

  const DATA = {
    meta: null, colleges: [], departments: [], byName: {}, byId: {},
    // 지연 로드 영역
    admissions: null, jeongsi: null, info: null, extras: null, univ: null,
  };

  const REGION_COLORS = {
    "수도권": "#4263eb", "강원권": "#0ca678", "충청권": "#15aabf",
    "대구경북권": "#f76707", "부산울산경남권": "#e03131", "호남권": "#37b24d",
    "제주권": "#9c36b5"
  };
  const CAT_COLORS = {
    "공학": "#4263eb", "간호보건": "#0ca678", "예체능": "#e8590c",
    "인문사회": "#7048e8", "자연": "#1098ad", "자율전공": "#868e96"
  };
  const TRACK_COLORS = {
    "일반": "#4263eb", "일반고": "#0ca678", "특성화고": "#e8590c", "대학자체기준": "#7048e8"
  };

  /* ---------- 포맷 ---------- */
  const esc = v => v == null ? "" : String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const NA = '<span class="na">정보없음</span>';
  const n1 = v => v == null ? NA : (Math.round(v * 10) / 10).toLocaleString();
  const pct = v => v == null ? NA : `${Math.round(v * 10) / 10}%`;
  const grade = v => v == null ? NA : `${(Math.round(v * 100) / 100).toFixed(2)}등급`;
  const comp = v => v == null ? NA : `${(Math.round(v * 10) / 10).toFixed(1)}:1`;
  const won = v => v == null ? NA : `${Math.round(v / 10).toLocaleString()}만원`;   // 천원 단위 -> 만원
  const feeWon = v => v == null ? NA : `${Math.round(v / 1000)}천원`;
  const yr = v => v == null ? "–" : v;
  /** "2026-10-02" / "2026-10-02 ~ 2026-10-03" -> "10/2" / "10/2~10/3" */
  const dt = v => v == null ? "–" : String(v)
    .replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => `${+m}/${+d}`)
    .replace(/\s*~\s*/, "~");

  /* ---------- 로딩 ---------- */
  async function boot() {
    const [meta, colleges, departments] = await Promise.all([
      fetch("data/meta.json").then(r => r.json()),
      fetch("data/colleges.json").then(r => r.json()),
      fetch("data/departments.json").then(r => r.json())
    ]);
    DATA.meta = meta;
    DATA.colleges = colleges;
    DATA.departments = departments;
    colleges.forEach(c => DATA.byName[c.name] = c);
    departments.forEach(d => DATA.byId[d.id] = d);
  }

  const _pending = {};
  function lazy(name, file, after) {
    if (DATA[name]) return Promise.resolve(DATA[name]);
    if (_pending[name]) return _pending[name];
    _pending[name] = fetch(file).then(r => r.json()).then(j => {
      DATA[name] = j;
      if (after) after(j);
      return j;
    });
    return _pending[name];
  }

  // 전형별 입결 — 학과 id로 색인
  let admByDept = null;
  const loadAdmissions = () => lazy("admissions", "data/admissions.json", list => {
    admByDept = {};
    list.forEach(a => { if (a.did) (admByDept[a.did] = admByDept[a.did] || []).push(a); });
  }).then(() => admByDept);

  let jeongsiByDept = null;
  const loadJeongsi = () => lazy("jeongsi", "data/jeongsi.json", list => {
    jeongsiByDept = {};
    list.forEach(j => { if (j.did) (jeongsiByDept[j.did] = jeongsiByDept[j.did] || []).push(j); });
  }).then(() => jeongsiByDept);

  const loadInfo = () => lazy("info", "data/dept_info.json");
  const loadUniv = () => lazy("univ", "data/univ.json");

  let transferByDept = null, orderByDept = null;
  const loadExtras = () => lazy("extras", "data/extras.json", x => {
    transferByDept = {}; orderByDept = {};
    x.transfer.forEach(t => { if (t.did) (transferByDept[t.did] = transferByDept[t.did] || []).push(t); });
    x.order.forEach(o => { if (o.did) (orderByDept[o.did] = orderByDept[o.did] || []).push(o); });
  }).then(x => ({ x, transferByDept, orderByDept }));

  /* ---------- 파생 헬퍼 ---------- */
  function deptGrade(d) {            // 대표 최종등록자 평균등급(2026)
    const ip = d.ipgyeol || {};
    return (ip.avg && ip.avg[0]) ?? null;
  }
  function deptComp(d) {
    const ip = d.ipgyeol || {};
    return (ip.comp && ip.comp[0]) ?? null;
  }
  function catPath(d) {
    return [d.cat1, d.cat2, d.cat3].filter(Boolean).join(" › ");
  }
  function collegeOf(d) { return DATA.byName[d.college] || null; }

  /**
   * 내 등급 기준 합격 가능성 판정.
   * avg = 최종등록자 평균등급, min = 최종등록자 최저등급(가장 낮은 합격자)
   * 등급은 숫자가 작을수록 우수.
   */
  function verdict(my, avg, min) {
    if (my == null) return null;
    if (avg == null && min == null) return null;
    // 정상 자료라면 평균 < 최저(숫자 기준)지만, 뒤집힌 행이 있어도 안전하게
    const a = Math.min(avg ?? min, min ?? avg), m = Math.max(avg ?? min, min ?? avg);
    if (my <= a) return "안정";
    if (my <= m) return "적정";
    if (my <= m + 1.0) return "도전";
    return "어려움";
  }
  const VERDICT_META = {
    "안정": { color: "#0ca678", desc: "최종등록자 평균보다 좋은 성적" },
    "적정": { color: "#4263eb", desc: "평균~최저 합격선 사이" },
    "도전": { color: "#e8590c", desc: "최저 합격선보다 1등급 이내로 낮음" },
    "어려움": { color: "#adb5bd", desc: "최저 합격선에서 크게 벗어남" },
  };

  /* ---------- 저장소(비교함) ---------- */
  const CART = (() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("cart") || "[]")
        .filter(k => typeof k === "string" && k[0] === "d"));
    } catch (e) { return new Set(); }
  })();
  function saveCart() { try { localStorage.setItem("cart", JSON.stringify([...CART])); } catch (e) {} }

  /* ---------- DOM 유틸 ---------- */
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => [...(root || document).querySelectorAll(s)];

  function chipList(items, active, onPick, opts) {
    const o = opts || {};
    return `<div class="chips${o.cls ? " " + o.cls : ""}">${items.map(it => {
      const val = typeof it === "string" ? it : it.value;
      const label = typeof it === "string" ? it : it.label;
      const on = Array.isArray(active) ? active.includes(val) : active === val;
      return `<button type="button" class="chip${on ? " on" : ""}" data-pick="${esc(val)}">${esc(label)}</button>`;
    }).join("")}</div>`;
  }

  function csv(rows) {
    return "﻿" + rows.map(r => r.map(c => {
      const t = c == null ? "" : String(c);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    }).join(",")).join("\n");
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  global.Store = {
    DATA, REGION_COLORS, CAT_COLORS, TRACK_COLORS, VERDICT_META,
    esc, NA, n1, pct, grade, comp, won, feeWon, yr, dt,
    boot, loadAdmissions, loadJeongsi, loadInfo, loadExtras, loadUniv,
    deptGrade, deptComp, catPath, collegeOf, verdict,
    CART, saveCart, $, $$, chipList, csv, download,
  };
})(window);
