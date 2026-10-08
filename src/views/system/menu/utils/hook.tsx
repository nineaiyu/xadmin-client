/**
 * 菜单管理页组装入口：数据 / 筛选 / 树交互 / 排序 / 多选 / 抽屉六块能力的接线。
 *
 * 页面（index.vue）只消费本文件返回的扁平引用，逻辑全部落在各职责模块：
 * - useMenuData          数据源持有与局部更新原语（变更动作/导入导出经其组装）；
 * - useMenuMutations     变更动作：保存/重命名/启停/删除/批量/排序；
 * - useMenuTransfer      导入导出通道；
 * - useMenuMeta          字典/接口清单/关联模型/组件路径等下拉与候选装配；
 * - useMenuFilter        关键字/类型/状态/展开层级与可见树；
 * - useMenuTree/useMenuSelection/useMenuOrder/useTreeHeight  树交互域拆分（展开、多选、排序、视口高度）；
 * - useMenuDrawer        新增/编辑/克隆/重命名/权限码抽屉编排；
 * - useMenuRowActions    行点击与行操作分发（含未保存拦截，工具栏复用）；
 * - useMenuContextMenu   行右键菜单状态与动作清单（与行内下拉共用声明）；
 * - useMenuToolbar       工具栏动作（新增/权限码/权限检测/导入导出/批量）；
 * - menuActions          行操作清单与危险动作确认。
 */

import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { useMenuData } from "./useMenuData";
import { useMenuFilter } from "./useMenuFilter";
import { useMenuTree } from "./useMenuTree";
import { useMenuSelection } from "./useMenuSelection";
import { useMenuOrder } from "./useMenuOrder";
import { useMenuDrawer } from "./useMenuDrawer";
import { useMenuRowActions } from "./useMenuRowActions";
import { useMenuContextMenu } from "./useMenuContextMenu";
import { useMenuToolbar } from "./useMenuToolbar";
import type { MenuAuths, MenuRow } from "./types";

export function useMenu() {
  const { t } = useI18n();
  const auth = usePageAuth([
    // 排序/权限码/接口清单/影响面/批量更新/权限检测为菜单页扩展动作
    "rank",
    "permissions",
    "apiUrl",
    "impact",
    "batchUpdate",
    "permissionAudit"
  ]) as MenuAuths;

  const treeRef = ref();
  const rootRef = ref<HTMLElement>();
  const currentRow = ref<MenuRow | null>(null);

  const data = useMenuData();
  const filter = useMenuFilter(data.treeData);

  /** el-tree 绑定的本地副本：拖拽会就地改写数据，不能把 computed 结果直接交给它 */
  const renderedTree = ref<MenuRow[]>([]);
  watch(
    filter.visibleTree,
    value => {
      renderedTree.value = value;
    },
    { immediate: true }
  );

  /** 保存/新增后需要临时展开的祖先（与筛选展开层级取并集） */
  const revealPks = ref<Set<string>>(new Set());
  const expandPks = computed(() => {
    const merged = new Set(filter.expandPks.value);
    revealPks.value.forEach(pk => merged.add(pk));
    return merged;
  });

  const order = useMenuOrder({
    api: data.api,
    treeData: data.treeData,
    renderedTree,
    rowIndex: data.rowIndex,
    patchRows: data.patchRows,
    submitRank: data.submitRank,
    reload: data.getMenuData
  });

  const selection = useMenuSelection({
    treeRef,
    rowIndex: data.rowIndex,
    setRowsActive: data.setRowsActive,
    removeRows: data.removeRows
  });

  const drawer = useMenuDrawer({
    api: data.api,
    auth,
    t,
    treeData: data.treeData,
    rowIndex: data.rowIndex,
    choicesDict: data.choicesDict,
    modelList: data.modelList,
    viewList: data.viewList,
    menuUrlList: data.menuUrlList,
    saveNode: data.saveNode,
    renameNode: data.renameNode,
    setRowsActive: data.setRowsActive,
    reload: data.getMenuData,
    onSaved: pk => {
      if (pk === undefined) return;
      revealRow(pk);
      const row = data.rowIndex.value.byPk.get(String(pk));
      if (row) currentRow.value = row;
    }
  });

  /** 展开某节点的全部祖先并滚动定位（新增/保存后「看得见改了什么」） */
  const revealRow = (pk: number | string) => {
    const next = new Set(revealPks.value);
    let cursor = data.rowIndex.value.byPk.get(String(pk));
    const visited = new Set<string>();
    while (cursor) {
      const key = String(cursor.pk);
      if (visited.has(key)) break;
      visited.add(key);
      next.add(key);
      cursor =
        cursor.parent === null
          ? undefined
          : data.rowIndex.value.byPk.get(String(cursor.parent));
    }
    revealPks.value = next;
    nextTick(() => tree.scrollToPk(String(pk)));
  };

  // ---------------------------------------------------------------- 行交互

  const rowActions = useMenuRowActions({ data, drawer, order, currentRow });

  const tree = useMenuTree({
    treeRef,
    visibleTree: filter.visibleTree,
    expandPks,
    firstMatchPk: filter.firstMatchPk,
    onNodeClick: rowActions.onNodeClick,
    onDrop: order.handleDrag,
    onCheck: selection.setChecked
  });

  const { contextMenu, contextActions, onRowContextMenu, closeContextMenu } =
    useMenuContextMenu({
      t,
      auth,
      currentRow,
      onRowAction: rowActions.onRowAction,
      toggleRowActive: rowActions.toggleRowActive
    });

  // ---------------------------------------------------------------- 工具栏

  const toolbar = useMenuToolbar({
    t,
    treeRef,
    currentRow,
    revealRow,
    openWithGuard: rowActions.openWithGuard,
    drawer,
    data,
    filter,
    selection
  });

  // ---------------------------------------------------------------- 初始化

  onMounted(() => {
    data.getMenuData();
    data.getMenuApiList(auth);
    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void) => number;
      }
    ).requestIdleCallback;
    if (typeof idle === "function") idle(() => data.loadViews());
    else setTimeout(() => data.loadViews(), 0);
    if (hasAuth("list:SystemModelLabelField")) data.loadModels();
  });

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
