<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import ExpandIcon from "../svg/expand.svg?component";
import UnExpandIcon from "../svg/unexpand.svg?component";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import More2Fill from "~icons/ri/more-2-fill?width=18&height=18";
import { computed, getCurrentInstance, nextTick, ref, watch } from "vue";
import type { TreeInstance } from "element-plus";

interface Tree {
  id: number;
  pk?: number;
  name?: string;
  highlight?: boolean;
  children?: Tree[];
}

const props = defineProps({
  treeLoading: Boolean,
  treeData: Array,
  pk: String
});

const emit = defineEmits(["tree-select"]);

const treeRef = ref();
const isExpand = ref(true);
const searchValue = ref("");
const highlightMap = ref({});
const { proxy } = getCurrentInstance();
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
    "dark:text-white!",
    "dark:hover:text-primary!"
  ];
});

const filterNode = (value: string, data: Tree) => {
  if (!value) return true;
  return data.name.includes(value);
};

function nodeClick(value) {
  const nodeId = value.pk;
  highlightMap.value[nodeId] = highlightMap.value[nodeId]?.highlight
    ? Object.assign({ id: nodeId }, highlightMap.value[nodeId], {
        highlight: false
      })
    : Object.assign({ id: nodeId }, highlightMap.value[nodeId], {
        highlight: true
      });
  Object.values(highlightMap.value).forEach((v: Tree) => {
    if (v.id !== nodeId) {
      v.highlight = false;
    }
  });
  emit(
    "tree-select",
    highlightMap.value[nodeId]?.highlight
      ? Object.assign({ ...value, selected: true })
      : Object.assign({ ...value, selected: false })
  );
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

function toggleRowExpansionAll(status) {
  isExpand.value = status;
  // getNode 为 el-tree 公开 API，避免依赖私有 store（升级后不易失效）
  const tree = proxy.$refs["treeRef"] as TreeInstance | undefined;
  if (!tree?.getNode) return;
  collectNodePks(props.treeData as Tree[]).forEach(pk => {
    const node = tree.getNode(pk);
    if (node) node.expanded = status;
  });
}

/** 重置部门树状态（选中状态、搜索框值、树初始化） */
function onTreeReset() {
  highlightMap.value = {};
  searchValue.value = "";
  toggleRowExpansionAll(true);
}

const { t } = useI18n();

watch(searchValue, val => {
  treeRef.value!.filter(val);
});
watch(
  () => props.pk,
  () => {
    nextTick(() => {
      if (props.pk) {
        highlightMap.value[props.pk] = { highlight: true };
      }
    });
  }
);

defineExpose({ onTreeReset });
</script>

<template>
  <div
    v-loading="props.treeLoading"
    :style="{ minHeight: `calc(100vh - 141px)` }"
    class="bg-bg_color overflow-hidden relative"
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
        <IconifyIconOffline :icon="More2Fill" class="w-7 cursor-pointer" />
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
    <el-scrollbar height="calc(90vh - 108px)">
      <el-tree
        ref="treeRef"
        :data="props.treeData"
        :expand-on-click-node="false"
        :filter-node-method="filterNode"
        :props="defaultProps"
        default-expand-all
        node-key="pk"
        @node-click="nodeClick"
      >
        <template #default="{ node, data }">
          <span
            :class="[
              'rounded-sm',
              'w-42.5!',
              'truncate!',
              'flex',
              'items-center',
              'select-none',
              'hover:text-primary',
              searchValue.trim().length > 0 &&
                node.label.includes(searchValue) &&
                'text-red-500',
              highlightMap[data.pk]?.highlight ? 'dark:text-primary' : ''
            ]"
            :style="{
              color: highlightMap[data.pk]?.highlight
                ? 'var(--el-color-primary)'
                : '',
              background: highlightMap[data.pk]?.highlight
                ? 'var(--el-color-primary-light-7)'
                : 'transparent'
            }"
          >
            {{ node.label }} {{ data.user_count ? data.user_count : "" }}
          </span>
        </template>
      </el-tree>
    </el-scrollbar>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-divider) {
  margin: 0;
}

:deep(.el-tree) {
  --el-tree-node-hover-bg-color: transparent;
}
</style>
