<script lang="ts" setup>
import { ref } from "vue";
import { useNotice } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemNotice"
});

const tableRef = ref();

const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps,
  searchComplete
} = useNotice(tableRef);
</script>
<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemNotice"
    :addOrEditOptions="addOrEditOptions"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    @searchComplete="searchComplete"
  />
</template>
