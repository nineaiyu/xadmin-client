<script lang="ts" setup>
import { useModelField } from "./utils/hook";

defineOptions({
  name: "SystemModelLabelField"
});

const { api, auth, tableRef, tableBarButtonsProps } = useModelField();
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
