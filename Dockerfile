FROM nineaiyu/xadmin-client-base:20261016_055405 AS stage-build

ARG VERSION

COPY . .

RUN sed -i "s@\"Version\": .*@\"Version\": \"${VERSION}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION}\",@" package.json

# 依赖按仓库 lock 精确安装：base 镜像的 node_modules 为构建期快照，lock 更新
# （overrides/传递依赖修复线）不重装则不生效
RUN pnpm install --frozen-lockfile

# 图标/动画子集是 gitignore 的生成物，由 prebuild 产出：pnpm 默认不执行
# pre/post 脚本，且 install 在依赖已就绪时会跳过根 postinstall，故必须显式生成，
# 否则 vite 解析 ../data/subsets/*.json 与 @/style/animate-subset.css 直接失败
RUN pnpm run prebuild

RUN pnpm build

FROM nginx:1.31.5-alpine
# alpine 基础包的漏洞修复线（expat 等 CVE）随镜像仓库滚动发布，构建期升级到
# 当前修复线；nginx 自身小版本由基础镜像 tag 跟进
RUN apk upgrade --no-cache
COPY --from=stage-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
