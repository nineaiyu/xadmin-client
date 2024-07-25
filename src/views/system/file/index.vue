<script lang="ts" setup>
import { ref } from "vue";
import { useSystemUploadFile } from "./utils/hook";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "systemUploadFile"
});

const tableRef = ref();

const {
  api,
  auth,
  listColumnsFormat,
  addOrEditOptions,
  tableBarButtonsProps,
  operationButtonsProps
} = useSystemUploadFile(tableRef);
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="systemUploadFile"
    :listColumnsFormat="listColumnsFormat"
    :addOrEditOptions="addOrEditOptions"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
