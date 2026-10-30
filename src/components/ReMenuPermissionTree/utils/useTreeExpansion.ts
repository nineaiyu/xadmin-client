import { ref, type Ref } from "vue";
import type { TreeInstance } from "element-plus";
import { isSyntheticKey, parseMenuFieldKey } from "./treeKeys";
import {
  menuAncestors,
  nodeKind,
  type PermissionTreeIndex,
  type PermissionTreeNode
} from "./permissionTree";
import { eachTreeNode, type ElTreeNode, treeNodeKey } from "./treeTraversal";

/**
 * 权限树展开态管理（自 MenuPermissionTree 抽出，行数门禁）。
 *
 * - 全部经 el-tree 公开的 node.expand()/collapse() 操作（不触碰内部字段）；
 * - 搜索前对当前展开集做快照，清空搜索后恢复（搜索自动展开不打乱用户布局）；
 * - expandAncestors 服务勾选回显：展开勾选节点的祖先链，直接看到已授权位置。
 */
export function useTreeExpansion(deps: {
  treeRef: Ref<TreeInstance | undefined>;
  treeData: Ref<PermissionTreeNode[]>;
  index: Ref<PermissionTreeIndex>;
}) {
  const { treeRef, treeData, index } = deps;
  const expandedAll = ref(false);
  /** 搜索前的展开快照（清空搜索后恢复） */
  const expansionSnapshot = ref<Set<string> | null>(null);

  const each = (callback: (_node: ElTreeNode) => void) =>
    eachTreeNode(treeRef, treeData.value, callback);

  function snapshotExpansion() {
    const snapshot = new Set<string>();
    each(node => {
      if (node.expanded) snapshot.add(treeNodeKey(node));
    });
    expansionSnapshot.value = snapshot;
  }

  function setNodesExpanded(keys: Set<string>, status: boolean) {
    each(node => {
      if (!keys.has(treeNodeKey(node))) return;
      if (status) node.expand();
      else node.collapse();
    });
  }

  function restoreExpansion() {
    const snapshot = expansionSnapshot.value;
    expansionSnapshot.value = null;
    if (!snapshot) return;
    const collapse = new Set<string>();
    each(node => {
      const key = treeNodeKey(node);
      if (!snapshot.has(key)) collapse.add(key);
    });
    setNodesExpanded(snapshot, true);
    setNodesExpanded(collapse, false);
  }

  /** 展开勾选节点的祖先链（回显时直接看到已授权位置） */
  function expandAncestors(keys: Iterable<string>) {
    const targets = new Set<string>();
    for (const key of keys) {
      const parsed = parseMenuFieldKey(key);
      const menuKey = parsed ? parsed[0] : key;
      if (!menuKey || isSyntheticKey(menuKey)) continue;
      if (index.value.parentMap.has(menuKey)) targets.add(menuKey);
      menuAncestors(index.value, menuKey).forEach(item => targets.add(item));
    }
    if (targets.size) setNodesExpanded(targets, true);
  }

  function expandTopLevel() {
    const targets = new Set<string>();
    each(node => {
      if (node.level <= 1) {
        targets.add(treeNodeKey(node));
      }
    });
    setNodesExpanded(targets, true);
  }

  /** 全部展开/折叠：字段分组与字段节点不参与（它们无子级，展开无意义） */
  function toggleExpandAll(status: boolean) {
    expandedAll.value = status;
    const targets = new Set<string>();
    each(node => {
      const kind = nodeKind(node.data ?? {});
      if (kind === "fieldGroup" || kind === "field") return;
      targets.add(treeNodeKey(node));
    });
    setNodesExpanded(targets, status);
  }

  return {
    expandedAll,
    expansionSnapshot,
    snapshotExpansion,
    restoreExpansion,
    expandAncestors,
    expandTopLevel,
    toggleExpandAll
  };
}
