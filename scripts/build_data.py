#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
전문대 입시 자료집(xlsx) -> 사이트용 JSON 변환 파이프라인
출력: data/colleges.json, data/departments.json, data/meta.json
"""
import openpyxl, json, os

SRC = os.path.join(os.path.dirname(__file__), "..", "data", "source.xlsx")
OUT = os.path.join(os.path.dirname(__file__), "..", "data")

# 권역 정규화 (시도 -> 권역)
SIDO_TO_REGION = {
    "서울": "수도권", "인천": "수도권", "경기": "수도권",
    "강원": "중부권", "대전": "중부권", "세종": "중부권", "충북": "중부권", "충남": "중부권",
    "대구": "영남권", "경북": "영남권", "부산": "영남권", "울산": "영남권", "경남": "영남권",
    "광주": "호남권", "전북": "호남권", "전남": "호남권", "제주": "호남권",
}

def num(v):
    """숫자 변환. None/빈값/문자 -> None"""
    if v is None: return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    s = str(v).strip().replace(",", "")
    if s in ("", "-", "미발표", "X", "x"): return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None

def s(v):
    if v is None: return None
    t = str(v).replace("\n", " ").strip()
    return t if t else None

def tuition(v):
    """등록금: 0 또는 빈값은 미개설 -> None (단위 천원)"""
    n = num(v)
    if n is None or n == 0: return None
    return int(n)

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)

# 입결은 전형 유형별(일반/일반고/특성화고/대학자체)로 분리돼 있음.
# 일반전형만 보면 절반이 비지만, 전형을 폴백하면 95% 채워짐 → 대표 입결을 뽑되 전형 라벨을 함께 보존.
# (track, 모집인원col, 경쟁률col, 평균col, 최저col)
BLOCKS_26 = [("일반", 12, 13, 14, 15), ("일반고", 16, 17, 18, 19),
             ("특성화고", 20, 21, 22, 23), ("대학자체", None, 24, 25, 26)]
BLOCKS_25 = [("일반", 27, 28, 29, 30), ("일반고", 31, 32, 33, 34), ("특성화고", 35, 36, 37, 38)]

def pick(r, blocks):
    """전형 유형을 우선순위대로 살펴 입결이 있는 첫 블록을 대표값으로."""
    for track, qc, cc, ac, mc in blocks:
        comp, avg, mn = num(r[cc]), num(r[ac]), num(r[mc])
        if comp is not None or avg is not None:
            return {"track": track, "quota": num(r[qc]) if qc is not None else None,
                    "comp": comp, "avg": avg, "min": mn}
    return {"track": None, "quota": None, "comp": None, "avg": None, "min": None}

# ---------- 1. 학과정보 시트 -> departments ----------
ws = wb["학과정보(2026 수시1차 입결 포함)"]
departments = []
for i, r in enumerate(ws.iter_rows(values_only=True)):
    if i < 5: continue
    name = s(r[5])
    unit = s(r[6])
    if not name or not unit: continue
    sido = s(r[3])
    region = SIDO_TO_REGION.get(sido, s(r[2]))
    p26 = pick(r, BLOCKS_26)
    p25 = pick(r, BLOCKS_25)
    dep = {
        "id": len(departments) + 1,
        "college": name,
        "region": region,
        "sido": sido,
        "location": s(r[4]),
        "unit": unit,
        "cat1": s(r[7]), "cat2": s(r[8]), "cat3": s(r[9]),
        "level": s(r[11]),
        # 입결 2026 수시1차 (전형 폴백, 대표 전형명 track26)
        "track26": p26["track"], "quota26": p26["quota"], "comp26": p26["comp"], "avg26": p26["avg"], "min26": p26["min"],
        # 입결 2025 수시1차
        "track25": p25["track"], "quota25": p25["quota"], "comp25": p25["comp"], "avg25": p25["avg"], "min25": p25["min"],
        # 내신 반영
        "reflectTerm": s(r[41]), "reflectSubj": s(r[42]),
        "deepen": s(r[44]),  # 전공심화
        # 대학 단위 지표 (학과행에도 들어있음)
        "employ": num(r[45]),  # 취업률 2024
        "fill": num(r[46]),    # 충원율 2025
    }
    departments.append(dep)

# ---------- 2. 취업률&충원율 시트 -> colleges ----------
ws2 = wb["대학별 취업률&충원율"]
colleges = {}
for i, r in enumerate(ws2.iter_rows(values_only=True)):
    if i < 4: continue
    name = s(r[3])
    if not name: continue
    sido = s(r[2])
    region = SIDO_TO_REGION.get(sido, s(r[1]))
    colleges[name] = {
        "name": name,
        "region": region,
        "sido": sido,
        "location": None,           # 학과 시트에서 보강
        "fillRate": {"2025": num(r[4]), "2024": num(r[5]), "2023": num(r[6])},
        "employRate": {"2024": num(r[7]), "2023": num(r[8]), "2022": num(r[9])},
        "tuition": {
            "인문사회": tuition(r[10]), "자연과학": tuition(r[11]),
            "공학": tuition(r[12]), "예체능": tuition(r[13]),
            "평균": tuition(r[14]),
        },
        "deptCount": 0,
        "cats": {},
    }

# ---------- 3. 학과 정보로 대학 보강 (소재지, 학과수, 계열) ----------
for d in departments:
    c = colleges.get(d["college"])
    if c is None:
        # 취업률 시트에 없는 대학도 학과 데이터로 생성
        c = colleges[d["college"]] = {
            "name": d["college"], "region": d["region"], "sido": d["sido"],
            "location": None, "fillRate": {}, "employRate": {}, "tuition": {},
            "deptCount": 0, "cats": {},
        }
    if not c["location"] and d["location"]:
        c["location"] = d["location"]
    if not c.get("sido"): c["sido"] = d["sido"]
    if not c.get("region"): c["region"] = d["region"]
    c["deptCount"] += 1
    if d["cat1"]:
        c["cats"][d["cat1"]] = c["cats"].get(d["cat1"], 0) + 1

colleges_list = sorted(colleges.values(), key=lambda x: (x["region"] or "", x["sido"] or "", x["name"]))

# ---------- 4. meta (필터 옵션 / 권역·시도 집계) ----------
region_order = ["수도권", "중부권", "영남권", "호남권"]
sido_by_region = {}
cat_tree = {}
for d in departments:
    if d["region"] and d["sido"]:
        sido_by_region.setdefault(d["region"], set()).add(d["sido"])
    if d["cat1"]:
        node = cat_tree.setdefault(d["cat1"], {})
        if d["cat2"]:
            sub = node.setdefault(d["cat2"], set())
            if d["cat3"]: sub.add(d["cat3"])

region_stats = {}
for rg in region_order:
    cs = [c for c in colleges_list if c["region"] == rg]
    region_stats[rg] = {
        "colleges": len(cs),
        "depts": sum(1 for d in departments if d["region"] == rg),
        "sidos": sorted(sido_by_region.get(rg, [])),
    }

meta = {
    "regions": region_order,
    "regionStats": region_stats,
    "cats": {k: {kk: sorted(vv) for kk, vv in v.items()} for k, v in cat_tree.items()},
    "totals": {"colleges": len(colleges_list), "depts": len(departments)},
    "source": "2027학년도 전국 전문대학 입시 자료집",
}

os.makedirs(OUT, exist_ok=True)
def dump(obj, fn):
    with open(os.path.join(OUT, fn), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {fn}: {os.path.getsize(os.path.join(OUT, fn))//1024} KB")

print("출력:")
dump(departments, "departments.json")
dump(colleges_list, "colleges.json")
dump(meta, "meta.json")
print(f"\n대학 {len(colleges_list)}개 / 학과 {len(departments)}개")
print("권역별:", {k: v["colleges"] for k, v in region_stats.items()})
