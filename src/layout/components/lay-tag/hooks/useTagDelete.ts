import type { RouteConfigs } from "../../../types";
import type { useTags } from "../../../hooks/useTag";
import { handleAliveRoute } from "@/router/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { readConfigurePreferences } from "@/utils/preferences";
import { previousVisitHistory, removeVisitHistory } from "@/utils/visitHistory";
import { createTagFixedScope } from "./tagFixedScope";

type TagRoute = ReturnType<typeof useTags>["route"];
type TagRouter = ReturnType<typeof useTags>["router"];
type TagMultiTags = ReturnType<typeof useTags>["multiTags"];

/** 删除标签时的固定标签集合（路由级 fixedTag + 首页），关全部时保留 */
type TagDeleteContext = {
  route: TagRoute;
  router: TagRouter;
  multiTags: TagMultiTags;
  /** 调用方构建：routerArrays + flatteningRoutes 中声明 fixedTag 的路由 */
  fixedTags: unknown[];
  /** 删签后把激活标签滚入可视区（useTagScroll） */
  dynamicTagView: () => Promise<void>;
};

/** 标签删除域（拆分自 useTagActions）：按左/右/其他/当前维度裁剪 multiTags 并跳转。
 *  其余标签动作（刷新/全屏/右键定位）见 useTagActions.ts，固定集判定见 tagFixedScope.ts。 */
export function useTagDelete({
  route,
  router,
  multiTags,
  fixedTags,
  dynamicTagView
}: TagDeleteContext) {
  const { keepFixedAnd, spliceNonFixed } = createTagFixedScope({
    multiTags,
    fixedTags
  });

  function deleteDynamicTag(
    obj: RouteConfigs,
    current: string,
    tag?: string
  ): void {
    const valueIndex: number = multiTags.value.findIndex(item => {
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
    });

    const spliceRoute = (
      startIndex?: number,
      length?: number,
      other?: boolean
    ): void => {
      if (other) {
        useMultiTagsStoreHook().handleTags("equal", keepFixedAnd(obj));
      } else {
        useMultiTagsStoreHook().handleTags("splice", "", {
          startIndex,
          length
        });
      }
      dynamicTagView();
    };

    /** 按路径逐个删除范围内的非固定标签（固定标签与右键固定的标签保留） */
    const removeScope = (scope: RouteConfigs[]) => {
      spliceNonFixed(scope, path =>
        useMultiTagsStoreHook().handleTags("splice", path)
      );
      dynamicTagView();
    };

    if (tag === "other") {
      spliceRoute(1, 1, true);
    } else if (tag === "left") {
      removeScope(multiTags.value.slice(0, valueIndex));
    } else if (tag === "right") {
      removeScope(multiTags.value.slice(valueIndex + 1));
    } else {
      // 从当前匹配到的路径中删除
      spliceRoute(valueIndex, 1);
    }
    const newRoute = useMultiTagsStoreHook().handleTags("slice") ?? [];
    const closedPath = obj.path ?? "";
    // 关闭的页签同步移出访问历史，避免回落到已关闭的页签
    removeVisitHistory(closedPath);
    const nextRoute = resolveVisitTarget(closedPath) ?? newRoute[0];
    if (current === route.path) {
      // 如果删除当前激活tag就自动切换到上一个访问过的tag（无历史则回落最后一个tag）
      if (tag === "left") return;
      if (!nextRoute) return;
      if (nextRoute.query) {
        router.push({ name: nextRoute.name, query: nextRoute.query });
      } else if (nextRoute.params) {
        router.push({ name: nextRoute.name, params: nextRoute.params });
      } else {
        router.push({ path: nextRoute.path });
      }
    } else {
      if (!multiTags.value.length) return;
      if (multiTags.value.some(item => item.path === route.path)) return;
      if (!nextRoute) return;
      if (nextRoute.query) {
        router.push({ name: nextRoute.name, query: nextRoute.query });
      } else if (nextRoute.params) {
        router.push({ name: nextRoute.name, params: nextRoute.params });
      } else {
        router.push({ path: nextRoute.path });
      }
    }
  }

  /**
   * 关闭页签后的落点（设置面板 →「页签访问历史」）：优先回到上一个访问过、
   * 且仍在页签栏中的页面；开关关闭或找不到时返回 undefined（回落到最后一个页签）。
   */
  function resolveVisitTarget(closedPath: string) {
    if (readConfigurePreferences().tagsVisitHistory === false) return undefined;
    const remaining = multiTags.value.filter(item => item.path !== closedPath);
    if (!remaining.length) return undefined;
    const path = previousVisitHistory([
      closedPath,
      ...remaining.map(item => String(item.path ?? ""))
    ]);
    return remaining.find(item => item.path === path);
  }

  function deleteMenu(item: RouteConfigs, tag?: string) {
    deleteDynamicTag(item, item.path ?? "", tag);
    handleAliveRoute(route as ToRouteType);
  }

  return { deleteMenu };
}
