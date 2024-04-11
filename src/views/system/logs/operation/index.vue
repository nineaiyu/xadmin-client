<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemOperationLog"
});

const { api, auth, columns } = useOperationLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    locale-name="logsOperation"
    :table-columns="columns"
  />
</template>
