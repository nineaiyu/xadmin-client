<script lang="ts" setup>
import { useOperationLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemOperationLog"
});

const { api, auth, columns, pagination } = useOperationLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    :table-columns="columns"
    locale-name="logsOperation"
    :pagination="pagination"
  />
</template>
