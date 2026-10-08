/**
 * 菜单页工具栏动作：新增、生成权限码、权限检测报告、导入导出、刷新、
 * 筛选重置/展开层级与批量操作入口。抽屉守卫（openWithGuard）由页面 hook 注入，
 * 保证「编辑中打开别的编辑面」先走未保存拦截。
 */

import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import MenuPermissionAuditDialog from "../components/MenuPermissionAuditDialog.vue";
import type { useMenuData } from "./useMenuData";
import type { useMenuFilter } from "./useMenuFilter";
import type { useMenuDrawer } from "./useMenuDrawer";
import type { useMenuSelection } from "./useMenuSelection";
import type { MenuRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
type MenuDataState = ReturnType<typeof useMenuData>;
type MenuFilterState = ReturnType<typeof useMenuFilter>;
type MenuDrawerState = ReturnType<typeof useMenuDrawer>;
type MenuSelectionState = ReturnType<typeof useMenuSelection>;

export function useMenuToolbar({
  t,
  treeRef,
  currentRow,
  revealRow,
  openWithGuard,
  drawer,
  data,
  filter,
  selection
}: {
  t: TFunction;
  treeRef: Ref;
  currentRow: { value: MenuRow | null };
  /** 保存/定位后展开祖先并滚动到行（见页面 hook 的 revealRow） */
  revealRow: (pk: number | string) => void;
  openWithGuard: (run: () => void) => Promise<void> | void;
  drawer: MenuDrawerState;
  data: MenuDataState;
  filter: MenuFilterState;
  selection: MenuSelectionState;
}) {
  const onAdd = () => void openWithGuard(() => drawer.openCreate(null));

  const onGeneratePermissions = () => {
    if (!currentRow.value) return;
    // 二级弹层前先收起抽屉（未保存时走守卫，不强收）
    const target = currentRow.value;
    void openWithGuard(() => {
      if (drawer.isOpen()) drawer.close();
      drawer.openPermission(target);
    });
  };

  /** 权限检测：只读报告，定位时收起弹层并展开高亮库内权限点 */
  const onPermissionAudit = () => {
    void openWithGuard(() => {
      if (drawer.isOpen()) drawer.close();
      addDialog({
        title: t("systemMenu.permissionAudit.title"),
        width: dialogSize("xl"),
        draggable: true,
        destroyOnClose: true,
        closeOnClickModal: false,
        hideFooter: true,
        contentRenderer: ({ options, index }) =>
          h(MenuPermissionAuditDialog, {
            onLocate: (pk: string) => {
              closeDialog(options, index);
              const row = data.rowIndex.value.byPk.get(String(pk));
              if (!row) return;
              currentRow.value = row;
              revealRow(row.pk);
            }
          })
      });
    });
  };

  const onExport = () => data.exportData(treeRef.value);
  const onImport = () => data.importData();
  const onRefresh = () => data.getMenuData();
  const onResetFilter = () => filter.reset();
  const onToggleAll = (expand: boolean) => {
    filter.filter.expandLevel = expand ? 3 : 1;
  };
  const onBatchActive = (isActive: boolean) => selection.batchActive(isActive);
  const onBatchDelete = () => selection.batchRemove();
  const onSelectAll = () =>
    selection.selectAllVisible(filter.visibleTree.value);
  const onClearSelection = () => selection.clearSelection();

  return {
    onAdd,
    onGeneratePermissions,
    onPermissionAudit,
    onExport,
    onImport,
    onRefresh,
    onResetFilter,
    onToggleAll,
    onBatchActive,
    onBatchDelete,
    onSelectAll,
    onClearSelection
  };
}
