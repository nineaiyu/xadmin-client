/**
 * 菜单行右键菜单域：菜单显隐状态、坐标定位与动作清单（右键菜单与行内下拉
 * 共用同一份 buildNodeActions 声明，动作上下文由页面 hook 注入）。
 */

import { computed, reactive } from "vue";
import type { useI18n } from "vue-i18n";
import { buildNodeActions, type MenuActionContext } from "./menuActions";
import type { MenuAuths, MenuNodeAction, MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];

export function useMenuContextMenu({
  t,
  auth,
  currentRow,
  onRowAction,
  toggleRowActive
}: {
  t: TFunction;
  auth: MenuAuths;
  /** 右键同时把该行置为当前行（工具栏「生成权限码」等动作的目标） */
  currentRow: { value: MenuRow | null };
  onRowAction: (code: string, row: MenuRow) => void;
  toggleRowActive: (row: MenuRow, value: boolean) => void;
}) {
  /** 动作清单构建器（右键菜单与行内下拉共用同一份声明） */
  const actionContext: MenuActionContext = {
    t,
    auth,
    openEdit: row => onRowAction("edit", row),
    openCreate: row => onRowAction("addChild", row),
    openPermission: row => onRowAction("permissions", row),
    openRename: row => onRowAction("rename", row),
    openClone: row => onRowAction("clone", row),
    remove: row => onRowAction("delete", row),
    move: (row, direction) => onRowAction(`move:${direction}`, row),
    toggleActive: row => toggleRowActive(row, !row.isActive)
  };

  const contextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    row: null as MenuRow | null
  });

  const contextActions = computed<MenuNodeAction[]>(() =>
    contextMenu.row ? buildNodeActions(contextMenu.row, actionContext) : []
  );

  const onRowContextMenu = (event: MouseEvent, row: MenuRow) => {
    currentRow.value = row;
    contextMenu.row = row;
    contextMenu.x = event.clientX;
    contextMenu.y = event.clientY;
    contextMenu.visible = true;
  };

  const closeContextMenu = () => {
    contextMenu.visible = false;
  };

  return { contextMenu, contextActions, onRowContextMenu, closeContextMenu };
}
