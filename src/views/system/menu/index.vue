<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useMenu } from "./utils/hook";
import { displayTitle } from "./utils/useMenuFilter";
import { useTreeHeight } from "./utils/useTreeHeight";
import MenuTreeToolbar from "./components/MenuTreeToolbar.vue";
import MenuTreeRow from "./components/MenuTreeRow.vue";
import MenuContextMenu from "./components/MenuContextMenu.vue";

/**
 * 菜单管理：全宽菜单树 + 抽屉编辑。
 *
 * 布局取舍：树是菜单配置的主心智（层级 + 顺序 + 三形态），因此把整页宽度给它，
 * 编辑搬到右侧抽屉（旧实现右侧常驻表单占 46% 宽、保存按钮在折叠线下）。
 * 操作入口三层：工具栏（新增/权限码/导入导出/回收站/更多）、行内 hover
 * （启停/加子级/编辑/更多）、右键菜单（与行内下拉同一份动作清单）。
 */

defineOptions({
  name: "SystemMenu"
});

const { t } = useI18n();

const {
  auth,
  rootRef,
  treeRef,
  loading,
  stats,
  renderedTree,
  currentRow,
  filter,
  visibleTree,
  matchCount,
  checkStrictly,
  isExpandAll,
  busyPks,
  multiMode,
  checkedCount,
  contextMenu,
  contextActions,
  defaultProps,
  allowDrop,
  handleDrop,
  handleCheck,
  nodeClick,
  onRowAction,
  onRowContextMenu,
  closeContextMenu,
  toggleRowActive,
  onAdd,
  onGeneratePermissions,
  onExport,
  onImport,
  onRefresh,
  onResetFilter,
  onToggleAll,
  onBatchActive,
  onBatchDelete,
  onSelectAll,
  onClearSelection,
  toggleMultiMode
} = useMenu();

const { height } = useTreeHeight(rootRef, ".menu-page__scroll");

const emptyText = computed(() =>
  matchCount.value === 0 && renderedTree.value.length === 0
    ? t("systemMenu.empty.noMatch")
    : t("systemMenu.empty.noData")
);
</script>

<template>
  <div ref="rootRef" class="menu-page">
    <div class="menu-page__panel">
      <menu-tree-toolbar
        v-model:keyword="filter.keyword"
        v-model:menu-type="filter.menuType"
        v-model:status="filter.status"
        v-model:expand-level="filter.expandLevel"
        v-model:check-strictly="checkStrictly"
        :auth="auth"
        :checked-count="checkedCount"
        :is-expand-all="isExpandAll"
        :match-count="matchCount"
        :multi-mode="multiMode"
        :selected="currentRow"
        :stats="stats"
        @add="onAdd"
        @batch-active="onBatchActive"
        @batch-delete="onBatchDelete"
        @clear-selection="onClearSelection"
        @export="onExport"
        @import="onImport"
        @permissions="onGeneratePermissions"
        @refresh="onRefresh"
        @reset="onResetFilter"
        @select-all="onSelectAll"
        @toggle-all="onToggleAll"
        @toggle-multi="toggleMultiMode"
      />

      <div class="menu-page__scroll" :style="{ height: `${height}px` }">
        <el-tree
          ref="treeRef"
          v-loading="loading"
          :allow-drop="allowDrop"
          :check-strictly="checkStrictly"
          :data="renderedTree"
          :draggable="auth.rank"
          :expand-on-click-node="false"
          :props="defaultProps"
          :show-checkbox="multiMode"
          class="menu-page__tree"
          highlight-current
          node-key="pk"
          size="small"
          @check="handleCheck"
          @node-click="nodeClick"
          @node-drag-end="handleDrop"
        >
          <template #default="{ node, data }">
            <menu-tree-row
              :auth="auth"
              :busy="busyPks.has(String(data.pk))"
              :data="data"
              :keyword="filter.keyword"
              :node="node"
              @action="onRowAction"
              @contextmenu="onRowContextMenu"
              @toggle-active="toggleRowActive"
            />
          </template>
        </el-tree>

        <el-empty
          v-if="!loading && !visibleTree.length"
          :description="emptyText"
        />
      </div>
    </div>

    <menu-context-menu
      :actions="contextActions"
      :title="contextMenu.row ? displayTitle(contextMenu.row) : ''"
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      @close="closeContextMenu"
      @select="code => contextMenu.row && onRowAction(code, contextMenu.row)"
    />
  </div>
</template>

<style lang="scss" scoped>
.menu-page {
  display: flex;
  flex-direction: column;

  &__panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
  }

  /* 高度由 useTreeHeight 实测写入（取代旧实现两处口径不一致的 calc 魔法值） */
  &__scroll {
    padding: 4px 10px 8px;
    overflow: auto;
  }

  &:deep(.el-tree-node__content) {
    height: 32px;
    font-size: 14px;
  }

  &:deep(.el-tree-node.is-disabled > .el-tree-node__content) {
    color: var(--el-text-color-regular);
  }
}
</style>
