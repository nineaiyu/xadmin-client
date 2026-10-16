<script lang="ts" setup>
import { ref } from "vue";
import { useKnowledge } from "./utils/hook";

defineOptions({
  name: "AiKnowledge" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useKnowledge(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="aiKnowledge"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
