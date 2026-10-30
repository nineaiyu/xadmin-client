<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useOperationLog } from "./utils/hook";

defineOptions({
  name: "SystemOperationLog"
});

const { t } = useI18n();
const {
  api,
  auth,
  tableRef,
  listColumnsFormat,
  detailColumnsFormat,
  detailRowFetch,
  operationButtonsProps
} = useOperationLog();
</script>

<template>
  <div>
    <!-- 导出面比列表宽：明确包含请求/响应正文及截断上限，避免误导出大体积敏感上下文 -->
    <el-alert
      class="mb-2"
      type="info"
      :closable="false"
      show-icon
      :title="t('logsOperation.exportBodyHint')"
    />
    <RePlusPage
      ref="tableRef"
      :selection="false"
      :api="api"
      :auth="auth"
      locale-name="logsOperation"
      :listColumnsFormat="listColumnsFormat"
      :detailColumnsFormat="detailColumnsFormat"
      :detailRowFetch="detailRowFetch"
      :operationButtonsProps="operationButtonsProps"
      advanced-filter
    />
  </div>
</template>
