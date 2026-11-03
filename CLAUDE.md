# Fortune Skill — Claude Code 指引

中国传统命理分析 Skill（八字 + 紫微斗数）。个人使用，不商用。

## 快速上手

```bash
# 安装依赖
npm ci
python3 scripts/install-python.py

# 运行排盘（三个脚本可并行）
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
```

所有脚本输出 JSON 到 stdout，日志到 stderr。

## 项目结构

- `SKILL.md` — Skill 入口文件（LLM 读取的完整分析指令）
- `scripts/` — 三个排盘脚本（Node.js + Python）
- `references/` — 命理知识库（6 个 Markdown 文件，LLM 分析时按需读取）
- `vendor/bazi/` — china-testing/bazi 源码（bazi-classic.py 的数据依赖）
- `requirements.txt` — Python 依赖清单

## 依赖

- Node.js: `iztro`（紫微）、`lunar-javascript`（八字）
- Python: `lunar-python`、`colorama`、`bidict`（vendor/bazi 依赖）

## 分析流程概要

1. 收集出生信息（姓名、阳历生日、时辰、性别、出生地）
2. 并行调用三个排盘脚本获取 JSON 数据
3. 读取 references/ 知识文件
4. 八字分析（日主、十神、五行、格局、大运流年）
5. 紫微分析（命宫、十二宫、四化、大限流年）
6. 综合建议 + 免责声明

## 时间基准原则

地方视太阳时近似为正式排盘基准。用户提供的出生地民用钟表时间只是原始输入，脚本会按出生地进行夏令时和地方视太阳时近似校正；未校正 Raw Time 不得作为正式命盘依据，也不得为了贴合外部 benchmark 或预计算命盘而回退使用。

## 修改指南

- 修改分析流程 → 编辑 `SKILL.md`
- 修改排盘逻辑 → 编辑 `scripts/` 下对应脚本
- 补充命理知识 → 编辑 `references/` 下对应文件
- 脚本接口：`--solar "YYYY-MM-DD" --hour <0-23> --gender <male|female> --birthplace "城市"`

## 当前时间实现边界

以唯一出生 UTC 瞬时计算不同规则所需的时钟；年月柱/交节、大运使用 UTC+08:00 参考，日时柱与紫微使用地方视太阳钟近似，不能统一替换为同一种日历标签。算法、固定时区版本、精度拒绝窗口及历史限制见 `references/time-basis.md`。

## Python 环境偏好

用户明确指定已有解释器、全局或用户级环境时，必须将其作为 `PYTHON` 传给安装和每次 Agent 调用，不得忽略该偏好强制切回 `.venv`。未指定时，新安装默认项目环境；已有安装仍按解释器选择规则兼容。专用环境用于依赖隔离，不是安全沙箱。
