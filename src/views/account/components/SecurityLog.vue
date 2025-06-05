<script lang="ts" setup>
import { deviceDetection } from "@pureadmin/utils";
import { useUserLoginLog } from "@/views/account/utils/hook";

defineOptions({
  name: "SecurityLog"
});

const { t, api, auth, pagination, listColumnsFormat } = useUserLoginLog();
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.securityLog") }}</h3>
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
  </div>
</template>
