<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useLoginLog } from "./utils/hook";

defineOptions({
  name: "SystemUserLoginLog"
});
const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  detailRowFetch,
  listColumnsFormat,
  operationButtonsProps
} = useLoginLog();
</script>

<template>
  <div>
    <!-- 强退的作用域说明：纯 HTTP 会话没有 WS channel，需到在线会话页处理 -->
    <p
      class="mb-2 text-xs text-(--el-text-color-secondary)"
      data-testid="login-log-logout-hint"
    >
      {{ t("logsLogin.logoutHint") }}
    </p>
    <RePlusPage
      ref="tableRef"
      :selection="false"
      :api="api"
      :auth="auth"
      locale-name="logsLogin"
      :detailRowFetch="detailRowFetch"
      :listColumnsFormat="listColumnsFormat"
      :operationButtonsProps="operationButtonsProps"
    />
  </div>
</template>
