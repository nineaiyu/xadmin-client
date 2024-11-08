FROM node:22.11.0-slim

WORKDIR /app
RUN corepack enable
RUN corepack prepare pnpm@9.12.3 --activate

RUN npm config set registry https://registry.npmmirror.com

#COPY .npmrc package.json pnpm-lock.yaml ./
#RUN pnpm install --frozen-lockfile
