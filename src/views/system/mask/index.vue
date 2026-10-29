<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useMask } from "./utils/hook";

defineOptions({
  name: "SystemDataMaskRule" // 必须定义，用于菜单自动匹配组件
});
const { t } = useI18n();

const {
  api,
  auth,
  tableRef,
  addOrEditOptions,
  listColumnsFormat,
  tableBarButtonsProps,
  operationButtonsProps
} = useMask();
</script>

<template>
  <div>
    <!-- 停用规则会立即还原明文：列表开关是二态控件，必须在页面显式提示后果 -->
    <el-alert
      class="mb-2"
      type="warning"
      :closable="false"
      show-icon
      :title="t('mask.disableRiskHint')"
    />
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      :selection="Boolean(auth.batchDestroy)"
      :addOrEditOptions="addOrEditOptions"
      :listColumnsFormat="listColumnsFormat"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      locale-name="mask"
    />
  </div>
</template>
