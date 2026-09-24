/**
 * 菜单管理页组装入口：数据 / 筛选 / 树交互 / 排序 / 多选 / 抽屉六块能力的接线。
 *
 * 页面（index.vue）只消费本文件返回的扁平引用，逻辑全部落在各职责模块：
 * - useMenuData      数据拉取与增删改（含影响面预检、批量启停、导入导出）
 * - useMenuFilter    关键字/类型/状态/展开层级与可见树
 * - useMenuTree      树的展开应用、勾选、拖拽约束与定位
 * - useMenuOrder     同层上移下移置顶与拖拽排序提交
 * - useMenuSelection 多选模式与批量操作条
 * - useMenuDrawer    新增/编辑/克隆/重命名/权限码抽屉编排
 */

import {
  computed,
  getCurrentInstance,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch
} from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, getDefaultAuths } from "@/router/utils";
import { useMenuData } from "./useMenuData";
import { useMenuFilter } from "./useMenuFilter";
import { useMenuTree } from "./useMenuTree";
import { useMenuOrder, type MoveDirection } from "./useMenuOrder";
import { useMenuSelection } from "./useMenuSelection";
import { useMenuDrawer } from "./useMenuDrawer";
import { buildNodeActions, type MenuActionContext } from "./menuActions";
import type { MenuAuths, MenuNodeAction, MenuRow } from "./types";

export function useMenu() {
  const { t } = useI18n();
  const instance = getCurrentInstance();

  const auth = reactive({
    // 排序/权限码/接口清单/影响面/批量更新为菜单页扩展动作
    ...getDefaultAuths(instance, [
      "rank",
      "permissions",
      "apiUrl",
      "impact",
      "batchUpdate"
    ])
  }) as MenuAuths;

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

  // ---------------------------------------------------------------- 树交互

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

  const tree = useMenuTree({
    treeRef,
    visibleTree: filter.visibleTree,
    expandPks,
    firstMatchPk: filter.firstMatchPk,
    onNodeClick,
    onDrop: order.handleDrag,
    onCheck: selection.setChecked
  });

  // ---------------------------------------------------------------- 行操作

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

  // ---------------------------------------------------------------- 工具栏

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
    onRowAction,
    onRowContextMenu,
    closeContextMenu,
    toggleRowActive,
    onAdd,
    onGeneratePermissions,
    onExport,
    onImport,
    onRefresh,
    onResetFilter,
    onToggleAll,
    onBatchActive,
    onBatchDelete,
    onSelectAll,
    onClearSelection,
    toggleMultiMode: selection.toggleMultiMode
  };
}
