/* 의존성 없는 SVG 차트 모음
   색 규칙
   - 범주형(계열·전형트랙): PALETTE 를 고정 순서로 사용, 순환하지 않음
   - 크기(대학 수·학과 수): SEQ 파랑 단일 색상 램프 (밝음→진함)
   - 상태(안정/적정/도전/어려움): STATUS 고정색 + 반드시 라벨 동반
   모든 차트는 직접 라벨을 달고, 값은 텍스트 색(먹)으로 표기한다. */
(function (global) {
  "use strict";
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 검증 완료(light, surface #ffffff, 인접쌍 기준): CVD ΔE 9.1 / normal ΔE 19.6
  const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
  const SEQ = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab", "#184f95"];
  const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" };
  const INK = "#1d2433", MUTED = "#6b7385", GRID = "#e6e9f0", AXIS = "#c3c2b7";

  const slot = i => PALETTE[i % PALETTE.length];
  /** 0~1 값을 파랑 램프의 한 단계로 (크기 인코딩 전용) */
  function seq(t) {
    if (t == null || isNaN(t)) return "#eef1f6";
    const i = Math.max(0, Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1))));
    return SEQ[i];
  }

  function frame(W, H, inner, cls) {
    return `<svg viewBox="0 0 ${W} ${H}" class="chart ${cls || ""}" preserveAspectRatio="xMidYMid meet" role="img">
      <style>
        .c-val{font-size:4.6px;fill:${INK};text-anchor:middle;font-weight:700}
        .c-lab{font-size:4.3px;fill:${MUTED};text-anchor:middle}
        .c-na{font-size:5.5px;fill:#aeb4c2;text-anchor:middle}
        .c-mark{transition:opacity .12s}
        .chart:hover .c-mark{opacity:.55}
        .chart .c-mark:hover{opacity:1}
      </style>${inner}</svg>`;
  }

  /* ── 세로 막대: items=[{label,value,color?,note?}] ── */
  function bars(items, opts) {
    const o = opts || {}, W = 100, H = o.height || 62, padB = 13, padT = 9;
    const vals = items.map(i => i.value).filter(v => v != null);
    if (!vals.length) return `<div class="c-empty">정보 없음</div>`;
    const max = o.max || Math.max(...vals) || 1;
    const n = items.length, gap = n > 8 ? 2 : 5, bw = (W - gap * (n + 1)) / n;
    let out = "";
    items.forEach((it, i) => {
      const x = gap + i * (bw + gap);
      if (it.value == null) {
        out += `<text x="${x + bw / 2}" y="${H - padB - 4}" class="c-na">–</text>`;
      } else {
        const h = Math.max(1.2, (H - padB - padT) * (it.value / max));
        const y = H - padB - h;
        out += `<g class="c-mark"><title>${esc(it.label)} · ${esc(o.fmt ? o.fmt(it.value) : it.value)}${it.note ? " · " + esc(it.note) : ""}</title>`
          + `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="1.6" fill="${it.color || slot(0)}"/></g>`
          + `<text x="${x + bw / 2}" y="${y - 1.6}" class="c-val">${esc(o.fmt ? o.fmt(it.value) : it.value)}</text>`;
      }
      out += `<text x="${x + bw / 2}" y="${H - 3}" class="c-lab">${esc(it.label)}</text>`;
    });
    return frame(W, H, out);
  }

  /* ── 가로 순위 막대: items=[{label,value,color?,note?}]
     SVG 대신 HTML/CSS — 폭에 따라 글자가 함께 커지는 문제가 없고, 값 라벨이 잘리지 않는다. ── */
  function hbars(items, opts) {
    const o = opts || {};
    const vals = items.map(i => i.value).filter(v => v != null);
    if (!vals.length) return `<div class="c-empty">정보 없음</div>`;
    const max = o.max || Math.max(...vals) || 1;
    return `<div class="hbars">${items.map(it => {
      const v = it.value;
      const w = v == null ? 0 : Math.max(1.5, (v / max) * 100);
      const label = o.fmt ? o.fmt(v) : v;
      return `<div class="hbar" title="${esc(it.label)} · ${esc(label)}${it.note ? " · " + esc(it.note) : ""}">
        <span class="hb-lab">${esc(it.label)}</span>
        <span class="hb-track"><i style="width:${w}%;background:${it.color || slot(0)}"></i></span>
        <span class="hb-val">${v == null ? "–" : esc(label)}</span>
      </div>`;
    }).join("")}</div>`;
  }

  /* ── 추이선: series=[{label,value}] (연도순, 왼쪽이 과거) ── */
  function trend(series, opts) {
    const o = opts || {}, W = 100, H = o.height || 60, padB = 13, padT = 11, padX = 9;
    const vals = series.map(s => s.value).filter(v => v != null);
    if (!vals.length) return `<div class="c-empty">정보 없음</div>`;
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pd = (max - min) * 0.18; min -= pd; max += pd;
    if (o.invert) { const t = min; min = max; max = t; }   // 등급은 작을수록 위
    const n = series.length;
    const xx = i => padX + (W - 2 * padX) * (n === 1 ? 0.5 : i / (n - 1));
    const yy = v => padT + (H - padB - padT) * (1 - (v - min) / (max - min));
    const color = o.color || slot(0);
    let line = "", dots = "", labs = "", prev = null;
    series.forEach((s, i) => {
      labs += `<text x="${xx(i)}" y="${H - 3}" class="c-lab">${esc(s.label)}</text>`;
      if (s.value == null) { prev = null; return; }
      const x = xx(i), y = yy(s.value);
      if (prev) line += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
      dots += `<g class="c-mark"><title>${esc(s.label)} · ${esc(o.fmt ? o.fmt(s.value) : s.value)}</title>`
        + `<circle cx="${x}" cy="${y}" r="2.6" fill="${color}" stroke="#fff" stroke-width="1"/></g>`
        + `<text x="${x}" y="${y - 4.4}" class="c-val">${esc(o.fmt ? o.fmt(s.value) : s.value)}</text>`;
      prev = [x, y];
    });
    return frame(W, H, line + dots + labs);
  }

  /* ── 다계열 추이선: series=[{name,color,points:[{label,value}]}] ── */
  function multiTrend(series, opts) {
    const o = opts || {}, W = 100, H = o.height || 62, padB = 13, padT = 8, padX = 10;
    const all = series.flatMap(s => s.points.map(p => p.value)).filter(v => v != null);
    if (!all.length) return `<div class="c-empty">정보 없음</div>`;
    let min = Math.min(...all), max = Math.max(...all);
    if (min === max) { min -= 1; max += 1; }
    const pd = (max - min) * 0.15; min -= pd; max += pd;
    if (o.invert) { const t = min; min = max; max = t; }
    const labels = series[0].points.map(p => p.label), n = labels.length;
    const xx = i => padX + (W - 2 * padX) * (n === 1 ? 0.5 : i / (n - 1));
    const yy = v => padT + (H - padB - padT) * (1 - (v - min) / (max - min));
    let body = "";
    labels.forEach((l, i) => { body += `<text x="${xx(i)}" y="${H - 3}" class="c-lab">${esc(l)}</text>`; });
    series.forEach((s, si) => {
      const color = s.color || slot(si);
      let prev = null;
      s.points.forEach((p, i) => {
        if (p.value == null) { prev = null; return; }
        const x = xx(i), y = yy(p.value);
        if (prev) body += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`;
        body += `<g class="c-mark"><title>${esc(s.name)} · ${esc(p.label)} · ${esc(o.fmt ? o.fmt(p.value) : p.value)}</title>`
          + `<circle cx="${x}" cy="${y}" r="2.2" fill="${color}" stroke="#fff" stroke-width=".9"/></g>`;
        prev = [x, y];
      });
      // 마지막 점에 계열명 직접 라벨
      const last = [...s.points].reverse().find(p => p.value != null);
      if (last) {
        const li = s.points.lastIndexOf(last);
        body += `<text x="${xx(li) + 3}" y="${yy(last.value) + 1.4}" class="c-lab" style="text-anchor:start;fill:${color};font-weight:700">${esc(s.name)}</text>`;
      }
    });
    return frame(W, H, body);
  }

  /* ── 등급 밴드(평균~최저) + 내 등급 표시 ── */
  function gradeBand(avg, min, my, opts) {
    const o = opts || {}, W = 100, H = 26;
    if (avg == null && min == null) return `<div class="c-empty">입결 정보 없음</div>`;
    const lo = o.lo != null ? o.lo : 1, hi = o.hi != null ? o.hi : 9;
    const xx = g => 4 + (W - 8) * ((g - lo) / (hi - lo));
    let out = `<rect x="4" y="10" width="${W - 8}" height="3" rx="1.5" fill="${GRID}"/>`;
    for (let g = lo; g <= hi; g++) out += `<text x="${xx(g)}" y="${H - 2}" class="c-lab">${g}</text>`;
    if (avg != null && min != null) {
      const a = xx(Math.min(avg, min)), b = xx(Math.max(avg, min));
      out += `<rect x="${a}" y="9" width="${Math.max(1.5, b - a)}" height="5" rx="2.5" fill="${slot(0)}" opacity=".28"/>`;
    }
    if (avg != null) {
      out += `<g class="c-mark"><title>최종등록자 평균 ${avg}등급</title><circle cx="${xx(avg)}" cy="11.5" r="3" fill="${slot(0)}" stroke="#fff" stroke-width="1"/></g>`
        + `<text x="${xx(avg)}" y="6.5" class="c-val" style="font-size:4px">평균 ${avg}</text>`;
    }
    if (min != null) {
      out += `<g class="c-mark"><title>최종등록자 최저 ${min}등급</title><circle cx="${xx(min)}" cy="11.5" r="2.6" fill="#fff" stroke="${slot(0)}" stroke-width="1.4"/></g>`;
    }
    if (my != null) {
      const x = xx(Math.max(lo, Math.min(hi, my)));
      out += `<line x1="${x}" y1="4" x2="${x}" y2="18" stroke="${STATUS.critical}" stroke-width="1.6"/>`
        + `<text x="${x}" y="3.2" class="c-val" style="fill:${STATUS.critical};font-size:4px">내 ${my}</text>`;
    }
    return frame(W, H, out, "band");
  }

  /* ── 누적 가로 막대(구성비): parts=[{label,value,color}] ── */
  function stack(parts, opts) {
    const o = opts || {}, W = 100, H = o.height || 12;
    const total = parts.reduce((s, p) => s + (p.value || 0), 0);
    if (!total) return `<div class="c-empty">정보 없음</div>`;
    let x = 0, out = "";
    parts.forEach((p, i) => {
      const w = (W) * ((p.value || 0) / total);
      if (w <= 0) return;
      out += `<g class="c-mark"><title>${esc(p.label)} ${esc(o.fmt ? o.fmt(p.value) : p.value)} (${Math.round(p.value / total * 100)}%)</title>`
        + `<rect x="${x + (i ? 1 : 0)}" y="1" width="${Math.max(0.6, w - (i ? 1 : 0))}" height="${H - 2}" rx="1.4" fill="${p.color || slot(i)}"/></g>`;
      x += w;
    });
    return frame(W, H, out, "stack");
  }

  function legend(items) {
    return `<div class="legend">${items.map(i =>
      `<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join("")}</div>`;
  }

  global.Charts = { bars, hbars, trend, multiTrend, gradeBand, stack, legend, slot, seq, PALETTE, SEQ, STATUS };
})(window);
