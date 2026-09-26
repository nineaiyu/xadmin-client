/**
 * 菜单树交互域：展开/勾选/拖拽约束与定位、多选批量、同层排序与拖拽提交、视口高度。
 *
 * 四个 hook 绑定同一个 el-tree 实例（treeRef），依赖全部注入、彼此无共享状态；
 * 因消费方唯一（页面 hook 与 index.vue）且相互联动（勾选↔多选、拖拽↔排序、
 * 视口↔展开），按内聚性合并为一个模块，拆分函数只为阅读聚焦。
 */

import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Reactive,
  type Ref
} from "vue";
import { useI18n } from "vue-i18n";
import type { TreeInstance } from "element-plus";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import type { menuApi } from "@/api/system/menu";
import { MenuChoices } from "@/views/system/constants";
import { flattenMenuTree } from "./normalize";
import type { MenuRow, MoveDirection } from "./types";

// ---------------------------------------------------------------- 视口高度

/**
 * 树滚动区高度测量。
 *
 * 取代旧实现的魔法值（右栏 `calc(100vh - 145px)`、左树 `calc(100vh - 200px)` 两处
 * 口径不一致导致栏底不对齐）：按「容器顶部位置 + 视口高」实测，随窗口与上方内容
 * （工具栏换行、批量条出现）变化重算。
 *
 * 期望高度只依赖滚动区顶部位置（与自身高度无关），因此不会与 ResizeObserver 振荡。
 */

const MIN_HEIGHT = 280;
const OFFSET_BOTTOM = 28;

export function useTreeHeight(
  rootRef: Ref<HTMLElement | undefined>,
  selector: string
) {
  const height = ref(420);
  let raf = 0;
  let observer: ResizeObserver | undefined;

  const measure = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const el = rootRef.value?.querySelector<HTMLElement>(selector);
      if (!el || !el.isConnected) return;
      const rect = el.getBoundingClientRect();
      if (!rect.height && !rect.top) return;
      const next = Math.max(
        MIN_HEIGHT,
        Math.round(window.innerHeight - rect.top - OFFSET_BOTTOM)
      );
      if (next !== height.value) height.value = next;
    });
  };

  onMounted(() => {
    measure();
    window.addEventListener("resize", measure);
    if (rootRef.value && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(rootRef.value);
    }
  });

  onUnmounted(() => {
    window.removeEventListener("resize", measure);
    observer?.disconnect();
    cancelAnimationFrame(raf);
  });

  return { height, measure };
}

// ---------------------------------------------------------------- 树交互

/**
 * 菜单树交互：展开层级应用、筛选后定位、勾选联动、拖拽约束与节点样式。
 *
 * 展开状态由「数据侧计算的 expandPks」驱动（数据/筛选变化后重新应用），
 * 而不是依赖 el-tree 的 default-expand-all：树在筛选时会被替换，内部展开态
 * 会随节点重建丢失，只有显式应用才能保证「筛选后命中路径可见」。
 */

interface MenuTreeDeps {
  treeRef: Ref<TreeInstance | undefined>;
  visibleTree: Ref<MenuRow[]>;
  expandPks: Ref<Set<string>>;
  firstMatchPk: Ref<string>;
  onNodeClick: (row: MenuRow) => void;
  /** el-tree 拖拽回调入参为内部 Node 实例：边界收窄为 unknown，内部按 data 取值 */
  onDrop: (draggingNode: unknown, dropNode: unknown, dropType: string) => void;
  onCheck: (checkedPks: Array<number | string>) => void;
}

export function useMenuTree({
  treeRef,
  visibleTree,
  expandPks,
  firstMatchPk,
  onNodeClick,
  onDrop,
  onCheck
}: MenuTreeDeps) {
  /** 勾选联动：默认父子联动（勾选目录=整棵子树），可在「更多」里切为独立勾选 */
  const checkStrictly = ref(false);

  /** 应用当前展开层级（数据/筛选变化后调用） */
  const applyExpansion = () => {
    const tree = treeRef.value;
    if (!tree?.getNode) return;
    // 必须递归整棵可见树：只遍历根层会漏掉深层命中路径的展开
    // （表现为「搜索命中 N 条但一条都看不到」）
    const walk = (rows: MenuRow[]) => {
      rows.forEach(row => {
        if (!row.children.length) return;
        const node = tree.getNode(String(row.pk));
        if (node) node.expanded = expandPks.value.has(String(row.pk));
        walk(row.children);
      });
    };
    walk(visibleTree.value);
  };

  const scrollToPk = (pk: string) => {
    // el-tree 的 Node 实例带 $el（公开行为，类型声明未覆盖）
    const node = treeRef.value?.getNode(pk) as unknown as
      { $el?: HTMLElement } | null | undefined;
    node?.$el?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // 入参收敛为 unknown：el-tree 的 TreeOptionProps 回调参数与 MenuRow 名义不同，
  // 直接用 MenuRow 会因逆变检查不通过（运行期同构）
  const nodeClass = (data: unknown) =>
    (data as MenuRow).isActive ? "" : "is-disabled";

  const defaultProps = {
    children: "children",
    label: (data: unknown) => (data as MenuRow).meta.title,
    class: nodeClass
  };

  /** 拖拽约束：权限点不能再挂子级（其 path/method 是接口授权语义） */
  const allowDrop = (
    _draggingNode: unknown,
    dropNode: unknown,
    type: string
  ) => {
    const data = (dropNode as { data?: MenuRow } | null | undefined)?.data;
    return !(type === "inner" && data?.menuType === MenuChoices.PERMISSION);
  };

  const handleDrop = (
    draggingNode: unknown,
    dropNode: unknown,
    dropType: string
  ) => {
    onDrop(draggingNode, dropNode, dropType);
  };

  const handleCheck = (
    _data: unknown,
    info: { checkedNodes: Array<unknown> }
  ) => {
    // el-tree 的 check 载荷里 checkedNodes 是「节点 data」而非 Node 实例
    // （store.getCheckedNodes() 返回 child.data），此处对两种形态都兼容
    onCheck(
      info.checkedNodes
        .map(node => {
          const item = node as Partial<MenuRow> & { data?: MenuRow };
          return (item.pk ?? item.data?.pk) as number | string | undefined;
        })
        .filter((pk): pk is number | string => pk !== undefined)
    );
  };

  const nodeClick = (data: MenuRow) => onNodeClick(data);

  watch(
    [visibleTree, expandPks],
    () => {
      nextTick(applyExpansion);
    },
    { flush: "post" }
  );

  watch(firstMatchPk, pk => {
    if (!pk) return;
    nextTick(() => scrollToPk(pk));
  });

  return {
    checkStrictly,
    defaultProps,
    applyExpansion,
    scrollToPk,
    allowDrop,
    handleDrop,
    handleCheck,
    nodeClick
  };
}

// ---------------------------------------------------------------- 多选批量

/**
 * 多选模式与批量操作：默认收起复选框（保持树的干净），开启后出现批量操作条。
 *
 * 联动口径：默认父子联动（勾选目录 = 整棵子树），可在工具栏「更多」切为独立勾选；
 * 批量启停会自动带上被勾选目录的后代（半选父级不进入 getCheckedKeys）。
 */

interface MenuSelectionDeps {
  treeRef: Ref<TreeInstance | undefined>;
  rowIndex: Ref<{ byPk: Map<string, MenuRow> }>;
  /** 批量启停（内部含「连同后代」与确认） */
  setRowsActive: (rows: MenuRow[], isActive: boolean) => Promise<boolean>;
  /** 批量删除（内部含影响面确认） */
  removeRows: (rows: MenuRow[]) => Promise<boolean>;
}

export function useMenuSelection({
  treeRef,
  rowIndex,
  setRowsActive,
  removeRows
}: MenuSelectionDeps) {
  const multiMode = ref(false);
  const checkedPks = ref<Array<number | string>>([]);

  const checkedRows = computed(() =>
    checkedPks.value
      .map(pk => rowIndex.value.byPk.get(String(pk)))
      .filter((row): row is MenuRow => Boolean(row))
  );
  const checkedCount = computed(() => checkedRows.value.length);

  const setChecked = (pks: Array<number | string>) => {
    checkedPks.value = pks;
  };

  const clearSelection = () => {
    checkedPks.value = [];
    treeRef.value?.setCheckedKeys([], false);
  };

  const toggleMultiMode = (enabled: boolean) => {
    multiMode.value = enabled;
    if (!enabled) clearSelection();
  };

  /** 全选可见树（含各层节点；联动模式下等价于勾选全部） */
  const selectAllVisible = (rows: MenuRow[]) => {
    const pks: Array<number | string> = [];
    const walk = (list: MenuRow[]) => {
      list.forEach(row => {
        pks.push(row.pk);
        if (row.children.length) walk(row.children);
      });
    };
    walk(rows);
    treeRef.value?.setCheckedKeys(pks, false);
    checkedPks.value = pks;
  };

  const batchActive = async (isActive: boolean) => {
    const ok = await setRowsActive(checkedRows.value, isActive);
    if (ok) clearSelection();
  };

  const batchRemove = async () => {
    const ok = await removeRows(checkedRows.value);
    if (ok) clearSelection();
  };

  return {
    multiMode,
    checkedPks,
    checkedRows,
    checkedCount,
    setChecked,
    clearSelection,
    toggleMultiMode,
    selectAllVisible,
    batchActive,
    batchRemove
  };
}

// ---------------------------------------------------------------- 排序

/**
 * 菜单排序：同层上移/下移/置顶（键盘可达）与拖拽（含换父）。
 *
 * 排序统一落到后端 `rank` 接口（接收前序 pk 列表，单条 SQL 批量写 rank）。
 * 拖拽只写「换了父级」的节点（PATCH parent），顺序由 rank 提交承载——旧实现
 * 每次拖拽都无差别 PATCH 一次父级，制造无意义的审计记录。
 */

interface MenuOrderDeps {
  api: Reactive<typeof menuApi>;
  /** 源树（数据层派生） */
  treeData: Ref<MenuRow[]>;
  /** 渲染树（el-tree 直接绑定的本地副本，拖拽会就地改写） */
  renderedTree: Ref<MenuRow[]>;
  rowIndex: Ref<{ byParent: Map<string, MenuRow[]> }>;
  patchRows: (patch: Map<string, Record<string, unknown>>) => void;
  submitRank: (pks: Array<number | string>) => Promise<boolean>;
  reload: () => void;
}

export function useMenuOrder({
  api,
  treeData,
  renderedTree,
  rowIndex,
  patchRows,
  submitRank,
  reload
}: MenuOrderDeps) {
  const { t } = useI18n();

  /** 前序 pk 顺序 + rank 写回（rank 取前序序号，与后端 rank 接口口径一致） */
  const persistOrder = async (pks: Array<string | number>) => {
    const patch = new Map<string, Record<string, unknown>>();
    pks.forEach((pk, index) => patch.set(String(pk), { rank: index + 1 }));
    patchRows(patch);
    const ok = await submitRank(pks);
    if (!ok) reload();
    return ok;
  };

  /** 同层移动：把 pk 序列在所属兄弟区间内重排后提交 */
  const moveSibling = async (row: MenuRow, direction: MoveDirection) => {
    const parentKey = row.parent === null ? "" : String(row.parent);
    const siblings = rowIndex.value.byParent.get(parentKey) ?? [];
    const index = siblings.findIndex(
      item => String(item.pk) === String(row.pk)
    );
    if (index < 0) return false;
    const target =
      direction === "up" ? index - 1 : direction === "down" ? index + 1 : 0;
    if (target < 0 || target >= siblings.length || target === index) {
      // 边界（已在首/末位）不属于失败：静默返回，避免噪音提示
      return false;
    }

    const order = flattenMenuTree(treeData.value).map(item => String(item.pk));
    const siblingPks = siblings.map(item => String(item.pk));
    const positions = siblingPks
      .map(pk => order.indexOf(pk))
      .filter(pos => pos >= 0);
    const reordered = [...siblingPks];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    positions.forEach((position, i) => {
      order[position] = reordered[i];
    });

    const ok = await persistOrder(order);
    if (ok) message(t("systemMenu.result.sorted"), { type: "success" });
    return ok;
  };

  /**
   * 拖拽落点处理：
   * - `inner` = 成为目标子级；`before/after` = 与目标同层插入；
   * - 仅当父级真的变化时才 PATCH 父级（顺序交给 rank）。
   */
  const handleDrag = async (
    draggingNode: unknown,
    dropNode: unknown,
    dropType: string
  ) => {
    const node = (draggingNode as { data?: MenuRow } | null | undefined)?.data;
    const target = (dropNode as { data?: MenuRow } | null | undefined)?.data;
    if (!node || !target) return;
    const nextParent =
      dropType === "inner"
        ? target.pk
        : (target.parent as number | string | null);

    if (String(nextParent ?? "") !== String(node.parent ?? "")) {
      const res = await api.partialUpdate(node.pk as number, {
        parent: nextParent ?? null
      });
      if (res.code !== SUCCESS_CODE) {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        reload();
        return;
      }
      patchRows(new Map([[String(node.pk), { parent: nextParent ?? null }]]));
    }

    // el-tree 已就地改写渲染树：按渲染树的前序顺序提交 rank
    const order = flattenMenuTree(renderedTree.value).map(item => item.pk);
    const ok = await persistOrder(order);
    if (ok) message(t("systemMenu.result.sorted"), { type: "success" });
  };

  return { moveSibling, handleDrag };
}
