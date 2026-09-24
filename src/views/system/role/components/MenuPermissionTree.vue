<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, unref, watch } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { match } from "pinyin-pro";
import { isAllEmpty } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import PermissionNodeLabel from "./PermissionNodeLabel.vue";
import PermissionTreeToolbar from "./PermissionTreeToolbar.vue";
import { isSyntheticKey, parseMenuFieldKey } from "../utils/treeKeys";
import {
  buildPermissionTreeIndex,
  cascadeSelection,
  collectSelectionPayload,
  computeNodeStatusMap,
  computeSelectionStats,
  countFieldSelection,
  invertSelection,
  matchPermissionNode,
  menuAncestors,
  nodeKey,
  nodeKind,
  toggleMenuSelection,
  type PermissionNodeStatus,
  type PermissionSubmitPayload,
  type PermissionTreeNode
} from "../utils/permissionTree";
import type { TreeInstance, TreeKey } from "element-plus";

defineOptions({ name: "MenuPermissionTree" });

interface Props {
  /** 菜单树（含字段权限合成节点）；传 ref 可跟随菜单树的异步加载 */
  data?: PermissionTreeNode[] | Ref<PermissionTreeNode[]>;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false
});

const emit = defineEmits<{
  /** 勾选变化：拆分后的菜单 pk 数组与字段权限字典 */
  change: [payload: PermissionSubmitPayload];
}>();

const { locale, t } = useI18n();

/** el-tree 私有 store 节点（展开态批量控制沿用既有实现口径） */
type TreeStoreNode = {
  data?: PermissionTreeNode;
  key?: TreeKey;
  level?: number;
  expanded?: boolean;
};

const treeRef = ref<TreeInstance>();

const keyword = ref("");
/** 父子联动：勾选父级自动勾选子级，取消后按剩余子级回算父级 */
const linked = ref(true);
const expandedAll = ref(false);
/** 当前勾选（含字段合成键） */
const selection = ref<Set<string>>(new Set());
/** 打开弹窗时的初始勾选（重置回到此处） */
const baseline = ref<string[]>([]);
/** 待应用的初始勾选（树数据异步到达时缓冲） */
const pendingKeys = ref<string[] | null>(null);
/** 搜索前的展开快照（清空搜索后恢复） */
const expansionSnapshot = ref<Set<string> | null>(null);
/** 当前搜索命中的节点键 */
const keywordMatched = ref<Set<string>>(new Set());

/** 回写 el-tree 期间抑制 @check（setCheckedKeys 不派发 check，此处为双保险） */
let syncing = false;
/** 树数据首次就绪标记（仅首次自动展开顶层） */
let initialized = false;

const treeData = computed<PermissionTreeNode[]>(() => unref(props.data) ?? []);
const index = computed(() => buildPermissionTreeIndex(treeData.value));
const statuses = computed(() =>
  computeNodeStatusMap(index.value, selection.value)
);
const stats = computed(() =>
  computeSelectionStats(index.value, selection.value)
);

/** 搜索命中的节点数（含合成节点） */
const matchedCount = computed(() =>
  keyword.value.trim() ? keywordMatched.value.size : 0
);

function allNodes(): TreeStoreNode[] {
  // el-tree 未公开 store 的节点形态，按使用到的字段收敛断言
  const store = treeRef.value?.store as unknown as
    { _getAllNodes?: () => TreeStoreNode[] } | undefined;
  return store?._getAllNodes?.() ?? [];
}

function snapshotExpansion() {
  const snapshot = new Set<string>();
  allNodes().forEach(node => {
    if (node.expanded) snapshot.add(String(node.key ?? node.data?.pk ?? ""));
  });
  expansionSnapshot.value = snapshot;
}

function setNodesExpanded(keys: Set<string>, status: boolean) {
  allNodes().forEach(node => {
    const key = String(node.key ?? node.data?.pk ?? "");
    if (keys.has(key)) node.expanded = status;
  });
}

function restoreExpansion() {
  const snapshot = expansionSnapshot.value;
  expansionSnapshot.value = null;
  if (!snapshot) return;
  const collapse = new Set<string>();
  allNodes().forEach(node => {
    const key = String(node.key ?? node.data?.pk ?? "");
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
  allNodes().forEach(node => {
    if ((node.level ?? 0) <= 1) {
      targets.add(String(node.key ?? node.data?.pk ?? ""));
    }
  });
  setNodesExpanded(targets, true);
}

function nodeTitle(node: PermissionTreeNode): string {
  const raw = node?.meta?.title;
  return raw ? String(transformI18n(String(raw))) : "";
}

/** 搜索命中：标题（i18n 后）/ 权限码 / 路由 / 字段标签，中文环境额外支持拼音 */
function isNodeMatched(node: PermissionTreeNode): boolean {
  if (matchPermissionNode(node, keyword.value, nodeTitle(node))) return true;
  if (locale.value !== "zh") return false;
  return !isAllEmpty(
    match(nodeTitle(node).toLowerCase(), keyword.value.trim().toLowerCase())
  );
}

const filterNode = (value: string, data: PermissionTreeNode) =>
  !value || !value.trim() ? true : keywordMatched.value.has(nodeKey(data));

function collectMatched(nodes: PermissionTreeNode[], matched: Set<string>) {
  nodes.forEach(node => {
    if (isNodeMatched(node)) matched.add(nodeKey(node));
    if (node.children?.length) collectMatched(node.children, matched);
  });
}

function readTreeSelection(): Set<string> {
  const keys = treeRef.value?.getCheckedKeys(false) ?? [];
  return new Set(keys.map(key => String(key)));
}

function emitSelection() {
  emit("change", collectSelectionPayload(selection.value));
}

/** 统一回写：内部状态 → el-tree 勾选 → 上抛表单 */
function applySelection(next: Set<string>) {
  selection.value = next;
  syncing = true;
  treeRef.value?.setCheckedKeys([...next], false);
  syncing = false;
  emitSelection();
}

/** 应用缓冲的初始勾选（树数据到达前调用则等待数据就绪） */
function applyPending() {
  if (!pendingKeys.value || !treeData.value.length) return;
  const keys = pendingKeys.value;
  pendingKeys.value = null;
  baseline.value = keys;
  selection.value = new Set(keys);
  // 等 el-tree 完成 setData（其内部 watch 与本次同批执行）后再回显勾选
  nextTick(() => {
    treeRef.value?.setCheckedKeys(keys, false);
    expandAncestors(keys);
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

function onCheck(data: PermissionTreeNode) {
  if (syncing) return;
  const current = readTreeSelection();
  const key = nodeKey(data);
  // 字段合成节点独立勾选；独立模式下不做任何传播
  if (isSyntheticKey(key) || !linked.value) {
    selection.value = current;
    emitSelection();
    return;
  }
  const next = cascadeSelection(index.value, key, current.has(key), current);
  applySelection(next);
}

function toggleAll(checked: boolean) {
  applySelection(toggleMenuSelection(index.value, checked, selection.value));
}

/** 反选：搜索态只作用于命中节点及其后代（与其交互范围一致） */
function invert() {
  const scope =
    keyword.value.trim() && keywordMatched.value.size
      ? [...keywordMatched.value]
      : index.value.menuKeys;
  applySelection(invertSelection(index.value, selection.value, scope));
}

function setFieldSubtree(node: PermissionTreeNode, checked: boolean) {
  const next = new Set(selection.value);
  (node.children ?? []).forEach(child => {
    const key = nodeKey(child);
    if (!key) return;
    if (checked) next.add(key);
    else next.delete(key);
  });
  applySelection(next);
}

/** 节点行内「选择全部/取消」：字段分组作用于字段，目录作用于整棵子树 */
function onSubtreeAction(node: PermissionTreeNode, checked: boolean) {
  const key = nodeKey(node);
  if (isSyntheticKey(key)) {
    setFieldSubtree(node, checked);
    return;
  }
  applySelection(cascadeSelection(index.value, key, checked, selection.value));
}

function toggleExpandAll(status: boolean) {
  expandedAll.value = status;
  const targets = new Set<string>();
  allNodes().forEach(node => {
    const kind = nodeKind(node.data ?? {});
    if (kind === "fieldGroup" || kind === "field") return;
    targets.add(String(node.key ?? node.data?.pk ?? ""));
  });
  setNodesExpanded(targets, status);
}

/** 重置：清空搜索、恢复打开弹窗时的勾选与展开态 */
function reset() {
  keyword.value = "";
  expandedAll.value = false;
  expandAncestors(baseline.value);
  applySelection(new Set(baseline.value));
}

function fieldStats(node: PermissionTreeNode) {
  return nodeKind(node) === "fieldGroup"
    ? countFieldSelection(node, selection.value)
    : undefined;
}

function statusOf(node: PermissionTreeNode): PermissionNodeStatus | undefined {
  return statuses.value.get(nodeKey(node));
}

watch(keyword, value => {
  const needle = value.trim();
  const matched = new Set<string>();
  if (needle) collectMatched(treeData.value, matched);
  keywordMatched.value = matched;
  if (needle && !expansionSnapshot.value) snapshotExpansion();
  treeRef.value?.filter(needle);
  if (!needle) restoreExpansion();
});

watch(treeData, () => {
  applyPending();
  if (!initialized && treeData.value.length) {
    initialized = true;
    nextTick(() => {
      expandTopLevel();
      expandAncestors(selection.value);
    });
  }
});

onMounted(() => {
  // 数据早于挂载到达（同步 props）时 watch 不会触发
  applyPending();
});

defineExpose({ setCheckedKeys });
</script>

<template>
  <div class="menu-permission">
    <PermissionTreeToolbar
      v-model:keyword="keyword"
      v-model:linked="linked"
      :matched-count="matchedCount"
      :stats="stats"
      :expanded-all="expandedAll"
      @select-all="toggleAll(true)"
      @invert="invert()"
      @clear="toggleAll(false)"
      @toggle-expand="toggleExpandAll(!expandedAll)"
      @reset="reset()"
    />

    <div v-loading="loading" class="menu-permission__tree-wrap">
      <el-tree
        v-if="treeData.length"
        ref="treeRef"
        check-strictly
        class="menu-permission__tree"
        data-testid="permission-tree"
        highlight-current
        node-key="pk"
        show-checkbox
        :data="treeData"
        :expand-on-click-node="true"
        :filter-node-method="filterNode"
        @check="onCheck"
      >
        <template #default="{ data }">
          <PermissionNodeLabel
            :node="data"
            :status="statusOf(data)"
            :keyword="keyword.trim()"
            :linked="linked"
            :field-stats="fieldStats(data)"
            @select-subtree="onSubtreeAction(data, true)"
            @clear-subtree="onSubtreeAction(data, false)"
          />
        </template>
      </el-tree>
      <el-empty
        v-else
        :description="t('rolePermission.empty')"
        :image-size="70"
      />
    </div>

    <div class="menu-permission__legend">
      <span class="menu-permission__legend-item">
        <i class="menu-permission__dot is-checked" />
        {{ t("rolePermission.statusChecked") }}
      </span>
      <span class="menu-permission__legend-item">
        <i class="menu-permission__dot is-partial" />
        {{ t("rolePermission.statusPartial") }}
      </span>
      <span class="menu-permission__legend-item">
        <i class="menu-permission__dot is-unchecked" />
        {{ t("rolePermission.statusUnchecked") }}
      </span>
      <span class="menu-permission__legend-tip">
        {{
          linked
            ? t("rolePermission.linkedTip")
            : t("rolePermission.independentTip")
        }}
      </span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.menu-permission {
  display: flex;
  flex-direction: column;
  width: 100%;

  &__tree-wrap {
    min-height: 200px;
    max-height: 46vh;
    padding: 4px 0;
    margin-top: 10px;
    overflow: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__legend-item {
    display: inline-flex;
    gap: 4px;
    align-items: center;
  }

  &__legend-tip {
    margin-left: auto;
  }

  &__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;

    &.is-checked {
      background: var(--el-color-success);
    }

    &.is-partial {
      background: var(--el-color-warning);
    }

    &.is-unchecked {
      background: var(--el-border-color);
    }
  }
}

:deep(.el-tree-node__content) {
  height: 32px;
}
</style>
