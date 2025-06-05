<script lang="ts" setup>
import { ref } from "vue";
import { useSystemUploadFile } from "./utils/hook";

defineOptions({
  name: "SystemUploadFile"
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
  <RePlusPage
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
