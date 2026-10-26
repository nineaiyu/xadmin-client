<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import ExpandIcon from "../svg/expand.svg?component";
import UnExpandIcon from "../svg/unexpand.svg?component";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import MoreIcon from "~icons/ep/more-filled?width=18&height=18";
import { computed, getCurrentInstance, ref, watch } from "vue";
import type { TreeInstance, TreeNodeData } from "element-plus";
import {
  COMPACT_SCROLL_HEIGHT,
  DESKTOP_CONTAINER_MIN_HEIGHT,
  DESKTOP_SCROLL_HEIGHT
} from "../utils/userTreeHeight";

interface Tree {
  id: number;
  pk?: number;
  name?: string;
  children?: Tree[];
}

const props = defineProps({
  treeLoading: Boolean,
  treeData: Array,
  pk: String,
  /**
   * 堆叠（移动端）形态：高度自适应并限高（口径见 utils/userTreeHeight.ts）。
   *
   * 桌面形态依赖 split-pane 给出的高度铺满；移动端是「部门树在上、用户列表在下」
   * 的堆叠布局，同样的铺满高度会把列表推到整屏之外（实测 390×664 视口下用户列表
   * 完全不可见）。
   */
  compact: Boolean
});

const emit = defineEmits(["tree-select"]);

const treeRef = ref();
const isExpand = ref(true);
const searchValue = ref("");
/** 当前选中的部门 pk；选中态交给 el-tree 的 highlight-current 整行渲染 */
const selectedPk = ref<string | number | null>(null);
// 组件 setup 内调用，实例必然存在；proxy 供 $refs 取 el-tree 实例
const proxy = getCurrentInstance()?.proxy;
/** el-tree 数据（props 为宽 Array 声明，此处收窄为部门节点树） */
const treeViewData = computed(() => props.treeData as Tree[]);
const defaultProps = {
  children: "children",
  label: "name"
};
const buttonClass = computed(() => {
  return [
    "h-[20px]!",
    "text-sm!",
    "reset-margin",
    "text-(--el-text-color-regular)!",
    "dark:text-(--el-text-color-primary)!",
    "dark:hover:text-primary!"
  ];
});

const filterNode = (value: string, data: TreeNodeData) => {
  if (!value) return true;
  return data.name?.includes(value) ?? false;
};

function nodeClick(value: TreeNodeData) {
  const nodeId = value.pk ?? value.id;
  // 再次点击已选部门取消选择（与通讯录的「再点取消」口径一致）
  const selected = selectedPk.value !== nodeId;
  selectedPk.value = selected ? nodeId : null;
  emit("tree-select", { ...value, selected });
}

/** 递归收集树节点 pk（替代 el-tree 私有 store._getAllNodes） */
function collectNodePks(nodes?: Tree[]): number[] {
  const pks: number[] = [];
  const walk = (list?: Tree[]) => {
    list?.forEach(node => {
      if (node.pk !== undefined && node.pk !== null) pks.push(node.pk);
      if (node.children?.length) walk(node.children);
    });
  };
  walk(nodes);
  return pks;
}

function toggleRowExpansionAll(status: boolean) {
  isExpand.value = status;
  // getNode 为 el-tree 公开 API，避免依赖私有 store（升级后不易失效）
  const tree = proxy?.$refs["treeRef"] as TreeInstance | undefined;
  if (!tree?.getNode) return;
  collectNodePks(props.treeData as Tree[]).forEach(pk => {
    const node = tree.getNode(pk);
    if (node) node.expanded = status;
  });
}

/** 重置部门树状态（选中状态、搜索框值、树初始化） */
function onTreeReset() {
  selectedPk.value = null;
  searchValue.value = "";
  toggleRowExpansionAll(true);
}

const { t } = useI18n();

watch(searchValue, val => {
  treeRef.value!.filter(val);
});
watch(
  () => props.pk,
  pk => {
    if (!pk) {
      selectedPk.value = null;
      return;
    }
    // node-key 为数字 pk：URL/父组件传入的字符串需要归一，否则 current-node-key 不命中
    const numeric = Number(pk);
    selectedPk.value = Number.isNaN(numeric) ? pk : numeric;
  },
  { immediate: true }
);

defineExpose({ onTreeReset });
</script>

<template>
  <div
    v-loading="props.treeLoading"
    :style="
      props.compact ? undefined : { minHeight: DESKTOP_CONTAINER_MIN_HEIGHT }
    "
    class="user-tree-panel bg-bg-card overflow-hidden relative"
  >
    <div class="flex items-center h-8.5">
      <el-input
        v-model="searchValue"
        :placeholder="t('systemDept.name')"
        class="ml-2"
        clearable
        size="small"
      >
        <template #suffix>
          <el-icon class="el-input__icon">
            <IconifyIconOffline
              v-show="searchValue.length === 0"
              icon="ri/search-line"
            />
          </el-icon>
        </template>
      </el-input>
      <el-dropdown :hide-on-click="false">
        <IconifyIconOffline
          :icon="MoreIcon"
          class="w-7 cursor-pointer"
          :aria-label="t('layout.more')"
        />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item>
              <el-button
                :class="buttonClass"
                :icon="useRenderIcon(isExpand ? ExpandIcon : UnExpandIcon)"
                link
                type="primary"
                @click="toggleRowExpansionAll(!isExpand)"
              >
                {{
                  isExpand ? t("buttons.collapseAll") : t("buttons.expendAll")
                }}
              </el-button>
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <el-divider />
    <el-scrollbar
      :height="props.compact ? COMPACT_SCROLL_HEIGHT : DESKTOP_SCROLL_HEIGHT"
    >
      <el-tree
        ref="treeRef"
        :data="treeViewData"
        :expand-on-click-node="false"
        :filter-node-method="filterNode"
        :props="defaultProps"
        default-expand-all
        node-key="pk"
        :highlight-current="true"
        :current-node-key="selectedPk ?? undefined"
        @node-click="nodeClick"
      >
        <template #default="{ node, data }">
          <span class="user-tree-label">
            <span
              :class="[
                'truncate',
                searchValue.trim().length > 0 &&
                  node.label.includes(searchValue) &&
                  'text-(--el-color-danger)'
              ]"
            >
              {{ node.label }}
            </span>
            <el-tooltip
              v-if="data.user_count"
              :content="t('systemUser.deptUserCountHint')"
              placement="right"
            >
              <span class="user-tree-count">{{ data.user_count }}</span>
            </el-tooltip>
          </span>
        </template>
      </el-tree>
    </el-scrollbar>
  </div>
</template>

<style lang="scss" scoped>
/* 面板卡片化：与右侧列表（RePlusPage 搜索卡/表格卡）同一张「卡片纸」，
   分栏两侧观感一致；圆角/描边/阴影取设计令牌 */
.user-tree-panel {
  border: var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

:deep(.el-divider) {
  margin: 0;
}

:deep(.el-tree) {
  --el-tree-node-hover-bg-color: var(--el-fill-color-light);
}

/* 选中态与通讯录一致：整行 primary-light-9 底 + 主色文字（不再只染 170px 的标签块） */
:deep(.el-tree-node__content) {
  height: 30px;
  border-radius: var(--radius-sm);
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.user-tree-label {
  display: flex;
  flex: 1;
  gap: 8px;
  align-items: center;
  min-width: 0;
  height: 100%;
  font-size: var(--font-size-sm);
  cursor: pointer;
  user-select: none;
}

.user-tree-count {
  flex-shrink: 0;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  font-size: var(--font-size-2xs);
  line-height: 16px;
  color: var(--el-text-color-secondary);
  text-align: center;
  background: var(--el-fill-color-light);
  border-radius: var(--radius-lg);
}
</style>
