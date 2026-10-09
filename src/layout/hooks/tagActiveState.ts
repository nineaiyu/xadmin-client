import { computed } from "vue";
import { isBoolean, isEqual } from "@pureadmin/utils";
import type { RouteConfigs } from "../types";
import type { RouteLocationNormalizedLoaded } from "vue-router";

/**
 * 标签激活态判定（自 useTag.ts 抽取）：无 showLink 的动态路由按 query/params
 * 比对，其余按路由名比对；fixedTag 单独判定。
 */
export function createTagActiveState(route: RouteLocationNormalizedLoaded) {
  function conditionHandle(
    item: RouteConfigs,
    previous: string | boolean,
    next: string | boolean
  ) {
    const currentName = route.name || "";
    const itemName = item.name || "";

    if (isBoolean(route?.meta?.showLink) && route?.meta?.showLink === false) {
      if (Object.keys(route.query).length > 0) {
        return currentName === itemName && isEqual(route.query, item.query)
          ? previous
          : next;
      }
      return currentName === itemName && isEqual(route.params, item.params)
        ? previous
        : next;
    }
    return currentName === itemName ? previous : next;
  }

  const isFixedTag = computed(() => {
    return (item: RouteConfigs) =>
      isBoolean(item?.meta?.fixedTag) && item?.meta?.fixedTag === true;
  });

  const iconIsActive = computed(() => {
    return (item: RouteConfigs, index: number) => {
      if (index === 0) return;
      return conditionHandle(item, true, false);
    };
  });

  const linkIsActive = computed(() => {
    return (item: RouteConfigs) => conditionHandle(item, "is-active", "");
  });

  const scheduleIsActive = computed(() => {
    return (item: RouteConfigs) => conditionHandle(item, "schedule-active", "");
  });

  return {
    conditionHandle,
    isFixedTag,
    iconIsActive,
    linkIsActive,
    scheduleIsActive
  };
}
