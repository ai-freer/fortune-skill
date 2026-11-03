#!/usr/bin/env bash
# Fortune Skill 一键安装脚本
#
# 行为：
#   1. 安装 Node.js 与 Python 运行时依赖
#   2. 检测本地存在哪些 agent 平台 (Claude Code / Codex / Cursor / Trae)
#   3. 把当前仓库 symlink 到所有已检测平台的 skill 目录
#   4. 跑一次 verify 验证
#
# 使用：cd <仓库根目录> && ./install.sh

set -euo pipefail

# ─── 路径解析 ──────────────────────────────────────────────
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd -P )"
SKILL_DIR="$SCRIPT_DIR"

if [ ! -f "$SKILL_DIR/SKILL.md" ]; then
  echo "❌ 错误：找不到 SKILL.md。请在 fortune-skill 仓库根目录运行 ./install.sh" >&2
  exit 1
fi

SKILL_NAME="$(awk '/^name:/ {print $2; exit}' "$SKILL_DIR/SKILL.md" | tr -d '\r')"
SKILL_NAME="${SKILL_NAME:-fortune}"

# ─── 颜色输出 ──────────────────────────────────────────────
if [ -t 1 ]; then
  C_GREEN=$'\033[0;32m'
  C_YELLOW=$'\033[0;33m'
  C_RED=$'\033[0;31m'
  C_BLUE=$'\033[0;34m'
  C_RESET=$'\033[0m'
else
  C_GREEN=''; C_YELLOW=''; C_RED=''; C_BLUE=''; C_RESET=''
fi

step() { printf '\n%s▸ %s%s\n' "$C_BLUE" "$1" "$C_RESET"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$1"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$1"; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$1"; }

# ─── 工具检测 ──────────────────────────────────────────────
need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "缺少命令：$1。请先安装。"
    exit 1
  fi
}

need_cmd node
need_cmd npm
need_cmd python3
if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
  err "Python 版本过低，需要 ≥ 3.9（zoneinfo）。"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js 版本过低（当前 $(node -v)），需要 ≥ 18。"
  exit 1
fi

# ─── Step 1: Node.js 依赖 ──────────────────────────────────
step "安装 Node.js 依赖"
if [ -f "$SKILL_DIR/package.json" ]; then
  if [ -f "$SKILL_DIR/package-lock.json" ]; then
    ( cd "$SKILL_DIR" && npm ci --no-audit --no-fund )
  else
    ( cd "$SKILL_DIR" && npm install --no-audit --no-fund )
  fi
  ok "Node.js 依赖已安装"
else
  warn "未找到 package.json，跳过"
fi

# ─── Step 2: Python 依赖 ───────────────────────────────────
step "安装 Python 依赖"
if [ -f "$SKILL_DIR/requirements.txt" ]; then
  python3 -m pip install -r "$SKILL_DIR/requirements.txt" --quiet --user 2>/dev/null \
    || python3 -m pip install -r "$SKILL_DIR/requirements.txt" --quiet
  ok "Python 依赖已安装"
else
  warn "未找到 requirements.txt，跳过"
fi

# ─── Step 3: 检测并 symlink 到各 agent 平台 ────────────────
step "检测 agent 平台并 symlink"

declare -a AGENT_PLATFORMS=(
  "Claude Code|$HOME/.claude/skills"
  "Codex|$HOME/.codex/skills"
  "Cursor|$HOME/.cursor/skills"
  "Trae|$HOME/.trae/skills"
)

declare -a LINKED=()
declare -a SKIPPED=()

for entry in "${AGENT_PLATFORMS[@]}"; do
  name="${entry%%|*}"
  base_dir="${entry##*|}"
  parent_dir="$(dirname "$base_dir")"

  if [ -d "$parent_dir" ]; then
    mkdir -p "$base_dir"
    target="$base_dir/$SKILL_NAME"
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$SKILL_DIR" ]; then
      LINKED+=("$name (already linked)")
    elif [ -e "$target" ] && [ ! -L "$target" ]; then
      warn "$name: $target 已存在且不是 symlink，跳过（避免覆盖现有 skill）"
      SKIPPED+=("$name (existing non-symlink at $target)")
    else
      ln -sfn "$SKILL_DIR" "$target"
      LINKED+=("$name → $target")
    fi
  else
    SKIPPED+=("$name (not detected)")
  fi
done

# ─── Step 4: 验证 ──────────────────────────────────────────
step "运行 verify 自检"
VERIFY_LOG="$(mktemp "${TMPDIR:-/tmp}/fortune-verify.XXXXXX")"
if ( cd "$SKILL_DIR" && npm run verify --silent ) >"$VERIFY_LOG" 2>&1; then
  TOTAL=$(awk '/^verified [0-9]+ checks$/ {n=$2} END {print n ? n : "?"}' "$VERIFY_LOG")
  ok "verify 通过（$TOTAL 项）"
  rm -f "$VERIFY_LOG"
else
  err "verify 失败。日志保存在：$VERIFY_LOG"
  echo
  tail -10 "$VERIFY_LOG"
  exit 1
fi

# ─── Step 5: 报告 ──────────────────────────────────────────
echo
echo "╭─────────────────────────────────────────────────╮"
echo "│             Fortune Skill 安装完成              │"
echo "╰─────────────────────────────────────────────────╯"
echo

if [ ${#LINKED[@]} -gt 0 ]; then
  echo "已 symlink 到："
  for item in "${LINKED[@]}"; do echo "  ✓ $item"; done
  echo
fi

if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo "未安装 / 已跳过："
  for item in "${SKIPPED[@]}"; do echo "  - $item"; done
  echo
fi

cat <<'NEXT'
🔄 后续步骤：
   1. 重启你的 agent（Claude Code / Codex / Cursor / Trae）以加载 skill
   2. 在对话中说 "算八字"、"看紫微"、"今年运势"、"合婚" 等触发词即可

🔧 升级：cd <本仓库> && git pull && npm ci && npm run verify
🗑️  卸载：删除 ~/.claude/skills/fortune 等 symlink 即可

文档：INSTALL.md / README.md / SKILL.md
NEXT
