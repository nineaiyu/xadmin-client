#!/bin/bash
#

VERSION=$1

node_images="registry.cn-beijing.aliyuncs.com/nineaiyu/node:22.11.0-slim"

npm_mirror="https://registry.npmmirror.com"

cmd='corepack enable && corepack prepare pnpm@9.14.2 --activate \
    && cd /app && pnpm install --frozen-lockfile && pnpm build'

if [[ -n ${VERSION} ]]; then
sed -i "s@\"Version\": .*@\"Version\": \"${VERSION/v/}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION/v/}\",@" package.json
fi

docker run --rm -it -v ./:/app -e TZ=Asia/Shanghai \
    -e COREPACK_NPM_REGISTRY=${npm_mirror} \
    -e npm_config_registry=${npm_mirror} \
    ${node_images} sh -c "${cmd}"

