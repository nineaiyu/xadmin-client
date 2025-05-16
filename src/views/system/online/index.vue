<script lang="ts" setup>
import { useUserOnline } from "./utils/hook";

defineOptions({
  name: "SystemUserOnline"
});

const { api, auth, listColumnsFormat, operationButtonsProps } = useUserOnline();
</script>

<template>
  <RePlusPage
    ref="tableRef"
    :api="api"
    :auth="auth"
    locale-name="userOnline"
    :listColumnsFormat="listColumnsFormat"
    :operationButtonsProps="operationButtonsProps"
  />
</template>
