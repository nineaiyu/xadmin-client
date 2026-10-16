import { computed, type Ref } from "vue";
import type { useMenuData } from "./useMenuData";
import type { useMenuFilter } from "./useMenuFilter";
import type { useMenuInteractions } from "./useMenuInteractions";
import type { MenuAuths, MenuRow } from "./types";
import type { TreeInstance } from "element-plus";

/**
 * 菜单页视图模型装配（自 hook.tsx 抽出，控制单文件行数）：把数据 / 筛选 /
 * 树交互各域的引用摊平成页面模板消费的扁平对象。
 */
export function buildMenuViewModel({
  auth,
  rootRef,
  treeRef,
  currentRow,
  data,
  filter,
  renderedTree,
  interactions
}: {
  auth: MenuAuths;
  rootRef: Ref<HTMLElement | undefined>;
  treeRef: Ref<TreeInstance | undefined>;
  currentRow: Ref<MenuRow | null>;
  data: ReturnType<typeof useMenuData>;
  filter: ReturnType<typeof useMenuFilter>;
  renderedTree: Ref<MenuRow[]>;
  interactions: ReturnType<typeof useMenuInteractions>;
}) {
  const { selection, rowActions, tree, toolbar } = interactions;
  const { contextMenu, contextActions, onRowContextMenu, closeContextMenu } =
    interactions;

  return {
    auth,
    rootRef,
    treeRef,
    loading: data.loading,
    stats: data.stats,
    treeData: data.treeData,
    renderedTree,
    rowIndex: data.rowIndex,
    currentRow,
    filter: filter.filter,
    visibleTree: filter.visibleTree,
    matchPks: filter.matchPks,
    matchCount: computed(() => filter.matchPks.value.size),
    filterActive: filter.filterActive,
    checkStrictly: tree.checkStrictly,
    isExpandAll: computed(() => filter.filter.expandLevel >= 3),
    busyPks: data.busyPks,
    multiMode: selection.multiMode,
    checkedCount: selection.checkedCount,
    contextMenu,
    contextActions,
    defaultProps: tree.defaultProps,
    allowDrop: tree.allowDrop,
    handleDrop: tree.handleDrop,
    handleCheck: tree.handleCheck,
    nodeClick: tree.nodeClick,
    onRowAction: rowActions.onRowAction,
    onRowContextMenu,
    closeContextMenu,
    toggleRowActive: rowActions.toggleRowActive,
    onAdd: toolbar.onAdd,
    onGeneratePermissions: toolbar.onGeneratePermissions,
    onPermissionAudit: toolbar.onPermissionAudit,
    onExport: toolbar.onExport,
    onImport: toolbar.onImport,
    onRefresh: toolbar.onRefresh,
    onResetFilter: toolbar.onResetFilter,
    onToggleAll: toolbar.onToggleAll,
    onBatchActive: toolbar.onBatchActive,
    onBatchDelete: toolbar.onBatchDelete,
    onSelectAll: toolbar.onSelectAll,
    onClearSelection: toolbar.onClearSelection,
    toggleMultiMode: selection.toggleMultiMode
  };
}
