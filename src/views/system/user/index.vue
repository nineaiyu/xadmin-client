<script lang="ts" setup>
import tree from "./components/UserTree.vue";
import { computed, reactive, ref } from "vue";
import { useUser } from "./utils/hook";
import { hasBatchSelection } from "@/views/system/components/batchSelection";
import { ReSplitPane } from "@/components/ReSplitPane";
import { useSplitPaneConfig } from "@/hooks/useSplitPaneConfig";

defineOptions({
  name: "SystemUser"
});

const treeRef = ref();

const {
  api,
  auth,
  tableRef,
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
} = useUser();

const treePk = computed(() => {
  return tableRef.value?.searchFields?.dept;
});

// 左栏宽度持久化（默认 20%，约等于原 250px 固定宽；双击分隔条或点悬浮按钮重置）
const { percent, handleDragEnd } = useSplitPaneConfig("system/user", {
  defaultPercent: 20,
  minPercent: 10
});

/**
 * 列表页配置：桌面分栏与移动堆叠两分支共用同一份（避免双份维护漂移）。
 * 必须用 reactive：`addOrEditOptions` / 两个按钮组是 shallowRef，普通对象经
 * `v-bind` 传给子组件时不会解包，页面级表单定制与自定义按钮会整体失效。
 */
/** 勾选列 = 任一批量动作已授权（批删/批量更新/批量通知/批量打标） */
const selection = computed(() =>
  hasBatchSelection(auth, [
    "batchUpdate:SystemUser",
    "create:SystemNotice",
    "assign:Tag"
  ])
);

const plusPageProps = reactive({
  api,
  auth,
  addOrEditOptions,
  baseColumnsFormat,
  listColumnsFormat,
  localeName: "systemUser",
  operationButtonsProps,
  tableBarButtonsProps,
  selection
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
          v-bind="plusPageProps"
          saved-views
          advanced-filter
          recycleBin
          @selectionChange="selectionChange"
        />
      </template>
    </ReSplitPane>
    <!-- 移动端：上下堆叠（部门树限高，用户列表紧随其后） -->
    <div v-else :class="['flex', 'justify-between', 'flex-wrap']">
      <tree
        ref="treeRef"
        :pk="treePk"
        :treeData="treeData"
        :treeLoading="treeLoading"
        class="w-full"
        compact
        @tree-select="onTreeSelect"
      />
      <RePlusPage
        ref="tableRef"
        v-bind="plusPageProps"
        :class="['w-full', 'mt-2']"
        saved-views
        advanced-filter
        recycleBin
        @selectionChange="selectionChange"
      />
    </div>
    <!-- 权限可视化：三层权限只读预览 + 数据权限试算（hook 经 addDrawer 打开） -->
  </div>
</template>
