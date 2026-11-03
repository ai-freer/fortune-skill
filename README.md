# Fortune Skill — 中国传统命理 AI 分析技能

[简体中文](README.md) | [English](README.en-US.md)

Source-available，非商用使用。详见 [LICENSE](LICENSE) 和
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

> **隐私与示例数据声明**
>
> 本仓库 README、文档、测试脚本（含 `scripts/verify.mjs`）以及任何示例命令中
> 出现的出生日期、时辰、出生地、姓名等命主信息均为**虚构演示数据**，
> 不对应任何真实人物。请勿据此推算真人命盘或还原个人画像。
>
> 用户在本地使用本 Skill 生成的命理报告默认存放于 `reports/`，
> 该目录已加入 `.gitignore`，默认不纳入 Git 提交；这不能防止强制添加或其他上传方式。如需提交相关变更，
> 请先运行 `node scripts/privacy-check.mjs` 自查。

---

## 30 秒上手

需要 Node.js 18+、npm、Python 3.9+ 和 pip。以下命令在仓库根目录运行。

```bash
git clone https://github.com/ai-freer/fortune-skill.git
cd fortune-skill
./install.sh
```

`install.sh` 会自动安装依赖、检测本地 agent 平台（Claude Code / Codex / Cursor /
Trae）并把仓库 symlink 到对应 skill 目录。**重启 agent**，对话里说
"算八字 / 看紫微 / 今年运势 / 合婚" 等触发词即可调用。

完整安装指引（分平台手动安装、依赖要求、验证、升级、卸载、常见问题）见
**[INSTALL.md](./INSTALL.md)**。

---

## 项目概述

为 OpenClaw agent 构建一个中国传统命理分析 Skill，支持紫微斗数和八字命理两大体系。用户通过自然语言对话提供出生信息，系统自动排盘并结合经典典籍进行专业分析。

设计目标：对 OpenClaw / Claude Code / Codex 等 agent 平台原生友好。

### 时间基准原则

本项目先将出生地民用钟表时间（含当时夏令时）解析为唯一 UTC 瞬时，再按各项规则计算：年月柱、交节和大运使用固定 UTC+08:00 参考，日时柱与紫微使用地方视太阳时近似。不能用一个校正日期替代所有时基；未校正 Raw Time 不作为正式命盘依据。

外部 benchmark 或预计算命盘如果使用未校正时间，其结果只用于研究参考，不作为本项目正确性标准。需要验证分析质量时，应使用本项目自己的时间校正规则重新排盘。

---

## 协议与公开发布边界

本仓库的原创代码、文档、脚本、prompt 和 skill 材料默认按
PolyForm Noncommercial License 1.0.0 发布，仅限非商用使用；这不是 OSI
意义上的开源协议。

第三方依赖、vendored 代码和引用材料保留各自的原始协议或权利状态，详见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。其中 `vendor/bazi/`
对应的上游 `china-testing/bazi` 未随附许可证文件；维护者于 2026-11-03 确认此前已解决上游分发授权。本轮审查未独立查验许可凭证，不将该确认描述为独立验证，也不作额外转授权。

---

## 核心依赖

核心排盘依赖优先选择成熟项目；第三方协议状态以实际仓库和
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 为准。

| 项目 | 语言 | License | 用途 |
|------|------|------|------|
| [SylarLong/iztro](https://github.com/SylarLong/iztro) | TypeScript | MIT | 紫微斗数排盘引擎（12 宫、运限、四化、三方四正、插件系统） |
| [6tail/lunar-javascript](https://github.com/6tail/lunar-javascript) | JavaScript | MIT | 万年历+八字排盘（四柱、十神、五行、大运、流年、神煞、纳音） |
| [china-testing/bazi](https://github.com/china-testing/bazi) | Python | 未随附许可证 / 维护者确认分发权限 | 三命通会论断、冲刑合会分析、五行分数、格局判定、合婚 |
| [jinchenma94/bazi-skill](https://github.com/jinchenma94/bazi-skill) | Markdown | MIT | 分析流程框架 + 经典典籍 references（穷通宝典等九本） |

### 参考项目（不直接依赖）

| 项目 | 参考价值 |
|------|------|
| [hhszzzz/taibu](https://github.com/hhszzzz/taibu) | AGENTS.md / CLAUDE.md 的 agent 友好设计、MCP 工具定义方式、taibu-core 的 API 设计思路 |
| [DestinyLinker/MingLi-Bench](https://github.com/DestinyLinker/MingLi-Bench) | LLM 命理评测基准（160 道题），可作为题库和评测流程参考；若预计算命盘未校正地方视太阳时近似，不作为本项目排盘标准 |

---

## 架构

```
fortune-skill/
├── SKILL.md                    # OpenClaw Skill 入口
├── AGENTS.md                   # Codex agent 指引
├── CLAUDE.md                   # Claude Code agent 指引
├── package.json                # npm 依赖（iztro, lunar-javascript）
├── requirements.txt            # Python 依赖（lunar-python, colorama, bidict）
├── scripts/
│   ├── ziwei-chart.mjs         # iztro → 紫微盘 JSON
│   ├── bazi-chart.mjs          # lunar → 八字盘 JSON
│   └── bazi-classic.py         # china-testing/bazi → 三命通会评判 JSON
├── vendor/
│   └── bazi/                   # china-testing/bazi（git clone）
└── references/                 # 命理知识库（LLM 分析时读取）
    ├── classical-texts.md      # 九本经典典籍核心规则摘要
    ├── wuxing-tables.md        # 五行、天干地支、十神参考表
    ├── dayun-rules.md          # 大运顺逆排规则
    ├── shichen-table.md        # 时辰对照表
    ├── ziwei-guide.md          # 紫微斗数解盘指南
    └── bazi-guide.md           # 八字命理分析指南
```

---

## 三层计算架构

```
┌──────────────────────────────────────────────────┐
│  Layer 1: 精确排盘（脚本计算，JSON stdout）        │
│                                                    │
│  ziwei-chart.mjs ← iztro                          │
│    12 宫星盘、运限、星耀亮度、四化、三方四正        │
│                                                    │
│  bazi-chart.mjs ← lunar-javascript                 │
│    四柱、十神、五行、大运、流年、神煞、纳音         │
│                                                    │
│  bazi-classic.py ← china-testing/bazi              │
│    三命通会论断、冲刑合会、五行分数、格局           │
├──────────────────────────────────────────────────┤
│  Layer 2: 经典典籍（references/ Markdown）         │
│                                                    │
│  穷通宝典、三命通会、滴天髓、渊海子平、            │
│  子平真诠、千里命稿、神峰通考、协纪辨方书          │
├──────────────────────────────────────────────────┤
│  Layer 3: LLM 综合分析（SKILL.md 引导）            │
│                                                    │
│  Layer 1 排盘 JSON + Layer 2 典籍规则              │
│  → 日主强弱、格局、喜用神、大运流年                │
│  → 事业/财运/感情/健康建议                         │
│  → 历史事件校准（可选）                            │
└──────────────────────────────────────────────────┘
```

Layer 1 按明确规则计算排盘（精度限制见下文，LLM 不自行推算干支），Layer 2 提供系统化的专业知识，Layer 3 发挥 LLM 的综合分析和表达能力。

### 报告增强脚本

深度报告优先走结构化流水线，减少手工复制和 LLM 自由发挥：

| 命令 | 用途 |
|------|------|
| `npm run report-data -- ...` | 聚合基础盘、年度/逐月流年、方法论框架、报告模板、紫微三方四正与专项评分 |
| `npm run hecan-summary -- ...` | 输出结构化合参 v2 判断卡片，汇总八字、紫微、经典规则、现实校准、证据节点、反证/约束和可解释置信度 |
| `npm run hecan-audit -- ...` | 审计结构化合参 v2 卡片是否具备字段追溯、反证/约束、置信度拆解、地方视太阳时近似边界和未校准上限 |
| `npm run rule-matcher -- ...` | 输出调候、病药、作用优先级、神煞边界、大运切换、伏吟反吟、十神现代映射等规则命中点 |
| `npm run report-draft -- ...` | 按模板生成主报告摘要、十年流年、两年逐月或长期综合 Markdown 草稿 |
| `npm run report-qa -- --file reports/xxx.md` | 检查最终报告是否覆盖免责声明、时辰边界、方法论、现实校准、v2 合参卡片、隐私、条件性贵人边界和绝对化风险 |
| `npm run privacy-check` | 提交前检查 staged 文件是否包含 `reports/` 或敏感材料 |

说明：历史经历不是默认产品化输入，只有用户主动提供时才作为可选校准材料；贵人也不是默认专项报告，只有用户明确询问人脉、平台资源或贵人问题时才单独展开。

`hecan-summary` v2 判断卡片包含：

- `evidenceNodes[]`：字段级证据节点，含 `source`、`system`、`layer`、`aspect`、`fieldPath`、`polarity` 和 `weight`。
- `counterEvidence[]`：反证或约束，覆盖八字/紫微信号冲突、规则缺失、覆盖不足、时间可靠性、未校准、反向例和漏触发。
- `coverage`：每个领域的最低证据要求、必要来源、已覆盖来源、缺口和正文必须承接的现实边界。
- `riskBoundary`：健康和财务投资保留必要专业边界；关系、家庭、迁移等领域只写现实承接边界，避免过度安全化削弱判断。
- `confidenceBreakdown.calibrationSample`：按领域统计历史事件、反向例和漏触发，并影响校准加权和置信度上限。

---

## 安装

完整指引（分平台手动安装、依赖要求、验证、升级、卸载、常见问题）见
**[INSTALL.md](./INSTALL.md)**。

**一键安装**：

```bash
./install.sh
```

自动装依赖、检测本地 agent 平台（Claude Code / Codex / Cursor / Trae）并 symlink。

**手动安装**：

```bash
npm ci
python3 scripts/install-python.py
npm run verify        # 完整自检，项目数以运行输出为准
```

**单脚本快速验证**（出生信息为虚构演示数据）：

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
```

---

## Agent 友好性设计

### 1. JSON-first 输出

所有排盘脚本 stdout 输出结构化 JSON，stderr 输出日志。Agent 拿到数据后自行决定呈现和分析方式。

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
# stdout → { "pillars": {...}, "tenGods": {...}, "fiveElements": {...}, ... }

node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
# stdout → { "palaces": [...], "horoscope": {...}, "stars": {...}, ... }

python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --minute 0 --gender female --birthplace "上海"
# stdout → { "sanming": "...", "clashes": [...], "scores": {...}, ... }

node scripts/hecan-summary.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026
# stdout → { "schemaVersion": "fortune.hecanSummary.v2", "judgments": [{ "domain": "career", "evidenceNodes": [...], "counterEvidence": [...], "confidenceBreakdown": {...}, ... }], ... }

node scripts/hecan-audit.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026
# stdout → { "ok": true, "summary": { "schemaVersion": "fortune.hecanSummary.v2", "judgmentCount": 7, ... }, "findings": [] }
```

`--minute` 为可选参数，默认 `0`；出生时间接近时辰边界时建议提供分钟。

### 2. exec 调用（零服务集成）

所有计算通过 exec 调用命令行脚本。不需要 MCP 协议、HTTP Server、特殊 SDK；克隆后按“安装”章节安装 Node.js 和 Python 依赖即可使用。任何能执行 shell 命令的 agent 都能用：

- OpenClaw → exec tool
- Claude Code → bash tool
- Codex → terminal
- Cursor / Windsurf → terminal

### 3. SKILL.md 触发词

```yaml
triggers:
  - "算命" "算八字" "看八字" "批八字" "排八字" "排盘"
  - "紫微" "紫微斗数" "看紫微盘"
  - "帮我看看命" "我的运势" "今年运势"
  - "合婚" "八字合婚"
  - "bazi" "ziwei" "fortune"
```

### 4. AGENTS.md + CLAUDE.md

项目根目录放 agent 指引文件，让 Codex / Claude Code 自动理解项目结构和工具调用方式：

```markdown
# AGENTS.md

## 项目结构
- scripts/ 下有三个排盘脚本，通过命令行调用，stdout 输出 JSON
- references/ 下有命理知识 Markdown，分析时读取作为上下文
- SKILL.md 定义了完整的交互流程和分析框架

## 工具调用
- 紫微排盘: node scripts/ziwei-chart.mjs --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>
- 八字排盘: node scripts/bazi-chart.mjs --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>
- 三命通会: python3 scripts/bazi-classic.py --solar <date> --hour <0-23> [--minute <0-59>] --gender <male|female> --birthplace <city>

## 分析流程
1. 收集用户出生信息（日期、时间、性别、出生地）
2. 调用排盘脚本获取结构化数据
3. 读取 references/ 中的典籍规则
4. 结合排盘数据和典籍规则进行综合分析
```

### 5. References 作为可读上下文

references/ 目录的 Markdown 文件在分析阶段被读入 agent 上下文。比硬编码 prompt 更灵活，方便迭代。Agent 可以按需读取特定文件（比如只看穷通宝典的调候规则），不需要一次性加载全部。

### 6. 错误处理对 agent 友好

脚本对已处理的输入和计算错误返回结构化 JSON，便于 agent 理解并重试；调用方还应检查退出码和 stderr，参数解析或依赖启动失败不保证返回 JSON：

```json
{ "error": "invalid_date", "message": "日期格式错误，请使用 YYYY-MM-DD", "input": "1990/5/15" }
```

---

## china-testing/bazi 集成

### 代码结构（vendor/bazi/）

| 文件 | 大小 | 内容 |
|------|------|------|
| bazi.py | 120KB | 主程序：排盘+分析+输出，依赖 lunar-python |
| sizi.py | 172KB | 三命通会论断数据（六十甲子日时论命） |
| datas.py | 85KB | 天干地支/十神/五行/神煞等数据表 |
| ganzhi.py | 26KB | 干支计算 |
| yue.py | 87KB | 月令论断 |
| common.py | 1.6KB | 公共函数 |
| luohou.py | 11KB | 罗喉日计算 |
| shengxiao.py | 2KB | 生肖合婚 |

### Wrapper 方案

`scripts/bazi-classic.py` 做一层 wrapper：

1. `sys.path.insert` 引入 `vendor/bazi/`
2. 接收命令行参数（阳历日期、时间、性别）
3. 调用时间校正及历法适配器，结合 lunar-python 和 vendor 数据模块计算
4. 直接组织经典论断、关系、分数等结果
5. 输出结构化 JSON 到 stdout

提取的数据：

- 三命通会论断文本（sizi.py 的 summarys）
- 冲刑合会关系
- 五行分数
- 格局判定
- 神煞
- 大运列表

Python 依赖：`lunar-python`、`colorama`、`bidict`（见 `requirements.txt`）

---

## 工作流程

### Phase 1：信息收集（对话式）

```
用户："帮我算命"
Agent："请告诉我您的出生日期（阳历或农历都可以）"
用户："1990年5月15日"
Agent："出生时间大概是几点？"
用户："下午3点左右"
Agent："性别？"
用户："男"
Agent："出生地？（用于地方视太阳时近似参考）"
用户："上海"
→ 确认信息，开始排盘
```

### Phase 2：排盘计算（并行执行）

Agent 同时调用三个脚本：

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海"
```

三个脚本独立运行，各自输出 JSON。

### Phase 3：综合分析

Agent 读取 references/ 中的典籍规则，结合三份排盘数据，按 SKILL.md 定义的分析框架输出：

**八字分析：**

1. 日主强弱（得令、得地、得势）
2. 十神分析与六亲关系
3. 五行平衡与喜用神（参考穷通宝典调候）
4. 格局判定（参考子平真诠）
5. 三命通会论断（来自 bazi-classic.py）
6. 大运流年分析
7. 综合建议（事业、财运、感情、健康）

**紫微分析：**

1. 命宫主星与格局
2. 十二宫逐宫分析
3. 四化飞星与三方四正
4. 大限流年运势
5. 综合建议

### Phase 4：历史校准（可选）

根据排盘结果预测用户过去 3-5 个关键事件的时间和性质，让用户验证，微调分析。

---

## 当前状态

- P0 排盘脚本已完成：`bazi-chart.mjs`、`ziwei-chart.mjs`、`bazi-classic.py` 均输出 JSON。
- P1 Skill 框架已完成：`SKILL.md`、`AGENTS.md`、`CLAUDE.md`、`references/` 已就位。
- P2 功能已完成：时间校正、合婚、流年快查已接入脚本和 Skill 指令。
- 最小回归验证已接入：运行 `npm test` 或 `npm run verify`。

## 时间校正

日时柱与紫微采用地方视太阳时近似；年月柱、交节和大运采用下文说明的 UTC+08:00 参考。出生地民用钟表时间用于记录原始输入；若校正导致时辰变化，应在适用计算中采用校正后的时辰，并在报告中说明差异。

出生地是必填项。系统会在排盘前调用 `scripts/time-normalize.mjs` 完成：

1. 出生地匹配到时区和经度；县区别名会优先归属到对应地级市。
2. 用固定版本 TZif 与 Python 标准库解析唯一 UTC 瞬时、历史偏移及夏令时；不使用主机 ICU 决定命盘。
3. 用 UTC 钟读数加东经每度 4 分钟及 NOAA 均时差近似，计算地方太阳钟。
4. 按明确规则分别计算年月柱/交节、大运、日时柱和紫微；不能把一个校正日期统一替代所有时基。

中国城市统一使用 `Asia/Shanghai` 时区，并按城市经度修正地方视太阳时近似。县区或复合出生地会先尝试解析到地级市，例如 `当涂`、`当涂县`、`马鞍山-当涂` 会按 `马鞍山` 校正。海外城市依赖内置城市表；任何语言的城市名称如果无法匹配，时间校正脚本都会返回结构化 `unknown_city` 错误，排盘入口停止出盘。

## 验证

```bash
npm test
```

验证覆盖：

- 时间校正有效案例和非法日期错误。
- 三个排盘脚本的关键字段。
- 八字流年快查。
- 紫微四化落宫、三方四正和四化交互。
- 方法论框架、报告框架和隐私策略。
- 报告聚合脚本。
- 合婚脚本。

报告草稿：

```bash
npm run report-draft -- --type long_year_month --solar "1990-05-15" --hour 15 --minute 0 --gender male --birthplace "上海" --from 2026 --to 2035 --ziwei-years 2026,2027
npm run report-draft -- --type yearly_outlook_report --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2035 --ziwei-years 2026,2028,2031
npm run report-draft -- --type monthly_outlook_report --solar "1990-05-15" --hour 15 --gender male --birthplace "上海" --from 2026 --to 2027 --ziwei-years 2026,2027
```

`reports/` 默认视为个人敏感输出，已加入 `.gitignore`。提交前建议运行：

```bash
npm run privacy-check
```

## 后续候选

- 用 MingLi-Bench 或自建样例集评估分析质量。
- 增加更多城市别名和海外出生地覆盖。
- 增加排盘可视化输出。
- 根据真实对话继续压缩提问轮次和输出篇幅。

## 风险与注意事项

1. **排盘精度**：LLM 不应自行计算四柱，必须以脚本 JSON 为准。
2. **时辰未知**：不要用默认时辰生成伪精确盘，按 `SKILL.md` 的未知时辰流程处理。
3. **节气边界**：立春前后、月令交界需要用户尽量提供具体时间。
4. **出生地覆盖**：城市名称会先尝试县区/复合地名归属；仍无法匹配时，不论中文或其他语言都返回错误并停止精确排盘，不默认上海时区。
5. **免责声明**：输出必须包含“仅供文化研究和娱乐参考”。


## 时间与验证边界

输入为出生地民用钟表时间（包含当时的夏令时），通过固定 IANA TZif 快照解析为唯一 UTC 瞬时。不存在或重复的钟表时间、未知城市、缺失或损坏的数据均拒绝出盘，不回退原始时间。当前没有折叠时刻选择参数，须先核实原始记录。

年月柱与交节：同一 UTC 瞬时转为固定 UTC+08:00，与 lunar-javascript 的节气标签比较。日柱、时柱：UTC 加东经每度 4 分钟，再加 NOAA 分数年均时差近似；保留小数计算到秒，不先四舍五入跨越边界。八字采用 sect=2（午夜换日，晚子时时干按次日）；胎元、命宫、身宫等也使用对应的年月与时柱。大运保留依赖 sect=1 的传统天数/时辰离散规则，但出生与交节均来自同一物理时基，不使用校正后的太阳钟去减北京时间节气。

紫微单独采用地方视太阳钟日期与时辰，显式保留 iztro 的 normal 年界、forward 晚子时规则；紫微附带四柱不是八字交节结果。默认当前运限日期按 UTC+08:00 取值，不受主机时区影响。

均时差依据 [NOAA 公式](https://gml.noaa.gov/grad/solcalc/solareqns.PDF)，使用 UTC 分数年以保持同一瞬时一致；这是近似算法，不是高精度星历，未证明最坏误差界。项目支持 1900–2100 年的诊断计算；1970 年以前保留基于固定时区数据的条件性计算，输出历史时区假设标志与警告，需核实当地实际钟表制度，不能声称唯一确定。太阳钟换日/时辰边界和交节前后 2 分钟拒绝精确出盘。该窗口是保守业务规则，不是天文精度保证，窗口外也需说明近似。城市经度为代表坐标，县区别名不等同于具体出生点经度。

快照为本机已安装的 macOS 2026f.1.0、IANA 派生 2026f-rearguard 数据；版本与每区 SHA256 在 `data/tzdb/manifest.json`，许可与更新方法见 `data/tzdb/NOTICE.md`。需要 Python 3.9+ 标准库，不依赖主机 ICU/ZoneInfo 数据版本。1970 年前结果以城市代表时区规则为假设；历史偏移不能证明所有地点当时使用该钟表制度。固定版本也不能预知未来政治改时，更新数据后须重跑回归。

兼容保留 `trueSolarTime` 字段，`method: local_apparent_solar_time_approximation`、`equationOfTimeApplied: true` 明示实际算法；输出 `instant`、`calendarReference`、`calendarPolicy`、`precisionGuard` 可追溯各项口径。与旧版平太阳时结果有实质差异，不能混用新旧时间校正结果。

`npm test` / `npm run verify` 运行完整回归。`node scripts/privacy-check.mjs` 检查 staged 新增内容；`--tracked` 检查索引中的全部源码路径及密钥形状，适用于 CI；`--no-git` 只校验策略加载，不扫描内容。隐私检查是启发式检查，不能代替人工检查。

`.skill-publish-ignore` 为技能打包排除规则；其他打包工具未必读取它。个人报告、开发归档、环境文件和工具记忆应始终排除，发布前需检查实际产物。

## 翻译贡献

英文 README 基于 [@webbrain-one 在 PR #3 中贡献的译文](https://github.com/ai-freer/fortune-skill/pull/3)（版本 `7bce8bd24f140ec8925b213afb5328df455ff36e`），并按当前代码和中文 README 更新术语与行为说明。继续适用仓库 [LICENSE](LICENSE) 及其必需声明，不改变第三方材料的权利状态。

## 流日历法查询

查询某地、某个民用时刻的日干支及年月背景，不需要伪造出生资料：

```bash
node scripts/daily-context.mjs --date "2026-07-05" --hour 12 --minute 0 --location "北京"
```

查询地不是默认出生地。“今天”须先按查询地确定；日期、小时和城市必填，分钟默认 0。输出只代表该参考时刻，太阳钟换日或交节可能使民用一天内的干支变化。复用固定时区、均时差近似及边界拒绝规则；失败不回退原始时间。该入口不输出个人评分或指定日期的紫微流日。个性化解释仍须结合本命盘，完整流程见 `SKILL.md`。

## Python 安装加固

未设置 `PYTHON` 时，`python3 scripts/install-python.py` 创建／复用项目 `.venv`，按固定 SHA-256 安装运行依赖，无需激活，也不修改全局包。Node 与直接经典脚本均优先使用 `PYTHON` 覆盖，其次项目环境，最后兼容旧系统环境。源码包构建工具未纳入哈希锁，不能将此称为完整供应链验证。详情见 [Python 安装与供应链边界](references/python-supply-chain.md)。

已有全局环境可以继续使用；新安装默认项目环境，显式 `PYTHON` 优先。`--environment current` 可按哈希安装到所选解释器，`--user` 可选择用户级安装；运行偏好由 Agent 环境中的 `PYTHON` 保持，不自动改写 shell 配置。venv 是依赖隔离，不是安全沙箱。

依赖升级与用户更新步骤见 [依赖维护清单](references/python-supply-chain.md#dependency-maintenance)。
