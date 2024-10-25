FROM node:22.10.0-alpine

WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@9.12.2 --activate

RUN npm config set registry https://registry.npmmirror.com

#COPY .npmrc package.json pnpm-lock.yaml ./
#RUN pnpm install --frozen-lockfile
