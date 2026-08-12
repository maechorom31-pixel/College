#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
2027 전문대 입시 자료집(xlsx) -> 사이트용 JSON 변환 파이프라인 (v2)

입력 : data/source.xlsx  (24개 시트)
출력 : data/*.json
  meta.json        필터 옵션 · 집계 · 인사이트 (즉시 로드)
  colleges.json    대학 127개: 취업률/충원율/등록금/일정/전형료/복수지원/주요학과/편입 (즉시)
  departments.json 학과 2,562개 핵심 + 대표 입결 (즉시)
  admissions.json  전형별 입결 8,561행 (지연 로드)
  jeongsi.json     정시·트랙별 입결(수능백분위 포함) (지연 로드)
  dept_info.json   학과소개/취업분야/취득자격증/혜택 (지연 로드)
  extras.json      지원자격·동점자·주문식교육과정·연계편입 상세 (지연 로드)
  univ.json        전문대 vs 일반대 비교 (지연 로드)
"""
import openpyxl, json, os, re, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "data", "source.xlsx")
OUT = os.path.join(HERE, "..", "data")

# ---------------------------------------------------------------- 공통 유틸
REGION_ORDER = ["수도권", "강원권", "충청권", "대구경북권", "부산울산경남권", "호남권", "제주권"]
# 시·도 -> 권역 (자료집 권역 구분을 그대로 따름)
SIDO_TO_REGION = {
    "서울": "수도권", "인천": "수도권", "경기": "수도권",
    "강원": "강원권",
    "대전": "충청권", "세종": "충청권", "충북": "충청권", "충남": "충청권",
    "대구": "대구경북권", "경북": "대구경북권",
    "부산": "부산울산경남권", "울산": "부산울산경남권", "경남": "부산울산경남권",
    "광주": "호남권", "전북": "호남권", "전남": "호남권",
    "제주": "제주권",
}
SIDO_ORDER = ["서울", "인천", "경기", "강원", "대전", "세종", "충북", "충남",
              "대구", "경북", "부산", "울산", "경남", "광주", "전북", "전남", "제주"]

NULLISH = {"", "-", "미발표", "x", "X", "해당없음", "없음", "#REF!", "#DIV/0!", "0000-00-00"}


def s(v):
    """문자열 정규화. 빈값/오류값 -> None"""
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d")
    t = " ".join(str(v).split())
    return None if t in NULLISH else t


def num(v):
    """숫자 변환. 변환 불가 -> None"""
    if v is None or isinstance(v, datetime.datetime):
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    t = str(v).strip().replace(",", "").replace("%", "")
    if t in NULLISH:
        return None
    try:
        return round(float(t), 2)
    except ValueError:
        return None


def pos(v):
    """0 이하는 '없음'으로 처리하는 숫자 (경쟁률·등록금 등)"""
    n = num(v)
    return None if n is None or n <= 0 else n


def sido_of(v):
    """'01서울' / '서울 ' -> '서울'"""
    t = s(v)
    if not t:
        return None
    t = re.sub(r"^\d+", "", t).strip()
    return t or None


def flag(v):
    """'O' 표기 -> True"""
    t = s(v)
    return bool(t) and t.upper() in ("O", "0O", "●", "V", "Y", "YES")


def key(college, unit):
    return f"{s(college)}|{s(unit)}"


def loose(t):
    """학과명 느슨한 매칭용 키: 괄호/기호/공백 제거"""
    if not t:
        return ""
    return re.sub(r"[\s()（）·・∙,.\-_/]|\(\d+\)", "", str(t))


print("원본 로드 중…")
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)


def rows(sheet, start):
    for i, r in enumerate(wb[sheet].iter_rows(values_only=True)):
        if i >= start:
            yield r


# ================================================================ 1. 학과 기본
print("[1/9] 학과정보")
departments = []          # 핵심(즉시 로드)
dept_info = {}            # 상세 텍스트(지연 로드)
by_key = {}               # "대학|모집단위" -> dept
loose_key = {}            # "대학|느슨한학과명" -> dept

for r in rows("학과정보", 4):
    college, unit = s(r[4]), s(r[5])
    if not (college and unit):
        continue
    sido = sido_of(r[2])
    d = {
        "id": len(departments) + 1,
        "college": college,
        "unit": unit,
        "region": SIDO_TO_REGION.get(sido) or s(r[1]),
        "sido": sido,
        "cat1": s(r[6]), "cat2": s(r[7]), "cat3": s(r[8]),
        "level": num(r[9]),          # 학제(년)
        "change": s(r[10]),          # 신설/변경/통합/분리
    }
    departments.append(d)
    k = key(college, unit)
    by_key[k] = d
    loose_key.setdefault(f"{college}|{loose(unit)}", d)
    info = {
        "intro": s(r[11]), "jobs": s(r[12]),
        "certs": s(r[13]), "support": s(r[14]),
    }
    if any(info.values()):
        dept_info[str(d["id"])] = info


def find_dept(college, unit):
    """학과 매칭: 정확 -> 느슨"""
    d = by_key.get(key(college, unit))
    if d:
        return d
    return loose_key.get(f"{s(college)}|{loose(unit)}")


# ================================================================ 2. 전형별 입결
print("[2/9] 2026 입결(전형별) — 수시")
# 컬럼: 4 대학명 5 모집시기 6 전형구분 7 전형유형 8 전형명 9 모집단위
#      11~13 대/중/소 14 학제 15 신설변경 16 모집인원
#      17~20 학생부/면접/실기/서류 21 활용지표 22 기준학기
#      26~28 경쟁률 2026/25/24  29~31 평균등급  32~34 최저등급
#      35~36 충원율 2025/24  37~38 취업률 2024/23
#      39 반영학기 40 반영과목 41 진로선택 43~45 학년별 46~48 교과/출결/기타
#      49 학생부최저 50 수능최저
admissions = []
for r in rows("2026입결_일반고", 4):
    college, unit = s(r[4]), s(r[9])
    if not (college and unit):
        continue
    d = find_dept(college, unit)
    a = {
        "did": d["id"] if d else None,
        "college": college, "unit": unit,
        "phase": s(r[5]),            # 수시1차 / 수시2차
        "gubun": s(r[6]),            # 일반 / 특별(정원내)
        "type": s(r[7]),             # 학생부 / 면접 / 실기 …
        "track": s(r[8]),            # 일반 / 일반고 / 특성화고 / 대학자체기준
        "quota": num(r[16]),
        "w": {"학생부": num(r[17]), "면접": num(r[18]), "실기": num(r[19]), "서류": num(r[20])},
        "comp": [pos(r[26]), pos(r[27]), pos(r[28])],   # 경쟁률 2026/2025/2024
        "avg":  [pos(r[29]), pos(r[30]), pos(r[31])],   # 최종등록자 평균등급
        "min":  [pos(r[32]), pos(r[33]), pos(r[34])],   # 최종등록자 최저등급
        "fill": [num(r[35]), num(r[36])],               # 충원율 2025/2024
        "employ": [num(r[37]), num(r[38])],             # 취업률 2024/2023
        "sb": {                                          # 학생부 반영방법
            "index": s(r[21]) or s(r[42]),               # 활용지표
            "baseTerm": s(r[22]),                        # 기준학기
            "useTerm": s(r[39]),                         # 반영학기
            "subject": s(r[40]),                         # 반영과목
            "career": s(r[41]),                          # 진로선택
            "grade": [num(r[43]), num(r[44]), num(r[45])],   # 1/2/3학년 비율
            "item": [num(r[46]), num(r[47]), num(r[48])],    # 교과/출결/기타
        },
        "minStd": s(r[50]),          # 수능최저
    }
    # 빈 가중치 정리
    a["w"] = {k2: v for k2, v in a["w"].items() if v}
    admissions.append(a)

# ---- 학과별 대표 입결 요약(즉시 로드용)
TRACK_ORDER = ["일반", "일반고", "특성화고", "대학자체기준"]
by_dept_adm = {}
for a in admissions:
    if a["did"]:
        by_dept_adm.setdefault(a["did"], []).append(a)


def summarize(adms):
    """학과 카드에 보여줄 대표 입결. 수시1차 > 일반/일반고 우선."""
    def rank(a):
        return (0 if a["phase"] == "수시1차" else 1,
                TRACK_ORDER.index(a["track"]) if a["track"] in TRACK_ORDER else 9)
    pick = None
    for a in sorted(adms, key=rank):
        if a["comp"][0] is not None or a["avg"][0] is not None:
            pick = a
            break
    if pick is None and adms:
        pick = sorted(adms, key=rank)[0]
    if pick is None:
        return {}
    quota = sum(a["quota"] or 0 for a in adms if a["phase"] == "수시1차")
    # 3개년 경쟁률 추세: 2024 -> 2026 변화율
    c26, c25, c24 = pick["comp"]
    trend = None
    if c26 and c24:
        trend = round((c26 - c24) / c24 * 100, 1)
    return {
        "track": pick["track"], "phase": pick["phase"],
        "quota": round(quota) if quota else pick["quota"],
        "comp": pick["comp"], "avg": pick["avg"], "min": pick["min"],
        "trend": trend,
        "nTrack": len({a["track"] for a in adms if a["track"]}),
    }


# 트랙별 대표 등급(전형 유형 비교용)
def track_grades(adms):
    out = {}
    for a in adms:
        if a["phase"] != "수시1차" or not a["track"]:
            continue
        if a["avg"][0] is not None or a["comp"][0] is not None:
            out.setdefault(a["track"], {"avg": a["avg"][0], "min": a["min"][0],
                                        "comp": a["comp"][0], "quota": a["quota"]})
    return out


for d in departments:
    adms = by_dept_adm.get(d["id"], [])
    d["ipgyeol"] = summarize(adms)
    d["tracks"] = track_grades(adms)
    if adms:
        d["employ"] = next((a["employ"][0] for a in adms if a["employ"][0] is not None), None)
        d["fill"] = next((a["fill"][0] for a in adms if a["fill"][0] is not None), None)
    else:
        d["employ"] = d["fill"] = None

# ================================================================ 3. 정시·트랙별 입결
print("[3/9] 정시·트랙별 입결(수능백분위)")
# 컬럼: 4 대학명 5 모집시기 6 모집단위 7~9 분류 11 모집인원
#      트랙 5개 x (경쟁률, 교과평균, 교과최저, 수능평균, 수능최저)
TRACK_COLS = [("일반", 12), ("일반고", 17), ("특성화고", 22), ("대학자체", 27), ("고른기회", 32)]
jeongsi = []
for r in rows("2026입결_특성화고", 5):
    college, unit = s(r[4]), s(r[6])
    if not (college and unit):
        continue
    d = find_dept(college, unit)
    tracks = {}
    for name, c0 in TRACK_COLS:
        comp, ga, gm, sa, sm = (pos(r[c0]), pos(r[c0 + 1]), pos(r[c0 + 2]),
                                pos(r[c0 + 3]), pos(r[c0 + 4]))
        if any(v is not None for v in (comp, ga, gm, sa, sm)):
            tracks[name] = {"comp": comp, "gAvg": ga, "gMin": gm, "sAvg": sa, "sMin": sm}
    if not tracks:
        continue
    jeongsi.append({
        "did": d["id"] if d else None,
        "college": college, "unit": unit,
        "phase": s(r[5]),
        "quota": num(r[11]),
        "tracks": tracks,
    })

# 학과별 정시 보유 여부 + 수능백분위
jeongsi_by_dept = {}
for j in jeongsi:
    if j["did"] and j["phase"] == "정시모집":
        jeongsi_by_dept.setdefault(j["did"], []).append(j)
for d in departments:
    js = jeongsi_by_dept.get(d["id"], [])
    suneung = None
    for j in js:
        for t in j["tracks"].values():
            if t["sAvg"]:
                suneung = t["sAvg"]
                break
        if suneung:
            break
    d["jeongsi"] = bool(js)
    d["suneung"] = suneung

# ================================================================ 4. 대학 지표
print("[4/9] 대학별 취업률·충원율·등록금")
colleges = {}


def ensure(name, region=None, sido=None):
    c = colleges.get(name)
    if c is None:
        c = colleges[name] = {
            "name": name, "region": region, "sido": sido, "location": None,
            "fillRate": {}, "employRate": {}, "tuition": {},
            "fee": {"list": [], "min": None, "max": None, "free": False},
            "schedule": {}, "dup": None, "tie": [], "majors": {},
            "transfer": {"targets": [], "note": None, "count": 0},
            "nurse": False, "teaching": False, "ptChange": False,
            "deptCount": 0, "cats": {}, "orderCount": 0,
        }
    if region and not c["region"]:
        c["region"] = region
    if sido and not c["sido"]:
        c["sido"] = sido
    return c


for r in rows("대학별 취업률&충원율", 4):
    name = s(r[3])
    if not name:
        continue
    sido = sido_of(r[2])
    c = ensure(name, SIDO_TO_REGION.get(sido) or s(r[1]), sido)
    c["fillRate"] = {"2025": num(r[4]), "2024": num(r[5]), "2023": num(r[6])}
    c["employRate"] = {"2024": num(r[7]), "2023": num(r[8]), "2022": num(r[9])}
    c["tuition"] = {"인문사회": pos(r[10]), "자연과학": pos(r[11]), "공학": pos(r[12]),
                    "예체능": pos(r[13]), "평균": pos(r[14])}

# 소재지(시·군·구) — 전문대 분포 시트(8개 지역 블록 x 3열)
for r in rows("전문대 분포", 3):
    for c0 in range(0, 24, 3):
        name, loc = s(r[c0 + 1]) if c0 + 1 < len(r) else None, s(r[c0 + 2]) if c0 + 2 < len(r) else None
        if name:
            c = ensure(name)
            if loc and not c["location"]:
                c["location"] = loc

# ================================================================ 5. 전형 일정
print("[5/9] 전형일정")


def daterange(a, b):
    a, b = s(a), s(b)
    if a and b:
        return a if a == b else f"{a} ~ {b}"
    return a or b


for r in rows("전형일정", 3):
    name = s(r[3])
    if not name:
        continue
    sido = sido_of(r[2])
    c = ensure(name, SIDO_TO_REGION.get(sido) or s(r[1]), sido)
    phase = s(r[4])
    if not phase:
        continue
    c["schedule"][phase] = {
        "apply": s(r[5]),
        "interview": daterange(r[6], r[7]),
        "practical": daterange(r[8], r[9]),
        "result": s(r[10]),
        "enroll": s(r[11]),
        "extra": s(r[12]),
    }

# ================================================================ 6. 전형료 · 복수지원 · 동점자
print("[6/9] 전형료 · 복수지원 · 동점자")
for r in rows("대학별 전형료", 3):
    name = s(r[3])
    if not name:
        continue
    c = ensure(name)
    fee = num(r[5])
    if fee:
        c["fee"]["list"].append({"type": s(r[4]), "won": int(fee)})

for r in rows("전형료 무료", 3):
    name = s(r[3])
    if not name:
        continue
    c = ensure(name)
    c["fee"]["free"] = bool(s(r[4]) or s(r[5]))
    c["fee"]["freeNote"] = " / ".join(x for x in (s(r[4]), s(r[5])) if x) or None

for c in colleges.values():
    fees = [f["won"] for f in c["fee"]["list"]]
    if fees:
        c["fee"]["min"], c["fee"]["max"] = min(fees), max(fees)

for r in rows("복수지원", 5):
    name = s(r[3])
    if not name:
        continue
    c = ensure(name)
    c["dup"] = {
        "blocked": flag(r[4]),
        "limitType": s(r[6]), "times": s(r[7]), "sameDept": s(r[8]),
        "note": s(r[9]),
    }

for r in rows("동점자처리기준", 4):
    name = s(r[3])
    if not name:
        continue
    c = ensure(name)
    ranks = [s(r[i]) for i in range(5, 10)]
    ranks = [x for x in ranks if x]
    if ranks:
        c["tie"].append({"type": s(r[4]), "ranks": ranks})

# ================================================================ 7. 주요학과 · 간호/교직 · 편입 · 물치
print("[7/9] 주요학과 개설 · 간호/교직 · 연계편입")
MAJOR_COLS = {}
for i, r in enumerate(wb["주요학과 개설현황"].iter_rows(values_only=True)):
    if i == 2:
        for j in range(5, 31):
            t = s(r[j])
            if t:
                MAJOR_COLS[j] = t
        break

for r in rows("주요학과 개설현황", 4):
    name = s(r[0])
    if not name:
        continue
    base = name.split("(")[0]
    c = colleges.get(name) or colleges.get(base) or ensure(name)
    if not c["location"] and s(r[4]):
        c["location"] = s(r[4])
    for j, label in MAJOR_COLS.items():
        if j < len(r) and flag(r[j]):
            c["majors"][label] = True

# 간호학과 개설 & 교직과정 (8개 지역 블록, 블록마다 열 수가 다름)
NURSE_BLOCKS = [(1, 3), (5, 7), (9, 10), (12, 13), (15, 16), (18, 19), (21, 22), (24, 25)]
for r in rows("간호학과 개설대학&교직과정 개설대학", 2):
    for ncol, tcol in NURSE_BLOCKS:
        if ncol >= len(r):
            continue
        name = s(r[ncol])
        if not name:
            continue
        c = colleges.get(name) or colleges.get(name.split("(")[0])
        if not c:
            continue
        c["nurse"] = True
        if tcol < len(r) and flag(r[tcol]):
            c["teaching"] = True

for r in rows("물리치료 학제변경", 3):
    name = s(r[3])
    if name and name in colleges:
        colleges[name]["ptChange"] = True

# 연계편입 요약 (대학별 편입 가능 4년제)
TRANSFER_COLS = {}
for i, r in enumerate(wb["연계편입 요약"].iter_rows(values_only=True)):
    if i == 6:
        for j in range(3, 14):
            t = s(r[j])
            if t:
                TRANSFER_COLS[j] = t
        break

for r in rows("연계편입 요약", 8):
    name = s(r[2])
    if not name:
        continue
    c = colleges.get(name) or colleges.get(name.split("(")[0])
    if not c:
        continue
    for j, label in TRANSFER_COLS.items():
        if j < len(r) and flag(r[j]):
            c["transfer"]["targets"].append(label)
    if len(r) > 14 and s(r[14]):
        c["transfer"]["note"] = s(r[14])

# 연계편입 상세 (학과별)
transfer_detail = []
for r in rows("연계편입", 2):
    name, unit = s(r[2]), s(r[3])
    if not name:
        continue
    tgt = s(r[4])
    if not tgt or unit == "해당없음":
        continue
    d = find_dept(name, unit) if unit else None
    transfer_detail.append({
        "did": d["id"] if d else None,
        "college": name, "unit": unit,
        "targets": tgt, "method": s(r[5]),
    })
    c = colleges.get(name)
    if c:
        c["transfer"]["count"] += 1

transfer_by_dept = {}
for t in transfer_detail:
    if t["did"]:
        transfer_by_dept.setdefault(t["did"], []).append(t)

# ================================================================ 8. 주문식 교육과정 · 지원자격
print("[8/9] 주문식(채용약정) 교육과정 · 지원자격")
order_by_dept, order_rows = {}, []
for r in rows("주문대 교육과정(입학처제공자료)", 2):
    name, unit = s(r[4]), s(r[5])
    if not (name and unit):
        continue
    firms = s(r[6])
    if not firms:
        continue
    d = find_dept(name, unit)
    rec = {"did": d["id"] if d else None, "college": name, "unit": unit, "firms": firms}
    order_rows.append(rec)
    if d:
        order_by_dept.setdefault(d["id"], []).append(rec)
    c = colleges.get(name)
    if c:
        c["orderCount"] += 1

order_public = []
for r in rows("주문식교육과정(정보공시자료)", 3):
    name = s(r[4])
    if not name:
        continue
    order_public.append({
        "college": name, "cat": s(r[5]), "course": s(r[6]),
        "runType": s(r[7]), "hireType": s(r[8]), "dept": s(r[9]),
        "students": num(r[10]), "promised": num(r[11]), "firms": num(r[12]),
        "grads": num(r[13]), "hiredPromised": num(r[14]), "hiredOther": num(r[15]),
        "burdenFirm": num(r[16]), "burdenGov": num(r[17]),
        "burdenSchool": num(r[18]), "burdenStudent": num(r[19]),
    })

qualify = {}
for r in rows("지원자격", 4):
    name, track = s(r[4]), s(r[5])
    if not (name and track):
        continue
    q = qualify.setdefault(name, {})
    if track in q:
        continue
    q[track] = {"who": s(r[6]), "detail": (s(r[7]) or "")[:600]}

# 수능최저 적용 대학·학과
suneung_min = []
for r in rows("수능최저", 4):
    name = s(r[3])
    if not name:
        continue
    suneung_min.append({
        "college": name, "sido": sido_of(r[2]), "track": s(r[4]), "unit": s(r[5]),
        "std": s(r[7]) or s(r[6]),
        "w": {"학생부": num(r[8]), "면접": num(r[9])},
        "useTerm": s(r[10]), "subject": s(r[11]),
    })
suneung_colleges = {x["college"] for x in suneung_min}

# ================================================================ 9. 전문대 vs 일반대
print("[9/9] 전문대 vs 일반대 비교")
univ = []
for r in rows("전문대+일반대", 4):
    name = s(r[7])
    if not name:
        continue
    avg, mn = pos(r[14]), pos(r[16])
    if avg is None and mn is None:
        continue
    sido = sido_of(r[2])
    univ.append({
        "kind": s(r[6]),                 # 전문대 / 일반대
        "college": name, "unit": s(r[8]),
        "region": SIDO_TO_REGION.get(sido) or s(r[1]), "sido": sido,
        "cat1": s(r[3]), "cat2": s(r[4]), "cat3": s(r[5]),
        "level": num(r[9]),
        "type": s(r[10]), "track": s(r[11]) or s(r[12]),
        "quota": num(r[13]),
        "avg": avg, "min": mn,
        "w": {k2: v for k2, v in
              zip(("학생부", "면접", "실기", "서류"), (num(r[17]), num(r[18]), num(r[19]), num(r[20]))) if v},
        "useTerm": s(r[21]), "subject": s(r[22]), "minStd": s(r[23]),
        "employ": num(r[25]),
    })

# ---- 대학 보강: 학과 수 · 계열 · 소재지
for d in departments:
    c = ensure(d["college"], d["region"], d["sido"])
    c["deptCount"] += 1
    if d["cat1"]:
        c["cats"][d["cat1"]] = c["cats"].get(d["cat1"], 0) + 1
for c in colleges.values():
    c["suneungMin"] = c["name"] in suneung_colleges
    c["transfer"]["targets"] = sorted(set(c["transfer"]["targets"]))
    c["majorList"] = sorted(c["majors"].keys())
    del c["majors"]

# 자료가 전혀 없는 이름(자료집 분포표에만 등장)은 제외
def has_data(c):
    return bool(c["deptCount"] or c["employRate"].get("2024") or c["schedule"] or c["fee"]["list"])


dropped = [c["name"] for c in colleges.values() if not has_data(c)]
colleges = {k: v for k, v in colleges.items() if has_data(v)}

# 분교(캠퍼스)는 대학 단위 지표(취업률·충원율·등록금)를 본교에서 상속
for c in colleges.values():
    if "(" not in c["name"]:
        c["campusOf"] = None
        continue
    parent = colleges.get(c["name"].split("(")[0])
    c["campusOf"] = parent["name"] if parent else None
    if not parent:
        continue
    for fld in ("fillRate", "employRate", "tuition"):
        if not any(v is not None for v in c[fld].values()):
            c[fld] = dict(parent[fld])
            c["inherited"] = True

colleges_list = sorted(colleges.values(),
                       key=lambda x: (REGION_ORDER.index(x["region"]) if x["region"] in REGION_ORDER else 9,
                                      SIDO_ORDER.index(x["sido"]) if x["sido"] in SIDO_ORDER else 99,
                                      x["name"]))

# ---- 학과에 대학 지표 · 태그 부착
col_by_name = {c["name"]: c for c in colleges_list}
for d in departments:
    c = col_by_name.get(d["college"])
    if c:
        if d["employ"] is None:
            d["employ"] = c["employRate"].get("2024")
        if d["fill"] is None:
            d["fill"] = c["fillRate"].get("2025")
        d["tuition"] = c["tuition"].get(
            {"인문사회": "인문사회", "자연": "자연과학", "공학": "공학",
             "예체능": "예체능"}.get(d["cat1"], "평균")) or c["tuition"].get("평균")
        if not c["location"]:
            pass
        d["location"] = c["location"]
    d["order"] = len(order_by_dept.get(d["id"], []))
    d["transfer"] = len(transfer_by_dept.get(d["id"], []))

# ================================================================ meta · 인사이트
cat_tree = {}
for d in departments:
    if d["cat1"]:
        n1 = cat_tree.setdefault(d["cat1"], {})
        if d["cat2"]:
            n2 = n1.setdefault(d["cat2"], set())
            if d["cat3"]:
                n2.add(d["cat3"])

sido_by_region = {}
for d in departments:
    if d["region"] and d["sido"]:
        sido_by_region.setdefault(d["region"], set()).add(d["sido"])

region_stats = {}
for rg in REGION_ORDER:
    region_stats[rg] = {
        "colleges": sum(1 for c in colleges_list if c["region"] == rg),
        "depts": sum(1 for d in departments if d["region"] == rg),
        "sidos": sorted(sido_by_region.get(rg, []), key=lambda x: SIDO_ORDER.index(x) if x in SIDO_ORDER else 99),
    }

sido_stats = {}
for sd in SIDO_ORDER:
    sido_stats[sd] = {
        "colleges": sum(1 for c in colleges_list if c["sido"] == sd),
        "depts": sum(1 for d in departments if d["sido"] == sd),
        "region": SIDO_TO_REGION.get(sd),
    }


def avg_of(vals):
    vals = [v for v in vals if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


# 인사이트 1: 계열별 평균 등급/경쟁률/취업률
cat_insight = {}
for d in departments:
    if not d["cat1"]:
        continue
    b = cat_insight.setdefault(d["cat1"], {"grade": [], "comp": [], "employ": [], "tuition": [], "n": 0})
    b["n"] += 1
    ip = d.get("ipgyeol") or {}
    if ip.get("avg") and ip["avg"][0]:
        b["grade"].append(ip["avg"][0])
    if ip.get("comp") and ip["comp"][0]:
        b["comp"].append(ip["comp"][0])
    if d["employ"]:
        b["employ"].append(d["employ"])
    if d.get("tuition"):
        b["tuition"].append(d["tuition"])
cat_insight = {k: {"n": v["n"], "grade": avg_of(v["grade"]), "comp": avg_of(v["comp"]),
                   "employ": avg_of(v["employ"]), "tuition": avg_of(v["tuition"])}
               for k, v in cat_insight.items()}

# 인사이트 2: 전형 트랙별 평균 등급 (같은 학과, 트랙 따라 유불리)
track_insight = {}
for a in admissions:
    if a["phase"] != "수시1차" or not a["track"]:
        continue
    b = track_insight.setdefault(a["track"], {"grade": [], "comp": [], "quota": 0, "n": 0})
    b["n"] += 1
    b["quota"] += a["quota"] or 0
    if a["avg"][0]:
        b["grade"].append(a["avg"][0])
    if a["comp"][0]:
        b["comp"].append(a["comp"][0])
track_insight = {k: {"n": v["n"], "quota": round(v["quota"]), "grade": avg_of(v["grade"]),
                     "comp": avg_of(v["comp"])} for k, v in track_insight.items()}

# 인사이트 3: 경쟁률이 3년째 내려가는 학과 (모집인원 10명 이상, 이상치 제외)
def falling_ok(d):
    ip = d.get("ipgyeol") or {}
    c26, c25, c24 = (ip.get("comp") or [None, None, None])
    if None in (c26, c24) or ip.get("trend") is None:
        return False
    return (c26 >= 1.0 and c24 >= 3.0 and -85 <= ip["trend"] <= -25
            and (ip.get("quota") or 0) >= 10)


falling = sorted([d for d in departments if falling_ok(d)],
                 key=lambda d: d["ipgyeol"]["trend"])[:40]

# 인사이트 4: 등급 대비 취업률이 좋은 학과 (가성비 · 모집 10명 이상)
value_picks = sorted(
    [d for d in departments
     if d["employ"] and d["employ"] >= 80
     and (d.get("ipgyeol") or {}).get("avg") and d["ipgyeol"]["avg"][0]
     and (d["ipgyeol"].get("quota") or 0) >= 10],
    key=lambda d: (-(d["employ"] or 0) + d["ipgyeol"]["avg"][0] * 3))[:40]

meta = {
    "source": "2027학년도 전국 전문대학 입시 자료집 (한국전문대학교육협의회)",
    "built": datetime.date.today().isoformat(),
    "regions": REGION_ORDER,
    "sidoOrder": SIDO_ORDER,
    "regionStats": region_stats,
    "sidoStats": sido_stats,
    "cats": {k: {kk: sorted(vv) for kk, vv in v.items()} for k, v in sorted(cat_tree.items())},
    "majors": sorted(set(MAJOR_COLS.values())),
    "transferTargets": sorted(set(TRANSFER_COLS.values())),
    "tracks": TRACK_ORDER,
    "totals": {
        "colleges": len(colleges_list),
        "depts": len(departments),
        "admissions": len(admissions),
        "jeongsi": len(jeongsi),
        "transfer": len(transfer_detail),
        "order": len(order_rows),
        "univ": sum(1 for u in univ if u["kind"] == "일반대"),
        "univColleges": len({u["college"] for u in univ if u["kind"] == "일반대"}),
    },
    "insights": {
        "byCat": cat_insight,
        "byTrack": track_insight,
        "falling": [{"id": d["id"], "college": d["college"], "unit": d["unit"],
                     "cat1": d["cat1"], "sido": d["sido"],
                     "trend": d["ipgyeol"]["trend"], "comp": d["ipgyeol"]["comp"]} for d in falling],
        "value": [{"id": d["id"], "college": d["college"], "unit": d["unit"],
                   "cat1": d["cat1"], "sido": d["sido"],
                   "employ": d["employ"], "avg": d["ipgyeol"]["avg"][0]} for d in value_picks],
    },
}

# ================================================================ 출력
os.makedirs(OUT, exist_ok=True)


def dump(obj, fn):
    p = os.path.join(OUT, fn)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {fn:20s} {os.path.getsize(p)/1024:8.0f} KB")


print("\n출력:")
dump(meta, "meta.json")
dump(colleges_list, "colleges.json")
dump(departments, "departments.json")
dump(admissions, "admissions.json")
dump(jeongsi, "jeongsi.json")
dump(dept_info, "dept_info.json")
dump(univ, "univ.json")
dump({
    "qualify": qualify,
    "transfer": transfer_detail,
    "order": order_rows,
    "orderPublic": order_public,
    "suneungMin": suneung_min,
}, "extras.json")

print(f"\n대학 {len(colleges_list)}개 · 학과 {len(departments):,}개 · 전형 {len(admissions):,}건")
if dropped:
    print("자료 없어 제외:", dropped)
print("권역별 대학:", {k: v["colleges"] for k, v in region_stats.items()})
print("계열별 학과:", {k: v["n"] for k, v in cat_insight.items()})
