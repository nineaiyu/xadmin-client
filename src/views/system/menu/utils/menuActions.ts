/**
 * 菜单行操作清单：行内「更多」下拉与右键菜单共用同一份声明。
 *
 * 单一来源的价值：动作的可用条件（权限点 / 节点类型）只写一次，
 * 两个入口不会漂移；新增动作只需在此追加。
 */

import type { useI18n } from "vue-i18n";
import { copyTextToClipboard } from "@pureadmin/utils";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
import { MenuChoices } from "@/views/system/constants";
import { rowPathText } from "./normalize";
import type { MenuAuths, MenuNodeAction, MenuRow } from "./types";
import type { MoveDirection } from "./useMenuOrder";

import EditPen from "~icons/ep/edit-pen";
import DocumentAdd from "~icons/ep/document-add";
import Key from "~icons/ep/key";
import CopyDocument from "~icons/ep/copy-document";
import Files from "~icons/ep/files";
import ArrowUp from "~icons/ep/arrow-up-bold";
import ArrowDown from "~icons/ep/arrow-down-bold";
import Top from "~icons/ep/top";
import SwitchButton from "~icons/ep/switch-button";
import Delete from "~icons/ep/delete";

type TFunction = ReturnType<typeof useI18n>["t"];

export interface MenuActionContext {
  t: TFunction;
  auth: MenuAuths;
  openEdit: (row: MenuRow) => void;
  openCreate: (parent: MenuRow) => void;
  openPermission: (row: MenuRow) => void;
  openRename: (row: MenuRow) => void;
  openClone: (row: MenuRow) => void;
  remove: (row: MenuRow) => void;
  move: (row: MenuRow, direction: MoveDirection) => void;
  /** 行内启停：值取反 */
  toggleActive: (row: MenuRow) => void;
}

/** 复制并提示（失败给出可读原因，不静默） */
function copy(value: string) {
  if (!value) return;
  const ok = copyTextToClipboard(value);
  message(transformI18n(ok ? "results.copySuccess" : "results.copyFailed"), {
    type: ok ? "success" : "error"
  });
}

/** 组装某个菜单节点的可用动作（无权限的动作不进入清单） */
export function buildNodeActions(
  row: MenuRow,
  ctx: MenuActionContext
): MenuNodeAction[] {
  const { t, auth } = ctx;
  const isPermission = row.menuType === MenuChoices.PERMISSION;
  const actions: MenuNodeAction[] = [];

  if (auth.partialUpdate) {
    actions.push({
      code: "edit",
      label: t("buttons.edit"),
      icon: EditPen,
      run: () => ctx.openEdit(row)
    });
  }
  if (auth.create && !isPermission) {
    actions.push({
      code: "addChild",
      label: t("systemMenu.action.addChild"),
      icon: DocumentAdd,
      run: () => ctx.openCreate(row)
    });
  }
  if (auth.permissions && row.menuType === MenuChoices.MENU) {
    actions.push({
      code: "permissions",
      label: t("systemMenu.addPermissions"),
      icon: Key,
      run: () => ctx.openPermission(row)
    });
  }
  if (auth.create) {
    actions.push({
      code: "clone",
      label: t("systemMenu.action.clone"),
      icon: Files,
      run: () => ctx.openClone(row)
    });
  }
  if (auth.partialUpdate) {
    actions.push({
      code: "rename",
      label: t("systemMenu.action.rename"),
      icon: EditPen,
      run: () => ctx.openRename(row)
    });
  }

  actions.push({
    code: "copyPath",
    label: isPermission
      ? t("systemMenu.action.copyPermissionPath")
      : t("systemMenu.action.copyPath"),
    icon: CopyDocument,
    run: () => copy(isPermission ? row.path : rowPathText(row))
  });
  if (isPermission) {
    actions.push({
      code: "copyCode",
      label: t("systemMenu.action.copyCode"),
      icon: CopyDocument,
      run: () => copy(row.name)
    });
  }

  if (auth.rank) {
    actions.push({
      code: "moveUp",
      label: t("systemMenu.action.moveUp"),
      icon: ArrowUp,
      run: () => ctx.move(row, "up")
    });
    actions.push({
      code: "moveDown",
      label: t("systemMenu.action.moveDown"),
      icon: ArrowDown,
      run: () => ctx.move(row, "down")
    });
    actions.push({
      code: "moveTop",
      label: t("systemMenu.action.moveTop"),
      icon: Top,
      run: () => ctx.move(row, "top")
    });
  }

  if (auth.partialUpdate) {
    actions.push({
      code: "toggleActive",
      label: row.isActive
        ? t("systemMenu.action.disable")
        : t("systemMenu.action.enable"),
      icon: SwitchButton,
      divided: true,
      run: () => ctx.toggleActive(row)
    });
  }
  if (auth.destroy) {
    actions.push({
      code: "delete",
      label: t("buttons.delete"),
      icon: Delete,
      danger: true,
      run: () => ctx.remove(row)
    });
  }
  return actions;
}
