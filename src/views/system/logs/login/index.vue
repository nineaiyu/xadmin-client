<script lang="ts" setup>
import { useLoginLog } from "./utils/hook";
import ReBaseTable from "@/components/ReBaseTable/index.vue";

defineOptions({
  name: "SystemUserLoginLog"
});

const { api, auth, columns } = useLoginLog();
</script>

<template>
  <ReBaseTable
    :api="api"
    :auth="auth"
    locale-name="logsLogin"
    :table-columns="columns"
  />
</template>
