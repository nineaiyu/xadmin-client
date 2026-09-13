<script lang="ts" setup>
import { ref } from "vue";
import { useLeave } from "./utils/hook";

defineOptions({
  name: "SystemLeave" // 必须与后端菜单 name 一致（权限码后缀 + 路由组件匹配）
});

const tableRef = ref();

const {
  api,
  auth,
  operationButtonsProps,
  listColumnsFormat,
  addOrEditOptions
} = useLeave();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    locale-name="leaveApply"
  />
</template>
