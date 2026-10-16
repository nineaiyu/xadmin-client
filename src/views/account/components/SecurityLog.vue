<script lang="ts" setup>
import { useUserLoginLog } from "@/views/account/utils/hook";
import AccountPanel from "./AccountPanel.vue";

defineOptions({
  name: "SecurityLog"
});

const { t, api, auth, pagination, listColumnsFormat } = useUserLoginLog();

/**
 * 表格自适应高度的底部预留：框架缺省 110px 只按「列表页直铺」口径，
 * 本页表格外面包了面板卡片（卡片内边距 + 面板底部留白 + 分栏页边距），
 * 按缺省值算表格会高出视口，把页面顶出滚动条，这里按实测加到 150。
 */
const pureTableProps = { adaptiveConfig: { offsetBottom: 150 } };
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
      :pure-table-props="pureTableProps"
      title=""
      locale-name="logsLogin"
    />
  </AccountPanel>
</template>
