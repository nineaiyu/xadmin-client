<script lang="ts" setup>
import tree from "./components/tree.vue";
import PermissionPreview from "./components/PermissionPreview.vue";
import { computed, ref } from "vue";
import { useUser } from "./utils/hook";

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
  baseColumnsFormat,
  previewRef
} = useUser(tableRef);
</script>

<template>
  <div
    v-if="auth.list"
    :class="['flex', 'justify-between', deviceDetection() && 'flex-wrap']"
  >
    <tree
      ref="treeRef"
      :class="['mr-2', deviceDetection() ? 'w-full' : 'min-w-62.5']"
      :pk="treePk"
      :treeData="treeData"
      :treeLoading="treeLoading"
      @tree-select="onTreeSelect"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :class="[deviceDetection() ? ['w-full', 'mt-2'] : 'w-[calc(100%-250px)]']"
      :addOrEditOptions="addOrEditOptions"
      :baseColumnsFormat="baseColumnsFormat"
      :listColumnsFormat="listColumnsFormat"
      locale-name="systemUser"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
      recycleBin
      @selectionChange="selectionChange"
    />
    <!-- 权限可视化：三层权限只读预览 + 数据权限试算（auth.preview 门控按钮） -->
    <PermissionPreview ref="previewRef" />
  </div>
</template>

<style scoped lang="scss">
.main-content {
  margin: 24px 24px 0 !important;
}
</style>
