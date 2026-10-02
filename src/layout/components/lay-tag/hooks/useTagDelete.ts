import { toRaw } from "vue";
import type { RouteConfigs } from "../../../types";
import type { useTags } from "../../../hooks/useTag";
import { handleAliveRoute, getTopMenu } from "@/router/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";

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

/**
 * 标签删除域（拆分自 useTagActions）：按左/右/其他/当前维度裁剪 multiTags
 * 并处理删除后的路由跳转。其余标签动作（刷新/全屏/右键定位）见 useTagActions.ts。
 */
export function useTagDelete({
  route,
  router,
  multiTags,
  fixedTags,
  dynamicTagView
}: TagDeleteContext) {
  const { VITE_HIDE_HOME } = import.meta.env;

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
        useMultiTagsStoreHook().handleTags(
          "equal",
          [
            VITE_HIDE_HOME === "false" ? fixedTags : toRaw(getTopMenu()),
            obj
          ].flat() as RouteConfigs[]
        );
      } else {
        useMultiTagsStoreHook().handleTags("splice", "", {
          startIndex,
          length
        });
      }
      dynamicTagView();
    };

    if (tag === "other") {
      spliceRoute(1, 1, true);
    } else if (tag === "left") {
      spliceRoute(fixedTags.length, valueIndex - fixedTags.length);
    } else if (tag === "right") {
      spliceRoute(valueIndex + 1, multiTags.value.length);
    } else {
      // 从当前匹配到的路径中删除
      spliceRoute(valueIndex, 1);
    }
    const newRoute = useMultiTagsStoreHook().handleTags("slice") ?? [];
    if (current === route.path) {
      // 如果删除当前激活tag就自动切换到最后一个tag
      if (tag === "left") return;
      if (newRoute[0]?.query) {
        router.push({ name: newRoute[0].name, query: newRoute[0].query });
      } else if (newRoute[0]?.params) {
        router.push({ name: newRoute[0].name, params: newRoute[0].params });
      } else {
        router.push({ path: newRoute[0].path });
      }
    } else {
      if (!multiTags.value.length) return;
      if (multiTags.value.some(item => item.path === route.path)) return;
      if (newRoute[0]?.query) {
        router.push({ name: newRoute[0].name, query: newRoute[0].query });
      } else if (newRoute[0]?.params) {
        router.push({ name: newRoute[0].name, params: newRoute[0].params });
      } else {
        router.push({ path: newRoute[0].path });
      }
    }
  }

  function deleteMenu(item: RouteConfigs, tag?: string) {
    deleteDynamicTag(item, item.path ?? "", tag);
    handleAliveRoute(route as ToRouteType);
  }

  return { deleteMenu };
}
