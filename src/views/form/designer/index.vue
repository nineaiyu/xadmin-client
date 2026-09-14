<script lang="ts" setup>
import { ref } from "vue";
import { useFormDesigner } from "./utils/hook";

defineOptions({
  name: "FormDesigner"
});

const tableRef = ref();
const {
  api,
  auth,
  listColumnsFormat,
  operationButtonsProps,
  tableBarButtonsProps
} = useFormDesigner(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="dform"
    :selection="false"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
