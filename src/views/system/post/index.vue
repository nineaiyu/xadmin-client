<script lang="ts" setup>
import { hasBatchSelection } from "@/views/system/components/batchSelection";
import { usePosts } from "./utils/hook";

defineOptions({
  name: "SystemPost" // 必须定义，用于菜单自动匹配组件
});

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = usePosts();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :selection="hasBatchSelection(auth, ['batchUpdate:SystemPost'])"
    locale-name="post"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
    recycleBin
  />
</template>
