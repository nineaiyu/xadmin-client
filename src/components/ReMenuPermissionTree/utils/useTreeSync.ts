import { nextTick, ref, watch, type Ref } from "vue";
import type { TreeInstance } from "element-plus";
import {
  collectSelectionPayload,
  foldFullMenuSelection,
  type PermissionSubmitPayload,
  type PermissionTreeIndex,
  type PermissionTreeNode
} from "./permissionTree";

/**
 * 权限树勾选态与 el-tree 的双向同步（自 useTreeSelection 拆出，hook 行数门禁）。
 *
 * 同一同步域的三个职责：
 * - selection 是唯一事实源（状态图 / 统计 / 上抛表单都从它派生）；
 * - 回写：applySelection 统一「内部状态 → el-tree 勾选 → 上抛表单」，
 *   回写期间抑制 @check（setCheckedKeys 不派发 check，双保险）；
 * - 回显：树数据 / el-tree 实例都可能晚于勾选数据到达，外部 setCheckedKeys
 *   先缓冲（pendingKeys），数据与实例任一就绪时补应用——否则 setCheckedKeys
 *   落空、勾选态静默丢失（内部 selection 已有键，但树勾选框停留在未选）。
 */
export function useTreeSync(deps: {
  treeRef: Ref<TreeInstance | undefined>;
  treeData: Ref<PermissionTreeNode[]>;
  index: Ref<PermissionTreeIndex>;
  /** 勾选变化上抛 */
  onChange: (payload: PermissionSubmitPayload) => void;
  /** 勾选回显后展开祖先链 */
  expandAncestors: (keys: Iterable<string>) => void;
}) {
  const { treeRef, treeData, index } = deps;
  /** 当前勾选（含字段合成键） */
  const selection = ref<Set<string>>(new Set());
  /** 打开弹窗时的初始勾选（重置回到此处） */
  const baseline = ref<string[]>([]);
  /** 待应用的初始勾选（树数据异步到达时缓冲） */
  const pendingKeys = ref<string[] | null>(null);
  /** 回写 el-tree 期间抑制 @check */
  let syncing = false;

  function readTreeSelection(): Set<string> {
    const keys = treeRef.value?.getCheckedKeys(false) ?? [];
    return new Set(keys.map(key => String(key)));
  }

  function emitSelection() {
    deps.onChange(collectSelectionPayload(selection.value));
  }

  /** 统一回写：内部状态 → el-tree 勾选 → 上抛表单 */
  function applySelection(next: Set<string>) {
    selection.value = next;
    syncing = true;
    treeRef.value?.setCheckedKeys([...next], false);
    syncing = false;
    emitSelection();
  }

  function applyPending() {
    if (!pendingKeys.value || !treeData.value.length) return;
    const keys = pendingKeys.value;
    // 回显折叠：拥有页面全部后代时呈现为页面级勾选（保存提交页面键，后端再展开为权限点）
    const folded = [...foldFullMenuSelection(index.value, keys)];
    baseline.value = folded;
    selection.value = new Set(folded);
    // 等 el-tree 完成 setData（其内部 watch 与本次同批执行）后再回显勾选
    nextTick(() => {
      if (!treeRef.value || pendingKeys.value !== keys) return;
      pendingKeys.value = null;
      treeRef.value.setCheckedKeys(folded, false);
      deps.expandAncestors(folded);
    });
  }

  /**
   * 外部设置勾选（角色详情异步返回后回显）。
   * 树数据未就绪时缓冲，待数据到达后应用。
   */
  function setCheckedKeys(keys: Array<string | number>) {
    pendingKeys.value = keys.map(String);
    applyPending();
  }

  // el-tree 实例晚于数据就绪（700+ 节点 vnode 渲染在慢环境跨多个 tick，
  // `v-if="treeData.length"` 的实例创建晚于 applyPending 的 nextTick）：
  // 实例到位后补应用缓冲的回显——否则 setCheckedKeys 落空且无重试，
  // 勾选态静默丢失（CI 冷启动下编辑弹层回显三连挂的根因）
  watch(treeRef, () => applyPending());

  return {
    selection,
    baseline,
    syncing: () => syncing,
    readTreeSelection,
    emitSelection,
    applySelection,
    applyPending,
    setCheckedKeys
  };
}
