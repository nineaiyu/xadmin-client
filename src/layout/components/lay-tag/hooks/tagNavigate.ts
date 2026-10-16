import { emitter } from "@/utils/mitt";
import type { RouteConfigs } from "../../../types";
import type { Router } from "vue-router";

/** 触发 tags 标签切换（自 useTagActions.ts 抽出）：优先按 name 跳转，附带 query/params */
export function createTagOnClick(router: Router) {
  return function tagOnClick(item: RouteConfigs) {
    const { name, path } = item;
    if (name) {
      if (item.query) {
        router.push({
          name,
          query: item.query
        });
      } else if (item.params) {
        router.push({
          name,
          params: item.params
        });
      } else {
        router.push({ name });
      }
    } else {
      router.push({ path });
    }
    emitter.emit("tagOnClick", item as never);
  };
}
