<script lang="ts" setup>
import { ref } from "vue";
import { useSystemUploadFile } from "./utils/hook";
import StorageStats from "./components/StorageStats.vue";

defineOptions({
  name: "SystemUploadFile"
});

const tableRef = ref();

const {
  api,
  auth,
  stats,
  searchColumnsFormat,
  listColumnsFormat,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps
} = useSystemUploadFile(tableRef);
</script>

<template>
  <div class="file-center">
    <!-- 宽度/对齐与 RePlusPage 列表区（w-99/100）保持一致，避免上下边缘错位 -->
    <storage-stats
      v-if="auth.list && stats"
      :stats="stats"
      class="w-99/100 mb-2!"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemUploadFile"
      saved-views
      advanced-filter
      :searchColumnsFormat="searchColumnsFormat"
      :listColumnsFormat="listColumnsFormat"
      :addOrEditOptions="addOrEditOptions"
      :operationButtonsProps="operationButtonsProps"
      :tableBarButtonsProps="tableBarButtonsProps"
      recycleBin
    />
  </div>
</template>
