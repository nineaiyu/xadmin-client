<script lang="ts" setup>
import ReEmpty from "@/components/ReEmpty";
import { computed, nextTick, onMounted, ref, unref, watch } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import { match } from "pinyin-pro";
import { isAllEmpty } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import PermissionNodeLabel from "./PermissionNodeLabel.vue";
import PermissionTreeToolbar from "./PermissionTreeToolbar.vue";
import {
  buildPermissionTreeIndex,
  cascadeSelection,
  invertSelection,
  matchPermissionNode,
  nodeKey,
  toggleMenuSelection,
  type PermissionSubmitPayload,
  type PermissionTreeNode
} from "./utils/permissionTree";
import { isSyntheticKey } from "./utils/treeKeys";
import { useTreeExpansion } from "./utils/useTreeExpansion";
import { useTreeSync } from "./utils/useTreeSync";
import { useTreeSelectionMeta } from "./utils/useTreeSelectionMeta";
import type { TreeInstance } from "element-plus";

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

const treeRef = ref<TreeInstance>();

const keyword = ref("");
/** 父子联动：勾选父级自动勾选子级，取消后按剩余子级回算父级 */
const linked = ref(true);
/** 当前搜索命中的节点键 */
const keywordMatched = ref<Set<string>>(new Set());

/** 树数据首次就绪标记（仅首次自动展开顶层） */
let initialized = false;

const treeData = computed<PermissionTreeNode[]>(() => unref(props.data) ?? []);
const index = computed(() => buildPermissionTreeIndex(treeData.value));

const {
  expandedAll,
  expansionSnapshot,
  snapshotExpansion,
  restoreExpansion,
  expandAncestors,
  expandTopLevel,
  toggleExpandAll
} = useTreeExpansion({ treeRef, treeData, index });

const {
  selection,
  baseline,
  syncing,
  readTreeSelection,
  emitSelection,
  applySelection,
  applyPending,
  setCheckedKeys
} = useTreeSync({
  treeRef,
  treeData,
  index,
  onChange: payload => emit("change", payload),
  expandAncestors
});

const { stats, hasFolded, fieldStats, statusOf } = useTreeSelectionMeta({
  index,
  selection
});

/* ---------------- 勾选动作（联动勾选 / 全选 / 反选 / 行级子树 / 重置） ---------------- */

function onCheck(data: PermissionTreeNode) {
  if (syncing()) return;
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

const toggleAll = (checked: boolean) =>
  applySelection(toggleMenuSelection(index.value, checked, selection.value));

/** 反选：搜索态只作用于命中节点及其后代（与其交互范围一致） */
const invert = () => {
  const scope =
    keyword.value.trim() && keywordMatched.value.size
      ? [...keywordMatched.value]
      : index.value.menuKeys;
  applySelection(invertSelection(index.value, selection.value, scope));
};

/** 节点行内「选择全部/取消」：字段分组作用于字段，目录作用于整棵子树 */
function onSubtreeAction(node: PermissionTreeNode, checked: boolean) {
  const key = nodeKey(node);
  if (isSyntheticKey(key)) {
    const next = new Set(selection.value);
    (node.children ?? []).forEach(child => {
      const childKey = nodeKey(child);
      if (!childKey) return;
      if (checked) next.add(childKey);
      else next.delete(childKey);
    });
    applySelection(next);
    return;
  }
  applySelection(cascadeSelection(index.value, key, checked, selection.value));
}

/** 重置到打开弹窗时的勾选（搜索清空与展开恢复由调用方处理） */
const resetSelection = () => applySelection(new Set(baseline.value));

/** 搜索命中的节点数（含合成节点） */
const matchedCount = computed(() =>
  keyword.value.trim() ? keywordMatched.value.size : 0
);

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

/** 重置：清空搜索、恢复打开弹窗时的勾选与展开态 */
function reset() {
  keyword.value = "";
  expandedAll.value = false;
  expandAncestors(baseline.value);
  resetSelection();
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
    // 等 el-tree 完成 setData（其内部 watch 与本次同批执行）后再展开
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
      <ReEmpty
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
      <span v-if="hasFolded" class="menu-permission__legend-tip">
        {{ t("rolePermission.foldedTip") }}
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
    border-radius: var(--el-border-radius-base);
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-top: 8px;
    font-size: var(--el-font-size-extra-small);
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

/* 行高取 EP 默认组件尺寸（与列表页行高同档，字号随主题档位走） */
:deep(.el-tree-node__content) {
  height: var(--el-component-size);
  font-size: var(--el-font-size-base);
}
</style>
