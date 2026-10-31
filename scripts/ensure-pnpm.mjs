#!/usr/bin/env node
// 安装前门禁：只允许 pnpm。
//
// 背景：npm / yarn 会生成第二套 lock 与扁平 node_modules，与本仓的 pnpm 解析
// 策略（严格依赖边界、overrides 修复线）不一致，因此 preinstall 阶段直接拒绝。
// 用本地脚本替代 `npx only-allow pnpm`：npx 需要联网拉取执行器，离线/受限网络
// 下安装会先失败在一个与依赖无关的错误上。
const agent = process.env.npm_config_user_agent ?? "";

if (agent.includes("pnpm")) process.exit(0);

console.error(
  "[ensure-pnpm] 本仓库只支持 pnpm 安装（package.json 的 preinstall 拦截）。\n" +
    "             请使用 `pnpm install`；不要用 npm / yarn 生成第二套 lock。" +
    `\n             当前 user-agent：${agent || "<未设置>"}`
);
process.exit(1);
