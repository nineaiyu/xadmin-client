/**
 * 菜单页行交互动作：节点点击（含未保存切换守卫）、行操作分发（编辑/加子级/
 * 克隆/权限码/重命名/删除/移动）、行内启停、未保存拦截（openWithGuard，
 * 工具栏动作同样复用）。数据与抽屉/排序域由页面 hook 注入。
 */

import type { Ref } from "vue";
import type { useMenuData } from "./useMenuData";
import type { useMenuDrawer } from "./useMenuDrawer";
import type { useMenuOrder } from "./useMenuOrder";
import type { MenuRow, MoveDirection } from "./types";

type MenuDataState = ReturnType<typeof useMenuData>;
type MenuDrawerState = ReturnType<typeof useMenuDrawer>;
type MenuOrderState = ReturnType<typeof useMenuOrder>;

export function useMenuRowActions({
  data,
  drawer,
  order,
  currentRow
}: {
  data: MenuDataState;
  drawer: MenuDrawerState;
  order: MenuOrderState;
  currentRow: Ref<MenuRow | null>;
}) {
  /** 删除行并同步当前选中态（删的是当前行时清空高亮） */
  const removeRow = async (row: MenuRow) => {
    const removed = await data.removeRows([row]);
    if (removed && String(currentRow.value?.pk) === String(row.pk)) {
      currentRow.value = null;
    }
  };

  const toggleRowActive = async (row: MenuRow, value: boolean) => {
    await data.toggleActive(row, value);
  };

  /**
   * 打开新抽屉前的未保存拦截：编辑中直接切到别的节点/动作会静默丢弃改动
   * （关闭/取消已由抽屉内守卫覆盖，这里覆盖"打开另一个编辑面"的路径）。
   */
  const openWithGuard = async (run: () => void) => {
    if (drawer.isOpen() && drawer.dirty()) {
      const choice = await drawer.confirmSwitch();
      if (choice === "cancel") return;
      if (choice === "save" && !(await drawer.saveCurrent())) return;
    }
    run();
  };

  const onNodeClick = async (row: MenuRow) => {
    currentRow.value = row;
    if (!drawer.isOpen()) {
      drawer.openEdit(row);
      return;
    }
    if (String(drawer.openPk()) === String(row.pk)) return;
    const choice = await drawer.confirmSwitch();
    if (choice === "cancel") return;
    if (choice === "save") {
      const saved = await drawer.saveCurrent();
      if (!saved) return;
    } else {
      drawer.close();
    }
    drawer.openEdit(row);
  };

  const onRowAction = (code: string, row: MenuRow) => {
    if (code === "edit") void openWithGuard(() => drawer.openEdit(row));
    else if (code === "addChild")
      void openWithGuard(() => drawer.openCreate(row));
    else if (code === "clone") void openWithGuard(() => drawer.openClone(row));
    else if (code === "permissions") {
      void openWithGuard(() => drawer.openPermission(row));
    } else if (code === "rename") drawer.openRename(row);
    else if (code === "delete") removeRow(row);
    else if (code.startsWith("move:")) {
      order.moveSibling(row, code.split(":")[1] as MoveDirection);
    }
  };

  return {
    removeRow,
    toggleRowActive,
    openWithGuard,
    onNodeClick,
    onRowAction
  };
}
