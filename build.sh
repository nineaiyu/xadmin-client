#!/bin/bash
#

VERSION=$1

node_images="registry.cn-beijing.aliyuncs.com/nineaiyu/node:24.20.0-slim"

npm_mirror="https://registry.npmmirror.com"

cmd='corepack enable && corepack prepare pnpm@11.25.0 --activate \
    && cd /app && pnpm install --frozen-lockfile && pnpm build'

if [[ -n ${VERSION} ]]; then
sed -i "s@\"Version\": .*@\"Version\": \"${VERSION/v/}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION/v/}\",@" package.json
fi

docker run --rm -it -v ./:/app -e TZ=Asia/Shanghai \
    -e COREPACK_NPM_REGISTRY=${npm_mirror} \
    -e npm_config_registry=${npm_mirror} \
    ${node_images} sh -c "${cmd}"

# 产物在 dist/；托管与反代栈已迁至 xadmin-installer/deploy/web/（DIST_DIR 指向本 dist）

