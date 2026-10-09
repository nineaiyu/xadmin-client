import type { Ref } from "vue";
import { useMenuOrder } from "./useMenuOrder";
import { useMenuSelection } from "./useMenuSelection";
import type { useMenuDrawer } from "./useMenuDrawer";
import { useMenuRowActions } from "./useMenuRowActions";
import { useMenuTree } from "./useMenuTree";
import { useMenuContextMenu } from "./useMenuContextMenu";
import { useMenuToolbar } from "./useMenuToolbar";
import type { useI18n } from "vue-i18n";
import type { useMenuData } from "./useMenuData";
import type { useMenuFilter } from "./useMenuFilter";
import type { useMenuReveal } from "./useMenuReveal";
import type { MenuAuths, MenuRow } from "./types";
import type { TreeInstance } from "element-plus";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 菜单交互域接线（自 hook.tsx 抽出）：排序 / 多选 / 抽屉 / 行操作 / 树 /
 * 右键菜单 / 工具栏。各子模块保持原职责，本文件只负责依赖注入顺序。
 */
export function useMenuInteractions({
  t,
  auth,
  treeRef,
  currentRow,
  data,
  filter,
  renderedTree,
  reveal,
  drawer
}: {
  t: TFunction;
  auth: MenuAuths;
  treeRef: Ref<TreeInstance | undefined>;
  currentRow: Ref<MenuRow | null>;
  data: ReturnType<typeof useMenuData>;
  filter: ReturnType<typeof useMenuFilter>;
  renderedTree: Ref<MenuRow[]>;
  reveal: ReturnType<typeof useMenuReveal>;
  drawer: ReturnType<typeof useMenuDrawer>;
}) {
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

  const rowActions = useMenuRowActions({ data, drawer, order, currentRow });

  const tree = useMenuTree({
    treeRef,
    visibleTree: filter.visibleTree,
    expandPks: reveal.expandPks,
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

  const toolbar = useMenuToolbar({
    t,
    treeRef,
    currentRow,
    revealRow: reveal.revealRow,
    openWithGuard: rowActions.openWithGuard,
    drawer,
    data,
    filter,
    selection
  });

  return {
    order,
    selection,
    drawer,
    rowActions,
    tree,
    contextMenu,
    contextActions,
    onRowContextMenu,
    closeContextMenu,
    toolbar
  };
}
