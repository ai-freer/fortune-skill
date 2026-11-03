# Fortune Skill — Agent 指引

中国传统命理分析 Skill（八字 + 紫微斗数）。

## 项目结构

```
fortune-skill/
├── SKILL.md                    # Skill 入口（LLM 指令）
├── scripts/
│   ├── bazi-chart.mjs          # 八字排盘（lunar-javascript）
│   ├── ziwei-chart.mjs         # 紫微排盘（iztro）
│   └── bazi-classic.py         # 三命通会经典分析（china-testing/bazi）
├── references/                 # 命理知识库（LLM 分析时读取）
│   ├── classical-texts.md      # 九本经典典籍核心规则
│   ├── wuxing-tables.md        # 五行、天干地支、十神表
│   ├── dayun-rules.md          # 大运顺逆排规则
│   ├── shichen-table.md        # 时辰对照表
│   ├── ziwei-guide.md          # 紫微斗数解盘指南
│   └── bazi-guide.md           # 八字命理分析指南
├── vendor/bazi/                # china-testing/bazi（git clone）
├── package.json                # Node.js 依赖声明
└── requirements.txt            # Python 依赖声明
```

## 安装依赖

克隆仓库后先运行：

```bash
npm ci
python3 scripts/install-python.py
```

## 排盘脚本调用

三个脚本接口统一，可并行调用：

```bash
# 八字排盘 → JSON（四柱、十神、五行、大运、流年、神煞）
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"

# 紫微排盘 → JSON（十二宫、命宫、身宫、五行局、运限）
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"

# 三命通会 → JSON（经典论断、冲刑合会、五行分数、格局）
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
```

所有脚本：stdout = JSON，stderr = 日志。错误时返回 `{"error": "..."}` 结构。

## references/ 用途

知识文件供 LLM 在分析阶段读取，不是给脚本用的：
- `classical-texts.md` + `bazi-guide.md` → 八字分析时读取
- `ziwei-guide.md` → 紫微分析时读取
- `wuxing-tables.md` + `shichen-table.md` + `dayun-rules.md` → 排盘验证和规则参考

## 分析流程

1. **信息收集**：姓名、生日、时辰、性别、出生地（详见 SKILL.md）
2. **排盘**：并行调用三个脚本
3. **八字分析**：日主强弱 → 十神 → 五行 → 格局 → 三命通会 → 大运流年
4. **紫微分析**：命宫主星 → 十二宫 → 四化 → 大限流年
5. **综合建议**：事业、财运、感情、健康

## 注意事项

- 出生地为必填项，用于夏令时和地方视太阳时近似校正
- 地方视太阳时近似为正式排盘基准；用户提供的出生地民用钟表时间只是原始输入，不得为了贴合外部 benchmark 或预计算命盘而使用未校正 Raw Time
- 时辰未知时不要调用排盘脚本生成精确四柱；只做年月日层面的定性分析，紫微需等用户补充时辰
- 分析结束必须附免责声明

## 当前时间实现边界

以唯一出生 UTC 瞬时计算不同规则所需的时钟；年月柱/交节、大运使用 UTC+08:00 参考，日时柱与紫微使用地方视太阳钟近似，不能统一替换为同一种日历标签。算法、固定时区版本、精度拒绝窗口及历史限制见 `references/time-basis.md`。

## Python 环境偏好

用户明确指定已有解释器、全局或用户级环境时，必须将其作为 `PYTHON` 传给安装和每次 Agent 调用，不得忽略该偏好强制切回 `.venv`。未指定时，新安装默认项目环境；已有安装仍按解释器选择规则兼容。专用环境用于依赖隔离，不是安全沙箱。
