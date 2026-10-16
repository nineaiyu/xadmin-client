/**
 * 链接判定（唯一入口）。
 *
 * 原实现位于 `RePlusPage/src/utils/index.ts`，但消费方远不止列表页框架
 * （store / router / 侧栏外链 / 文件表单），通用工具库反向依赖组件目录。
 * 现下沉到本模块：组件与框架统一从 `@/utils/rules/url` 取用（RePlusPage 的
 * 原导出保留为再导出，对外 API 不变）。
 *
 * 本模块刻意区分**两个不同问题**（此前都以 `isUrl` 之名各自实现，调用点无法
 * 表达意图）：
 * - `isUrl`：输入的链接是否合法（严格：协议限 http(s)，域名或 IPv4 主机）；
 * - `isExternalRoute`：路由 / 菜单 / 页签目标是不是站外地址（宽松，见下）。
 */

import { isUrl as isPermissiveUrl } from "@pureadmin/utils";

/** 是否是链接（协议可选；域名或 IPv4 主机 + 可选端口 / 路径 / query / hash） */
export function isUrl(url: string) {
  const regex = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" + // domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i"
  );
  return regex.test(url);
}

/**
 * 路由目标是否为站外地址（宽松口径，沿用既有判定：协议可省或
 * http / ftp / rtsp / mms / ws / wss，支持 localhost、IPv6、userinfo）——
 * 用于路由跳转、页签、侧栏外链的「是否跳站外」判定，口径与营销型链接
 * 校验不同，故与 `isUrl` 分开命名。
 */
export function isExternalRoute(value: string): boolean {
  return isPermissiveUrl(value);
}
