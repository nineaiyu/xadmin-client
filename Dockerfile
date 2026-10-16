FROM nineaiyu/xadmin-client-base:20261014_221009 AS stage-build

ARG VERSION

COPY . .

RUN sed -i "s@\"Version\": .*@\"Version\": \"${VERSION}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION}\",@" package.json

RUN pnpm build

FROM nginx:1.31.5-alpine
# alpine 基础包的漏洞修复线（expat 等 CVE）随镜像仓库滚动发布，构建期升级到
# 当前修复线；nginx 自身小版本由基础镜像 tag 跟进
RUN apk upgrade --no-cache
COPY --from=stage-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
