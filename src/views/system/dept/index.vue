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
    :isTree="true"
    :addOrEditOptions="addOrEditOptions"
    :baseColumnsFormat="baseColumnsFormat"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    locale-name="systemDept"
  />
</template>
