<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable";

defineOptions({
  name: "SystemUserLoginLog"
});

const { api, auth, columns } = useLoginLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    :table-columns="columns"
    locale-name="logsLogin"
  />
</template>
