<script lang="ts" setup>
import { RePlusPage } from "@/components/RePlusPage";
import { useDemoBook } from "./utils/hook";
import { ref } from "vue";

defineOptions({
  name: "DemoBook" // 必须定义，用于菜单自动匹配组件
});
const tableRef = ref();
const { api, auth, addOrEditOptions, operationButtonsProps } =
  useDemoBook(tableRef);
</script>
<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="demoBook"
    :add-or-edit-options="addOrEditOptions"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
