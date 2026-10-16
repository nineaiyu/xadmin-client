// 校验本仓 package.json 版本与 xadmin-server 的 server/const.py VERSION 一致。
//
// 背景：前后端是同一产品的两个仓库，版本号必须同步提升——发布侧已由服务端
// build-image.yml 的 check-version 按 tag 门禁；本脚本把同一校验前移到开发/CI，
// 避免"只改一侧版本"的提交合入后才在发版时暴露。
// 服务端目录默认 ../xadmin-server（同工作区约定），可用 XADMIN_SERVER_DIR 覆盖；
// 未检出服务端时跳过（单仓检出场景），并打印提示。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const version = JSON.parse(readFileSync("package.json", "utf-8")).version;

const serverDir = path.resolve(
  process.env.XADMIN_SERVER_DIR ?? "../xadmin-server"
);
const constFile = path.join(serverDir, "server", "const.py");

if (!existsSync(constFile)) {
  console.log(
    `[skip] 未找到服务端版本文件：${constFile}\n` +
      "       如需校验请设置 XADMIN_SERVER_DIR，或在双仓同工作区环境下运行。"
  );
  process.exit(0);
}

const matched = readFileSync(constFile, "utf-8").match(
  /^VERSION\s*=\s*["']([^"']+)["']/m
);
if (!matched) {
  console.error(`[fail] 未能在 ${constFile} 中解析 VERSION = "x.y.z"`);
  process.exit(1);
}
const serverVersion = matched[1];

if (version !== serverVersion) {
  console.error(
    `[fail] 前后端版本不一致：client package.json = ${version}，server const.py = ${serverVersion}\n` +
      "       两个仓库的版本号需同步提升（否则前后端构建产物可能跨版本组合）。\n" +
      "       修复：同步修改 xadmin-client/package.json 与 xadmin-server/server/const.py。"
  );
  process.exit(1);
}
console.log(`[ok] 前后端版本一致：${version}`);
