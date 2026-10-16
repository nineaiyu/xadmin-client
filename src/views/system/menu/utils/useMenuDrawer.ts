/**
 * 菜单新增/编辑抽屉编排：打开（新增/编辑/克隆）、脏检查、保存、快速重命名。
 *
 * 新增与编辑共用**同一个抽屉**（旧实现：新增走弹窗、编辑走常驻表单，两套壳）；
 * 关闭/取消/切换节点三处都做未保存拦截，避免静默丢弃编辑内容。
 *
 * 子模块：状态机 useMenuDrawerCore / 抽屉配置 menuDrawerOptions /
 * 保存执行 menuDrawerSave / 打开动作 menuDrawerOpeners /
 * 未保存拦截 menuDrawerSwitch / 快速重命名 useMenuRename /
 * 权限码生成 useMenuPermissionCode；类型推断 inferType 归入 normalize.ts。
 */

import { createMenuNodeSaver } from "./menuDrawerSave";
import {
  openMenuClone,
  openMenuCreate,
  openMenuEdit
} from "./menuDrawerOpeners";
import { confirmSwitchUnsaved, saveCurrentDrawer } from "./menuDrawerSwitch";
import { useMenuDrawerCore } from "./useMenuDrawerCore";
import { useMenuRename } from "./useMenuRename";
import { useMenuPermissionCode } from "./useMenuPermissionCode";
import type { MenuDrawerDeps, UnsavedChoice } from "./menuDrawerTypes";
import type { MenuRow } from "./types";

export type { UnsavedChoice } from "./menuDrawerTypes";

export function useMenuDrawer({
  api,
  auth,
  t,
  treeData,
  rowIndex,
  choicesDict,
  modelList,
  viewList,
  menuUrlList,
  saveNode,
  renameNode,
  setRowsActive,
  reload,
  onSaved
}: MenuDrawerDeps) {
  const save = createMenuNodeSaver({
    t,
    saveNode,
    setRowsActive,
    rowIndex,
    onSaved
  });

  const core = useMenuDrawerCore({
    t,
    auth,
    treeData,
    choicesDict,
    modelList,
    viewList,
    menuUrlList,
    submit: save
  });

  // 快速重命名与权限码生成（与抽屉核心状态无耦合的独立弹窗动作）
  const { openRename } = useMenuRename({ t, renameNode });
  const { openPermission } = useMenuPermissionCode({ t, menuUrlList, reload });

  /** 切换节点前的未保存拦截 */
  const confirmSwitch = (): Promise<UnsavedChoice> =>
    confirmSwitchUnsaved({ t, isOpen: core.isOpen, dirty: core.dirty });

  /** 保存当前抽屉（「保存并切换」用；成功后关闭抽屉） */
  const saveCurrent = (): Promise<boolean> =>
    saveCurrentDrawer({
      formRef: core.formRef,
      isAdd: Boolean(core.current.value?.isAdd),
      save,
      close: core.close
    });

  return {
    formRef: core.formRef,
    isOpen: core.isOpen,
    openPk: core.openPk,
    dirty: core.dirty,
    openCreate: (parent?: MenuRow | null) =>
      openMenuCreate({ t, open: core.open, parent }),
    openEdit: (row: MenuRow) => openMenuEdit({ t, open: core.open, row }),
    openClone: (row: MenuRow) =>
      openMenuClone({ t, open: core.open, rowIndex, row }),
    openRename,
    openPermission,
    confirmSwitch,
    saveCurrent,
    close: core.close,
    api
  };
}
