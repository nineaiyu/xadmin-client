<script lang="ts" setup>
import { ref } from "vue";
import { useAccountRisk } from "./utils/hook";

defineOptions({
  name: "SystemAccountRisk"
});

const tableRef = ref();

const {
  api,
  auth,
  tableBarButtonsProps,
  operationButtonsProps,
  listColumnsFormat
} = useAccountRisk(tableRef);
</script>

<template>
  <div v-if="auth.list">
    <!-- 账号安全风险清单：巡检发现 → 处置 → 留痕；详情抽屉展示风险说明与建议 -->
    <RePlusPage
      ref="tableRef"
      :api="api"
      :auth="auth"
      locale-name="systemAccountRisk"
      :tableBarButtonsProps="tableBarButtonsProps"
      :operationButtonsProps="operationButtonsProps"
      :listColumnsFormat="listColumnsFormat"
    />
  </div>
</template>
