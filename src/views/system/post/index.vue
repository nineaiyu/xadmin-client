<script lang="ts" setup>
import { ref } from "vue";
import { usePosts } from "./utils/hook";

defineOptions({
  name: "SystemPost" // 必须定义，用于菜单自动匹配组件
});

const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = usePosts(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="post"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
