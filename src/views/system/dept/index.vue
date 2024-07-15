<script lang="ts" setup>
import { ref } from "vue";
import { useDept } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";
import { handleTree } from "@/utils/tree";

defineOptions({
  name: "SystemDept"
});

const tableRef = ref();

const {
  t,
  api,
  auth,
  listColumnsFormat,
  addOrEditOptions,
  baseColumnsFormat,
  operationButtonsProps
} = useDept(tableRef);
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    :addOrEditOptions="addOrEditOptions"
    :baseColumnsFormat="baseColumnsFormat"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :pagination="{ pageSize: 1000, pageSizes: [100, 500, 1000] }"
    :searchResultFormat="data => handleTree(data)"
    locale-name="systemDept"
  />
</template>
