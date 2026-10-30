<script lang="ts" setup>
import { ref } from "vue";
import { hasBatchSelection } from "@/views/system/components/batchSelection";
import { useKnowledge } from "./utils/hook";

defineOptions({
  name: "AiKnowledge" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
/** 勾选态驱动批量启停按钮显隐（与框架批量删除同口径） */
const hasSelection = ref(false);
const onSelectionChange = (rows: unknown[]) => {
  hasSelection.value = rows.length > 0;
};
const {
  api,
  auth,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useKnowledge(tableRef, hasSelection);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="hasBatchSelection(auth, ['batchToggle:AiKnowledge'])"
    locale-name="aiKnowledge"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    @selection-change="onSelectionChange"
  />
</template>
