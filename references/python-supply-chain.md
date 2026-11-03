# Python 安装与供应链边界

新安装默认使用项目环境；已有全局安装无须强制迁移。推荐运行 `python3 scripts/install-python.py`（Windows 使用 `python scripts/install-python.py`）。默认项目模式下，安装器创建或复用仓库 `.venv`，不会修改全局包，不需要先激活虚拟环境。重复安装会重新校验并安装三个小型运行依赖；失败返回非零退出码，不报安装成功。它不自动删除已有环境；已有 `.venv` 损坏或 Python 升级后不可用时，先移走该目录，再重建。

`requirements.txt` 固定版本，并启用 `--require-hashes`。每个依赖只接受 `references/python-artifacts.json` 中记录的一个制品：colorama、bidict 的通用 wheel，以及 lunar-python 1.4.8 的源码包。2026-11-03 从 PyPI JSON API 获取发行元数据，并独立下载 files.pythonhosted.org 内容计算 SHA-256 后核对。哈希证明下载内容与审查记录一致，不能证明发布账号、PyPI 或包源码可信，也不能发现包自身的恶意逻辑。

安装器使用 `--no-deps --force-reinstall --no-cache-dir`：三个包没有运行时传递依赖；重复安装不因版本已满足而跳过制品校验，也不复用未纳入清单的本地构建 wheel。依赖升级按下方维护清单操作；不要用新下载内容自动覆盖预期哈希来“修复”校验失败。

## 构建工具链仍有边界

lunar-python 1.4.8 仅发布 sdist，因此不能使用 `--only-binary=:all:`。其 setup.py 使用 setuptools 声明纯 Python 包；安装仍会执行源码构建代码。pip 的隔离构建可以动态下载构建工具，这些工具不受运行依赖哈希覆盖；启动用的 Python、venv 自带 pip 和操作系统也不在本清单中。

本轮没有另建构建工具锁，也不降低现有 Python 3.9 兼容性。审查时发现修复已知公告的 setuptools 新版要求 Python 3.10+，旧版存在源码打包排除及旧式 wheel-to-egg 安装相关公告。项目不使用这些路径发布制品，但不能据此把整个工具链称为无风险。需要更强保证时，应单独评估提高最低 Python 版本或提供经过审查的构建制品，而不是在这次轻量加固中引入另一套构建系统。

## 解释器兼容规则

Node 调用优先使用显式 `PYTHON`，其次仓库 `.venv/bin/python`（Windows 为 `.venv/Scripts/python.exe`），没有项目环境时沿用 `python3`（Windows 为 `python`）。保留旧安装方式的兼容路径，但不把全局已有包视为经过此次哈希验证。

直接 `python3 scripts/bazi-classic.py ...` 仍可使用：脚本在导入依赖前按相同优先级切换解释器，并将实际解释器传给其 Node 时间校正子进程。`PYTHON` 应是单个可执行文件路径或命令名，不能带参数；显式无效路径或缺失依赖不会回退到别的可用环境。`NODE` 覆盖维持原有含义。移动仓库或更换基础 Python 后，虚拟环境可能需要重建；多个 Skill 符号链接共用真实仓库环境。

## 漏洞检查

`python3 scripts/python-audit.py` 用标准库读取 PyPI 对三个固定运行版本提供的漏洞公告（OSV 来源），不安装额外扫描器，不执行被扫描包。无已知公告退出 0；已知且未撤回的公告退出 1；查询超时、服务故障或响应不完整输出 `incomplete`、警告并退出 2。公告检查放在独立工作流，不串联或阻断功能验证工作流，也不会把查询失败标成检查通过。部分查询失败不能掩盖已发现的公告。

此检查只覆盖三个运行依赖，不覆盖动态构建工具、pip、vendored 源码或未知漏洞。CI 将其独立展示，检查不完整时应重试或人工核实。功能测试不会等待此网络查询。

官方说明：[pip 哈希安装](https://pip.pypa.io/en/stable/topics/secure-installs/)、[PyPI JSON API](https://docs.pypi.org/api/json/)。

## 保留全局或用户级安装

专用环境用于避免依赖互相覆盖，不是安全沙箱。哈希校验在全局、用户级或项目环境中都能使用。若指定 `PYTHON`，安装器默认安装到该解释器；显式 `--environment project` 则只选择本次安装目标，不会替用户修改 shell 环境变量。

已有环境可用下面的方式继续使用（把路径换成你选择的解释器）：

```bash
export PYTHON="/path/to/python3"
python3 scripts/install-python.py --environment current
npm run verify
```

PowerShell 使用 `$env:PYTHON = "C:\path\to\python.exe"`，再运行 `python scripts/install-python.py --environment current`。Agent 的启动环境也需保留该变量；安装器不写 shell 配置或记忆文件，`--environment current` 本身不持久化运行偏好。

如明确需要用户级安装，使用 `--environment current --user`。它安装到所选 Python 的用户目录，不等于项目隔离，可能影响同一用户的其他工具；默认隔离 venv 不支持 user site。不要用 sudo 或 `--break-system-packages` 绕过系统保护，安装失败时选择项目环境或自行管理的解释器。

没有 `PYTHON` 且没有项目环境时，运行仍兼容旧系统 Python；已有项目环境时默认选它。明确要求全局/自管环境的用户，应在 Agent 调用链中设置 `PYTHON`，不能忽略该偏好再自动切回项目环境。

项目环境中 `pip check` 失败会使安装失败。明确选择共享环境时，`pip check` 仍会显示问题，但不自动修复其他项目的依赖；安装器单独核验本 Skill 的固定版本和导入。共享环境的其他依赖告警不会被说成健康检查通过，也不会被当成本 Skill 安装必然失败。

<a id="dependency-maintenance"></a>

## 依赖维护 / Dependency maintenance

版本固定用于避免解析到不同版本；哈希用于确认下载字节与审核记录一致，不能证明包没有恶意逻辑。升级时：

1. 查看上游发行说明、Python 兼容范围和运行时传递依赖。从 PyPI 官方版本 JSON（`https://pypi.org/pypi/<包名>/<版本>/json`）确认文件名、制品 URL、SHA-256 和是否撤回；直接下载该发行文件，运行 `python3 -m pip hash <制品文件>`，与官方记录核对。有上游独立校验记录时也一并核对，不把本地计算出的值自动当作可信预期值。
2. 同步更新 [requirements.txt](../requirements.txt) 的版本/哈希和 [python-artifacts.json](python-artifacts.json) 的版本、文件名、URL、哈希。若新增传递依赖或改变最低 Python 版本/制品类型，还须调整安装器、[清单合同测试](../scripts/verify-python-supply-chain.py)、公告检查范围和安装说明；当前 `--no-deps` 不能遗漏新依赖。
3. 在临时环境或 CI 中验证项目与 `current` 安装、重复安装、坏哈希拒绝和恢复，再运行 `python3 scripts/verify-python-install.py`、`npm test` 和 `python3 scripts/python-audit.py`。查看排盘回归的实际结果差异；公告退出 2 表示未查完，应重试，不能算作无漏洞。
4. lunar-python 1.4.8 仍是 sdist：不能强制全 wheel，也不能把源码 hash 当成构建工具锁。升级时重新检查构建配置及动态构建依赖，保留对应风险说明。

用户更新：保留自己选定的 `PYTHON`/安装模式，依次执行 `git pull`、`npm ci`、`python3 scripts/install-python.py`、`npm test`；原先使用用户级安装时仍加 `--environment current --user`。不要为消除 hash 报错自行改锁文件。Windows 将 Python 命令改为 `python`，详见 [安装与升级](../INSTALL.md#升级)。

### English

Version pins prevent unintended version changes. Hashes verify downloaded bytes against reviewed artifacts; they do not prove that a package is harmless. To upgrade:

1. Review upstream release notes, supported Python versions, and runtime dependencies. Check the official PyPI version JSON (`https://pypi.org/pypi/<name>/<version>/json`) for the filename, artifact URL, SHA-256, and yanked status. Download that release file directly, run `python3 -m pip hash <artifact-file>`, and compare with the official record and any independent upstream checksums available. Do not automatically trust a newly computed local hash.
2. Update both the version/hash in [requirements.txt](../requirements.txt) and the version, filename, URL, and hash in [python-artifacts.json](python-artifacts.json). New transitive dependencies or changes to the minimum Python version/artifact type also require changes to the installer, [lock contract tests](../scripts/verify-python-supply-chain.py), advisory scope, and installation instructions. The current `--no-deps` must not omit new dependencies.
3. In disposable environments or CI, verify project and `current` installs, repeat installs, bad-hash rejection, and recovery. Then run `python3 scripts/verify-python-install.py`, `npm test`, and `python3 scripts/python-audit.py`. Review actual chart regression differences. Advisory exit 2 means incomplete coverage: retry rather than treating it as a clean result.
4. lunar-python 1.4.8 remains an sdist: do not require wheels for everything or treat its source hash as a build-tool lock. Recheck build configuration and dynamic build dependencies on upgrade, and retain the risk disclosure.

For users: retain your chosen `PYTHON`/installation mode, then run `git pull`, `npm ci`, `python3 scripts/install-python.py`, and `npm test`. If you chose user-site installation, retain `--environment current --user`. Do not edit the lock to bypass a hash mismatch. On Windows, use `python` for Python commands; see [installation and upgrades](../INSTALL.md#升级) (Chinese).
