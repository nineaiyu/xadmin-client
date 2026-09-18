#!/usr/bin/env bash
# 测试服前端一键发布：本地构建 → 同步产物与 nginx 配置 → 远端按 compose 重建 web 容器。
#
# 用法：
#   ./scripts/deploy-test-server.sh          # 完整流程（构建 + 同步 + 重建 + 验证）
#   ./scripts/deploy-test-server.sh -s       # 跳过构建（直接同步现有 dist）
#
# 可覆盖变量：
#   SERVER=root@host      远端（默认 192.168.0.200 测试服）
#   REMOTE_ROOT=/opt/xadmin  远端部署根（默认 /opt/xadmin）
#   WEB_CONF_DIR=<dir>     xadmin-web 配置目录（默认 <client>/../xadmin-web）
set -euo pipefail

SERVER=${SERVER:-root@192.168.0.200}
REMOTE_ROOT=${REMOTE_ROOT:-/opt/xadmin}
SKIP_BUILD=${1:-}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_CONF_DIR=${WEB_CONF_DIR:-"$ROOT/../xadmin-web"}

if [ "$SKIP_BUILD" != "-s" ]; then
    echo "== 1/4 本地构建前端 =="
    (cd "$ROOT" && pnpm build)
else
    echo "== 1/4 跳过构建（-s）=="
fi

echo "== 2/4 同步产物与 nginx 配置到 $SERVER:$REMOTE_ROOT/web =="
ssh "$SERVER" "mkdir -p $REMOTE_ROOT/web/dist"
rsync -az --delete "$ROOT/dist/" "$SERVER:$REMOTE_ROOT/web/dist/"
rsync -az "$WEB_CONF_DIR/default.conf" "$WEB_CONF_DIR/xadmin-api-conf" "$SERVER:$REMOTE_ROOT/web/"

echo "== 3/4 远端按 compose 重建 web 容器 =="
ssh "$SERVER" "cd $REMOTE_ROOT/xadmin-server && docker compose -f docker-compose.web.yml up -d"

echo "== 4/4 验证页面 =="
ssh "$SERVER" "curl -s -m 8 -o /dev/null -w 'WEB 页面: %{http_code}\n' http://localhost/"
