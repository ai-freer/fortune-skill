# 安装指引 · Fortune Skill

> 推荐使用一键安装脚本：[`./install.sh`](#一键安装推荐)。如需手动控制，按下方分平台说明操作。

---

## 一键安装（推荐）

仓库根目录提供 [`install.sh`](./install.sh)，会自动：

1. 安装 Node.js 与 Python 依赖
2. 检测本地存在哪些 agent 平台（Claude Code / Codex / Cursor / Trae）
3. 把仓库 symlink 到所有已检测到平台的 skill 目录
4. 跑一次 `npm run verify` 验证安装

```bash
git clone https://github.com/ai-freer/fortune-skill.git
cd fortune-skill
./install.sh
```

完成后，**重启你的 agent**，对话里说 `算八字` / `看紫微` / `今年运势` / `合婚` 等触发词即可调用。

---

## 系统要求

| 要求 | 版本 |
|---|---|
| Node.js | ≥ 18（推荐 22+）|
| Python  | ≥ 3.9（时间解析使用标准库 zoneinfo） |
| npm | 随 Node 自带 |
| Git | clone 用 |

OS：macOS / Linux / Windows（WSL 推荐）。Windows 原生 PowerShell 可参考"手动安装"流程。

---

## 30 秒上手 · Claude Code 用户

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/.claude/skills/fortune
cd ~/.claude/skills/fortune
npm ci
python3 -m pip install -r requirements.txt
npm run verify       # 26 测试
```

重启 Claude Code（或新开会话），对话里直接说"算八字"等触发词即可。

---

## 分平台手动安装

### Claude Code

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/.claude/skills/fortune
cd ~/.claude/skills/fortune
npm ci && python3 -m pip install -r requirements.txt
```

**触发**：重启 Claude Code 后，对话中提到 `算命 / 算八字 / 紫微 / 我的运势 / 合婚` 等触发词，会自动加载本 skill 的 `SKILL.md` 并按其流程引导用户。

### Codex CLI

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/.codex/skills/fortune
cd ~/.codex/skills/fortune
npm ci && python3 -m pip install -r requirements.txt
```

**触发**：与 Claude Code 同。

### Cursor

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/.cursor/skills/fortune
cd ~/.cursor/skills/fortune
npm ci && python3 -m pip install -r requirements.txt
```

**触发**：在 Cursor agent 对话中提到触发词即可。

### Trae

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/.trae/skills/fortune
cd ~/.trae/skills/fortune
npm ci && python3 -m pip install -r requirements.txt
```

### OpenClaw / 通用 agent / 其他平台

OpenClaw 等使用 exec / shell tool 的 agent 不依赖固定 skill 目录。clone 到任意位置即可：

```bash
git clone https://github.com/ai-freer/fortune-skill.git
cd fortune-skill
npm ci && python3 -m pip install -r requirements.txt
```

然后告诉 agent：

> "请把 `<本地路径>/fortune-skill` 当作一个命理分析 skill。SKILL.md 是入口指引；遇到 `算八字 / 紫微 / 合婚 / 今年运势` 等触发词时，按 SKILL.md 步骤排盘。"

agent 会读取 SKILL.md 和 AGENTS.md 自动理解项目结构。

---

## 多平台同时安装

如果你同时使用多个 agent 平台，**推荐单点 clone + symlink** 而不是每个平台各 clone 一份：

```bash
git clone https://github.com/ai-freer/fortune-skill.git ~/projects/fortune-skill
cd ~/projects/fortune-skill
./install.sh    # 自动 detect 已安装的平台并 symlink
```

`install.sh` 会把 `~/projects/fortune-skill` symlink 到所有检测到的 agent skill 目录，更新依赖只需在原位置 `git pull && npm ci` 一次。

---

## 验证

安装完成后跑一次自检：

```bash
npm run verify
# expected: verified 26 checks
```

或单独跑某个排盘脚本：

```bash
node scripts/bazi-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
node scripts/ziwei-chart.mjs --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
python3 scripts/bazi-classic.py --solar "1990-05-15" --hour 15 --gender male --birthplace "上海"
```

> 上述出生信息为虚构演示数据，不对应任何真实人物。

stdout 应输出结构化 JSON，stderr 是日志。如果 stdout 解析失败或 stderr 报"Cannot find module"，先确认依赖已装好。

---

## 触发使用

加载到 agent 后，**用自然语言**触发即可，无需任何特殊命令：

| 用户说 | Agent 自动行为 |
|---|---|
| "帮我算八字" / "看八字" | 按 SKILL.md 9 步收集生日 + 时辰 + 出生地，调脚本排盘，输出分析 |
| "看紫微 / 紫微斗数" | 同上但侧重紫微体系 |
| "今年运势" / "明年怎么样" | 流年快查模式 |
| "未来五年" / "未来十年" | 长期流年报告 |
| "我和 XX 合不合" / "合婚" | 双盘合婚分析 |
| "我家孩子 XX 年生的，看看" | 自动切换到 student/儿童模板，屏蔽成人维度 |

完整触发词清单见 [SKILL.md](./SKILL.md) frontmatter。

---

## 升级

```bash
cd <仓库本地路径>
git pull
npm ci   # 如果 package.json 有变化
python3 -m pip install -r requirements.txt --upgrade
npm run verify
```

如果用了 `install.sh` symlink 的方式，多个 agent 平台**自动同步**——只需更新仓库本身。

---

## 卸载

如果通过 `install.sh` symlink 方式安装，卸载只需删除符号链接：

```bash
rm ~/.claude/skills/fortune
rm ~/.codex/skills/fortune
rm ~/.cursor/skills/fortune
rm ~/.trae/skills/fortune
```

如果是直接 clone 到 skill 目录：

```bash
rm -rf ~/.claude/skills/fortune   # 或对应平台路径
```

可选清理依赖（如不再需要）：

```bash
cd <仓库路径>
rm -rf node_modules
python3 -m pip uninstall lunar-python colorama bidict -y
```

---

## 常见问题

### Q1：装完后 agent 没反应触发词

- **原因**：agent 启动时扫描 skill 目录，安装后必须重启 agent
- **修法**：完全退出并重新打开 Claude Code / Codex / Cursor / Trae

### Q2：`Cannot find module 'lunar-javascript'` 或 `iztro`

- **原因**：未在 skill 安装目录里执行 `npm ci`
- **修法**：`cd <skill 安装目录> && npm ci`。注意：必须在 symlink 目标的真实物理目录里跑（即 `install.sh` 自动处理过的位置）

### Q3：`ModuleNotFoundError: No module named 'lunar_python'`

- **原因**：Python 依赖未装
- **修法**：`python3 -m pip install -r requirements.txt`，或用虚拟环境（venv）后再装

### Q4：城市出生地"无法识别"

- **原因**：城市表是内置静态数据，海外或县级城市可能未覆盖
- **修法**：尝试该城市的地级市名（如 `当涂` → `马鞍山`），或在 [`scripts/city-data.mjs`](./scripts/city-data.mjs) 中提交 PR 补充

### Q5：Windows 原生（非 WSL）能用吗？

- 可以，但 `install.sh` 不能直接跑。手动 `npm ci + pip install`，然后把仓库 clone 到 `%USERPROFILE%\.claude\skills\fortune` 等对应路径
- **强烈推荐用 WSL2**，与 macOS / Linux 行为一致

### Q6：怎么确认我的 Claude Code / Codex 真的加载了 skill？

```bash
ls -la ~/.claude/skills/fortune/SKILL.md   # 应能 cat 出 frontmatter
```

启动 agent 后随便说一句"算八字"，如果 agent 开始按 SKILL.md 9 步收集信息（先问姓名、再问曾用名、再问生日…），说明加载成功。

---

## 隐私

- 用户输入的出生信息**仅在当前会话**使用，不上传任何远端
- 生成的报告默认存到 `reports/`，已加 `.gitignore`，不进版本控制
- 提交 PR 前请运行 `npm run privacy-check` 自查
- 详见 [`references/privacy-policy.json`](./references/privacy-policy.json)

---

## 协议

PolyForm Noncommercial License 1.0.0，仅限非商用使用。详见 [LICENSE](./LICENSE)。
第三方依赖与 vendored 代码各自保留原协议，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
