import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import type { RouteConfigs } from "../../../types";
import type { Ref } from "vue";
import type { Router } from "vue-router";

/** 按路径补开动态路由标签（自 useTagActions.ts 抽出）：已在标签栏中则不重复添加 */
export function createDynamicRouteTag({
  multiTags,
  router
}: {
  multiTags: Ref<RouteConfigs[]>;
  router: Router;
}) {
  return function dynamicRouteTag(value: string): void {
    const hasValue = multiTags.value.some(item => {
      return item.path === value;
    });

    function concatPath(arr: RouteConfigs[], value: string) {
      if (!hasValue) {
        arr.forEach(arrItem => {
          if (arrItem.path === value) {
            useMultiTagsStoreHook().handleTags("push", {
              path: value,
              meta: arrItem.meta,
              name: arrItem.name
            });
          } else if (arrItem.children && arrItem.children.length > 0) {
            concatPath(arrItem.children, value);
          }
        });
      }
    }
    // options.routes 为 readonly 路由树，本项目路由项均符合 RouteConfigs 契约（name 恒为 string）
    concatPath(router.options.routes as RouteConfigs[], value);
  };
}
