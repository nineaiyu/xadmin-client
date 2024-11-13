#!/bin/bash

docker run --rm -it -v ./:/app -e TZ=Asia/Shanghai \
  nineaiyu/xadmin-client-base:20241113_101728 sh -c 'pnpm install --frozen-lockfile && pnpm build'

