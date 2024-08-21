<script lang="ts" setup>
import { deviceDetection } from "@pureadmin/utils";
import { useUserLoginLog } from "@/views/account/utils/hook";

defineOptions({
  name: "SecurityLog"
});

const { t, auth, columns, loading, dataList, pagination, onSearch } =
  useUserLoginLog();
</script>

<template>
  <div
    :class="[
      'min-w-[180px]',
      deviceDetection() ? 'max-w-[100%]' : 'max-w-[70%]'
    ]"
  >
    <h3 class="my-8">{{ t("account.securityLog") }}</h3>
    <pure-table
      v-if="auth.list"
      :columns="columns"
      :data="dataList"
      :loading="loading"
      :pagination="pagination"
      row-key="pk"
      table-layout="auto"
      align-whole="center"
      showOverflowTooltip
      @page-current-change="onSearch"
    />
  </div>
</template>
