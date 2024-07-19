<script lang="ts" setup>
import { useModelField } from "./utils/hook";
import { ref } from "vue";
import RePlusCRUD from "@/components/RePlusCRUD";

defineOptions({
  name: "SystemModelLabelField"
});
const tableRef = ref();

const { api, auth, tableBarButtonsProps } = useModelField(tableRef);
</script>

<template>
  <RePlusCRUD
    ref="tableRef"
    :api="api"
    :auth="auth"
    :operation="false"
    :selection="false"
    :tableBarButtonsProps="tableBarButtonsProps"
    locale-name="modelFieldManagement"
  />
</template>
