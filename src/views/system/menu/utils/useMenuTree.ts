/**
 * 菜单树交互：展开层级应用、筛选后定位、勾选联动、拖拽约束与节点样式。
 *
 * 展开状态由「数据侧计算的 expandPks」驱动（数据/筛选变化后重新应用），
 * 而不是依赖 el-tree 的 default-expand-all：树在筛选时会被替换，内部展开态
 * 会随节点重建丢失，只有显式应用才能保证「筛选后命中路径可见」。
 */

import { nextTick, ref, watch, type Ref } from "vue";
import type { TreeInstance } from "element-plus";
import { MenuChoices } from "@/views/system/constants";
import type { MenuRow } from "./types";

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
