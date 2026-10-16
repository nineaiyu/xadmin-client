import { defineComponent, h } from "vue";
import type { Component } from "vue";
import SearchPicker from "./index.vue";

export type SearchEntity = "user" | "dept" | "role" | "post" | "menu";

export default SearchPicker;

/**
 * 以 entity 预设生成具名包装组件。
 *
 * 两处「按名取组件」的既有契约仍以 `SearchXxx` 命名：
 * 后端元数据的 `api-search-*` 注册表与通知载荷的 component 字符串。
 */
export function createSearchPicker(entity: SearchEntity): Component {
  return defineComponent({
    name: `Search${entity.charAt(0).toUpperCase()}${entity.slice(1)}`,
    setup(_, { attrs, slots }) {
      return () => h(SearchPicker, { ...attrs, entity }, slots);
    }
  });
}

/** 按后端组件名字符串解析 entity（通知载荷的 component 字段） */
export function entityOfComponentName(name: string): SearchEntity | undefined {
  const mapping: Record<string, SearchEntity> = {
    SearchUser: "user",
    SearchDept: "dept",
    SearchRole: "role",
    SearchPost: "post",
    SearchMenu: "menu"
  };
  return mapping[name];
}
