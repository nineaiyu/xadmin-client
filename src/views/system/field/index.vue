<script lang="ts" setup>
import { useModelField } from "./utils/hook";
import { ref } from "vue";
import { RePlusPage } from "@/components/RePlusPage";

defineOptions({
  name: "SystemModelLabelField"
});
const tableRef = ref();

const { api, auth, tableBarButtonsProps } = useModelField(tableRef);
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    :operation="false"
    :tableBarButtonsProps="tableBarButtonsProps"
    :plusSearchProps="{ labelWidth: 110 }"
    locale-name="modelFieldManagement"
  />
</template>
