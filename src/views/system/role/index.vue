<script lang="ts" setup>
import { useRole } from "./utils/hook";

defineOptions({
  name: "SystemRole"
});

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useRole();
</script>

<template>
  <!-- FEAT-2：回收站入口（auth.recycleList 显隐），列 label 按 localeName 自动翻译 -->
  <RePlusPage
    :api="api"
    :auth="auth"
    locale-name="systemRole"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :recycleBin="[{ prop: 'name' }, { prop: 'code' }]"
  />
</template>
