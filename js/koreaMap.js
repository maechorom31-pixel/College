/* 대한민국 시·도(17) 지도 — 실제 행정구역 경계(js/koreaGeo.js 내장)
   색은 "학과 수" 크기를 나타내는 단일 색상(파랑) 램프. 권역 정체성은 라벨과
   범례가 아니라 아래 권역 카드가 담당한다 — 색상 하나에 두 의미를 싣지 않는다. */
(function (global) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  // 작은 광역시는 라벨이 겹치므로 지시선으로 바깥에 표기
  const OUTSIDE = {
    "서울": [-46, -6], "인천": [-40, -2], "세종": [40, -10],
    "대전": [44, 4], "광주": [-40, 6], "대구": [40, -4],
    "울산": [40, 2], "부산": [40, 8]
  };

  /**
   * @param counts  {시도명: 수치}
   * @param onClick (시도명) => void
   * @param opts    {label: '학과', regionOf: {시도:권역}}
   */
  function buildKoreaMap(counts, onClick, opts) {
    const o = opts || {};
    const geo = global.KOREA_GEO;
    const C = global.Charts;
    const max = Math.max(1, ...Object.values(counts));

    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "koreaMap");
    svg.setAttribute("viewBox", geo.viewBox);
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", `시·도별 ${o.label || "학과"} 수 지도`);

    geo.provinces.forEach(p => {
      const cnt = counts[p.name] || 0;
      const t = Math.sqrt(cnt / max);            // 면적감 보정
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "prov-g");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${p.name} ${o.label || "학과"} ${cnt}개`);

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.d);
      path.setAttribute("fill", C.seq(t));
      path.setAttribute("class", "prov");
      const title = document.createElementNS(NS, "title");
      title.textContent = `${p.name} · ${o.label || "학과"} ${cnt.toLocaleString()}개`
        + (o.regionOf && o.regionOf[p.name] ? ` · ${o.regionOf[p.name]}` : "");
      g.appendChild(title);
      g.appendChild(path);

      const out = OUTSIDE[p.name];
      const lx = p.label[0] + (out ? out[0] : 0);
      const ly = p.label[1] + (out ? out[1] : 0);
      if (out) {
        const ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", p.label[0]); ln.setAttribute("y1", p.label[1]);
        ln.setAttribute("x2", lx); ln.setAttribute("y2", ly - 4);
        ln.setAttribute("class", "map-lead");
        g.appendChild(ln);
      }
      // 진한 칸은 흰 글씨로 (대비 확보)
      const darkFill = t > 0.62;
      const t1 = document.createElementNS(NS, "text");
      t1.setAttribute("x", lx); t1.setAttribute("y", ly);
      t1.setAttribute("class", "prov-label" + (out ? " outside" : darkFill ? " on-dark" : ""));
      t1.textContent = p.name;
      g.appendChild(t1);
      const t2 = document.createElementNS(NS, "text");
      t2.setAttribute("x", lx); t2.setAttribute("y", ly + 15);
      t2.setAttribute("class", "prov-count" + (out ? " outside" : darkFill ? " on-dark" : ""));
      t2.textContent = cnt.toLocaleString();
      g.appendChild(t2);

      const hit = document.createElementNS(NS, "rect");
      hit.setAttribute("x", lx - 26); hit.setAttribute("y", ly - 12);
      hit.setAttribute("width", 52); hit.setAttribute("height", 30);
      hit.setAttribute("fill", "transparent");
      hit.setAttribute("pointer-events", "all");
      g.appendChild(hit);

      const fire = () => onClick(p.name);
      g.addEventListener("click", fire);
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); }
      });
      svg.appendChild(g);
    });
    return svg;
  }

  /** 단일 색상 램프 범례 */
  function mapLegend(max, label) {
    const C = global.Charts;
    const steps = [0, .25, .5, .75, 1];
    return `<div class="map-legend">
      <span class="ml-lab">${label || "학과 수"}</span>
      <span class="ml-ramp">${steps.map(t => `<i style="background:${C.seq(t)}"></i>`).join("")}</span>
      <span class="ml-ends"><b>0</b><b>${Math.round(max).toLocaleString()}</b></span>
    </div>`;
  }

  global.buildKoreaMap = buildKoreaMap;
  global.mapLegend = mapLegend;
})(window);
