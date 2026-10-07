<script lang="ts" setup>
import { ref } from "vue";
import { useExportRecord } from "../utils/hook";

defineOptions({
  name: "ExportRecordPanel"
});
// 表格实例交给 hook：进行中记录的进度轮询复用列表取数（含搜索/分页参数）
const tableRef = ref();
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useExportRecord(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemExportRecord"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
