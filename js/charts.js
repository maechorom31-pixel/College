/* 의존성 없는 미니 SVG 차트 (막대 / 추이선) */
(function (global) {
  const esc = s => String(s).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

  // 막대 차트: items = [{label, value, color?}]  (value null이면 '정보없음')
  function bars(items, opts = {}) {
    const W = 100, H = 60, padB = 14, padT = 8;
    const vals = items.map(i => i.value).filter(v => v != null);
    const max = opts.max || (vals.length ? Math.max(...vals) : 1) || 1;
    const n = items.length, gap = 6, bw = (W - gap * (n + 1)) / n;
    let bodies = "", labels = "";
    items.forEach((it, i) => {
      const x = gap + i * (bw + gap);
      if (it.value == null) {
        labels += `<text x="${x + bw / 2}" y="${H - padB - 4}" class="c-na">–</text>`;
      } else {
        const h = (H - padB - padT) * (it.value / max);
        const y = H - padB - h;
        bodies += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="1.5" fill="${it.color || "var(--brand)"}"/>`;
        labels += `<text x="${x + bw / 2}" y="${y - 1.5}" class="c-val">${opts.fmt ? opts.fmt(it.value) : it.value}</text>`;
      }
      labels += `<text x="${x + bw / 2}" y="${H - 3}" class="c-lab">${esc(it.label)}</text>`;
    });
    return chartFrame(W, H, bodies + labels);
  }

  // 추이선: series = [{label, value}] (연도순)
  function trend(series, opts = {}) {
    const W = 100, H = 60, padB = 14, padT = 10, padX = 8;
    const pts = series.filter(s => s.value != null);
    if (pts.length === 0) return `<div class="c-empty">정보 없음</div>`;
    const vals = series.map(s => s.value).filter(v => v != null);
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.15; min -= pad; max += pad;
    const n = series.length;
    const xx = i => padX + (W - 2 * padX) * (n === 1 ? 0.5 : i / (n - 1));
    const yy = v => padT + (H - padB - padT) * (1 - (v - min) / (max - min));
    let line = "", dots = "", labs = "";
    let prev = null;
    series.forEach((s, i) => {
      labs += `<text x="${xx(i)}" y="${H - 3}" class="c-lab">${esc(s.label)}</text>`;
      if (s.value == null) { prev = null; return; }
      const x = xx(i), y = yy(s.value);
      if (prev) line += `<line x1="${prev[0]}" y1="${prev[1]}" x2="${x}" y2="${y}" stroke="${opts.color || "var(--brand)"}" stroke-width="1.6"/>`;
      dots += `<circle cx="${x}" cy="${y}" r="2.2" fill="${opts.color || "var(--brand)"}"/>`;
      dots += `<text x="${x}" y="${y - 4}" class="c-val">${opts.fmt ? opts.fmt(s.value) : s.value}</text>`;
      prev = [x, y];
    });
    return chartFrame(W, H, line + dots + labs);
  }

  function chartFrame(W, H, inner) {
    return `<svg viewBox="0 0 ${W} ${H}" class="mini-chart" preserveAspectRatio="xMidYMid meet">
      <style>
        .c-val{font-size:4.4px;fill:#1d2433;text-anchor:middle;font-weight:700}
        .c-lab{font-size:4.2px;fill:#6b7385;text-anchor:middle}
        .c-na{font-size:6px;fill:#aeb4c2;text-anchor:middle}
      </style>${inner}</svg>`;
  }

  global.Charts = { bars, trend };
})(window);
