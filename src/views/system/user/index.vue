<script lang="ts" setup>
import tree from "./components/UserTree.vue";
import { computed, ref } from "vue";
import { useUser } from "./utils/hook";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";

defineOptions({
  name: "SystemUser"
});

const tableRef = ref();
const treeRef = ref();

const treePk = computed(() => {
  return tableRef.value?.searchFields?.dept;
});

const {
  api,
  auth,
  treeData,
  treeLoading,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps,
  onTreeSelect,
  selectionChange,
  deviceDetection,
  listColumnsFormat,
  baseColumnsFormat
} = useUser(tableRef);

// 左栏宽度持久化（默认 20%，约等于原 250px 固定宽；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("system/user", {
  defaultPercent: 20,
  minPercent: 10
});
</script>

<template>
  <div v-if="auth.list">
    <!-- 桌面：可拖拽分栏（宽度比例持久化到 WEB_SITE_CONFIG.SplitPanes） -->
    <ReSplitPane
      v-if="!deviceDetection()"
      v-model:percent="percent"
      :split-set="{ minPercent: 10, defaultPercent: 20, split: 'vertical' }"
      @drag-end="handleDragEnd"
    >
      <template #paneL>
        <tree
          ref="treeRef"
          :pk="treePk"
          :treeData="treeData"
          :treeLoading="treeLoading"
          @tree-select="onTreeSelect"
        />
      </template>
      <template #paneR>
        <RePlusPage
          ref="tableRef"
          :api="api"
          :auth="auth"
          :addOrEditOptions="addOrEditOptions"
          :baseColumnsFormat="baseColumnsFormat"
          :listColumnsFormat="listColumnsFormat"
          locale-name="systemUser"
          :operationButtonsProps="operationButtonsProps"
          :tableBarButtonsProps="tableBarButtonsProps"
          saved-views
          advanced-filter
          recycleBin
          @selectionChange="selectionChange"
        />
      </template>
    </ReSplitPane>
    <!-- 移动端：上下堆叠 -->
    <div v-else :class="['flex', 'justify-between', 'flex-wrap']">
      <tree
        ref="treeRef"
        :pk="treePk"
        :treeData="treeData"
        :treeLoading="treeLoading"
        class="w-full"
        @tree-select="onTreeSelect"
      />
      <RePlusPage
        ref="tableRef"
        :api="api"
        :auth="auth"
        :class="['w-full', 'mt-2']"
        :addOrEditOptions="addOrEditOptions"
        :baseColumnsFormat="baseColumnsFormat"
        :listColumnsFormat="listColumnsFormat"
        locale-name="systemUser"
        :operationButtonsProps="operationButtonsProps"
        :tableBarButtonsProps="tableBarButtonsProps"
        saved-views
        advanced-filter
        recycleBin
        @selectionChange="selectionChange"
      />
    </div>
    <!-- 权限可视化：三层权限只读预览 + 数据权限试算（hook 经 addDrawer 打开） -->
  </div>
</template>

<style scoped lang="scss">
.main-content {
  --main-content-margin: 24px 24px 0;
}
</style>
