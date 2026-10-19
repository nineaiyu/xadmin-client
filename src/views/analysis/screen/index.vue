<script lang="ts" setup>
import { ref } from "vue";
import { useScreen } from "./utils/hook";

defineOptions({
  name: "DataScreen"
});

const tableRef = ref();
const {
  api,
  auth,
  addOrEditOptions,
  listColumnsFormat,
  operationButtonsProps
} = useScreen();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :addOrEditOptions="addOrEditOptions"
    locale-name="dataScreen"
    :selection="false"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
