/* 권역 단위 대한민국 약식 지도(SVG) 생성기
   - 데이터가 시·도/권역 단위이므로 외부 지도 API 없이 자립형 SVG로 구성
   - 4개 권역을 한반도 배치에 맞춰 클릭 가능한 영역으로 표시 */
(function (global) {
  // 권역별 폴리곤(한반도 지리 배치 근사) + 라벨 좌표
  const ZONES = {
    "수도권": {
      poly: "92,52 186,46 200,104 156,134 96,122 70,84",
      label: [128, 92], color: "var(--r-수도권)"
    },
    "중부권": {
      poly: "190,56 292,78 300,172 224,190 186,150 180,98",
      label: [240, 128], color: "var(--r-중부권)"
    },
    "영남권": {
      poly: "240,182 308,202 302,304 256,350 216,302 224,200",
      label: [264, 262], color: "var(--r-영남권)"
    },
    "호남권": {
      poly: "94,150 178,166 212,236 176,332 118,312 96,224",
      label: [148, 244], color: "var(--r-호남권)"
    }
  };

  function buildKoreaMap(meta, onRegionClick) {
    const stats = meta.regionStats || {};
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("id", "koreaMap");
    svg.setAttribute("viewBox", "0 0 370 430");
    svg.setAttribute("role", "group");
    svg.setAttribute("aria-label", "권역별 지도");

    Object.entries(ZONES).forEach(([region, z]) => {
      const st = stats[region] || { colleges: 0, depts: 0 };
      const g = document.createElementNS(NS, "g");
      g.style.cursor = "pointer";
      g.setAttribute("data-region", region);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `${region} 대학 ${st.colleges}개`);

      const poly = document.createElementNS(NS, "polygon");
      poly.setAttribute("class", "region-zone");
      poly.setAttribute("points", z.poly);
      poly.setAttribute("fill", z.color);
      g.appendChild(poly);

      const t1 = document.createElementNS(NS, "text");
      t1.setAttribute("class", "zone-label");
      t1.setAttribute("x", z.label[0]); t1.setAttribute("y", z.label[1]);
      t1.textContent = region;
      g.appendChild(t1);

      const t2 = document.createElementNS(NS, "text");
      t2.setAttribute("class", "zone-count");
      t2.setAttribute("x", z.label[0]); t2.setAttribute("y", z.label[1] + 18);
      t2.textContent = `${st.colleges}개 대학`;
      g.appendChild(t2);

      const fire = () => onRegionClick(region);
      g.addEventListener("click", fire);
      g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(); } });
      svg.appendChild(g);
    });

    // 제주 표시(호남권 소속) — 작은 섬
    const jeju = document.createElementNS(NS, "g");
    jeju.setAttribute("data-region", "호남권");
    jeju.style.cursor = "pointer";
    const jc = document.createElementNS(NS, "ellipse");
    jc.setAttribute("cx", 150); jc.setAttribute("cy", 388);
    jc.setAttribute("rx", 30); jc.setAttribute("ry", 15);
    jc.setAttribute("class", "region-zone");
    jc.setAttribute("fill", "var(--r-호남권)");
    jeju.appendChild(jc);
    const jt = document.createElementNS(NS, "text");
    jt.setAttribute("class", "jeju-note"); jt.setAttribute("x", 150); jt.setAttribute("y", 392);
    jt.setAttribute("fill", "#fff"); jt.setAttribute("font-size", "11");
    jt.textContent = "제주";
    jeju.appendChild(jt);
    jeju.addEventListener("click", () => onRegionClick("호남권"));
    svg.appendChild(jeju);

    return svg;
  }

  global.buildKoreaMap = buildKoreaMap;
})(window);
