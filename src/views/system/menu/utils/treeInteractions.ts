import { MenuChoices } from "@/views/system/constants";
import type { MenuRow } from "./types";

/**
 * 菜单树交互的纯函数与配置（自 useMenuTree 拆出，行为不变）：
 * el-tree 的 default-props、拖拽约束与 check 载荷解析。
 */

/** el-tree 默认 props：label 取 meta.title；禁用节点（isActive=false）加 class */
export const menuTreeDefaultProps = {
  children: "children",
  label: (data: unknown) => (data as MenuRow).meta.title,
  class: (data: unknown) => ((data as MenuRow).isActive ? "" : "is-disabled")
};

/** 拖拽约束：权限点不能再挂子级（其 path/method 是接口授权语义） */
export function allowDropByType(
  _draggingNode: unknown,
  dropNode: unknown,
  type: string
) {
  const data = (dropNode as { data?: MenuRow } | null | undefined)?.data;
  return !(type === "inner" && data?.menuType === MenuChoices.PERMISSION);
}

/**
 * el-tree check 载荷 → 勾选 pk 列表。
 * 载荷里 checkedNodes 是「节点 data」而非 Node 实例（store.getCheckedNodes()
 * 返回 child.data），此处对两种形态都兼容。
 */
export function parseCheckedPks(info: {
  checkedNodes: Array<unknown>;
}): Array<number | string> {
  return info.checkedNodes
    .map(node => {
      const item = node as Partial<MenuRow> & { data?: MenuRow };
      return (item.pk ?? item.data?.pk) as number | string | undefined;
    })
    .filter((pk): pk is number | string => pk !== undefined);
}
