<script lang="ts" setup>
import { computed, isRef, nextTick, ref, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { FilterNodeMethodFunction, TreeInstance } from "element-plus";
import { MenuChoices } from "@/views/system/constants";
import { translateMenuTitle } from "@/components/RePermissionPreview";
import {
  buildScopeTree,
  countScopePermissions,
  expandScopePks,
  type MenuScopeRow,
  type ScopeNode
} from "./utils/menuScope";
import { dialogSize } from "@/components/ReDialog/size";

defineOptions({ name: "PermissionScopeSelect" });

interface Props {
  /** 全量菜单行（页面 hook 拉取；树与统计在前端同源构建） */
  rows?: MenuScopeRow[] | Ref<MenuScopeRow[]>;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  rows: () => [],
  disabled: false
});

/** 菜单数据异步到达（晚于弹层渲染）时仍能回显与统计 */
const rowsValue = computed<MenuScopeRow[]>(() =>
  isRef(props.rows) ? props.rows.value : (props.rows ?? [])
);

/** 绑定菜单 pk（提交时页面/目录会被后端展开为接口权限点） */
const modelValue = defineModel<string[]>({ default: () => [] });

const { t } = useI18n();

const dialogVisible = ref(false);
const keyword = ref("");
const treeRef = ref<TreeInstance>();

const treeData = computed(() =>
  // 内置种子标题存词条 key（menus.xxx），与侧栏同一转换口径
  buildScopeTree(rowsValue.value, translateMenuTitle)
);
const selectedCount = computed(() =>
  countScopePermissions(rowsValue.value, modelValue.value)
);
const allLeafPks = computed(() =>
  expandScopePks(
    rowsValue.value,
    treeData.value.map(node => node.pk)
  )
);
const summary = computed(() =>
  selectedCount.value === 0
    ? t("systemPermission.scope.unlimited")
    : t("systemPermission.scope.selected", { count: selectedCount.value })
);

function checkAll() {
  treeRef.value?.setCheckedKeys(allLeafPks.value);
}

function clearAll() {
  treeRef.value?.setCheckedKeys([]);
}

/** 展开/收起全部：经公开的 getNode 逐节点 expand/collapse（不触碰树私有 store） */
function setExpandAll(expanded: boolean) {
  const tree = treeRef.value;
  if (!tree?.getNode) return;
  const walk = (nodes: ScopeNode[]) => {
    nodes.forEach(node => {
      const instance = tree.getNode(node.pk);
      if (instance) {
        if (expanded) instance.expand();
        else instance.collapse();
      }
      if (node.children?.length) walk(node.children);
    });
  };
  walk(treeData.value);
}

const filterNode: FilterNodeMethodFunction = (value, data) => {
  if (!value) return true;
  const node = data as ScopeNode;
  return (
    node.title.includes(String(value)) ||
    String(node.pk).includes(String(value))
  );
};

watch(keyword, value => treeRef.value?.filter(value));

/** 回显只设置接口权限点（页面节点由父子联动派生，历史数据里的页面 pk 亦然） */
function syncChecked() {
  const tree = treeRef.value;
  if (!tree) return;
  tree.setCheckedKeys(expandScopePks(rowsValue.value, modelValue.value));
}

/**
 * 首次打开时弹窗内容在过渡里挂载，`nextTick` 拿不到 el-tree 实例，
 * 勾选回显会静默丢失（表现为第二次打开才正常）；统一放到 `opened` 后同步。
 */
function handleOpened() {
  syncChecked();
  setExpandAll(false);
}

function openDialog() {
  if (props.disabled) return;
  keyword.value = "";
  dialogVisible.value = true;
}

// 菜单数据晚于弹窗到达时补一次回显（树随数据重建，勾选状态会重置）
watch(rowsValue, () => {
  if (dialogVisible.value) nextTick(syncChecked);
});

function handleConfirm() {
  const checked = (treeRef.value?.getCheckedKeys(true) ?? []) as string[];
  modelValue.value = checked;
  dialogVisible.value = false;
}
</script>

<template>
  <div class="scope-select">
    <el-button
      class="scope-trigger"
      data-testid="scope-trigger"
      plain
      :disabled="disabled"
      @click="openDialog"
    >
      <span class="truncate">{{ summary }}</span>
    </el-button>
    <el-button
      v-if="modelValue.length"
      link
      size="small"
      type="primary"
      @click="modelValue = []"
    >
      {{ t("buttons.reset") }}
    </el-button>
    <el-text class="scope-tip" type="info">
      {{ t("systemPermission.scope.tip") }}
    </el-text>
  </div>

  <el-dialog
    v-model="dialogVisible"
    append-to-body
    destroy-on-close
    :title="t('systemPermission.scope.dialogTitle')"
    :width="dialogSize('md')"
    @opened="handleOpened"
  >
    <div class="scope-toolbar">
      <el-input
        v-model="keyword"
        class="w-56"
        clearable
        :placeholder="t('systemPermission.scope.searchPlaceholder')"
      />
      <div class="flex items-center gap-2">
        <el-button size="small" @click="setExpandAll(true)">
          {{ t("systemPermission.scope.expandAll") }}
        </el-button>
        <el-button size="small" @click="setExpandAll(false)">
          {{ t("systemPermission.scope.collapseAll") }}
        </el-button>
        <el-button size="small" @click="checkAll">
          {{ t("systemPermission.scope.selectAll") }}
        </el-button>
        <el-button size="small" @click="clearAll">
          {{ t("systemPermission.scope.clear") }}
        </el-button>
      </div>
    </div>
    <el-scrollbar class="scope-tree mt-2" max-height="380px">
      <el-tree
        ref="treeRef"
        :data="treeData"
        :filter-node-method="filterNode"
        node-key="pk"
        :props="{ label: 'title', children: 'children' }"
        show-checkbox
      >
        <template #default="{ data }">
          <span class="scope-node">
            <span>{{ data.title }}</span>
            <el-tag
              v-if="data.menuType === MenuChoices.PERMISSION"
              effect="plain"
              size="small"
            >
              {{ data.method || t("systemPermission.scope.anyMethod") }}
            </el-tag>
            <span v-else class="scope-node-count">
              {{
                t("systemPermission.scope.apiCount", {
                  count: data.permissionCount
                })
              }}
            </span>
          </span>
        </template>
      </el-tree>
    </el-scrollbar>
    <el-text class="mt-2 block" size="small" type="info">
      {{ t("systemPermission.scope.dialogTip") }}
    </el-text>
    <template #footer>
      <el-button @click="dialogVisible = false">
        {{ t("buttons.cancel") }}
      </el-button>
      <el-button type="primary" @click="handleConfirm">
        {{ t("buttons.save") }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
.scope-select {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.scope-trigger {
  justify-content: flex-start;
  max-width: 420px;
}

.scope-tip {
  font-size: var(--el-font-size-extra-small);
}

.scope-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.scope-tree {
  padding: 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--radius-lg);
}

.scope-node {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.scope-node-count {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
