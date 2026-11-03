# 构建阶段固定跑在构建机架构：前端产物（dist）与架构无关，多架构发布会为每个
# 目标架构重复执行 pnpm install + vite/rolldown 构建（arm64 走 QEMU 模拟 Rust
# 工具链，实测 50 分钟无进展而卡死）。仅最终 nginx 镜像按目标架构生成。
FROM --platform=$BUILDPLATFORM nineaiyu/xadmin-client-base:20261103_054313 AS stage-build

ARG VERSION

COPY . .

# VERSION 参与 sed 改写两个 JSON：先去掉可能的 `v` 前缀并校验为 semver（可带预发布
# 后缀），避免空值/特殊字符把构建命令改坏或写出非法 JSON。发布 tag 是 `vX.Y.Z`，
# 而 package.json / platform-config 里的版本不带 `v`，故统一归一化后再写入。
RUN set -eu; \
    V="${VERSION#v}"; \
    printf '%s' "$V" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$' \
      || { echo "[build] VERSION 非法（需 semver，如 5.0.2 或 v5.0.2-rc.1）：'${VERSION}'" >&2; exit 1; }; \
    sed -i "s@\"Version\": .*@\"Version\": \"${V}\",@" public/platform-config.json; \
    sed -i "s@\"version\": .*@\"version\": \"${V}\",@" package.json

# 依赖按仓库 lock 精确安装：base 镜像的 node_modules 为构建期快照，lock 更新
# （overrides/传递依赖修复线）不重装则不生效
RUN pnpm install --frozen-lockfile

# 图标/动画子集是 gitignore 的生成物：`pnpm build` 已显式串联 `pnpm run prebuild`
# （pnpm 默认不执行 pre/post 生命周期脚本，不能依赖 install 的 postinstall）。
RUN pnpm build

FROM nginx:1.31.5-alpine
# alpine 基础包的漏洞修复线（expat 等 CVE）随镜像仓库滚动发布，构建期升级到
# 当前修复线；nginx 自身小版本由基础镜像 tag 跟进
RUN apk upgrade --no-cache
COPY --from=stage-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
