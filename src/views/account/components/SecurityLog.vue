<script lang="ts" setup>
import { useUserLoginLog } from "@/views/account/utils/hook";
import AccountPanel from "./AccountPanel.vue";

defineOptions({
  name: "SecurityLog"
});

const { t, api, auth, pagination, listColumnsFormat } = useUserLoginLog();
</script>

<template>
  <AccountPanel :title="t('account.securityLog')">
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :operation="false"
      :selection="false"
      :pagination="pagination"
      :listColumnsFormat="listColumnsFormat"
      title=""
      locale-name="logsLogin"
    />
  </AccountPanel>
</template>
