#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bazi-classic.py — 三命通会 + 经典八字分析（基于 china-testing/bazi 数据模块）

用法: python3 bazi-classic.py --solar "YYYY-MM-DD" --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace "城市名"
输出: JSON 到 stdout，日志到 stderr
"""

from calendar_basis import calendar_basis
import sys
import os
import json
import argparse
import subprocess
import collections
import re
import calendar
import hashlib

# 引入 vendor/bazi 的数据模块（导入前校验完整性，防止被篡改的数据模块被静默加载）
VENDOR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vendor', 'bazi')
_VENDOR_HASHES = {
    "datas.py": "c2b10688e94046902979f8dacc2506c136951e5d1354c92763c9b93041e3436e",
    "sizi.py": "ab23ea4c2d83c5060aa4994f275858be3801dc9a0f4db9d78b3282c3f4259052",
    "yue.py": "3933e724f592bc9cbcb49eefda1052d23a7c58c48c2756b64e30fc10eb88cbc2",
}
for _vendor_file, _expected_sha256 in _VENDOR_HASHES.items():
    with open(os.path.join(VENDOR_DIR, _vendor_file), "rb") as _f:
        _actual_sha256 = hashlib.sha256(_f.read()).hexdigest()
    if _actual_sha256 != _expected_sha256:
        sys.exit(f"[bazi-classic] vendor/bazi/{_vendor_file} 完整性校验失败，拒绝加载不可信数据模块")
sys.path.insert(0, VENDOR_DIR)

from lunar_python import Lunar, Solar
from datas import (
    ten_deities, gan5, zhi5, zhi5_list, Gan, Zhi,
    year_shens, month_shens, day_shens, g_shens,
    zhi_atts, nayins, siling, temps, xiuqius,
    relations, zhi_wuhangs, wangs, jieshas,
    gan_hes, gan_zangs, zhi_zangs, zangs as zangs_template,
    zhi_6hes, zhi_chongs, zhi_3hes, zhi_half_3hes,
    zhi_xings, zhi_zixings, gan_chongs
)
from sizi import summarys
from yue import months


def fail(error, message, input_str=""):
    json.dump({"error": error, "message": message, "input": input_str},
              sys.stdout, ensure_ascii=False, indent=2)
    print()
    sys.exit(1)


def parse_solar_date(date_str):
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str or ''):
        fail("invalid_date", "日期格式错误，请使用 YYYY-MM-DD", date_str)
    year, month, day = map(int, date_str.split('-'))
    if month < 1 or month > 12:
        fail("invalid_date", "日期不存在，请检查年月日", date_str)
    _, max_day = calendar.monthrange(year, month)
    if day < 1 or day > max_day:
        fail("invalid_date", "日期不存在，请检查年月日", date_str)
    return year, month, day


def parse_args():
    parser = argparse.ArgumentParser(description='八字经典分析')
    parser.add_argument('--solar', required=True, help='阳历日期 YYYY-MM-DD')
    parser.add_argument('--hour', required=True, type=int, help='出生时辰 0-23')
    parser.add_argument('--minute', default=0, type=int, help='出生分钟 0-59')
    parser.add_argument('--gender', required=True, choices=['male', 'female'], help='性别')
    parser.add_argument('--birthplace', required=True, help='出生地城市名')
    args = parser.parse_args()
    if args.hour < 0 or args.hour > 23:
        fail("invalid_hour", "--hour 必须为 0-23 的整数", str(args.hour))
    if args.minute < 0 or args.minute > 59:
        fail("invalid_minute", "--minute 必须为 0-59 的整数", str(args.minute))
    return args


def normalize_time(solar_date, hour, minute, birthplace):
    """调用 time-normalize.mjs 进行时间校正"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(script_dir, 'time-normalize.mjs')
    try:
        result = subprocess.run(
            [os.environ.get('NODE', 'node'), script_path, '--solar', solar_date, '--hour', str(hour),
             '--minute', str(minute), '--birthplace', birthplace],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout.strip())
    except Exception as e:
        print(f"[bazi-classic] 时间校正失败: {e}", file=sys.stderr)
    return None


def calc_five_element_scores(gans, zhis):
    scores = {"金": 0, "木": 0, "水": 0, "火": 0, "土": 0}
    gan_scores = {g: 0 for g in "甲乙丙丁戊己庚辛壬癸"}
    for g in gans:
        scores[gan5[g]] += 5
        gan_scores[g] += 5
    zhi_list = list(zhis) + [zhis[1]]
    for z in zhi_list:
        for gan, val in zhi5[z].items():
            scores[gan5[gan]] += val
            gan_scores[gan] += val
    return scores, gan_scores


def calc_strength(scores, me_wuxing, month_zhi):
    me_score = scores[me_wuxing]
    total = sum(scores.values())
    has_root = me_score > 0
    wang_elements = wangs.get(month_zhi, [])
    de_ling = me_wuxing in wang_elements
    return {
        "score": me_score,
        "total": total,
        "hasRoot": has_root,
        "deLing": de_ling,
        "strong": me_score >= total * 0.3 if total > 0 else False,
        "label": "身强" if me_score >= total * 0.3 else "身弱"
    }


def get_ten_deity(me, other):
    if me == other:
        return "比肩"
    return ten_deities.get(me, {}).get(other, "")


def get_zhi_shens(me, zhi):
    result = []
    cang = zhi5.get(zhi, {})
    for gan in cang:
        deity = get_ten_deity(me, gan)
        result.append({"gan": gan, "deity": deity, "score": cang[gan]})
    return result


def get_clashes(gans_obj, zhis_obj):
    """获取冲刑合会关系"""
    result = []
    all_zhis = [zhis_obj.year, zhis_obj.month, zhis_obj.day, zhis_obj.time]
    all_gans = [gans_obj.year, gans_obj.month, gans_obj.day, gans_obj.time]
    zhi_names = ['年支', '月支', '日支', '时支']
    gan_names = ['年干', '月干', '日干', '时干']

    # 地支六合
    for combo_str, hua in zhi_6hes.items():
        c0, c1 = combo_str[0], combo_str[1]
        for i in range(len(all_zhis)):
            for j in range(i + 1, len(all_zhis)):
                if (all_zhis[i] == c0 and all_zhis[j] == c1) or \
                   (all_zhis[i] == c1 and all_zhis[j] == c0):
                    result.append({
                        "type": "六合",
                        "positions": [zhi_names[i], zhi_names[j]],
                        "zhis": [all_zhis[i], all_zhis[j]],
                        "description": f"{c0}{c1}合化{hua}"
                    })

    # 地支六冲
    for (c0, c1), desc in zhi_chongs.items():
        for i in range(len(all_zhis)):
            for j in range(i + 1, len(all_zhis)):
                if (all_zhis[i] == c0 and all_zhis[j] == c1) or \
                   (all_zhis[i] == c1 and all_zhis[j] == c0):
                    result.append({
                        "type": "六冲",
                        "positions": [zhi_names[i], zhi_names[j]],
                        "zhis": [all_zhis[i], all_zhis[j]],
                        "description": f"{c0}{c1}{desc}"
                    })

    # 地支三合
    for combo_str, hua in zhi_3hes.items():
        combo_set = set(combo_str)
        for i in range(len(all_zhis)):
            for j in range(i + 1, len(all_zhis)):
                for k in range(j + 1, len(all_zhis)):
                    if {all_zhis[i], all_zhis[j], all_zhis[k]} == combo_set:
                        result.append({
                            "type": "三合",
                            "positions": [zhi_names[i], zhi_names[j], zhi_names[k]],
                            "zhis": [all_zhis[i], all_zhis[j], all_zhis[k]],
                            "description": f"{combo_str}合{hua}"
                        })

    # 地支半合
    for (c0, c1), desc in zhi_half_3hes.items():
        for i in range(len(all_zhis)):
            for j in range(i + 1, len(all_zhis)):
                if (all_zhis[i] == c0 and all_zhis[j] == c1) or \
                   (all_zhis[i] == c1 and all_zhis[j] == c0):
                    result.append({
                        "type": "半合",
                        "positions": [zhi_names[i], zhi_names[j]],
                        "zhis": [all_zhis[i], all_zhis[j]],
                        "description": f"{c0}{c1}半合 {desc}"
                    })

    # 地支三刑
    for (c0, c1), desc in zhi_xings.items():
        for i in range(len(all_zhis)):
            for j in range(len(all_zhis)):
                if i != j and all_zhis[i] == c0 and all_zhis[j] == c1:
                    result.append({
                        "type": "三刑",
                        "positions": [zhi_names[i], zhi_names[j]],
                        "zhis": [all_zhis[i], all_zhis[j]],
                        "description": desc.strip()
                    })

    # 地支自刑
    for zx in zhi_zixings:
        positions = [i for i, z in enumerate(all_zhis) if z == zx]
        if len(positions) >= 2:
            for i in range(len(positions)):
                for j in range(i + 1, len(positions)):
                    result.append({
                        "type": "自刑",
                        "positions": [zhi_names[positions[i]], zhi_names[positions[j]]],
                        "zhis": [zx, zx],
                        "description": f"{zx}{zx}自刑"
                    })

    # 天干合
    for (c0, c1), desc in gan_hes.items():
        for i in range(len(all_gans)):
            for j in range(i + 1, len(all_gans)):
                if (all_gans[i] == c0 and all_gans[j] == c1) or \
                   (all_gans[i] == c1 and all_gans[j] == c0):
                    result.append({
                        "type": "天干合",
                        "positions": [gan_names[i], gan_names[j]],
                        "gans": [all_gans[i], all_gans[j]],
                        "description": f"{c0}{c1}合 {desc}"
                    })

    # 天干冲
    for (c0, c1), desc in gan_chongs.items():
        for i in range(len(all_gans)):
            for j in range(i + 1, len(all_gans)):
                if (all_gans[i] == c0 and all_gans[j] == c1) or \
                   (all_gans[i] == c1 and all_gans[j] == c0):
                    result.append({
                        "type": "天干冲",
                        "positions": [gan_names[i], gan_names[j]],
                        "gans": [all_gans[i], all_gans[j]],
                        "description": f"{c0}{c1}{desc}"
                    })

    return result


def get_spirits(gans_obj, zhis_obj, ba):
    """获取神煞"""
    result = []
    all_zhis = [zhis_obj.year, zhis_obj.month, zhis_obj.day, zhis_obj.time]
    all_gans = [gans_obj.year, gans_obj.month, gans_obj.day, gans_obj.time]
    zhi_names = ['年支', '月支', '日支', '时支']
    gan_names = ['年干', '月干', '日干', '时干']
    me = gans_obj.day

    for idx, (gan_, zhi_) in enumerate(zip(all_gans, all_zhis)):
        pillar_shens = []
        # 年支神煞
        for shen_name, shen_data in year_shens.items():
            if zhis_obj.year in shen_data and zhi_ in shen_data[zhis_obj.year]:
                pillar_shens.append(shen_name)
        # 月支神煞
        for shen_name, shen_data in month_shens.items():
            if zhis_obj.month in shen_data:
                val = shen_data[zhis_obj.month]
                if gan_ in val or zhi_ in val:
                    pillar_shens.append(shen_name)
        # 日支神煞
        for shen_name, shen_data in day_shens.items():
            if zhis_obj.day in shen_data and zhi_ in shen_data[zhis_obj.day]:
                pillar_shens.append(shen_name)
        # 日干神煞
        for shen_name, shen_data in g_shens.items():
            if me in shen_data and zhi_ in shen_data[me]:
                pillar_shens.append(shen_name)

        if pillar_shens:
            result.append({
                "position": f"{gan_names[idx]}/{zhi_names[idx]}",
                "pillar": f"{gan_}{zhi_}",
                "spirits": list(set(pillar_shens))
            })

    return result


def main():
    args = parse_args()
    parse_solar_date(args.solar)

    # 时间校正
    time_norm = normalize_time(args.solar, args.hour, args.minute, args.birthplace)
    if time_norm and time_norm.get('precisionGuard', {}).get('reason'):
        fail(time_norm['precisionGuard']['reason'], '历史时区或近似算法边界不能可靠确定，停止精确排盘', args.solar)
    if time_norm and 'error' not in time_norm:
        use_solar = time_norm['corrected']['solar']
        use_hour = time_norm['corrected']['hour']
        use_minute = time_norm['corrected']['minute']
        time_correction = {
            "applied": True,
            "original": time_norm['original'],
            "corrected": time_norm['corrected'],
            "dst": time_norm['dst'],
            "trueSolarTime": time_norm['trueSolarTime'],
            "timezone": time_norm['timezone'],
            "precisionGuard": time_norm['precisionGuard'],
            "instant": time_norm['instant'],
            "calendarReference": time_norm['calendarReference'],
            "calendarPolicy": time_norm['calendarPolicy'],
            "shichenChanged": time_norm['shichenChanged'],
            "boundary": time_norm.get('boundary'),
            "solarTermBoundary": time_norm.get('solarTermBoundary'),
            "warnings": time_norm.get('warnings', [])
        }
        print(f"[bazi-classic] 时间校正: {args.solar} {args.hour}:{args.minute:02d} → {use_solar} {use_hour}:{time_norm['corrected']['minute']:02d}", file=sys.stderr)
    else:
        fail("time_normalization_failed", "时间校正失败，停止排盘；请检查出生地、当地时间和运行环境", args.solar)

    # 解析日期
    year, month, day = parse_solar_date(use_solar)

    try:
        solar = Solar.fromYmdHms(year, month, day, use_hour, use_minute, 0)
        lunar = solar.getLunar()
        ba = calendar_basis(time_norm)
    except Exception as e:
        fail("calc_error", f"排盘计算失败: {e}", args.solar)

    is_male = args.gender == 'male'
    me = ba.getDayGan()

    # 四柱
    Pillars = collections.namedtuple('Pillars', ['year', 'month', 'day', 'time'])
    gans = Pillars(ba.getYearGan(), ba.getMonthGan(), ba.getDayGan(), ba.getTimeGan())
    zhis = Pillars(ba.getYearZhi(), ba.getMonthZhi(), ba.getDayZhi(), ba.getTimeZhi())

    pillars = {
        "year":  {"gan": gans.year,  "zhi": zhis.year,  "ganZhi": ba.getYear()},
        "month": {"gan": gans.month, "zhi": zhis.month, "ganZhi": ba.getMonth()},
        "day":   {"gan": gans.day,   "zhi": zhis.day,   "ganZhi": ba.getDay()},
        "time":  {"gan": gans.time,  "zhi": zhis.time,  "ganZhi": ba.getTime()}
    }

    # 十神
    gan_shens = {
        "year": get_ten_deity(me, gans.year),
        "month": get_ten_deity(me, gans.month),
        "day": "日主",
        "time": get_ten_deity(me, gans.time)
    }
    zhi_shens = {
        "year": get_ten_deity(me, list(zhi5[zhis.year].keys())[0]) if zhi5.get(zhis.year) else "",
        "month": get_ten_deity(me, list(zhi5[zhis.month].keys())[0]) if zhi5.get(zhis.month) else "",
        "day": get_ten_deity(me, list(zhi5[zhis.day].keys())[0]) if zhi5.get(zhis.day) else "",
        "time": get_ten_deity(me, list(zhi5[zhis.time].keys())[0]) if zhi5.get(zhis.time) else ""
    }
    zhi_shens_full = {
        "year": get_zhi_shens(me, zhis.year),
        "month": get_zhi_shens(me, zhis.month),
        "day": get_zhi_shens(me, zhis.day),
        "time": get_zhi_shens(me, zhis.time)
    }

    # 五行分数
    scores, gan_scores = calc_five_element_scores(
        [gans.year, gans.month, gans.day, gans.time],
        [zhis.year, zhis.month, zhis.day, zhis.time]
    )

    # 强弱
    me_wuxing = gan5[me]
    strength = calc_strength(scores, me_wuxing, zhis.month)

    # 调候
    humidity = temps.get(zhis.month, "")
    xiuqiu = xiuqius.get(me_wuxing, {}).get(zhis.month, "")

    # 纳音
    nayin_data = {
        "year": nayins.get(ba.getYear(), ""),
        "month": nayins.get(ba.getMonth(), ""),
        "day": nayins.get(ba.getDay(), ""),
        "time": nayins.get(ba.getTime(), "")
    }

    # 三命通会
    day_gz = ba.getDay()
    time_gz = ba.getTime()
    sanming_key = day_gz + time_gz[1]  # 日干支 + 时支
    sanming = summarys.get(sanming_key, "")

    # 穷通宝典月令
    month_key = f"{me}{zhis.month}"
    month_comment = months.get(month_key, "")

    # 冲刑合会
    clashes = get_clashes(gans, zhis)

    # 神煞
    spirits = get_spirits(gans, zhis, ba)

    # 大运
    yun = ba.getYun(1 if is_male else 0)
    dayun_list = yun.getDaYun()
    dayun = []
    for d in dayun_list:
        gz = d.getGanZhi()
        dayun.append({
            "ganZhi": gz or "（起运前）",
            "startYear": d.getStartYear(),
            "endYear": d.getEndYear(),
            "startAge": d.getStartAge(),
            "endAge": d.getEndAge()
        })

    output = {
        "input": {
            "solar": args.solar,
            "hour": args.hour,
            "minute": args.minute,
            "gender": args.gender,
            "birthplace": args.birthplace,
            "lunarDate": lunar.toString(),
            "solarDate": solar.toString()
        },
        "pillars": pillars,
        "dayMaster": {
            "gan": me,
            "wuXing": gan5[me],
            "yinYang": "阳" if Gan.index(me) % 2 == 0 else "阴"
        },
        "tenGods": {
            "ganShens": gan_shens,
            "zhiShens": zhi_shens,
            "zhiShensFull": zhi_shens_full
        },
        "scores": scores,
        "ganScores": {k: v for k, v in gan_scores.items() if v > 0},
        "strength": strength,
        "humidity": humidity,
        "xiuqiu": xiuqiu,
        "nayin": nayin_data,
        "sanming": sanming,
        "monthComment": month_comment,
        "siling": siling.get(zhis.month, ""),
        "clashes": clashes,
        "spirits": spirits,
        "dayun": dayun,
        "extra": {
            "taiYuan": ba.getTaiYuan(),
            "taiYuanNaYin": ba.getTaiYuanNaYin(),
            "mingGong": ba.getMingGong(),
            "mingGongNaYin": ba.getMingGongNaYin(),
            "shenGong": ba.getShenGong(),
            "shenGongNaYin": ba.getShenGongNaYin()
        },
        "timeCorrection": time_correction
    }

    json.dump(output, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == '__main__':
    main()
