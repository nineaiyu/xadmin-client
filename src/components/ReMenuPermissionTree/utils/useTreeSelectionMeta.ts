import { computed, type Ref } from "vue";
import {
  computeNodeStatusMap,
  computeSelectionStats,
  countFieldSelection,
  nodeKey,
  nodeKind,
  type PermissionNodeStatus,
  type PermissionTreeIndex,
  type PermissionTreeNode
} from "./permissionTree";

/**
 * 权限树勾选态的展示派生（自 useTreeSelection 拆出，hook 行数门禁）：
 * 状态图 / 统计 / 折叠标记 / 字段分组计数——全部从 selection 纯派生，无副作用。
 */
export function useTreeSelectionMeta(deps: {
  index: Ref<PermissionTreeIndex>;
  selection: Ref<Set<string>>;
}) {
  const { index, selection } = deps;

  const statuses = computed(() =>
    computeNodeStatusMap(index.value, selection.value)
  );
  const stats = computed(() =>
    computeSelectionStats(index.value, selection.value)
  );

  /** 是否存在折叠态节点（页面在选且其直接子级全部未选；用于提示文案） */
  const hasFolded = computed(() => {
    for (const key of index.value.menuKeys) {
      if (!selection.value.has(key)) continue;
      const children = index.value.childrenMap.get(key) ?? [];
      if (
        children.length &&
        !children.some(child => selection.value.has(child))
      ) {
        return true;
      }
    }
    return false;
  });

  function fieldStats(node: PermissionTreeNode) {
    return nodeKind(node) === "fieldGroup"
      ? countFieldSelection(node, selection.value)
      : undefined;
  }

  function statusOf(
    node: PermissionTreeNode
  ): PermissionNodeStatus | undefined {
    return statuses.value.get(nodeKey(node));
  }

  return { statuses, stats, hasFolded, fieldStats, statusOf };
}
