FROM nineaiyu/xadmin-client-base:20261016_055405 AS stage-build

ARG VERSION

COPY . .

RUN sed -i "s@\"Version\": .*@\"Version\": \"${VERSION}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION}\",@" package.json

# 依赖按仓库 lock 精确安装：base 镜像的 node_modules 为构建期快照，lock 更新
# （overrides/传递依赖修复线）不重装则不生效，曾出现压缩插件扫描产物目录的
# 版本差异行为（ENOENT scandir dist）
RUN pnpm install --frozen-lockfile

RUN pnpm build

FROM nginx:1.31.5-alpine
# alpine 基础包的漏洞修复线（expat 等 CVE）随镜像仓库滚动发布，构建期升级到
# 当前修复线；nginx 自身小版本由基础镜像 tag 跟进
RUN apk upgrade --no-cache
COPY --from=stage-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
