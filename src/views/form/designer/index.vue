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
  detailColumnsFormat,
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
    :detailColumnsFormat="detailColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
    :tableBarButtonsProps="tableBarButtonsProps"
  />
</template>
