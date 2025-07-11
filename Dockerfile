FROM nineaiyu/xadmin-client-base:20250711_093230 AS stage-build

ARG VERSION

COPY . .

RUN sed -i "s@\"Version\": .*@\"Version\": \"${VERSION}\",@" public/platform-config.json  \
    && sed -i "s@\"version\": .*@\"version\": \"${VERSION}\",@" package.json

RUN pnpm build

FROM nginx:1.24-bullseye
COPY --from=stage-build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
