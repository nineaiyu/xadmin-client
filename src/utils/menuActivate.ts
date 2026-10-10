import { posix } from "path-browserify";
import type { menuType } from "@/layout/types";

const HTTP_REG = /^http(s?):\/\//;

/**
 * 菜单路径解析（与侧栏菜单渲染同一口径）：外链原样返回，
 * 其余按 posix 规则与父级完整路径拼接。
 */
function resolvePath(basePath: string, routePath: string) {
  if (HTTP_REG.test(routePath) || HTTP_REG.test(basePath)) {
    return routePath || basePath;
  }
  return posix.resolve(basePath, routePath);
}

/**
 * 取节点下第一个可导航叶子路由的完整路径（跳过外链）。
 *
 * 与 SidebarItem 的渲染口径一致：节点有子级时继续下钻（点击父级展开后
 * 用户看到的第一个菜单项可点），无子级的节点即叶子、返回其完整路径；
 * 没有可导航目标（全为外链）时返回 null。
 */
export function firstLeafPath(item: menuType, basePath: string): string | null {
  return pickLeaf(item.children ?? [], basePath);
}

function pickLeaf(nodes: menuType[], basePath: string): string | null {
  for (const node of nodes) {
    const path = resolvePath(basePath, node.path ?? "");
    if (node.children && node.children.length > 0) {
      const leaf = pickLeaf(node.children, path);
      if (leaf) return leaf;
      continue;
    }
    if (HTTP_REG.test(path)) continue;
    return path;
  }
  return null;
}
