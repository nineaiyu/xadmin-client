<script lang="ts" setup>
import { ref } from "vue";
import { useDataDict } from "./utils/hook";

defineOptions({
  name: "SystemDataDict" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();
const { api, auth, listColumnsFormat, operationButtonsProps } =
  useDataDict(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="dataDict"
    :list-columns-format="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
