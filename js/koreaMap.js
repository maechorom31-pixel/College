/* 대한민국 시·도(17) 단위 상세 지도 — 실제 행정구역 경계(GeoJSON 변환) 사용
   - 권역 색으로 칠하되 시·도 단위로 클릭/호버 가능
   - 외부 지도 API 불필요 (경로는 js/koreaGeo.js에 내장) */
(function (global) {
  const REGION_COLORS = {
    "수도권": "#4263eb", "중부권": "#15aabf", "영남권": "#f76707", "호남권": "#37b24d"
  };
  // 작은 광역시는 라벨이 겹치므로 지시선으로 바깥에 표기
  const OUTSIDE = {
    "서울": [-46, -6], "인천": [-40, -2], "세종": [40, -10],
    "대전": [44, 4], "광주": [-40, 6], "대구": [40, -4],
    "울산": [40, 2], "부산": [40, 8]
  };

  function buildKoreaMap(meta, sidoCounts, onSidoClick) {
    const geo = global.KOREA_GEO;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "koreaMap");
    svg.setAttribute("viewBox", geo.viewBox);
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "시·도별 대한민국 지도");

    const tip = document.createElementNS(NS, "g");
    tip.style.pointerEvents = "none"; tip.style.opacity = 0;

    geo.provinces.forEach(p => {
      const cnt = sidoCounts[p.name] || 0;
      const g = document.createElementNS(NS, "g");
      g.style.cursor = "pointer";
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${p.name} 대학 ${cnt}개`);

      const path = document.createElementNS(NS, "path");
      path.setAttribute("d", p.d);
      path.setAttribute("fill", REGION_COLORS[p.region]);
      path.setAttribute("class", "prov");
      g.appendChild(path);

      // 라벨
      const out = OUTSIDE[p.name];
      const lx = p.label[0] + (out ? out[0] : 0);
      const ly = p.label[1] + (out ? out[1] : 0);
      if (out) {
        const ln = document.createElementNS(NS, "line");
        ln.setAttribute("x1", p.label[0]); ln.setAttribute("y1", p.label[1]);
        ln.setAttribute("x2", lx); ln.setAttribute("y2", ly - 4);
        ln.setAttribute("class", "lead");
        g.appendChild(ln);
      }
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", lx); t.setAttribute("y", ly);
      t.setAttribute("class", "prov-label" + (out ? " outside" : ""));
      t.textContent = p.name;
      g.appendChild(t);
      const tc = document.createElementNS(NS, "text");
      tc.setAttribute("x", lx); tc.setAttribute("y", ly + 15);
      tc.setAttribute("class", "prov-count" + (out ? " outside" : ""));
      tc.textContent = cnt;
      g.appendChild(tc);

      // 작은 광역시도 누를 수 있도록 라벨 위치에 큰 투명 클릭 영역 추가
      const hit = document.createElementNS(NS, "rect");
      hit.setAttribute("x", lx - 26); hit.setAttribute("y", ly - 12);
      hit.setAttribute("width", 52); hit.setAttribute("height", 30);
      hit.setAttribute("fill", "transparent");
      hit.setAttribute("pointer-events", "all");
      hit.style.cursor = "pointer";
      g.appendChild(hit);

      const fire = () => onSidoClick(p.name, p.region);
      g.addEventListener("click", fire);
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } });
      g.addEventListener("mouseenter", () => path.classList.add("hot"));
      g.addEventListener("mouseleave", () => path.classList.remove("hot"));
      svg.appendChild(g);
    });

    return svg;
  }

  global.buildKoreaMap = buildKoreaMap;
})(window);
