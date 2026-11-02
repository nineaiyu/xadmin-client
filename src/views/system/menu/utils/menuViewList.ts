import type { Ref } from "vue";

/**
 * 组件路径清单：只枚举可路由的视图文件，不再为读取组件 name 逐个 import
 * 全部视图 chunk（菜单页停留或空闲期会产生大量 chunk 请求）。
 *
 * 名称优先取菜单元数据（`row.component → row.name`）；未登记过的组件路径
 * 保持空名，由表单里的「组件名称」输入框手填（未收录组件允许手改）。
 */

/** 与 router 的 `import.meta.glob` 键同口径：文件路径 → 菜单 component 片段 */
function viewPathOf(file: string): string {
  return file
    .replace(/(\.\/|\.vue)/g, "")
    .replace("/src/views/", "")
    .replace("/src/extensions/", "extensions/");
}

/** component 元数据片段 → 视图文件清单键（兼容 `/src/...` 与 `@/...` 写法） */
function componentKeyOf(component: string): string {
  const normalized = component.replace(/^@\//, "").replace(/^\/+/, "");
  return normalized.startsWith("/src/")
    ? viewPathOf(component)
    : normalized.replace(/\.vue$/, "");
}

const viewModules = import.meta.glob<{ default: { name?: string } }>([
  "@/views/**/*.vue",
  "@/extensions/**/*.vue"
]);

export function loadMenuViewList(
  viewList: Ref<Record<string, string>>,
  rows: Array<{ component?: string; name?: string }> = []
) {
  const next: Record<string, string> = {};
  Object.keys(viewModules).forEach(file => {
    // components 目录为依赖组件而非页面组件，不入候选
    if (/\/components\//.test(file)) return;
    next[viewPathOf(file)] = "";
  });
  rows.forEach(row => {
    const component = String(row.component ?? "").trim();
    if (!component) return;
    const key = componentKeyOf(component);
    if (!key) return;
    next[key] = String(row.name ?? "");
  });
  viewList.value = next;
}
