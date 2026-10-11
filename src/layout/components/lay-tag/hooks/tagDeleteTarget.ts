import type { RouteConfigs } from "../../../types";
import type { useTags } from "../../../hooks/useTag";
import { readConfigurePreferences } from "@/utils/preferences";
import { previousVisitHistory } from "@/utils/visitHistory";

type TagRouter = ReturnType<typeof useTags>["router"];

/** 在当前标签列表中定位目标标签（query > params > path 逐级匹配） */
export function findTagIndex(tags: RouteConfigs[], obj: RouteConfigs): number {
  return tags.findIndex(item => {
    if (item.query) {
      if (item.path === obj.path) {
        return item.query === obj.query;
      }
    } else if (item.params) {
      if (item.path === obj.path) {
        return item.params === obj.params;
      }
    } else {
      return item.path === obj.path;
    }
    return false;
  });
}

/**
 * 关闭页签后的落点（设置面板 →「页签访问历史」）：优先回到上一个访问过、
 * 且仍在页签栏中的页面；开关关闭或找不到时返回 undefined（回落到最后一个页签）。
 */
export function resolveVisitTarget(
  tags: RouteConfigs[],
  closedPath: string
): RouteConfigs | undefined {
  if (readConfigurePreferences().tagsVisitHistory === false) return undefined;
  const remaining = tags.filter(item => item.path !== closedPath);
  if (!remaining.length) return undefined;
  const path = previousVisitHistory([
    closedPath,
    ...remaining.map(item => String(item.path ?? ""))
  ]);
  return remaining.find(item => item.path === path);
}

/** 按目标标签形态跳转（query > params > path 逐级回落） */
export function gotoTagRoute(router: TagRouter, target: RouteConfigs): void {
  if (target.query) {
    router.push({ name: target.name, query: target.query });
  } else if (target.params) {
    router.push({ name: target.name, params: target.params });
  } else {
    router.push({ path: target.path });
  }
}
