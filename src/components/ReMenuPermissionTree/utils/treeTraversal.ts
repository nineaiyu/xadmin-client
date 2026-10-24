import type { TreeInstance } from "element-plus";
import type { PermissionTreeNode } from "./permissionTree";

/** el-tree 节点实例：经公开的 getNode 取得（展开态批量控制在其公开方法上操作） */
export type ElTreeNode = ReturnType<TreeInstance["getNode"]>;

/** 深度优先遍历渲染树：逐节点经公开的 getNode 取树内实例（键即 node-key「pk」） */
export function eachTreeNode(
  treeRef: { value?: TreeInstance },
  treeData: PermissionTreeNode[],
  callback: (_node: ElTreeNode) => void
) {
  const walk = (nodes: PermissionTreeNode[]) => {
    nodes.forEach(item => {
      const node =
        item.pk === undefined ? undefined : treeRef.value?.getNode(item.pk);
      if (node) callback(node);
      if (item.children?.length) walk(item.children);
    });
  };
  walk(treeData);
}

export const treeNodeKey = (node: ElTreeNode) =>
  String(node.key ?? node.data?.pk ?? "");
